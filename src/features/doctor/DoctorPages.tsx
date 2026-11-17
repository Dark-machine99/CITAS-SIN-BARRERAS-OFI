import { ArrowLeft, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, EyeOff, History, LockKeyhole, Search, UserCheck, UserX, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../app/providers/AuthProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { doctorAgendaAdapter, type DoctorAgendaAdapter, type DoctorAgendaAppointment } from '../../services/supabase/doctorAgendaAdapter'
import { doctorAppointmentDetailAdapter, DoctorAppointmentDetailError, type DoctorAppointmentDetail, type DoctorAppointmentDetailAdapter, type DoctorAppointmentOutcome } from '../../services/supabase/doctorAppointmentDetailAdapter'
import { doctorFirstAccessAdapter, DoctorFirstAccessError, type DoctorFirstAccessAdapter } from '../../services/supabase/doctorFirstAccessAdapter'

const formatDate = (date: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
type FirstAccessRecovery = 'retry' | 'reauthenticate' | 'finalization'

const firstAccessErrorMessage = (error: unknown) => {
  if (!(error instanceof DoctorFirstAccessError)) return 'No pudimos verificar el estado final de tu cuenta. Vuelve a iniciar sesión para continuar de forma segura.'
  if (error.code === 'PASSWORD_CHANGE_FAILED' || error.code === 'INVALID_INPUT') return 'La contraseña no fue aceptada. Elige una contraseña distinta y vuelve a intentarlo.'
  if (error.code === 'FINALIZATION_PENDING') return 'La contraseña pudo cambiar, pero el acceso sigue bloqueado. Vuelve a iniciar sesión con la contraseña que acabas de crear y después reintenta con una contraseña distinta.'
  if (error.code === 'UNAUTHORIZED') return 'Tu sesión ya no es válida. Vuelve a iniciar sesión para continuar.'
  if (error.code === 'FORBIDDEN') return 'Esta cuenta no puede completar el primer acceso médico.'
  return 'No pudimos completar el primer acceso. Inténtalo nuevamente.'
}

const firstAccessRecovery = (error: unknown): FirstAccessRecovery => {
  if (!(error instanceof DoctorFirstAccessError)) return 'reauthenticate'
  if (error.code === 'FINALIZATION_PENDING') return 'finalization'
  if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') return 'reauthenticate'
  return 'retry'
}

export function DoctorPasswordPage({ adapter = doctorFirstAccessAdapter }: { adapter?: DoctorFirstAccessAdapter } = {}) {
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirmation?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<FirstAccessRecovery | null>(null)
  const [busy, setBusy] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmationRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const auth = useAuth()
  const navigate = useNavigate()
  useEffect(() => { headingRef.current?.focus() }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirmation = String(form.get('confirmation') ?? '')
    const nextErrors: { password?: string; confirmation?: string } = {}
    if (password.length < 8) nextErrors.password = 'Usa al menos 8 caracteres.'
    if (password.length > 1024) nextErrors.password = 'La contraseña supera el límite permitido.'
    if (!confirmation) nextErrors.confirmation = 'Repite la nueva contraseña.'
    else if (password !== confirmation) nextErrors.confirmation = 'Las contraseñas no coinciden.'
    setErrors(nextErrors); setFormError(null); setRecovery(null)
    if (Object.keys(nextErrors).length) {
      window.setTimeout(() => (nextErrors.password ? passwordRef : confirmationRef).current?.focus(), 0)
      return
    }

    setBusy(true)
    try {
      await adapter.complete(password)
      const profile = await auth.reloadAccount()
      if (profile.role !== 'doctor' || profile.must_change_password) throw new Error('Gate no actualizado')
      navigate('/medico', { replace: true })
    } catch (error) {
      setRecovery(firstAccessRecovery(error))
      setFormError(firstAccessErrorMessage(error))
      window.setTimeout(() => errorRef.current?.focus(), 0)
    } finally {
      setBusy(false)
    }
  }
  const leave = async () => { try { await auth.signOut() } finally { navigate('/login', { replace: true }) } }
  return <section className="first-access"><div className="first-access__scene" aria-hidden="true"><LockKeyhole /><i /><i /></div><div className="first-access__card"><span className="eyebrow">Primer acceso médico · cuenta segura</span><h1 ref={headingRef} tabIndex={-1}>Crea tu nueva contraseña</h1><p>Debes completar este paso antes de abrir la agenda o guardar preferencias. La contraseña se envía únicamente a la operación segura de primer acceso.</p>{formError ? <div ref={errorRef} tabIndex={-1} className="notice notice--error" role="alert">{formError}</div> : null}<form onSubmit={(event) => void submit(event)} noValidate aria-busy={busy}><div className="field"><label htmlFor="doctor-password">Nueva contraseña</label><div className="input-shell"><LockKeyhole aria-hidden="true" /><input ref={passwordRef} id="doctor-password" name="password" type={show ? 'text' : 'password'} maxLength={1024} aria-invalid={!!errors.password} aria-describedby={`doctor-password-help${errors.password ? ' doctor-password-error' : ''}`} autoComplete="new-password" /><button type="button" className="input-action" onClick={() => setShow((value) => !value)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{show ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div><small id="doctor-password-help">Usa al menos 8 caracteres y una contraseña distinta a la temporal.</small>{errors.password ? <span className="field-error" id="doctor-password-error">{errors.password}</span> : null}</div><div className="field"><label htmlFor="doctor-password-confirmation">Confirma la nueva contraseña</label><div className="input-shell"><LockKeyhole aria-hidden="true" /><input ref={confirmationRef} id="doctor-password-confirmation" name="confirmation" type={show ? 'text' : 'password'} maxLength={1024} aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation ? 'doctor-password-confirmation-error' : undefined} autoComplete="new-password" /></div>{errors.confirmation ? <span className="field-error" id="doctor-password-confirmation-error">{errors.confirmation}</span> : null}</div>{recovery !== 'reauthenticate' ? <Button type="submit" loading={busy} className="button--full">{recovery === 'finalization' ? 'Reintentar con otra contraseña' : recovery === 'retry' ? 'Intentar nuevamente' : 'Guardar y abrir mi agenda'}</Button> : null}{recovery === 'finalization' || recovery === 'reauthenticate' ? <Button type="button" variant="secondary" className="button--full" onClick={() => void leave()}>Volver a iniciar sesión</Button> : null}</form></div></section>
}

type AgendaPeriod = 'today' | 'upcoming' | 'history'
type AgendaState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; appointments: DoctorAgendaAppointment[] }
const CLINICAL_TIME_ZONE = 'America/Lima'
const periodLabels: Record<AgendaPeriod, string> = { today: 'Hoy', upcoming: 'Próximas', history: 'Historial' }
const emptyAgenda: DoctorAgendaAppointment[] = []
const clinicalToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: CLINICAL_TIME_ZONE }).format(new Date())
const dateLabel = (date: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
const monthLabel = (month: string) => new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`))
const shiftMonth = (month: string, amount: number) => {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year!, value! - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
const monthDays = (month: string) => {
  const [year, value] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year!, value!, 0)).getUTCDate()
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}

export function DoctorAgendaPage({ adapter = doctorAgendaAdapter, today: todayProp }: { adapter?: DoctorAgendaAdapter; today?: string } = {}) {
  const today = todayProp ?? clinicalToday()
  const [state, setState] = useState<AgendaState>({ status: 'loading' })
  const [period, setPeriod] = useState<AgendaPeriod>('today')
  const [query, setQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [visibleMonth, setVisibleMonth] = useState(today.slice(0, 7))
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    void adapter.list().then(
      (appointments) => { if (active) setState({ status: 'ready', appointments }) },
      () => { if (active) setState({ status: 'error' }) },
    )
    return () => { active = false }
  }, [adapter, reload])

  const assigned = state.status === 'ready' ? state.appointments : emptyAgenda
  const counts = useMemo(() => ({
    today: assigned.filter((item) => item.date === today).length,
    upcoming: assigned.filter((item) => item.date > today).length,
    history: assigned.filter((item) => item.date < today).length,
  }), [assigned, today])
  const calendarCounts = useMemo(() => {
    const values = new Map<string, number>()
    for (const item of assigned) values.set(item.date, (values.get(item.date) ?? 0) + 1)
    return values
  }, [assigned])
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-PE')
    return assigned.filter((item) => {
      const periodMatch = period === 'today' ? item.date === today : period === 'upcoming' ? item.date > today : item.date < today
      const dateMatch = !selectedDate || item.date === selectedDate
      const queryMatch = !normalizedQuery || `${item.patientName} ${item.specialtyName} ${item.code}`.toLocaleLowerCase('es-PE').includes(normalizedQuery)
      return periodMatch && dateMatch && queryMatch
    })
  }, [assigned, period, query, selectedDate, today])
  const days = useMemo(() => monthDays(visibleMonth), [visibleMonth])
  const firstWeekday = (new Date(`${visibleMonth}-01T12:00:00Z`).getUTCDay() + 6) % 7
  const selectDate = (date: string) => {
    if (selectedDate === date) { setSelectedDate(null); return }
    setSelectedDate(date)
    setPeriod(date === today ? 'today' : date > today ? 'upcoming' : 'history')
  }

  return <section>
    <header className="role-page-heading"><div><span className="eyebrow">Agenda médica · sesión protegida</span><h1>Tu jornada, en orden</h1><p>Consulta las citas que el servidor asignó a tu perfil médico.</p></div><div className="role-heading-scene" aria-hidden="true"><CalendarDays /><span /><i /></div></header>
    <div className="metric-grid metric-grid--three" aria-label="Resumen de agenda"><article><span className="metric-icon"><CalendarDays aria-hidden="true" /></span><div><small>Citas de hoy</small><strong>{state.status === 'ready' ? counts.today : '—'}</strong></div></article><article><span className="metric-icon metric-icon--mint"><UsersRound aria-hidden="true" /></span><div><small>Próximas</small><strong>{state.status === 'ready' ? counts.upcoming : '—'}</strong></div></article><article><span className="metric-icon metric-icon--lavender"><History aria-hidden="true" /></span><div><small>Historial</small><strong>{state.status === 'ready' ? counts.history : '—'}</strong></div></article></div>
    <div className="doctor-agenda-layout">
      <div className="panel role-panel"><div className="agenda-toolbar"><div className="segmented role-segmented" aria-label="Periodo de agenda">{(['today', 'upcoming', 'history'] as const).map((value) => <button key={value} className={period === value ? 'active' : ''} type="button" aria-pressed={period === value} onClick={() => { setPeriod(value); setSelectedDate(null) }}>{periodLabels[value]}</button>)}</div><label className="search-box"><Search aria-hidden="true" /><span className="sr-only">Buscar por paciente, especialidad o código</span><input id="doctor-agenda-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar paciente, especialidad o código" /><DictationButton label="búsqueda de agenda" targetId="doctor-agenda-search" /></label></div>
        <p className="timezone-note"><Clock3 aria-hidden="true" /> Fechas y periodos interpretados en {CLINICAL_TIME_ZONE}.</p>
        {state.status === 'loading' ? <div className="agenda-state" role="status" aria-live="polite"><span className="spin" aria-hidden="true"><Clock3 /></span><h2>Cargando tu agenda…</h2><p>Consultamos únicamente las citas asignadas a tu cuenta.</p></div> : null}
        {state.status === 'error' ? <div className="agenda-state" role="alert"><CalendarDays aria-hidden="true" /><h2>No pudimos cargar tu agenda</h2><p>No mostramos datos parciales. Reintenta la consulta.</p><Button onClick={() => { setState({ status: 'loading' }); setReload((value) => value + 1) }}>Reintentar</Button></div> : null}
        {state.status === 'ready' && visible.length ? <div className="role-list">{visible.map((item) => <article className="agenda-item" key={item.id}><div className="agenda-time"><strong>{item.time.slice(0, 5)}</strong><small>{item.durationMinutes} min</small></div><div><span className="demo-label">{item.code}</span><h2>{item.patientName}</h2><p>{item.specialtyName} · {formatDate(item.date)}</p></div><StatusBadge status={item.status} /><ButtonLink variant="secondary" to={`/medico/citas/${item.id}`}>Ver detalle</ButtonLink></article>)}</div> : null}
        {state.status === 'ready' && !visible.length ? <div className="empty-state"><CalendarDays aria-hidden="true" /><h2>{assigned.length ? 'No hay citas con estos filtros' : 'Tu agenda está vacía'}</h2><p>{assigned.length ? 'Cambia el periodo, la fecha o la búsqueda.' : 'Cuando el servidor te asigne una cita, aparecerá aquí.'}</p>{selectedDate || query ? <Button variant="secondary" onClick={() => { setSelectedDate(null); setQuery('') }}>Limpiar filtros</Button> : null}</div> : null}
      </div>
      <aside className="panel doctor-calendar" aria-labelledby="doctor-calendar-title"><div className="doctor-calendar__header"><div><span className="eyebrow">Filtro por fecha</span><h2 id="doctor-calendar-title">Mini calendario</h2></div><div className="doctor-calendar__controls"><Button variant="ghost" className="icon-button" aria-label="Mes anterior" onClick={() => setVisibleMonth((value) => shiftMonth(value, -1))}><ChevronLeft aria-hidden="true" /></Button><Button variant="ghost" className="icon-button" aria-label="Mes siguiente" onClick={() => setVisibleMonth((value) => shiftMonth(value, 1))}><ChevronRight aria-hidden="true" /></Button></div></div><p className="doctor-calendar__month" aria-live="polite">{monthLabel(visibleMonth)}</p><div className="doctor-calendar__weekdays" aria-hidden="true">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div><div className="doctor-calendar__grid">{Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} aria-hidden="true" />)}{days.map((date) => { const count = calendarCounts.get(date) ?? 0; return <button key={date} type="button" className={`${date === today ? 'is-today' : ''} ${selectedDate === date ? 'is-selected' : ''}`} aria-pressed={selectedDate === date} aria-label={`${dateLabel(date)}${count ? `, ${count} ${count === 1 ? 'cita' : 'citas'}` : ', sin citas'}`} onClick={() => selectDate(date)}><span>{Number(date.slice(-2))}</span>{count ? <small aria-hidden="true">{count}</small> : null}</button> })}</div>{selectedDate ? <Button variant="ghost" className="button--full" onClick={() => setSelectedDate(null)}>Mostrar todo el periodo</Button> : <p className="doctor-calendar__hint">Selecciona un día para filtrar. El número indica cuántas citas tienes.</p>}</aside>
    </div>
  </section>
}

type AppointmentDetailState =
  | { status: 'loading'; routeId: string }
  | { status: 'not-found'; routeId: string }
  | { status: 'forbidden'; routeId: string }
  | { status: 'unauthorized'; routeId: string }
  | { status: 'error'; routeId: string }
  | { status: 'ready'; routeId: string; detail: DoctorAppointmentDetail }

const outcomeLabel = (outcome: DoctorAppointmentOutcome) => outcome === 'attended' ? 'Atendido' : 'No asistió'
const detailStateFromError = (error: unknown, routeId: string): AppointmentDetailState => {
  if (error instanceof DoctorAppointmentDetailError) {
    if (error.code === 'INVALID_INPUT' || error.code === 'APPOINTMENT_NOT_FOUND') return { status: 'not-found', routeId }
    if (error.code === 'FORBIDDEN') return { status: 'forbidden', routeId }
    if (error.code === 'UNAUTHORIZED') return { status: 'unauthorized', routeId }
  }
  return { status: 'error', routeId }
}

const outcomeErrorMessage = (error: unknown) => {
  if (!(error instanceof DoctorAppointmentDetailError)) return 'No pudimos registrar el resultado. Inténtalo nuevamente.'
  if (error.code === 'APPOINTMENT_NOT_YET_ELIGIBLE') return 'Podrás registrar el resultado cuando comience la hora clínica de la cita.'
  if (error.code === 'INVALID_APPOINTMENT_STATE') return 'El estado actual de la cita ya no permite registrar este resultado.'
  if (error.code === 'APPOINTMENT_NOT_FOUND') return 'La cita ya no está disponible para esta cuenta.'
  if (error.code === 'UNAUTHORIZED') return 'Tu sesión ya no es válida. Vuelve a iniciar sesión para continuar.'
  if (error.code === 'FORBIDDEN') return 'Esta cuenta no puede registrar el resultado de la cita.'
  if (error.code === 'NETWORK_ERROR') return 'No pudimos comunicarnos con el servicio. Revisa tu conexión e inténtalo nuevamente.'
  return 'No pudimos registrar el resultado. Inténtalo nuevamente.'
}

export function DoctorAppointmentDetailPage({ adapter = doctorAppointmentDetailAdapter }: { adapter?: DoctorAppointmentDetailAdapter } = {}) {
  const { id = '' } = useParams()
  return <DoctorAppointmentDetailContent key={id} id={id} adapter={adapter} />
}

function DoctorAppointmentDetailContent({ id, adapter }: { id: string; adapter: DoctorAppointmentDetailAdapter }) {
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState<AppointmentDetailState>({ status: 'loading', routeId: id })
  const [pendingOutcome, setPendingOutcome] = useState<DoctorAppointmentOutcome | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const activeRef = useRef(true)
  const operationRef = useRef(0)
  const submittingRef = useRef(false)
  const attendedTriggerRef = useRef<HTMLButtonElement>(null)
  const noShowTriggerRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const modalReturnFocusRef = useRef<HTMLElement>(null)
  const resultRegionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      operationRef.current += 1
      submittingRef.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    void adapter.load(id).then((detail) => {
      if (active) setState({ status: 'ready', routeId: id, detail })
    }).catch((error: unknown) => {
      if (active) setState(detailStateFromError(error, id))
    })
    return () => { active = false }
  }, [adapter, id, reloadKey])

  const closeOutcomeDialog = useCallback(() => {
    if (submittingRef.current) return
    setPendingOutcome(null)
    setActionError(null)
  }, [])
  const resolveModalReturnFocus = useCallback(() => modalReturnFocusRef.current, [])
  const openOutcomeDialog = (outcome: DoctorAppointmentOutcome) => {
    modalReturnFocusRef.current = outcome === 'no_show' ? noShowTriggerRef.current : attendedTriggerRef.current
    setActionError(null)
    setSuccessMessage(null)
    setPendingOutcome(outcome)
  }
  const retryLoad = () => {
    setState({ status: 'loading', routeId: id })
    setSuccessMessage(null)
    setReloadKey((value) => value + 1)
  }
  const operationIsActive = (operation: number) => activeRef.current && operationRef.current === operation
  const refreshDetail = async (operation: number) => {
    try {
      const detail = await adapter.load(id)
      if (!operationIsActive(operation)) return null
      setState({ status: 'ready', routeId: id, detail })
      return detail
    } catch (error) {
      if (!operationIsActive(operation)) return null
      setState(detailStateFromError(error, id))
      return null
    }
  }
  const confirmOutcome = async () => {
    if (!pendingOutcome || submittingRef.current) return
    const outcome = pendingOutcome
    const operation = operationRef.current + 1
    operationRef.current = operation
    submittingRef.current = true
    setSubmitting(true)
    setActionError(null)
    try {
      await adapter.setOutcome(id, outcome)
      if (!operationIsActive(operation)) return
      const refreshed = await refreshDetail(operation)
      if (!operationIsActive(operation)) return
      if (refreshed && refreshed.status !== 'confirmed') modalReturnFocusRef.current = resultRegionRef.current
      setPendingOutcome(null)
      if (refreshed) setSuccessMessage(`Resultado registrado: ${outcomeLabel(outcome)}.`)
    } catch (error) {
      if (!operationIsActive(operation)) return
      if (error instanceof DoctorAppointmentDetailError && error.code === 'APPOINTMENT_OUTCOME_CONFLICT') {
        const refreshed = await refreshDetail(operation)
        if (!operationIsActive(operation)) return
        if (refreshed && refreshed.status !== 'confirmed') modalReturnFocusRef.current = resultRegionRef.current
        setPendingOutcome(null)
        setSuccessMessage(null)
        setActionError('La cita ya tenía otro resultado registrado. El detalle fue actualizado.')
      } else {
        setActionError(outcomeErrorMessage(error))
      }
    } finally {
      if (operationIsActive(operation)) {
        submittingRef.current = false
        setSubmitting(false)
      }
    }
  }

  const visibleState: AppointmentDetailState = state.routeId === id ? state : { status: 'loading', routeId: id }
  if (visibleState.status === 'loading') return <section className="empty-state" aria-busy="true"><Clock3 aria-hidden="true" /><h1>Cargando detalle de la cita</h1><p>Consultamos únicamente la información autorizada para tu agenda.</p></section>
  if (visibleState.status === 'not-found') return <section className="empty-state"><UserX aria-hidden="true" /><h1>Cita no disponible</h1><p>No existe una cita disponible para esta dirección o tu cuenta no puede verla.</p><ButtonLink to="/medico">Volver a mi agenda</ButtonLink></section>
  if (visibleState.status === 'forbidden') return <section className="empty-state"><LockKeyhole aria-hidden="true" /><h1>Acceso no disponible</h1><p>Tu cuenta no puede consultar este detalle.</p><ButtonLink to="/medico">Volver a mi agenda</ButtonLink></section>
  if (visibleState.status === 'unauthorized') return <section className="empty-state"><LockKeyhole aria-hidden="true" /><h1>Sesión no disponible</h1><p>Vuelve a iniciar sesión para consultar tu agenda médica.</p><ButtonLink to="/login">Ir al ingreso</ButtonLink></section>
  if (visibleState.status === 'error') return <section className="empty-state"><UserX aria-hidden="true" /><h1>No pudimos cargar la cita</h1><p>No mostramos datos parciales. Inténtalo nuevamente.</p><div className="button-row"><Button onClick={retryLoad}>Reintentar</Button><ButtonLink variant="secondary" to="/medico">Volver a mi agenda</ButtonLink></div></section>

  const appointment = visibleState.detail
  const canSetOutcome = appointment.status === 'confirmed'
  return <section>
    <Link className="back-link" to="/medico"><ArrowLeft aria-hidden="true" /> Volver a mi agenda</Link>
    {successMessage ? <div className="notice notice--success" role="status">{successMessage}</div> : null}
    {actionError && !pendingOutcome ? <div className="notice notice--error" role="alert">{actionError}</div> : null}
    <header className="detail-header role-detail-header"><div><span className="eyebrow">Cita asignada · {appointment.code}</span><h1>{appointment.patientName}</h1><p>{appointment.specialtyName}</p></div><StatusBadge status={appointment.status} /></header>
    <div className="detail-grid"><article className="panel"><div className="panel__header"><h2>Información de la cita</h2></div><dl className="detail-list"><div><dt>Fecha</dt><dd>{formatDate(appointment.date)}</dd></div><div><dt>Hora</dt><dd>{appointment.time.slice(0, 5)}</dd></div><div><dt>Duración</dt><dd>{appointment.durationMinutes} minutos</dd></div><div><dt>Especialidad</dt><dd>{appointment.specialtyName}</dd></div></dl></article><aside ref={resultRegionRef} className="panel clinical-boundary" tabIndex={-1} aria-labelledby="doctor-outcome-title"><UserCheck aria-hidden="true" /><h2 id="doctor-outcome-title">{canSetOutcome ? 'Registrar resultado' : 'Resultado de la cita'}</h2><p>{canSetOutcome ? 'El servidor verificará la hora clínica y que esta cita siga habilitada antes de guardar el resultado.' : 'Esta cita ya no admite acciones de asistencia desde este detalle.'}</p>{canSetOutcome ? <div className="button-row"><Button ref={attendedTriggerRef} onClick={() => openOutcomeDialog('attended')}><CheckCircle2 aria-hidden="true" />Atendido</Button><Button ref={noShowTriggerRef} variant="secondary" onClick={() => openOutcomeDialog('no_show')}><UserX aria-hidden="true" />No asistió</Button></div> : null}</aside></div>
    <Modal open={!!pendingOutcome} title="Confirma el resultado de la cita" onClose={closeOutcomeDialog} initialFocusRef={cancelRef} resolveReturnFocus={resolveModalReturnFocus}><p>Vas a registrar la cita <strong>{appointment.code}</strong> como <strong>{pendingOutcome ? outcomeLabel(pendingOutcome) : ''}</strong>. El servidor validará y guardará este resultado.</p>{actionError ? <div className="notice notice--error" role="alert">{actionError}</div> : null}<div className="modal-actions"><Button ref={cancelRef} variant="secondary" disabled={submitting} onClick={closeOutcomeDialog}>Cancelar</Button><Button loading={submitting} onClick={() => void confirmOutcome()}>Confirmar resultado</Button></div></Modal>
  </section>
}
