// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Create Cache interface
interface Cache extends leaflet.Rectangle {
  pointValue: number;
  label: leaflet.Marker;
}

// Create Cell interface
interface Cell {
  i: number;
  j: number;
}

// Create Arrow interface for buttons
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

// Create basic UI elements

CreateAndAddDiv("controlPanel");
CreateArrowKeys();
CreateAndAddDiv("map");
CreateAndAddDiv("statusPanel");
CreateAndAddDiv("winStatus");

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const COLLECT_DISTANCE = 2;
const CACHE_SPAWN_PROBABILITY = 0.1;
const GOAL_TOKEN = 4;
const MAX_TOKEN_SIZE = 2;

// Create the map (element with id "map" is defined in index.html)
const map = CreateMap();

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Player's current token
let currentToken = 0;

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

  // Populate the map with a background tile layer
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

  return map;
}

function DrawCache(lat: number, lng: number) {
  const centerOffset = TILE_DEGREES / 2;
  const bounds = leaflet.latLngBounds([
    [lat - centerOffset, lng - centerOffset],
    [lat + centerOffset, lng + centerOffset],
  ]);

  // Add a rectangle to the map to represent the cache
  const cache = leaflet.rectangle(bounds, {
    color: "gray",
    fillOpacity: 0,
    weight: 1,
  }) as Cache;
  cache.addTo(map);
  SpawnCache(cache);
}

function DrawVisibleMap() {
  const bounds = map.getBounds(); // bounds of visible map

  const sw = bounds.getSouthWest(); // bottom left corner of visible map
  const ne = bounds.getNorthEast(); // upper right corner of visible map

  const startCenter = GetNearestCellCenter(sw);
  const endCenter = GetNearestCellCenter(ne);

  for (
    let lat = startCenter.lat;
    lat <= endCenter.lat + TILE_DEGREES;
    lat += TILE_DEGREES
  ) {
    for (
      let lng = startCenter.lng;
      lng <= endCenter.lng + TILE_DEGREES;
      lng += TILE_DEGREES
    ) {
      DrawCache(lat, lng);
    }
  }
}

function SpawnCache(cache: Cache) {
  const bounds = cache.getBounds();
  const swCell = LatLngToCell(bounds.getSouthWest());

  if (luck([swCell.i, swCell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
    cache.pointValue = Math.floor(
      luck([swCell.i, swCell.j, "initialValue"].toString()) *
        (MAX_TOKEN_SIZE + 1),
    );
  } else {
    cache.pointValue = 0;
  }
  CreateCacheLabel(cache);
  AddClickEvent(cache);
}

function CreateCacheLabel(cache: Cache) {
  cache.label = leaflet.marker(cache.getCenter(), {
    icon: SetLabel(cache),
    interactive: false,
  }).addTo(map);
}

function UpdateCacheLabel(cache: Cache) {
  cache.label.setIcon(SetLabel(cache));
}

function SetLabel(cache: Cache) {
  const labelText = cache.pointValue == 0 ? "" : `${cache.pointValue}`;
  const label = leaflet.divIcon({
    className: "cache-label",
    html: labelText,
    iconSize: [30, 30],
  });
  return label;
}

function AddClickEvent(cache: Cache) {
  cache.on("click", function () {
    if (!CanCollect(cache)) return;

    if (cache.pointValue != 0 && cache.pointValue == currentToken) {
      CombineTokens(cache);
      CheckWin();
    } else {
      SwapTokens(cache);
    }
    UpdateCacheLabel(cache);
  });
}

function UpdateStatus(action: "" | "combine" = "") {
  const statusPanelDiv = document.getElementById("statusPanel")!;

  if (action === "combine") {
    statusPanelDiv.innerHTML = `two ${currentToken} tokens combined to create ${
      currentToken * 2
    } token`;
  } else {
    statusPanelDiv.innerHTML = (currentToken === 0)
      ? "no token in hand"
      : `${currentToken} token in hand`;
  }
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

function CanCollect(cache: Cache) {
  const cacheCenter = LatLngToCell(cache.getBounds().getCenter());

  const playerPos = LatLngToCell(playerMarker.getLatLng());
  const iDist = Math.abs(playerPos.i - cacheCenter.i);
  const jDist = Math.abs(playerPos.j - cacheCenter.j);

  return iDist <= COLLECT_DISTANCE && jDist <= COLLECT_DISTANCE;
}

function CheckWin() {
  const winStatusDiv = document.getElementById("winStatus")!;

  if (currentToken == GOAL_TOKEN) {
    winStatusDiv.innerHTML = `token of value ${GOAL_TOKEN} reached. you win !`;
  }
}

function LatLngToCell(latlng: leaflet.LatLng): Cell {
  return {
    i: Math.floor(latlng.lat / TILE_DEGREES),
    j: Math.floor(latlng.lng / TILE_DEGREES),
  };
}

function CellToLatLng(cell: Cell): leaflet.LatLng {
  return leaflet.latLng(cell.i * TILE_DEGREES, cell.j * TILE_DEGREES);
}

function GetNearestCellCenter(latlng: leaflet.LatLng) {
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
  playerMarker.setLatLng(GetNearestCellCenter(playerMarker.getLatLng()));
}

function CreateArrowKeys() {
  const arrowKeysDiv = document.createElement("div");
  const controlPanelDiv = document.getElementById("controlPanel")!;
  controlPanelDiv.appendChild(arrowKeysDiv);

  for (const dir of directions) {
    const button = document.createElement("button");
    button.textContent = dir.symbol;

    button.addEventListener("click", () => {
      MovePlayer(dir.delta);
    });

    arrowKeysDiv.appendChild(button);
  }
}

function MovePlayer(delta: Cell) {
  const lat = playerMarker.getLatLng().lat;
  const lng = playerMarker.getLatLng().lng;
  const deltaLatLng = CellToLatLng(delta);
  playerMarker.setLatLng(
    leaflet.latLng(lat + deltaLatLng.lat, lng + deltaLatLng.lng),
  );
  map.panTo(playerMarker.getLatLng());
}

function CreateAndAddDiv(id: string) {
  const div = document.createElement("div");
  div.id = id;
  document.body.append(div);
}

UpdateStatus();
DrawVisibleMap();
CenterMarker();
