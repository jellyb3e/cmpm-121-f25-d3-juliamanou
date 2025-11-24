/* imports */
// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";
import "./style.css";

/* interfaces && consts */

interface Cache extends leaflet.Rectangle {
  pointValue: number;
  label: leaflet.Marker;
}

// FLYWEIGHT
interface Cell {
  i: number;
  j: number;
}

interface Arrow {
  direction: string;
  symbol: string;
  delta: Cell;
}

const directions: Arrow[] = [
  { direction: "up", symbol: "↑", delta: { i: 1, j: 0 } },
  { direction: "down", symbol: "↓", delta: { i: -1, j: 0 } },
  { direction: "left", symbol: "←", delta: { i: 0, j: -1 } },
  { direction: "right", symbol: "→", delta: { i: 0, j: 1 } },
];

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 5e-5;
const COLLECT_DISTANCE = 1;
const CACHE_SPAWN_PROBABILITY = 0.1;
const GOAL_TOKEN = 4;
const MAX_TOKEN_SIZE = 2;

CreateAndAddDiv("map");
CreateAndAddDiv("statusPanel");
CreateAndAddDiv("winStatus").innerHTML =
  `token of value ${GOAL_TOKEN} reached. you win !`;
CreateAndAddDiv("controlPanel");
CreateArrowKeys();

CreateChildButton(CreateAndAddDiv("restartPanel"), "begin again")
  .addEventListener("click", () => {
    cacheMap.clear();
    DrawVisibleMap();
    document.getElementById("winStatus")!.style.display = "none";
    currentToken = 0;
    UpdateStatus();
    SetFollow(true);
    if (!watching) CenterMarker();
  });

CreateChildButton(CreateAndAddDiv("recenterPanel"), "recenter")
  .addEventListener("click", () => {
    SetFollow(true);
  });

const map = CreateMap();
let watching: boolean = false;
let watchID: number | null = null;
let following: boolean = true;
let currentToken = 0;
const cacheMap = new Map(); //MEMENTO
const cacheLayerGroup = leaflet.layerGroup().addTo(map);

const searchParams = new URLSearchParams(globalThis.location.search);
if (!searchParams.has("controls")) {
  searchParams.set("controls", "buttons");
  history.replaceState(null, "", `?${searchParams.toString()}`);
}

globalThis.addEventListener("load", function () {
  const scheme = searchParams.get("controls")!;
  if (scheme != "buttons" && scheme != "geo") return;
  SetControlScheme(scheme);
});

/* map creation */

function CreateMap(): leaflet.Map {
  const mapDiv = document.getElementById("map")!;
  const map = leaflet.map(mapDiv, {
    center: CLASSROOM_LATLNG,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false,
  });

  leaflet
    .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    })
    .addTo(map);

  map.on("moveend", () => {
    DrawVisibleMap();
  });

  map.on("dragstart", () => {
    SetFollow(false);
  });

  return map;
}

/* player marker */

const playerMarker = leaflet.marker(CLASSROOM_LATLNG);

function SetFollow(follow: boolean) {
  if (!watching) return;
  const followButton = document.getElementById(
    "recenter",
  )! as HTMLButtonElement;
  followButton.disabled = follow;
  following = follow;
  if (follow) map.panTo(playerMarker.getLatLng());
}

function MovePlayer(delta: Cell) {
  const lat = playerMarker.getLatLng().lat;
  const lng = playerMarker.getLatLng().lng;
  const deltaLatLng = CellToLatLng(delta);
  const newLatLng = GetNearestLatLngCenter(
    leaflet.latLng(lat + deltaLatLng.lat, lng + deltaLatLng.lng),
  );
  playerMarker.setLatLng(newLatLng);
  map.panTo(playerMarker.getLatLng());
}

/* cache */

function DrawCache(cell: Cell) {
  const latlng = CellToLatLng(cell);
  const bounds = leaflet.latLngBounds([
    [latlng.lat, latlng.lng],
    [latlng.lat + TILE_DEGREES, latlng.lng + TILE_DEGREES],
  ]);

  const cache = leaflet.rectangle(bounds, {
    color: "gray",
    fillOpacity: 0,
    weight: 1,
  }) as Cache;

  if (CanCollect(cache)) cache.setStyle({ fillColor: "red", fillOpacity: .1 });
  cacheLayerGroup.addLayer(cache);
  SpawnCache(cache);
}

function DrawVisibleMap() {
  cacheLayerGroup.clearLayers();
  const bounds = map.getBounds();
  const startCenterLatLng = GetNearestLatLngCenter(bounds.getSouthWest());
  const endCenterLatLng = GetNearestLatLngCenter(bounds.getNorthEast());
  const startCenter = LatLngToCell(startCenterLatLng);
  const endCenter = LatLngToCell(endCenterLatLng);

  for (let i = startCenter.i; i <= endCenter.i + 1; i++) {
    for (let j = startCenter.j; j <= endCenter.j + 1; j++) {
      DrawCache({ i, j });
    }
  }
}

function IsRegistered(cell: Cell) {
  return cacheMap.has(GetKeyString(cell));
}

function RegisterChange(cache: Cache) {
  const cellCenter = LatLngToCell(cache.getBounds().getCenter());
  if (cache.pointValue == GetInitialCacheValue(cellCenter)) {
    cacheMap.delete(GetKeyString(cellCenter));
  } else {
    cacheMap.set(GetKeyString(cellCenter), cache.pointValue);
  }
}

function SpawnCache(cache: Cache) {
  const cellCenter = LatLngToCell(cache.getBounds().getCenter());
  if (IsRegistered(cellCenter)) {
    cache.pointValue = cacheMap.get(GetKeyString(cellCenter));
  } else {
    cache.pointValue = GetInitialCacheValue(cellCenter);
  }
  CreateCacheLabel(cache);
  AddClickEvent(cache);
}

function CreateCacheLabel(cache: Cache) {
  cache.label = leaflet.marker(cache.getCenter(), {
    icon: SetLabel(cache),
    interactive: false,
  });
  cacheLayerGroup.addLayer(cache.label);
}

function UpdateCacheLabel(cache: Cache) {
  cache.label.setIcon(SetLabel(cache));
}

function SetLabel(cache: Cache) {
  const labelText = cache.pointValue == 0 ? "" : `${cache.pointValue}`;
  return leaflet.divIcon({
    className: "cache-label",
    html: labelText,
    iconSize: [30, 30],
  });
}

function AddClickEvent(cache: Cache) {
  cache.on("click", function () {
    if (!CanCollect(cache) || (cache.pointValue == 0 && currentToken == 0)) {
      return;
    }
    if (cache.pointValue == currentToken) {
      CombineTokens(cache);
      CheckWin();
    } else {
      SwapTokens(cache);
    }
    RegisterChange(cache);
    UpdateCacheLabel(cache);
  });
}

/* gameplay functions */

function CanCollect(cache: Cache): boolean {
  const cacheCenter = LatLngToCell(cache.getBounds().getCenter());
  const playerPos = LatLngToCell(playerMarker.getLatLng());
  return (
    Math.abs(playerPos.i - cacheCenter.i) <= COLLECT_DISTANCE &&
    Math.abs(playerPos.j - cacheCenter.j) <= COLLECT_DISTANCE
  );
}

function CombineTokens(cache: Cache) {
  cache.pointValue = 0;
  UpdateStatus("combine");
  currentToken *= 2;
}

function SwapTokens(cache: Cache) {
  const temp = cache.pointValue;
  cache.pointValue = currentToken;
  currentToken = temp;
  UpdateStatus();
}

function CheckWin() {
  const winStatusDiv = document.getElementById("winStatus")!;
  if (currentToken == GOAL_TOKEN) {
    winStatusDiv.style.display = "block";
  }
}

function UpdateStatus(action: "" | "combine" = "") {
  const statusPanelDiv = document.getElementById("statusPanel")!;
  if (action === "combine") {
    statusPanelDiv.innerHTML = `two ${currentToken} tokens combined to create ${
      currentToken * 2
    } token`;
  } else {
    statusPanelDiv.innerHTML = currentToken === 0
      ? "no token in hand"
      : `${currentToken} token in hand`;
  }
}

/* coordinate helpers */

function LatLngToCell(latlng: leaflet.LatLng): Cell {
  return {
    i: Math.floor(latlng.lat / TILE_DEGREES),
    j: Math.floor(latlng.lng / TILE_DEGREES),
  };
}

function CellToLatLng(cell: Cell): leaflet.LatLng {
  return leaflet.latLng(cell.i * TILE_DEGREES, cell.j * TILE_DEGREES);
}

function GetNearestLatLngCenter(latlng: leaflet.LatLng): leaflet.LatLng {
  const centerOffset = TILE_DEGREES / 2;
  let latShift = latlng.lat % TILE_DEGREES;
  let lngShift = latlng.lng % TILE_DEGREES;
  if (latShift < 0) latShift += TILE_DEGREES;
  if (lngShift < 0) lngShift += TILE_DEGREES;

  return leaflet.latLng(
    latlng.lat - latShift + centerOffset,
    latlng.lng - lngShift + centerOffset,
  );
}

function CenterMarker() {
  playerMarker.setLatLng(GetNearestLatLngCenter(playerMarker.getLatLng()));
}

/* ui */

function CreateChildButton(parent: HTMLElement, content: string) {
  const button = document.createElement("button");
  button.textContent = content;
  button.id = content;
  parent.appendChild(button);
  return button;
}

function CreateArrowKeys() {
  const arrowKeysDiv = document.createElement("div");
  const controlPanelDiv = document.getElementById("controlPanel")!;
  controlPanelDiv.appendChild(arrowKeysDiv);

  for (const dir of directions) {
    const button = CreateChildButton(arrowKeysDiv, dir.symbol);
    button.className = "directionButton";
    button.addEventListener("click", () => {
      MovePlayer(dir.delta);
    });
  }
}

function CreateAndAddDiv(id: string) {
  const div = document.createElement("div");
  div.id = id;
  document.body.append(div);
  return div;
}

/* cacheMap interaction helpers */

function GetKeyString(cell: Cell) {
  return `${cell.i},${cell.j}`;
}

function GetInitialCacheValue(cell: Cell) {
  if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    return Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * (MAX_TOKEN_SIZE + 1),
    );
  } else {
    return 0;
  }
}

/* geolocation functions */

function StartWatch() {
  navigator.permissions.query({ name: "geolocation" }).then((result) => {
    if (result.state === "granted" && !watching) {
      watchID = navigator.geolocation.watchPosition((position) => {
        const latlng = leaflet.latLng(
          position.coords.latitude,
          position.coords.longitude,
        );
        playerMarker.setLatLng(latlng);
        watching = true;
        if (following) map.panTo(latlng);
      });
    } else if (result.state === "denied") {
      if (watchID != null) {
        navigator.geolocation.clearWatch(watchID);
        watchID = null;
      }
      SetControlScheme("buttons");
    }
  });
}

function SetButtonVisibility(visible: boolean) {
  const controlPanel = document.getElementById("controlPanel")!;
  const recenterPanel = document.getElementById("recenterPanel")!;
  controlPanel.style.display = visible ? "block" : "none";
  recenterPanel.style.display = visible ? "none" : "block";
}

function SetControlScheme(scheme: "buttons" | "geo") {
  searchParams.set("controls", scheme);
  history.replaceState(null, "", `?${searchParams.toString()}`);
  SetButtonVisibility(scheme === "buttons");

  if (scheme === "buttons") {
    following = false;
    if (watchID !== null) {
      navigator.geolocation.clearWatch(watchID);
      watchID = null;
    }
    CenterMarker();
  } else {
    following = true;
    StartWatch();
  }
}

/* local storage  */

function SaveGameState() {
  const state = {
    playerLatLng: playerMarker.getLatLng(),
    currentToken,
    following,
    cacheMap: Array.from(cacheMap.entries()),
  };
  localStorage.setItem("gameState", JSON.stringify(state));
}

function LoadGameState() {
  const saved = localStorage.getItem("gameState");
  if (!saved) return;

  const state = JSON.parse(saved);

  if (state.playerLatLng) {
    const latlng = leaflet.latLng(
      state.playerLatLng.lat,
      state.playerLatLng.lng,
    );
    playerMarker.setLatLng(latlng);
    playerMarker.addTo(map);
    map.panTo(latlng);
  }

  if (state.currentToken !== undefined) currentToken = state.currentToken;
  if (state.following !== undefined) following = state.following;

  if (state.cacheMap) {
    cacheMap.clear();
    for (const [key, value] of state.cacheMap) {
      cacheMap.set(key, value);
    }
  }
}

function SetInitialPosition() {
  const saved = localStorage.getItem("gameState");

  if (saved) {
    LoadGameState();
    playerMarker.addTo(map);
    map.panTo(playerMarker.getLatLng());
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latlng = leaflet.latLng(
        position.coords.latitude,
        position.coords.longitude,
      );
      playerMarker.setLatLng(latlng);
      if (!saved) map.panTo(latlng);
      SetControlScheme("geo");
    },
    () => {
      if (!saved) {
        playerMarker.setLatLng(CLASSROOM_LATLNG);
        map.panTo(CLASSROOM_LATLNG);
      }
      SetControlScheme("buttons");
    },
  );
}

self.addEventListener("beforeunload", () => {
  SaveGameState();
});

/* function calls */

SetInitialPosition();
UpdateStatus();
DrawVisibleMap();
