import { useMemo } from 'react'
import { useTelemetry } from '../telemetry/store'
import styles from './TelemetryHud.module.css'

function fmtNum(v: number | undefined, digits = 1) {
  if (v === undefined || !Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

function fmtBytesPerSec(v: number | undefined) {
  if (v === undefined || !Number.isFinite(v)) return '—'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'] as const
  let x = Math.max(0, v)
  let u = 0
  while (x >= 1024 && u < units.length - 1) {
    x /= 1024
    u++
  }
  return `${x.toFixed(u === 0 ? 0 : 1)} ${units[u]}`
}

export function TelemetryHud() {
  const t = useTelemetry()
  const now = t.mqtt.lastMessageAtMs ?? 0

  const connected = t.mqtt.status === 'connected'
  const lastAgeMs = t.mqtt.lastMessageAtMs ? Math.max(0, now - t.mqtt.lastMessageAtMs) : null
  const last = lastAgeMs == null ? '—' : lastAgeMs < 1000 ? `${lastAgeMs} ms` : `${(lastAgeMs / 1000).toFixed(1)} s`

  const hasAny = useMemo(() => {
    return (
      t.cpu.percent.value !== undefined ||
      t.memory.usedPercent.value !== undefined ||
      t.thermal.celsius.value !== undefined ||
      t.power.amps.value !== undefined ||
      t.power.volts.value !== undefined ||
      t.network.rxBytesPerSec.value !== undefined ||
      t.network.txBytesPerSec.value !== undefined ||
      t.usb.rxBytesPerSec.value !== undefined ||
      t.usb.txBytesPerSec.value !== undefined
    )
  }, [t])

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.hTitle}>Telemetry</div>
        <div className={styles.badges}>
          <div className={`${styles.badge} ${connected ? styles.badgeOk : styles.badgeWarn}`}>
            {connected ? 'CONNECTED' : t.mqtt.status.toUpperCase()}
          </div>
          <div className={styles.badge}>LAST: {last}</div>
        </div>
      </div>

      {!connected && (
        <div className={styles.notice}>
          Waiting for MQTT over WebSockets. The diorama stays idle until real values arrive.
        </div>
      )}
      {connected && !hasAny && <div className={styles.notice}>Connected, but no matching topics have arrived yet.</div>}

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>CPU / Engine</div>
          <div className={styles.row}>
            <div className={styles.label}>CPU%</div>
            <div className={styles.value}>{fmtNum(t.cpu.percent.value, 1)}%</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Memory / Neurons</div>
          <div className={styles.row}>
            <div className={styles.label}>Mem%</div>
            <div className={styles.value}>{fmtNum(t.memory.usedPercent.value, 1)}%</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Thermal / Boiler</div>
          <div className={styles.row}>
            <div className={styles.label}>Temp</div>
            <div className={styles.value}>{fmtNum(t.thermal.celsius.value, 1)} °C</div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>V</div>
            <div className={styles.value}>{fmtNum(t.power.volts.value, 2)} V</div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>A</div>
            <div className={styles.value}>{fmtNum(t.power.amps.value, 2)} A</div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Links / Flow</div>
          <div className={styles.row}>
            <div className={styles.label}>NET RX</div>
            <div className={styles.value}>{fmtBytesPerSec(t.network.rxBytesPerSec.value)}</div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>NET TX</div>
            <div className={styles.value}>{fmtBytesPerSec(t.network.txBytesPerSec.value)}</div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>USB RX</div>
            <div className={styles.value}>{fmtBytesPerSec(t.usb.rxBytesPerSec.value)}</div>
          </div>
          <div className={styles.row}>
            <div className={styles.label}>USB TX</div>
            <div className={styles.value}>{fmtBytesPerSec(t.usb.txBytesPerSec.value)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

