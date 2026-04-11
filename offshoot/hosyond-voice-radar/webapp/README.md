# Hosyond Voice Radar 3D Webapp

This webapp renders live radar state and configured room items in 3D.

## Features

- Live WebSocket updates from backend (`/ws`)
- Room size/grid configuration UI
- Scanned item CRUD controls
- Occupancy heatmap points
- Tracked moving objects and raw radar targets

## Run

Serve this folder with any static web server (example):

```bash
python3 -m http.server 8081
```

Open:

```
http://localhost:8081
```

Configure backend URL in the top-left panel if needed.

The UI loads Three.js directly from a public CDN, so internet access is needed for that dependency unless you vendor it locally.
