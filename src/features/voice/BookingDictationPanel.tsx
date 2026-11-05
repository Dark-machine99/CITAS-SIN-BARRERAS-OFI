import { ChevronDown, ChevronUp, CircleStop, Keyboard, Mic, MicOff, Send, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useBooking } from '../../app/providers/BookingProvider'
import { Button } from '../../components/ui/Button'
import type { PatientAvailabilityAdapter } from '../../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryAdapter } from '../../services/supabase/patientDirectoryAdapter'
import type { AppointmentDraft } from '../../types/domain'
import { resolveBookingRequest } from './bookingDictation'
import { getSpeechRecognitionConstructor, type RecognitionLike } from './speechRecognition'

export function BookingDictationPanel({ onProposal, directoryAdapter, availabilityAdapter, draft: providedDraft }: {
  onProposal: (draft: AppointmentDraft, ready: boolean) => void
  directoryAdapter?: PatientDirectoryAdapter
  availabilityAdapter?: PatientAvailabilityAdapter
  draft?: AppointmentDraft
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('Describe la cita y prepararé una propuesta para que la revises.')
  const [decisions, setDecisions] = useState<string[]>([])
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const requestVersion = useRef(0)
  const active = useRef(true)
  const Recognition = useMemo(() => getSpeechRecognitionConstructor(), [])
  const { draft: liveDraft } = useBooking()
  const draft = providedDraft ?? liveDraft

  useEffect(() => () => {
    active.current = false
    requestVersion.current += 1
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    try { recognition.stop() } catch { /* El navegador puede haber cerrado ya la sesión. */ }
  }, [])

  const prepare = useCallback(async (raw: string) => {
    if (!active.current) return
    if (!raw.trim()) { setMessage('Escribe o dicta una solicitud antes de continuar.'); return }
    const version = ++requestVersion.current
    setProcessing(true)
    setInput(raw.trim())
    setMessage('Consultando profesionales y horarios disponibles…')
    const result = await resolveBookingRequest(raw, draft, { directoryAdapter, availabilityAdapter })
    if (!active.current || version !== requestVersion.current) return
    setProcessing(false)
    if (result.status === 'proposal') {
      setMessage(`${result.proposal.summary} Revisa el resumen y confirma con el botón visible.`)
      setDecisions(result.proposal.decisions)
      onProposal(result.proposal.draft, true)
      return
    }
    setMessage(result.message)
    setDecisions('options' in result ? result.options.map((option) => `Opción: ${option}`) : [])
    onProposal(result.draft, false)
  }, [availabilityAdapter, directoryAdapter, draft, onProposal])

  const listen = useCallback(() => {
    if (!Recognition) { setMessage('Este navegador no ofrece dictado. Puedes escribir la solicitud en el mismo campo.'); return }
    const recognition = new Recognition()
    recognition.lang = 'es-PE'; recognition.continuous = false; recognition.interimResults = false
    recognition.onresult = (event) => void prepare(event.results[0][0].transcript)
    recognition.onerror = () => { setListening(false); setMessage('No pude usar el micrófono. Revisa el permiso del navegador o escribe la solicitud.') }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try { recognition.start(); setListening(true); setMessage('Escuchando tu solicitud…') } catch { setMessage('El micrófono está ocupado o no está disponible.') }
  }, [Recognition, prepare])

  const submit = (event: FormEvent) => { event.preventDefault(); void prepare(input) }

  return <section className={`booking-dictation ${open ? 'is-open' : ''}`} aria-labelledby="booking-dictation-title">
    <button type="button" className="booking-dictation__toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className="booking-dictation__icon"><Sparkles aria-hidden="true" /></span>
      <span><strong id="booking-dictation-title">Reserva asistida por voz</strong><small>Di especialidad, fecha, periodo y motivo; luego revisa la propuesta.</small></span>
      {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
    </button>
    {open ? <div className="booking-dictation__body">
      <form className="booking-dictation__form" onSubmit={submit}>
        <label htmlFor="booking-dictation-input"><Keyboard aria-hidden="true" /> Tu solicitud</label>
        <div>
          <input id="booking-dictation-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ej.: reservar cita mañana por la tarde de cardiología por dolor de cabeza" autoComplete="off" />
          <Button type="submit" loading={processing} disabled={processing}><Send />{processing ? 'Consultando' : 'Preparar'}</Button>
          <Button type="button" variant="secondary" disabled={processing} onClick={listening ? () => recognitionRef.current?.stop() : listen}>{listening ? <CircleStop /> : Recognition ? <Mic /> : <MicOff />}{listening ? 'Detener' : 'Dictar solicitud'}</Button>
        </div>
      </form>
      <div className="booking-dictation__result" role="status" aria-live="polite"><strong>{message}</strong>{decisions.length ? <details><summary>Cómo preparé la propuesta</summary><ul>{decisions.map((decision) => <li key={decision}>{decision}</li>)}</ul></details> : null}</div>
    </div> : null}
  </section>
}
