import { useMemo } from 'react'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uHorizonColor;
  uniform vec3 uZenithColor;
  varying vec3 vWorldPosition;

  void main() {
    float height = normalize(vWorldPosition).y;
    float t = clamp(height, 0.0, 1.0);
    vec3 color = mix(uHorizonColor, uZenithColor, pow(t, 0.5));
    gl_FragColor = vec4(color, 1.0);
  }
`

export default function SkyDome() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uHorizonColor: { value: new THREE.Color('#F8F6FD') },
        uZenithColor: { value: new THREE.Color('#F8F6FD') },
      },
      side: THREE.BackSide,
      depthWrite: false,
    })
  }, [])

  return (
    <mesh material={material} renderOrder={-1000}>
      <sphereGeometry args={[95, 32, 16]} />
    </mesh>
  )
}
