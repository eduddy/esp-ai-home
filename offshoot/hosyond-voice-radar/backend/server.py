#!/usr/bin/env python3
"""Radar processing backend for Hosyond voice+rader offshoot project.

Consumes LD2450-derived MQTT payloads and publishes:
1) Processed room/object map summaries back to MQTT.
2) Live updates over WebSocket for 3D clients.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import Future
import json
import math
import os
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
from pydantic import BaseModel
import uvicorn


MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_TOPIC_RAW = os.getenv("MQTT_TOPIC_RAW", "hosyond/voice-radar/radar/raw")
MQTT_TOPIC_STATE = os.getenv("MQTT_TOPIC_STATE", "hosyond/voice-radar/radar/processed")
WEBSOCKET_PATH = os.getenv("WS_PATH", "/ws")
HTTP_HOST = os.getenv("HTTP_HOST", "0.0.0.0")
HTTP_PORT = int(os.getenv("HTTP_PORT", "8090"))


@dataclass
class Target:
    id: int
    x_mm: float
    y_mm: float
    distance_mm: float
    speed_mm_s: float
    object_id: str | None = None


@dataclass
class RoomObject:
    object_id: str
    x_mm: float
    y_mm: float
    vx_mm_s: float
    vy_mm_s: float
    confidence: float = 1.0
    last_seen_s: float = field(default_factory=time.time)

    def update(self, x_mm: float, y_mm: float, now_s: float) -> None:
        dt = max(now_s - self.last_seen_s, 1e-3)
        self.vx_mm_s = (x_mm - self.x_mm) / dt
        self.vy_mm_s = (y_mm - self.y_mm) / dt
        self.x_mm = x_mm
        self.y_mm = y_mm
        self.last_seen_s = now_s
        self.confidence = min(1.0, self.confidence + 0.15)

    def decay(self, dt_s: float) -> None:
        self.confidence = max(0.0, self.confidence - dt_s * 0.20)


@dataclass
class RoomConfig:
    width_mm: float = 5000.0
    height_mm: float = 5000.0
    grid_mm: float = 250.0
    occupancy_decay_s: float = 4.0


@dataclass
class ScannedItem:
    item_id: str
    name: str
    x_mm: float
    y_mm: float
    z_mm: float = 0.0
    category: str = "unknown"


class RadarProcessor:
    """Simple tracker and occupancy mapper for LD2450 point targets."""

    def __init__(self, room_cfg: RoomConfig):
        self.room_cfg = room_cfg
        self.objects: dict[str, RoomObject] = {}
        self.next_id = 1
        self.last_update_s = time.time()
        self.occupancy: dict[str, float] = {}
        self.scanned_items: dict[str, ScannedItem] = {}

    def set_room(self, *, width_mm: float, height_mm: float, grid_mm: float) -> None:
        self.room_cfg.width_mm = width_mm
        self.room_cfg.height_mm = height_mm
        self.room_cfg.grid_mm = grid_mm
        self.occupancy.clear()

    def upsert_item(
        self,
        *,
        item_id: str,
        name: str,
        x_mm: float,
        y_mm: float,
        z_mm: float,
        category: str,
    ) -> ScannedItem:
        item = ScannedItem(
            item_id=item_id,
            name=name,
            x_mm=x_mm,
            y_mm=y_mm,
            z_mm=z_mm,
            category=category,
        )
        self.scanned_items[item_id] = item
        return item

    def remove_item(self, item_id: str) -> bool:
        return self.scanned_items.pop(item_id, None) is not None

    def _grid_key(self, x_mm: float, y_mm: float) -> str:
        gx = int(round(x_mm / self.room_cfg.grid_mm))
        gy = int(round(y_mm / self.room_cfg.grid_mm))
        return f"{gx}:{gy}"

    def _distance_sq(self, x1: float, y1: float, x2: float, y2: float) -> float:
        dx = x1 - x2
        dy = y1 - y2
        return dx * dx + dy * dy

    def _match_object(self, target: Target) -> RoomObject | None:
        threshold_sq = 700.0 * 700.0
        best: RoomObject | None = None
        best_dist_sq = float("inf")
        for obj in self.objects.values():
            d_sq = self._distance_sq(target.x_mm, target.y_mm, obj.x_mm, obj.y_mm)
            if d_sq < threshold_sq and d_sq < best_dist_sq:
                best = obj
                best_dist_sq = d_sq
        return best

    def _prune_stale(self, now_s: float) -> None:
        dt_s = now_s - self.last_update_s
        for obj in self.objects.values():
            obj.decay(dt_s)
        self.objects = {k: v for k, v in self.objects.items() if v.confidence > 0.05}
        self.last_update_s = now_s

    def ingest(self, payload: dict[str, Any]) -> dict[str, Any]:
        now_s = time.time()
        self._prune_stale(now_s)

        targets_in: list[Target] = []
        for raw in payload.get("targets", []):
            try:
                targets_in.append(
                    Target(
                        id=int(raw.get("id", 0)),
                        x_mm=float(raw.get("x_mm", 0.0)),
                        y_mm=float(raw.get("y_mm", 0.0)),
                        distance_mm=float(raw.get("distance_mm", 0.0)),
                        speed_mm_s=float(raw.get("speed_mm_s", 0.0)),
                    )
                )
            except (TypeError, ValueError):
                continue

        for t in targets_in:
            matched = self._match_object(t)
            if matched is None:
                object_id = f"obj-{self.next_id}"
                self.next_id += 1
                matched = RoomObject(
                    object_id=object_id,
                    x_mm=t.x_mm,
                    y_mm=t.y_mm,
                    vx_mm_s=0.0,
                    vy_mm_s=0.0,
                )
                self.objects[object_id] = matched
            else:
                matched.update(t.x_mm, t.y_mm, now_s)
            t.object_id = matched.object_id

            # Occupancy confidence map updates
            key = self._grid_key(t.x_mm, t.y_mm)
            self.occupancy[key] = min(1.0, self.occupancy.get(key, 0.0) + 0.25)

        # Decay occupancy confidence
        decay_per_update = 1.0 / max(1.0, self.room_cfg.occupancy_decay_s * 4.0)
        next_occupancy: dict[str, float] = {}
        for key, conf in self.occupancy.items():
            conf2 = conf - decay_per_update
            if conf2 > 0.02:
                next_occupancy[key] = conf2
        self.occupancy = next_occupancy

        objects = [
            {
                "object_id": obj.object_id,
                "x_mm": obj.x_mm,
                "y_mm": obj.y_mm,
                "vx_mm_s": obj.vx_mm_s,
                "vy_mm_s": obj.vy_mm_s,
                "speed_mm_s": math.sqrt(obj.vx_mm_s * obj.vx_mm_s + obj.vy_mm_s * obj.vy_mm_s),
                "confidence": obj.confidence,
                "last_seen_s": obj.last_seen_s,
            }
            for obj in self.objects.values()
        ]

        out = {
            "schema": "hosyond.radar.processed.v1",
            "ts_s": now_s,
            "room": {
                "width_mm": self.room_cfg.width_mm,
                "height_mm": self.room_cfg.height_mm,
                "grid_mm": self.room_cfg.grid_mm,
            },
            "items": [
                {
                    "item_id": item.item_id,
                    "name": item.name,
                    "x_mm": item.x_mm,
                    "y_mm": item.y_mm,
                    "z_mm": item.z_mm,
                    "category": item.category,
                }
                for item in self.scanned_items.values()
            ],
            "raw_target_count": payload.get("target_count", len(targets_in)),
            "targets": [
                {
                    "id": t.id,
                    "object_id": t.object_id,
                    "x_mm": t.x_mm,
                    "y_mm": t.y_mm,
                    "distance_mm": t.distance_mm,
                    "speed_mm_s": t.speed_mm_s,
                }
                for t in targets_in
            ],
            "objects": objects,
            "occupancy": self.occupancy,
        }
        return out


class WsHub:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()
        self.latest: dict[str, Any] | None = None

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)
        if self.latest is not None:
            await ws.send_text(json.dumps(self.latest))

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        self.latest = payload
        message = json.dumps(payload)
        stale: list[WebSocket] = []
        for ws in self.clients:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self.disconnect(ws)


app = FastAPI(title="Hosyond Radar Backend", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
ws_hub = WsHub()
processor = RadarProcessor(RoomConfig())
event_loop: asyncio.AbstractEventLoop | None = None
publish_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
if MQTT_USERNAME:
    publish_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)


class RoomConfigRequest(BaseModel):
    width_mm: float
    height_mm: float
    grid_mm: float = 250.0


class ScannedItemRequest(BaseModel):
    item_id: str
    name: str
    x_mm: float
    y_mm: float
    z_mm: float = 0.0
    category: str = "unknown"


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/state")
def state() -> dict[str, Any]:
    return ws_hub.latest or {"status": "no-data"}


@app.get("/config/room")
def get_room_config() -> dict[str, float]:
    return {
        "width_mm": processor.room_cfg.width_mm,
        "height_mm": processor.room_cfg.height_mm,
        "grid_mm": processor.room_cfg.grid_mm,
    }


@app.post("/config/room")
async def set_room_config(req: RoomConfigRequest) -> dict[str, Any]:
    processor.set_room(
        width_mm=req.width_mm,
        height_mm=req.height_mm,
        grid_mm=req.grid_mm,
    )
    payload = {
        "schema": "hosyond.room.config.v1",
        "ts_s": time.time(),
        "room": {
            "width_mm": processor.room_cfg.width_mm,
            "height_mm": processor.room_cfg.height_mm,
            "grid_mm": processor.room_cfg.grid_mm,
        },
    }
    await ws_hub.broadcast(payload)
    return payload


@app.get("/items")
def list_items() -> list[dict[str, Any]]:
    return [
        {
            "item_id": item.item_id,
            "name": item.name,
            "x_mm": item.x_mm,
            "y_mm": item.y_mm,
            "z_mm": item.z_mm,
            "category": item.category,
        }
        for item in processor.scanned_items.values()
    ]


@app.post("/items")
async def upsert_item(req: ScannedItemRequest) -> dict[str, Any]:
    item = processor.upsert_item(
        item_id=req.item_id,
        name=req.name,
        x_mm=req.x_mm,
        y_mm=req.y_mm,
        z_mm=req.z_mm,
        category=req.category,
    )
    payload = {
        "schema": "hosyond.room.item.v1",
        "ts_s": time.time(),
        "item": {
            "item_id": item.item_id,
            "name": item.name,
            "x_mm": item.x_mm,
            "y_mm": item.y_mm,
            "z_mm": item.z_mm,
            "category": item.category,
        },
    }
    await ws_hub.broadcast(payload)
    return payload


@app.delete("/items/{item_id}")
async def delete_item(item_id: str) -> dict[str, Any]:
    removed = processor.remove_item(item_id)
    payload = {
        "schema": "hosyond.room.item.delete.v1",
        "ts_s": time.time(),
        "item_id": item_id,
        "removed": removed,
    }
    await ws_hub.broadcast(payload)
    return payload


@app.websocket(WEBSOCKET_PATH)
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws_hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_hub.disconnect(ws)


async def _handle_mqtt_payload(raw_payload: bytes) -> None:
    try:
        raw = json.loads(raw_payload.decode("utf-8"))
    except json.JSONDecodeError:
        return
    processed = processor.ingest(raw)
    await ws_hub.broadcast(processed)


def mqtt_thread(loop: asyncio.AbstractEventLoop) -> None:
    while True:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        if MQTT_USERNAME:
            client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        def on_connect(
            client: mqtt.Client,
            _userdata: Any,
            _flags: Any,
            reason_code: Any,
            _properties: Any = None,
        ) -> None:
            if int(reason_code) == 0:
                client.subscribe(MQTT_TOPIC_RAW, qos=0)

        def on_message(client: mqtt.Client, _userdata: Any, msg: mqtt.MQTTMessage) -> None:
            future: Future[Any] = asyncio.run_coroutine_threadsafe(
                _handle_mqtt_payload(msg.payload),
                loop,
            )
            try:
                future.result(timeout=1.0)
            except Exception:
                # Keep MQTT callback resilient even if processing fails.
                pass

        client.on_connect = on_connect
        client.on_message = on_message
        try:
            client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            client.loop_forever()
        except Exception:
            time.sleep(2.0)


async def mqtt_publish_loop() -> None:
    while True:
        await asyncio.sleep(0.25)
        if ws_hub.latest is None:
            continue
        try:
            info = publish_client.publish(
                MQTT_TOPIC_STATE,
                json.dumps(ws_hub.latest),
                qos=0,
                retain=False,
            )
            info.wait_for_publish(timeout=1.0)
        except Exception:
            continue


@app.on_event("startup")
async def on_startup() -> None:
    global event_loop
    event_loop = asyncio.get_running_loop()
    try:
        publish_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        publish_client.loop_start()
    except Exception:
        # Backend remains useful for WS/REST even when broker is offline.
        pass
    asyncio.create_task(asyncio.to_thread(mqtt_thread, event_loop))
    asyncio.create_task(mqtt_publish_loop())


@app.on_event("shutdown")
async def on_shutdown() -> None:
    publish_client.loop_stop()
    publish_client.disconnect()


def main() -> None:
    uvicorn.run(app, host=HTTP_HOST, port=HTTP_PORT, log_level="info")


if __name__ == "__main__":
    main()
