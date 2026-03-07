/*
  GLOBAL WAR TRACKER • MVP frontend
  ---------------------------------
  Minimal features:
  - Minimalist interactive world map
  - Country search (manual any country name)
  - Detect current country (geolocation + reverse geocoding)
  - Days without war (global or selected country)
  - List of all active conflicts
  - Conflict lines/arrows + timeline animation (play/pause)
*/

const API_BASE = "";

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

const markerLayer = L.layerGroup().addTo(map);
const lineLayer = L.layerGroup().addTo(map);

const countrySearch = document.getElementById("countrySearch");
const countryOptions = document.getElementById("countryOptions");
const useMyLocationButton = document.getElementById("useMyLocation");
const clearCountryButton = document.getElementById("clearCountry");
const yearSlider = document.getElementById("yearSlider");
const yearLabel = document.getElementById("yearLabel");
const aiMode = document.getElementById("aiMode");
const refreshDataButton = document.getElementById("refreshData");

const activeConflictsEl = document.getElementById("activeConflicts");
const totalConflictsEl = document.getElementById("totalConflicts");
const daysWithoutWarEl = document.getElementById("daysWithoutWar");
const activeConflictsList = document.getElementById("activeConflictsList");

const playTimelineButton = document.getElementById("playTimeline");
const pauseTimelineButton = document.getElementById("pauseTimeline");
const timelineStatus = document.getElementById("timelineStatus");

const state = {
  conflicts: [],
  history: [],
  activeConflicts: [],
  selectedCountry: "",
  animationTimer: null,
  animationIndex: 0,
};

function statusColor(conflict) {
  if (conflict.end === null) return "#ff4d4d";
  const yearsSinceEnd = (Date.now() - new Date(conflict.end).getTime()) / (1000 * 60 * 60 * 24 * 365);
  return yearsSinceEnd <= 10 ? "#ff9f43" : "#8d98a5";
}

function conflictType(conflict) {
  const text = `${conflict.name || ""} ${conflict.description || ""}`.toLowerCase();
  if (text.includes("civil")) return "Civil war";
  if (text.includes("invasion")) return "Invasion";
  return "Armed conflict";
}

function startYear(conflict) {
  return Number(String(conflict.start || "1900-01-01").slice(0, 4));
}

function endYear(conflict) {
  return conflict.end ? Number(String(conflict.end).slice(0, 4)) : 9999;
}

function lineEndpoints(conflict) {
  const base = [Number(conflict.lat || 0), Number(conflict.lon || 0)];
  if (conflict.actor1 && conflict.actor2) {
    return {
      from: [conflict.actor1.lat, conflict.actor1.lon],
      to: [conflict.actor2.lat, conflict.actor2.lon],
      fromName: conflict.actor1.name || `${conflict.country} side A`,
      toName: conflict.actor2.name || `${conflict.country} side B`,
    };
  }

  return {
    from: base,
    to: [base[0] + 1.2, base[1] + 1.5],
    fromName: `${conflict.country} side A`,
    toName: `${conflict.country} side B`,
  };
}

function arrowHead(from, to, color) {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;

  const dx = lon2 - lon1;
  const dy = lat2 - lat1;
  const len = Math.hypot(dx, dy) || 1;

  const ux = dx / len;
  const uy = dy / len;

  const tip = [lat2, lon2];
  const back = [lat2 - uy * 0.4, lon2 - ux * 0.4];
  const left = [back[0] + ux * 0.2, back[1] - uy * 0.2];
  const right = [back[0] - ux * 0.2, back[1] + uy * 0.2];

  return L.polygon([tip, left, right], {
    color,
    fillColor: color,
    fillOpacity: 0.85,
    weight: 1,
    interactive: false,
  });
}

async function fetchJson(url, fallbackUrl = null) {
  const ts = `_ts=${Date.now()}`;
  const endpoint = url.includes("?") ? `${url}&${ts}` : `${url}?${ts}`;

  try {
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (!fallbackUrl) throw error;
    const fallbackResponse = await fetch(`${fallbackUrl}?${ts}`, { cache: "no-store" });
    return await fallbackResponse.json();
  }
}

function selectedYearFiltered(list) {
  const year = Number(yearSlider.value);
  return list.filter((item) => startYear(item) <= year && year <= endYear(item));
}

function selectedCountryFiltered(list) {
  const country = state.selectedCountry.trim().toLowerCase();
  if (!country) return list;
  return list.filter((item) => String(item.country || "").toLowerCase() === country);
}

function currentFilteredConflicts() {
  return selectedCountryFiltered(selectedYearFiltered(state.conflicts));
}

function renderOneConflict(conflict) {
  const color = statusColor(conflict);
  const endpoints = lineEndpoints(conflict);

  const marker = L.circleMarker([conflict.lat, conflict.lon], {
    radius: 6,
    color,
    fillColor: color,
    fillOpacity: 0.9,
    weight: 1,
  }).bindTooltip(
    `<strong>${conflict.name}</strong><br>${conflict.country}<br>${conflict.start} — ${conflict.end ?? "Active"}<br>${conflictType(conflict)}`,
    { className: "conflict-tooltip", direction: "top" }
  );

  const line = L.polyline([endpoints.from, endpoints.to], {
    color,
    weight: 2.5,
    opacity: 0.8,
  }).bindTooltip(
    `<strong>${endpoints.fromName} → ${endpoints.toName}</strong><br>${conflict.country}<br>${conflict.start} — ${conflict.end ?? "Active"}<br>${conflictType(conflict)}`,
    { className: "conflict-tooltip", direction: "top", sticky: true }
  );

  markerLayer.addLayer(marker);
  lineLayer.addLayer(line);
  lineLayer.addLayer(arrowHead(endpoints.from, endpoints.to, color));
}

function fitToConflicts(conflicts) {
  if (!conflicts.length) {
    map.setView([20, 0], 2.1);
    return;
  }

  const points = conflicts.flatMap((c) => {
    const e = lineEndpoints(c);
    return [[c.lat, c.lon], e.from, e.to];
  });
  map.fitBounds(L.latLngBounds(points), { padding: [20, 20], maxZoom: 5.8 });
}

function renderMapStatic() {
  markerLayer.clearLayers();
  lineLayer.clearLayers();

  const visible = currentFilteredConflicts();
  visible.forEach(renderOneConflict);
  fitToConflicts(visible);
  timelineStatus.textContent = `Показано конфликтов: ${visible.length}`;
}

function renderActiveConflictsList() {
  const scoped = selectedCountryFiltered(state.activeConflicts);
  activeConflictsList.innerHTML = "";

  if (!scoped.length) {
    const li = document.createElement("li");
    li.textContent = "Нет активных конфликтов для выбранного фильтра.";
    activeConflictsList.appendChild(li);
    return;
  }

  scoped.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${item.country}: ${item.name} (${item.start})`;
    activeConflictsList.appendChild(li);
  });
}

async function refreshMetrics() {
  const encodedCountry = state.selectedCountry ? encodeURIComponent(state.selectedCountry) : "";
  const query = encodedCountry ? `?country=${encodedCountry}` : "";

  const [metrics, countryDays] = await Promise.all([
    fetchJson(`${API_BASE}/api/metrics${query}`),
    fetchJson(`${API_BASE}/api/country-days${query}`),
  ]);

  activeConflictsEl.textContent = String(metrics.active_conflicts);
  totalConflictsEl.textContent = String(metrics.total_conflicts_since_1900);
  daysWithoutWarEl.textContent = String(countryDays.days_without_war);
}

function buildCountryDatalist() {
  // Use modern browser locale APIs (Chrome/Edge latest versions supported).
  if (!(window.Intl && Intl.DisplayNames && Intl.supportedValuesOf)) return;

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
  const regions = Intl.supportedValuesOf("region");

  const countryNames = regions
    .map((code) => displayNames.of(code))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  countryOptions.innerHTML = "";
  countryNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    countryOptions.appendChild(option);
  });
}

async function centerMapByCountry(countryName) {
  if (!countryName) return;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&country=${encodeURIComponent(countryName)}&limit=1`;
    const result = await fetchJson(url);
    if (Array.isArray(result) && result.length > 0) {
      const lat = Number(result[0].lat);
      const lon = Number(result[0].lon);
      map.setView([lat, lon], 4.2);
    }
  } catch {
    // If geocoding is unavailable, keep current map view silently.
  }
}

async function detectMyCountryAndApply() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        const response = await fetchJson(url);
        const country = response?.address?.country;
        if (country) {
          state.selectedCountry = country;
          countrySearch.value = country;
          await centerMapByCountry(country);
          await refreshMetrics();
          renderMapStatic();
          renderActiveConflictsList();
        }
      } catch {
        // Ignore geo/reverse lookup failures in MVP.
      }
    },
    () => {
      // User denied geolocation or it failed.
    },
    { timeout: 8000 }
  );
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

  const timeline = selectedCountryFiltered(
    [...state.history, ...state.conflicts]
      .filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx)
      .sort((a, b) => startYear(a) - startYear(b))
  );

  const filtered = selectedYearFiltered(timeline);
  if (!filtered.length) {
    timelineStatus.textContent = "Timeline: нет данных";
    return;
  }

  state.animationIndex = 0;
  timelineStatus.textContent = `Timeline: 0/${filtered.length}`;

  state.animationTimer = setInterval(() => {
    if (state.animationIndex >= filtered.length) {
      stopTimeline();
      timelineStatus.textContent = `Timeline завершен (${filtered.length}/${filtered.length})`;
      fitToConflicts(filtered);
      return;
    }

    renderOneConflict(filtered[state.animationIndex]);
    state.animationIndex += 1;
    timelineStatus.textContent = `Timeline: ${state.animationIndex}/${filtered.length}`;
  }, 300);
}

function pauseTimeline() {
  stopTimeline();
  timelineStatus.textContent = `Timeline paused (${state.animationIndex})`;
}

async function loadEverything() {
  const [conflicts, history, active] = await Promise.all([
    fetchJson(`${API_BASE}/api/conflicts`, "../data/conflicts.json"),
    fetchJson(`${API_BASE}/api/history`, "../data/history_1900.json"),
    fetchJson(`${API_BASE}/api/active-conflicts`, "../data/conflicts.json"),
  ]);

  state.conflicts = conflicts;
  state.history = history;
  state.activeConflicts = active.filter((item) => item.end === null);

  const maxKnownYear = Math.max(...[...history, ...conflicts].map(startYear), 1900);
  yearSlider.max = String(Math.max(maxKnownYear, new Date().getFullYear()));
  yearLabel.textContent = yearSlider.value;
}

async function refreshAll() {
  refreshDataButton.disabled = true;
  refreshDataButton.textContent = "Refreshing...";

  try {
    if (aiMode.value === "ai") {
      await fetch(`${API_BASE}/api/ai-update`, { method: "POST", cache: "no-store" });
    }

    await loadEverything();
    await refreshMetrics();
    renderMapStatic();
    renderActiveConflictsList();
  } finally {
    refreshDataButton.disabled = false;
    refreshDataButton.textContent = "Refresh Data";
  }
}

// --- Event bindings ---
countrySearch.addEventListener("change", async () => {
  state.selectedCountry = countrySearch.value.trim();
  await centerMapByCountry(state.selectedCountry);
  await refreshMetrics();
  renderMapStatic();
  renderActiveConflictsList();
});

useMyLocationButton.addEventListener("click", detectMyCountryAndApply);

clearCountryButton.addEventListener("click", async () => {
  state.selectedCountry = "";
  countrySearch.value = "";
  await refreshMetrics();
  renderMapStatic();
  renderActiveConflictsList();
});

yearSlider.addEventListener("input", async () => {
  yearLabel.textContent = yearSlider.value;
  renderMapStatic();
  await refreshMetrics();
});

refreshDataButton.addEventListener("click", async () => {
  stopTimeline();
  await refreshAll();
});

playTimelineButton.addEventListener("click", playTimeline);
pauseTimelineButton.addEventListener("click", pauseTimeline);

async function bootstrap() {
  buildCountryDatalist();
  await refreshAll();
}

bootstrap();
