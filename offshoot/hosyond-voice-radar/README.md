# Hosyond Voice + Radar Offshoot

This offshoot project provides an end-to-end starting stack for:

- ESPHome firmware on a Hosyond ESP32-S3 board with integrated 2.8" display.
- Voice assistant avatar UI and live radar page on-device.
- MQTT pipeline for raw and processed radar data.
- FastAPI backend for room mapping and scanned-item management.
- WebSocket-powered Three.js 3D web app for room visualization.

## Structure

- `firmware/hosyond_voice_radar.yaml`
  - Display GUI (voice + radar pages)
  - Touchscreen page switching and voice trigger
  - Voice assistant + ES8311 codec + I2S mic/speaker
  - LD2450 radar sensors and periodic MQTT JSON publishing
  - MQTT + Web Server enabled
- `backend/server.py`
  - Subscribes to raw radar MQTT topic
  - Tracks moving objects in room space
  - Maintains occupancy map + scanned item list
  - Publishes processed state back to MQTT
  - Exposes REST endpoints and WebSocket stream
- `webapp/`
  - Three.js 3D room view
  - Renders occupancy heat tiles, moving objects, and scanned items
  - UI forms for room dimensions and item placement

## Quick start

### 1) Firmware

1. Copy and adjust `firmware/hosyond_voice_radar.yaml` substitutions (WiFi, MQTT creds).
2. Validate:

```bash
python3 -m esphome config offshoot/hosyond-voice-radar/firmware/hosyond_voice_radar.yaml
```

3. Compile/flash using ESPHome workflow.

### 2) Backend

```bash
python3 -m pip install -r offshoot/hosyond-voice-radar/backend/requirements.txt
python3 offshoot/hosyond-voice-radar/backend/server.py
```

Optional environment variables:

- `MQTT_BROKER`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- `MQTT_TOPIC_RAW` (default `hosyond/voice-radar/radar/raw`)
- `MQTT_TOPIC_STATE` (default `hosyond/voice-radar/radar/processed`)
- `HTTP_HOST` (default `0.0.0.0`)
- `HTTP_PORT` (default `8090`)
- `WS_PATH` (default `/ws`)

### 3) Webapp

Serve `webapp/` as static files (any static server), then open in browser:

- Ensure backend is reachable (default `http://localhost:8090`)
- Live view consumes `ws://localhost:8090/ws`

Example:

```bash
python3 -m http.server 8081 -d offshoot/hosyond-voice-radar/webapp
```

Then open:

```
http://localhost:8081
```

## Notes

- Pin assignments are chosen to avoid collisions between I2S and LD2450 UART.
- ESPHome warns on strapping pins 45/46; this is expected for current display/backlight wiring.
- Room and scanned-item APIs are available in backend README.
