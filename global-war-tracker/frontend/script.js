/* Global War Tracker: Leaflet map + markers + animated conflict lines */

const map = L.map("map", { zoomControl: true }).setView([20, 0], 2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 6,
  minZoom: 2,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const elements = {
  countrySearch: document.getElementById("countrySearch"),
  countryList: document.getElementById("countryList"),
  clearCountry: document.getElementById("clearCountry"),
  refreshData: document.getElementById("refreshData"),
  updateAI: document.getElementById("updateAI"),
  playTimeline: document.getElementById("playTimeline"),
  pauseTimeline: document.getElementById("pauseTimeline"),
  timelineStatus: document.getElementById("timelineStatus"),
  activeCount: document.getElementById("activeCount"),
  totalCount: document.getElementById("totalCount"),
  daysWorld: document.getElementById("daysWorld"),
  daysSelected: document.getElementById("daysSelected"),
};

const markerLayer = L.layerGroup().addTo(map);
const lineLayer = L.layerGroup().addTo(map);

const state = {
  allConflicts: [],
  selectedCountry: "",
  timer: null,
};

function isActive(conflict) {
  return conflict.end === null;
}

function lineColor(conflict) {
  if (isActive(conflict)) return "#ff3b3b";
  const endDate = conflict.end ? new Date(conflict.end) : null;
  const years = endDate ? (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
  return years <= 10 ? "#ff9f43" : "#9aa2ad";
}

function filteredConflicts() {
  if (!state.selectedCountry) return state.allConflicts;
  const selected = state.selectedCountry.toLowerCase();
  return state.allConflicts.filter((row) => {
    const a = String(row.country || "").toLowerCase();
    const b = String(row.opponent || "").toLowerCase();
    return a === selected || b === selected;
  });
}

async function fetchConflicts() {
  const response = await fetch("/api/conflicts");
  if (!response.ok) throw new Error("Cannot load conflicts");
  return response.json();
}

async function fetchDays(country = "") {
  const suffix = country ? `?country=${encodeURIComponent(country)}` : "";
  const response = await fetch(`/api/days_without_war${suffix}`);
  if (!response.ok) throw new Error("Cannot load metrics");
  return response.json();
}

function drawMarkers(conflicts) {
  markerLayer.clearLayers();

  conflicts.forEach((conflict) => {
    const marker = L.circleMarker([conflict.lat, conflict.lon], {
      radius: 6,
      color: lineColor(conflict),
      fillOpacity: 0.9,
    });

    marker.bindPopup(`
      <strong>${conflict.country}</strong><br>
      Opponent: ${conflict.opponent || "Unknown"}<br>
      Start: ${conflict.start}<br>
      End: ${conflict.end || "Active"}<br>
      ${conflict.description || "Conflict"}
    `);

    markerLayer.addLayer(marker);
  });
}

function buildCurve(from, to) {
  const midLat = (from[0] + to[0]) / 2 + 8;
  const midLon = (from[1] + to[1]) / 2;
  return [from, [midLat, midLon], to];
}

function addConflictLine(conflict) {
  const from = [Number(conflict.lat), Number(conflict.lon)];
  const to = [Number(conflict.opponentLat ?? conflict.lat), Number(conflict.opponentLon ?? conflict.lon + 3)];
  const polyline = L.polyline(buildCurve(from, to), {
    color: lineColor(conflict),
    weight: 2,
    opacity: 0.85,
    dashArray: "8 8",
    lineCap: "round",
  }).addTo(lineLayer);

  polyline.bindTooltip(
    `${conflict.country} vs ${conflict.opponent || "Unknown"}<br>${conflict.start} → ${conflict.end || "Active"}<br>${conflict.description || "Conflict"}`
  );
}

function stopTimeline() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function playTimeline() {
  stopTimeline();
  const list = filteredConflicts().slice().sort((a, b) => String(a.start).localeCompare(String(b.start)));
  lineLayer.clearLayers();

  if (!list.length) {
    elements.timelineStatus.textContent = "No conflicts for timeline";
    return;
  }

  let index = 0;
  elements.timelineStatus.textContent = "Timeline running";
  state.timer = setInterval(() => {
    if (index >= list.length) {
      stopTimeline();
      elements.timelineStatus.textContent = "Timeline finished";
      return;
    }

    addConflictLine(list[index]);
    index += 1;
  }, 450);
}

function drawAllLines() {
  lineLayer.clearLayers();
  filteredConflicts().forEach(addConflictLine);
}

function populateCountryList(conflicts) {
  const countries = new Set();
  conflicts.forEach((row) => {
    if (row.country) countries.add(row.country);
    if (row.opponent) countries.add(row.opponent);
  });

  elements.countryList.innerHTML = "";
  [...countries].sort().forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    elements.countryList.appendChild(option);
  });
}

async function updateMetrics() {
  const [globalMetrics, localMetrics] = await Promise.all([
    fetchDays(),
    fetchDays(state.selectedCountry),
  ]);

  const current = filteredConflicts();
  elements.activeCount.textContent = String(current.filter(isActive).length);
  elements.totalCount.textContent = String(current.length);
  elements.daysWorld.textContent = String(globalMetrics.days_without_war);
  elements.daysSelected.textContent = String(localMetrics.days_without_war);
}

async function redraw() {
  const current = filteredConflicts();
  drawMarkers(current);
  drawAllLines();
  await updateMetrics();
}

async function loadData() {
  state.allConflicts = await fetchConflicts();
  populateCountryList(state.allConflicts);
  await redraw();
}

elements.countrySearch.addEventListener("change", async () => {
  state.selectedCountry = elements.countrySearch.value.trim();
  stopTimeline();
  elements.timelineStatus.textContent = state.selectedCountry ? `Filtered: ${state.selectedCountry}` : "Ready";
  await redraw();
});

elements.clearCountry.addEventListener("click", async () => {
  state.selectedCountry = "";
  elements.countrySearch.value = "";
  stopTimeline();
  elements.timelineStatus.textContent = "Ready";
  await redraw();
});

elements.refreshData.addEventListener("click", async () => {
  stopTimeline();
  await loadData();
  elements.timelineStatus.textContent = "Data refreshed";
});

elements.updateAI.addEventListener("click", async () => {
  elements.timelineStatus.textContent = "Running AI update...";
  const response = await fetch("/api/update_conflicts", { method: "POST" });
  const result = await response.json();
  await loadData();
  elements.timelineStatus.textContent = `AI update (${result.provider}) added ${result.detected_conflicts} conflicts`;
});

elements.playTimeline.addEventListener("click", playTimeline);
elements.pauseTimeline.addEventListener("click", () => {
  stopTimeline();
  elements.timelineStatus.textContent = "Timeline paused";
});

loadData().catch((error) => {
  elements.timelineStatus.textContent = `Error: ${error.message}`;
});
