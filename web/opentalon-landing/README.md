## OpenTalon landing (telemetry-driven 3D)

This is a standalone landing page app intended to be embedded into `OpenTalon.com`.

It renders an isometric 45° "sliced" Raspberry Pi–like internal diorama. **All motion/lighting is driven by live telemetry** (MQTT over WebSockets). When telemetry is missing, the scene stays in an explicit idle / "no data" state (no fake numbers).

### Run locally

```bash
cd web/opentalon-landing
cp .env.example .env.local
npm install
npm run dev
```

### Environment variables

- **`VITE_MQTT_URL`**: `ws://` or `wss://` MQTT broker WebSocket URL
  - Example: `wss://mqtt.example.com:8084/mqtt`
- **`VITE_MQTT_USERNAME`** / **`VITE_MQTT_PASSWORD`**: optional
- **`VITE_MQTT_CLIENT_ID_PREFIX`**: optional (defaults to `opentalon-web`)
- **`VITE_MQTT_TOPIC_ROOT`**: root/prefix for telemetry topics
  - Default: `opentalon/rpi5`

### MQTT topics

The app subscribes to a fixed topic set derived from `VITE_MQTT_TOPIC_ROOT` and expects numeric payloads (either plain text numbers or JSON like `{ "value": 42.1 }`) on these topics:

- `${root}/cpu/percent`:
  - `{ "value": 42.1 }`
- `${root}/memory/percent`:
  - `{ "value": 63.7 }`
- `${root}/temp/c`:
  - `{ "value": 58.2 }`
- `${root}/power/amp`:
  - `{ "value": 1.4 }`
- `${root}/power/volt`:
  - `{ "value": 5.05 }`

Additionally, the scene will react to activity-style topics:

- `${root}/net/rx_bps`, `${root}/net/tx_bps`
- `${root}/usb/rx_bps`, `${root}/usb/tx_bps`

### Production build

```bash
cd web/opentalon-landing
npm run build
npm run preview
```

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
