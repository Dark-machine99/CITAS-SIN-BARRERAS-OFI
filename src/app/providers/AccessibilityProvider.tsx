import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { Magnifier } from '../../features/accessibility/Magnifier'
import { useOptionalAuth } from './AuthProvider'
import type { AccessibilityPreferencesUpdate } from '../../services/supabase/patientAccountAdapter'

export type AccessibilityPreset = 'standard' | 'low-vision' | 'reduced-mobility' | 'colorblind' | 'focus' | 'older-adult' | 'custom'
export type TextScale = 'small' | 'normal' | 'large'
export interface AccessibilityPreferences {
  preset: AccessibilityPreset
  textScale: TextScale
  highContrast: boolean
  largeCursor: boolean
  reducedMotion: boolean
  simpleMode: boolean
  magnifier: boolean
  readingGuide: boolean
  colorReinforcement: boolean
}

export const defaultAccessibilityPreferences: AccessibilityPreferences = { preset: 'standard', textScale: 'normal', highContrast: false, largeCursor: false, reducedMotion: false, simpleMode: false, magnifier: false, readingGuide: false, colorReinforcement: false }
export const accessibilityPresets: Record<AccessibilityPreset, Partial<AccessibilityPreferences>> = {
  standard: defaultAccessibilityPreferences,
  'low-vision': { textScale: 'large', highContrast: true, largeCursor: true, magnifier: true },
  'reduced-mobility': { largeCursor: true, reducedMotion: true, simpleMode: true },
  colorblind: { colorReinforcement: true },
  focus: { simpleMode: true, reducedMotion: true, readingGuide: true },
  'older-adult': { textScale: 'large', largeCursor: true, simpleMode: true },
  custom: {},
}

export function preferencesForPreset(preset: AccessibilityPreset): AccessibilityPreferences {
  return { ...defaultAccessibilityPreferences, ...accessibilityPresets[preset], preset }
}

export function toAccessibilityPreferencesUpdate(preferences: AccessibilityPreferences): AccessibilityPreferencesUpdate {
  return {
    preset: preferences.preset,
    font_scale: preferences.textScale === 'large' ? 1.25 : preferences.textScale === 'small' ? .875 : 1,
    high_contrast: preferences.highContrast,
    large_cursor: preferences.largeCursor,
    reduced_motion: preferences.reducedMotion,
    simple_mode: preferences.simpleMode,
    magnifier_enabled: preferences.magnifier,
    guided_reading: preferences.readingGuide,
    colorblind_mode: preferences.colorReinforcement,
  }
}

interface AccessibilityContextValue {
  preferences: AccessibilityPreferences
  update: (patch: Partial<AccessibilityPreferences>) => void
  applyPreset: (preset: AccessibilityPreset) => void
  systemReducedMotion: boolean
  effectiveReducedMotion: boolean
  persistence: 'local' | 'saved' | 'saving' | 'error'
  persistenceError: string | null
  save: () => Promise<void>
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null)

export function AccessibilityProvider({ children }: PropsWithChildren) {
  const auth = useOptionalAuth()
  const [preferences, setPreferences] = useState(defaultAccessibilityPreferences)
  const [systemReducedMotion, setSystemReducedMotion] = useState(false)
  const [persistence, setPersistence] = useState<AccessibilityContextValue['persistence']>('local')
  const [persistenceError, setPersistenceError] = useState<string | null>(null)

  useLayoutEffect(() => {
    if (!auth?.storedPreferences) return
    const stored = auth.storedPreferences
    const preset = Object.hasOwn(accessibilityPresets, stored.preset) ? stored.preset as AccessibilityPreset : 'custom'
    const textScale: TextScale = stored.font_scale >= 1.2 ? 'large' : stored.font_scale < 1 ? 'small' : 'normal'
    const timer = window.setTimeout(() => {
      setPreferences({
        preset,
        textScale,
        highContrast: stored.high_contrast,
        largeCursor: stored.large_cursor,
        reducedMotion: stored.reduced_motion,
        simpleMode: stored.simple_mode,
        magnifier: stored.magnifier_enabled,
        readingGuide: stored.guided_reading,
        colorReinforcement: stored.colorblind_mode,
      })
      setPersistence('saved')
      setPersistenceError(null)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [auth?.storedPreferences])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setSystemReducedMotion(media.matches)
    sync(); media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.textScale = preferences.textScale
    root.dataset.contrast = preferences.highContrast ? 'high' : 'normal'
    root.dataset.cursor = preferences.largeCursor ? 'large' : 'normal'
    root.dataset.readingGuide = preferences.readingGuide ? 'on' : 'off'
    root.dataset.colorReinforcement = preferences.colorReinforcement ? 'on' : 'off'
    root.dataset.reduceMotion = preferences.reducedMotion || systemReducedMotion ? 'on' : 'off'
  }, [preferences, systemReducedMotion])

  const update = useCallback((patch: Partial<AccessibilityPreferences>) => {
    setPreferences((current) => ({ ...current, ...patch, preset: patch.preset ?? 'custom' }))
    setPersistence('local')
  }, [])
  const applyPreset = useCallback((preset: AccessibilityPreset) => {
    setPreferences(preferencesForPreset(preset))
    setPersistence('local')
  }, [])
  const save = useCallback(async () => {
    if (!auth?.session) {
      const message = 'Debes iniciar sesión para guardar estas preferencias en tu cuenta.'
      setPersistenceError(message)
      setPersistence('error')
      throw new Error(message)
    }
    setPersistence('saving'); setPersistenceError(null)
    const update = toAccessibilityPreferencesUpdate(preferences)
    try { await auth.updateStoredPreferences(update); setPersistence('saved') }
    catch (nextError) { setPersistenceError(nextError instanceof Error ? nextError.message : 'No se pudieron guardar las preferencias.'); setPersistence('error'); throw nextError }
  }, [auth, preferences])
  const value = useMemo<AccessibilityContextValue>(() => ({
    preferences,
    update,
    applyPreset,
    systemReducedMotion,
    effectiveReducedMotion: systemReducedMotion || preferences.reducedMotion,
    persistence,
    persistenceError,
    save,
  }), [applyPreset, persistence, persistenceError, preferences, save, systemReducedMotion, update])

  return <AccessibilityContext.Provider value={value}>{children}<ReadingGuide enabled={preferences.readingGuide} /><Magnifier enabled={preferences.magnifier} /></AccessibilityContext.Provider>
}

function ReadingGuide({ enabled }: { enabled: boolean }) {
  const guideRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!enabled) return
    const guide = guideRef.current
    if (!guide) return

    let frame: number | null = null
    let nextY = window.innerHeight / 2
    const paint = () => {
      guide.style.top = `${Math.max(24, Math.min(window.innerHeight - 24, nextY))}px`
      frame = null
    }
    const followPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      nextY = event.clientY
      if (frame === null) frame = window.requestAnimationFrame(paint)
    }

    window.addEventListener('pointermove', followPointer, { passive: true })
    return () => {
      window.removeEventListener('pointermove', followPointer)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [enabled])

  return <span ref={guideRef} className="reading-guide" aria-hidden="true" />
}

export function useAccessibility() {
  const value = useContext(AccessibilityContext)
  if (!value) throw new Error('useAccessibility debe usarse dentro de AccessibilityProvider')
  return value
}
