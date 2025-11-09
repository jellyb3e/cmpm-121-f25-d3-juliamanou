// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Create Tile interface
interface Tile extends leaflet.Rectangle {
  pointValue: number;
  label: leaflet.Marker;
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

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
//const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

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

function DrawTile(lat: number, lng: number) {
  //const centerOffset = TILE_DEGREES / 2;
  const bounds = leaflet.latLngBounds([
    [lat, lng],
    [lat + TILE_DEGREES, lng + TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds, {
    color: "gray",
    fillOpacity: 0,
    weight: 1,
  }) as Tile;
  rect.addTo(map);
  SpawnCache(rect);
}

function DrawVisibleMap() {
  const centerOffset = TILE_DEGREES / 2; // used to get center of a tile !
  const bounds = map.getBounds(); // bounds of visible map

  const sw = bounds.getSouthWest(); // bottom left corner of visible map
  const ne = bounds.getNorthEast(); // upper right corner of visible map
  const center = bounds.getCenter(); // center of visible map (to center tiles cleanly)

  const latOffset = (center.lat + centerOffset) % TILE_DEGREES; // how much to adjust tiles so center is centered on a tile
  const lngOffset = (center.lng + centerOffset) % TILE_DEGREES; // as above

  const startLat =
    Math.floor((sw.lat - latOffset) / TILE_DEGREES) * TILE_DEGREES + latOffset;
  const startLng =
    Math.floor((sw.lng - lngOffset) / TILE_DEGREES) * TILE_DEGREES + lngOffset;
  const endLat = ne.lat;
  const endLng = ne.lng;

  for (let lat = startLat; lat < endLat; lat += TILE_DEGREES) {
    for (let lng = startLng; lng < endLng; lng += TILE_DEGREES) {
      DrawTile(lat, lng);
    }
  }
}

function SpawnCache(tile: Tile) {
  const bounds = tile.getBounds();
  const sw = bounds.getSouthWest();

  if (luck([sw.lat, sw.lng].toString()) < CACHE_SPAWN_PROBABILITY) {
    tile.pointValue = Math.floor(
      luck([sw.lat, sw.lng, "initialValue"].toString()) * 100,
    );
  } else {
    tile.pointValue = 0;
  }
  AddCacheLabel(tile);
  AddClickEvent(tile);
}

function AddCacheLabel(tile: Tile) {
  const labelText = tile.pointValue == 0 ? "" : `${tile.pointValue}`;
  const label = leaflet.divIcon({
    className: "tile-label",
    html: labelText,
    iconSize: [30, 30],
  });
  tile.label = leaflet.marker(tile.getCenter(), {
    icon: label,
    interactive: false,
  }).addTo(map);
}

function AddClickEvent(tile: Tile) {
  tile.on("click", function () {
    if (tile.pointValue == currentToken) {
      // combine
      tile.pointValue = 0;
      currentToken *= 2;
      statusPanelDiv.innerHTML = `${
        currentToken / 2
      } token combined to create ${currentToken} token`;
    } else {
      // swap
      const temp = tile.pointValue;
      tile.pointValue = currentToken;
      currentToken = temp;
      statusPanelDiv.innerHTML = (currentToken == 0)
        ? "no token in hand"
        : `${currentToken} token in hand`;
    }
    UpdateTileLabel(tile);
  });
}

function UpdateTileLabel(tile: Tile) {
  const newText = tile.pointValue === 0 ? "" : `${tile.pointValue}`;
  const newIcon = leaflet.divIcon({
    className: "tile-label",
    html: newText,
    iconSize: [30, 30],
  });

  tile.label.setIcon(newIcon);
}

DrawVisibleMap();
