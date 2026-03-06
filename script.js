+// Global Conflict Tracker
+// This app is static and GitHub Pages friendly (no server required).
 
+// DATA SOURCE SETTINGS:
+// 1) For production, set CONFLICTS_URL to an online JSON endpoint (for example raw.githubusercontent URL).
+// 2) Keep fallback CONFLICTS_FALLBACK_URL as local conflicts.json for local/dev reliability.
+const CONFLICTS_URL = "https://raw.githubusercontent.com/USERNAME/repo/main/conflicts.json";
+const CONFLICTS_FALLBACK_URL = "./conflicts.json";
+
+const state = {
+  allEvents: [],
+  filtered: [],
+  map: null,
+  markerLayer: null,
+  linesLayer: null,
+  heatLayer: null,
+  selectedYear: null
+};
+
+const refs = {
+  mapWrap: document.getElementById("mapWrap"),
+  dataUnavailable: document.getElementById("dataUnavailable"),
+  yearFilter: document.getElementById("yearFilter"),
+  yearLabel: document.getElementById("yearLabel"),
+  yearReset: document.getElementById("yearReset"),
+  countryFilter: document.getElementById("countryFilter"),
+  visibleCount: document.getElementById("visibleCount"),
+  sourceLabel: document.getElementById("sourceLabel")
+};
+
+init();
+
+async function init() {
+  initMap();
+  wireFilters();
+
+  const loaded = await loadData();
+  if (!loaded) {
+    showDataUnavailable();
+    return;
+  }
+
+  setupFilterRanges();
+  populateCountryFilter();
+  applyFilters();
+}
+
+function initMap() {
+  state.map = L.map("map", { zoomControl: true }).setView([20, 8], 2);
+
+  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
+    maxZoom: 19,
+    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
+  }).addTo(state.map);
+
+  state.markerLayer = L.layerGroup().addTo(state.map);
+  state.linesLayer = L.layerGroup().addTo(state.map);
+}
+
+function wireFilters() {
+  refs.yearFilter.addEventListener("input", () => {
+    state.selectedYear = Number(refs.yearFilter.value);
+    refs.yearLabel.textContent = String(state.selectedYear);
+    applyFilters();
+  });
+
+  refs.yearReset.addEventListener("click", () => {
+    state.selectedYear = null;
+    refs.yearLabel.textContent = "All";
+    applyFilters();
+  });
+
+  refs.countryFilter.addEventListener("change", () => {
+    applyFilters();
+  });
+}
+
+async function loadData() {
+  const attempts = [
+    { url: CONFLICTS_URL, label: "Online JSON" },
+    { url: CONFLICTS_FALLBACK_URL, label: "Local fallback JSON" }
+  ];
+
+  for (const attempt of attempts) {
+    try {
+      const response = await fetch(attempt.url, { cache: "no-store" });
+      if (!response.ok) throw new Error(`HTTP ${response.status}`);
+      const payload = await response.json();
+
+      if (!Array.isArray(payload)) throw new Error("Expected top-level JSON array");
+
+      state.allEvents = payload
+        .map(normalizeEvent)
+        .filter((event) => Number.isFinite(event.lat) && Number.isFinite(event.lon));
+
+      refs.sourceLabel.textContent = attempt.label;
+      return state.allEvents.length > 0;
+    } catch (error) {
+      console.warn(`Failed loading ${attempt.url}`, error);
+    }
+  }
+
+  return false;
+}
+
+function normalizeEvent(raw) {
+  // NOTE FOR EASY SOURCE CHANGES:
+  // If your JSON keys differ, update mappings in this function only.
+  // Example: change raw.lat/raw.lon/raw.country/raw.year to your source field names.
+
+  const lat = Number(raw.lat ?? raw.latitude);
+  const lon = Number(raw.lon ?? raw.lng ?? raw.longitude);
+
+  return {
+    id: raw.id ?? cryptoRandomId(),
+    lat,
+    lon,
+    title: raw.title ?? "Untitled conflict",
+    description: raw.description ?? "No description available.",
+    country: raw.country ?? "Unknown",
+    year: Number(raw.year),
+    actor1: normalizeActor(raw.actor1),
+    actor2: normalizeActor(raw.actor2)
+  };
+}
+
+function normalizeActor(actor) {
+  return {
+    lat: Number(actor?.lat),
+    lon: Number(actor?.lon),
+    name: actor?.name ?? "Unknown actor"
+  };
+}
+
+function setupFilterRanges() {
+  const years = state.allEvents
+    .map((event) => event.year)
+    .filter((year) => Number.isFinite(year));
+
+  const minYear = years.length ? Math.min(...years) : new Date().getFullYear();
+  const maxYear = years.length ? Math.max(...years) : new Date().getFullYear();
+
+  refs.yearFilter.min = String(minYear);
+  refs.yearFilter.max = String(maxYear);
+  refs.yearFilter.value = String(maxYear);
+}
+
+function populateCountryFilter() {
+  const countries = Array.from(new Set(state.allEvents.map((event) => event.country))).sort();
+  refs.countryFilter.innerHTML = "";
+
+  countries.forEach((country) => {
+    const option = document.createElement("option");
+    option.value = country;
+    option.textContent = country;
+    refs.countryFilter.append(option);
+  });
+}
+
+function getSelectedCountries() {
+  return Array.from(refs.countryFilter.selectedOptions).map((option) => option.value);
+}
+
+function applyFilters() {
+  const selectedCountries = getSelectedCountries();
+
+  state.filtered = state.allEvents.filter((event) => {
+    const yearPass = state.selectedYear === null ? true : event.year === state.selectedYear;
+    const countryPass = selectedCountries.length === 0 ? true : selectedCountries.includes(event.country);
+    return yearPass && countryPass;
+  });
+
+  renderMap(state.filtered);
+  refs.visibleCount.textContent = String(state.filtered.length);
+}
+
+function renderMap(events) {
+  state.markerLayer.clearLayers();
+  state.linesLayer.clearLayers();
+
+  // Red markers for all conflicts + popup content.
+  // To customize popup layout later, edit this section only.
+  events.forEach((event) => {
+    const marker = L.circleMarker([event.lat, event.lon], {
+      radius: 7,
+      color: "#ff2a2a",
+      fillColor: "#ff2a2a",
+      fillOpacity: 0.9,
+      weight: 1
+    }).addTo(state.markerLayer);
+
+    marker.bindPopup(`
+      <div>
+        <strong>${escapeHtml(event.title)}</strong><br />
+        ${escapeHtml(event.description)}<br />
+        <em>${escapeHtml(event.country)}</em>
+      </div>
+    `);
+
+    // Yellow line connecting actor1 and actor2.
+    if (
+      Number.isFinite(event.actor1.lat) &&
+      Number.isFinite(event.actor1.lon) &&
+      Number.isFinite(event.actor2.lat) &&
+      Number.isFinite(event.actor2.lon)
+    ) {
+      L.polyline(
+        [
+          [event.actor1.lat, event.actor1.lon],
+          [event.actor2.lat, event.actor2.lon]
+        ],
+        { color: "#ffe54d", weight: 2.5, opacity: 0.9 }
+      )
+        .bindTooltip(`${escapeHtml(event.actor1.name)} → ${escapeHtml(event.actor2.name)}`)
+        .addTo(state.linesLayer);
+    }
+  });
+
+  renderHeat(events);
+}
+
+function renderHeat(events) {
+  if (state.heatLayer) {
+    state.map.removeLayer(state.heatLayer);
+  }
+
+  if (typeof L.heatLayer !== "function") return;
+
+  const points = events.map((event) => [event.lat, event.lon, 0.8]);
+  state.heatLayer = L.heatLayer(points, {
+    radius: 28,
+    blur: 22,
+    maxZoom: 8,
+    gradient: {
+      0.3: "#fff59d",
+      0.6: "#ffb74d",
+      1.0: "#ff3d00"
+    }
+  }).addTo(state.map);
+}
+
+function showDataUnavailable() {
+  refs.mapWrap.hidden = true;
+  refs.dataUnavailable.hidden = false;
+  refs.sourceLabel.textContent = "Unavailable";
+}
+
+function escapeHtml(text) {
+  return String(text)
+    .replace(/&/g, "&amp;")
+    .replace(/</g, "&lt;")
+    .replace(/>/g, "&gt;")
+    .replace(/\"/g, "&quot;")
+    .replace(/'/g, "&#039;");
+}
+
+function cryptoRandomId() {
+  return Math.floor(Math.random() * 1_000_000_000);
+}
