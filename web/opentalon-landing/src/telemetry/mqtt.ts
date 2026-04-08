import mqtt, { type IClientOptions, type MqttClient } from 'mqtt'
import { z } from 'zod'
import type { TelemetryTopics } from './env'
import { telemetryStore } from './store'

const PayloadSchema = z.union([
  z.number(),
  z.string(),
  z.object({ value: z.union([z.number(), z.string()]) }).passthrough(),
  z.object({ state: z.union([z.number(), z.string()]) }).passthrough(),
])

function parsePayload(raw: Uint8Array): unknown {
  const text = new TextDecoder().decode(raw)
  const trimmed = text.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    const asNumber = Number(trimmed)
    if (!Number.isNaN(asNumber) && trimmed.match(/^-?\d+(\.\d+)?$/)) return asNumber
    return trimmed
  }
}

function asNumber(v: unknown): number | undefined {
  const parsed = PayloadSchema.safeParse(v)
  if (!parsed.success) return undefined
  const val = parsed.data
  const raw =
    typeof val === 'object'
      ? (('value' in val && val.value) || ('state' in val && val.state))
      : val
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function subscribeTopicSet(client: MqttClient, topics: TelemetryTopics) {
  const set = new Set<string>()
  for (const topic of Object.values(topics)) if (topic) set.add(topic)
  if (set.size === 0) return
  client.subscribe(Array.from(set), { qos: 0 })
}

type ConnectArgs = {
  brokerUrl: string
  topics: TelemetryTopics
  clientIdPrefix: string
  username?: string
  password?: string
}

export function connectMqtt(args: ConnectArgs) {
  const { brokerUrl, topics, clientIdPrefix, username, password } = args
  const clientId = `${clientIdPrefix}-${Math.random().toString(16).slice(2)}`

  telemetryStore.setMqttStatus('connecting', brokerUrl)

  const opts: IClientOptions = {
    protocolVersion: 5,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    username: username || undefined,
    password: password || undefined,
    clientId,
  }

  const client = mqtt.connect(brokerUrl, opts)

  const ready = new Promise<void>((resolve, reject) => {
    client.once('connect', () => resolve())
    client.once('error', (e) => reject(e))
  })

  client.on('connect', () => {
    telemetryStore.setMqttStatus('connected', brokerUrl)
    subscribeTopicSet(client, topics)
  })
  client.on('reconnect', () => telemetryStore.setMqttStatus('connecting', brokerUrl))
  client.on('close', () => telemetryStore.setMqttStatus('disconnected', brokerUrl))
  client.on('error', (err) => telemetryStore.setMqttStatus('error', brokerUrl, err.message))

  client.on('message', (topic, payloadBytes) => {
    const payload = parsePayload(payloadBytes)
    const n = asNumber(payload)
    telemetryStore.setRawTopic(topic, payload)

    // map topic -> field
    const t = topics
    if (t.cpu_percent && topic === t.cpu_percent) telemetryStore.setNumeric((d) => d.cpu.percent, topic, n)
    else if (t.mem_percent && topic === t.mem_percent) telemetryStore.setNumeric((d) => d.memory.usedPercent, topic, n)
    else if (t.temp_c && topic === t.temp_c) telemetryStore.setNumeric((d) => d.thermal.celsius, topic, n)
    else if (t.amp && topic === t.amp) telemetryStore.setNumeric((d) => d.power.amps, topic, n)
    else if (t.v_supply && topic === t.v_supply) telemetryStore.setNumeric((d) => d.power.volts, topic, n)
    else if (t.net_rx_bps && topic === t.net_rx_bps) telemetryStore.setNumeric((d) => d.network.rxBytesPerSec, topic, n)
    else if (t.net_tx_bps && topic === t.net_tx_bps) telemetryStore.setNumeric((d) => d.network.txBytesPerSec, topic, n)
    else if (t.usb_rx_bps && topic === t.usb_rx_bps) telemetryStore.setNumeric((d) => d.usb.rxBytesPerSec, topic, n)
    else if (t.usb_tx_bps && topic === t.usb_tx_bps) telemetryStore.setNumeric((d) => d.usb.txBytesPerSec, topic, n)
  })

  const stop = () => {
    client.removeAllListeners()
    client.end(true)
    telemetryStore.setMqttStatus('idle', brokerUrl)
  }

  return { stop, ready }
}

