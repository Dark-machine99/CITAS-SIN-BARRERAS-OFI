import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../app/providers/AuthProvider'
import { AuthPage } from '../features/auth/AuthPages'
import type { AccessibilityPreferencesRow, PatientAccountAdapter, PatientProfile } from '../services/supabase/patientAccountAdapter'

const userId = '11111111-1111-4111-8111-111111111111'
const session = { user: { id: userId } } as unknown as Session
const preferences: AccessibilityPreferencesRow = { user_id: userId, preset: 'standard', font_scale: 1, high_contrast: false, large_cursor: false, magnifier_enabled: false, guided_reading: false, reduced_motion: false, simple_mode: false, colorblind_mode: false, keyboard_enhancements: false, voice_control: false, updated_at: '2026-11-07' }

function adapter(role: PatientProfile['role']): PatientAccountAdapter {
  const profile: PatientProfile = { id: userId, first_name: 'Cuenta', last_name: 'Prueba', phone: null, role, must_change_password: role === 'doctor', created_at: '2026-11-07', updated_at: '2026-11-07' }
  return {
    getSession: vi.fn().mockResolvedValue(null),
    onAuthStateChange: vi.fn().mockReturnValue(() => undefined),
    signUp: vi.fn().mockResolvedValue(null),
    signIn: vi.fn().mockResolvedValue(session),
    signOut: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    loadAccount: vi.fn().mockResolvedValue({ profile, preferences }),
    updateProfile: vi.fn().mockResolvedValue(profile),
    updatePreferences: vi.fn().mockResolvedValue(preferences),
  }
}

function renderLogin(role: PatientProfile['role']) {
  return render(<MemoryRouter initialEntries={['/login']}><AuthProvider adapter={adapter(role)}><Routes>
    <Route path="/login" element={<AuthPage kind="login" />} />
    <Route path="/paciente" element={<h1>Destino Paciente</h1>} />
    <Route path="/medico" element={<h1>Destino Médico</h1>} />
    <Route path="/acceso-denegado" element={<h1>Destino denegado</h1>} />
  </Routes></AuthProvider></MemoryRouter>)
}

afterEach(cleanup)

describe('enrutado del login por rol servidor', () => {
  it.each([
    ['patient', 'Destino Paciente'],
    ['doctor', 'Destino Médico'],
    ['admin', 'Destino denegado'],
  ] as const)('envía el rol %s a su superficie autorizada', async (role, destination) => {
    const user = userEvent.setup()
    renderLogin(role)
    await user.type(screen.getByLabelText('Correo'), 'cuenta@example.test')
    await user.type(screen.getByLabelText('Contraseña'), 'Temporal-2026')
    await user.click(screen.getByRole('button', { name: /^ingresar$/i }))

    expect(await screen.findByRole('heading', { name: destination })).toBeInTheDocument()
  })
})
