import { Canvas } from '@react-three/fiber'
import Scene from './components/Scene'

export default function App() {
  return (
    <>
      <Canvas
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 1.5]}
        camera={{
          fov: 60,
          near: 0.1,
          far: 200,
          position: [0, 1.6, 5],
        }}
      >
        <Scene />
      </Canvas>
      <div
        id="camera-info"
        style={{
          position: 'fixed',
          bottom: 16,
          left: 16,
          padding: '8px 14px',
          background: 'rgba(0,0,0,0.55)',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: 13,
          borderRadius: 6,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />
    </>
  )
}
