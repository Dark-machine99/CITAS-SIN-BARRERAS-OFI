import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Clock3, FileText, LoaderCircle, Search, ShieldCheck, Stethoscope, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useBooking } from '../../app/providers/BookingProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { AppointmentMutationErrorCode, PatientAppointment } from '../../services/supabase/patientAppointmentsAdapter'
import { patientAvailabilityAdapter, PatientAvailabilityError, type AvailabilityErrorCode, type PatientAvailabilityAdapter, type PatientAvailabilityData } from '../../services/supabase/patientAvailabilityAdapter'
import type { AppointmentStatus } from '../../types/domain'
import { formatDate } from '../patient/DashboardPage'

const filters: { value: 'all' | AppointmentStatus; label: string }[] = [
  { value: 'all', label: 'Todas' }, { value: 'confirmed', label: 'Confirmadas' },
  { value: 'attended', label: 'Atendidas' }, { value: 'no_show', label: 'Inasistencias' },
  { value: 'cancelled', label: 'Canceladas' },
]

export function AppointmentsPage() {
  const { appointments, appointmentsState, refreshAppointments } = useBooking()
  const [filter, setFilter] = useState<'all' | AppointmentStatus>('all')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase('es-PE')
  const visible = appointments.filter((item) => (filter === 'all' || item.status === filter)
    && `${item.code} ${item.doctorName} ${item.specialtyName}`.toLocaleLowerCase('es-PE').includes(normalizedQuery))

  return <div><div className="page-heading"><span className="eyebrow">Agenda personal</span><h1>Mis citas</h1><p>Consulta y gestiona las citas asociadas a tu cuenta Paciente.</p></div>
    <div className="filter-bar"><div className="search-box"><Search aria-hidden="true" /><label className="sr-only" htmlFor="appointment-search">Buscar cita</label><input id="appointment-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, médico o especialidad" /><DictationButton label="búsqueda de citas" onTranscript={setQuery} /></div></div>
    <div className="filter-chips" aria-label="Filtrar por estado">{filters.map((item) => <button type="button" key={item.value} aria-pressed={filter === item.value} className={filter === item.value ? 'active' : ''} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
    {appointmentsState.status === 'loading' || appointmentsState.status === 'idle' ? <AppointmentsLoading /> : null}
    {appointmentsState.status === 'error' ? <AppointmentsError onRetry={() => void refreshAppointments()} /> : null}
    {appointmentsState.status === 'ready' && !appointments.length ? <EmptyAppointments /> : null}
    {appointmentsState.status === 'ready' && appointments.length && !visible.length ? <EmptySearch /> : null}
    {appointmentsState.status === 'ready' && visible.length ? <div className="appointment-list">{visible.map((item) => <article key={item.id} className="appointment-card"><div className="appointment-card__date"><strong>{new Date(`${item.date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(new Date(`${item.date}T12:00:00`))}</span></div><div className="appointment-card__body"><div><span className="demo-label">{item.code}</span><h2>{item.specialtyName}</h2><p><Stethoscope aria-hidden="true" />{item.doctorName}</p><p><Clock3 aria-hidden="true" />{formatDate(item.date)} · {item.time.slice(0, 5)}</p></div><div className="appointment-card__actions"><StatusBadge status={item.status} /><ButtonLink to={`/paciente/citas/${item.id}`} variant="secondary">Ver detalle <ArrowRight aria-hidden="true" /></ButtonLink></div></div></article>)}</div> : null}
  </div>
}

export function AppointmentDetailPage({ availabilityAdapter = patientAvailabilityAdapter }: { availabilityAdapter?: PatientAvailabilityAdapter } = {}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { appointments, appointmentsState, refreshAppointments, cancel, reschedule } = useBooking()
  const appointment = appointments.find((item) => item.id === id)

  if (appointmentsState.status === 'loading' || appointmentsState.status === 'idle') return <AppointmentsLoading detail />
  if (appointmentsState.status === 'error') return <AppointmentsError onRetry={() => void refreshAppointments()} />
  if (!appointment) return <div className="empty-state"><FileText aria-hidden="true" /><h1>Cita no encontrada</h1><p>La cita no existe o no está asociada a tu cuenta.</p><ButtonLink to="/paciente/citas">Volver a mis citas</ButtonLink></div>
  return <AppointmentDetail appointment={appointment} availabilityAdapter={availabilityAdapter} onBack={() => navigate('/paciente/citas')} onCancel={cancel} onReschedule={reschedule} />
}

type RescheduleSlotsState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'error'; key: string; code: AvailabilityErrorCode }
  | { status: 'ready'; key: string; data: PatientAvailabilityData }

function AppointmentDetail({ appointment, availabilityAdapter, onBack, onCancel, onReschedule }: {
  appointment: PatientAppointment
  availabilityAdapter: PatientAvailabilityAdapter
  onBack: () => void
  onCancel: ReturnType<typeof useBooking>['cancel']
  onReschedule: ReturnType<typeof useBooking>['reschedule']
}) {
  const [cancelOpen, setCancelOpen] = useState(false)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [date, setDate] = useState(appointment.date)
  const [time, setTime] = useState<string | null>(null)
  const [slotsState, setSlotsState] = useState<RescheduleSlotsState>({ status: 'idle' })
  const [slotsAttempt, setSlotsAttempt] = useState(0)
  const [busy, setBusy] = useState<'cancel' | 'reschedule' | null>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const mutable = appointment.status === 'pending' || appointment.status === 'confirmed'
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date())
  const requestKey = rescheduleOpen && date ? `${appointment.doctorId}:${appointment.specialtyId}:${date}:${slotsAttempt}` : null
  const visibleSlotsState: RescheduleSlotsState = !requestKey
    ? { status: 'idle' }
    : slotsState.status !== 'idle' && slotsState.key === requestKey
      ? slotsState
      : { status: 'loading', key: requestKey }
  const selectedSlot = visibleSlotsState.status === 'ready' ? visibleSlotsState.data.slots.find((slot) => slot.time === time) : undefined

  useEffect(() => {
    if (!rescheduleOpen || !date || !requestKey) return
    let current = true
    void availabilityAdapter.load({ doctorId: appointment.doctorId, specialtyId: appointment.specialtyId, date }).then(
      (data) => {
        if (!current) return
        setTime((selected) => selected && data.slots.some((slot) => slot.time === selected) ? selected : null)
        setSlotsState({ status: 'ready', key: requestKey, data })
      },
      (error) => {
        if (!current) return
        setTime(null)
        setSlotsState({ status: 'error', key: requestKey, code: error instanceof PatientAvailabilityError ? error.code : 'INTERNAL_ERROR' })
      },
    )
    return () => { current = false }
  }, [appointment.doctorId, appointment.specialtyId, availabilityAdapter, date, requestKey, rescheduleOpen])

  const doCancel = async () => {
    if (busy) return
    setBusy('cancel'); setMessage(null)
    const response = await onCancel(appointment.id)
    setBusy(null)
    if (!response.ok) { setMessage({ tone: 'error', text: mutationMessage(response.code, 'cancel') }); return }
    setCancelOpen(false); setMessage({ tone: 'success', text: 'La cita quedó cancelada.' })
  }
  const doReschedule = async () => {
    if (busy || !selectedSlot) return
    setBusy('reschedule'); setMessage(null)
    const response = await onReschedule(appointment.id, date, selectedSlot.time)
    setBusy(null)
    if (!response.ok) { setMessage({ tone: 'error', text: mutationMessage(response.code, 'reschedule') }); return }
    setRescheduleOpen(false); setMessage({ tone: 'success', text: 'La cita quedó reprogramada.' })
  }

  return <div className="detail-page"><Button variant="ghost" onClick={onBack}><ArrowLeft aria-hidden="true" />Volver a mis citas</Button>
    {message ? <div className={`notice notice--${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>{message.tone === 'error' ? <AlertTriangle aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}{message.text}</div> : null}
    <div className="detail-header"><div><span className="demo-label">{appointment.code}</span><h1>{appointment.specialtyName}</h1><p>{appointment.doctorName}</p></div><StatusBadge status={appointment.status} /></div>
    <div className="detail-grid"><section className="panel"><h2>Detalle de la cita</h2><dl className="detail-list"><div><dt><CalendarDays aria-hidden="true" />Fecha</dt><dd>{formatDate(appointment.date)}</dd></div><div><dt><Clock3 aria-hidden="true" />Hora y duración</dt><dd>{appointment.time.slice(0, 5)} · {appointment.durationMinutes} minutos</dd></div><div><dt><Stethoscope aria-hidden="true" />Profesional</dt><dd>{appointment.doctorName}</dd></div><div><dt><FileText aria-hidden="true" />Motivo</dt><dd>{appointment.reason ?? 'No indicado'}</dd></div></dl></section>
      <aside className="panel action-panel"><h2>Gestionar cita</h2><p>El servidor validará tu identidad, el estado de la cita y la disponibilidad antes de aplicar cambios.</p>{mutable ? <><Button onClick={() => { setMessage(null); setDate(appointment.date); setTime(null); setSlotsAttempt((value) => value + 1); setRescheduleOpen(true) }}><CalendarDays aria-hidden="true" />Reprogramar</Button><Button ref={cancelButtonRef} variant="danger" onClick={() => { setMessage(null); setCancelOpen(true) }}><Trash2 aria-hidden="true" />Cancelar cita</Button></> : <div className="notice notice--neutral">Esta cita no admite cambios por su estado.</div>}</aside></div>
    <Modal open={cancelOpen} title="¿Cancelar esta cita?" onClose={() => { if (!busy) setCancelOpen(false) }} returnFocusRef={cancelButtonRef}><p>La cita cambiará a estado Cancelada y el horario volverá a quedar disponible.</p>{message?.tone === 'error' ? <p className="notice notice--error" role="alert">{message.text}</p> : null}<div className="modal-actions"><Button variant="ghost" disabled={!!busy} onClick={() => setCancelOpen(false)}>Volver sin cancelar</Button><Button variant="danger" loading={busy === 'cancel'} onClick={() => void doCancel()}>Sí, cancelar cita</Button></div></Modal>
    <Modal open={rescheduleOpen} title="Reprogramar cita" onClose={() => { if (!busy) setRescheduleOpen(false) }}><p>Selecciona una fecha y uno de los horarios disponibles para {appointment.doctorName}.</p><div className="field"><label htmlFor="new-date">Nueva fecha</label><input id="new-date" type="date" min={today} value={date} onChange={(event) => { setDate(event.target.value); setTime(null) }} /></div><fieldset className="field reschedule-slots" aria-busy={visibleSlotsState.status === 'loading'}><legend>Nueva hora disponible</legend>{visibleSlotsState.status === 'loading' ? <div className="empty-inline" role="status"><LoaderCircle className="spin" aria-hidden="true" /><p>Consultando horarios disponibles…</p></div> : null}{visibleSlotsState.status === 'error' ? <div className="empty-inline" role="alert"><AlertTriangle aria-hidden="true" /><p>{availabilityMessage(visibleSlotsState.code)}</p><Button variant="secondary" onClick={() => setSlotsAttempt((value) => value + 1)}>Reintentar</Button></div> : null}{visibleSlotsState.status === 'ready' && !visibleSlotsState.data.slots.length ? <div className="empty-inline" role="status"><Clock3 aria-hidden="true" /><p>No hay horarios disponibles para esta fecha. Elige otro día.</p></div> : null}{visibleSlotsState.status === 'ready' && visibleSlotsState.data.slots.length ? <div className="time-grid">{visibleSlotsState.data.slots.map((slot) => <button key={slot.time} type="button" className={time === slot.time ? 'selected' : ''} aria-pressed={time === slot.time} onClick={() => setTime(slot.time)}>{slot.time.slice(0, 5)}<small>{slot.durationMinutes} minutos</small></button>)}</div> : null}</fieldset>{message?.tone === 'error' ? <p className="notice notice--error" role="alert">{message.text}</p> : null}<div className="modal-actions"><Button variant="ghost" disabled={!!busy} onClick={() => setRescheduleOpen(false)}>Volver</Button><Button loading={busy === 'reschedule'} disabled={!selectedSlot} onClick={() => void doReschedule()}>Guardar cambio</Button></div></Modal>
  </div>
}

function availabilityMessage(code: AvailabilityErrorCode) {
  if (code === 'UNAUTHORIZED') return 'Tu sesión no permite consultar horarios. Vuelve a iniciar sesión.'
  if (code === 'FORBIDDEN') return 'Tu cuenta no tiene permiso para consultar esta agenda.'
  if (code === 'DOCTOR_NOT_FOUND' || code === 'DOCTOR_INACTIVE' || code === 'INVALID_SPECIALTY' || code === 'INVALID_INPUT') return 'La atención seleccionada ya no está disponible. La cita original se conserva.'
  return 'No pudimos consultar los horarios. La cita original se conserva; comprueba tu conexión e inténtalo nuevamente.'
}

function mutationMessage(code: AppointmentMutationErrorCode, action: 'cancel' | 'reschedule') {
  if (code === 'UNAUTHORIZED') return 'Tu sesión no permite actualizar la cita. Vuelve a iniciar sesión.'
  if (code === 'FORBIDDEN' || code === 'APPOINTMENT_NOT_FOUND') return 'La cita no está disponible para esta cuenta.'
  if (code === 'INVALID_APPOINTMENT_STATE') return 'La cita cambió de estado y ya no admite esta acción.'
  if (code === 'SLOT_UNAVAILABLE') return 'Ese horario ya no está disponible. La cita original se conservó.'
  if (code === 'DOCTOR_INACTIVE' || code === 'INVALID_SPECIALTY') return 'La atención seleccionada ya no está disponible. La cita original se conservó.'
  if (code === 'INVALID_INPUT') return action === 'reschedule' ? 'Selecciona una fecha y hora futuras válidas.' : 'No pudimos validar la cita.'
  return `No pudimos ${action === 'cancel' ? 'cancelar' : 'reprogramar'} la cita. Comprueba tu conexión e inténtalo nuevamente.`
}

function AppointmentsLoading({ detail = false }: { detail?: boolean }) { return <div className="empty-state" role="status" aria-busy="true"><LoaderCircle className="spin" aria-hidden="true" /><h1>{detail ? 'Cargando detalle…' : 'Cargando tus citas…'}</h1><p>Estamos consultando tu agenda personal.</p></div> }
function AppointmentsError({ onRetry }: { onRetry: () => void }) { return <div className="empty-state" role="alert"><AlertTriangle aria-hidden="true" /><h1>No pudimos cargar tus citas</h1><p>Comprueba tu conexión e inténtalo nuevamente.</p><Button onClick={onRetry}>Reintentar</Button></div> }
function EmptyAppointments() { return <div className="empty-state" role="status"><CalendarDays aria-hidden="true" /><h2>Aún no tienes citas</h2><p>Cuando confirmes una reserva aparecerá aquí.</p><ButtonLink to="/paciente/reservar">Reservar una cita</ButtonLink></div> }
function EmptySearch() { return <div className="empty-state" role="status"><Search aria-hidden="true" /><h2>No hay citas que coincidan</h2><p>Cambia los filtros o limpia la búsqueda.</p></div> }
