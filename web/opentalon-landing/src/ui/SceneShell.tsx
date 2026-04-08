import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import { connectMqtt } from '../telemetry/mqtt'
import { readEnv } from '../telemetry/env'
import { TelemetryHud } from './TelemetryHud'
import { RPiDiorama } from './RPiDiorama'
import styles from './SceneShell.module.css'

export function SceneShell() {
  const env = useMemo(() => readEnv(), [])
  const [connectError, setConnectError] = useState<string | null>(null)

  useEffect(() => {
    const { stop, ready } = connectMqtt({
      brokerUrl: env.mqttUrl,
      topics: env.topics,
      clientIdPrefix: env.mqttClientIdPrefix,
      username: env.mqttUsername,
      password: env.mqttPassword,
    })
    ready.catch((e) => setConnectError(String(e)))
    return () => stop()
  }, [env])

  return (
    <div className={styles.shell}>
      <div className={styles.bgGrid} aria-hidden="true" />
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandMark} aria-hidden="true" />
          <div>
            <div className={styles.title}>OpenTalon</div>
            <div className={styles.sub}>Sneak peek / Live system diorama</div>
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pill}>
            MQTT: <span className={styles.mono}>{env.mqttUrl}</span>
          </div>
          {connectError && <div className={styles.errorPill}>Connect error: {connectError}</div>}
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.stage}>
          <Canvas
            camera={{ position: [3.9, 3.2, 3.9], fov: 42, near: 0.1, far: 50 }}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={['#070810']} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[6, 7, 4]} intensity={1.15} />
            <directionalLight position={[-4, 2, -2]} intensity={0.35} color="#6cf" />
            <RPiDiorama />
            <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.55} maxPolarAngle={1.2} />
          </Canvas>
          <div className={styles.stageFrame} aria-hidden="true" />
        </section>

        <aside className={styles.hud}>
          <TelemetryHud />
        </aside>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          Render: isometric cutaway • Telemetry: MQTT only (no synthetic values)
        </div>
        <div className={styles.footerRight}>
          Theme: cyberpunk × LCARS • Entities: agentic holographics
        </div>
      </footer>
    </div>
  )
}

