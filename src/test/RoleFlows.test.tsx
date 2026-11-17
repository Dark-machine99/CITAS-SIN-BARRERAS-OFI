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
  it('envía al médico al ingreso real sin conceder autorización demo', async () => {
    const user = userEvent.setup(); renderApp()
    await user.click(screen.getByRole('button', { name: /ir al ingreso de médico/i }))
    expect(await screen.findByRole('heading', { name: /entra a tu espacio personal/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /crea tu nueva contraseña/i })).not.toBeInTheDocument()
  })

  it('abre el resumen de administración con señalización demo', async () => {
    const user = userEvent.setup(); renderApp()
    await user.click(screen.getByRole('button', { name: /entrar como administración/i }))
    expect(await screen.findByRole('heading', { name: /resumen operativo/i })).toBeInTheDocument()
    expect(screen.getByText(/modo administración · demo/i)).toBeInTheDocument()
  })
})
