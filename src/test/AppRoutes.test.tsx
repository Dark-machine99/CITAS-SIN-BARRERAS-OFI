import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppProviders } from '../app/providers/AppProviders'

function renderRoute(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><AppProviders><App /></AppProviders></MemoryRouter>)
}

afterEach(cleanup)

describe('rutas principales', () => {
  const cases = [
    ['/', /tu salud merece/i], ['/login', /entra a tu espacio demo/i], ['/registro', /conoce el registro guiado/i],
    ['/recuperar-contrasena', /simula el envío/i], ['/nueva-contrasena', /prueba la validación/i],
    ['/confirmar-correo', /confirmación por correo/i], ['/privacidad', /borrador informativo/i], ['/accesibilidad', /^accesibilidad$/i],
    ['/onboarding/accesibilidad', /configura la experiencia/i], ['/paciente', /tu cuidado/i], ['/paciente/reservar', /especialidad/i],
    ['/paciente/citas', /mis citas/i], ['/paciente/citas/demo-1', /cardiología/i], ['/paciente/medicos', /directorio médico/i],
    ['/paciente/especialidades', /^especialidades$/i], ['/paciente/perfil', /mi perfil/i], ['/acceso-denegado', /acceso no disponible/i], ['/ruta-inexistente', /no encontramos/i],
  ] as const

  it.each(cases)('renderiza %s', (route, heading) => {
    renderRoute(route)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })
})
