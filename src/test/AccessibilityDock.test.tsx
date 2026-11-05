import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { AppProviders } from '../app/providers/AppProviders'
import { AccessibilityProvider, useAccessibility } from '../app/providers/AccessibilityProvider'

function PresetHarness() {
  const { applyPreset } = useAccessibility()
  return <main><button onClick={() => applyPreset('low-vision')}>Baja visión</button><button onClick={() => applyPreset('reduced-mobility')}>Movilidad reducida</button><button onClick={() => applyPreset('standard')}>Estándar</button><p>Texto de transición</p></main>
}

function SaveHarness() {
  const { save, persistenceError } = useAccessibility()
  return <><button onClick={() => void save().catch(() => undefined)}>Guardar preferencias</button>{persistenceError ? <p role="alert">{persistenceError}</p> : null}</>
}

describe('herramientas flotantes de accesibilidad', () => {
  afterEach(cleanup)
  it('permite alternar contraste y lupa sin abandonar la vista', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AppProviders><main><p>Texto ampliable de prueba</p></main></AppProviders></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Abrir opciones rápidas de accesibilidad' }))
    await user.click(screen.getByLabelText('Alto contraste'))
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high')

    await user.click(screen.getByLabelText('Lupa de texto'))
    await user.click(screen.getByRole('button', { name: 'Listo' }))
    fireEvent.pointerMove(screen.getByText('Texto ampliable de prueba'), { clientX: 320, clientY: 220, pointerType: 'mouse' })

    await waitFor(() => {
      const lens = document.querySelector<HTMLElement>('.magnifier-lens')
      expect(lens).not.toHaveAttribute('hidden')
      expect(lens).toHaveTextContent('Texto ampliable de prueba')
    })
  })

  it('no navega ni presenta éxito al guardar sin una sesión autenticada', async () => {
    const user = userEvent.setup()
    render(<AccessibilityProvider><SaveHarness /></AccessibilityProvider>)

    await user.click(screen.getByRole('button', { name: 'Guardar preferencias' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Debes iniciar sesión')
  })

  it('mantiene Ver todas dentro del espacio Paciente', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/paciente']}><AppProviders><main /></AppProviders></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Abrir opciones rápidas de accesibilidad' }))

    expect(screen.getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/paciente/accesibilidad')
  })

  it('limpia la lupa al cambiar a cualquier preset que la desactive y permite reactivarla', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AppProviders><PresetHarness /></AppProviders></MemoryRouter>)
    const text = screen.getByText('Texto de transición')

    await user.click(screen.getByRole('button', { name: 'Baja visión' }))
    fireEvent.pointerMove(text, { clientX: 320, clientY: 220, pointerType: 'mouse' })
    await waitFor(() => expect(document.querySelector('.magnifier-lens')).not.toHaveAttribute('hidden'))

    await user.click(screen.getByRole('button', { name: 'Movilidad reducida' }))
    const lens = document.querySelector<HTMLElement>('.magnifier-lens')
    expect(lens).toHaveAttribute('hidden')
    expect(lens).toHaveTextContent('')
    expect(lens).not.toHaveAttribute('style')

    await user.click(screen.getByRole('button', { name: 'Baja visión' }))
    fireEvent.focusIn(text)
    await waitFor(() => expect(lens).not.toHaveAttribute('hidden'))
    await user.click(screen.getByRole('button', { name: 'Estándar' }))
    expect(lens).toHaveAttribute('hidden')
    expect(lens).toHaveTextContent('')
  })

  it('cierra Voz al abrir Accesibilidad y conserva el foco en el control activado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AppProviders><main /></AppProviders></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Abrir asistente por voz' }))
    expect(screen.getByRole('dialog', { name: 'Asistente de voz' })).toBeInTheDocument()

    const accessibilityTrigger = screen.getByRole('button', { name: 'Abrir opciones rápidas de accesibilidad' })
    await user.click(accessibilityTrigger)

    expect(screen.queryByRole('dialog', { name: 'Asistente de voz' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Accesibilidad' })).toBeInTheDocument()
    expect(accessibilityTrigger).toHaveFocus()
  })

  it('cierra Accesibilidad al abrir Voz y conserva el foco en el control activado', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><AppProviders><main /></AppProviders></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Abrir opciones rápidas de accesibilidad' }))
    expect(screen.getByRole('dialog', { name: 'Accesibilidad' })).toBeInTheDocument()

    const voiceTrigger = screen.getByRole('button', { name: 'Abrir asistente por voz' })
    await user.click(voiceTrigger)

    expect(screen.queryByRole('dialog', { name: 'Accesibilidad' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Asistente de voz' })).toBeInTheDocument()
    expect(voiceTrigger).toHaveFocus()
  })
})
