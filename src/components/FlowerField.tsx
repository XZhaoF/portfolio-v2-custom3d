import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getTerrainHeight, useTerrainParams } from '../utils/terrain'

const FLOWER_COUNT = 0
const FIELD_WIDTH = 110
const FIELD_DEPTH = 95
const FIELD_OFFSET_Z = -35

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vUv = uv;

    vec3 pos = position;

    vec3 baseWorld = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    float flowerHash = hash(baseWorld.xz);

    float t = uTime * 0.6;
    float spatial = baseWorld.x * 0.15 + baseWorld.z * 0.1;

    float sway = sin(t + spatial + flowerHash * 2.0) * 0.06;
    float gust = sin(t * 1.8 + spatial * 2.0) * 0.03;
    float windOffset = (sway + gust) * uWindStrength;

    vec4 worldPos = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    worldPos.x += windOffset;
    worldPos.z += windOffset * 0.25;

    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vec4 texColor = texture2D(uTexture, vUv);

    // Black background → transparent via brightness threshold
    float brightness = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    if (brightness < 0.12) discard;

    vec3 color = texColor.rgb;

    // Distance fog
    float dist = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`

const textureLoader = new THREE.TextureLoader()

export default function FlowerField() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const terrain = useTerrainParams()

  const flowerTexture = useMemo(() => {
    const tex = textureLoader.load('/nemophila_flower.png')
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.14, 0.14)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWindStrength: { value: 1.0 },
        uTexture: { value: flowerTexture },
        uFogColor: { value: new THREE.Color('#f2f2f0') },
        uFogNear: { value: 15 },
        uFogFar: { value: 75 },
      },
      side: THREE.DoubleSide,
    })
  }, [flowerTexture])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = new THREE.Object3D()

    for (let i = 0; i < FLOWER_COUNT; i++) {
      const x = (Math.random() - 0.5) * FIELD_WIDTH
      const z = Math.random() * -FIELD_DEPTH + FIELD_OFFSET_Z + FIELD_DEPTH * 0.5
      const terrainY = getTerrainHeight(x, z, terrain)
      const flowerHeight = terrainY + 0.08 + Math.random() * 0.1

      dummy.position.set(x, flowerHeight, z)
      dummy.rotation.set(
        -0.15 + (Math.random() - 0.5) * 0.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 0.3,
      )
      dummy.scale.setScalar(0.7 + Math.random() * 0.6)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
  }, [terrain.largeAmp, terrain.mediumAmp, terrain.smallAmp])

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, FLOWER_COUNT]} />
  )
}
