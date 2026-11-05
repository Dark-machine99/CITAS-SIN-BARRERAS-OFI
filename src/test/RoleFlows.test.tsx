import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppProviders } from '../app/providers/AppProviders'

afterEach(cleanup)

function renderApp() {
  return render(<MemoryRouter initialEntries={['/acceso-demo']}><AppProviders><App /></AppProviders></MemoryRouter>)
}

describe('acceso por roles demo', () => {
  it('obliga al médico a completar el primer acceso antes de ver agenda', async () => {
    const user = userEvent.setup(); renderApp()
    await user.click(screen.getByRole('button', { name: /entrar como médico/i }))
    expect(await screen.findByRole('heading', { name: /crea una contraseña temporal/i })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nueva contraseña de demostración', { exact: true }), 'Demostracion-2026')
    await user.click(screen.getByRole('button', { name: /continuar a mi agenda/i }))
    expect(await screen.findByRole('heading', { name: /tu jornada, en orden/i })).toBeInTheDocument()
  })

  it('abre el resumen de administración con señalización demo', async () => {
    const user = userEvent.setup(); renderApp()
    await user.click(screen.getByRole('button', { name: /entrar como administración/i }))
    expect(await screen.findByRole('heading', { name: /resumen operativo/i })).toBeInTheDocument()
    expect(screen.getByText(/modo administración · demo/i)).toBeInTheDocument()
  })
})
