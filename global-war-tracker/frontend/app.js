/*
  Global War Tracker MVP (no external map library)
  -------------------------------------------------
  This file draws a minimalist interactive world map using only SVG.
  Features:
  - country search + manual selection
  - clickable countries
  - pan/zoom by mouse/touch
  - animated conflict arrows
  - global/country "days without war"
  - refresh data from backend
*/

const API_BASE = "";

// ------------------------------
// DOM references
// ------------------------------
const worldMap = document.getElementById("worldMap");
const viewport = document.getElementById("viewport");
const conflictLayer = document.getElementById("conflictLayer");
const tooltip = document.getElementById("tooltip");

const countrySearch = document.getElementById("countrySearch");
const countryList = document.getElementById("countryList");
const myCountryBtn = document.getElementById("myCountryBtn");
const clearBtn = document.getElementById("clearBtn");
const yearSlider = document.getElementById("yearSlider");
const yearLabel = document.getElementById("yearLabel");
const refreshBtn = document.getElementById("refreshBtn");

const daysGlobalEl = document.getElementById("daysGlobal");
const daysCountryEl = document.getElementById("daysCountry");
const activeCountEl = document.getElementById("activeCount");
const activeListEl = document.getElementById("activeList");

const playBtn = document.getElementById("playBtn");
const pauseBtn = document.getElementById("pauseBtn");
const timelineStatus = document.getElementById("timelineStatus");

// ------------------------------
// Minimal country geometry (center points + generated diamonds)
// ------------------------------
const COUNTRY_CENTERS = {
  "United States": { lat: 38, lon: -97 },
  Canada: { lat: 56, lon: -106 },
  Mexico: { lat: 23, lon: -102 },
  Brazil: { lat: -14, lon: -52 },
  Argentina: { lat: -34, lon: -64 },
  "United Kingdom": { lat: 55, lon: -3 },
  France: { lat: 46, lon: 2 },
  Germany: { lat: 51, lon: 10 },
  Spain: { lat: 40, lon: -4 },
  Italy: { lat: 42, lon: 12 },
  Ukraine: { lat: 49, lon: 32 },
  Russia: { lat: 61, lon: 100 },
  Turkey: { lat: 39, lon: 35 },
  Israel: { lat: 31.5, lon: 34.8 },
  Palestine: { lat: 31.9, lon: 35.2 },
  Syria: { lat: 35, lon: 38 },
  Iraq: { lat: 33, lon: 44 },
  Iran: { lat: 32, lon: 53 },
  Saudi: { lat: 24, lon: 45 },
  Egypt: { lat: 26, lon: 30 },
  Nigeria: { lat: 9, lon: 8 },
  Ethiopia: { lat: 9, lon: 40 },
  India: { lat: 21, lon: 78 },
  Pakistan: { lat: 30, lon: 69 },
  China: { lat: 35, lon: 103 },
  Japan: { lat: 36, lon: 138 },
  "South Korea": { lat: 36, lon: 128 },
  "North Korea": { lat: 40, lon: 127 },
  Azerbaijan: { lat: 40.1, lon: 47.5 },
  Armenia: { lat: 40.3, lon: 44.9 },
  Australia: { lat: -25, lon: 133 },
  Indonesia: { lat: -2, lon: 118 },
  "South Africa": { lat: -30, lon: 25 },
};

const state = {
  conflicts: [],
  activeConflicts: [],
  selectedCountry: "",
  countryElements: new Map(),
  transform: { tx: 0, ty: 0, scale: 1 },
  animationTimer: null,
  animationIndex: 0,
  timelineConflicts: [],
};

function svg(tag) {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function latLonToXY(lat, lon) {
  // SVG world map coordinate system:
  // x = longitude, y = -latitude (because SVG y grows downward)
  return { x: lon, y: -lat };
}

function countryShapePoints(countryName) {
  const center = COUNTRY_CENTERS[countryName];
  if (!center) return null;

  const { x, y } = latLonToXY(center.lat, center.lon);
  const size = 4; // small diamond size for minimalist map
  return [
    `${x},${y - size}`,
    `${x + size},${y}`,
    `${x},${y + size}`,
    `${x - size},${y}`,
  ].join(" ");
}

function drawCountries() {
  viewport.innerHTML = "";
  state.countryElements.clear();

  Object.keys(COUNTRY_CENTERS).forEach((name) => {
    const points = countryShapePoints(name);
    if (!points) return;

    const polygon = svg("polygon");
    polygon.setAttribute("points", points);
    polygon.setAttribute("class", "country");
    polygon.dataset.country = name;

    polygon.addEventListener("click", () => selectCountry(name));
    polygon.addEventListener("mouseenter", (event) => {
      showTooltip(event.clientX, event.clientY, `<strong>${name}</strong>`);
    });
    polygon.addEventListener("mouseleave", hideTooltip);

    viewport.appendChild(polygon);
    state.countryElements.set(name.toLowerCase(), polygon);
  });
}

function statusColor(conflict) {
  if (conflict.end === null) return "var(--active)";
  const years = (Date.now() - new Date(conflict.end).getTime()) / (1000 * 60 * 60 * 24 * 365);
  return years <= 10 ? "var(--recent)" : "var(--history)";
}

function filteredByYear(conflicts) {
  const year = Number(yearSlider.value);
  return conflicts.filter((row) => {
    const start = Number(String(row.start || "1900").slice(0, 4));
    const end = row.end ? Number(String(row.end).slice(0, 4)) : 9999;
    return start <= year && year <= end;
  });
}

function endpointForCountry(countryName, fallbackLat, fallbackLon) {
  const center = COUNTRY_CENTERS[countryName];
  if (center) return latLonToXY(center.lat, center.lon);
  // fallback to conflict coordinates if unknown country in the map dataset
  return latLonToXY(Number(fallbackLat || 0), Number(fallbackLon || 0));
}

function makeArrowHead(from, to, color) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;

  const ux = dx / len;
  const uy = dy / len;

  const tip = { x: to.x, y: to.y };
  const back = { x: to.x - ux * 2.3, y: to.y - uy * 2.3 };
  const left = { x: back.x + uy * 1.1, y: back.y - ux * 1.1 };
  const right = { x: back.x - uy * 1.1, y: back.y + ux * 1.1 };

  const polygon = svg("polygon");
  polygon.setAttribute("points", `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`);
  polygon.setAttribute("class", "arrow-head");
  polygon.setAttribute("fill", color);
  return polygon;
}

function conflictTooltipHtml(row) {
  return [
    `<strong>${row.country} ↔ ${row.opponent}</strong>`,
    `Start: ${row.start}`,
    `End: ${row.end ?? "Active"}`,
    `Type: ${row.type || "Armed conflict"}`,
  ].join("<br>");
}

function drawConflict(row) {
  const from = endpointForCountry(row.country, row.lat, row.lon);
  const to = endpointForCountry(row.opponent, (row.lat || 0) + 1, (row.lon || 0) + 1);
  const color = statusColor(row);

  const line = svg("line");
  line.setAttribute("x1", String(from.x));
  line.setAttribute("y1", String(from.y));
  line.setAttribute("x2", String(to.x));
  line.setAttribute("y2", String(to.y));
  line.setAttribute("stroke", color);
  line.setAttribute("class", "conflict-line");

  line.addEventListener("mouseenter", (event) => {
    showTooltip(event.clientX, event.clientY, conflictTooltipHtml(row));
  });
  line.addEventListener("mouseleave", hideTooltip);

  conflictLayer.appendChild(line);
  conflictLayer.appendChild(makeArrowHead(from, to, color));
}

function renderConflictsStatic() {
  conflictLayer.innerHTML = "";
  const selected = state.selectedCountry.trim().toLowerCase();

  const scoped = filteredByYear(state.activeConflicts).filter((row) => {
    if (!selected) return true;
    return row.country.toLowerCase() === selected || String(row.opponent || "").toLowerCase() === selected;
  });

  scoped.forEach(drawConflict);
  timelineStatus.textContent = `Showing active conflicts: ${scoped.length}`;
}

function showTooltip(clientX, clientY, html) {
  tooltip.innerHTML = html;
  tooltip.style.left = `${clientX + 10}px`;
  tooltip.style.top = `${clientY + 10}px`;
  tooltip.classList.remove("hidden");
}

function hideTooltip() {
  tooltip.classList.add("hidden");
}

function updateCountrySelectionStyles() {
  state.countryElements.forEach((element) => element.classList.remove("selected"));
  const selectedEl = state.countryElements.get(state.selectedCountry.toLowerCase());
  if (selectedEl) selectedEl.classList.add("selected");
}

async function updateMetricsAndList() {
  const query = state.selectedCountry ? `?country=${encodeURIComponent(state.selectedCountry)}` : "";

  const [globalDays, countryDays, active] = await Promise.all([
    fetch(`${API_BASE}/api/days_without_war`).then((r) => r.json()),
    fetch(`${API_BASE}/api/days_without_war${query}`).then((r) => r.json()),
    fetch(`${API_BASE}/api/active_conflicts${query}`).then((r) => r.json()),
  ]);

  daysGlobalEl.textContent = String(globalDays.days_without_war);
  daysCountryEl.textContent = String(countryDays.days_without_war);
  activeCountEl.textContent = String(active.length);

  activeListEl.innerHTML = "";
  if (active.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No active conflicts in this scope.";
    activeListEl.appendChild(li);
  } else {
    active.forEach((row) => {
      const li = document.createElement("li");
      li.textContent = `${row.country} vs ${row.opponent} (${row.start})`;
      activeListEl.appendChild(li);
    });
  }
}

function selectCountry(countryName) {
  state.selectedCountry = countryName;
  countrySearch.value = countryName;
  updateCountrySelectionStyles();
  renderConflictsStatic();
  updateMetricsAndList();
}

function clearCountrySelection() {
  state.selectedCountry = "";
  countrySearch.value = "";
  updateCountrySelectionStyles();
  renderConflictsStatic();
  updateMetricsAndList();
}

function buildCountrySearchData() {
  const names = new Set(Object.keys(COUNTRY_CENTERS));

  if (window.Intl && Intl.DisplayNames && Intl.supportedValuesOf) {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    Intl.supportedValuesOf("region").forEach((code) => {
      const name = displayNames.of(code);
      if (name) names.add(name);
    });
  }

  countryList.innerHTML = "";
  [...names].sort().forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    countryList.appendChild(option);
  });
}

async function detectMyCountry() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        const data = await response.json();
        const country = data?.address?.country;
        if (country) {
          selectCountry(country);
        }
      } catch {
        // Geolocation or reverse geocoding unavailable: ignore gracefully.
      }
    },
    () => {
      // User denied or unavailable.
    },
    { timeout: 7000 }
  );
}

async function refreshData() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";

  try {
    const response = await fetch(`${API_BASE}/api/conflicts?_ts=${Date.now()}`, { cache: "no-store" });
    state.conflicts = await response.json();
    state.activeConflicts = state.conflicts.filter((row) => row.end === null);

    const maxYear = Math.max(...state.conflicts.map((row) => Number(String(row.start).slice(0, 4))), 1900);
    yearSlider.max = String(Math.max(maxYear, new Date().getFullYear()));
    if (Number(yearSlider.value) > Number(yearSlider.max)) {
      yearSlider.value = yearSlider.max;
    }
    yearLabel.textContent = yearSlider.value;

    renderConflictsStatic();
    await updateMetricsAndList();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh Data";
  }
}

function stopTimeline() {
  if (state.animationTimer) {
    clearInterval(state.animationTimer);
    state.animationTimer = null;
  }
}

function playTimeline() {
  stopTimeline();
  conflictLayer.innerHTML = "";

  const selected = state.selectedCountry.toLowerCase();
  state.timelineConflicts = filteredByYear(state.conflicts)
    .filter((row) => !selected || row.country.toLowerCase() === selected || String(row.opponent).toLowerCase() === selected)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  if (state.timelineConflicts.length === 0) {
    timelineStatus.textContent = "Timeline: no conflicts for selection";
    return;
  }

  state.animationIndex = 0;
  timelineStatus.textContent = `Timeline: 0/${state.timelineConflicts.length}`;

  state.animationTimer = setInterval(() => {
    if (state.animationIndex >= state.timelineConflicts.length) {
      stopTimeline();
      timelineStatus.textContent = `Timeline complete (${state.timelineConflicts.length}/${state.timelineConflicts.length})`;
      return;
    }

    drawConflict(state.timelineConflicts[state.animationIndex]);
    state.animationIndex += 1;
    timelineStatus.textContent = `Timeline: ${state.animationIndex}/${state.timelineConflicts.length}`;
  }, 320);
}

function pauseTimeline() {
  stopTimeline();
  timelineStatus.textContent = `Timeline paused (${state.animationIndex})`;
}

// ------------------------------
// Pan + zoom (mouse + touch) on custom SVG
// ------------------------------
let dragging = false;
let lastPointer = null;
let pinchStartDistance = null;
let pinchStartScale = null;

function applyTransform() {
  const { tx, ty, scale } = state.transform;
  const transformValue = `translate(${tx} ${ty}) scale(${scale})`;
  viewport.setAttribute("transform", transformValue);
  conflictLayer.setAttribute("transform", transformValue);
}

function clampScale(value) {
  return Math.max(0.8, Math.min(8, value));
}

worldMap.addEventListener("wheel", (event) => {
  event.preventDefault();
  const zoomFactor = event.deltaY < 0 ? 1.12 : 0.9;
  state.transform.scale = clampScale(state.transform.scale * zoomFactor);
  applyTransform();
});

worldMap.addEventListener("pointerdown", (event) => {
  dragging = true;
  lastPointer = { x: event.clientX, y: event.clientY };
  worldMap.setPointerCapture(event.pointerId);
});

worldMap.addEventListener("pointermove", (event) => {
  if (!dragging || !lastPointer) return;
  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;

  // Convert screen movement to map units (approximate, good enough for MVP).
  const unitX = (360 / worldMap.clientWidth) / state.transform.scale;
  const unitY = (180 / worldMap.clientHeight) / state.transform.scale;

  state.transform.tx += dx * unitX;
  state.transform.ty += dy * unitY;
  lastPointer = { x: event.clientX, y: event.clientY };
  applyTransform();
});

worldMap.addEventListener("pointerup", (event) => {
  dragging = false;
  lastPointer = null;
  worldMap.releasePointerCapture(event.pointerId);
});

worldMap.addEventListener("touchstart", (event) => {
  if (event.touches.length === 2) {
    const [a, b] = event.touches;
    pinchStartDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    pinchStartScale = state.transform.scale;
  }
}, { passive: true });

worldMap.addEventListener("touchmove", (event) => {
  if (event.touches.length === 2 && pinchStartDistance && pinchStartScale) {
    const [a, b] = event.touches;
    const currentDistance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const ratio = currentDistance / pinchStartDistance;
    state.transform.scale = clampScale(pinchStartScale * ratio);
    applyTransform();
  }
}, { passive: true });

worldMap.addEventListener("touchend", () => {
  pinchStartDistance = null;
  pinchStartScale = null;
});

// ------------------------------
// UI events
// ------------------------------
countrySearch.addEventListener("change", () => {
  const value = countrySearch.value.trim();
  if (!value) {
    clearCountrySelection();
    return;
  }
  selectCountry(value);
});

clearBtn.addEventListener("click", clearCountrySelection);
myCountryBtn.addEventListener("click", detectMyCountry);

yearSlider.addEventListener("input", () => {
  yearLabel.textContent = yearSlider.value;
  renderConflictsStatic();
});

refreshBtn.addEventListener("click", async () => {
  stopTimeline();
  await refreshData();
});

playBtn.addEventListener("click", playTimeline);
pauseBtn.addEventListener("click", pauseTimeline);

// ------------------------------
// Bootstrap
// ------------------------------
function drawBackground() {
  // Minimal background continents for visual orientation.
  const regions = [
    { x: -130, y: -50, w: 80, h: 50 }, // North America
    { x: -80, y: 0, w: 45, h: 60 }, // South America
    { x: -10, y: -55, w: 120, h: 65 }, // Europe + Asia
    { x: 5, y: -10, w: 45, h: 70 }, // Africa
    { x: 110, y: 20, w: 55, h: 30 }, // Australia region
  ];

  regions.forEach((r) => {
    const rect = svg("rect");
    rect.setAttribute("x", String(r.x));
    rect.setAttribute("y", String(r.y));
    rect.setAttribute("width", String(r.w));
    rect.setAttribute("height", String(r.h));
    rect.setAttribute("fill", "#1a2430");
    rect.setAttribute("stroke", "#273647");
    rect.setAttribute("stroke-width", "0.6");
    viewport.appendChild(rect);
  });
}

async function bootstrap() {
  buildCountrySearchData();
  drawBackground();
  drawCountries();
  applyTransform();
  await refreshData();
}

bootstrap();
