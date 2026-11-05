import { useCallback, useState } from 'react'
import { AccessibilityDock } from '../../features/accessibility/AccessibilityDock'
import { VoiceAssistant } from '../../features/voice/VoiceAssistant'

type ActiveOverlay = 'accessibility' | 'voice' | null

export function AssistiveDock() {
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null)
  const setAccessibilityOpen = useCallback((open: boolean) => {
    setActiveOverlay((current) => open ? 'accessibility' : current === 'accessibility' ? null : current)
  }, [])
  const setVoiceOpen = useCallback((open: boolean) => {
    setActiveOverlay((current) => open ? 'voice' : current === 'voice' ? null : current)
  }, [])

  return <div className="assistive-dock" role="group" aria-label="Herramientas de asistencia">
    <AccessibilityDock open={activeOverlay === 'accessibility'} onOpenChange={setAccessibilityOpen} />
    <VoiceAssistant open={activeOverlay === 'voice'} onOpenChange={setVoiceOpen} />
  </div>
}
