/*
  GLOBAL WAR TRACKER frontend logic
  ---------------------------------
  Simplified UI:
  - Fewer buttons on the dashboard
  - Settings moved into a collapsible settings panel
  - AI manual update button removed (mode is now configured in settings)
  - Improved map navigation with better base map options + fit-to-data behavior
*/

const API_BASE = "";

const map = L.map("map", {
  worldCopyJump: true,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  minZoom: 2,
  maxZoom: 8,
  zoomControl: false,
  preferCanvas: true,
}).setView([20, 0], 2.25);

const baseLayers = {
  "Dark (clean)": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "© OpenStreetMap © CARTO",
  }),
  "Light (detailed)": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }),
};

baseLayers["Dark (clean)"].addTo(map);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);
L.control.layers(baseLayers, null, { position: "topright", collapsed: true }).addTo(map);

const layerGroup = L.layerGroup().addTo(map);

const settingsPanel = document.getElementById("settingsPanel");
const toggleSettingsButton = document.getElementById("toggleSettings");
const yearSlider = document.getElementById("yearSlider");
const yearLabel = document.getElementById("yearLabel");
const countryFilter = document.getElementById("countryFilter");
const aiUpdateMode = document.getElementById("aiUpdateMode");
const playAnimationButton = document.getElementById("playAnimation");

const activeConflictsEl = document.getElementById("activeConflicts");
const totalConflictsEl = document.getElementById("totalConflicts");
const daysWithoutWarEl = document.getElementById("daysWithoutWar");
const tensionIndexEl = document.getElementById("tensionIndex");
const predictionEl = document.getElementById("prediction");

let conflicts = [];
let history = [];

function getMarkerColor(conflict) {
  if (conflict.end === null) return "#ff4d4d";

  const endDate = new Date(conflict.end);
  const yearsSinceEnd = (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
  return yearsSinceEnd <= 10 ? "#ff9f43" : "#a0a0a0";
}

function buildConflictMarker(conflict) {
  const marker = L.circleMarker([conflict.lat, conflict.lon], {
    radius: 7,
    color: getMarkerColor(conflict),
    fillOpacity: 0.9,
  });

  marker.bindPopup(`
    <strong>${conflict.name}</strong><br />
    <strong>Country:</strong> ${conflict.country}<br />
    <strong>Start:</strong> ${conflict.start}<br />
    <strong>End:</strong> ${conflict.end ?? "Active"}<br />
    <strong>Description:</strong> ${conflict.description}
  `);

  return marker;
}

function getFilteredConflicts() {
  const selectedYear = Number(yearSlider.value);
  const selectedCountries = Array.from(countryFilter.selectedOptions).map((o) => o.value);

  return conflicts.filter((conflict) => {
    const startYear = Number(conflict.start.slice(0, 4));
    const endYear = conflict.end ? Number(conflict.end.slice(0, 4)) : 9999;

    const matchesYear = startYear <= selectedYear && selectedYear <= endYear;
    const matchesCountry = selectedCountries.length === 0 || selectedCountries.includes(conflict.country);

    return matchesYear && matchesCountry;
  });
}

function fitMapToConflicts(filtered) {
  if (!filtered.length) {
    map.setView([20, 0], 2.25);
    return;
  }

  const bounds = L.latLngBounds(filtered.map((c) => [c.lat, c.lon]));
  map.fitBounds(bounds, { padding: [35, 35], maxZoom: 5.75 });
}

function renderMap() {
  layerGroup.clearLayers();
  const filtered = getFilteredConflicts();
  filtered.forEach((conflict) => layerGroup.addLayer(buildConflictMarker(conflict)));
  fitMapToConflicts(filtered);
}

function populateCountryFilter() {
  const countries = [...new Set(conflicts.map((c) => c.country))].sort();
  countryFilter.innerHTML = "";

  countries.forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countryFilter.appendChild(option);
  });
}

async function loadMetrics() {
  const selectedCountries = Array.from(countryFilter.selectedOptions).map((o) => o.value);
  const countryQuery = selectedCountries.length === 1 ? `?country=${encodeURIComponent(selectedCountries[0])}` : "";

  try {
    const response = await fetch(`${API_BASE}/api/metrics${countryQuery}`);
    if (!response.ok) throw new Error("metrics api unavailable");
    const metrics = await response.json();

    activeConflictsEl.textContent = metrics.active_conflicts;
    totalConflictsEl.textContent = metrics.total_conflicts_since_1900;
    daysWithoutWarEl.textContent = metrics.days_without_war;
    tensionIndexEl.textContent = metrics.global_military_tension_index;
    return;
  } catch (error) {
    const selectedCountry = selectedCountries.length === 1 ? selectedCountries[0] : null;
    const target = selectedCountry ? conflicts.filter((c) => c.country === selectedCountry) : conflicts;

    const active = target.filter((c) => c.end === null).length;
    const total = history.length;

    let daysWithout = 0;
    if (active === 0) {
      const ended = target.filter((c) => c.end).map((c) => new Date(c.end));
      if (ended.length) {
        const latest = ended.sort((a, b) => b - a)[0];
        daysWithout = Math.floor((Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const recent = target.filter((c) => c.end && (Date.now() - new Date(c.end).getTime()) / (1000 * 60 * 60 * 24 * 365) <= 5).length;
    const tension = Math.min((active * 6) + (recent * 3) + (history.length / 20), 100).toFixed(2);

    activeConflictsEl.textContent = String(active);
    totalConflictsEl.textContent = String(total);
    daysWithoutWarEl.textContent = String(daysWithout);
    tensionIndexEl.textContent = String(tension);
  }
}

function updatePrediction() {
  const active = conflicts.filter((c) => c.end === null);
  if (active.length === 0) {
    predictionEl.textContent = "Potential next conflict zone: low global risk signal.";
    return;
  }

  const counts = {};
  active.forEach((c) => {
    counts[c.country] = (counts[c.country] || 0) + 1;
  });

  const [topCountry, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  predictionEl.textContent = `Potential next conflict zone: ${topCountry} (active-signal score: ${topCount}).`;
}

function animateTimeline() {
  let year = 1900;
  const maxYear = Number(yearSlider.max);

  const timer = setInterval(() => {
    yearSlider.value = year;
    yearLabel.textContent = String(year);
    renderMap();

    year += 1;
    if (year > maxYear) {
      clearInterval(timer);
    }
  }, 120);
}

async function bootstrap() {
  try {
    const [conflictResponse, historyResponse] = await Promise.all([
      fetch(`${API_BASE}/api/conflicts`),
      fetch(`${API_BASE}/api/history`),
    ]);

    if (!conflictResponse.ok || !historyResponse.ok) throw new Error("api not available");

    conflicts = await conflictResponse.json();
    history = await historyResponse.json();
  } catch (error) {
    const [conflictResponse, historyResponse] = await Promise.all([
      fetch("../data/conflicts.json"),
      fetch("../data/history_1900.json"),
    ]);
    conflicts = await conflictResponse.json();
    history = await historyResponse.json();
  }

  const maxKnownYear = Math.max(...conflicts.map((c) => Number(c.start.slice(0, 4))), 1900);
  yearSlider.max = String(Math.max(maxKnownYear, new Date().getFullYear()));

  populateCountryFilter();
  renderMap();
  await loadMetrics();
  updatePrediction();
}

toggleSettingsButton.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
});

yearSlider.addEventListener("input", () => {
  yearLabel.textContent = yearSlider.value;
  renderMap();
});

countryFilter.addEventListener("change", async () => {
  renderMap();
  await loadMetrics();
});

// For now this is configuration-only (no manual trigger button).
aiUpdateMode.addEventListener("change", () => {
  const mode = aiUpdateMode.value;
  console.info(`AI update mode set to: ${mode}`);
});

playAnimationButton.addEventListener("click", animateTimeline);

bootstrap();
