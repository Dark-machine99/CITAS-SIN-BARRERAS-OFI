import type { PropsWithChildren } from 'react'
import { AssistiveDock } from '../../components/assistive/AssistiveDock'
import { AccessibilityProvider } from './AccessibilityProvider'
import { BookingProvider } from './BookingProvider'
import { DemoSessionProvider } from './DemoSessionProvider'
import { MedicalAdminDemoProvider } from './MedicalAdminDemoProvider'
import { AuthProvider } from './AuthProvider'

export function AppProviders({ children }: PropsWithChildren) {
  return <DemoSessionProvider><AuthProvider><AccessibilityProvider><MedicalAdminDemoProvider><BookingProvider>{children}<AssistiveDock /></BookingProvider></MedicalAdminDemoProvider></AccessibilityProvider></AuthProvider></DemoSessionProvider>
}
