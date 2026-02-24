# Holasmart ESP32 - 1.28" Round Display + SG90 Servo

Example ESPHome config for a Holasmart ESP32 unit with:
- **1.28" round LCD** – GC9A01, 240×240, 4-wire SPI
- **SG90 servo** – used as a "neck" for tilting/panning

## Structure

- `device.yaml` – main device config (WiFi, display, servo)
- `pinouts/holasmart_esp32_1.28.yaml` – pin definitions (edit for your board)

## Usage

```bash
esphome run device.yaml
```

## Pinout (default)

| Function   | GPIO |
|-----------|------|
| Display SCLK | 18 |
| Display MOSI | 23 |
| Display CS   | 5  |
| Display DC   | 2  |
| Display RST  | 4  |
| Display BL   | 15 |
| Servo       | 13 |

Adjust pins in `pinouts/holasmart_esp32_1.28.yaml` if your unit differs.
