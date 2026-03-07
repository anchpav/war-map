/*
  Minimal Global War Tracker frontend (plain JS + Leaflet)
*/

const API_URL = "/api/conflicts";
const LOCAL_JSON_URL = "./conflicts.json";

const map = L.map("map", { worldCopyJump: true }).setView([20, 0], 2);
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "© OpenStreetMap © CARTO",
  maxZoom: 8,
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const lineLayer = L.layerGroup().addTo(map);

const countrySearch = document.getElementById("countrySearch");
const countryList = document.getElementById("countryList");
const clearFilterBtn = document.getElementById("clearFilter");
const refreshDataBtn = document.getElementById("refreshData");
const playTimelineBtn = document.getElementById("playTimeline");
const pauseTimelineBtn = document.getElementById("pauseTimeline");
const timelineStatus = document.getElementById("timelineStatus");

const daysGlobalEl = document.getElementById("daysGlobal");
const daysCountryEl = document.getElementById("daysCountry");
const activeCountEl = document.getElementById("activeCount");
const totalCountEl = document.getElementById("totalCount");

const state = {
  conflicts: [],
  selectedCountry: "",
  animationTimer: null,
  animationIndex: 0,
};

function parseDate(value) {
  return value ? new Date(value) : null;
}

function statusColor(conflict) {
  if (conflict.end === null) return "#ff4d4d"; // active
  const years = (Date.now() - new Date(conflict.end).getTime()) / (1000 * 60 * 60 * 24 * 365);
  return years <= 10 ? "#ff9f43" : "#8d98a5";
}

function buildCountryList(conflicts) {
  const countries = [...new Set(conflicts.flatMap((c) => [c.country, c.opponent]).filter(Boolean))].sort();
  countryList.innerHTML = "";
  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    countryList.appendChild(option);
  });
}

function filteredConflicts() {
  if (!state.selectedCountry) return state.conflicts;
  const selected = state.selectedCountry.toLowerCase();
  return state.conflicts.filter((c) =>
    (c.country || "").toLowerCase() === selected || (c.opponent || "").toLowerCase() === selected
  );
}

function activeConflicts(list) {
  return list.filter((c) => c.end === null);
}

function calculateDaysWithoutWar(list) {
  if (!list.length) return 0;
  if (list.some((c) => c.end === null)) return 0;

  const ends = list.map((c) => parseDate(c.end)).filter(Boolean);
  if (!ends.length) return 0;
  const latest = new Date(Math.max(...ends.map((d) => d.getTime())));
  return Math.floor((Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24));
}

function updateMetrics() {
  const all = state.conflicts;
  const selected = filteredConflicts();

  daysGlobalEl.textContent = String(calculateDaysWithoutWar(all));
  daysCountryEl.textContent = String(calculateDaysWithoutWar(selected));
  activeCountEl.textContent = String(activeConflicts(selected).length);
  totalCountEl.textContent = String(all.length);
}

function addConflictMarker(conflict) {
  const marker = L.circleMarker([conflict.lat, conflict.lon], {
    radius: 6,
    color: statusColor(conflict),
    fillColor: statusColor(conflict),
    fillOpacity: 0.9,
    weight: 1,
  }).bindPopup(
    `<strong>${conflict.country}</strong><br>` +
      `Opponent: ${conflict.opponent || "Unknown"}<br>` +
      `Start: ${conflict.start}<br>` +
      `End: ${conflict.end || "Active"}<br>` +
      `Details: ${conflict.description || "No description"}`
  );

  markerLayer.addLayer(marker);
}

function addConflictArrow(conflict) {
  if (conflict.opponentLat == null || conflict.opponentLon == null) return;

  const start = [conflict.lat, conflict.lon];
  const end = [conflict.opponentLat, conflict.opponentLon];
  const color = statusColor(conflict);

  const line = L.polyline([start, end], { color, weight: 2.4, opacity: 0.8 }).bindTooltip(
    `<strong>${conflict.country} ↔ ${conflict.opponent}</strong><br>` +
      `Start: ${conflict.start}<br>` +
      `End: ${conflict.end || "Active"}<br>` +
      `Type: ${conflict.description || "Armed conflict"}`,
    { sticky: true }
  );

  // Tiny arrowhead marker near the end point.
  const arrow = L.circleMarker(end, {
    radius: 3,
    color,
    fillColor: color,
    fillOpacity: 1,
    weight: 1,
  });

  lineLayer.addLayer(line);
  lineLayer.addLayer(arrow);
}

function renderMapStatic() {
  markerLayer.clearLayers();
  lineLayer.clearLayers();

  const list = filteredConflicts();
  list.forEach((c) => {
    addConflictMarker(c);
    addConflictArrow(c);
  });

  if (list.length) {
    const bounds = L.latLngBounds(list.map((c) => [c.lat, c.lon]));
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 4.8 });
  } else {
    map.setView([20, 0], 2);
  }

  timelineStatus.textContent = `Showing conflicts: ${list.length}`;
}

function stopTimeline() {
  if (state.animationTimer) {
    clearInterval(state.animationTimer);
    state.animationTimer = null;
  }
}

function playTimeline() {
  stopTimeline();
  markerLayer.clearLayers();
  lineLayer.clearLayers();

  const timeline = filteredConflicts().slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  if (!timeline.length) {
    timelineStatus.textContent = "Timeline: no conflicts";
    return;
  }

  state.animationIndex = 0;
  timelineStatus.textContent = `Timeline: 0/${timeline.length}`;

  state.animationTimer = setInterval(() => {
    if (state.animationIndex >= timeline.length) {
      stopTimeline();
      timelineStatus.textContent = `Timeline complete (${timeline.length}/${timeline.length})`;
      return;
    }

    const item = timeline[state.animationIndex];
    addConflictMarker(item);
    addConflictArrow(item);

    state.animationIndex += 1;
    timelineStatus.textContent = `Timeline: ${state.animationIndex}/${timeline.length}`;
  }, 320);
}

async function loadConflicts() {
  try {
    const response = await fetch(`${API_URL}?_ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.conflicts = await response.json();
  } catch {
    const fallback = await fetch(`${LOCAL_JSON_URL}?_ts=${Date.now()}`, { cache: "no-store" });
    state.conflicts = await fallback.json();
  }

  buildCountryList(state.conflicts);
  updateMetrics();
  renderMapStatic();
}

countrySearch.addEventListener("change", () => {
  state.selectedCountry = countrySearch.value.trim();
  updateMetrics();
  renderMapStatic();
});

clearFilterBtn.addEventListener("click", () => {
  state.selectedCountry = "";
  countrySearch.value = "";
  updateMetrics();
  renderMapStatic();
});

refreshDataBtn.addEventListener("click", async () => {
  stopTimeline();
  await loadConflicts();
});

playTimelineBtn.addEventListener("click", playTimeline);
pauseTimelineBtn.addEventListener("click", () => {
  stopTimeline();
  timelineStatus.textContent = `Timeline paused (${state.animationIndex})`;
});

loadConflicts();
