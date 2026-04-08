import { useMemo, useSyncExternalStore } from 'react'
import type { TelemetryField, TelemetrySnapshot, TelemetryStatus } from './types'

type Listener = () => void

function field<T>(topic?: string): TelemetryField<T> {
  return { topic }
}

const DEFAULT_SNAPSHOT: TelemetrySnapshot = Object.freeze({
  mqtt: { status: 'idle' },
  cpu: { percent: field<number>() },
  memory: { usedPercent: field<number>() },
  thermal: { celsius: field<number>() },
  power: { volts: field<number>(), amps: field<number>() },
  network: { rxBytesPerSec: field<number>(), txBytesPerSec: field<number>() },
  usb: { rxBytesPerSec: field<number>(), txBytesPerSec: field<number>() },
  rawTopics: {},
})

function patchField(
  prev: TelemetrySnapshot,
  patcher: (draft: TelemetrySnapshot) => void,
): TelemetrySnapshot {
  const next: TelemetrySnapshot = structuredClone(prev)
  patcher(next)
  return next
}

class TelemetryStore {
  private listeners_ = new Set<Listener>()
  private snapshot_: TelemetrySnapshot = DEFAULT_SNAPSHOT

  getSnapshot(): TelemetrySnapshot {
    return this.snapshot_
  }

  subscribe(listener: Listener) {
    this.listeners_.add(listener)
    return () => this.listeners_.delete(listener)
  }

  private emit_() {
    for (const l of this.listeners_) l()
  }

  setMqtt(status: TelemetryStatus, brokerUrl?: string, reason?: string) {
    this.setMqttStatus(status, brokerUrl, reason)
  }

  setMqttStatus(status: TelemetryStatus, brokerUrl?: string, reason?: string) {
    const next = patchField(this.snapshot_, (d) => {
      d.mqtt.status = status
      d.mqtt.brokerUrl = brokerUrl
      d.mqtt.reason = reason
    })
    this.snapshot_ = next
    this.emit_()
  }

  setRawTopic(topic: string, payload: unknown) {
    const next = patchField(this.snapshot_, (d) => {
      d.mqtt.lastMessageAtMs = Date.now()
      d.rawTopics[topic] = payload
    })
    this.snapshot_ = next
    this.emit_()
  }

  setNumeric(path: (draft: TelemetrySnapshot) => TelemetryField<number>, topic: string, value: number | undefined) {
    const next = patchField(this.snapshot_, (d) => {
      const f = path(d)
      f.topic = topic
      f.updatedAtMs = Date.now()
      if (value === undefined) delete f.value
      else f.value = value
      d.mqtt.lastMessageAtMs = f.updatedAtMs
    })
    this.snapshot_ = next
    this.emit_()
  }
}

export const telemetryStore = new TelemetryStore()

export function useTelemetry() {
  return useSyncExternalStore(
    (cb) => telemetryStore.subscribe(cb),
    () => telemetryStore.getSnapshot(),
    () => telemetryStore.getSnapshot(),
  )
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function useTelemetryDerived() {
  const snap = useTelemetry()
  return useMemo(() => {
    const hasAnyData =
      snap.cpu.percent.value !== undefined ||
      snap.memory.usedPercent.value !== undefined ||
      snap.thermal.celsius.value !== undefined ||
      snap.power.amps.value !== undefined ||
      snap.power.volts.value !== undefined ||
      snap.network.rxBytesPerSec.value !== undefined ||
      snap.network.txBytesPerSec.value !== undefined ||
      snap.usb.rxBytesPerSec.value !== undefined ||
      snap.usb.txBytesPerSec.value !== undefined

    const memPct =
      snap.memory.usedPercent.value !== undefined ? clamp(snap.memory.usedPercent.value, 0, 100) : undefined

    const connected = snap.mqtt.status === 'connected'
    return { snap, memPct, hasAnyData, connected }
  }, [snap])
}

