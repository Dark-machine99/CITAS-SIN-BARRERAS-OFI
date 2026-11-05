import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Link } from 'react-router'
import { AccessibilityProvider } from '../app/providers/AccessibilityProvider'
import { BookingProvider } from '../app/providers/BookingProvider'
import { PatientTutorialOverlay } from '../features/tutorial/PatientTutorialOverlay'
import { PatientTutorialProvider, usePatientTutorial } from '../features/tutorial/PatientTutorialProvider'
import type {
  PatientTutorialProgress,
  PatientTutorialProgressAdapter,
  PatientTutorialProgressWrite,
} from '../services/supabase/patientTutorialProgressAdapter'
import { reportPatientTutorialAction } from '../features/tutorial/tutorialEvents'

const userId = '11111111-1111-4111-8111-111111111111'
const secondUserId = '22222222-2222-4222-8222-222222222222'
const timestamp = '2026-11-04T12:00:00.000Z'

function row(status: PatientTutorialProgress['status'], currentStep = 0, rowUserId = userId): PatientTutorialProgress {
  return {
    userId: rowUserId,
    tutorialVersion: 1,
    status,
    currentStep,
    startedAt: status === 'pending' ? null : timestamp,
    finishedAt: status === 'completed' || status === 'skipped' ? timestamp : null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function saved(write: PatientTutorialProgressWrite, savedUserId = userId): PatientTutorialProgress {
  return {
    userId: savedUserId,
    tutorialVersion: write.tutorialVersion,
    status: write.status,
    currentStep: write.currentStep,
    startedAt: write.startedAt,
    finishedAt: write.finishedAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function fakeAdapter(initial: PatientTutorialProgress | null): PatientTutorialProgressAdapter {
  return {
    load: vi.fn().mockResolvedValue(initial),
    create: vi.fn(async (createdUserId, write) => saved(write, createdUserId)),
    update: vi.fn(async (updatedUserId, write) => saved(write, updatedUserId)),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => { resolve = nextResolve })
  return { promise, resolve }
}

function TutorialSurface() {
  const tutorial = usePatientTutorial()
  const [menuOpen, setMenuOpen] = useState(false)
  return <>
    <header data-tour-id="patient-header">Cabecera</header>
    <nav className={`sidebar${menuOpen ? ' sidebar--open' : ''}`} data-tour-id="patient-navigation-desktop"><Link to="/paciente" data-tour-id="patient-nav-inicio-desktop">Inicio</Link><Link to="/paciente/especialidades" data-tour-id="patient-nav-especialidades-desktop">Especialidades</Link><Link to="/paciente/accesibilidad" data-tour-id="patient-nav-accesibilidad-desktop">Accesibilidad</Link><Link to="/paciente/perfil" data-tour-id="patient-nav-perfil-desktop">Mi perfil</Link></nav>
    <nav data-tour-id="patient-navigation-mobile"><Link to="/paciente" data-tour-id="patient-nav-inicio-mobile">Inicio móvil</Link></nav>
    <button data-tour-id="patient-menu-button" onClick={() => setMenuOpen(true)}>Abrir menú</button>
    <main id="contenido" tabIndex={-1} data-tour-id="patient-content">Contenido</main>
    <button data-tour-id="patient-tutorial-help" onClick={(event) => tutorial.repeat(event.currentTarget)}>Ayuda y tutorial</button>
    <PatientTutorialOverlay />
  </>
}

function TutorialHarness({ adapter, activeUserId }: { adapter: PatientTutorialProgressAdapter; activeUserId: string }) {
  return <MemoryRouter initialEntries={['/paciente']}><AccessibilityProvider><BookingProvider><PatientTutorialProvider userId={activeUserId} adapter={adapter} now={() => timestamp}>
    <TutorialSurface />
  </PatientTutorialProvider></BookingProvider></AccessibilityProvider></MemoryRouter>
}

function renderTutorial(adapter: PatientTutorialProgressAdapter, activeUserId = userId) {
  return render(<TutorialHarness adapter={adapter} activeUserId={activeUserId} />)
}

function mockTargetRects(visibleIds: string[]) {
  return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const visible = visibleIds.includes(this.dataset.tourId ?? '')
    const left = visible ? 20 : -1000
    return { x: left, y: 20, top: 20, left, right: left + 160, bottom: 68, width: 160, height: 48, toJSON: () => ({}) } as DOMRect
  })
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('motor del tutorial Paciente', () => {
  it('trata la ausencia de fila como primera visita y crea el inicio explícito', async () => {
    const adapter = fakeAdapter(null)
    const user = userEvent.setup()
    renderTutorial(adapter)

    expect(await screen.findByRole('heading', { name: '¿Quieres conocer tu espacio?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Comenzar tutorial' }))

    expect(await screen.findByRole('heading', { name: 'Tu espacio personal' })).toBeInTheDocument()
    expect(document.querySelectorAll('.tutorial-blocker')).toHaveLength(4)
    expect(adapter.create).toHaveBeenCalledWith(userId, {
      tutorialVersion: 1,
      status: 'in_progress',
      currentStep: 0,
      startedAt: timestamp,
      finishedAt: null,
    })
  })

  it('permite omitir la primera visita y persiste un estado terminal coherente', async () => {
    const adapter = fakeAdapter(null)
    const user = userEvent.setup()
    renderTutorial(adapter)
    await screen.findByRole('heading', { name: '¿Quieres conocer tu espacio?' })

    await user.click(screen.getByRole('button', { name: 'Omitir por ahora' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(adapter.create).toHaveBeenCalledWith(userId, {
      tutorialVersion: 1,
      status: 'skipped',
      currentStep: 0,
      startedAt: timestamp,
      finishedAt: timestamp,
    })
  })

  it('reanuda automáticamente un progreso intermedio y guarda cada avance', async () => {
    const adapter = fakeAdapter(row('in_progress', 0))
    const user = userEvent.setup()
    renderTutorial(adapter)

    expect(await screen.findByRole('heading', { name: 'Tu espacio personal' })).toBeInTheDocument()
    expect(screen.getByText('Paso 1 de 13')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))

    expect(await screen.findByRole('heading', { name: 'Abre Inicio' })).toBeInTheDocument()
    expect(adapter.update).toHaveBeenCalledWith(userId, expect.objectContaining({ status: 'in_progress', currentStep: 1 }))
  })

  it('no reabre estados terminales y una repetición no los modifica antes de avanzar', async () => {
    const adapter = fakeAdapter(row('completed', 12))
    const user = userEvent.setup()
    renderTutorial(adapter)

    await waitFor(() => expect(adapter.load).toHaveBeenCalled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const help = screen.getByRole('button', { name: 'Ayuda y tutorial' })
    help.focus()
    await user.click(help)
    expect(await screen.findByRole('heading', { name: 'Tu espacio personal' })).toBeInTheDocument()
    expect(adapter.update).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: '¿Salir del tutorial?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salir y continuar después' }))
    expect(adapter.update).not.toHaveBeenCalled()
    expect(help).toHaveFocus()

    await user.click(help)
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }))
    expect(adapter.update).toHaveBeenCalledWith(userId, expect.objectContaining({ status: 'in_progress', currentStep: 1 }))
  })

  it('finaliza desde el último paso con marca de término y deja una salida visible', async () => {
    const adapter = fakeAdapter(row('in_progress', 12))
    const user = userEvent.setup()
    renderTutorial(adapter)

    expect(await screen.findByRole('button', { name: 'Salir del tutorial' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finalizar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(adapter.update).toHaveBeenCalledWith(userId, {
      tutorialVersion: 1,
      status: 'completed',
      currentStep: 12,
      startedAt: timestamp,
      finishedAt: timestamp,
    })
  })

  it('mantiene el foco dentro de la tarjeta y elimina transiciones con movimiento reducido', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const user = userEvent.setup()
    renderTutorial(fakeAdapter(row('in_progress', 0)))

    const close = await screen.findByRole('button', { name: 'Salir del tutorial' })
    await waitFor(() => expect(close).toHaveFocus())
    expect(document.querySelector('.tutorial-overlay')).toHaveClass('tutorial-overlay--reduced-motion')
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Siguiente' })).toHaveFocus()
  })

  it('permite continuar usando el producto si falla la carga del progreso', async () => {
    const adapter = fakeAdapter(null)
    vi.mocked(adapter.load).mockRejectedValueOnce(new Error('network detail'))
    const user = userEvent.setup()
    renderTutorial(adapter)

    expect(await screen.findByRole('heading', { name: 'La guía no está disponible' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continuar sin tutorial' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('network detail')).not.toBeInTheDocument()
  })

  it('ignora una mutación pendiente del usuario anterior y decide create/update solo con la identidad activa', async () => {
    const pendingUpdate = deferred<PatientTutorialProgress>()
    const adapter: PatientTutorialProgressAdapter = {
      load: vi.fn(async (loadedUserId) => loadedUserId === userId ? row('in_progress', 0, userId) : null),
      create: vi.fn(async (createdUserId, write) => saved(write, createdUserId)),
      update: vi.fn(() => pendingUpdate.promise),
    }
    const user = userEvent.setup()
    const view = renderTutorial(adapter)

    expect(await screen.findByRole('heading', { name: 'Tu espacio personal' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => expect(adapter.update).toHaveBeenCalledWith(userId, expect.objectContaining({ currentStep: 1 })))

    view.rerender(<TutorialHarness adapter={adapter} activeUserId={secondUserId} />)
    expect(await screen.findByRole('heading', { name: '¿Quieres conocer tu espacio?' })).toBeInTheDocument()
    await act(async () => pendingUpdate.resolve(row('in_progress', 1, userId)))

    expect(screen.getByRole('heading', { name: '¿Quieres conocer tu espacio?' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Abre Inicio' })).not.toBeInTheDocument()
    expect(adapter.update).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Comenzar tutorial' }))
    expect(adapter.create).toHaveBeenCalledWith(secondUserId, expect.objectContaining({ currentStep: 0 }))
    expect(adapter.update).not.toHaveBeenCalledWith(secondUserId, expect.anything())
  })

  it('no hereda la confirmación de salida al cambiar de paciente', async () => {
    const adapter: PatientTutorialProgressAdapter = {
      load: vi.fn(async (loadedUserId) => loadedUserId === userId
        ? row('in_progress', 0, userId)
        : row('in_progress', 2, secondUserId)),
      create: vi.fn(async (createdUserId, write) => saved(write, createdUserId)),
      update: vi.fn(async (updatedUserId, write) => saved(write, updatedUserId)),
    }
    const user = userEvent.setup()
    const view = renderTutorial(adapter)

    await user.click(await screen.findByRole('button', { name: 'Salir del tutorial' }))
    expect(screen.getByRole('heading', { name: '¿Salir del tutorial?' })).toBeInTheDocument()
    view.rerender(<TutorialHarness adapter={adapter} activeUserId={secondUserId} />)

    expect(await screen.findByRole('heading', { name: 'Abre Reservar' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '¿Salir del tutorial?' })).not.toBeInTheDocument()
    expect(screen.getByText('Paso 3 de 13')).toBeInTheDocument()
  })

  it('avanza un paso de navegación solo después de un cambio de ruta real', async () => {
    const adapter = fakeAdapter(row('in_progress', 1))
    const user = userEvent.setup()
    renderTutorial(adapter)

    expect(await screen.findByRole('heading', { name: 'Abre Inicio' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).not.toBeInTheDocument()
    await user.click(document.querySelector<HTMLElement>('[data-tour-id="patient-nav-inicio-desktop"]')!)

    await waitFor(() => expect(adapter.update).toHaveBeenCalledWith(userId, expect.objectContaining({ currentStep: 2 })))
    expect(await screen.findByRole('heading', { name: 'Abre Reservar' })).toBeInTheDocument()
  })

  it('avanza un paso de acción solo con el evento contractual esperado', async () => {
    const adapter = fakeAdapter(row('in_progress', 8))
    renderTutorial(adapter)

    expect(await screen.findByRole('heading', { name: 'Prueba el panel rápido' })).toBeInTheDocument()
    act(() => reportPatientTutorialAction('accessibility-open'))

    await waitFor(() => expect(adapter.update).toHaveBeenCalledWith(userId, expect.objectContaining({ currentStep: 9 })))
    expect(await screen.findByRole('heading', { name: 'Abre Mi perfil' })).toBeInTheDocument()
  })

  it('incluye el destino desktop en el ciclo de teclado y usa diálogo no modal', async () => {
    mockTargetRects(['patient-nav-inicio-desktop'])
    const user = userEvent.setup()
    renderTutorial(fakeAdapter(row('in_progress', 1)))

    const close = await screen.findByRole('button', { name: 'Salir del tutorial' })
    await waitFor(() => expect(close).toHaveFocus())
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-modal')
    await user.tab()
    expect(screen.getByRole('button', { name: /anterior/i })).toHaveFocus()
    await user.tab()
    expect(document.querySelector('[data-tour-id="patient-nav-inicio-desktop"]')).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: '¿Salir del tutorial?' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('heading', { name: 'Abre Inicio' })).toBeInTheDocument()
  })

  it('incluye el destino móvil visible y el botón de menú como fallback en el ciclo de teclado', async () => {
    const rectMock = mockTargetRects(['patient-nav-inicio-mobile'])
    const user = userEvent.setup()
    const view = renderTutorial(fakeAdapter(row('in_progress', 1)))

    const close = await screen.findByRole('button', { name: 'Salir del tutorial' })
    await waitFor(() => expect(close).toHaveFocus())
    await user.tab()
    await user.tab()
    expect(document.querySelector('[data-tour-id="patient-nav-inicio-mobile"]')).toHaveFocus()

    rectMock.mockRestore()
    mockTargetRects(['patient-menu-button'])
    view.rerender(<TutorialHarness adapter={fakeAdapter(row('in_progress', 9))} activeUserId={userId} />)
    expect(await screen.findByRole('heading', { name: 'Abre Mi perfil' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salir del tutorial' })).toHaveFocus())
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveFocus()
  })

  it.each([
    [6, 'especialidades', 'Abre Accesibilidad'],
    [7, 'accesibilidad', 'Prueba el panel rápido'],
    [9, 'perfil', 'Practica un comando de navegación'],
  ] as const)('recupera foco del menú móvil en el enlace %s del paso %s y completa la ruta', async (stepIndex, targetId, nextTitle) => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const sidebarOpen = document.querySelector('.sidebar')?.classList.contains('sidebar--open') ?? false
      const id = this.dataset.tourId
      const visible = id === 'patient-menu-button' ? !sidebarOpen : id === `patient-nav-${targetId}-desktop` && sidebarOpen
      const left = visible ? 20 : -1000
      return { x: left, y: 20, top: 20, left, right: left + 160, bottom: 68, width: 160, height: 48, toJSON: () => ({}) } as DOMRect
    })
    const user = userEvent.setup()
    renderTutorial(fakeAdapter(row('in_progress', stepIndex)))

    const close = await screen.findByRole('button', { name: 'Salir del tutorial' })
    await waitFor(() => expect(close).toHaveFocus())
    await user.tab()
    await user.tab()
    const menu = screen.getByRole('button', { name: 'Abrir menú' })
    expect(menu).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(menu).toHaveFocus()
    await user.tab()
    const destination = document.querySelector<HTMLElement>(`[data-tour-id="patient-nav-${targetId}-desktop"]`)
    expect(destination).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: nextTitle })).toBeInTheDocument()
  })
})
