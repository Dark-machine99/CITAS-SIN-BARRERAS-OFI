import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Eye, EyeOff, History, LockKeyhole, Search, UserCheck, UserX, UsersRound } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useDemoSession } from '../../app/providers/DemoSessionProvider'
import { useMedicalAdminDemo } from '../../app/providers/MedicalAdminDemoProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { doctorAgendaAdapter } from '../../services/mock/medicalAdminAdapters'
import { specialtyName } from '../../services/mock/data'
import type { AppointmentStatus } from '../../types/domain'

const DATE_DEMO = '2026-10-23'
const formatDate = (date: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

export function DoctorPasswordPage() {
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const { completeDoctorPasswordChange } = useDemoSession()
  const navigate = useNavigate()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    if (password.length < 10) { setError('Usa al menos 10 caracteres para completar la simulación.'); return }
    completeDoctorPasswordChange(); navigate('/medico')
  }
  return <section className="first-access"><div className="first-access__scene" aria-hidden="true"><LockKeyhole /><i /><i /></div><div className="first-access__card"><span className="eyebrow">Primer acceso médico · DEMO</span><h1>Crea una contraseña temporal</h1><p>Este paso bloquea la agenda hasta completarse. El prototipo valida localmente y no guarda la contraseña.</p><form onSubmit={submit}><div className="field"><label htmlFor="doctor-password">Nueva contraseña de demostración</label><div className="input-shell"><LockKeyhole aria-hidden="true" /><input id="doctor-password" name="password" type={show ? 'text' : 'password'} aria-invalid={!!error} aria-describedby={error ? 'doctor-password-error' : 'doctor-password-help'} autoComplete="new-password" /><DictationButton label="nueva contraseña de demostración" targetId="doctor-password" /><button type="button" className="input-action" onClick={() => setShow((value) => !value)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff /> : <Eye />}</button></div><small id="doctor-password-help">Mínimo 10 caracteres. No uses una contraseña real.</small>{error ? <span className="field-error" id="doctor-password-error">{error}</span> : null}</div><Button type="submit" className="button--full">Continuar a mi agenda</Button></form></div></section>
}

export function DoctorAgendaPage() {
  const { doctorId } = useDemoSession()
  const store = useMedicalAdminDemo()
  const [period, setPeriod] = useState<'today' | 'upcoming' | 'history'>('today')
  const [query, setQuery] = useState('')
  const appointments = useMemo(() => doctorAgendaAdapter.listAssigned(store, doctorId ?? '').filter((item) => {
    const periodMatch = period === 'today' ? item.appointment_date === DATE_DEMO : period === 'upcoming' ? item.appointment_date > DATE_DEMO : item.appointment_date < DATE_DEMO
    return periodMatch && `${item.patient_name} ${item.code}`.toLowerCase().includes(query.toLowerCase())
  }), [doctorId, period, query, store])
  const assigned = doctorAgendaAdapter.listAssigned(store, doctorId ?? '')
  return <section>
    <header className="role-page-heading"><div><span className="eyebrow">Agenda propia · datos sintéticos</span><h1>Tu jornada, en orden</h1><p>Consulta solo las citas asignadas a este perfil médico demo.</p></div><div className="role-heading-scene" aria-hidden="true"><CalendarDays /><span /><i /></div></header>
    <div className="metric-grid metric-grid--three"><article><span className="metric-icon"><CalendarDays /></span><div><small>Citas de hoy</small><strong>{assigned.filter((item) => item.appointment_date === DATE_DEMO).length}</strong></div></article><article><span className="metric-icon metric-icon--mint"><UsersRound /></span><div><small>Confirmadas</small><strong>{assigned.filter((item) => item.status === 'confirmed').length}</strong></div></article><article><span className="metric-icon metric-icon--lavender"><History /></span><div><small>Historial visible</small><strong>{assigned.filter((item) => item.appointment_date < DATE_DEMO).length}</strong></div></article></div>
    <div className="panel role-panel"><div className="agenda-toolbar"><div className="segmented role-segmented" aria-label="Periodo de agenda">{(['today', 'upcoming', 'history'] as const).map((value) => <button key={value} className={period === value ? 'active' : ''} type="button" onClick={() => setPeriod(value)}>{value === 'today' ? 'Hoy' : value === 'upcoming' ? 'Próximas' : 'Historial'}</button>)}</div><label className="search-box"><Search aria-hidden="true" /><span className="sr-only">Buscar por paciente o código</span><input id="doctor-agenda-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente o código" /><DictationButton label="búsqueda de agenda" targetId="doctor-agenda-search" /></label></div>
      <p className="timezone-note"><Clock3 /> Horario local de demostración. La zona horaria real se definirá en la integración.</p>
      {appointments.length ? <div className="role-list">{appointments.map((item) => <article className="agenda-item" key={item.id}><div className="agenda-time"><strong>{item.start_time}</strong><small>{item.duration_minutes} min</small></div><div><span className="demo-label">{item.code}</span><h2>{item.patient_name}</h2><p>{specialtyName(item.specialty_id)} · {formatDate(item.appointment_date)}</p></div><StatusBadge status={item.status} /><ButtonLink variant="secondary" to={`/medico/citas/${item.id}`}>Ver detalle</ButtonLink></article>)}</div> : <div className="empty-state"><CalendarDays /><h2>No hay citas en esta vista</h2><p>Cambia el periodo o limpia la búsqueda.</p></div>}
    </div>
  </section>
}

export function DoctorAppointmentDetailPage() {
  const { id = '' } = useParams()
  const { doctorId } = useDemoSession()
  const store = useMedicalAdminDemo()
  const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const appointment = doctorAgendaAdapter.findAssigned(store, doctorId ?? '', id)
  if (!appointment) return <section className="empty-state"><UserX /><h1>Cita no disponible</h1><p>Esta cita no está asignada al perfil médico activo.</p><ButtonLink to="/medico">Volver a mi agenda</ButtonLink></section>
  const confirm = () => { if (pendingStatus) store.updateAppointmentStatus(appointment.id, pendingStatus); setPendingStatus(null) }
  const canClose = appointment.status === 'confirmed'
  return <section><Link className="back-link" to="/medico"><ArrowLeft /> Volver a mi agenda</Link><header className="detail-header role-detail-header"><div><span className="eyebrow">Cita asignada · {appointment.code}</span><h1>{appointment.patient_name}</h1><p>{specialtyName(appointment.specialty_id)}</p></div><StatusBadge status={appointment.status} /></header><div className="detail-grid"><article className="panel"><div className="panel__header"><h2>Información de la cita</h2></div><dl className="detail-list"><div><dt>Fecha</dt><dd>{formatDate(appointment.appointment_date)}</dd></div><div><dt>Hora</dt><dd>{appointment.start_time}</dd></div><div><dt>Duración</dt><dd>{appointment.duration_minutes} minutos</dd></div><div><dt>Motivo opcional</dt><dd>{appointment.reason ?? 'No indicado'}</dd></div></dl></article><aside className="panel clinical-boundary"><UserCheck /><h2>Acciones disponibles</h2><p>Solo puedes registrar asistencia o inasistencia. Diagnósticos, notas y recetas no forman parte de este prototipo.</p><div className="button-row"><Button ref={triggerRef} disabled={!canClose} onClick={() => setPendingStatus('attended')}><CheckCircle2 />Marcar atendida</Button><Button variant="secondary" disabled={!canClose} onClick={() => setPendingStatus('no_show')}><UserX />Marcar inasistencia</Button></div></aside></div><Modal open={!!pendingStatus} title="Confirmar cambio de estado" onClose={() => setPendingStatus(null)} returnFocusRef={triggerRef}><p>Vas a marcar la cita <strong>{appointment.code}</strong> como <strong>{pendingStatus === 'attended' ? 'atendida' : 'inasistencia'}</strong>. Esta acción solo afecta la memoria de la demo.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setPendingStatus(null)}>Cancelar</Button><Button onClick={confirm}>Confirmar estado</Button></div></Modal></section>
}
