# Hosyond Voice Radar Backend

Realtime processing backend for the offshoot project.

## Features

- Subscribes to ESPHome radar feed over MQTT (`.../radar/raw`)
- Tracks moving objects and builds occupancy confidence map
- Publishes processed state back to MQTT (`.../radar/processed`)
- Serves WebSocket stream for 3D web viewer
- Exposes room and scanned-item APIs for configuration

## Run

```bash
cd offshoot/hosyond-voice-radar/backend
python3 -m pip install -r requirements.txt
python3 server.py
```

## Environment variables

- `MQTT_BROKER` (default `127.0.0.1`)
- `MQTT_PORT` (default `1883`)
- `MQTT_USERNAME` (optional)
- `MQTT_PASSWORD` (optional)
- `MQTT_TOPIC_RAW` (default `hosyond/voice-radar/radar/raw`)
- `MQTT_TOPIC_STATE` (default `hosyond/voice-radar/radar/processed`)
- `HTTP_HOST` (default `0.0.0.0`)
- `HTTP_PORT` (default `8090`)
- `WS_PATH` (default `/ws`)

## REST APIs

- `GET /health`
- `GET /state`
- `GET /config/room`
- `POST /config/room`
- `GET /items`
- `POST /items`
- `DELETE /items/{item_id}`
