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

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const COLLECT_DISTANCE = 30;
const CACHE_SPAWN_PROBABILITY = 0.1;
const GOAL_TOKEN = 4;
const MAX_TOKEN_SIZE = 2;

// Create the map (element with id "map" is defined in index.html)
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

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
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

/*
function LatLngToCell(latlng: leaflet.LatLng): Cell {
  return {
    i: Math.floor(latlng.lat / TILE_DEGREES),
    j: Math.floor(latlng.lng / TILE_DEGREES),
  };
}

function CellToLatLng(cell: Cell): leaflet.LatLng {
  return leaflet.latLng(cell.i * TILE_DEGREES, cell.j * TILE_DEGREES);
}
*/

function GetNearestCellCenter(latlng: leaflet.LatLng) {
  let latShift = latlng.lat % TILE_DEGREES;
  let lngShift = latlng.lng % TILE_DEGREES;

  if (latShift < 0) latShift += TILE_DEGREES;
  if (lngShift < 0) lngShift += TILE_DEGREES;

  return leaflet.latLng(
    latlng.lat - latShift + TILE_DEGREES / 2,
    latlng.lng - lngShift + TILE_DEGREES / 2,
  );
}

function CenterMarker() {
  playerMarker.setLatLng(GetNearestCellCenter(playerMarker.getLatLng()));
}

DrawVisibleMap();
CenterMarker();
