import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from '../app/App'
import { AppProviders } from '../app/providers/AppProviders'

afterEach(cleanup)
describe('diálogo de cancelación', () => {
  it('cierra con Escape y devuelve el foco', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/paciente/citas/demo-1']}><AppProviders><App /></AppProviders></MemoryRouter>)
    const trigger = screen.getByRole('button', { name: /cancelar cita/i })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: /cancelar esta cita demo/i })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
