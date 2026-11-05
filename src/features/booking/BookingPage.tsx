import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, FlaskConical, HeartPulse, LoaderCircle, Stethoscope, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAccessibility } from '../../app/providers/AccessibilityProvider'
import { useBooking } from '../../app/providers/BookingProvider'
import { DictationButton } from '../../components/assistive/DictationButton'
import { Button, ButtonLink } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { createFutureLimaDates, patientAvailabilityAdapter, PatientAvailabilityError, type AvailabilityErrorCode, type PatientAvailabilityAdapter, type PatientAvailabilityData } from '../../services/supabase/patientAvailabilityAdapter'
import { patientDirectoryAdapter, type PatientDirectoryAdapter, type PatientDirectoryData } from '../../services/supabase/patientDirectoryAdapter'
import type { PatientReservationData, ReservationErrorCode } from '../../services/supabase/patientReservationAdapter'
import { patientTutorialAvailabilityAdapter, patientTutorialDirectoryAdapter } from '../../services/tutorial/patientTutorialBookingAdapter'
import type { AppointmentDraft } from '../../types/domain'
import { BodySelector } from '../body-selector/BodySelector'
import { formatDate } from '../patient/DashboardPage'
import { BookingDictationPanel } from '../voice/BookingDictationPanel'
import { useOptionalPatientTutorial } from '../tutorial/PatientTutorialProvider'
import { reportPatientTutorialAction } from '../tutorial/tutorialEvents'
import { firstIncompleteBookingStep, firstMissingBookingField, isBookingFieldComplete, requiredFieldsBeforeAdvance, type BookingRequiredField } from './bookingProgress'

type DirectoryState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: PatientDirectoryData }
type SlotsState =
  | { status: 'idle' }
  | { status: 'loading'; key: string }
  | { status: 'error'; key: string; code: AvailabilityErrorCode }
  | { status: 'ready'; key: string; data: PatientAvailabilityData }

interface BookingPageProps {
  directoryAdapter?: PatientDirectoryAdapter
  availabilityAdapter?: PatientAvailabilityAdapter
  now?: Date
}

export function BookingPage(props: BookingPageProps = {}) {
  const tutorial = useOptionalPatientTutorial()
  const practice = tutorial?.bookingMode === 'tutorial'
  const sessionKey = `${tutorial?.identityKey ?? 'standalone'}:${practice ? 'tutorial' : 'live'}`
  return <BookingPageContent key={sessionKey} {...props} practice={practice} sessionKey={sessionKey} />
}

function BookingPageContent({ directoryAdapter: liveDirectoryAdapter = patientDirectoryAdapter, availabilityAdapter: liveAvailabilityAdapter = patientAvailabilityAdapter, now, practice, sessionKey }: BookingPageProps & { practice: boolean; sessionKey: string }) {
  const { preferences, update: updateAccessibility } = useAccessibility()
  const booking = useBooking()
  const { resetSensitive } = booking
  const draft = practice ? booking.tutorialDraft : booking.draft
  const updateDraft = practice ? booking.updateTutorialDraft : booking.updateDraft
  const resetDraft = practice ? booking.resetTutorialDraft : booking.resetDraft
  const confirm = practice ? booking.confirmTutorial : booking.confirm
  const directoryAdapter = practice ? patientTutorialDirectoryAdapter : liveDirectoryAdapter
  const availabilityAdapter = practice ? patientTutorialAvailabilityAdapter : liveAvailabilityAdapter
  const navigate = useNavigate()
  const location = useLocation()
  const simple = preferences.simpleMode
  const draftRef = useRef(draft)
  useEffect(() => { draftRef.current = draft }, [draft])
  const directory = usePatientDirectory(directoryAdapter, draftRef, updateDraft)
  const slots = usePatientAvailability(availabilityAdapter, draft, draftRef, updateDraft)
  const [dates] = useState(() => createFutureLimaDates(now))
  const initialVoiceReview = new URLSearchParams(location.search).get('voice') === 'review' && !firstMissingBookingField(draft)
  const [step, setStep] = useState(() => initialVoiceReview ? (simple ? 2 : 5) : firstIncompleteBookingStep(draft, simple))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PatientReservationData | null>(null)
  const activeSession = useRef(true)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const handledVoiceReviewKey = useRef<string | null>(initialVoiceReview ? location.key : null)
  const steps = simple ? ['Atención', 'Fecha y hora', 'Revisar y confirmar'] : ['Especialidad', 'Profesional', 'Fecha', 'Hora', 'Motivo', 'Resumen', 'Confirmación']
  const directoryData = directory.state.status === 'ready' ? directory.state.data : null
  const specialtyName = useCallback((id: string) => directoryData?.specialties.find((item) => item.id === id)?.name ?? 'Especialidad no disponible', [directoryData])
  const doctorName = useCallback((id: string) => directoryData?.doctors.find((item) => item.id === id)?.name ?? 'Profesional no disponible', [directoryData])
  const selectedSlot = slots.state.status === 'ready' ? slots.state.data.slots.find((slot) => slot.time === draft.time) : undefined

  useEffect(() => { headingRef.current?.focus() }, [step])
  useEffect(() => () => { activeSession.current = false }, [])
  useEffect(() => () => { if (!practice) resetSensitive() }, [practice, resetSensitive])
  useEffect(() => {
    const requestsReview = new URLSearchParams(location.search).get('voice') === 'review'
    if (!requestsReview || firstMissingBookingField(draft) || handledVoiceReviewKey.current === location.key) return
    handledVoiceReviewKey.current = location.key
    const timer = window.setTimeout(() => { setError(''); setStep(simple ? 2 : 5) }, 0)
    return () => window.clearTimeout(timer)
  }, [draft, location.key, location.search, simple])

  const changeMode = (nextSimple: boolean) => {
    setStep(firstIncompleteBookingStep(draft, nextSimple))
    setError('')
    updateAccessibility({ simpleMode: nextSimple })
  }
  const validate = (keys: BookingRequiredField[]) => {
    const missing = keys.find((key) => !isBookingFieldComplete(draft, key))
    if (missing) {
      setError({ specialty: 'Elige una especialidad para continuar.', doctor: 'Elige un profesional para continuar.', date: 'Elige una fecha para continuar.', time: 'Elige una hora disponible para continuar.' }[missing])
      return false
    }
    if (keys.includes('time') && !selectedSlot) {
      setError(slots.state.status === 'loading' ? 'Espera mientras consultamos los horarios.' : 'Vuelve a elegir una hora disponible para continuar.')
      return false
    }
    setError('')
    return true
  }
  const next = () => {
    const needed = requiredFieldsBeforeAdvance(simple, step)
    if (!validate(needed)) { setStep(firstIncompleteBookingStep(draft, simple)); return }
    setStep((current) => Math.min(current + 1, steps.length - 1))
  }
  const submit = async () => {
    if (busy) return
    if (!validate(['specialty', 'doctor', 'date', 'time'])) { setStep(firstIncompleteBookingStep(draft, simple)); return }
    setBusy(true)
    setError('')
    try {
      const response = await confirm()
      if (!activeSession.current) return
      if (!response.ok) {
        if (response.code === 'SLOT_UNAVAILABLE') {
          updateDraft({ time: null })
          slots.retry()
          setError('Ese horario acaba de dejar de estar disponible. Conservamos especialidad, profesional, fecha y motivo; elige una nueva hora.')
          setStep(simple ? 1 : 3)
          return
        }
        setError(reservationMessage(response.code))
        return
      }
      setResult(response.appointment)
      if (practice) reportPatientTutorialAction('practice-complete')
    } finally {
      if (activeSession.current) setBusy(false)
    }
  }
  const handleDictatedProposal = useCallback((proposal: AppointmentDraft, ready: boolean) => {
    updateDraft(proposal)
    setError('')
    if (ready) setStep(simple ? 2 : 5)
  }, [simple, updateDraft])
  const choiceProps: ChoiceProps = {
    draft,
    directory,
    slots,
    dates,
    practice,
    updateDraft,
    specialtyName,
    onSpecialty: (specialtyId) => { slots.beginRequest(); updateDraft({ specialtyId, doctorId: null, date: null, time: null }) },
    onDoctor: (doctorId) => { slots.beginRequest(); updateDraft({ doctorId, date: null, time: null }) },
    onDate: (date) => { slots.beginRequest(); updateDraft({ date, time: null }) },
    onTime: (time) => updateDraft({ time }),
  }

  if (result) return <Success appointment={result} practice={practice} onNew={() => { resetDraft(); setResult(null); setStep(0) }} />
  const summary = <Summary draft={draft} specialtyName={specialtyName} doctorName={doctorName} duration={selectedSlot?.durationMinutes} practice={practice} />
  return <div className="booking-page" data-tour-id={practice ? 'tutorial-practice-booking' : undefined}>
    {practice ? <div className="tutorial-practice-banner" role="status"><FlaskConical aria-hidden="true" /><div><strong>MODO PRÁCTICA</strong><span>Datos sintéticos y confirmación local. Nada se guarda como cita ni se envía al servidor.</span></div></div> : null}
    <div className="booking-top"><div><span className="eyebrow">{practice ? 'Recorrido seguro del tutorial' : 'Reserva guiada'}</span><h1 ref={headingRef} tabIndex={-1}>{simple ? `Paso ${step + 1}: ${steps[step]}` : `${steps[step]}`}</h1><p>Paso {step + 1} de {steps.length} · {simple ? 'Modo simple' : 'Modo estándar'}</p></div><div className="mode-switch"><label htmlFor="simple-mode"><strong>Modo simple</strong><small>3 pasos agrupados</small></label><span className="toggle"><input id="simple-mode" type="checkbox" checked={simple} onChange={(event) => changeMode(event.target.checked)} /><i /></span></div></div>
    <BookingDictationPanel key={sessionKey} onProposal={handleDictatedProposal} directoryAdapter={directoryAdapter} availabilityAdapter={availabilityAdapter} draft={draft} />
    <ol className="stepper" aria-label="Progreso de la reserva">{steps.map((label, index) => <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}><span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span><small>{label}</small></li>)}</ol>
    <section className="booking-card" aria-live="polite">{error ? <div className="notice notice--error" role="alert"><AlertTriangle aria-hidden="true" />{error}</div> : null}{simple ? <SimpleStep step={step} choices={choiceProps} summary={summary} /> : <StandardStep step={step} choices={choiceProps} summary={summary} />}</section>
    <div className="wizard-actions"><Button variant="ghost" onClick={() => step ? setStep(step - 1) : navigate('/paciente')}><ArrowLeft />{step ? 'Anterior' : 'Salir de la reserva'}</Button>{((simple && step < 2) || (!simple && step < 6)) ? <Button onClick={next}>Continuar <ArrowRight /></Button> : <Button loading={busy} disabled={busy} onClick={submit}>{busy ? 'Confirmando…' : 'Confirmar cita'} <CheckCircle2 /></Button>}</div>
  </div>
}

function usePatientDirectory(adapter: PatientDirectoryAdapter, draftRef: React.RefObject<AppointmentDraft>, updateDraft: (patch: Partial<AppointmentDraft>) => void) {
  const [state, setState] = useState<DirectoryState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    void adapter.load().then((data) => {
      if (!current) return
      const draft = draftRef.current
      const specialty = data.specialties.find((item) => item.id === draft.specialtyId)
      const doctor = data.doctors.find((item) => item.id === draft.doctorId && specialty && item.specialtyIds.includes(specialty.id))
      if (!specialty) updateDraft({ specialtyId: null, doctorId: null, date: null, time: null })
      else if (!doctor && draft.doctorId) updateDraft({ doctorId: null, date: null, time: null })
      setState({ status: 'ready', data })
    }, () => { if (current) setState({ status: 'error' }) })
    return () => { current = false }
  }, [adapter, attempt, draftRef, updateDraft])
  const retry = useCallback(() => { setState({ status: 'loading' }); setAttempt((value) => value + 1) }, [])
  return { state, retry }
}

function usePatientAvailability(adapter: PatientAvailabilityAdapter, draft: AppointmentDraft, draftRef: React.RefObject<AppointmentDraft>, updateDraft: (patch: Partial<AppointmentDraft>) => void) {
  const [state, setState] = useState<SlotsState>({ status: 'idle' })
  const [generation, setGeneration] = useState(0)
  const key = draft.doctorId && draft.specialtyId && draft.date ? `${draft.doctorId}:${draft.specialtyId}:${draft.date}` : null
  const requestKey = key ? `${key}:${generation}` : null
  useEffect(() => {
    if (!draft.doctorId || !draft.specialtyId || !draft.date || !requestKey) return
    const input = { doctorId: draft.doctorId, specialtyId: draft.specialtyId, date: draft.date }
    let current = true
    void adapter.load(input).then((data) => {
      if (!current) return
      const latest = draftRef.current
      if (latest.doctorId !== input.doctorId || latest.specialtyId !== input.specialtyId || latest.date !== input.date) return
      if (latest.time && !data.slots.some((slot) => slot.time === latest.time)) updateDraft({ time: null })
      setState({ status: 'ready', key: requestKey, data })
    }, (error) => {
      if (!current) return
      const code = error instanceof PatientAvailabilityError ? error.code : 'INTERNAL_ERROR'
      setState({ status: 'error', key: requestKey, code })
    })
    return () => { current = false }
  }, [adapter, draft.date, draft.doctorId, draft.specialtyId, draftRef, requestKey, updateDraft])
  const beginRequest = useCallback(() => { setGeneration((value) => value + 1) }, [])
  const visibleState: SlotsState = !requestKey ? { status: 'idle' } : state.status !== 'idle' && state.key === requestKey ? state : { status: 'loading', key: requestKey }
  return { state: visibleState, retry: beginRequest, beginRequest }
}

interface ChoiceProps {
  draft: AppointmentDraft
  directory: ReturnType<typeof usePatientDirectory>
  slots: ReturnType<typeof usePatientAvailability>
  dates: string[]
  practice: boolean
  updateDraft: (patch: Partial<AppointmentDraft>) => void
  specialtyName: (id: string) => string
  onSpecialty: (id: string) => void
  onDoctor: (id: string) => void
  onDate: (date: string) => void
  onTime: (time: string) => void
}

function StandardStep({ step, choices, summary }: { step: number; choices: ChoiceProps; summary: React.ReactNode }) {
  if (step === 0) return <SpecialtyChoice {...choices} />
  if (step === 1) return <DoctorChoice {...choices} />
  if (step === 2) return <DateChoice {...choices} />
  if (step === 3) return <TimeChoice {...choices} />
  if (step === 4) return <ReasonStep {...choices} />
  if (step === 5) return summary
  return <Confirmation practice={choices.practice} />
}
function SimpleStep({ step, choices, summary }: { step: number; choices: ChoiceProps; summary: React.ReactNode }) {
  if (step === 0) return <div className="grouped-step"><SpecialtyChoice {...choices} /><DoctorChoice {...choices} /></div>
  if (step === 1) return <div className="grouped-step"><DateChoice {...choices} /><TimeChoice {...choices} /></div>
  return <div className="grouped-step"><ReasonStep {...choices} />{summary}<Confirmation compact practice={choices.practice} /></div>
}

function StepIntro({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="step-intro"><span>{icon}</span><div><h2>{title}</h2><p>{text}</p></div></div> }
function SpecialtyChoice({ draft, directory, onSpecialty }: ChoiceProps) {
  return <div><StepIntro icon={<HeartPulse />} title="¿Qué tipo de atención buscas?" text="Selecciona una especialidad activa del directorio." />
    {directory.state.status === 'loading' ? <InlineLoading label="Cargando especialidades" /> : null}
    {directory.state.status === 'error' ? <InlineError text="No pudimos cargar las especialidades." onRetry={directory.retry} /> : null}
    {directory.state.status === 'ready' && !directory.state.data.specialties.length ? <InlineEmpty text="Aún no hay especialidades activas." /> : null}
    {directory.state.status === 'ready' && directory.state.data.specialties.length ? <div className="choice-grid">{directory.state.data.specialties.map((item) => <button type="button" key={item.id} className={`choice-card ${draft.specialtyId === item.id ? 'selected' : ''}`} aria-pressed={draft.specialtyId === item.id} onClick={() => onSpecialty(item.id)}><span className="choice-icon"><HeartPulse aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{item.description}</small></span>{draft.specialtyId === item.id ? <Check className="choice-check" aria-hidden="true" /> : null}</button>)}</div> : null}
  </div>
}
function DoctorChoice({ draft, directory, specialtyName, onDoctor }: ChoiceProps) {
  const doctors = directory.state.status === 'ready' ? directory.state.data.doctors.filter((item) => draft.specialtyId && item.specialtyIds.includes(draft.specialtyId)) : []
  return <div><StepIntro icon={<UserRound />} title="Elige un profesional" text={draft.specialtyId ? `Profesionales asociados con ${specialtyName(draft.specialtyId)}.` : 'Primero selecciona una especialidad.'} />
    {!draft.specialtyId ? <InlineEmpty text="Selecciona una especialidad para ver profesionales." /> : null}
    {draft.specialtyId && directory.state.status === 'loading' ? <InlineLoading label="Cargando profesionales" /> : null}
    {draft.specialtyId && directory.state.status === 'error' ? <InlineError text="No pudimos cargar los profesionales." onRetry={directory.retry} /> : null}
    {draft.specialtyId && directory.state.status === 'ready' && !doctors.length ? <InlineEmpty text="No hay profesionales activos para esta especialidad." /> : null}
    {doctors.length ? <div className="choice-grid choice-grid--two">{doctors.map((item) => <button type="button" key={item.id} className={`choice-card doctor-choice ${draft.doctorId === item.id ? 'selected' : ''}`} aria-pressed={draft.doctorId === item.id} onClick={() => onDoctor(item.id)}><span className="avatar">{item.initials}</span><span><strong>{item.name}</strong><small>Consulta horarios después de elegir una fecha</small></span>{draft.doctorId === item.id ? <Check className="choice-check" aria-hidden="true" /> : null}</button>)}</div> : null}
  </div>
}
function DateChoice({ draft, dates, onDate }: ChoiceProps) {
  return <div><StepIntro icon={<CalendarDays />} title="Selecciona una fecha" text="Elige uno de los próximos días en America/Lima. Los horarios se consultan después." /><div className="date-grid">{dates.map((date) => { const parsed = new Date(`${date}T12:00:00Z`); return <button key={date} type="button" className={draft.date === date ? 'selected' : ''} aria-pressed={draft.date === date} onClick={() => onDate(date)}><small>{new Intl.DateTimeFormat('es-PE', { weekday: 'short', timeZone: 'America/Lima' }).format(parsed)}</small><strong>{parsed.getUTCDate()}</strong><span>{new Intl.DateTimeFormat('es-PE', { month: 'short', timeZone: 'America/Lima' }).format(parsed)}</span></button> })}</div></div>
}
function TimeChoice({ draft, slots, onTime, practice }: ChoiceProps) {
  return <div><StepIntro icon={<Clock3 />} title="Elige una hora" text={practice ? 'Horarios sintéticos para completar esta práctica sin consultar agendas reales.' : 'Horarios y duración devueltos por la agenda del servidor en America/Lima.'} />
    {slots.state.status === 'idle' ? <InlineEmpty text="Selecciona profesional y fecha para consultar horarios." /> : null}
    {slots.state.status === 'loading' ? <InlineLoading label="Consultando horarios disponibles" /> : null}
    {slots.state.status === 'error' ? <InlineError text={availabilityMessage(slots.state.code)} onRetry={slots.retry} /> : null}
    {slots.state.status === 'ready' && !slots.state.data.slots.length ? <InlineEmpty text="No hay horarios disponibles para esta fecha. Elige otro día." /> : null}
    {slots.state.status === 'ready' && slots.state.data.slots.length ? <div className="time-grid">{slots.state.data.slots.map((slot) => <button key={slot.time} type="button" className={draft.time === slot.time ? 'selected' : ''} aria-pressed={draft.time === slot.time} onClick={() => onTime(slot.time)}>{slot.time.slice(0, 5)}<small>{slot.durationMinutes} minutos</small></button>)}</div> : null}
  </div>
}
function availabilityMessage(code: AvailabilityErrorCode) {
  if (code === 'UNAUTHORIZED') return 'Tu sesión no permite consultar horarios. Vuelve a iniciar sesión.'
  if (code === 'FORBIDDEN') return 'Tu cuenta no tiene permiso para consultar esta agenda.'
  if (code === 'DOCTOR_NOT_FOUND' || code === 'DOCTOR_INACTIVE' || code === 'INVALID_SPECIALTY' || code === 'INVALID_INPUT') return 'La selección ya no está disponible. Vuelve a elegir especialidad y profesional.'
  return 'No pudimos consultar los horarios. Comprueba tu conexión e inténtalo nuevamente.'
}
function reservationMessage(code: ReservationErrorCode) {
  if (code === 'UNAUTHORIZED') return 'Tu sesión no permite confirmar la cita. Vuelve a iniciar sesión antes de intentarlo nuevamente.'
  if (code === 'FORBIDDEN') return 'Tu cuenta no tiene permiso de Paciente para reservar esta cita.'
  if (code === 'DOCTOR_NOT_FOUND' || code === 'DOCTOR_INACTIVE' || code === 'INVALID_SPECIALTY') return 'La selección ya no está disponible. Vuelve a elegir especialidad y profesional.'
  if (code === 'INVALID_INPUT') return 'No pudimos confirmar porque la selección o el motivo ya no son válidos. Revisa los datos e inténtalo nuevamente.'
  return 'No pudimos confirmar la cita. Comprueba tu conexión y revisa el estado antes de volver a intentarlo.'
}
function InlineLoading({ label }: { label: string }) { return <div className="empty-inline" role="status"><LoaderCircle aria-hidden="true" /><p>{label}…</p></div> }
function InlineError({ text, onRetry }: { text: string; onRetry: () => void }) { return <div className="empty-inline" role="alert"><AlertTriangle aria-hidden="true" /><p>{text}</p><Button variant="secondary" onClick={onRetry}>Reintentar</Button></div> }
function InlineEmpty({ text }: { text: string }) { return <div className="empty-inline" role="status"><Stethoscope aria-hidden="true" /><p>{text}</p></div> }
function ReasonStep({ draft, updateDraft, practice }: ChoiceProps) { const appendReason = (text: string) => updateDraft({ reason: `${draft.reason.trim()}${draft.reason.trim() ? ' ' : ''}${text}`.slice(0, 280) }); return <div><StepIntro icon={<FlaskConical />} title="Motivo de consulta" text={practice ? 'Este texto es temporal y se eliminará al salir de la práctica.' : 'Este campo es opcional. Solo se enviará al servidor cuando confirmes la cita.'} /><div className="field"><div className="field-label-row"><label htmlFor="reason">Cuéntanos brevemente (opcional)</label><DictationButton label="motivo de consulta" onTranscript={appendReason} /></div><textarea id="reason" value={draft.reason} onChange={(event) => updateDraft({ reason: event.target.value.slice(0, 280) })} rows={4} maxLength={280} /><small>{draft.reason.length}/280 · Usa únicamente datos ficticios en este entorno de pruebas.</small></div>{practice ? <div className="notice notice--neutral"><strong>Selector corporal omitido en práctica.</strong> No se modifica ninguna selección de tu reserva real.</div> : <BodySelector />}<div className="notice notice--neutral"><strong>Esto no es una evaluación médica.</strong> Si consideras que es una urgencia, acude a los servicios de emergencia de tu localidad.</div></div> }
function Summary({ draft, specialtyName, doctorName, duration, practice }: { draft: AppointmentDraft; specialtyName: (id: string) => string; doctorName: (id: string) => string; duration?: number; practice: boolean }) { const { bodySelection } = useBooking(); return <div><StepIntro icon={<CheckCircle2 />} title="Revisa tu selección" text={practice ? 'Esta confirmación termina la práctica local; no crea una cita.' : 'La cita no se crea al abrir este resumen. Debes confirmarla explícitamente.'} /><dl className="summary-list"><SummaryRow label="Especialidad" value={draft.specialtyId ? specialtyName(draft.specialtyId) : 'Sin seleccionar'} /><SummaryRow label="Profesional" value={draft.doctorId ? doctorName(draft.doctorId) : 'Sin seleccionar'} /><SummaryRow label="Fecha" value={draft.date ? formatDate(draft.date) : 'Sin seleccionar'} /><SummaryRow label="Hora" value={draft.time ? `${draft.time.slice(0, 5)}${duration ? ` · ${duration} minutos` : ''}` : 'Sin seleccionar'} /><SummaryRow label="Motivo opcional" value={draft.reason || 'No indicado'} /><SummaryRow label="Zonas seleccionadas" value={practice ? 'No se usa en la práctica' : bodySelection.regions.length ? `${bodySelection.regions.length} zona(s) · no se enviarán al servidor` : 'Ninguna'} /></dl></div> }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div> }
function Confirmation({ compact = false, practice = false }: { compact?: boolean; practice?: boolean }) { return <div className={`confirmation-box ${compact ? 'confirmation-box--compact' : ''}`}><CheckCircle2 /><div><h2>Todo listo para confirmar</h2><p>{practice ? 'Al continuar, verás un resultado local de práctica. No se consultará ni modificará el servidor.' : <>Al continuar, el servidor volverá a validar el horario y creará una cita <strong>Confirmada</strong> de forma atómica.</>}</p></div></div> }
function Success({ appointment, onNew, practice }: { appointment: PatientReservationData; onNew: () => void; practice: boolean }) { return <section className="booking-success" data-tour-id={practice ? 'tutorial-practice-booking' : undefined}><div className="success-orb"><CheckCircle2 /></div><span className="eyebrow">{practice ? 'Práctica completada' : 'Reserva registrada'}</span><h1>{practice ? 'La simulación terminó correctamente' : 'Tu cita está confirmada'}</h1><p>{practice ? 'Este resultado existe solo en memoria y se eliminará al continuar el tutorial.' : `El servidor registró la cita con una duración de ${appointment.durationMinutes} minutos.`}</p>{practice ? <div className="notice notice--success"><strong>No se creó ninguna cita real.</strong> Continúa usando la navegación resaltada por la guía.</div> : <StatusBadge status={appointment.status} />}<div className="mock-code"><small>{practice ? 'Código local' : 'Código de reserva'}</small><strong>{appointment.code}</strong><small>{practice ? 'Sin identificador remoto' : `Identificador de cita: ${appointment.id}`}</small></div>{practice ? null : <div className="button-row"><ButtonLink to="/paciente">Volver al inicio</ButtonLink><Button variant="secondary" onClick={onNew}>Crear otra cita</Button></div>}</section> }
