// -------------------- Счётчик дней без войны --------------------
const lastMajorWar = new Date("2024-10-07");
function updateCounter() {
    const today = new Date();
    const diff = today - lastMajorWar;
    const days = Math.floor(diff / (1000*60*60*24));
    document.getElementById("counter").innerText = `Days Without Major War: ${days}`;
}
updateCounter();

// -------------------- Инициализация карты --------------------
const map = L.map('map').setView([20,0],2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{ maxZoom: 18 }).addTo(map);

// -------------------- Глобальные переменные --------------------
let markersLayer = L.layerGroup().addTo(map);
let heatLayer;
let heatPoints = [];

// -------------------- Функция загрузки конфликтов --------------------
async function loadConflicts() {
    try {
        const response = await fetch("https://liveuamap.com/api/events");
        const data = await response.json();

        heatPoints = [];
        markersLayer.clearLayers();
        if(heatLayer) map.removeLayer(heatLayer);

        data.events.forEach(event => {
            const coords = event.location;
            if(coords && coords.lat && coords.lon) {

                // -------------------- Маркер --------------------
                const marker = L.circleMarker([coords.lat, coords.lon], { radius: 6, color: 'red' });
                const popupContent = `<b>${event.title}</b><br>${event.description || ''}<br>${event.country || ''}`;
                marker.bindPopup(popupContent);
                markersLayer.addLayer(marker);

                // -------------------- Тепловая карта --------------------
                heatPoints.push([coords.lat, coords.lon, 0.5]);

                // -------------------- Линии конфликтующих сторон --------------------
                if(event.actor1 && event.actor2 && event.actor1.lat && event.actor1.lon && event.actor2.lat && event.actor2.lon){
                    const line = L.polyline([
                        [event.actor1.lat, event.actor1.lon],
                        [event.actor2.lat, event.actor2.lon]
                    ], { color: 'yellow', weight: 2, opacity: 0.8 });

                    line.bindPopup(`${event.actor1.name} → ${event.actor2.name}`);
                    markersLayer.addLayer(line);

                    // Анимация стрелки (простая мигающая точка)
                    const arrow = L.circleMarker([event.actor2.lat, event.actor2.lon], { radius: 4, color: 'yellow', fillOpacity: 1 });
                    markersLayer.addLayer(arrow);
                    let opacity = 1;
                    setInterval(() => {
                        opacity = opacity === 1 ? 0.2 : 1;
                        arrow.setStyle({ fillOpacity: opacity });
                    }, 600);
                }
            }
        });

        heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15, maxZoom: 17 });
        heatLayer.addTo(map);

    } catch(err) {
        console.error("Failed to load conflicts:", err);
    }
}

// -------------------- Загрузка данных каждые 5 минут --------------------
loadConflicts();
setInterval(loadConflicts, 5 * 60 * 1000);

// -------------------- Таймлайн --------------------
const yearRange = document.getElementById("yearRange");
const yearLabel = document.getElementById("yearLabel");

yearRange.addEventListener("input", () => {
    yearLabel.innerText = yearRange.value;
    // Пока LiveUAMap API не фильтрует по году, просто перезагружаем события
    loadConflicts();
});
