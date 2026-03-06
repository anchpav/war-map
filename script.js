const CONFLICTS_URL = "./conflicts.json";

const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let linesLayer = L.layerGroup().addTo(map);
let heatLayer;

const yearFilter = document.getElementById("yearFilter");
const yearLabel = document.getElementById("yearLabel");
const yearReset = document.getElementById("yearReset");
const countryFilter = document.getElementById("countryFilter");
const visibleCount = document.getElementById("visibleCount");
const daysWithoutWarEl = document.getElementById("daysWithoutWar");
const dataUnavailable = document.getElementById("dataUnavailable");
const sourceLabel = document.getElementById("sourceLabel");

let conflictsData = [];

fetch(CONFLICTS_URL)
  .then(res => res.json())
  .then(data => {
    conflictsData = data;
    dataUnavailable.hidden = true;
    sourceLabel.textContent = "Local JSON";
    populateCountryFilter();
    renderMap();
    updateDaysWithoutWar();
  })
  .catch(err => {
    console.error("Failed to load conflicts:", err);
    dataUnavailable.hidden = false;
    sourceLabel.textContent = "Unavailable";
  });

function populateCountryFilter() {
  const countries = [...new Set(conflictsData.map(c => c.country))].sort();
  countries.forEach(country => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countryFilter.appendChild(option);
  });
}

function renderMap() {
  markersLayer.clearLayers();
  linesLayer.clearLayers();
  if (heatLayer) map.removeLayer(heatLayer);

  const selectedYear = parseInt(yearFilter.value) || null;
  const selectedCountries = Array.from(countryFilter.selectedOptions).map(o => o.value);

  const filtered = conflictsData.filter(c => {
    const yearMatch = selectedYear ? c.year === selectedYear : true;
    const countryMatch = selectedCountries.length ? selectedCountries.includes(c.country) : true;
    return yearMatch && countryMatch;
  });

  filtered.forEach(c => {
    L.marker([c.lat, c.lon]).bindPopup(`
      <b>${c.title}</b><br>
      ${c.description}<br>
      <i>${c.country}</i>
    `).addTo(markersLayer);

    L.polyline([
      [c.actor1.lat, c.actor1.lon],
      [c.actor2.lat, c.actor2.lon]
    ], { color: 'yellow' }).addTo(linesLayer);
  });

  const heatPoints = filtered.map(c => [c.lat, c.lon, 1]);
  heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15 }).addTo(map);

  visibleCount.textContent = filtered.length;
  updateDaysWithoutWar(selectedCountries);
}

function updateDaysWithoutWar(selectedCountries = []) {
  const now = new Date();
  const filtered = conflictsData.filter(c => selectedCountries.length ? selectedCountries.includes(c.country) : true);
  if (!filtered.length) {
    daysWithoutWarEl.textContent = "∞";
    return;
  }
  const lastConflictDate = new Date(Math.max(...filtered.map(c => new Date(`${c.year}-01-01`).getTime())));
  const diffDays = Math.floor((now - lastConflictDate) / (1000*60*60*24));
  daysWithoutWarEl.textContent = diffDays;
}

yearFilter.addEventListener("input", () => {
  const val = parseInt(yearFilter.value);
  yearLabel.textContent = val || "All";
  renderMap();
});

yearReset.addEventListener("click", () => {
  yearFilter.value = 0;
  yearLabel.textContent = "All";
  renderMap();
});

countryFilter.addEventListener("change", () => renderMap());
