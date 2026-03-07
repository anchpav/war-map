/*
  GLOBAL WAR TRACKER frontend
  ---------------------------
  Goals:
  - Keep UI simple (single dropdown for filters/settings)
  - Fetch fresh data from backend/local source on each refresh
  - Render conflicts as markers + directional conflict lines (arrow-like)
  - Animate conflicts in chronological order with play/pause controls
*/

const API_BASE = "";

// ----------------------------
// DOM references
// ----------------------------
const countryFilter = document.getElementById("countryFilter");
const yearSlider = document.getElementById("yearSlider");
const yearLabel = document.getElementById("yearLabel");
const aiUpdateMode = document.getElementById("aiUpdateMode");
const refreshDataButton = document.getElementById("refreshData");

const playTimelineButton = document.getElementById("playTimeline");
const pauseTimelineButton = document.getElementById("pauseTimeline");
const timelineStatus = document.getElementById("timelineStatus");

const activeConflictsEl = document.getElementById("activeConflicts");
const totalConflictsEl = document.getElementById("totalConflicts");
const daysWithoutWarEl = document.getElementById("daysWithoutWar");
const tensionIndexEl = document.getElementById("tensionIndex");

// ----------------------------
// Map setup (minimalistic, interactive, responsive)
// ----------------------------
const map = L.map("map", {
  worldCopyJump: true,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  minZoom: 2,
  maxZoom: 8,
  preferCanvas: true,
}).setView([20, 0], 2.1);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: "© OpenStreetMap © CARTO",
}).addTo(map);

L.control.scale({ imperial: false }).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const lineLayer = L.layerGroup().addTo(map);

// ----------------------------
// In-memory state (single source of truth on frontend)
// ----------------------------
const state = {
  conflicts: [],
  history: [],
  allTimelineItems: [],
  animationTimer: null,
  animationIndex: 0,
};

// ----------------------------
// Helpers for conflict styling & metadata
// ----------------------------
function conflictStatusColor(conflict) {
  if (conflict.end === null) return "#ff4d4d"; // active
  const yearsSinceEnd = (Date.now() - new Date(conflict.end).getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (yearsSinceEnd <= 10) return "#ff9f43"; // recent
  return "#9aa0a6"; // historical
}

function conflictType(conflict) {
  const text = `${conflict.name || ""} ${conflict.description || ""}`.toLowerCase();
  if (text.includes("civil")) return "Civil war";
  if (text.includes("invasion")) return "Interstate invasion";
  if (text.includes("clash") || text.includes("strike") || text.includes("missile")) return "Armed clashes";
  return "Military conflict";
}

function startYear(conflict) {
  return Number(String(conflict.start || "1900-01-01").slice(0, 4));
}

function endYear(conflict) {
  return conflict.end ? Number(String(conflict.end).slice(0, 4)) : 9999;
}

// If actors are absent in data, generate a short directional segment so users
// still see who is in conflict with whom in a visual way.
function buildEndpoints(conflict) {
  if (conflict.actor1 && conflict.actor2) {
    return {
      from: [conflict.actor1.lat, conflict.actor1.lon],
      to: [conflict.actor2.lat, conflict.actor2.lon],
      fromName: conflict.actor1.name || `${conflict.country} side A`,
      toName: conflict.actor2.name || `${conflict.country} side B`,
    };
  }

  const baseLat = Number(conflict.lat || 0);
  const baseLon = Number(conflict.lon || 0);
  return {
    from: [baseLat, baseLon],
    to: [baseLat + 1.4, baseLon + 1.8],
    fromName: `${conflict.country} side A`,
    toName: `${conflict.country} side B`,
  };
}

function lineHoverText(conflict, endpoints) {
  return [
    `<strong>${endpoints.fromName} → ${endpoints.toName}</strong>`,
    `Country: ${conflict.country}`,
    `Dates: ${conflict.start} — ${conflict.end ?? "Active"}`,
    `Type: ${conflictType(conflict)}`,
  ].join("<br>");
}

// Draw a small arrowhead polygon near line end for directional sense.
function createArrowHead(from, to, color) {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;

  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const len = Math.hypot(dx, dy) || 1;

  const ux = dx / len;
  const uy = dy / len;

  const size = 0.45;
  const wing = 0.25;

  const tip = [lat2, lon2];
  const backCenter = [lat2 - uy * size, lon2 - ux * size];
  const left = [backCenter[0] + ux * wing, backCenter[1] - uy * wing];
  const right = [backCenter[0] - ux * wing, backCenter[1] + uy * wing];

  return L.polygon([tip, left, right], {
    color,
    fillColor: color,
    fillOpacity: 0.9,
    weight: 1,
    interactive: false,
  });
}

// ----------------------------
// Data loading
// ----------------------------
async function fetchJson(url, fallbackUrl = null) {
  const cacheBust = `_ts=${Date.now()}`;
  const target = url.includes("?") ? `${url}&${cacheBust}` : `${url}?${cacheBust}`;

  try {
    const response = await fetch(target, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (!fallbackUrl) throw error;
    const fallbackTarget = `${fallbackUrl}?${cacheBust}`;
    const fallbackResponse = await fetch(fallbackTarget, { cache: "no-store" });
    return await fallbackResponse.json();
  }
}

async function loadData() {
  // Always re-request data, never rely on stale frontend cache.
  const [conflicts, history] = await Promise.all([
    fetchJson(`${API_BASE}/api/conflicts`, "../data/conflicts.json"),
    fetchJson(`${API_BASE}/api/history`, "../data/history_1900.json"),
  ]);

  state.conflicts = conflicts;
  state.history = history;

  // Timeline includes both datasets, sorted old -> new.
  const merged = [...history, ...conflicts];
  const unique = [];
  const seen = new Set();
  merged.forEach((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  });

  state.allTimelineItems = unique.sort((a, b) => startYear(a) - startYear(b));

  const maxKnownYear = Math.max(...state.allTimelineItems.map(startYear), 1900);
  yearSlider.max = String(Math.max(maxKnownYear, new Date().getFullYear()));
  if (Number(yearSlider.value) > Number(yearSlider.max)) {
    yearSlider.value = yearSlider.max;
  }
  yearLabel.textContent = yearSlider.value;
}

async function refreshMetrics() {
  const selectedCountries = Array.from(countryFilter.selectedOptions).map((option) => option.value);
  const countryQuery = selectedCountries.length === 1 ? `?country=${encodeURIComponent(selectedCountries[0])}` : "";

  // Prefer backend metric calculations for accuracy.
  try {
    const metrics = await fetchJson(`${API_BASE}/api/metrics${countryQuery}`);
    activeConflictsEl.textContent = String(metrics.active_conflicts);
    totalConflictsEl.textContent = String(metrics.total_conflicts_since_1900);
    daysWithoutWarEl.textContent = String(metrics.days_without_war);
    tensionIndexEl.textContent = String(metrics.global_military_tension_index);
  } catch {
    // Minimal fallback only if API is unavailable: derive from fresh in-memory data
    // loaded moments ago from json files.
    const scoped = selectedCountries.length === 1
      ? state.conflicts.filter((c) => c.country === selectedCountries[0])
      : state.conflicts;

    const active = scoped.filter((c) => c.end === null).length;
    activeConflictsEl.textContent = String(active);
    totalConflictsEl.textContent = String(new Set([...state.history, ...state.conflicts].map((c) => c.id)).size);
    daysWithoutWarEl.textContent = active > 0 ? "0" : "--";
    tensionIndexEl.textContent = "--";
  }
}

function populateCountryFilter() {
  const countries = [...new Set(state.conflicts.map((item) => item.country))].sort();
  countryFilter.innerHTML = "";

  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countryFilter.appendChild(option);
  });
}

function getFilteredConflicts(conflictsList) {
  const selectedYear = Number(yearSlider.value);
  const selectedCountries = Array.from(countryFilter.selectedOptions).map((option) => option.value);

  return conflictsList.filter((conflict) => {
    const yearMatch = startYear(conflict) <= selectedYear && selectedYear <= endYear(conflict);
    const countryMatch = selectedCountries.length === 0 || selectedCountries.includes(conflict.country);
    return yearMatch && countryMatch;
  });
}

// ----------------------------
// Rendering map layers
// ----------------------------
function renderConflict(conflict) {
  const color = conflictStatusColor(conflict);
  const endpoints = buildEndpoints(conflict);

  const marker = L.circleMarker([conflict.lat, conflict.lon], {
    radius: 5.8,
    color,
    fillColor: color,
    fillOpacity: 0.9,
    weight: 1,
  }).bindTooltip(
    `<strong>${conflict.name}</strong><br>${conflict.country}<br>${conflict.start} — ${conflict.end ?? "Active"}<br>${conflictType(conflict)}`,
    { direction: "top", className: "conflict-tooltip" }
  );

  const line = L.polyline([endpoints.from, endpoints.to], {
    color,
    weight: 2.8,
    opacity: 0.78,
  }).bindTooltip(lineHoverText(conflict, endpoints), {
    direction: "top",
    className: "conflict-tooltip",
    sticky: true,
  });

  markerLayer.addLayer(marker);
  lineLayer.addLayer(line);
  lineLayer.addLayer(createArrowHead(endpoints.from, endpoints.to, color));
}

function fitMapToVisible(conflictsToRender) {
  if (!conflictsToRender.length) {
    map.setView([20, 0], 2.1);
    return;
  }

  const points = conflictsToRender.flatMap((c) => {
    const e = buildEndpoints(c);
    return [[c.lat, c.lon], e.from, e.to];
  });

  map.fitBounds(L.latLngBounds(points), { padding: [25, 25], maxZoom: 5.8 });
}

function renderStaticView() {
  markerLayer.clearLayers();
  lineLayer.clearLayers();

  const filtered = getFilteredConflicts(state.conflicts);
  filtered.forEach(renderConflict);
  fitMapToVisible(filtered);
  timelineStatus.textContent = `Showing ${filtered.length} filtered conflicts`;
}

// ----------------------------
// Timeline animation (old -> new)
// ----------------------------
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

  const timelineItems = getFilteredConflicts(state.allTimelineItems);
  if (!timelineItems.length) {
    timelineStatus.textContent = "Timeline: no conflicts for current filters";
    return;
  }

  state.animationIndex = 0;
  timelineStatus.textContent = `Timeline playing (0/${timelineItems.length})`;

  state.animationTimer = setInterval(() => {
    if (state.animationIndex >= timelineItems.length) {
      stopTimeline();
      timelineStatus.textContent = `Timeline complete (${timelineItems.length}/${timelineItems.length})`;
      fitMapToVisible(timelineItems);
      return;
    }

    renderConflict(timelineItems[state.animationIndex]);
    state.animationIndex += 1;
    timelineStatus.textContent = `Timeline playing (${state.animationIndex}/${timelineItems.length})`;
  }, 280);
}

function pauseTimeline() {
  stopTimeline();
  timelineStatus.textContent = `Timeline paused (${state.animationIndex} shown)`;
}

// ----------------------------
// Refresh pipeline
// ----------------------------
async function refreshAll() {
  refreshDataButton.disabled = true;
  refreshDataButton.textContent = "Refreshing...";

  try {
    if (aiUpdateMode.value === "ai") {
      // In AI mode, request backend to run updater first.
      await fetch(`${API_BASE}/api/ai-update`, { method: "POST", cache: "no-store" });
    }

    await loadData();
    populateCountryFilter();
    await refreshMetrics();
    renderStaticView();
  } finally {
    refreshDataButton.disabled = false;
    refreshDataButton.textContent = "Refresh Data";
  }
}

// ----------------------------
// Event bindings
// ----------------------------
yearSlider.addEventListener("input", async () => {
  yearLabel.textContent = yearSlider.value;
  renderStaticView();
  await refreshMetrics();
});

countryFilter.addEventListener("change", async () => {
  renderStaticView();
  await refreshMetrics();
});

refreshDataButton.addEventListener("click", async () => {
  stopTimeline();
  await refreshAll();
});

playTimelineButton.addEventListener("click", playTimeline);
pauseTimelineButton.addEventListener("click", pauseTimeline);

// Initial boot
refreshAll();
