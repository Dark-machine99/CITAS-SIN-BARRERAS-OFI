import { Accessibility, Contrast, Eye, Focus, GripHorizontal, MousePointer2, ScanEye, Sparkles, Type, X, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useAccessibility, type TextScale } from '../../app/providers/AccessibilityProvider'
import { Modal } from '../../components/ui/Modal'
import { reportPatientTutorialAction } from '../tutorial/tutorialEvents'

// Punto de restauración solicitado: cambia esta variante a "modal" para recuperar
// inmediatamente el diálogo anterior, que se conserva completo más abajo.
const ACCESSIBILITY_PANEL_VARIANT = 'floating' as 'floating' | 'modal'

type Point = { x: number; y: number }
type DragState = Point & { pointerId: number; originX: number; originY: number; left: number; top: number; width: number; height: number; moved: boolean }
type AccessibilityDockProps = { open?: boolean; onOpenChange?: (open: boolean) => void }

export function AccessibilityDock({ open: controlledOpen, onOpenChange }: AccessibilityDockProps = {}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const [dragging, setDragging] = useState(false)
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 })
  const [panelPosition, setPanelPosition] = useState<Point>({ x: 12, y: 12 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const suppressClickRef = useRef(false)
  const panelId = useId()
  const titleId = `${panelId}-title`
  const { preferences, update } = useAccessibility()
  const location = useLocation()
  const accessibilityPath = location.pathname.startsWith('/paciente') ? '/paciente/accesibilidad' : '/accesibilidad'
  const changeOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setLocalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [controlledOpen, onOpenChange])
  const close = useCallback(() => changeOpen(false), [changeOpen])

  const placePanel = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(420, window.innerWidth - 24)
    const height = Math.min(620, window.innerHeight - 24)
    const preferredLeft = rect.left > window.innerWidth / 2 ? rect.left - width - 14 : rect.right + 14
    const left = Math.min(Math.max(12, preferredLeft), window.innerWidth - width - 12)
    const top = Math.min(Math.max(12, rect.top - 12), window.innerHeight - height - 12)
    setPanelPosition({ x: left, y: Math.max(12, top) })
  }, [])

  const toggle = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    if (!open) placePanel()
    const nextOpen = !open
    changeOpen(nextOpen)
    if (nextOpen) reportPatientTutorialAction('accessibility-open')
  }

  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, originX: offset.x, originY: offset.y, left: rect.left, top: rect.top, width: rect.width, height: rect.height, moved: false }
    setDragging(true)
  }

  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true
    if (!drag.moved) return
    const left = Math.min(Math.max(8, drag.left + deltaX), window.innerWidth - drag.width - 8)
    const top = Math.min(Math.max(8, drag.top + deltaY), window.innerHeight - drag.height - 8)
    setOffset({ x: drag.originX + left - drag.left, y: drag.originY + top - drag.top })
    if (open) changeOpen(false)
  }

  const stopDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    suppressClickRef.current = drag.moved
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  useEffect(() => {
    if (!open || ACCESSIBILITY_PANEL_VARIANT !== 'floating') return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    const onResize = () => { close(); setOffset({ x: 0, y: 0 }) }
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize) }
  }, [close, open])

  const controls = <>
    <p className="modal-lead">Activa o desactiva ayudas sin salir de la página. Los cambios duran solo en esta sesión.</p>
    <div className="quick-access-list">
      <div className="quick-access-row"><span><Type /><span><strong>Tamaño del texto</strong><small>Escala visual de la interfaz</small></span></span><div className="segmented" aria-label="Tamaño del texto rápido">{(['small', 'normal', 'large'] as TextScale[]).map((scale, index) => <button type="button" key={scale} className={preferences.textScale === scale ? 'active' : ''} aria-pressed={preferences.textScale === scale} onClick={() => update({ textScale: scale })}>{['A−', 'A', 'A+'][index]}</button>)}</div></div>
      <QuickToggle icon={<Contrast />} label="Alto contraste" checked={preferences.highContrast} onChange={(checked) => update({ highContrast: checked })} />
      <QuickToggle icon={<MousePointer2 />} label="Cursor grande" checked={preferences.largeCursor} onChange={(checked) => update({ largeCursor: checked })} />
      <QuickToggle icon={<Focus />} label="Modo simple" checked={preferences.simpleMode} onChange={(checked) => update({ simpleMode: checked })} />
      <QuickToggle icon={<ScanEye />} label="Guía de lectura" checked={preferences.readingGuide} onChange={(checked) => update({ readingGuide: checked })} />
      <QuickToggle icon={<ZoomIn />} label="Lupa de texto" checked={preferences.magnifier} onChange={(checked) => update({ magnifier: checked })} />
      <QuickToggle icon={<Sparkles />} label="Reducir movimiento" checked={preferences.reducedMotion} onChange={(checked) => update({ reducedMotion: checked })} />
      <QuickToggle icon={<Eye />} label="Refuerzo de estados" checked={preferences.colorReinforcement} onChange={(checked) => update({ colorReinforcement: checked })} />
    </div>
  </>

  const actions = <div className="modal-actions"><Link className="button button--secondary" to={accessibilityPath} onClick={close}>Ver todas</Link><button className="button button--primary" type="button" onClick={close}><span>Listo</span></button></div>
  const companionStyle = { '--assistant-x': `${offset.x}px`, '--assistant-y': `${offset.y}px` } as CSSProperties

  return <>
    <button ref={triggerRef} type="button" data-tour-id="accessibility-quick-trigger" className={`accessibility-companion ${dragging ? 'is-dragging' : ''}`} style={companionStyle} onPointerDown={startDrag} onPointerMove={move} onPointerUp={stopDrag} onPointerCancel={stopDrag} onClick={toggle} aria-label={open ? 'Cerrar opciones rápidas de accesibilidad' : 'Abrir opciones rápidas de accesibilidad'} aria-describedby={`${panelId}-drag-help`} aria-expanded={open} aria-controls={panelId}>
      <span className="accessibility-companion__hint" aria-hidden="true"><GripHorizontal /></span>
      <span className="accessibility-companion__head" aria-hidden="true"><i /><i /></span>
      <span className="accessibility-companion__body" aria-hidden="true"><Accessibility /></span>
      <span className="accessibility-companion__shadow" aria-hidden="true" />
    </button>
    <span id={`${panelId}-drag-help`} className="sr-only">Puedes arrastrar este asistente a otra zona de la pantalla.</span>
    {ACCESSIBILITY_PANEL_VARIANT === 'floating' ? open ? <aside id={panelId} className="accessibility-popover" style={{ left: panelPosition.x, top: panelPosition.y }} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className="accessibility-popover__header"><div><span className="eyebrow">Control rápido</span><h2 id={titleId}>Accesibilidad</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Cerrar opciones de accesibilidad"><X aria-hidden="true" /></button></header>
      {controls}{actions}
    </aside> : null : <Modal open={open} title="Accesibilidad rápida" onClose={close} returnFocusRef={triggerRef}>{controls}{actions}</Modal>}
  </>
}

function QuickToggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = `quick-${label.toLowerCase().replaceAll(' ', '-')}`
  return <div className="quick-access-row"><label htmlFor={id}>{icon}<strong>{label}</strong></label><span className="toggle"><input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i aria-hidden="true" /></span></div>
}
