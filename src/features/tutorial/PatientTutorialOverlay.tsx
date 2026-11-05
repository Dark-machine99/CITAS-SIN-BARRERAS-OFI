import { ChevronLeft, ChevronRight, CircleHelp, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useAccessibility } from '../../app/providers/AccessibilityProvider'
import { Button } from '../../components/ui/Button'
import { usePatientTutorial } from './PatientTutorialProvider'
import { PatientTutorialVoicePractice } from './PatientTutorialVoicePractice'
import { patientTutorialSteps } from './tutorialSteps'

interface SpotlightBox {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

function visibleTarget(targetIds: readonly string[]) {
  for (const targetId of targetIds) {
    const target = document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`)
    if (!target) continue
    const rect = target.getBoundingClientRect()
    const style = window.getComputedStyle(target)
    const intersectsViewport = rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
    if (rect.width > 0 && rect.height > 0 && intersectsViewport && style.display !== 'none' && style.visibility !== 'hidden') return target
  }
  return null
}

function paddedBox(rect: DOMRect | null): SpotlightBox {
  const padding = 8
  if (!rect) {
    const width = Math.min(480, Math.max(120, window.innerWidth - 32))
    const height = Math.min(180, Math.max(80, window.innerHeight / 4))
    const left = Math.max(16, (window.innerWidth - width) / 2)
    const top = Math.max(16, (window.innerHeight - height) / 3)
    return { top, left, right: left + width, bottom: top + height, width, height }
  }
  const left = Math.max(0, rect.left - padding)
  const top = Math.max(0, rect.top - padding)
  const right = Math.min(window.innerWidth, rect.right + padding)
  const bottom = Math.min(window.innerHeight, rect.bottom + padding)
  return { top, left, right, bottom, width: right - left, height: bottom - top }
}

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function trapTab(event: KeyboardEvent, container: HTMLElement | null, interactiveTarget: HTMLElement | null = null) {
  if (event.key !== 'Tab') return
  const controls = Array.from(container?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
  if (interactiveTarget) {
    if (interactiveTarget.matches(focusableSelector)) controls.push(interactiveTarget)
    controls.push(...interactiveTarget.querySelectorAll<HTMLElement>(focusableSelector))
  }
  const uniqueControls = [...new Set(controls)].filter((control) => control.getAttribute('aria-hidden') !== 'true')
  if (uniqueControls.length === 0) return
  const currentIndex = uniqueControls.indexOf(document.activeElement as HTMLElement)
  if (currentIndex < 0) {
    event.preventDefault()
    const targetControl = interactiveTarget?.matches(focusableSelector)
      ? interactiveTarget
      : interactiveTarget?.querySelector<HTMLElement>(focusableSelector)
    const recoveryControl = targetControl ?? (event.shiftKey ? uniqueControls[uniqueControls.length - 1] : uniqueControls[0])
    recoveryControl?.focus()
    return
  }
  event.preventDefault()
  if (event.shiftKey) uniqueControls[currentIndex === 0 ? uniqueControls.length - 1 : currentIndex - 1]!.focus()
  else uniqueControls[currentIndex === uniqueControls.length - 1 ? 0 : currentIndex + 1]!.focus()
}

export function PatientTutorialOverlay() {
  const tutorial = usePatientTutorial()
  return <PatientTutorialOverlayContent key={tutorial.identityKey} tutorial={tutorial} />
}

function PatientTutorialOverlayContent({ tutorial }: { tutorial: ReturnType<typeof usePatientTutorial> }) {
  const { effectiveReducedMotion } = useAccessibility()
  const [box, setBox] = useState<SpotlightBox | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const step = patientTutorialSteps[tutorial.currentStep]

  useLayoutEffect(() => {
    if (tutorial.phase !== 'running' || !step) return
    const update = () => setBox(paddedBox(visibleTarget(step.targetIds)?.getBoundingClientRect() ?? null))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    const mutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(update)
    step.targetIds.forEach((targetId) => {
      const target = document.querySelector(`[data-tour-id="${targetId}"]`)
      if (target) observer?.observe(target)
    })
    const sidebar = document.querySelector('.sidebar')
    if (sidebar) mutationObserver?.observe(sidebar, { attributes: true, attributeFilter: ['class'] })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [step, tutorial.phase])

  useEffect(() => {
    if (tutorial.phase === 'idle' || tutorial.phase === 'loading') return
    const frame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button:not([disabled]), [tabindex="0"]')?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [confirmExit, tutorial.currentStep, tutorial.phase])

  useEffect(() => {
    if (tutorial.phase === 'idle' || tutorial.phase === 'loading') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tutorial.phase === 'running') {
        event.preventDefault()
        setConfirmExit((value) => !value)
        return
      }
      trapTab(event, dialogRef.current, step?.allowInteraction && !confirmExit ? visibleTarget(step.targetIds) : null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [confirmExit, step, tutorial.phase])

  if (tutorial.phase === 'idle' || tutorial.phase === 'loading') return null

  if (tutorial.phase === 'prompt') {
    return <div className="tutorial-prompt" role="presentation">
      <div ref={dialogRef} className="tutorial-card tutorial-card--prompt" role="dialog" aria-modal="true" aria-labelledby="tutorial-prompt-title" aria-describedby="tutorial-prompt-description">
        <span className="tutorial-card__icon" aria-hidden="true"><CircleHelp /></span>
        <p className="eyebrow">Primera visita</p>
        <h2 id="tutorial-prompt-title">¿Quieres conocer tu espacio?</h2>
        <p id="tutorial-prompt-description">Te mostraremos cuatro zonas principales. La guía no cambia tus datos y puedes salir cuando quieras.</p>
        {tutorial.error ? <p className="notice notice--error" role="alert">{tutorial.error}</p> : null}
        <div className="tutorial-card__actions">
          <Button onClick={() => void tutorial.begin()} loading={tutorial.saving}>Comenzar tutorial</Button>
          <Button variant="ghost" onClick={() => void tutorial.skip()} disabled={tutorial.saving}>Omitir por ahora</Button>
        </div>
      </div>
    </div>
  }

  if (tutorial.phase === 'error') {
    return <div className="tutorial-prompt" role="presentation">
      <div ref={dialogRef} className="tutorial-card tutorial-card--prompt" role="dialog" aria-modal="true" aria-labelledby="tutorial-error-title">
        <h2 id="tutorial-error-title">La guía no está disponible</h2>
        <p role="alert">{tutorial.error}</p>
        <div className="tutorial-card__actions"><Button onClick={tutorial.retryLoad}>Reintentar</Button><Button variant="ghost" onClick={tutorial.exit}>Continuar sin tutorial</Button></div>
      </div>
    </div>
  }

  if (!step || !box) return null

  const cardWidth = Math.min(430, Math.max(280, window.innerWidth - 32))
  const cardLeft = Math.min(Math.max(16, box.left + box.width / 2 - cardWidth / 2), Math.max(16, window.innerWidth - cardWidth - 16))
  const belowTop = box.bottom + 16
  const cardTop = belowTop + 260 < window.innerHeight ? belowTop : Math.max(16, box.top - 276)
  const cardStyle = { left: cardLeft, top: cardTop, width: cardWidth } satisfies CSSProperties
  const blockerStyles = {
    top: { inset: `0 0 auto 0`, height: box.top },
    left: { top: box.top, left: 0, width: box.left, height: box.height },
    right: { top: box.top, left: box.right, right: 0, height: box.height },
    bottom: { top: box.bottom, right: 0, bottom: 0, left: 0 },
  } satisfies Record<string, CSSProperties>
  const spotlightStyle = { top: box.top, left: box.left, width: box.width, height: box.height } satisfies CSSProperties
  const voiceAction = step.advance.type === 'action' ? step.advance.action : null

  return <div className={`tutorial-overlay${effectiveReducedMotion ? ' tutorial-overlay--reduced-motion' : ''}`} aria-live="polite">
    <div className="tutorial-blocker tutorial-blocker--top" style={blockerStyles.top} aria-hidden="true" />
    <div className="tutorial-blocker tutorial-blocker--left" style={blockerStyles.left} aria-hidden="true" />
    <div className="tutorial-blocker tutorial-blocker--right" style={blockerStyles.right} aria-hidden="true" />
    <div className="tutorial-blocker tutorial-blocker--bottom" style={blockerStyles.bottom} aria-hidden="true" />
    <div className="tutorial-spotlight" style={spotlightStyle} aria-hidden="true" />
    {!step.allowInteraction ? <div className="tutorial-target-guard" style={spotlightStyle} aria-hidden="true" /> : null}
    <div ref={dialogRef} className="tutorial-card tutorial-card--step" style={cardStyle} role="dialog" aria-modal={confirmExit || !step.allowInteraction ? true : undefined} aria-labelledby="tutorial-step-title" aria-describedby="tutorial-step-description">
      {confirmExit ? <>
        <button className="tutorial-card__close" type="button" onClick={() => setConfirmExit(false)} aria-label="Continuar con el tutorial"><X aria-hidden="true" /></button>
        <p className="eyebrow">Tu progreso queda guardado</p>
        <h2 id="tutorial-step-title">¿Salir del tutorial?</h2>
        <p id="tutorial-step-description">Podrás continuar más tarde desde el mismo paso.</p>
        <div className="tutorial-card__actions">
          <Button onClick={() => setConfirmExit(false)}>Continuar tutorial</Button>
          <Button variant="ghost" onClick={() => { setConfirmExit(false); tutorial.exit() }}>Salir y continuar después</Button>
        </div>
      </> : <>
        <button className="tutorial-card__close" type="button" onClick={() => setConfirmExit(true)} aria-label="Salir del tutorial"><X aria-hidden="true" /></button>
        <p className="tutorial-card__progress">Paso {tutorial.currentStep + 1} de {patientTutorialSteps.length}</p>
        <h2 id="tutorial-step-title">{step.title}</h2>
        <p id="tutorial-step-description">{step.description}</p>
        {step.content && voiceAction ? <PatientTutorialVoicePractice kind={step.content} onComplete={() => tutorial.completeAction(voiceAction)} /> : null}
        {tutorial.error ? <p className="notice notice--error" role="alert">{tutorial.error}</p> : null}
        <div className="tutorial-card__actions tutorial-card__actions--steps">
          <Button variant="ghost" onClick={() => void tutorial.previous()} disabled={tutorial.currentStep === 0 || tutorial.saving}><ChevronLeft aria-hidden="true" />Anterior</Button>
          {step.advance.type === 'manual' ? <Button onClick={() => void tutorial.next()} loading={tutorial.saving}>{tutorial.currentStep === patientTutorialSteps.length - 1 ? 'Finalizar' : 'Siguiente'}<ChevronRight aria-hidden="true" /></Button> : !step.content ? <p className="tutorial-card__instruction" role="status">Usa el control resaltado para continuar.</p> : null}
        </div>
      </>}
    </div>
    <span className="sr-only" role="status">Paso {tutorial.currentStep + 1}: {step.title}</span>
  </div>
}
