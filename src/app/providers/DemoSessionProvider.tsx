import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import type { DemoRole } from '../../types/medicalAdmin'

interface DemoSessionValue {
  active: boolean
  role: DemoRole | null
  doctorId: string | null
  mustChangeDoctorPassword: boolean
  enterDemo: (role?: DemoRole) => void
  completeDoctorPasswordChange: () => void
  leaveDemo: () => void
}
const DemoSessionContext = createContext<DemoSessionValue | null>(null)

export function DemoSessionProvider({ children }: PropsWithChildren) {
  const [active, setActive] = useState(false)
  const [role, setRole] = useState<DemoRole | null>(null)
  const [mustChangeDoctorPassword, setMustChangeDoctorPassword] = useState(true)
  const value = useMemo<DemoSessionValue>(() => ({
    active,
    role,
    doctorId: role === 'doctor' ? 'doc-lucia' : null,
    mustChangeDoctorPassword,
    enterDemo: (nextRole = 'patient') => { setRole(nextRole); setActive(true); if (nextRole === 'doctor') setMustChangeDoctorPassword(true) },
    completeDoctorPasswordChange: () => setMustChangeDoctorPassword(false),
    leaveDemo: () => { setActive(false); setRole(null); setMustChangeDoctorPassword(true) },
  }), [active, mustChangeDoctorPassword, role])
  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>
}
export function useDemoSession() {
  const value = useContext(DemoSessionContext)
  if (!value) throw new Error('useDemoSession debe usarse dentro de DemoSessionProvider')
  return value
}
