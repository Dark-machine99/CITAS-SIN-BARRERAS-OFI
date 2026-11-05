import { useEffect, useId, useRef, type PropsWithChildren, type RefObject } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  descriptionId?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
}

export function Modal({ open, title, onClose, descriptionId, initialFocusRef, returnFocusRef, children }: PropsWithChildren<ModalProps>) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    const previous = document.activeElement as HTMLElement | null
    const returnElement = returnFocusRef?.current
    const initialFocus = initialFocusRef?.current ?? dialog?.querySelector<HTMLElement>('button, input, [href]')
    initialFocus?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && dialog) {
        const items = [...dialog.querySelectorAll<HTMLElement>('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')]
        if (!items.length) return
        const first = items[0]!, last = items.at(-1)!
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); (returnElement ?? previous)?.focus() }
  }, [initialFocusRef, onClose, open, returnFocusRef])
  if (!open) return null
  return <div className="modal-backdrop"><button type="button" className="modal-dismiss" onClick={onClose} aria-label="Cerrar diálogo" />
    <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="modal__header"><h2 id={titleId}>{title}</h2><Button variant="ghost" className="icon-button" onClick={onClose} aria-label="Cerrar diálogo"><X aria-hidden="true" /></Button></div>
      {children}
    </div>
  </div>
}
