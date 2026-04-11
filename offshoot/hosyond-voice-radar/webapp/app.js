const API_BASE = window.__API_BASE__ || "http://localhost:8090";
const WS_URL = window.__WS_URL__ || "ws://localhost:8090/ws";

const canvas = document.getElementById("scene");
const statusBadge = document.getElementById("statusBadge");
const targetCountEl = document.getElementById("targetCount");
const objectCountEl = document.getElementById("objectCount");
const itemCountEl = document.getElementById("itemCount");

const roomWidthInput = document.getElementById("roomWidth");
const roomHeightInput = document.getElementById("roomHeight");
const roomGridInput = document.getElementById("roomGrid");
const saveRoomBtn = document.getElementById("saveRoom");

const itemIdInput = document.getElementById("itemId");
const itemNameInput = document.getElementById("itemName");
const itemCategoryInput = document.getElementById("itemCategory");
const itemXInput = document.getElementById("itemX");
const itemYInput = document.getElementById("itemY");
const itemZInput = document.getElementById("itemZ");
const upsertItemBtn = document.getElementById("upsertItem");

const itemsList = document.getElementById("itemsList");
const feedEl = document.getElementById("feed");

let latestState = null;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1018);

const camera = new THREE.PerspectiveCamera(
  60,
  canvas.clientWidth / canvas.clientHeight,
  0.1,
  100
);
camera.position.set(0, 7, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
dirLight.position.set(5, 8, 6);
scene.add(dirLight);

scene.add(new THREE.GridHelper(20, 20, 0x336666, 0x224444));

const world = {
  room: null,
  occupancy: new Map(),
  objects: new Map(),
  targets: new Map(),
  items: new Map(),
};

function mmToWorld(v) {
  return v / 1000.0;
}

function upsertRoomMesh(room) {
  if (world.room) scene.remove(world.room);
  const width = Math.max(0.5, mmToWorld(room.width_mm));
  const height = Math.max(0.5, mmToWorld(room.height_mm));
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x123033,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  scene.add(mesh);
  world.room = mesh;
}

function createSphere(radius, color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 14),
    new THREE.MeshStandardMaterial({ color })
  );
}

function setStatus(text, color = "#73d09f") {
  statusBadge.textContent = text;
  statusBadge.style.color = color;
}

function appendFeed(line) {
  const stamp = new Date().toLocaleTimeString();
  feedEl.textContent = `[${stamp}] ${line}\n` + feedEl.textContent;
}

function updateOccupancyCells(occupancy, room) {
  for (const [, mesh] of world.occupancy) scene.remove(mesh);
  world.occupancy.clear();
  if (!occupancy || !room) return;

  const cellSize = Math.max(0.1, mmToWorld(room.grid_mm));
  for (const [key, conf] of Object.entries(occupancy)) {
    const [gx, gy] = key.split(":").map((x) => Number.parseInt(x, 10));
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(cellSize * 0.92, 0.02 + conf * 0.25, cellSize * 0.92),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.1 + conf * 0.9, 0.2 + conf * 0.6, 0.9 - conf * 0.5),
        transparent: true,
        opacity: 0.32 + conf * 0.45,
      })
    );
    mesh.position.set(gx * cellSize, 0.01 + conf * 0.125, gy * cellSize);
    scene.add(mesh);
    world.occupancy.set(key, mesh);
  }
}

function updateObjects(objects) {
  const seen = new Set();
  for (const obj of objects || []) {
    const id = obj.object_id;
    seen.add(id);
    let mesh = world.objects.get(id);
    if (!mesh) {
      mesh = createSphere(0.12, 0x54a8ff);
      scene.add(mesh);
      world.objects.set(id, mesh);
    }
    mesh.position.set(mmToWorld(obj.x_mm), 0.18, mmToWorld(obj.y_mm));
  }
  for (const [id, mesh] of world.objects) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      world.objects.delete(id);
    }
  }
}

function updateTargets(targets) {
  const seen = new Set();
  for (const t of targets || []) {
    const id = `t-${t.id}`;
    seen.add(id);
    let mesh = world.targets.get(id);
    if (!mesh) {
      mesh = createSphere(0.08, 0x49d050);
      scene.add(mesh);
      world.targets.set(id, mesh);
    }
    mesh.position.set(mmToWorld(t.x_mm), 0.08, mmToWorld(t.y_mm));
  }
  for (const [id, mesh] of world.targets) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      world.targets.delete(id);
    }
  }
}

function updateItems(items) {
  const seen = new Set();
  for (const item of items || []) {
    const id = item.item_id;
    seen.add(id);
    let mesh = world.items.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshStandardMaterial({ color: 0xffcb4d })
      );
      scene.add(mesh);
      world.items.set(id, mesh);
    }
    mesh.position.set(mmToWorld(item.x_mm), 0.12 + mmToWorld(item.z_mm), mmToWorld(item.y_mm));
  }
  for (const [id, mesh] of world.items) {
    if (!seen.has(id)) {
      scene.remove(mesh);
      world.items.delete(id);
    }
  }
}

function renderItemsList(items) {
  itemsList.innerHTML = "";
  for (const item of items || []) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    left.textContent = `${item.item_id}: ${item.name} (${item.category})`;
    const right = document.createElement("button");
    right.textContent = "Delete";
    right.addEventListener("click", () => deleteItem(item.item_id));
    li.appendChild(left);
    li.appendChild(right);
    itemsList.appendChild(li);
  }
}

function applyState(state) {
  latestState = state;
  if (state.room) {
    upsertRoomMesh(state.room);
  }
  updateOccupancyCells(state.occupancy, state.room);
  updateTargets(state.targets || []);
  updateObjects(state.objects || []);
  updateItems(state.items || []);
  renderItemsList(state.items || []);

  targetCountEl.textContent = String((state.targets || []).length);
  objectCountEl.textContent = String((state.objects || []).length);
  itemCountEl.textContent = String((state.items || []).length);
}

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function loadInitial() {
  try {
    const room = await fetchJson(`${API_BASE}/config/room`);
    roomWidthInput.value = Math.round(room.width_mm);
    roomHeightInput.value = Math.round(room.height_mm);
    roomGridInput.value = Math.round(room.grid_mm);
  } catch (err) {
    appendFeed(`Failed to load room config: ${err}`);
  }
  try {
    const state = await fetchJson(`${API_BASE}/state`);
    if (state && state.schema) applyState(state);
  } catch (err) {
    appendFeed(`No initial state yet: ${err}`);
  }
}

async function saveRoom() {
  const payload = {
    width_mm: Number(roomWidthInput.value),
    height_mm: Number(roomHeightInput.value),
    grid_mm: Number(roomGridInput.value),
  };
  try {
    const res = await fetchJson(`${API_BASE}/config/room`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    appendFeed(`Room updated: ${JSON.stringify(res.room)}`);
  } catch (err) {
    appendFeed(`Room update failed: ${err}`);
  }
}

async function upsertItem() {
  const payload = {
    item_id: itemIdInput.value.trim(),
    name: itemNameInput.value.trim() || "Unnamed Item",
    category: itemCategoryInput.value.trim() || "unknown",
    x_mm: Number(itemXInput.value),
    y_mm: Number(itemYInput.value),
    z_mm: Number(itemZInput.value),
  };
  if (!payload.item_id) {
    appendFeed("item_id is required");
    return;
  }
  try {
    const res = await fetchJson(`${API_BASE}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    appendFeed(`Item upserted: ${res.item.item_id}`);
  } catch (err) {
    appendFeed(`Item upsert failed: ${err}`);
  }
}

async function deleteItem(itemId) {
  try {
    const res = await fetchJson(`${API_BASE}/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
    });
    appendFeed(`Item deleted: ${res.item_id}, removed=${res.removed}`);
  } catch (err) {
    appendFeed(`Delete failed: ${err}`);
  }
}

function connectWs() {
  setStatus("connecting...", "#d7b267");
  const ws = new WebSocket(WS_URL);
  ws.onopen = () => {
    setStatus("connected", "#73d09f");
    appendFeed("WebSocket connected");
  };
  ws.onclose = () => {
    setStatus("disconnected", "#ff8c8c");
    appendFeed("WebSocket disconnected, retrying...");
    setTimeout(connectWs, 1500);
  };
  ws.onerror = () => {
    setStatus("error", "#ff8c8c");
  };
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.schema && data.schema.startsWith("hosyond.radar.processed")) {
        applyState(data);
      } else if (data.schema === "hosyond.room.item.v1" || data.schema === "hosyond.room.item.delete.v1") {
        // Refresh full state on item config updates.
        fetchJson(`${API_BASE}/state`)
          .then((s) => s.schema && applyState(s))
          .catch(() => {});
      } else if (data.schema === "hosyond.room.config.v1") {
        roomWidthInput.value = Math.round(data.room.width_mm);
        roomHeightInput.value = Math.round(data.room.height_mm);
        roomGridInput.value = Math.round(data.room.grid_mm);
      }
    } catch {
      // ignore malformed messages
    }
  };
}

function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() * 0.001;
  const r = 10.5;
  camera.position.x = Math.cos(t * 0.05) * r;
  camera.position.z = Math.sin(t * 0.05) * r;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

saveRoomBtn.addEventListener("click", saveRoom);
upsertItemBtn.addEventListener("click", upsertItem);

loadInitial();
connectWs();
animate();
