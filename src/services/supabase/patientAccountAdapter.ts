import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

export type PatientProfile = Database['public']['Tables']['profiles']['Row']
export type AccessibilityPreferencesRow = Database['public']['Tables']['accessibility_preferences']['Row']
export type PatientProfileUpdate = Pick<PatientProfile, 'first_name' | 'last_name' | 'phone'>
export type AccessibilityPreferencesUpdate = Pick<AccessibilityPreferencesRow, 'colorblind_mode' | 'font_scale' | 'guided_reading' | 'high_contrast' | 'large_cursor' | 'magnifier_enabled' | 'preset' | 'reduced_motion' | 'simple_mode'>

export interface PatientAccount {
  profile: PatientProfile
  preferences: AccessibilityPreferencesRow
}

export interface PatientAccountAdapter {
  getSession: () => Promise<Session | null>
  onAuthStateChange: (listener: (event: AuthChangeEvent, session: Session | null) => void) => () => void
  signUp: (input: { email: string; password: string; firstName: string; lastName: string; phone: string | null; accessibilityPreferences: AccessibilityPreferencesUpdate; redirectTo: string }) => Promise<Session | null>
  signIn: (email: string, password: string) => Promise<Session>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string, redirectTo: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  loadAccount: (userId: string) => Promise<PatientAccount>
  updateProfile: (userId: string, update: PatientProfileUpdate) => Promise<PatientProfile>
  updatePreferences: (userId: string, update: AccessibilityPreferencesUpdate) => Promise<AccessibilityPreferencesRow>
}

const throwIfError = (error: { message: string } | null) => {
  if (error) throw new Error(error.message)
}

export const patientAccountAdapter: PatientAccountAdapter = {
  async getSession() {
    const { data, error } = await supabase.auth.getSession()
    throwIfError(error)
    return data.session
  },
  onAuthStateChange(listener) {
    const { data } = supabase.auth.onAuthStateChange(listener)
    return () => data.subscription.unsubscribe()
  },
  async signUp({ email, password, firstName, lastName, phone, accessibilityPreferences, redirectTo }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          phone,
          accessibility_preferences: accessibilityPreferences,
        },
      },
    })
    throwIfError(error)
    return data.session
  },
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    throwIfError(error)
    if (!data.session) throw new Error('Supabase no devolvió una sesión válida.')
    return data.session
  },
  async signOut() {
    const { error } = await supabase.auth.signOut()
    throwIfError(error)
  },
  async requestPasswordReset(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    throwIfError(error)
  },
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password })
    throwIfError(error)
  },
  async loadAccount(userId) {
    const [profileResult, preferencesResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('accessibility_preferences').select('*').eq('user_id', userId).single(),
    ])
    throwIfError(profileResult.error)
    throwIfError(preferencesResult.error)
    if (!profileResult.data) throw new Error('No existe un perfil para esta cuenta.')
    if (!preferencesResult.data) throw new Error('No existen preferencias para esta cuenta.')
    return { profile: profileResult.data, preferences: preferencesResult.data }
  },
  async updateProfile(userId, update) {
    const { data, error } = await supabase.from('profiles').update(update).eq('id', userId).select('*').single()
    throwIfError(error)
    if (!data) throw new Error('No se pudo recuperar el perfil actualizado.')
    return data
  },
  async updatePreferences(userId, update) {
    const { data, error } = await supabase.from('accessibility_preferences').update(update).eq('user_id', userId).select('*').single()
    throwIfError(error)
    if (!data) throw new Error('No se pudieron recuperar las preferencias actualizadas.')
    return data
  },
}
