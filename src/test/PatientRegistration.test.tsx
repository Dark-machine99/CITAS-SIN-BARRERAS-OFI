import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../app/providers/AuthProvider'
import { AuthPage, ConfirmEmailPage } from '../features/auth/AuthPages'
import type { AccessibilityPreferencesRow, PatientAccountAdapter, PatientProfile } from '../services/supabase/patientAccountAdapter'

const session = { user: { id: 'patient-1', email: 'ana@example.test' } } as unknown as Session
const profile: PatientProfile = { id: 'patient-1', first_name: 'Ana', last_name: 'Pérez', phone: null, role: 'patient', must_change_password: false, created_at: '2026-01-01', updated_at: '2026-01-01' }
const preferences: AccessibilityPreferencesRow = { user_id: 'patient-1', preset: 'standard', font_scale: 1, high_contrast: false, large_cursor: false, magnifier_enabled: false, guided_reading: false, reduced_motion: false, simple_mode: false, colorblind_mode: false, keyboard_enhancements: false, voice_control: false, updated_at: '2026-01-01' }

function adapter(signUpResult: Session | null): PatientAccountAdapter {
  return {
    getSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    signUp: vi.fn().mockResolvedValue(signUpResult),
    signIn: vi.fn(),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    loadAccount: vi.fn().mockResolvedValue({ profile, preferences }),
    updateProfile: vi.fn(),
    updatePreferences: vi.fn(),
  }
}

async function completeRegistration(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /^nombre$/i }), 'Ana')
  await user.type(screen.getByRole('textbox', { name: /^apellido$/i }), 'Pérez')
  await user.type(screen.getByRole('textbox', { name: /^correo$/i }), 'ana@example.test')
  await user.type(screen.getByLabelText(/^contraseña$/i), 'segura123')
  await user.click(screen.getByRole('checkbox', { name: /acepto el borrador/i }))
  await user.click(screen.getByRole('button', { name: /^crear cuenta$/i }))
}

function renderRegistration(accountAdapter: PatientAccountAdapter) {
  return render(<MemoryRouter initialEntries={['/registro']}><AuthProvider adapter={accountAdapter}><Routes>
    <Route path="/registro" element={<AuthPage kind="register" />} />
    <Route path="/onboarding/accesibilidad" element={<h1>Onboarding de accesibilidad</h1>} />
    <Route path="/confirmar-correo" element={<h1>Confirmación pendiente</h1>} />
  </Routes></AuthProvider></MemoryRouter>)
}

function renderConfirmation(accountAdapter: PatientAccountAdapter) {
  return render(<MemoryRouter initialEntries={['/confirmar-correo']}><AuthProvider adapter={accountAdapter}><Routes>
    <Route path="/confirmar-correo" element={<ConfirmEmailPage />} />
  </Routes></AuthProvider></MemoryRouter>)
}

afterEach(cleanup)

describe('continuación del registro Paciente', () => {
  it('continúa al onboarding cuando Supabase devuelve una sesión inmediata', async () => {
    const user = userEvent.setup()
    const accountAdapter = adapter(session)
    renderRegistration(accountAdapter)

    await completeRegistration(user)

    expect(await screen.findByRole('heading', { name: /onboarding de accesibilidad/i })).toBeInTheDocument()
    expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(1)
    expect(accountAdapter.signOut).not.toHaveBeenCalled()
  })

  it('conserva la confirmación pendiente cuando Supabase no devuelve sesión', async () => {
    const user = userEvent.setup()
    const accountAdapter = adapter(null)
    renderRegistration(accountAdapter)

    await completeRegistration(user)

    expect(await screen.findByRole('heading', { name: /confirmación pendiente/i })).toBeInTheDocument()
    expect(accountAdapter.loadAccount).not.toHaveBeenCalled()
  })

  it('no presenta una sesión inmediata del piloto como correo confirmado', async () => {
    const accountAdapter = adapter(null)
    accountAdapter.getSession = vi.fn().mockResolvedValue(session)
    renderConfirmation(accountAdapter)

    expect(await screen.findByRole('heading', { name: /tu cuenta ya está lista/i })).toBeInTheDocument()
    expect(screen.getByText('Sesión activa')).toBeInTheDocument()
    expect(screen.getByText(/tu sesión y tu perfil paciente están disponibles/i)).toBeInTheDocument()
    expect(screen.queryByText(/correo confirmado/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/identidad.*verificad/i)).not.toBeInTheDocument()
  })
})
