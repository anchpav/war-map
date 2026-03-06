const DATA_URL = "./conflicts.json";

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
const daysWithoutWar = document.getElementById("daysWithoutWar");
const sourceLabel = document.getElementById("sourceLabel");

let conflictsData = [];

fetch(DATA_URL)
  .then(res => res.json())
  .then(data => {
    conflictsData = data;
    sourceLabel.textContent = "Local JSON";
    populateCountryFilter();
    renderMap();
  })
  .catch(err => console.error("Failed to load conflicts:", err));

function populateCountryFilter() {
  const countries = [...new Set(conflictsData.map(c => c.country))].sort();
  countries.forEach(country => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    countryFilter.appendChild(option);
  });
}

function getSelectedCountries() {
  return Array.from(countryFilter.selectedOptions).map(o => o.value);
}

function renderMap() {
  markersLayer.clearLayers();
  linesLayer.clearLayers();
  if (heatLayer) map.removeLayer(heatLayer);

  const selectedYear = parseInt(yearFilter.value) || null;
  const selectedCountries = getSelectedCountries();

  const filtered = conflictsData.filter(c => {
    const yearMatch = selectedYear ? c.year === selectedYear : true;
    const countryMatch = selectedCountries.length ? selectedCountries.includes(c.country) : true;
    return yearMatch && countryMatch;
  });

  // Heatmap
  const heatPoints = filtered.map(c => [c.lat, c.lon, 1]);
  heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15 }).addTo(map);

  // Markers & Lines
  filtered.forEach(c => {
    const marker = L.marker([c.lat, c.lon]).bindPopup(
      `<b>${c.title}</b><br>${c.description}<br><i>${c.country}</i>`
    );
    markersLayer.addLayer(marker);

    const line = L.polyline(
      [
        [c.actor1.lat, c.actor1.lon],
        [c.actor2.lat, c.actor2.lon]
      ],
      { color: 'yellow' }
    );
    linesLayer.addLayer(line);
  });

  visibleCount.textContent = filtered.length;

  // Days without war
  const allEvents = selectedCountries.length
    ? conflictsData.filter(c => selectedCountries.includes(c.country))
    : conflictsData;

  const lastConflict = allEvents.reduce((max, c) => Math.max(max, c.year), 0);
  const today = new Date();
  const lastConflictDate = new Date(lastConflict, 0, 1); // 1 Jan of last conflict year
  const diffDays = Math.floor((today - lastConflictDate) / (1000 * 60 * 60 * 24));
  daysWithoutWar.textContent = diffDays;
}

// Events
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
