import { cleanup, render, screen, within } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../app/App'
import { AccessibilityProvider } from '../app/providers/AccessibilityProvider'
import { AuthProvider } from '../app/providers/AuthProvider'
import { BookingProvider } from '../app/providers/BookingProvider'
import { DemoSessionProvider } from '../app/providers/DemoSessionProvider'
import type { AccessibilityPreferencesRow, PatientAccountAdapter, PatientProfile } from '../services/supabase/patientAccountAdapter'
import type { PatientAppointmentsAdapter } from '../services/supabase/patientAppointmentsAdapter'
import styles from '../styles/index.css?raw'

const patientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const profile: PatientProfile = { id: patientId, first_name: 'Ana', last_name: 'Pérez', phone: null, role: 'patient', must_change_password: false, created_at: '2026-01-01', updated_at: '2026-01-01' }
const preferences: AccessibilityPreferencesRow = { user_id: patientId, preset: 'standard', font_scale: 1, high_contrast: false, large_cursor: false, magnifier_enabled: false, guided_reading: false, reduced_motion: false, simple_mode: false, colorblind_mode: false, keyboard_enhancements: false, voice_control: false, updated_at: '2026-01-01' }
const session = { user: { id: patientId, email: 'patient@example.test' } } as unknown as Session

function accountAdapter(): PatientAccountAdapter {
  return {
    getSession: vi.fn().mockResolvedValue(session),
    onAuthStateChange: vi.fn(() => () => undefined),
    signUp: vi.fn(), signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined), requestPasswordReset: vi.fn(), updatePassword: vi.fn(),
    loadAccount: vi.fn().mockResolvedValue({ profile, preferences }),
    updateProfile: vi.fn(), updatePreferences: vi.fn().mockResolvedValue(preferences),
  }
}

const appointmentsAdapter: PatientAppointmentsAdapter = {
  list: vi.fn().mockResolvedValue([]),
  cancel: vi.fn(),
  reschedule: vi.fn(),
}

function renderApp(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><DemoSessionProvider><AuthProvider adapter={accountAdapter()}><AccessibilityProvider><BookingProvider appointmentsAdapter={appointmentsAdapter}><App /></BookingProvider></AccessibilityProvider></AuthProvider></DemoSessionProvider></MemoryRouter>)
}

afterEach(cleanup)

describe('Accesibilidad autenticada del Paciente', () => {
  it('mantiene oscuro y legible el encabezado autenticado en alto contraste', () => {
    const surfaceRule = styles.match(/html\[data-contrast='high'\] \.access-page--patient \.page-heading \{([^}]*)\}/)?.[1]
    const textRule = styles.match(/html\[data-contrast='high'\] \.access-page--patient \.page-heading :where\(h1,p,\.eyebrow\) \{([^}]*)\}/)?.[1]

    expect(surfaceRule).toContain('background: #000 !important')
    expect(surfaceRule).toContain('border: 2px solid #fff')
    expect(surfaceRule).toContain('box-shadow: none')
    expect(textRule).toContain('color: #fff !important')
  })

  it('renderiza la ruta dentro del shell Paciente y sin el aviso de piloto', async () => {
    renderApp('/paciente/accesibilidad')

    expect(await screen.findByRole('heading', { level: 1, name: 'Accesibilidad' })).toBeInTheDocument()
    expect(screen.getByText('Hola, Ana')).toBeInTheDocument()
    const navigation = screen.getByRole('complementary', { name: 'Navegación del paciente' })
    expect(within(navigation).getByRole('link', { name: 'Accesibilidad' })).toHaveAttribute('href', '/paciente/accesibilidad')
    expect(screen.queryByText(/Piloto en construcción/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ingresar/i })).not.toBeInTheDocument()
  })

  it('conserva la ruta pública fuera del shell autenticado', () => {
    renderApp('/accesibilidad')

    expect(screen.getByRole('heading', { level: 1, name: 'Accesibilidad' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ingresar/i })).toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: 'Navegación del paciente' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Piloto en construcción/i)).not.toBeInTheDocument()
  })
})
