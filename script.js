// ====== Локальные данные конфликтов ======
const conflictsData = [
  {id:1, lat:50.4501, lon:30.5234, title:"Conflict in Ukraine", description:"Ongoing clashes in Eastern Ukraine", country:"Ukraine", year:2026, actor1:{lat:50.45, lon:30.52, name:"Side A"}, actor2:{lat:50.46, lon:30.53, name:"Side B"}},
  {id:2, lat:31.7683, lon:35.2137, title:"Conflict in Israel", description:"Escalation near urban areas", country:"Israel", year:2025, actor1:{lat:31.76, lon:35.20, name:"Force Alpha"}, actor2:{lat:31.78, lon:35.22, name:"Force Beta"}},
  {id:3, lat:34.0522, lon:-118.2437, title:"Conflict in USA", description:"Minor conflict example", country:"USA", year:2026, actor1:{lat:34.05, lon:-118.24, name:"Group X"}, actor2:{lat:34.06, lon:-118.25, name:"Group Y"}}
];

// ====== Настройка карты ======
const map = L.map("map").setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:"© OpenStreetMap contributors"
}).addTo(map);

let markersLayer = L.layerGroup().addTo(map);
let linesLayer = L.layerGroup().addTo(map);
let heatLayer;

// DOM
const yearFilter = document.getElementById("yearFilter");
const yearLabel = document.getElementById("yearLabel");
const yearReset = document.getElementById("yearReset");
const countryFilter = document.getElementById("countryFilter");
const visibleCount = document.getElementById("visibleCount");
const daysWithoutWar = document.getElementById("daysWithoutWar");
const sourceLabel = document.getElementById("sourceLabel");

// ====== Инициализация ======
populateCountryFilter();
renderMap();
updateDaysWithoutWar();

// ====== Фильтры ======
yearFilter.addEventListener("input", () => {
  yearLabel.textContent = yearFilter.value || "All";
  renderMap();
  updateDaysWithoutWar();
});

yearReset.addEventListener("click", () => {
  yearFilter.value = 0;
  yearLabel.textContent = "All";
  renderMap();
  updateDaysWithoutWar();
});

countryFilter.addEventListener("change", () => {
  renderMap();
  updateDaysWithoutWar();
});

// ====== Создаем список стран ======
function populateCountryFilter() {
  const countries = [...new Set(conflictsData.map(c => c.country))].sort();
  countries.forEach(c => {
    const option = document.createElement("option");
    option.value = c;
    option.textContent = c;
    countryFilter.appendChild(option);
  });
}

// ====== Рендер карты ======
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

  filtered.forEach(c => {
    L.marker([c.lat, c.lon]).bindPopup(`<b>${c.title}</b><br>${c.description}<br><i>${c.country}</i>`).addTo(markersLayer);
    L.polyline([[c.actor1.lat, c.actor1.lon],[c.actor2.lat, c.actor2.lon]],{color:'yellow'}).addTo(linesLayer);
  });

  const heatPoints = filtered.map(c => [c.lat,c.lon,1]);
  heatLayer = L.heatLayer(heatPoints,{radius:25,blur:15}).addTo(map);

  visibleCount.textContent = filtered.length;
}

// ====== Счётчик дней без войны ======
function updateDaysWithoutWar() {
  const selectedCountries = Array.from(countryFilter.selectedOptions).map(o => o.value);
  const filtered = conflictsData.filter(c => selectedCountries.length ? selectedCountries.includes(c.country) : true);

  if (filtered.length === 0) {
    daysWithoutWar.textContent = "--";
    return;
  }

  const latestConflictDate = Math.max(...filtered.map(c => c.year));
  const today = new Date();
  // грубая оценка: разница лет * 365
  const days = Math.floor((today.getFullYear() - latestConflictDate) * 365);
  daysWithoutWar.textContent = days;
}
