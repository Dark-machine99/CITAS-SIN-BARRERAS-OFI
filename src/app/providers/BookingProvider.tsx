import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react'
import { patientAppointmentsAdapter, PatientAppointmentsError, type AppointmentMutationErrorCode, type PatientAppointment, type PatientAppointmentsAdapter, type PatientAppointmentSummary } from '../../services/supabase/patientAppointmentsAdapter'
import { patientReservationAdapter, PatientReservationError, type PatientReservationAdapter, type PatientReservationData, type ReservationErrorCode } from '../../services/supabase/patientReservationAdapter'
import type { AppointmentDraft, BodySelectionDraft } from '../../types/domain'
import { createPatientTutorialReservation } from '../../services/tutorial/patientTutorialBookingAdapter'
import { useOptionalAuth } from './AuthProvider'

const emptyDraft: AppointmentDraft = { specialtyId: null, doctorId: null, date: null, time: null, reason: '' }
const emptyBody: BodySelectionDraft = { model: 'masculino', regions: [] }

export type AppointmentsState =
  | { status: 'idle' | 'loading' }
  | { status: 'ready'; data: PatientAppointment[] }
  | { status: 'error' }

type MutationResult =
  | { ok: true; appointment: PatientAppointmentSummary }
  | { ok: false; code: AppointmentMutationErrorCode }

interface BookingContextValue {
  draft: AppointmentDraft
  bodySelection: BodySelectionDraft
  appointments: PatientAppointment[]
  appointmentsState: AppointmentsState
  updateDraft: (patch: Partial<AppointmentDraft>) => void
  setBodySelection: Dispatch<SetStateAction<BodySelectionDraft>>
  resetSensitive: () => void
  resetDraft: () => void
  refreshAppointments: () => Promise<void>
  confirm: () => Promise<{ ok: true; appointment: PatientReservationData } | { ok: false; code: ReservationErrorCode }>
  cancel: (id: string) => Promise<MutationResult>
  reschedule: (id: string, date: string, time: string) => Promise<MutationResult>
  tutorialDraft: AppointmentDraft
  updateTutorialDraft: (patch: Partial<AppointmentDraft>) => void
  resetTutorialDraft: () => void
  confirmTutorial: () => Promise<{ ok: true; appointment: PatientReservationData }>
}

const BookingContext = createContext<BookingContextValue | null>(null)

export function BookingProvider({ children, reservationAdapter = patientReservationAdapter, appointmentsAdapter = patientAppointmentsAdapter }: PropsWithChildren<{
  reservationAdapter?: PatientReservationAdapter
  appointmentsAdapter?: PatientAppointmentsAdapter
}>) {
  const auth = useOptionalAuth()
  const [draft, setDraft] = useState(emptyDraft)
  const [tutorialDraft, setTutorialDraft] = useState(emptyDraft)
  const [bodySelection, setBodySelection] = useState(emptyBody)
  const [appointmentsState, setAppointmentsState] = useState<AppointmentsState>(() => auth ? { status: 'loading' } : { status: 'ready', data: [] })
  const confirmation = useRef<Promise<{ ok: true; appointment: PatientReservationData } | { ok: false; code: ReservationErrorCode }> | null>(null)
  const confirmedReservation = useRef<{ key: string; appointment: PatientReservationData } | null>(null)
  const tutorialConfirmation = useRef<Promise<{ ok: true; appointment: PatientReservationData }> | null>(null)
  const mutationRequests = useRef(new Map<string, Promise<MutationResult>>())
  const loadGeneration = useRef(0)
  const activeUserId = useRef<string | null>(null)
  const pendingLoad = useRef<{ userId: string; promise: Promise<void> } | null>(null)

  const authStatus = auth?.status ?? null
  const sessionUserId = authStatus === 'authenticated' ? auth?.session?.user.id ?? null : null
  const appointments = useMemo(() => appointmentsState.status === 'ready' ? appointmentsState.data : [], [appointmentsState])
  const updateDraft = useCallback((patch: Partial<AppointmentDraft>) => setDraft((current) => ({ ...current, ...patch })), [])
  const updateTutorialDraft = useCallback((patch: Partial<AppointmentDraft>) => setTutorialDraft((current) => ({ ...current, ...patch })), [])
  const resetTutorialDraft = useCallback(() => { tutorialConfirmation.current = null; setTutorialDraft(emptyDraft) }, [])
  const resetSensitive = useCallback(() => { setDraft((current) => ({ ...current, reason: '' })); setBodySelection(emptyBody) }, [])
  const resetDraft = useCallback(() => { confirmedReservation.current = null; setDraft(emptyDraft); setBodySelection(emptyBody) }, [])

  const loadAppointments = useCallback((userId: string, force = false, preserveOnError = false) => {
    if (!force && pendingLoad.current?.userId === userId) return pendingLoad.current.promise
    const generation = ++loadGeneration.current
    if (!preserveOnError) setAppointmentsState({ status: 'loading' })
    const promise = appointmentsAdapter.list().then((data) => {
      if (generation === loadGeneration.current && activeUserId.current === userId) setAppointmentsState({ status: 'ready', data })
    }).catch(() => {
      if (generation === loadGeneration.current && activeUserId.current === userId && !preserveOnError) setAppointmentsState({ status: 'error' })
    }).finally(() => {
      if (pendingLoad.current?.promise === promise) pendingLoad.current = null
    })
    pendingLoad.current = { userId, promise }
    return promise
  }, [appointmentsAdapter])

  const refreshAppointments = useCallback(() => {
    const userId = activeUserId.current
    return userId ? loadAppointments(userId, true) : Promise.resolve()
  }, [loadAppointments])

  const resetAppointments = useCallback((status: 'loading' | 'ready') => {
    ++loadGeneration.current
    pendingLoad.current = null
    confirmedReservation.current = null
    setAppointmentsState(status === 'loading' ? { status: 'loading' } : { status: 'ready', data: [] })
  }, [])

  useEffect(() => {
    activeUserId.current = sessionUserId
    const timer = window.setTimeout(() => {
      resetTutorialDraft()
      if (!authStatus || authStatus === 'loading' || !sessionUserId) resetAppointments(authStatus === 'loading' ? 'loading' : 'ready')
      else void loadAppointments(sessionUserId)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [authStatus, loadAppointments, resetAppointments, resetTutorialDraft, sessionUserId])

  useEffect(() => () => { ++loadGeneration.current; activeUserId.current = null }, [])

  const confirm = useCallback(() => {
    if (confirmation.current) return confirmation.current
    const key = [draft.doctorId, draft.specialtyId, draft.date, draft.time, draft.reason.trim()].join('|')
    if (confirmedReservation.current?.key === key) return Promise.resolve({ ok: true as const, appointment: confirmedReservation.current.appointment })
    const request = reservationAdapter.reserve({
      doctorId: draft.doctorId ?? '', specialtyId: draft.specialtyId ?? '', date: draft.date ?? '',
      time: draft.time ?? '', reason: draft.reason,
    }).then(async (appointment) => {
      confirmedReservation.current = { key, appointment }
      const userId = activeUserId.current
      if (userId) await loadAppointments(userId, true, true)
      return { ok: true as const, appointment }
    }).catch((error: unknown) => ({
      ok: false as const,
      code: error instanceof PatientReservationError ? error.code : 'INTERNAL_ERROR' as const,
    })).finally(() => {
      if (confirmation.current === request) confirmation.current = null
    })
    confirmation.current = request
    return request
  }, [draft, loadAppointments, reservationAdapter])

  const confirmTutorial = useCallback(() => {
    if (tutorialConfirmation.current) return tutorialConfirmation.current
    const snapshot = { ...tutorialDraft }
    const request = Promise.resolve({ ok: true as const, appointment: createPatientTutorialReservation(snapshot) })
      .finally(() => { if (tutorialConfirmation.current === request) tutorialConfirmation.current = null })
    tutorialConfirmation.current = request
    return request
  }, [tutorialDraft])

  const mergeMutation = useCallback((summary: PatientAppointmentSummary) => {
    setAppointmentsState((current) => current.status === 'ready' ? {
      status: 'ready', data: current.data.map((item) => item.id === summary.id ? { ...item, ...summary } : item),
    } : current)
  }, [])

  const runMutation = useCallback((key: string, request: () => Promise<PatientAppointmentSummary>) => {
    const pending = mutationRequests.current.get(key)
    if (pending) return pending
    const promise: Promise<MutationResult> = request().then(async (appointment) => {
      mergeMutation(appointment)
      const userId = activeUserId.current
      if (userId) await loadAppointments(userId, true, true)
      return { ok: true as const, appointment }
    }).catch((error: unknown) => ({
      ok: false as const,
      code: error instanceof PatientAppointmentsError ? error.code : 'INTERNAL_ERROR' as const,
    })).finally(() => { mutationRequests.current.delete(key) })
    mutationRequests.current.set(key, promise)
    return promise
  }, [loadAppointments, mergeMutation])

  const cancel = useCallback((id: string) => runMutation(`cancel:${id}`, () => appointmentsAdapter.cancel(id)), [appointmentsAdapter, runMutation])
  const reschedule = useCallback((id: string, date: string, time: string) => runMutation(`reschedule:${id}`, () => appointmentsAdapter.reschedule(id, date, time)), [appointmentsAdapter, runMutation])

  const value = useMemo<BookingContextValue>(() => ({
    draft, bodySelection, appointments, appointmentsState, updateDraft, setBodySelection,
    resetSensitive, resetDraft, refreshAppointments, confirm, cancel, reschedule,
    tutorialDraft, updateTutorialDraft, resetTutorialDraft, confirmTutorial,
  }), [appointments, appointmentsState, bodySelection, cancel, confirm, confirmTutorial, draft, refreshAppointments, resetDraft, resetSensitive, resetTutorialDraft, reschedule, tutorialDraft, updateDraft, updateTutorialDraft])

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
}

export function useBooking() {
  const value = useContext(BookingContext)
  if (!value) throw new Error('useBooking debe usarse dentro de BookingProvider')
  return value
}
