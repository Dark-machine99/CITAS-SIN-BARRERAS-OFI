import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import {
  patientTutorialProgressAdapter,
  type PatientTutorialProgress,
  type PatientTutorialProgressAdapter,
  type PatientTutorialProgressWrite,
} from '../../services/supabase/patientTutorialProgressAdapter'
import { PATIENT_TUTORIAL_VERSION, patientTutorialSteps } from './tutorialSteps'
import { subscribePatientTutorialAction, type PatientTutorialAction } from './tutorialEvents'
import { useLocation } from 'react-router'
import { useBooking } from '../../app/providers/BookingProvider'

type TutorialPhase = 'loading' | 'idle' | 'prompt' | 'running' | 'error'

interface PatientTutorialContextValue {
  identityKey: string
  phase: TutorialPhase
  currentStep: number
  saving: boolean
  error: string | null
  bookingMode: 'live' | 'tutorial'
  begin: () => Promise<void>
  skip: () => Promise<void>
  next: () => Promise<void>
  previous: () => Promise<void>
  exit: () => void
  repeat: (trigger?: HTMLElement | null) => void
  retryLoad: () => void
  completeAction: (action: PatientTutorialAction) => void
}

interface TutorialMutationScope {
  userId: string
  progress: PatientTutorialProgress | null
}

interface PatientTutorialProviderProps extends PropsWithChildren {
  userId: string | null
  adapter?: PatientTutorialProgressAdapter
  now?: () => string
}

const PatientTutorialContext = createContext<PatientTutorialContextValue | null>(null)

function clampStep(step: number) {
  return Math.min(Math.max(step, 0), patientTutorialSteps.length - 1)
}

export function PatientTutorialProvider({
  children,
  userId,
  adapter = patientTutorialProgressAdapter,
  now = () => new Date().toISOString(),
}: PatientTutorialProviderProps) {
  const [phase, setPhase] = useState<TutorialPhase>('loading')
  const [stateUserId, setStateUserId] = useState<string | null>(null)
  const [progress, setProgress] = useState<PatientTutorialProgress | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [manualReplay, setManualReplay] = useState(false)
  const [manualAdvanced, setManualAdvanced] = useState(false)
  const loadSequence = useRef(0)
  const mutationSequence = useRef(0)
  const returnFocus = useRef<HTMLElement | null>(null)
  const location = useLocation()
  const previousLocationKey = useRef(location.key)
  const { resetTutorialDraft } = useBooking()

  const restoreFocus = useCallback(() => {
    const target = returnFocus.current?.isConnected
      ? returnFocus.current
      : document.getElementById('contenido')
    target?.focus()
    returnFocus.current = null
  }, [])

  useEffect(() => {
    const sequence = ++loadSequence.current
    mutationSequence.current += 1
    void Promise.resolve().then(() => {
      if (sequence !== loadSequence.current) return
      setError(null)
      setProgress(null)
      setCurrentStep(0)
      setManualReplay(false)
      setManualAdvanced(false)
      setSaving(false)
      if (!userId) {
        setStateUserId(null)
        setPhase('idle')
        return null
      }
      setPhase('loading')
      return adapter.load(userId)
    }).then((loaded) => {
      if (sequence !== loadSequence.current || !userId || loaded == null) {
        if (sequence === loadSequence.current && userId && loaded === null) {
          setStateUserId(userId)
          setPhase('prompt')
        }
        return
      }
      setStateUserId(userId)
      setProgress(loaded)
      if (loaded.status === 'pending') setPhase('prompt')
      else if (loaded.status === 'in_progress') {
        setCurrentStep(clampStep(loaded.currentStep))
        setPhase('running')
      } else setPhase('idle')
    }).catch(() => {
      if (sequence !== loadSequence.current) return
      setStateUserId(userId)
      setError('No pudimos cargar la guía. Puedes reintentar sin perder datos.')
      setPhase('error')
    })
    return () => {
      if (loadSequence.current === sequence) loadSequence.current += 1
      mutationSequence.current += 1
    }
  }, [adapter, loadAttempt, userId])

  const save = useCallback(async (scope: TutorialMutationScope, write: PatientTutorialProgressWrite) => {
    const saved = scope.progress
      ? await adapter.update(scope.userId, write)
      : await adapter.create(scope.userId, write)
    if (saved.userId !== scope.userId) throw new Error('invalid-user')
    return saved
  }, [adapter])

  const runMutation = useCallback(async (
    operation: (scope: TutorialMutationScope) => Promise<PatientTutorialProgress>,
    apply: (saved: PatientTutorialProgress) => void,
  ) => {
    if (saving || !userId || stateUserId !== userId) return
    const sequence = ++mutationSequence.current
    const scope: TutorialMutationScope = {
      userId,
      progress: progress?.userId === userId ? progress : null,
    }
    setSaving(true)
    setError(null)
    try {
      const saved = await operation(scope)
      if (sequence !== mutationSequence.current) return
      setProgress(saved)
      apply(saved)
    } catch {
      if (sequence !== mutationSequence.current) return
      setError('No pudimos guardar este cambio. Reinténtalo para continuar.')
    } finally {
      if (sequence === mutationSequence.current) setSaving(false)
    }
  }, [progress, saving, stateUserId, userId])

  const begin = useCallback(async () => runMutation(async (scope) => {
    const startedAt = now()
    return save(scope, {
      tutorialVersion: PATIENT_TUTORIAL_VERSION,
      status: 'in_progress',
      currentStep: 0,
      startedAt,
      finishedAt: null,
    })
  }, () => {
    setCurrentStep(0)
    setManualReplay(false)
    setManualAdvanced(false)
    setPhase('running')
  }), [now, runMutation, save])

  const skip = useCallback(async () => runMutation(async (scope) => {
    const timestamp = now()
    return save(scope, {
      tutorialVersion: PATIENT_TUTORIAL_VERSION,
      status: 'skipped',
      currentStep: 0,
      startedAt: timestamp,
      finishedAt: timestamp,
    })
  }, () => {
    resetTutorialDraft()
    setPhase('idle')
    restoreFocus()
  }), [now, resetTutorialDraft, restoreFocus, runMutation, save])

  const next = useCallback(async () => runMutation(async (scope) => {
    const isLast = currentStep === patientTutorialSteps.length - 1
    const startedAt = scope.progress?.status === 'in_progress' && scope.progress.startedAt
      ? scope.progress.startedAt
      : now()
    const nextStep = isLast ? currentStep : currentStep + 1
    return save(scope, {
      tutorialVersion: PATIENT_TUTORIAL_VERSION,
      status: isLast ? 'completed' : 'in_progress',
      currentStep: nextStep,
      startedAt,
      finishedAt: isLast ? now() : null,
    })
  }, () => {
    const isLast = currentStep === patientTutorialSteps.length - 1
    const startingManualReplay = manualReplay && !manualAdvanced
    const nextStep = isLast ? currentStep : currentStep + 1
    const leavingPractice = patientTutorialSteps[currentStep]?.bookingMode && !patientTutorialSteps[nextStep]?.bookingMode
    if (startingManualReplay) setManualAdvanced(true)
    if (leavingPractice) resetTutorialDraft()
    if (isLast) {
      resetTutorialDraft()
      setPhase('idle')
      setManualReplay(false)
      restoreFocus()
    } else {
      setCurrentStep(nextStep)
    }
  }), [currentStep, manualAdvanced, manualReplay, now, resetTutorialDraft, restoreFocus, runMutation, save])

  const previous = useCallback(async () => {
    const previousStep = Math.max(0, currentStep - 1)
    if (previousStep === currentStep) return
    await runMutation(async (scope) => {
      const startedAt = scope.progress?.status === 'in_progress' && scope.progress.startedAt
        ? scope.progress.startedAt
        : now()
      return save(scope, {
        tutorialVersion: PATIENT_TUTORIAL_VERSION,
        status: 'in_progress',
        currentStep: previousStep,
        startedAt,
        finishedAt: null,
      })
    }, () => {
      setManualAdvanced(true)
      setCurrentStep(previousStep)
    })
  }, [currentStep, now, runMutation, save])

  const exit = useCallback(() => {
    resetTutorialDraft()
    setPhase('idle')
    setError(null)
    setManualReplay(false)
    setManualAdvanced(false)
    restoreFocus()
  }, [resetTutorialDraft, restoreFocus])

  const repeat = useCallback((trigger?: HTMLElement | null) => {
    resetTutorialDraft()
    returnFocus.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    setCurrentStep(0)
    setError(null)
    setManualReplay(true)
    setManualAdvanced(false)
    setPhase('running')
  }, [resetTutorialDraft])

  const completeAction = useCallback((action: PatientTutorialAction) => {
    const step = patientTutorialSteps[currentStep]
    if (phase === 'running' && step?.advance.type === 'action' && step.advance.action === action) void next()
  }, [currentStep, next, phase])

  useEffect(() => {
    const routeChanged = previousLocationKey.current !== location.key
    previousLocationKey.current = location.key
    const step = patientTutorialSteps[currentStep]
    if (phase !== 'running' || !routeChanged || step?.advance.type !== 'route') return
    if (location.pathname !== step.advance.path) return
    const timer = window.setTimeout(() => void next(), 0)
    return () => window.clearTimeout(timer)
  }, [currentStep, location.key, location.pathname, next, phase])
  useEffect(() => subscribePatientTutorialAction(completeAction), [completeAction])

  const visiblePhase: TutorialPhase = !userId ? 'idle' : stateUserId === userId ? phase : 'loading'
  const value = useMemo<PatientTutorialContextValue>(() => ({
    identityKey: userId ?? 'signed-out',
    phase: visiblePhase,
    currentStep,
    saving,
    error,
    bookingMode: visiblePhase === 'running' && patientTutorialSteps[currentStep]?.bookingMode ? 'tutorial' : 'live',
    begin,
    skip,
    next,
    previous,
    exit,
    repeat,
    retryLoad: () => setLoadAttempt((attempt) => attempt + 1),
    completeAction,
  }), [begin, completeAction, currentStep, error, exit, next, previous, repeat, saving, skip, userId, visiblePhase])

  return <PatientTutorialContext.Provider value={value}>{children}</PatientTutorialContext.Provider>
}

export function usePatientTutorial() {
  const value = useContext(PatientTutorialContext)
  if (!value) throw new Error('usePatientTutorial debe usarse dentro de PatientTutorialProvider')
  return value
}

export function useOptionalPatientTutorial() {
  return useContext(PatientTutorialContext)
}
