import { AlertCircle, Ban, CheckCircle2, Clock3, UserX } from 'lucide-react'
import type { AppointmentStatus } from '../../types/domain'

const meta = {
  pending: { label: 'Pendiente', icon: Clock3 },
  confirmed: { label: 'Confirmada', icon: CheckCircle2 },
  attended: { label: 'Atendida', icon: CheckCircle2 },
  no_show: { label: 'Inasistencia', icon: UserX },
  cancelled: { label: 'Cancelada', icon: Ban },
} satisfies Record<AppointmentStatus, { label: string; icon: typeof AlertCircle }>

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { label, icon: Icon } = meta[status]
  return <span className={`status status--${status}`}><Icon aria-hidden="true" />{label}</span>
}
export const statusLabel = (status: AppointmentStatus) => meta[status].label
