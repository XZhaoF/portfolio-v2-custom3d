import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useControls, folder } from 'leva'
import * as THREE from 'three'
import { getTerrainHeight, useTerrainParams, type TerrainParams } from '../utils/terrain'

const FIELD_WIDTH = 110
const FIELD_DEPTH = 95
const FIELD_OFFSET_Z = -35

const vertexShader = /* glsl */ `
  attribute float aBladeRand;
  attribute float aWindAngle;
  attribute float aClumpPhase;

  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vWorldPos;

  uniform float uTime;
  uniform float uWindStrength;

  void main() {
    vUv = uv;
    vColor = color;

    vec3 cpos = position;

    // Wind weight from vertex color: 0=base, 0.5=mid, 1.0=tip
    float windWeight = color.x;
    float windSq = windWeight * windWeight;

    // Per-blade wind direction that slowly rotates over time
    float angle = aWindAngle + sin(uTime * 0.15 + aClumpPhase) * 0.4;
    vec2 windDir = vec2(cos(angle), sin(angle));

    // Multi-layer wind with clump coherence + per-blade variation
    float wavePhase = uv.x * 12.0 + uv.y * 8.0 + aClumpPhase;
    float globalSway = sin(uTime * 0.7 + wavePhase) * 0.45;
    float gust = sin(uTime * 1.6 + wavePhase * 2.2 + aBladeRand * 6.2831) * 0.25;
    float flutter = sin(uTime * 3.5 + aBladeRand * 20.0) * 0.08;

    float totalWind = (globalSway + gust + flutter) * windSq * uWindStrength;

    // Each blade sways in its own direction
    cpos.x += windDir.x * totalWind;
    cpos.z += windDir.y * totalWind;

    vWorldPos = (modelMatrix * vec4(cpos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(cpos, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uGrassTexture;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uBacklightIntensity;
  uniform float uTipGlow;
  uniform float uBaseDarken;

  varying vec2 vUv;
  varying vec3 vColor;
  varying vec3 vWorldPos;

  void main() {
    vec3 color = texture2D(uGrassTexture, vUv).rgb * uContrast;
    color += vec3(uBrightness);

    float heightDarken = mix(uBaseDarken, 1.0, smoothstep(0.0, 0.55, vColor.x));
    color *= heightDarken;

    // Backlight translucency
    vec3 viewDir = normalize(vWorldPos - cameraPosition);
    vec3 lightDir = normalize(vec3(0.3, 0.6, -0.4));
    float backlight = pow(max(0.0, dot(viewDir, lightDir)), 3.0) * vColor.x;
    color += vec3(0.12, 0.18, 0.03) * backlight * uBacklightIntensity;

    // Tip highlight
    float tipGlowAmt = smoothstep(0.8, 1.0, vColor.x) * uTipGlow;
    color += vec3(tipGlowAmt, tipGlowAmt * 1.1, tipGlowAmt * 0.3);

    // Fog
    float dist = length(vWorldPos - cameraPosition);
    float fogFactor = smoothstep(uFogNear, uFogFar, dist);
    color = mix(color, uFogColor, fogFactor);

    gl_FragColor = vec4(color, 1.0);
  }
`

interface GeometryParams {
  bladeCount: number
  bladesPerClump: number
  clumpRadius: number
  bladeWidth: number
  bladeHeight: number
  heightVariation: number
  tipOffset: number
  windAngleJitter: number
  terrain: TerrainParams
}

function generateGrassGeometry(params: GeometryParams): THREE.BufferGeometry {
  const {
    bladeCount, bladesPerClump, clumpRadius,
    bladeWidth, bladeHeight, heightVariation,
    tipOffset, windAngleJitter, terrain,
  } = params

  const midWidth = bladeWidth * 0.5
  const clumpCount = Math.ceil(bladeCount / bladesPerClump)

  const posArray = new Float32Array(bladeCount * 5 * 3)
  const uvArray = new Float32Array(bladeCount * 5 * 2)
  const colorArray = new Float32Array(bladeCount * 5 * 3)
  const bladeRandArray = new Float32Array(bladeCount * 5)
  const windAngleArray = new Float32Array(bladeCount * 5)
  const clumpPhaseArray = new Float32Array(bladeCount * 5)
  const indexArray = new Uint32Array(bladeCount * 9)

  let bladeIdx = 0

  for (let ci = 0; ci < clumpCount && bladeIdx < bladeCount; ci++) {
    const clumpX = (Math.random() - 0.5) * FIELD_WIDTH
    const clumpZ = Math.random() * -FIELD_DEPTH + FIELD_OFFSET_Z + FIELD_DEPTH * 0.5
    const clumpWindAngle = Math.random() * Math.PI * 2
    const clumpPhase = Math.random() * Math.PI * 2

    const bladesInClump = Math.min(bladesPerClump, bladeCount - bladeIdx)

    for (let bi = 0; bi < bladesInClump; bi++) {
      const i = bladeIdx++

      // Spread within clump — sqrt gives uniform distribution inside circle
      const spreadAngle = Math.random() * Math.PI * 2
      const spreadDist = Math.sqrt(Math.random()) * clumpRadius
      const cx = clumpX + Math.cos(spreadAngle) * spreadDist
      const cz = clumpZ + Math.sin(spreadAngle) * spreadDist
      const terrainY = getTerrainHeight(cx, cz, terrain)

      const height = bladeHeight + Math.random() * heightVariation
      const yaw = Math.random() * Math.PI * 2
      const sinYaw = Math.sin(yaw)
      const cosYaw = Math.cos(yaw)
      const tipBend = Math.random() * Math.PI * 2
      const sinTip = Math.sin(tipBend)
      const cosTip = Math.cos(tipBend)

      // Per-blade attributes
      const bladeRand = Math.random()
      const windAngle = clumpWindAngle + (Math.random() - 0.5) * windAngleJitter

      // Lean outward from clump center — outer blades fan out
      const leanDirX = cx - clumpX
      const leanDirZ = cz - clumpZ
      const leanDist = Math.sqrt(leanDirX * leanDirX + leanDirZ * leanDirZ)
      const leanFactor = leanDist > 0.001 ? (spreadDist / Math.max(clumpRadius, 0.01)) * 0.18 : 0
      const leanX = leanDist > 0.001 ? (leanDirX / leanDist) * leanFactor : 0
      const leanZ = leanDist > 0.001 ? (leanDirZ / leanDist) * leanFactor : 0

      // Field UV for texture sampling
      const fieldU = (cx + FIELD_WIDTH * 0.5) / FIELD_WIDTH
      const fieldV = (cz - (FIELD_OFFSET_Z - FIELD_DEPTH * 0.5)) / FIELD_DEPTH

      const halfW = bladeWidth * 0.5
      const halfMid = midWidth * 0.5
      const p = i * 15

      // BL (bottom left)
      posArray[p]     = cx + sinYaw * halfW
      posArray[p + 1] = terrainY
      posArray[p + 2] = cz - cosYaw * halfW
      // BR (bottom right)
      posArray[p + 3] = cx - sinYaw * halfW
      posArray[p + 4] = terrainY
      posArray[p + 5] = cz + cosYaw * halfW
      // TR (mid height + outward lean)
      posArray[p + 6]  = cx - sinYaw * halfMid + leanX * height * 0.5
      posArray[p + 7]  = terrainY + height * 0.5
      posArray[p + 8]  = cz + cosYaw * halfMid + leanZ * height * 0.5
      // TL (mid height + outward lean)
      posArray[p + 9]  = cx + sinYaw * halfMid + leanX * height * 0.5
      posArray[p + 10] = terrainY + height * 0.5
      posArray[p + 11] = cz - cosYaw * halfMid + leanZ * height * 0.5
      // TC (tip + outward lean + random bend)
      posArray[p + 12] = cx + sinTip * tipOffset + leanX * height
      posArray[p + 13] = terrainY + height
      posArray[p + 14] = cz - cosTip * tipOffset + leanZ * height

      // UVs — all 5 verts share the same field position
      const u = i * 10
      for (let v = 0; v < 5; v++) {
        uvArray[u + v * 2]     = fieldU
        uvArray[u + v * 2 + 1] = fieldV
      }

      // Vertex colors: black(base), gray(mid), white(tip)
      const c = i * 15
      colorArray[c]     = 0; colorArray[c + 1]  = 0; colorArray[c + 2]  = 0
      colorArray[c + 3] = 0; colorArray[c + 4]  = 0; colorArray[c + 5]  = 0
      colorArray[c + 6] = 0.5; colorArray[c + 7]  = 0.5; colorArray[c + 8]  = 0.5
      colorArray[c + 9] = 0.5; colorArray[c + 10] = 0.5; colorArray[c + 11] = 0.5
      colorArray[c + 12] = 1;  colorArray[c + 13] = 1;   colorArray[c + 14] = 1

      // Per-blade attributes (same value across all 5 verts of a blade)
      const ab = i * 5
      for (let v = 0; v < 5; v++) {
        bladeRandArray[ab + v]  = bladeRand
        windAngleArray[ab + v]  = windAngle
        clumpPhaseArray[ab + v] = clumpPhase
      }

      // Indices (3 triangles)
      const vb = i * 5
      const ix = i * 9
      indexArray[ix]     = vb;     indexArray[ix + 1] = vb + 1; indexArray[ix + 2] = vb + 2
      indexArray[ix + 3] = vb + 2; indexArray[ix + 4] = vb + 4; indexArray[ix + 5] = vb + 3
      indexArray[ix + 6] = vb + 3; indexArray[ix + 7] = vb;     indexArray[ix + 8] = vb + 2
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))
  geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))
  geometry.setAttribute('aBladeRand', new THREE.BufferAttribute(bladeRandArray, 1))
  geometry.setAttribute('aWindAngle', new THREE.BufferAttribute(windAngleArray, 1))
  geometry.setAttribute('aClumpPhase', new THREE.BufferAttribute(clumpPhaseArray, 1))
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1))
  geometry.computeVertexNormals()
  return geometry
}

const textureLoader = new THREE.TextureLoader()

export default function GrassField() {
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const terrain = useTerrainParams()

  // --- Geometry params (changing these regenerates the field) ---
  const geoParams = useControls('Grass Geometry', {
    bladeCount:      { value: 1_000_000, min: 50_000, max: 2_000_000, step: 50_000 },
    bladesPerClump:  { value: 15, min: 3, max: 40, step: 1 },
    clumpRadius:     { value: 0.45, min: 0.05, max: 2.0, step: 0.05 },
    bladeWidth:      { value: 0.2, min: 0.02, max: 0.25, step: 0.01 },
    bladeHeight:     { value: 0.7, min: 0.1, max: 1.5, step: 0.05 },
    heightVariation: { value: 0.4, min: 0, max: 1.0, step: 0.05 },
    tipOffset:       { value: 0.1, min: 0, max: 0.4, step: 0.02 },
    windAngleJitter: { value: 1.2, min: 0, max: 3.14, step: 0.1 },
  })

  // --- Wind params (real-time uniform updates) ---
  const windParams = useControls('Grass Wind', {
    windStrength: { value: 0.5, min: 0, max: 3.0, step: 0.05 },
    windSpeed:    { value: 1.0, min: 0, max: 5.0, step: 0.1 },
  })

  // --- Appearance params (real-time uniform updates) ---
  const vizParams = useControls('Grass Appearance', {
    contrast:           { value: 1.0, min: 0.5, max: 3.0, step: 0.05 },
    brightness:         { value: -0.3, min: -0.3, max: 0.5, step: 0.02 },
    backlightIntensity: { value: 3.0, min: 0, max: 3.0, step: 0.1 },
    tipGlow:            { value: 0, min: 0, max: 0.3, step: 0.01 },
    baseDarken:         { value: 0.9, min: 0, max: 0.9, step: 0.05 },
    fogNear:            { value: 45, min: 0, max: 60, step: 1 },
    fogFar:             { value: 115, min: 20, max: 200, step: 5 },
  })

  const grassTexture = useMemo(() => {
    const tex = textureLoader.load('/grass_texture2.png')
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])

  const geometry = useMemo(
    () => generateGrassGeometry({ ...geoParams, terrain }),
    [
      geoParams.bladeCount, geoParams.bladesPerClump, geoParams.clumpRadius,
      geoParams.bladeWidth, geoParams.bladeHeight, geoParams.heightVariation,
      geoParams.tipOffset, geoParams.windAngleJitter,
      terrain.largeAmp, terrain.mediumAmp, terrain.smallAmp,
    ],
  )

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime:               { value: 0 },
        uWindStrength:       { value: 1.0 },
        uGrassTexture:       { value: grassTexture },
        uContrast:           { value: 1.4 },
        uBrightness:         { value: 0.08 },
        uBacklightIntensity: { value: 1.0 },
        uTipGlow:            { value: 0.08 },
        uBaseDarken:         { value: 0.35 },
        uFogColor:           { value: new THREE.Color('#f2f2f0') },
        uFogNear:            { value: 15 },
        uFogFar:             { value: 75 },
      },
      vertexColors: true,
      side: THREE.DoubleSide,
    })
    materialRef.current = mat
    return mat
  }, [grassTexture])

  useFrame(({ clock }) => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uTime.value = clock.getElapsedTime() * windParams.windSpeed
    mat.uniforms.uWindStrength.value = windParams.windStrength
    mat.uniforms.uContrast.value = vizParams.contrast
    mat.uniforms.uBrightness.value = vizParams.brightness
    mat.uniforms.uBacklightIntensity.value = vizParams.backlightIntensity
    mat.uniforms.uTipGlow.value = vizParams.tipGlow
    mat.uniforms.uBaseDarken.value = vizParams.baseDarken
    mat.uniforms.uFogNear.value = vizParams.fogNear
    mat.uniforms.uFogFar.value = vizParams.fogFar
  })

  return (
    <mesh geometry={geometry} material={material} frustumCulled={false} />
  )
}
