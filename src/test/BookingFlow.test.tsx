import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppProviders } from '../app/providers/AppProviders'

function renderRoute(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><AppProviders><App /></AppProviders></MemoryRouter>)
}
afterEach(cleanup)

describe('motor único de reserva', () => {
  it('conserva selecciones válidas al cambiar de 7 a 3 pasos', async () => {
    const user = userEvent.setup()
    renderRoute('/paciente/reservar')
    await user.click(screen.getByRole('button', { name: /cardiología/i }))
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByRole('button', { name: /dra\. lucía torres/i }))
    await user.click(screen.getByRole('checkbox', { name: /modo simple/i }))
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /selecciona una fecha/i })).toBeInTheDocument()
  })

  it('muestra validación antes de avanzar sin especialidad', async () => {
    const user = userEvent.setup()
    renderRoute('/paciente/reservar')
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/elige una especialidad/i)
  })

  it('desde un perfil médico abre fecha y hora en modo simple sin saltar al resumen', async () => {
    const user = userEvent.setup()
    renderRoute('/paciente/medicos')

    await user.click(screen.getByRole('link', { name: /^accesibilidad$/i }))
    await user.click(screen.getByRole('checkbox', { name: /modo simple/i }))
    await user.click(screen.getByRole('button', { name: /listo, volver/i }))
    await user.click(screen.getAllByRole('button', { name: /reservar con este perfil/i })[0]!)

    expect(screen.getByRole('heading', { level: 1, name: /paso 2: fecha y hora/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: /revisa tu selección/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/elige una fecha/i)
    expect(screen.getByText(/paso 2 de 3/i)).toBeInTheDocument()
  })

  it('desde un perfil médico abre la fecha en modo estándar', async () => {
    const user = userEvent.setup()
    renderRoute('/paciente/medicos')

    await user.click(screen.getAllByRole('button', { name: /reservar con este perfil/i })[0]!)

    expect(screen.getByRole('heading', { level: 1, name: /^fecha$/i })).toBeInTheDocument()
    expect(screen.getByText(/paso 3 de 7/i)).toBeInTheDocument()
  })

  it('ignora el origen de URL si los requisitos previos no existen', () => {
    renderRoute('/paciente/reservar?from=doctor')
    expect(screen.getByRole('heading', { level: 1, name: /^especialidad$/i })).toBeInTheDocument()
    expect(screen.getByText(/paso 1 de 7/i)).toBeInTheDocument()
  })

  it('prepara una reserva dictada completa y la lleva al resumen sin confirmarla', async () => {
    const user = userEvent.setup()
    renderRoute('/paciente/reservar')

    await user.click(screen.getByRole('button', { name: /reserva asistida por voz/i }))
    await user.type(screen.getByRole('textbox', { name: /tu solicitud/i }), 'reservar cita mañana por la tarde de cardiología por dolor de cabeza')
    await user.click(screen.getByRole('button', { name: /preparar/i }))

    expect(screen.getByRole('heading', { level: 1, name: /resumen/i })).toBeInTheDocument()
    expect(screen.getByText('Dra. Lucía Torres')).toBeInTheDocument()
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.getByText('dolor de cabeza')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar/i })).toBeInTheDocument()
    expect(screen.queryByText(/tu cita demo está confirmada/i)).not.toBeInTheDocument()
  })

  it('abre voz como panel compacto sin consentimiento previo ni bloquear la página', async () => {
    const user = userEvent.setup()
    const { container } = renderRoute('/paciente')

    await user.click(screen.getByRole('button', { name: /abrir asistente por voz/i }))

    expect(screen.getByRole('dialog', { name: /asistente de voz/i })).toHaveClass('voice-popover')
    expect(screen.queryByText(/acepto activar/i)).not.toBeInTheDocument()
    expect(container.querySelector('.modal-backdrop')).not.toBeInTheDocument()
    expect(screen.getByText(/hola, alex/i)).toBeInTheDocument()
  })

  it('limita la solicitud completa del panel global al motivo opcional', async () => {
    const user = userEvent.setup()
    renderRoute('/paciente')

    await user.click(screen.getByRole('button', { name: /abrir asistente por voz/i }))
    await user.type(screen.getByRole('textbox', { name: /comando escrito/i }), 'reservar cita mañana por la tarde de cardiología por dolor de cabeza')
    await user.click(screen.getByRole('button', { name: /ejecutar comando/i }))

    const dialog = screen.getByRole('dialog', { name: /asistente de voz/i })
    expect(dialog.querySelector('[role="status"]')).toHaveTextContent(/guardé únicamente el motivo opcional/i)
    expect(screen.queryByRole('heading', { level: 1, name: /resumen/i })).not.toBeInTheDocument()
    expect(screen.getByText(/motivo dictado \(contenido oculto\)/i)).toBeInTheDocument()
  })
})
