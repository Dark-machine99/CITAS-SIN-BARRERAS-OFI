import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { patientAccountAdapter, type AccessibilityPreferencesRow, type AccessibilityPreferencesUpdate, type PatientAccount, type PatientAccountAdapter, type PatientProfile, type PatientProfileUpdate } from '../../services/supabase/patientAccountAdapter'

type AuthStatus = 'loading' | 'signed-out' | 'authenticated' | 'error'
export type SignUpResult = { status: 'authenticated'; profile: PatientProfile } | { status: 'confirmation-pending' }

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  profile: PatientProfile | null
  storedPreferences: AccessibilityPreferencesRow | null
  error: string | null
  signUp: (input: { email: string; password: string; firstName: string; lastName: string; phone: string | null }) => Promise<SignUpResult>
  signIn: (email: string, password: string) => Promise<PatientProfile>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  updateProfile: (update: PatientProfileUpdate) => Promise<void>
  updateStoredPreferences: (update: AccessibilityPreferencesUpdate) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const messageFor = (error: unknown) => error instanceof Error ? error.message : 'Ocurrió un error inesperado.'

export function AuthProvider({ children, adapter = patientAccountAdapter }: PropsWithChildren<{ adapter?: PatientAccountAdapter }>) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [account, setAccount] = useState<PatientAccount | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadVersion = useRef(0)
  const hydration = useRef<{ userId: string; version: number; promise: Promise<PatientAccount | null> } | null>(null)
  const hydratedAccount = useRef<PatientAccount | null>(null)

  const clear = useCallback(() => {
    loadVersion.current += 1
    hydration.current = null
    hydratedAccount.current = null
    setSession(null)
    setAccount(null)
    setError(null)
    setStatus('signed-out')
  }, [])

  const hydrate = useCallback((nextSession: Session | null) => {
    if (!nextSession) { clear(); return Promise.resolve(null) }
    if (hydratedAccount.current?.profile.id === nextSession.user.id) {
      setSession(nextSession); setAccount(hydratedAccount.current); setError(null); setStatus('authenticated')
      return Promise.resolve(hydratedAccount.current)
    }
    const current = hydration.current
    if (current?.userId === nextSession.user.id) return current.promise

    const version = ++loadVersion.current
    setStatus('loading'); setSession(nextSession); setError(null)
    const promise = adapter.loadAccount(nextSession.user.id).then((nextAccount) => {
      if (version !== loadVersion.current) return null
      hydratedAccount.current = nextAccount; setAccount(nextAccount); setStatus('authenticated')
      return nextAccount
    }).catch((nextError: unknown) => {
      if (version !== loadVersion.current) return null
      hydratedAccount.current = null; setAccount(null); setError(messageFor(nextError)); setStatus('error')
      return null
    }).finally(() => {
      if (hydration.current?.version === version) hydration.current = null
    })
    hydration.current = { userId: nextSession.user.id, version, promise }
    return promise
  }, [adapter, clear])

  useEffect(() => {
    let active = true
    let authEventObserved = false
    void adapter.getSession().then((initialSession) => {
      if (active && !authEventObserved) void hydrate(initialSession)
    }).catch((nextError: unknown) => {
      if (!active) return
      setError(messageFor(nextError)); setStatus('error')
    })
    const unsubscribe = adapter.onAuthStateChange((_event, nextSession) => {
      authEventObserved = true
      window.setTimeout(() => { if (active) void hydrate(nextSession) }, 0)
    })
    return () => { active = false; loadVersion.current += 1; unsubscribe() }
  }, [adapter, hydrate])

  const signUp = useCallback(async (input: { email: string; password: string; firstName: string; lastName: string; phone: string | null }) => {
    const returnedSession = await adapter.signUp({ ...input, redirectTo: `${window.location.origin}/confirmar-correo` })
    if (!returnedSession) return { status: 'confirmation-pending' } as const
    const nextAccount = await hydrate(returnedSession)
    if (!nextAccount) throw new Error('No pudimos cargar tu perfil y preferencias. Inténtalo nuevamente.')
    return { status: 'authenticated', profile: nextAccount.profile } as const
  }, [adapter, hydrate])

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await adapter.signIn(email, password)
    const nextAccount = await hydrate(nextSession)
    if (!nextAccount) throw new Error('No pudimos cargar tu perfil y preferencias. Inténtalo nuevamente.')
    return nextAccount.profile
  }, [adapter, hydrate])

  const signOut = useCallback(async () => {
    try { await adapter.signOut() }
    finally { clear() }
  }, [adapter, clear])
  const requestPasswordReset = useCallback((email: string) => adapter.requestPasswordReset(email, `${window.location.origin}/nueva-contrasena`), [adapter])
  const updatePassword = useCallback((password: string) => adapter.updatePassword(password), [adapter])
  const updateProfile = useCallback(async (update: PatientProfileUpdate) => {
    if (!session) throw new Error('Debes iniciar sesión para actualizar el perfil.')
    const profile = await adapter.updateProfile(session.user.id, update)
    setAccount((current) => {
      const nextAccount = current ? { ...current, profile } : current
      hydratedAccount.current = nextAccount
      return nextAccount
    })
  }, [adapter, session])
  const updateStoredPreferences = useCallback(async (update: AccessibilityPreferencesUpdate) => {
    if (!session) throw new Error('Debes iniciar sesión para guardar preferencias.')
    const preferences = await adapter.updatePreferences(session.user.id, update)
    setAccount((current) => {
      const nextAccount = current ? { ...current, preferences } : current
      hydratedAccount.current = nextAccount
      return nextAccount
    })
  }, [adapter, session])

  const value = useMemo<AuthContextValue>(() => ({
    status, session, profile: account?.profile ?? null, storedPreferences: account?.preferences ?? null, error,
    signUp, signIn, signOut, requestPasswordReset, updatePassword, updateProfile, updateStoredPreferences,
  }), [account, error, requestPasswordReset, signIn, signOut, signUp, status, session, updatePassword, updateProfile, updateStoredPreferences])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}

export function useOptionalAuth() {
  return useContext(AuthContext)
}
