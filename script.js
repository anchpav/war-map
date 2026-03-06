const DATA_URL = "./conflicts.json";

const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors"
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let linesLayer = L.layerGroup().addTo(map);
let heatLayer;

const yearFilter = document.getElementById("yearFilter");
const yearLabel = document.getElementById("yearLabel");
const yearReset = document.getElementById("yearReset");
const countryFilter = document.getElementById("countryFilter");
const visibleCount = document.getElementById("visibleCount");
const daysWithoutWar = document.getElementById("daysWithoutWar");
const dataUnavailable = document.getElementById("dataUnavailable");
const sourceLabel = document.getElementById("sourceLabel");

let conflictsData = [];

fetch(DATA_URL)
  .then(res => res.json())
  .then(data => {
    conflictsData = data;
    dataUnavailable.hidden = true;
    sourceLabel.textContent = "Local JSON";
    populateCountryFilter();
    renderMap();
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

function calculateDaysWithoutWar(filtered) {
  if (!filtered.length) return "--";

  const today = new Date();
  // Берём максимальную дату из выбранных конфликтов
  const lastConflict = filtered.reduce((latest, c) => {
    if (!c.date) return latest;
    const conflictDate = new Date(c.date);
    return conflictDate > latest ? conflictDate : latest;
  }, new Date(0));

  const diffTime = today - lastConflict;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function renderMap() {
  markersLayer.clearLayers();
  linesLayer.clearLayers();
  if (heatLayer) map.removeLayer(heatLayer);

  const selectedYear = parseInt(yearFilter.value);
  const selectedCountries = Array.from(countryFilter.selectedOptions).map(o => o.value);

  const filtered = conflictsData.filter(c => {
    const yearMatch = selectedYear ? c.year === selectedYear : true;
    const countryMatch = selectedCountries.length ? selectedCountries.includes(c.country) : true;
    return yearMatch && countryMatch;
  });

  visibleCount.textContent = filtered.length;
  daysWithoutWar.textContent = calculateDaysWithoutWar(filtered);

  const heatPoints = [];

  filtered.forEach(c => {
    const marker = L.marker([c.lat, c.lon]).bindPopup(`
      <b>${c.title}</b><br>${c.description}<br><i>${c.country}</i>
    `);
    markersLayer.addLayer(marker);

    const line = L.polyline([
      [c.actor1.lat, c.actor1.lon],
      [c.actor2.lat, c.actor2.lon]
    ], { color: "yellow" });
    linesLayer.addLayer(line);

    heatPoints.push([c.lat, c.lon, 1]);
  });

  heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15 }).addTo(map);
}

yearFilter.addEventListener("input", () => {
  yearLabel.textContent = parseInt(yearFilter.value) || "All";
  renderMap();
});
yearReset.addEventListener("click", () => {
  yearFilter.value = 0;
  yearLabel.textContent = "All";
  renderMap();
});
countryFilter.addEventListener("change", renderMap);
