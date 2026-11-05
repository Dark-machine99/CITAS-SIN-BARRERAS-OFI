import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppProviders } from '../app/providers/AppProviders'
import { DictationButton } from '../components/assistive/DictationButton'
import type { RecognitionEventLike, RecognitionLike } from '../features/voice/speechRecognition'

class FakeRecognition implements RecognitionLike {
  static transcript = 'texto dictado'
  lang = ''
  continuous = false
  interimResults = false
  onresult: ((event: RecognitionEventLike) => void) | null = null
  onerror: (() => void) | null = null
  onend: (() => void) | null = null
  start = () => { this.onresult?.({ results: { 0: { 0: { transcript: FakeRecognition.transcript } } } }); this.onend?.() }
  stop = () => { this.onend?.() }
}

function renderRoute(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><AppProviders><App /></AppProviders></MemoryRouter>)
}

beforeEach(() => { window.SpeechRecognition = FakeRecognition })
afterEach(() => { cleanup(); delete window.SpeechRecognition })

describe('dictado reutilizable', () => {
  it('escribe el resultado en un campo nativo y adapta un correo dictado', async () => {
    FakeRecognition.transcript = 'alex punto demo arroba ejemplo punto test'
    const user = userEvent.setup()
    render(<><label htmlFor="email-demo">Correo</label><input id="email-demo" /><DictationButton label="correo" targetId="email-demo" format="email" /></>)

    await user.click(screen.getByRole('button', { name: /dictar correo/i }))

    expect(screen.getByLabelText('Correo')).toHaveValue('alex.demo@ejemplo.test')
  })

  it('expone dictado en todos los campos escritos del registro', () => {
    renderRoute('/registro')

    expect(screen.getByRole('button', { name: /dictar nombre de demostración/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dictar apellido de demostración/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dictar correo de demostración/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dictar contraseña de demostración/i })).toBeInTheDocument()
  })

  it('expone dictado en búsquedas y campos editables del perfil', () => {
    const { unmount } = renderRoute('/paciente/especialidades')
    expect(screen.getByRole('button', { name: /dictar buscar especialidad/i })).toBeInTheDocument()
    unmount()
    renderRoute('/paciente/perfil')
    expect(screen.getByRole('button', { name: /dictar nombre/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dictar apellido/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dictar teléfono ficticio/i })).toBeInTheDocument()
  })
})
