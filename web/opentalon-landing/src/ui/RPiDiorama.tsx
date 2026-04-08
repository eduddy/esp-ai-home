import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useMemo, useRef } from 'react'
import { useTelemetryDerived } from '../telemetry/store'

function clamp01(v: number) {
  if (Number.isNaN(v)) return 0
  return Math.max(0, Math.min(1, v))
}

function map01(v: number, inMin: number, inMax: number) {
  const t = (v - inMin) / (inMax - inMin)
  return clamp01(t)
}

function DioramaInner() {
  const { snap, memPct, hasAnyData } = useTelemetryDerived()

  const groupRef = useRef<THREE.Group>(null)
  const cpuRotorRef = useRef<THREE.Group>(null)
  const neuronPointsRef = useRef<THREE.Points>(null)
  const boilerGlowRef = useRef<THREE.MeshStandardMaterial>(null)
  const dataFlowRef = useRef<THREE.Group>(null)

  const { neuronGeom, neuronMat } = useMemo(() => {
    // Deterministic RNG scoped to this memoization (no Math.random, no ref access during render).
    let rng = 0x1234abcd >>> 0
    const rand = () => {
      // Xorshift32
      let x = rng | 0
      x ^= x << 13
      x ^= x >>> 17
      x ^= x << 5
      rng = x >>> 0
      return (rng & 0xffffffff) / 0x100000000
    }
    const count = 900
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 1.1
      const y = (rand() - 0.5) * 0.7
      const z = (rand() - 0.5) * 0.9
      positions[i * 3 + 0] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
    }
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      size: 0.014,
      color: new THREE.Color('#67e8f9'),
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
    return { neuronGeom: geom, neuronMat: mat }
  }, [])

  const flowGeom = useMemo(() => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i < 20; i++) points.push(new THREE.Vector3(-1.35 + i * 0.07, -0.3, 0.6))
    return { points }
  }, [])

  useFrame((state, delta) => {
    const cpuPct = snap.cpu.percent.value
    const tempC = snap.thermal.celsius.value
    const amp = snap.power.amps.value
    const vSupply = snap.power.volts.value
    const netRxBps = snap.network.rxBytesPerSec.value
    const netTxBps = snap.network.txBytesPerSec.value
    const usbRxBps = snap.usb.rxBytesPerSec.value
    const usbTxBps = snap.usb.txBytesPerSec.value

    const cpuT = cpuPct == null ? 0 : map01(cpuPct, 0, 100)
    const memT = memPct == null ? 0 : map01(memPct, 0, 100)
    const tempT = tempC == null ? 0 : map01(tempC, 30, 85)
    const powerT =
      amp != null && vSupply != null
        ? clamp01(map01(amp * vSupply, 0, 20))
        : amp != null
          ? map01(amp, 0, 5)
          : 0
    const netMaxBps = Math.max(netRxBps ?? 0, netTxBps ?? 0)
    const usbMaxBps = Math.max(usbRxBps ?? 0, usbTxBps ?? 0)
    const netT = netMaxBps <= 0 ? 0 : clamp01(map01(netMaxBps / 1_000_000, 0, 150))
    const usbT = usbMaxBps <= 0 ? 0 : clamp01(map01(usbMaxBps / 1_000_000, 0, 600))

    const visible = snap.mqtt.status === 'connected' && hasAnyData

    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, Math.PI / 4, 0.08)
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -0.55, 0.08)
    }
    if (cpuRotorRef.current) {
      const spin = visible ? 1.5 + cpuT * 18 : 0
      cpuRotorRef.current.rotation.y += delta * spin
      cpuRotorRef.current.rotation.x += delta * (spin * 0.25)
    }
    if (neuronPointsRef.current) {
      const mat = neuronPointsRef.current.material as THREE.PointsMaterial
      const base = visible ? 0.12 : 0.0
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, base + memT * 0.65, 0.08)
      mat.size = THREE.MathUtils.lerp(mat.size, 0.012 + memT * 0.02, 0.08)
      neuronPointsRef.current.rotation.z += delta * (visible ? 0.12 + memT * 0.9 : 0)
    }
    if (boilerGlowRef.current) {
      const intensity = visible ? 0.15 + tempT * 2.2 + powerT * 1.1 : 0.0
      boilerGlowRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        boilerGlowRef.current.emissiveIntensity ?? 0,
        intensity,
        0.08,
      )
      const hue = visible ? THREE.MathUtils.lerp(0.02, 0.12, tempT) : 0.0
      boilerGlowRef.current.emissive = new THREE.Color().setHSL(hue, 1.0, 0.55)
    }
    if (dataFlowRef.current) {
      const t = Math.max(netT, usbT)
      const opacity = visible ? 0.05 + t * 0.7 : 0.0
      // opacity handled via Line's material ref by setting group opacity through scale+visibility only
      const pulse = visible ? 0.6 + t * 1.2 : 0
      const s = 1 + 0.05 * Math.sin(state.clock.elapsedTime * (pulse * 2.5))
      dataFlowRef.current.scale.setScalar(THREE.MathUtils.lerp(dataFlowRef.current.scale.x, s, 0.08))
      dataFlowRef.current.visible = visible && opacity > 0.01
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {/* Outer case slice */}
      <mesh position={[0, 0.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.4, 1.3]} />
        <meshStandardMaterial color="#0b1020" metalness={0.15} roughness={0.6} />
      </mesh>

      {/* Cutaway volume (visual cue) */}
      <mesh position={[0.65, 0.06, 0.0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 1.26, 1.18]} />
        <meshStandardMaterial color="#020617" metalness={0.1} roughness={0.35} transparent opacity={0.55} />
      </mesh>

      {/* PCB */}
      <mesh position={[-0.15, -0.42, 0.0]} castShadow receiveShadow>
        <boxGeometry args={[1.75, 0.08, 1.15]} />
        <meshStandardMaterial color="#0b3b2e" metalness={0.1} roughness={0.7} />
      </mesh>

      {/* CPU engine bay */}
      <group position={[-0.55, -0.21, 0.12]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.52, 0.2, 0.52]} />
          <meshStandardMaterial color="#111827" metalness={0.5} roughness={0.35} />
        </mesh>
        <group ref={cpuRotorRef} position={[0, 0.12, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.06, 24]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.25} />
          </mesh>
          <mesh castShadow position={[0.22, 0.0, 0]}>
            <boxGeometry args={[0.34, 0.03, 0.05]} />
            <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.2} />
          </mesh>
          <mesh castShadow position={[-0.22, 0.0, 0]}>
            <boxGeometry args={[0.34, 0.03, 0.05]} />
            <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.2} />
          </mesh>
        </group>
      </group>

      {/* Memory: pointcloud neurons */}
      <group position={[0.05, -0.06, -0.22]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.9, 0.35, 0.6]} />
          <meshStandardMaterial color="#0b1223" metalness={0.25} roughness={0.45} />
        </mesh>
        <points ref={neuronPointsRef} geometry={neuronGeom} material={neuronMat} position={[0, 0.12, 0]} />
      </group>

      {/* Boiler room: temp/power */}
      <group position={[0.62, -0.18, 0.12]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.62, 0.52, 0.56]} />
          <meshStandardMaterial color="#0a0f1f" metalness={0.2} roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.6, 24]} />
          <meshStandardMaterial
            ref={boilerGlowRef}
            color="#111827"
            emissive="#f97316"
            emissiveIntensity={0.0}
            metalness={0.35}
            roughness={0.35}
          />
        </mesh>
        <mesh castShadow position={[0.2, -0.06, -0.18]}>
          <torusGeometry args={[0.12, 0.025, 10, 22]} />
          <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.12} />
        </mesh>
      </group>

      {/* Data network + USB links */}
      <group ref={dataFlowRef} position={[0.25, 0.1, 0.55]}>
        <Line points={flowGeom.points} color="#a78bfa" lineWidth={1} transparent opacity={0.8} />
        <mesh position={[-1.38, -0.3, 0.6]}>
          <sphereGeometry args={[0.04, 14, 14]} />
          <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[0.0, -0.3, 0.6]}>
          <sphereGeometry args={[0.04, 14, 14]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.18} />
        </mesh>
      </group>
    </group>
  )
}

export function RPiDiorama() {
  return <DioramaInner />
}

