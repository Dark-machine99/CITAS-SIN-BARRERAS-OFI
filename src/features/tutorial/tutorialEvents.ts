export type PatientTutorialAction = 'practice-complete' | 'accessibility-open' | 'voice-navigation-complete' | 'voice-booking-complete'

const eventName = 'patient-tutorial-action'

export function reportPatientTutorialAction(action: PatientTutorialAction) {
  window.dispatchEvent(new CustomEvent<PatientTutorialAction>(eventName, { detail: action }))
}

export function subscribePatientTutorialAction(listener: (action: PatientTutorialAction) => void) {
  const handle = (event: Event) => listener((event as CustomEvent<PatientTutorialAction>).detail)
  window.addEventListener(eventName, handle)
  return () => window.removeEventListener(eventName, handle)
}
