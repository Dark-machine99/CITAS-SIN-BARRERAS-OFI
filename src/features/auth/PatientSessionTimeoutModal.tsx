import { useId, useRef } from 'react'
import { Clock3, LogOut } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { usePatientSessionTimeout, type PatientSessionEndReason } from './patientSessionTimeout'

interface PatientSessionTimeoutModalProps {
  enabled: boolean
  sessionKey: string | null
  onSessionEnd: (reason: PatientSessionEndReason) => void
}

export function PatientSessionTimeoutModal({ enabled, sessionKey, onSessionEnd }: PatientSessionTimeoutModalProps) {
  const descriptionId = useId()
  const continueButtonRef = useRef<HTMLButtonElement>(null)
  const { warningOpen, continueSession, endSession } = usePatientSessionTimeout({
    enabled,
    sessionKey,
    onEnd: onSessionEnd,
  })

  return <Modal
    open={warningOpen}
    title="Tu sesión está por cerrarse"
    descriptionId={descriptionId}
    initialFocusRef={continueButtonRef}
    onClose={() => endSession('manual')}
  >
    <div className="notice notice--warning" role="alert" aria-live="assertive">
      <Clock3 aria-hidden="true" />
      <p id={descriptionId}>Por tu seguridad, cerraremos la sesión en 2 minutos por inactividad.</p>
    </div>
    <p>Si cierras la sesión, eliminaremos el motivo de consulta y otra información sensible que aún no hayas guardado.</p>
    <div className="modal-actions">
      <Button variant="secondary" onClick={() => endSession('manual')}><LogOut aria-hidden="true" />Cerrar sesión</Button>
      <Button ref={continueButtonRef} onClick={continueSession}>Seguir conectado</Button>
    </div>
  </Modal>
}
