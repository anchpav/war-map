// ===============================
// Global War Tracker (GitHub Pages-ready)
// ===============================

// NOTE FOR FUTURE DATA SOURCE CHANGES:
// 1) Update API_ENDPOINTS with your new URL(s).
// 2) Update normalizeEvent() and extractEventList() to map provider fields.
// 3) Keep renderMarkers(), buildHeatPoints(), and filtering logic unchanged where possible.
const API_ENDPOINTS = [
  "https://liveuamap.com/api/events",
  // Fallback mirror for CORS-restricted environments (same source URL)
  "https://api.allorigins.win/raw?url=https://liveuamap.com/api/events"
];

const LAST_MAJOR_WAR_DATE = "2024-10-07";

const state = {
  rawEvents: [],
  filteredEvents: [],
  markersLayer: null,
  linksLayer: null,
  heatLayer: null,
  map: null,
  showAllYears: true
};

const refs = {
  daysCounter: document.getElementById("daysCounter"),
  counterMeta: document.getElementById("counterMeta"),
  yearSlider: document.getElementById("yearSlider"),
  yearOutput: document.getElementById("yearOutput"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  visibleCount: document.getElementById("visibleCount"),
  sourceStatus: document.getElementById("sourceStatus"),
  lastUpdated: document.getElementById("lastUpdated")
};

init();

function init() {
  updatePeaceCounter();
  initMap();
  wireControls();
  loadConflictData();
}

function updatePeaceCounter() {
  const start = new Date(`${LAST_MAJOR_WAR_DATE}T00:00:00Z`);
  const now = new Date();
  const diffMs = now - start;
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  refs.daysCounter.textContent = diffDays.toLocaleString();
  refs.counterMeta.textContent = `Reference date: ${LAST_MAJOR_WAR_DATE}`;
}

function initMap() {
  state.map = L.map("map", {
    zoomControl: true,
    worldCopyJump: true
  }).setView([22, 14], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  L.control.fullscreen({
    position: "topleft",
    title: "Full Screen"
  }).addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
  state.linksLayer = L.layerGroup().addTo(state.map);
}

function wireControls() {
  refs.yearSlider.addEventListener("input", (event) => {
    const year = Number(event.target.value);
    refs.yearOutput.textContent = year;
    applyFiltersAndRender();
  });

  refs.resetFiltersBtn.addEventListener("click", () => {
    const latestYear = getLatestEventYear(state.rawEvents) || new Date().getUTCFullYear();
    refs.yearSlider.value = String(latestYear);
    refs.yearOutput.textContent = String(latestYear);
    applyFiltersAndRender();
  });
}

async function loadConflictData() {
  refs.sourceStatus.textContent = "Loading…";

  let events = [];
  let usedEndpoint = null;

  for (const endpoint of API_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const list = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.events)
          ? payload.events
          : [];

      if (list.length > 0) {
        events = list;
        usedEndpoint = endpoint;
        break;
      }
    } catch (error) {
      console.warn(`Failed endpoint ${endpoint}`, error);
    }
  }

  if (!events.length) {
    refs.sourceStatus.textContent = "Unavailable (check network/CORS)";
    refs.lastUpdated.textContent = "--";
    refs.visibleCount.textContent = "0";
    return;
  }

  state.rawEvents = events
    .map(normalizeEvent)
    .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lng));

  const [minYear, maxYear] = getYearRange(state.rawEvents);
  refs.yearSlider.min = String(minYear || new Date().getUTCFullYear());
  refs.yearSlider.max = String(maxYear || new Date().getUTCFullYear());
  refs.yearSlider.value = String(maxYear || new Date().getUTCFullYear());

  // IMPORTANT: default mode is ALL years so the map shows all actual current conflicts.
  state.showAllYears = true;
  refs.allYearsToggle.checked = true;
  applyYearControlState();

  refs.sourceStatus.textContent = usedEndpoint.includes("allorigins")
    ? "LiveUAMap (via mirror)"
    : "LiveUAMap API";

  refs.lastUpdated.textContent = formatDateTime(new Date());

  applyFiltersAndRender();
}

function extractEventList(payload) {
  // LiveUAMap or mirrors may wrap lists under different keys.
  if (Array.isArray(payload)) return payload;

  const candidateKeys = ["events", "data", "items", "results", "features"];
  for (const key of candidateKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  return [];
}

function normalizeEvent(item) {
  // Many providers use differing keys; this function standardizes them.
  const lat = parseCoord(
    item.lat ?? item.latitude ?? item.geo_lat ?? item?.location?.lat ?? item?.geo?.lat
  );
  const lng = parseCoord(
    item.lng ?? item.lon ?? item.long ?? item.longitude ?? item.geo_lon ?? item?.location?.lng ?? item?.geo?.lon
  );

  // GeoJSON fallback: coordinates usually [lng, lat]
  const geoLng = parseCoord(item?.geometry?.coordinates?.[0]);
  const geoLat = parseCoord(item?.geometry?.coordinates?.[1]);

  const finalLat = Number.isFinite(lat) ? lat : geoLat;
  const finalLng = Number.isFinite(lng) ? lng : geoLng;

  const title = item.title || item.name || item?.properties?.title || "Untitled conflict event";
  const description =
    item.description || item.text || item.content || item?.properties?.description || "No detailed description available.";
  const region =
    item.country || item.region || item.location || item.place || item.city || item?.properties?.country || "Unknown region";

  const dateRaw =
    item.date || item.datetime || item.published_at || item.created_at || item.time || item?.properties?.date || null;
  const date = parseMaybeDate(dateRaw);

  const sideA = item.sideA || item.source || item.attacker || null;
  const sideB = item.sideB || item.target || item.defender || null;
  const toLat = parseCoord(item.to_lat ?? item.target_lat ?? item.destination_lat);
  const toLng = parseCoord(item.to_lng ?? item.target_lng ?? item.destination_lng);

  // intensity may be numeric or inferred from fields like casualties/severity/category
  const intensity = inferIntensity(item);

  return {
    lat: finalLat,
    lng: finalLng,
    toLat,
    toLng,
    title,
    description,
    region,
    date,
    sideA,
    sideB,
    intensity,
    raw: item
  };
}

function inferIntensity(item) {
  const direct = Number(item.intensity ?? item.severity ?? item.weight ?? item.level);
  if (Number.isFinite(direct) && direct > 0) return clamp(direct, 0.2, 1);

  const casualties = Number(item.casualties ?? item.killed ?? item.injured);
  if (Number.isFinite(casualties) && casualties > 0) {
    return clamp(Math.log10(casualties + 1) / 2, 0.2, 1);
  }

  const text = String(item.category || item.type || item?.properties?.category || "").toLowerCase();
  if (text.includes("airstrike") || text.includes("missile") || text.includes("battle")) {
    return 0.9;
  }
  if (text.includes("protest") || text.includes("tension")) {
    return 0.4;
  }

  return 0.55;
}

function applyFiltersAndRender() {
  const selectedYear = Number(refs.yearSlider.value);

  state.filteredEvents = state.rawEvents.filter((event) => {
    if (state.showAllYears) return true;
    if (!event.date) return true;
    return event.date.getUTCFullYear() === selectedYear;
  });

  renderMarkers(state.filteredEvents);
  renderHeatmap(state.filteredEvents);
  refs.visibleCount.textContent = state.filteredEvents.length.toLocaleString();
}

function renderMarkers(events) {
  state.markersLayer.clearLayers();
  state.linksLayer.clearLayers();

  events.forEach((event) => {
    const markerColor = intensityToColor(event.intensity);
    const marker = L.circleMarker([event.lat, event.lng], {
      radius: 7,
      color: markerColor,
      fillColor: markerColor,
      fillOpacity: 0.8,
      weight: 1.2
    });

    marker.bindPopup(`
      <div>
        <h3 class="popup-title">${escapeHtml(event.title)}</h3>
        <p class="popup-region">${escapeHtml(event.region)}</p>
        <p class="popup-description">${escapeHtml(event.description)}</p>
      </div>
    `);

    marker.addTo(state.markersLayer);

    // Draw directional conflict line if a destination point exists in the source data.
    if (Number.isFinite(event.toLat) && Number.isFinite(event.toLng)) {
      const polyline = L.polyline(
        [
          [event.lat, event.lng],
          [event.toLat, event.toLng]
        ],
        {
          color: markerColor,
          weight: 2,
          opacity: 0.75
        }
      );

      if (typeof polyline.arrowheads === "function") {
        polyline.arrowheads({ size: "10px", frequency: "endonly" });
      }

      polyline.bindTooltip(
        `${escapeHtml(event.sideA || "Side A")} → ${escapeHtml(event.sideB || "Side B")}`
      );

      polyline.addTo(state.linksLayer);
    }
  });
}

function renderHeatmap(events) {
  if (state.heatLayer) {
    state.map.removeLayer(state.heatLayer);
  }

  const heatPoints = buildHeatPoints(events);

  // Plugin might fail to load on restricted networks: guard to avoid runtime crash.
  if (typeof L.heatLayer !== "function") {
    state.heatLayer = null;
    return;
  }

  state.heatLayer = L.heatLayer(heatPoints, {
    radius: 26,
    blur: 20,
    maxZoom: 7,
    minOpacity: 0.28,
    gradient: {
      0.2: "#3b82f6",
      0.45: "#14b8a6",
      0.7: "#f59e0b",
      1.0: "#ef4444"
    }
  }).addTo(state.map);
}

function buildHeatPoints(events) {
  return events.map((event) => [event.lat, event.lng, clamp(event.intensity, 0.2, 1)]);
}

function getYearRange(events) {
  const years = events
    .map((event) => event.date?.getUTCFullYear())
    .filter((year) => Number.isFinite(year));

  if (!years.length) return [null, null];
  return [Math.min(...years), Math.max(...years)];
}

function parseMaybeDate(value) {
  if (!value) return null;

  if (Number.isFinite(Number(value)) && String(value).length <= 13) {
    const ms = String(value).length <= 10 ? Number(value) * 1000 : Number(value);
    const asEpoch = new Date(ms);
    if (!Number.isNaN(asEpoch.getTime())) return asEpoch;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCoord(value) {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function intensityToColor(intensity) {
  if (intensity >= 0.85) return "#ff365f";
  if (intensity >= 0.65) return "#ff8c3a";
  if (intensity >= 0.45) return "#ffd644";
  return "#58d7ff";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
