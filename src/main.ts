// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
//import luck from "./_luck.ts";

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
//const CACHE_SPAWN_PROBABILITY = 0.1;

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

// Display the player's points
const _playerPoints = 0;
statusPanelDiv.innerHTML = "No points yet...";

function DrawTile(lat: number, lng: number) {
  const centerOffset = TILE_DEGREES / 2;
  const bounds = leaflet.latLngBounds([
    [lat - centerOffset, lng - centerOffset],
    [lat + centerOffset, lng + centerOffset],
  ]);

  // Add a rectangle to the map to represent the cache
  const rect = leaflet.rectangle(bounds, {
    color: "gray",
    fill: false,
    weight: 1,
  });
  rect.addTo(map);
}

// DrawTile(CLASSROOM_LATLNG.lat, CLASSROOM_LATLNG.lng); // draw a tile at the player's start location

function DrawMap() {
  const centerOffset = TILE_DEGREES / 2; // used to get center of a tile !
  const bounds = map.getBounds(); // bounds of visible map

  const sw = bounds.getSouthWest(); // bottom left corner of visible map
  const ne = bounds.getNorthEast(); // upper right corner of visible map

  const startLat = sw.lat;
  const startLng = sw.lng;
  const endLat = ne.lat;
  const endLng = ne.lng;

  for (
    let lat = startLat + centerOffset;
    lat < endLat + centerOffset;
    lat += TILE_DEGREES
  ) {
    for (
      let lng = startLng + centerOffset;
      lng < endLng + centerOffset;
      lng += TILE_DEGREES
    ) {
      DrawTile(lat, lng);
    }
  }
}

DrawMap();
