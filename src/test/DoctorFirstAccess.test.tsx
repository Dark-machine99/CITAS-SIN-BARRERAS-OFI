import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../app/providers/AuthProvider'
import { DemoSessionProvider } from '../app/providers/DemoSessionProvider'
import { RoleLayout } from '../components/layout/RoleLayout'
import { DoctorFirstAccessBoundary, RequireDoctor } from '../features/auth/RequireDoctor'
import { DoctorPasswordPage } from '../features/doctor/DoctorPages'
import { DoctorFirstAccessError, type DoctorFirstAccessAdapter } from '../services/supabase/doctorFirstAccessAdapter'
import type { AccessibilityPreferencesRow, PatientAccount, PatientAccountAdapter, PatientProfile } from '../services/supabase/patientAccountAdapter'

const userId = '11111111-1111-4111-8111-111111111111'
const session = { user: { id: userId, email: 'doctor@example.test' } } as unknown as Session
const preferences: AccessibilityPreferencesRow = { user_id: userId, preset: 'standard', font_scale: 1, high_contrast: false, large_cursor: false, magnifier_enabled: false, guided_reading: false, reduced_motion: false, simple_mode: false, colorblind_mode: false, keyboard_enhancements: false, voice_control: false, updated_at: '2026-11-07' }
const profile = (role: PatientProfile['role'] = 'doctor', mustChange = true): PatientProfile => ({ id: userId, first_name: 'Lucía', last_name: 'Torres', phone: null, role, must_change_password: mustChange, created_at: '2026-11-07', updated_at: '2026-11-07' })
const account = (role: PatientProfile['role'] = 'doctor', mustChange = true): PatientAccount => ({ profile: profile(role, mustChange), preferences })

function accountAdapter(overrides: Partial<PatientAccountAdapter> = {}): PatientAccountAdapter {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    signUp: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    loadAccount: vi.fn().mockResolvedValue(account()),
    updateProfile: vi.fn().mockResolvedValue(profile()),
    updatePreferences: vi.fn().mockResolvedValue(preferences),
    ...overrides,
  }
}

function firstAccessAdapter(overrides: Partial<DoctorFirstAccessAdapter> = {}): DoctorFirstAccessAdapter {
  return { complete: vi.fn().mockResolvedValue('completed'), ...overrides }
}

function TestBackButton() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(-1)}>Atrás del navegador</button>
}

function renderFlow(route: string | string[], authAdapter: PatientAccountAdapter, completionAdapter = firstAccessAdapter()) {
  const initialEntries = typeof route === 'string' ? [route] : route
  return render(<MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}><AuthProvider adapter={authAdapter}><TestBackButton /><DoctorFirstAccessBoundary><Routes>
    <Route path="/login" element={<h1>Ingreso seguro</h1>} />
    <Route path="/acceso-denegado" element={<h1>Acceso no disponible</h1>} />
    <Route path="/accesibilidad" element={<h1>Preferencias expuestas</h1>} />
    <Route element={<RequireDoctor />}>
      <Route path="/medico/cambiar-contrasena" element={<DoctorPasswordPage adapter={completionAdapter} />} />
      <Route path="/medico" element={<h1>Agenda médica protegida</h1>} />
      <Route path="/medico/citas/:id" element={<h1>Detalle médico protegido</h1>} />
      <Route path="/medico/accesibilidad" element={<h1>Preferencias médicas protegidas</h1>} />
    </Route>
  </Routes></DoctorFirstAccessBoundary></AuthProvider></MemoryRouter>)
}

afterEach(cleanup)

describe('gate real de primer acceso médico', () => {
  it('no filtra una URL médica directa mientras carga y redirige al gate pendiente', async () => {
    let resolveAccount!: (value: PatientAccount) => void
    const pending = new Promise<PatientAccount>((resolve) => { resolveAccount = resolve })
    renderFlow('/medico/citas/cita-1', accountAdapter({ loadAccount: vi.fn().mockReturnValue(pending) }))

    expect(screen.getByRole('heading', { name: /verificando tu cuenta/i })).toBeInTheDocument()
    expect(screen.queryByText('Detalle médico protegido')).not.toBeInTheDocument()
    await act(async () => { resolveAccount(account()); await pending })
    const heading = await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })
    expect(heading).toHaveFocus()
    expect(screen.queryByText('Detalle médico protegido')).not.toBeInTheDocument()
  })

  it('impide que navegar atrás restaure contenido médico mientras el gate sigue pendiente', async () => {
    const user = userEvent.setup()
    renderFlow(['/medico', '/medico/citas/cita-1'], accountAdapter())
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.click(screen.getByRole('button', { name: /atrás del navegador/i }))

    expect(await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })).toBeInTheDocument()
    expect(screen.queryByText(/agenda médica protegida|detalle médico protegido/i)).not.toBeInTheDocument()
  })

  it('impide abrir preferencias por URL directa antes de completar el gate', async () => {
    renderFlow('/accesibilidad', accountAdapter())

    expect(await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })).toBeInTheDocument()
    expect(screen.queryByText('Preferencias expuestas')).not.toBeInTheDocument()
  })

  it.each(['patient', 'admin'] as const)('rechaza el flujo de primer acceso para el rol %s', async (role) => {
    renderFlow('/medico/cambiar-contrasena', accountAdapter({ loadAccount: vi.fn().mockResolvedValue(account(role)) }))

    expect(await screen.findByRole('heading', { name: /acceso no disponible/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })

  it('evita que un médico sin gate vuelva a cambiar la contraseña', async () => {
    const completion = firstAccessAdapter()
    renderFlow('/medico/cambiar-contrasena', accountAdapter({ loadAccount: vi.fn().mockResolvedValue(account('doctor', false)) }), completion)

    expect(await screen.findByRole('heading', { name: /agenda médica protegida/i })).toBeInTheDocument()
    expect(completion.complete).not.toHaveBeenCalled()
  })

  it('presenta el shell médico con identidad real sin depender de una sesión demo', async () => {
    render(<MemoryRouter initialEntries={['/medico']}><DemoSessionProvider><AuthProvider adapter={accountAdapter({ loadAccount: vi.fn().mockResolvedValue(account('doctor', false)) })}><DoctorFirstAccessBoundary><Routes>
      <Route element={<RequireDoctor />}><Route path="/medico" element={<RoleLayout appRole="doctor" />}><Route index element={<h1>Contenido médico autorizado</h1>} /></Route></Route>
      <Route path="/acceso-denegado" element={<h1>Acceso no disponible</h1>} />
    </Routes></DoctorFirstAccessBoundary></AuthProvider></DemoSessionProvider></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: /contenido médico autorizado/i })).toBeInTheDocument()
    expect(screen.getByText('Lucía Torres')).toBeInTheDocument()
    expect(screen.getByText(/sesión médica verificada/i)).toBeInTheDocument()
    expect(screen.queryByText(/médico · entorno de demostración/i)).not.toBeInTheDocument()
  })

  it('valida contraseña y confirmación, y enfoca el primer campo incorrecto', async () => {
    const user = userEvent.setup()
    const completion = firstAccessAdapter()
    renderFlow('/medico/cambiar-contrasena', accountAdapter(), completion)
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))
    expect(screen.getByLabelText('Nueva contraseña')).toHaveFocus()
    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-clave-2026')
    await user.type(screen.getByLabelText('Confirma la nueva contraseña'), 'otra-clave')
    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))

    expect(screen.getByText(/las contraseñas no coinciden/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Confirma la nueva contraseña')).toHaveFocus()
    expect(completion.complete).not.toHaveBeenCalled()
  })

  it.each(['completed', 'already_completed'] as const)('recarga el profile servidor antes de desbloquear el estado %s', async (status) => {
    const user = userEvent.setup()
    const loadAccount = vi.fn().mockResolvedValueOnce(account()).mockResolvedValueOnce(account('doctor', false))
    const authAdapter = accountAdapter({ loadAccount })
    const completion = firstAccessAdapter({ complete: vi.fn().mockResolvedValue(status) })
    renderFlow('/medico/cambiar-contrasena', authAdapter, completion)
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-clave-2026')
    await user.type(screen.getByLabelText('Confirma la nueva contraseña'), 'Nueva-clave-2026')
    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))

    expect(await screen.findByRole('heading', { name: /agenda médica protegida/i })).toBeInTheDocument()
    expect(completion.complete).toHaveBeenCalledWith('Nueva-clave-2026')
    expect(loadAccount).toHaveBeenCalledTimes(2)
    expect(authAdapter.updateProfile).not.toHaveBeenCalled()
    expect(authAdapter.updatePassword).not.toHaveBeenCalled()
  })

  it('mantiene el gate y explica la recuperación saneada ante FINALIZATION_PENDING', async () => {
    const user = userEvent.setup()
    const completion = firstAccessAdapter({ complete: vi.fn().mockRejectedValue(new DoctorFirstAccessError('FINALIZATION_PENDING')) })
    const authAdapter = accountAdapter()
    renderFlow('/medico/cambiar-contrasena', authAdapter, completion)
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-clave-2026')
    await user.type(screen.getByLabelText('Confirma la nueva contraseña'), 'Nueva-clave-2026')
    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/la contraseña pudo cambiar, pero el acceso sigue bloqueado/i)
    expect(alert).not.toHaveTextContent(/correlation|token|internal/i)
    expect(alert).toHaveFocus()
    expect(screen.getByRole('button', { name: /reintentar con otra contraseña/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /volver a iniciar sesión/i })).toBeInTheDocument()
    expect(authAdapter.loadAccount).toHaveBeenCalledTimes(1)
  })

  it.each(['UNAUTHORIZED', 'FORBIDDEN'] as const)('cierra la sesión y permite reautenticarse ante %s', async (code) => {
    const user = userEvent.setup()
    const completion = firstAccessAdapter({ complete: vi.fn().mockRejectedValue(new DoctorFirstAccessError(code)) })
    const authAdapter = accountAdapter()
    renderFlow('/medico/cambiar-contrasena', authAdapter, completion)
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-clave-2026')
    await user.type(screen.getByLabelText('Confirma la nueva contraseña'), 'Nueva-clave-2026')
    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))

    expect(await screen.findByRole('button', { name: /volver a iniciar sesión/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /intentar nuevamente|guardar y abrir mi agenda/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/agenda médica protegida/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /volver a iniciar sesión/i }))

    expect(await screen.findByRole('heading', { name: /ingreso seguro/i })).toBeInTheDocument()
    expect(authAdapter.signOut).toHaveBeenCalledTimes(1)
  })

  it('ofrece reautenticación ante un error no clasificado sin filtrar detalles', async () => {
    const user = userEvent.setup()
    const completion = firstAccessAdapter({ complete: vi.fn().mockRejectedValue(new Error('private operation error')) })
    renderFlow('/medico/cambiar-contrasena', accountAdapter(), completion)
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-clave-2026')
    await user.type(screen.getByLabelText('Confirma la nueva contraseña'), 'Nueva-clave-2026')
    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/vuelve a iniciar sesión/i)
    expect(alert).not.toHaveTextContent(/private operation error/i)
    expect(screen.getByRole('button', { name: /volver a iniciar sesión/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /intentar nuevamente/i })).not.toBeInTheDocument()
  })

  it.each(['INVALID_INPUT', 'PASSWORD_CHANGE_FAILED', 'INTERNAL_ERROR'] as const)('conserva el reintento local y no fuerza cierre de sesión ante %s', async (code) => {
    const user = userEvent.setup()
    const completion = firstAccessAdapter({ complete: vi.fn().mockRejectedValue(new DoctorFirstAccessError(code)) })
    const authAdapter = accountAdapter()
    renderFlow('/medico/cambiar-contrasena', authAdapter, completion)
    await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })

    await user.type(screen.getByLabelText('Nueva contraseña'), 'Nueva-clave-2026')
    await user.type(screen.getByLabelText('Confirma la nueva contraseña'), 'Nueva-clave-2026')
    await user.click(screen.getByRole('button', { name: /guardar y abrir mi agenda/i }))

    expect(await screen.findByRole('button', { name: /intentar nuevamente/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /volver a iniciar sesión/i })).not.toBeInTheDocument()
    expect(authAdapter.signOut).not.toHaveBeenCalled()
  })

  it('permite reintentar una carga de profile fallida sin mostrar agenda', async () => {
    const user = userEvent.setup()
    const loadAccount = vi.fn().mockRejectedValueOnce(new Error('private table leaked')).mockResolvedValueOnce(account())
    renderFlow('/medico', accountAdapter({ loadAccount }))

    expect(await screen.findByRole('heading', { name: /no pudimos verificar tu acceso médico/i })).toBeInTheDocument()
    expect(screen.queryByText('Agenda médica protegida')).not.toBeInTheDocument()
    expect(screen.queryByText(/private table leaked/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reintentar/i }))

    expect(await screen.findByRole('heading', { name: /crea tu nueva contraseña/i })).toBeInTheDocument()
    expect(loadAccount).toHaveBeenCalledTimes(2)
  })

  it('envía una sesión ausente al ingreso sin renderizar el gate', async () => {
    renderFlow('/medico', accountAdapter({ getSession: vi.fn().mockResolvedValue(null) }))

    expect(await screen.findByRole('heading', { name: /ingreso seguro/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument()
  })
})
