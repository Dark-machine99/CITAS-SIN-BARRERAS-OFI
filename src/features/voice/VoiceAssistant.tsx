import { CircleStop, HelpCircle, Keyboard, Mic, MicOff, RotateCcw, Send, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAccessibility } from '../../app/providers/AccessibilityProvider'
import { useBooking } from '../../app/providers/BookingProvider'
import { useDemoSession } from '../../app/providers/DemoSessionProvider'
import { Button } from '../../components/ui/Button'
import type { PatientAvailabilityAdapter } from '../../services/supabase/patientAvailabilityAdapter'
import type { PatientDirectoryAdapter } from '../../services/supabase/patientDirectoryAdapter'
import type { ReservationErrorCode } from '../../services/supabase/patientReservationAdapter'
import { looksLikeFullBookingRequest, resolveBookingRequest } from './bookingDictation'
import { getSpeechRecognitionConstructor, type RecognitionLike } from './speechRecognition'
import { parseVoiceCommand } from './voiceCommands'

type VoiceStatus = 'inactive' | 'requesting' | 'listening' | 'processing' | 'responding' | 'error'
type VoiceAssistantProps = {
  directoryAdapter?: PatientDirectoryAdapter
  availabilityAdapter?: PatientAvailabilityAdapter
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function VoiceAssistant({ directoryAdapter, availabilityAdapter, open: controlledOpen, onOpenChange }: VoiceAssistantProps = {}) {
  const [localOpen, setLocalOpen] = useState(false)
  const open = controlledOpen ?? localOpen
  const [status, setStatus] = useState<VoiceStatus>('inactive')
  const [input, setInput] = useState('')
  const [response, setResponse] = useState('Di “ayuda” para conocer los comandos disponibles.')
  const [history, setHistory] = useState<{ command: string; response: string }[]>([])
  const [readResponses, setReadResponses] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const recognitionVersion = useRef(0)
  const requestVersion = useRef(0)
  const pendingVoiceConfirmation = useRef(false)
  const panelId = useId()
  const navigate = useNavigate()
  const { draft, updateDraft, confirm } = useBooking()
  const { role } = useDemoSession()
  const { update: updateAccessibility } = useAccessibility()
  const Recognition = useMemo(() => getSpeechRecognitionConstructor(), [])

  const changeOpen = useCallback((nextOpen: boolean) => {
    if (controlledOpen === undefined) setLocalOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }, [controlledOpen, onOpenChange])

  const speak = useCallback((text: string) => {
    if (!readResponses || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'es-PE'; utterance.rate = .95
    window.speechSynthesis.speak(utterance)
  }, [readResponses])
  const respond = useCallback((command: string, message: string, hideCommand = false) => {
    setResponse(message); setStatus('responding'); speak(message)
    setHistory((current) => [{ command: hideCommand ? 'Solicitud de reserva (contenido no guardado)' : command, response: message }, ...current].slice(0, 5))
  }, [speak])

  const prepareBooking = useCallback(async (command: string) => {
    const version = ++requestVersion.current
    const result = await resolveBookingRequest(command, draft, { directoryAdapter, availabilityAdapter })
    if (version !== requestVersion.current) return
    setInput('')
    if (result.status === 'proposal') {
      updateDraft(result.proposal.draft)
      pendingVoiceConfirmation.current = true
      navigate('/paciente/reservar?voice=review')
      respond(command, `${result.proposal.summary} La propuesta está lista para revisión. Di “confirmar cita” como segunda orden o usa el botón visible.`, true)
      return
    }
    updateDraft(result.draft)
    pendingVoiceConfirmation.current = false
    const options = 'options' in result && result.options.length ? ` Opciones: ${result.options.join(', ')}.` : ''
    respond(command, `${result.message}${options}`, true)
  }, [availabilityAdapter, directoryAdapter, draft, navigate, respond, updateDraft])

  const execute = useCallback(async (raw: string) => {
    const command = raw.trim()
    if (!command) return
    setStatus('processing')
    const intent = parseVoiceCommand(command, role ?? 'patient')
    if (role !== 'doctor' && role !== 'admin' && looksLikeFullBookingRequest(command)) {
      await prepareBooking(command)
      return
    }
    setInput('')
    if (intent.type === 'navigate') { navigate(intent.path); respond(command, `Abriendo ${intent.label}.`); return }
    if (intent.type === 'booking') { navigate('/paciente/reservar'); respond(command, 'Abriendo Reservar para que elijas especialidad, profesional, fecha y hora.'); return }
    if (intent.type === 'accessibility') { updateAccessibility(intent.patch); respond(command, `${intent.label} ${Object.values(intent.patch)[0] === false ? 'desactivado' : 'activado'}.`); return }
    if (role === 'doctor' || role === 'admin') {
      if (intent.type === 'repeat') { speak(response); setStatus('responding'); return }
      if (intent.type === 'stop') { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); setStatus('inactive'); setResponse('Asistente detenido.'); return }
      if (intent.type === 'help') { respond(command, role === 'doctor' ? 'Puedes decir “abrir agenda” o activar una ayuda de accesibilidad.' : 'Puedes abrir resumen, profesionales, especialidades, horarios, citas o usuarios. Las acciones administrativas requieren control manual.'); return }
      respond(command, 'Por seguridad, la voz no ejecuta cambios médicos ni administrativos. Usa los controles visibles para confirmar la acción.')
      return
    }
    if (intent.type === 'reason') { updateDraft({ reason: intent.reason }); pendingVoiceConfirmation.current = false; respond(command, 'Guardé el motivo opcional. Completa la selección antes de confirmar.', true); return }
    if (intent.type === 'body') { respond(command, `No marqué la zona ${intent.label}. Usa el selector corporal visible.`); return }
    if (intent.type === 'confirm') {
      const complete = draft.specialtyId && draft.doctorId && draft.date && draft.time
      if (!pendingVoiceConfirmation.current || !complete) {
        respond(command, 'No confirmé la cita. Primero prepara una propuesta completa y revísala en pantalla.')
        return
      }
      const result = await confirm()
      if (!result.ok) {
        if (result.code === 'SLOT_UNAVAILABLE') updateDraft({ time: null })
        pendingVoiceConfirmation.current = false
        respond(command, reservationMessage(result.code))
        return
      }
      pendingVoiceConfirmation.current = false
      navigate(`/paciente/citas/${result.appointment.id}`)
      respond(command, `Cita confirmada con código ${result.appointment.code}.`)
      return
    }
    if (intent.type === 'cancel') { requestVersion.current += 1; pendingVoiceConfirmation.current = false; respond(command, 'No cancelé ninguna cita ni reserva. Usa el control visible para esa acción.'); return }
    if (intent.type === 'repeat') { speak(response); setStatus('responding'); return }
    if (intent.type === 'stop') { recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); setStatus('inactive'); setResponse('Asistente detenido.'); return }
    if (intent.type === 'help') { respond(command, 'Prueba: “reservar cita de cardiología con doctora Torres mañana a las nueve y treinta”, “ir a mis citas” o “activar lupa”. La primera orden prepara una propuesta; confirmar requiere una segunda acción explícita.'); return }
    respond(command, 'No entendí el comando. Prueba “ayuda” o escríbelo de otra forma.')
  }, [confirm, draft, navigate, prepareBooking, respond, response, role, speak, updateAccessibility, updateDraft])

  const startListening = useCallback(() => {
    if (!Recognition) { setStatus('error'); setResponse('Este navegador no ofrece reconocimiento de voz. Puedes escribir el comando.'); return }
    setStatus('requesting')
    const version = ++recognitionVersion.current
    const recognition = new Recognition(); recognition.lang = 'es-PE'; recognition.continuous = false; recognition.interimResults = false
    recognition.onresult = (event) => { if (version === recognitionVersion.current) void execute(event.results[0][0].transcript) }
    recognition.onerror = () => { if (version === recognitionVersion.current) { setStatus('error'); setResponse('No pude usar el micrófono. Revisa el permiso o utiliza el comando escrito.') } }
    recognition.onend = () => { if (version === recognitionVersion.current) setStatus((current) => current === 'listening' ? 'inactive' : current) }
    recognitionRef.current = recognition
    try { recognition.start(); setStatus('listening') } catch { setStatus('error'); setResponse('El micrófono ya está ocupado o no está disponible.') }
  }, [Recognition, execute])
  const stopRecognition = useCallback(() => {
    recognitionVersion.current += 1
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    recognition.onresult = null
    recognition.onerror = null
    recognition.onend = null
    recognition.stop()
  }, [])
  const close = useCallback(() => {
    requestVersion.current += 1
    pendingVoiceConfirmation.current = false
    stopRecognition()
    window.speechSynthesis?.cancel()
    setInput('')
    setStatus('inactive')
    changeOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }, [changeOpen, stopRecognition])
  const submit = (event: FormEvent) => { event.preventDefault(); void execute(input) }
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, open])
  useEffect(() => {
    if (!open) stopRecognition()
  }, [open, stopRecognition])
  useEffect(() => () => {
    requestVersion.current += 1
    pendingVoiceConfirmation.current = false
    stopRecognition()
    window.speechSynthesis?.cancel()
  }, [stopRecognition])

  return <>
    <button ref={triggerRef} type="button" className={`assistive-trigger voice-trigger ${status === 'listening' ? 'is-listening' : ''}`} onClick={() => open ? close() : changeOpen(true)} aria-label={open ? 'Cerrar asistente por voz' : 'Abrir asistente por voz'} aria-expanded={open} aria-controls={panelId}><Mic aria-hidden="true" /><span>Voz</span></button>
    {open ? <section id={panelId} className="voice-popover" role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}>
      <header className="voice-popover__header"><div><span className="eyebrow">Control rápido</span><h2 id={`${panelId}-title`}>Asistente de voz</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Cerrar asistente"><X aria-hidden="true" /></button></header>
      <div className={`voice-status voice-status--${status}`} role="status" aria-live="polite"><span className="voice-pulse"><Mic aria-hidden="true" /></span><div><strong>{status === 'listening' ? 'Escuchando…' : status === 'processing' ? 'Procesando…' : status === 'error' ? 'Necesito atención' : 'Asistente disponible'}</strong><p>{response}</p></div></div>
      <div className="voice-actions"><Button type="button" onClick={startListening} disabled={status === 'listening' || status === 'processing'}>{Recognition ? <Mic /> : <MicOff />}{status === 'listening' ? 'Escuchando' : 'Hablar'}</Button><Button type="button" variant="secondary" onClick={() => { stopRecognition(); setStatus('inactive') }}><CircleStop />Detener</Button><Button type="button" variant="ghost" onClick={() => void execute('ayuda')}><HelpCircle />Ayuda</Button></div>
      <form className="voice-command-form" onSubmit={submit}><label htmlFor="voice-command"><Keyboard />Comando escrito</label><div><input id="voice-command" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ej.: reservar cardiología mañana a las nueve" autoComplete="off" /><Button type="submit" loading={status === 'processing'} aria-label="Ejecutar comando"><Send /></Button></div></form>
      <button type="button" className="voice-read" aria-pressed={readResponses} onClick={() => setReadResponses((current) => !current)}><Volume2 />{readResponses ? 'Lectura de respuestas activada' : 'Leer respuestas en voz alta'}</button>
      {history.length ? <details className="voice-history"><summary>Historial de esta sesión ({history.length})</summary><div><button type="button" onClick={() => setHistory([])}><RotateCcw />Limpiar</button></div><ol>{history.map((item, index) => <li key={`${item.command}-${index}`}><strong>{item.command}</strong><span>{item.response}</span></li>)}</ol></details> : null}
      <p className="voice-privacy">Al pulsar “Hablar”, el navegador puede solicitar permiso. Sin escucha continua ni almacenamiento de audio o transcripciones.</p>
    </section> : null}
  </>
}

function reservationMessage(code: ReservationErrorCode) {
  if (code === 'SLOT_UNAVAILABLE') return 'Ese horario dejó de estar disponible. Conservé la propuesta para que elijas otra hora.'
  if (code === 'UNAUTHORIZED') return 'Tu sesión no permite confirmar. Vuelve a iniciar sesión.'
  if (code === 'FORBIDDEN') return 'Tu cuenta no tiene permiso de Paciente para reservar.'
  if (code === 'INVALID_INPUT') return 'La propuesta ya no es válida. Revísala antes de intentarlo nuevamente.'
  return 'No pude confirmar la cita. Comprueba tu conexión y revisa el estado antes de volver a intentarlo.'
}
