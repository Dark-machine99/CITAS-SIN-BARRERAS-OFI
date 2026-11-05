import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Mesh, MeshStandardMaterial } from 'three'
import { bodyRegions } from '../../services/mock/data'
import type { BodyModel } from '../../types/domain'

const nodeToId = new Map<string, string>(bodyRegions.map(([id, , node]) => [node, id]))
function Model({ model, selected, onToggle }: { model: BodyModel; selected: string[]; onToggle: (id: string) => void }) {
  const { scene } = useGLTF(`/models/cuerpo_${model}_interactivo.glb`)
  const clone = useMemo(() => scene.clone(true), [scene])
  const invalidate = useThree((state) => state.invalidate)
  const materials = useMemo(() => ({
    base: new MeshStandardMaterial({ color: new Color(model === 'masculino' ? '#91b9df' : '#c5a8cf'), roughness: .48, metalness: .03, emissive: new Color(model === 'masculino' ? '#071b35' : '#2d1736'), emissiveIntensity: .055, vertexColors: false }),
    selected: new MeshStandardMaterial({ color: new Color('#28d7c0'), roughness: .38, metalness: .08, emissive: new Color('#0a7269'), emissiveIntensity: .42, vertexColors: false }),
  }), [model])
  const selectedIds = useMemo(() => new Set(selected), [selected])

  useEffect(() => () => {
    materials.base.dispose()
    materials.selected.dispose()
  }, [materials])
  useEffect(() => {
    let changed = false
    clone.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true
        object.receiveShadow = true
        const id = nodeToId.get(object.name)
        if (id && !object.userData.profileApplied) {
          const upperBody = id.includes('hombro') || id.includes('brazo') || id === 'pecho'
          const lowerBody = id === 'cadera' || id.includes('muslo')
          const widthFactor = model === 'masculino' ? (upperBody ? 1.075 : lowerBody ? .975 : 1) : (upperBody ? .955 : lowerBody ? 1.09 : 1)
          object.scale.x *= widthFactor
          object.scale.y *= widthFactor
          object.userData.profileApplied = true
        }
        const nextMaterial = id && selectedIds.has(id) ? materials.selected : materials.base
        if (object.material !== nextMaterial) { object.material = nextMaterial; changed = true }
      }
    })
    if (changed) invalidate()
  }, [clone, invalidate, materials, model, selectedIds])
  const click = (event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); const id = nodeToId.get(event.object.name); if (id) onToggle(id) }
  return <primitive object={clone} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.94, 0]} onPointerDown={click} />
}

export default function BodyViewer({ model, selected, onToggle, view }: { model: BodyModel; selected: string[]; onToggle: (id: string) => void; view: 'front' | 'back' }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  useEffect(() => { if (controls.current) { controls.current.setAzimuthalAngle(view === 'front' ? 0 : Math.PI); controls.current.update() } }, [view])
  return <div className={`body-canvas body-canvas--${model}`} role="img" aria-label={`Modelo corporal ${model}. Usa la lista textual para una selección plenamente accesible.`}><span className="model-badge" aria-hidden="true">{model === 'masculino' ? 'Modelo M' : 'Modelo F'}</span><Canvas shadows frameloop="demand" dpr={[1, 1.5]} camera={{ position: [0, 0, 3.15], fov: 32 }} gl={{ antialias: true, alpha: true }}><ambientLight intensity={1.45} /><hemisphereLight intensity={1.15} color="#ffffff" groundColor="#8aa4bc" /><directionalLight castShadow position={[3, 4, 5]} intensity={2.45} color="#ffffff" /><directionalLight position={[-4, 1, -2]} intensity={1.05} color={model === 'masculino' ? '#75d6ff' : '#f1bfe7'} /><Model model={model} selected={selected} onToggle={onToggle} /><ContactShadows position={[0, -1.05, 0]} opacity={.28} scale={2.2} blur={2.4} far={2.2} frames={1} /><OrbitControls ref={controls} makeDefault enablePan={false} enableDamping={false} minDistance={2.4} maxDistance={4.2} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI * 2 / 3} /></Canvas></div>
}
