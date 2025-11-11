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

// Create basic UI elements

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

const winStatusDiv = document.createElement("div");
document.body.append(winStatusDiv);

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);
const ORIGIN = leaflet.latLng(0,0);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const COLLECT_DISTANCE = 30;
const CACHE_SPAWN_PROBABILITY = 0.1;
const GOAL_TOKEN = 4;
const MAX_TOKEN_SIZE = 2;

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(mapDiv, {
  center: ORIGIN,
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

// Add a marker to represent the player
const playerMarker = leaflet.marker(ORIGIN);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

// Display the player's current token
let currentToken = 0;
statusPanelDiv.innerHTML = "no token in hand";

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
  const centerOffset = TILE_DEGREES / 2; // used to get center of a cache !
  const bounds = map.getBounds(); // bounds of visible map

  const sw = bounds.getSouthWest(); // bottom left corner of visible map
  const ne = bounds.getNorthEast(); // upper right corner of visible map

  // TODO: SHIFT starts and ends so they align 0,0 centrally

  const latShift = sw.lat % TILE_DEGREES;
  const lngShift = sw.lng % TILE_DEGREES;

  const startLat = sw.lat - latShift;
  const startLng = sw.lng - lngShift;
  const endLat = ne.lat;
  const endLng = ne.lng;

  for (let lat = startLat; lat < endLat; lat += TILE_DEGREES) {
    for (let lng = startLng; lng < endLng; lng += TILE_DEGREES) {
      DrawCache(lat, lng);
    }
  }
}

function SpawnCache(cache: Cache) {
  const bounds = cache.getBounds();
  const sw = bounds.getSouthWest();

  if (luck([sw.lat, sw.lng].toString()) < CACHE_SPAWN_PROBABILITY) {
    cache.pointValue = Math.floor(
      luck([sw.lat, sw.lng, "initialValue"].toString()) * (MAX_TOKEN_SIZE + 1),
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
  const center = cache.getCenter();
  const labelText = `${ToCell(center.lat).toFixed(2)}, ${ToCell(center.lng).toFixed(2)}`;
  //const labelText = cache.pointValue == 0 ? "" : `${cache.pointValue}`;
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

function CombineTokens(cache: Cache) {
  cache.pointValue = 0;
  currentToken *= 2;
  statusPanelDiv.innerHTML = `${
    currentToken / 2
  } token combined to create ${currentToken} token`;
}

function SwapTokens(cache: Cache) {
  const temp = cache.pointValue;
  cache.pointValue = currentToken;
  currentToken = temp;
  statusPanelDiv.innerHTML = (currentToken == 0)
    ? "no token in hand"
    : `${currentToken} token in hand`;
}

function CanCollect(cache: Cache) {
  const cacheCenter = cache.getBounds().getCenter();
  const collectDistDegrees = COLLECT_DISTANCE * TILE_DEGREES;

  const latDist = CLASSROOM_LATLNG.lat - cacheCenter.lat;
  const lngDist = CLASSROOM_LATLNG.lng - cacheCenter.lng;
  const distanceSquared = (latDist * latDist) + (lngDist * lngDist);

  return distanceSquared <= (collectDistDegrees * collectDistDegrees);
}

function CheckWin() {
  if (currentToken == GOAL_TOKEN) {
    winStatusDiv.innerHTML = `token of value ${GOAL_TOKEN} reached. you win !`;
  }
}

// Cell conversion functions
function CellToLatLng(cell: Cell) {
  const lat = cell.i * TILE_DEGREES;
  const lng = cell.j * TILE_DEGREES;
  return { lat, lng };
}

function ToCell(coord: number) {
  return (coord / TILE_DEGREES);
}

function LatLngToCell(latlng: { lat: number; lng: number }) {
  const i = latlng.lat / TILE_DEGREES;
  const j = latlng.lng / TILE_DEGREES;
  return { i: i, j: j };
}

CellToLatLng({ i: 1, j: 1 });
LatLngToCell({ lat: 1, lng: 1 });

DrawVisibleMap();
