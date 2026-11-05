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
  const publicCases = [
    ['/', /tu salud merece/i], ['/login', /entra a tu espacio personal/i], ['/registro', /crea tu cuenta guiada/i],
    ['/recuperar-contrasena', /recibe instrucciones seguras/i], ['/nueva-contrasena', /protege nuevamente tu cuenta/i],
    ['/confirmar-correo', /confirma tu cuenta antes de ingresar/i], ['/privacidad', /aviso de privacidad/i], ['/accesibilidad', /^accesibilidad$/i],
    ['/onboarding/accesibilidad', /configura la experiencia/i], ['/acceso-denegado', /acceso no disponible/i], ['/ruta-inexistente', /no encontramos/i],
  ] as const

  it.each(publicCases)('renderiza %s', async (route, heading) => {
    renderRoute(route)
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it.each(['/paciente', '/paciente/reservar', '/paciente/citas', '/paciente/citas/demo-1', '/paciente/medicos', '/paciente/especialidades', '/paciente/perfil'])('protege %s sin sesión', async (route) => {
    renderRoute(route)
    expect(await screen.findByRole('heading', { level: 1, name: /entra a tu espacio personal/i })).toBeInTheDocument()
  })
})
