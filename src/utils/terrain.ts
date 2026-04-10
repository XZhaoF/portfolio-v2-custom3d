import { useControls } from 'leva'

export interface TerrainParams {
  largeAmp: number
  mediumAmp: number
  smallAmp: number
}

export function useTerrainParams(): TerrainParams {
  return useControls('Terrain', {
    largeAmp:  { value: 3, min: 0, max: 5.0, step: 0.1 },
    mediumAmp: { value: 1.5, min: 0, max: 3.0, step: 0.05 },
    smallAmp:  { value: 0.4, min: 0, max: 1.5, step: 0.05 },
  })
}

export function getTerrainHeight(x: number, z: number, params: TerrainParams): number {
  const large  = Math.sin(x * 0.04) * Math.cos(z * 0.03) * params.largeAmp
  const medium = Math.sin(x * 0.09 + 1.7) * Math.cos(z * 0.07 + 0.9) * params.mediumAmp
  const small  = Math.sin(x * 0.22 + 3.1) * Math.cos(z * 0.18 + 2.3) * params.smallAmp
  return large + medium + small
}
