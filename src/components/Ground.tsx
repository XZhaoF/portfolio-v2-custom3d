import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls } from 'leva'
import * as THREE from 'three'
import { getTerrainHeight, useTerrainParams } from '../utils/terrain'

const FIELD_WIDTH = 140
const FIELD_DEPTH = 120

const vertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec2 vFieldUv;
  varying vec3 vNormal;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vNormal = normalize(normalMatrix * normal);

    vFieldUv = vec2(
      (worldPos.x + ${(FIELD_WIDTH * 0.5).toFixed(1)}) / ${FIELD_WIDTH.toFixed(1)},
      (worldPos.z + ${(FIELD_DEPTH * 0.5).toFixed(1)}) / ${FIELD_DEPTH.toFixed(1)}
    );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uGrassTexture;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uDarken;
  varying vec3 vWorldPosition;
  varying vec2 vFieldUv;
  varying vec3 vNormal;

  void main() {
    vec3 texColor = texture2D(uGrassTexture, vFieldUv).rgb;

    vec3 groundColor = texColor * uDarken;

    vec3 lightDir = normalize(vec3(0.3, 1.0, 0.2));
    float diffuse = dot(vNormal, lightDir) * 0.5 + 0.5;
    groundColor *= mix(0.8, 1.0, diffuse);

    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    groundColor = mix(groundColor, uFogColor, fogFactor);

    gl_FragColor = vec4(groundColor, 1.0);
  }
`

const textureLoader = new THREE.TextureLoader()

export default function Ground() {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const terrain = useTerrainParams()

  const params = useControls('Ground', {
    darken:  { value: 0.45, min: 0.1, max: 1.0, step: 0.05 },
    fogNear: { value: 15, min: 0, max: 60, step: 1 },
    fogFar:  { value: 75, min: 20, max: 200, step: 5 },
  })

  const grassTexture = useMemo(() => {
    const tex = textureLoader.load('/grass_texture2.png')
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  const geometry = useMemo(() => {
    const segments = 150

    const geo = new THREE.PlaneGeometry(FIELD_WIDTH, FIELD_DEPTH, segments, segments)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, 0, -30)

    const positions = geo.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i)
      const z = positions.getZ(i)
      positions.setY(i, getTerrainHeight(x, z, terrain) - 0.02)
    }
    positions.needsUpdate = true
    geo.computeVertexNormals()

    return geo
  }, [terrain.largeAmp, terrain.mediumAmp, terrain.smallAmp])

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uGrassTexture: { value: grassTexture },
        uDarken: { value: 0.45 },
        uFogColor: { value: new THREE.Color('#f2f2f0') },
        uFogNear: { value: 15 },
        uFogFar: { value: 75 },
      },
    })
    materialRef.current = mat
    return mat
  }, [grassTexture])

  useFrame(() => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uDarken.value = params.darken
    mat.uniforms.uFogNear.value = params.fogNear
    mat.uniforms.uFogFar.value = params.fogFar
  })

  return <mesh geometry={geometry} material={material} />
}
