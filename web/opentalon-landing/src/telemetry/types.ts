export type TelemetryStatus =
  | 'idle'
  | 'disabled'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export type TelemetryField<T> = {
  value?: T
  updatedAtMs?: number
  topic?: string
}

export type TelemetrySnapshot = {
  mqtt: {
    status: TelemetryStatus
    brokerUrl?: string
    reason?: string
    lastMessageAtMs?: number
  }
  cpu: {
    percent: TelemetryField<number>
  }
  memory: {
    usedPercent: TelemetryField<number>
  }
  thermal: {
    celsius: TelemetryField<number>
  }
  power: {
    volts: TelemetryField<number>
    amps: TelemetryField<number>
  }
  network: {
    rxBytesPerSec: TelemetryField<number>
    txBytesPerSec: TelemetryField<number>
  }
  usb: {
    rxBytesPerSec: TelemetryField<number>
    txBytesPerSec: TelemetryField<number>
  }
  rawTopics: Record<string, unknown>
}

