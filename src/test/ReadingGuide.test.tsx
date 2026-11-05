import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AccessibilityProvider, useAccessibility } from '../app/providers/AccessibilityProvider'

function GuideControls() {
  const { preferences, update } = useAccessibility()
  return <button type="button" onClick={() => update({ readingGuide: !preferences.readingGuide })}>Alternar guía</button>
}

afterEach(cleanup)

describe('guía de lectura', () => {
  it('sigue el puntero con una actualización agrupada por frame', async () => {
    const { container } = render(<AccessibilityProvider><GuideControls /></AccessibilityProvider>)
    const guide = container.querySelector<HTMLElement>('.reading-guide')
    expect(guide).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /alternar guía/i }))
    fireEvent.pointerMove(window, { clientY: 236, pointerType: 'mouse' })

    await waitFor(() => expect(guide).toHaveStyle({ top: '236px' }))
  })

  it('ignora punteros táctiles y deja de seguir al desactivarse', async () => {
    const { container } = render(<AccessibilityProvider><GuideControls /></AccessibilityProvider>)
    const guide = container.querySelector<HTMLElement>('.reading-guide')

    fireEvent.click(screen.getByRole('button', { name: /alternar guía/i }))
    fireEvent.pointerMove(window, { clientY: 180, pointerType: 'mouse' })
    await waitFor(() => expect(guide).toHaveStyle({ top: '180px' }))

    fireEvent.pointerMove(window, { clientY: 320, pointerType: 'touch' })
    await new Promise((resolve) => window.setTimeout(resolve, 5))
    expect(guide).toHaveStyle({ top: '180px' })

    fireEvent.click(screen.getByRole('button', { name: /alternar guía/i }))
    fireEvent.pointerMove(window, { clientY: 420, pointerType: 'mouse' })
    await new Promise((resolve) => window.setTimeout(resolve, 5))
    expect(guide).toHaveStyle({ top: '180px' })
  })
})
