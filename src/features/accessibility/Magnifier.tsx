import { useEffect, useRef } from 'react'

const readableSelector = 'h1, h2, h3, p, label, button, a, li, dt, dd, small, strong, [data-magnifiable]'

function readableText(target: EventTarget | null) {
  if (!(target instanceof Element)) return ''
  const readable = target.closest<HTMLElement>(readableSelector)
  if (!readable || readable.closest('.magnifier-lens, .assistive-dock')) return ''
  return (readable.innerText || readable.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220)
}

export function Magnifier({ enabled }: { enabled: boolean }) {
  const lensRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const lens = lensRef.current
    const text = textRef.current
    if (!lens || !text) return

    const reset = () => {
      lens.hidden = true
      lens.removeAttribute('style')
      text.textContent = ''
    }
    reset()
    if (!enabled) return

    let frame: number | null = null
    let x = 0
    let y = 0
    let content = ''
    const hide = () => { lens.hidden = true }
    const paint = () => {
      frame = null
      if (!content) { hide(); return }
      text.textContent = content
      lens.hidden = false
      const width = Math.min(360, window.innerWidth - 24)
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, x - width / 2))
      const preferredTop = y - 92
      lens.style.width = `${width}px`
      lens.style.left = `${left}px`
      lens.style.top = `${preferredTop > 12 ? preferredTop : Math.min(window.innerHeight - 88, y + 28)}px`
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(paint) }
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') { content = ''; schedule(); return }
      x = event.clientX; y = event.clientY; content = readableText(event.target); schedule()
    }
    const onFocus = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const rect = target?.getBoundingClientRect()
      if (!rect) return
      x = rect.left + rect.width / 2; y = rect.top; content = readableText(target); schedule()
    }

    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('focusin', onFocus)
    document.addEventListener('pointerleave', hide)
    return () => {
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('pointerleave', hide)
      if (frame !== null) window.cancelAnimationFrame(frame)
      content = ''
      reset()
    }
  }, [enabled])

  return <div ref={lensRef} className="magnifier-lens" hidden aria-hidden="true"><span ref={textRef} /></div>
}
