import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AccessibilityProvider, useAccessibility } from '../app/providers/AccessibilityProvider'
import { AuthProvider, useAuth } from '../app/providers/AuthProvider'
import type { AccessibilityPreferencesRow, PatientAccountAdapter, PatientProfile } from '../services/supabase/patientAccountAdapter'

const session = { user: { id: 'patient-1', email: 'ana@example.test' } } as unknown as Session
const profile: PatientProfile = { id: 'patient-1', first_name: 'Ana', last_name: 'Pérez', phone: null, role: 'patient', must_change_password: false, created_at: '2026-01-01', updated_at: '2026-01-01' }
const preferences: AccessibilityPreferencesRow = { user_id: 'patient-1', preset: 'low-vision', font_scale: 1.25, high_contrast: true, large_cursor: true, magnifier_enabled: false, guided_reading: false, reduced_motion: false, simple_mode: false, colorblind_mode: false, keyboard_enhancements: false, voice_control: false, updated_at: '2026-01-01' }

function adapter(overrides: Partial<PatientAccountAdapter> = {}): PatientAccountAdapter {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    signUp: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    loadAccount: vi.fn().mockResolvedValue({ profile, preferences }),
    updateProfile: vi.fn().mockResolvedValue({ ...profile, first_name: 'Elena' }),
    updatePreferences: vi.fn().mockImplementation((_id, update) => Promise.resolve({ ...preferences, ...update })),
    ...overrides,
  }
}

function AccountHarness() {
  const auth = useAuth()
  const access = useAccessibility()
  return <div><span>{auth.status}</span><span>{auth.profile?.first_name}</span><span>{access.preferences.preset}</span><button onClick={() => void auth.updateProfile({ first_name: 'Elena', last_name: 'Pérez', phone: null })}>perfil</button><button onClick={() => access.update({ simpleMode: true })}>activar simple</button><button onClick={() => void access.save()}>guardar preferencias</button></div>
}

function SignInHarness() {
  const auth = useAuth()
  const [result, setResult] = useState('idle')
  const signIn = async () => {
    try { const nextProfile = await auth.signIn('ana@example.test', 'segura123'); setResult(nextProfile.first_name) }
    catch { setResult('error') }
  }
  return <><button onClick={() => void signIn()}>ingresar</button><span data-testid="sign-in-result">{result}</span><span data-testid="profile-name">{auth.profile?.first_name}</span></>
}

function SignOutHarness() {
  const auth = useAuth()
  return <><span data-testid="auth-status">{auth.status}</span><button onClick={() => void auth.signOut().catch(() => undefined)}>cerrar sesión</button></>
}

function SignUpHarness() {
  const auth = useAuth()
  const [result, setResult] = useState('idle')
  const signUp = async () => {
    try {
      const nextResult = await auth.signUp({ email: 'ana@example.test', password: 'segura123', firstName: 'Ana', lastName: 'Pérez', phone: null })
      setResult(nextResult.status)
    } catch { setResult('error') }
  }
  return <><button onClick={() => void signUp()}>registrar</button><span data-testid="sign-up-result">{result}</span><span data-testid="sign-up-status">{auth.status}</span><span data-testid="sign-up-profile">{auth.profile?.first_name}</span></>
}

afterEach(cleanup)

describe('cuenta Paciente cloud', () => {
  it('hidrata perfil y preferencias propias antes de presentar la cuenta', async () => {
    render(<AuthProvider adapter={adapter()}><AccessibilityProvider><AccountHarness /></AccessibilityProvider></AuthProvider>)
    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(await screen.findByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('low-vision')).toBeInTheDocument()
    expect(document.documentElement.dataset.contrast).toBe('high')
  })

  it('guarda perfil y preferencias mediante el adapter autenticado', async () => {
    const accountAdapter = adapter()
    const user = userEvent.setup()
    render(<AuthProvider adapter={accountAdapter}><AccessibilityProvider><AccountHarness /></AccessibilityProvider></AuthProvider>)
    await screen.findByText('Ana')
    await user.click(screen.getByRole('button', { name: 'perfil' }))
    await waitFor(() => expect(screen.getByText('Elena')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'activar simple' }))
    await user.click(screen.getByRole('button', { name: 'guardar preferencias' }))
    await waitFor(() => expect(accountAdapter.updatePreferences).toHaveBeenCalledWith('patient-1', expect.objectContaining({ simple_mode: true })))
  })

  it('mantiene el registro pendiente cuando Supabase no devuelve sesión', async () => {
    const accountAdapter = adapter({ getSession: vi.fn().mockResolvedValue(null) })
    const user = userEvent.setup()
    render(<AuthProvider adapter={accountAdapter}><SignUpHarness /></AuthProvider>)
    await user.click(screen.getByRole('button', { name: 'registrar' }))
    await waitFor(() => expect(accountAdapter.signUp).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ana', lastName: 'Pérez', phone: null })))
    expect(screen.getByTestId('sign-up-result')).toHaveTextContent('confirmation-pending')
    expect(screen.getByTestId('sign-up-status')).toHaveTextContent('signed-out')
    expect(accountAdapter.loadAccount).not.toHaveBeenCalled()
    expect(accountAdapter.signOut).not.toHaveBeenCalled()
  })

  it('acepta una sesión inmediata, hidrata una sola vez y no cierra la cuenta del piloto', async () => {
    let authListener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null
    const accountAdapter = adapter({
      getSession: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn((listener) => { authListener = listener; return () => undefined }),
      signUp: vi.fn(async () => { authListener?.('SIGNED_IN', session); return session }),
    })
    const user = userEvent.setup()
    render(<AuthProvider adapter={accountAdapter}><SignUpHarness /></AuthProvider>)

    await user.click(screen.getByRole('button', { name: 'registrar' }))

    await waitFor(() => expect(screen.getByTestId('sign-up-result')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('sign-up-status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('sign-up-profile')).toHaveTextContent('Ana')
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(1)
    expect(accountAdapter.signOut).not.toHaveBeenCalled()
  })

  it('comparte una sola hidratación cuando SIGNED_IN llega durante el login', async () => {
    let authListener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null
    let resolveAccount!: (value: { profile: PatientProfile; preferences: AccessibilityPreferencesRow }) => void
    const pendingAccount = new Promise<{ profile: PatientProfile; preferences: AccessibilityPreferencesRow }>((resolve) => { resolveAccount = resolve })
    const accountAdapter = adapter({
      getSession: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn((listener) => { authListener = listener; return () => undefined }),
      loadAccount: vi.fn().mockReturnValue(pendingAccount),
    })
    const user = userEvent.setup()
    render(<AuthProvider adapter={accountAdapter}><SignInHarness /></AuthProvider>)

    await user.click(screen.getByRole('button', { name: 'ingresar' }))
    await waitFor(() => expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(1))
    act(() => { authListener?.('SIGNED_IN', session) })
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(1)

    await act(async () => { resolveAccount({ profile, preferences }); await pendingAccount })
    await waitFor(() => expect(screen.getByTestId('sign-in-result')).toHaveTextContent('Ana'))
    expect(screen.getByTestId('sign-in-result')).not.toHaveTextContent('error')
    expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(1)
  })

  it('permite reintentar la hidratación del mismo usuario tras un fallo transitorio', async () => {
    let authListener: ((event: AuthChangeEvent, session: Session | null) => void) | null = null
    const accountAdapter = adapter({
      getSession: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn((listener) => { authListener = listener; return () => undefined }),
      loadAccount: vi.fn()
        .mockRejectedValueOnce(new Error('Fallo temporal de red'))
        .mockResolvedValueOnce({ profile, preferences }),
    })
    const user = userEvent.setup()
    render(<AuthProvider adapter={accountAdapter}><SignInHarness /></AuthProvider>)

    await user.click(screen.getByRole('button', { name: 'ingresar' }))
    await waitFor(() => expect(screen.getByTestId('sign-in-result')).toHaveTextContent('error'))
    expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(1)

    act(() => { authListener?.('SIGNED_IN', session) })
    await waitFor(() => expect(screen.getByTestId('profile-name')).toHaveTextContent('Ana'))
    expect(accountAdapter.loadAccount).toHaveBeenCalledTimes(2)
  })

  it('limpia el estado local aunque el cierre remoto falle', async () => {
    const accountAdapter = adapter({ signOut: vi.fn().mockRejectedValue(new Error('Red no disponible')) })
    const user = userEvent.setup()
    render(<AuthProvider adapter={accountAdapter}><SignOutHarness /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated'))

    await user.click(screen.getByRole('button', { name: 'cerrar sesión' }))

    await waitFor(() => expect(screen.getByTestId('auth-status')).toHaveTextContent('signed-out'))
    expect(accountAdapter.signOut).toHaveBeenCalledTimes(1)
  })
})
