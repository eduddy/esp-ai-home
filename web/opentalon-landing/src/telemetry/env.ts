import { z } from 'zod'

const EnvSchema = z.object({
  VITE_MQTT_URL: z.string().min(1),
  VITE_MQTT_USERNAME: z.string().optional(),
  VITE_MQTT_PASSWORD: z.string().optional(),
  VITE_MQTT_CLIENT_ID_PREFIX: z.string().optional(),
  VITE_MQTT_TOPIC_ROOT: z.string().min(1).default('opentalon/rpi5'),

  // Optional Home Assistant WebSocket adapter (not required for baseline)
  VITE_HA_WS_URL: z.string().optional(),
  VITE_HA_TOKEN: z.string().optional(),
})

export type TelemetryEnv = {
  mqttUrl: string
  mqttUsername?: string
  mqttPassword?: string
  mqttClientIdPrefix: string
  topicRoot: string
  topics: TelemetryTopics
  haWsUrl?: string
  haToken?: string
}

export type TelemetryTopics = Readonly<{
  cpu_percent: string
  mem_percent: string
  temp_c: string
  v_supply: string
  amp: string
  net_rx_bps: string
  net_tx_bps: string
  usb_rx_bps: string
  usb_tx_bps: string
}>

function normalizeString(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length ? t : undefined
}

export function readEnv(): TelemetryEnv {
  const parsed = EnvSchema.safeParse(import.meta.env)
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw new Error(`Invalid env: ${details}`)
  }
  const env = parsed.data
  const topicRoot = env.VITE_MQTT_TOPIC_ROOT
  return {
    mqttUrl: env.VITE_MQTT_URL,
    mqttUsername: normalizeString(env.VITE_MQTT_USERNAME),
    mqttPassword: normalizeString(env.VITE_MQTT_PASSWORD),
    mqttClientIdPrefix: normalizeString(env.VITE_MQTT_CLIENT_ID_PREFIX) ?? 'opentalon-web',
    topicRoot,
    topics: buildTopics(topicRoot),
    haWsUrl: normalizeString(env.VITE_HA_WS_URL),
    haToken: normalizeString(env.VITE_HA_TOKEN),
  }
}

export function buildTopics(topicRoot: string): TelemetryTopics {
  const root = topicRoot.replace(/\/+$/, '')
  return Object.freeze({
    cpu_percent: `${root}/cpu/percent`,
    mem_percent: `${root}/memory/percent`,
    temp_c: `${root}/temp/c`,
    v_supply: `${root}/power/volt`,
    amp: `${root}/power/amp`,
    net_rx_bps: `${root}/net/rx_bps`,
    net_tx_bps: `${root}/net/tx_bps`,
    usb_rx_bps: `${root}/usb/rx_bps`,
    usb_tx_bps: `${root}/usb/tx_bps`,
  })
}
