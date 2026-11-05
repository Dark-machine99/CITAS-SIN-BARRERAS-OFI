import { CircleStop, Keyboard, Mic, MicOff, Send } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { patientTutorialAvailabilityAdapter, patientTutorialDirectoryAdapter } from '../../services/tutorial/patientTutorialBookingAdapter'
import type { AppointmentDraft } from '../../types/domain'
import { looksLikeFullBookingRequest, resolveBookingRequest } from '../voice/bookingDictation'
import { getSpeechRecognitionConstructor, type RecognitionLike } from '../voice/speechRecognition'
import { parseVoiceCommand } from '../voice/voiceCommands'

const emptyDraft: AppointmentDraft = { specialtyId: null, doctorId: null, date: null, time: null, reason: '' }

export function PatientTutorialVoicePractice({ kind, onComplete }: {
  kind: 'voice-navigation' | 'voice-booking'
  onComplete: () => void
}) {
  const [input, setInput] = useState('')
  const [message, setMessage] = useState(kind === 'voice-navigation'
    ? 'Prueba con “ir a mis citas”.'
    : 'Prueba con “reservar una cita de medicina general mañana a las 9 por control”.')
  const [decisions, setDecisions] = useState<string[]>([])
  const [listening, setListening] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [complete, setComplete] = useState(false)
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const requestVersion = useRef(0)
  const Recognition = useMemo(() => getSpeechRecognitionConstructor(), [])

  useEffect(() => () => {
    requestVersion.current += 1
    recognitionRef.current?.stop()
    recognitionRef.current = null
  }, [])

  const evaluate = useCallback(async (raw: string) => {
    const text = raw.trim()
    setInput(text)
    setDecisions([])
    setComplete(false)
    if (!text) { setMessage('Escribe o dicta un comando antes de continuar.'); return }
    if (kind === 'voice-navigation') {
      const intent = parseVoiceCommand(text, 'patient')
      if (intent.type === 'navigate' && intent.path === '/paciente/citas') {
        setMessage('Comando reconocido: abrir Mis citas. En la práctica no cambiamos de ruta.')
        setComplete(true)
      } else {
        setMessage('No reconocí “Mis citas”. Prueba exactamente con “ir a mis citas”.')
      }
      return
    }
    if (!looksLikeFullBookingRequest(text)) {
      setMessage('Incluye la acción de reservar, la especialidad y una fecha u hora.')
      return
    }
    const version = ++requestVersion.current
    setProcessing(true)
    setMessage('Resolviendo la solicitud con datos sintéticos…')
    const result = await resolveBookingRequest(text, emptyDraft, {
      directoryAdapter: patientTutorialDirectoryAdapter,
      availabilityAdapter: patientTutorialAvailabilityAdapter,
    })
    if (version !== requestVersion.current) return
    setProcessing(false)
    if (result.status === 'proposal') {
      setMessage(`${result.proposal.summary} Esta propuesta no modificó ningún borrador.`)
      setDecisions(result.proposal.decisions)
      setComplete(true)
      return
    }
    setMessage(result.message)
    setDecisions('options' in result ? result.options : [])
  }, [kind])

  const listen = useCallback(() => {
    if (!Recognition) { setMessage('Este navegador no ofrece reconocimiento de voz. Puedes escribir el comando.'); return }
    const recognition = new Recognition()
    recognition.lang = 'es-PE'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => void evaluate(event.results[0][0].transcript)
    recognition.onerror = () => { setListening(false); setMessage('No pude usar el micrófono. Revisa el permiso o escribe el comando.') }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try { recognition.start(); setListening(true); setMessage('Escuchando…') } catch { setMessage('El micrófono está ocupado o no está disponible.') }
  }, [Recognition, evaluate])

  const submit = (event: FormEvent) => { event.preventDefault(); void evaluate(input) }

  return <div className="tutorial-voice-practice">
    <form onSubmit={submit}>
      <label htmlFor={`tutorial-voice-${kind}`}><Keyboard aria-hidden="true" /> Comando de práctica</label>
      <input id={`tutorial-voice-${kind}`} value={input} onChange={(event) => setInput(event.target.value)} autoComplete="off" placeholder={kind === 'voice-navigation' ? 'ir a mis citas' : 'reservar una cita de medicina general mañana a las 9'} />
      <div className="tutorial-voice-practice__actions">
        <Button type="submit" variant="secondary" loading={processing} disabled={processing}><Send aria-hidden="true" />Probar texto</Button>
        <Button type="button" variant="ghost" disabled={processing} onClick={listening ? () => recognitionRef.current?.stop() : listen}>{listening ? <CircleStop aria-hidden="true" /> : Recognition ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}{listening ? 'Detener' : 'Hablar'}</Button>
      </div>
    </form>
    <div className={`tutorial-voice-practice__result${complete ? ' is-complete' : ''}`} role="status" aria-live="polite"><strong>{message}</strong>{decisions.length ? <ul>{decisions.map((decision) => <li key={decision}>{decision}</li>)}</ul> : null}</div>
    {complete ? <Button onClick={onComplete}>Continuar tutorial</Button> : null}
  </div>
}
