import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Ground from './Ground'
import SkyDome from './SkyDome'
import GrassField from './GrassField'
import FlowerField from './FlowerField'

const FOG_COLOR = '#f2f2f0'

export default function Scene() {
  const { camera, scene } = useThree()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    camera.lookAt(-6.25, 1.51, -53.46)

    scene.fog = new THREE.Fog(FOG_COLOR, 15, 75)
    scene.background = new THREE.Color(FOG_COLOR)
  }, [camera, scene])

  useFrame(() => {
    const el = document.getElementById('camera-info')
    if (el) {
      const p = camera.position
      const d = new THREE.Vector3()
      camera.getWorldDirection(d)
      el.textContent =
        `pos: (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})  ` +
        `dir: (${d.x.toFixed(2)}, ${d.y.toFixed(2)}, ${d.z.toFixed(2)})`
    }
  })

  return (
    <>
      <ambientLight intensity={0.9} color="#fafafa" />
      <directionalLight position={[5, 12, 8]} intensity={0.3} color="#fff8f0" />
      <hemisphereLight args={['#e8e8e8', '#3a6b1e', 0.25]} />

      <OrbitControls makeDefault target={[-6.25, 1.51, -53.46]} />

      <SkyDome />
      <Ground />
      <GrassField />
      <FlowerField />
    </>
  )
}
