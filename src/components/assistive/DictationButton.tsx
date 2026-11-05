import { CircleStop, Mic, MicOff } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { getSpeechRecognitionConstructor, type RecognitionLike } from '../../features/voice/speechRecognition'

type DictationFormat = 'plain' | 'email'

interface DictationButtonProps {
  label: string
  onTranscript?: (text: string) => void
  targetId?: string
  append?: boolean
  format?: DictationFormat
}

function formatTranscript(transcript: string, format: DictationFormat) {
  const clean = transcript.trim()
  if (format !== 'email') return clean
  return clean.toLowerCase().replace(/\s+arroba\s+/g, '@').replace(/\s+punto\s+/g, '.').replace(/\s+/g, '')
}

function writeToTarget(targetId: string, transcript: string, append: boolean) {
  const target = document.getElementById(targetId)
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return
  const next = append && target.value.trim() ? `${target.value.trim()} ${transcript}` : transcript
  const prototype = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(target, next)
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.focus()
}

export function DictationButton({ label, onTranscript, targetId, append = false, format = 'plain' }: DictationButtonProps) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'error'>('idle')
  const recognitionRef = useRef<RecognitionLike | null>(null)
  const statusId = useId()
  const Recognition = useMemo(() => getSpeechRecognitionConstructor(), [])

  const stop = useCallback(() => { recognitionRef.current?.stop(); setStatus('idle') }, [])
  const start = useCallback(() => {
    if (status === 'listening') { stop(); return }
    if (!Recognition) { setStatus('error'); return }
    const recognition = new Recognition()
    recognition.lang = 'es-PE'; recognition.continuous = false; recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = formatTranscript(event.results[0][0].transcript, format)
      if (onTranscript) onTranscript(transcript)
      else if (targetId) writeToTarget(targetId, transcript, append)
    }
    recognition.onerror = () => setStatus('error')
    recognition.onend = () => setStatus('idle')
    recognitionRef.current = recognition
    setStatus('listening')
    try { recognition.start() } catch { setStatus('error') }
  }, [Recognition, append, format, onTranscript, status, stop, targetId])

  useEffect(() => () => {
    const recognition = recognitionRef.current
    if (!recognition) return
    recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.stop()
  }, [])

  const accessibleLabel = status === 'listening' ? `Detener dictado de ${label}` : `Dictar ${label}`
  return <>
    <button type="button" className={`dictation-button ${status === 'listening' ? 'is-listening' : ''}`} onClick={start} aria-label={accessibleLabel} aria-describedby={statusId} aria-pressed={status === 'listening' ? true : undefined} title="Dictar con el micrófono del navegador">
      {status === 'listening' ? <CircleStop aria-hidden="true" /> : Recognition ? <Mic aria-hidden="true" /> : <MicOff aria-hidden="true" />}
    </button>
    <span id={statusId} className="sr-only" role="status" aria-live="polite">{status === 'listening' ? `Escuchando ${label}` : status === 'error' ? 'El dictado no está disponible. Puedes seguir escribiendo.' : ''}</span>
  </>
}
