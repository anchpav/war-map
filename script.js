// Global Conflict Tracker: LiveUAMap
const LIVEUAMAP_URL = "https://liveuamap.com/api/events"; // Live source
const REFRESH_INTERVAL = 5 * 60 * 1000;

const map = L.map("map").setView([20,0],2);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{ attribution:"© OpenStreetMap contributors"}).addTo(map);

let markersLayer=L.layerGroup().addTo(map);
let linesLayer=L.layerGroup().addTo(map);
let heatLayer;

const yearFilter=document.getElementById("yearFilter");
const yearLabel=document.getElementById("yearLabel");
const yearReset=document.getElementById("yearReset");
const countryFilter=document.getElementById("countryFilter");
const visibleCount=document.getElementById("visibleCount");
const daysWithoutWarEl=document.getElementById("daysWithoutWar");
const dataUnavailable=document.getElementById("dataUnavailable");
const sourceLabel=document.getElementById("sourceLabel");
const eventsTableBody=document.getElementById("eventsTableBody");

let conflictsData=[];

async function loadEvents(){
  try{
    const res=await fetch(LIVEUAMAP_URL);
    const data=await res.json();
    if(!data.events) throw new Error("No events array");
    conflictsData=data.events.map(normalizeEvent);
    dataUnavailable.hidden=true;
    sourceLabel.textContent="LiveUAMap API";
    setupFilters();
    applyFilters();
  }catch(err){
    console.error("Failed to load live events:",err);
    dataUnavailable.hidden=false;
    sourceLabel.textContent="LiveUAMap unavailable";
  }
}
setInterval(loadEvents,REFRESH_INTERVAL);

function normalizeEvent(raw){
  const lat=raw.location?.lat??NaN;
  const lon=raw.location?.lon??NaN;
  let date=raw.date?new Date(raw.date):new Date();
  return {
    id:raw.id,
    lat,
    lon,
    title:raw.title??"Unknown conflict",
    description:raw.description??"",
    country:raw.country??"Unknown country",
    year:date.getFullYear(),
    date:date,
    actor1:{lat:raw.actor1?.lat,lon:raw.actor1?.lon,name:raw.actor1?.name},
    actor2:{lat:raw.actor2?.lat,lon:raw.actor2?.lon,name:raw.actor2?.name}
  };
}

function setupFilters(){
  const countries=Array.from(new Set(conflictsData.map(c=>c.country))).sort();
  countryFilter.innerHTML="";
  countries.forEach(c=>{const opt=document.createElement("option"); opt.value=c; opt.textContent=c; countryFilter.appendChild(opt);});
  const years=conflictsData.map(c=>c.year);
  if(years.length){yearFilter.min=Math.min(...years); yearFilter.max=Math.max(...years); yearFilter.value=""; yearLabel.textContent="All";}
  yearFilter.oninput=()=>{yearLabel.textContent=yearFilter.value||"All"; applyFilters();};
  yearReset.onclick=()=>{yearFilter.value=""; yearLabel.textContent="All"; applyFilters();};
  countryFilter.onchange=applyFilters;
}

function applyFilters(){
  const selYear=parseInt(yearFilter.value)||null;
  const selCountries=Array.from(countryFilter.selectedOptions).map(o=>o.value);
  const filtered=conflictsData.filter(e=>{const y=selYear?e.year===selYear:true; const c=selCountries.length?selCountries.includes(e.country):true; return y&&c;});
  visibleCount.textContent=filtered.length;
  daysWithoutWarEl.textContent=calculateDaysWithoutWar(filtered);
  renderMap(filtered);
  renderTable(filtered);
}

function calculateDaysWithoutWar(events){
  if(!events.length) return 0;
  const lastDate=events.map(e=>e.date).sort((a,b)=>b-a)[0];
  return Math.floor((new Date()-lastDate)/(1000*60*60*24));
}

function renderMap(events){
  markersLayer.clearLayers();
  linesLayer.clearLayers();
  if(heatLayer) map.removeLayer(heatLayer);
  const points=[];
  events.forEach(e=>{
    if(!Number.isFinite(e.lat)||!Number.isFinite(e.lon)) return;
    const mk=L.circleMarker([e.lat,e.lon],{radius:6,color:"red",fillOpacity:0.8}).bindPopup(`<b>${escapeHtml(e.title)}</b><br>${escapeHtml(e.description)}<br><i>${escapeHtml(e.country)}</i>`);
    markersLayer.addLayer(mk);
    if(e.actor1?.lat&&e.actor2?.lat){const line=L.polyline([[e.actor1.lat,e.actor1.lon],[e.actor2.lat,e.actor2.lon]],{color:"yellow",weight:2,opacity:0.7}); linesLayer.addLayer(line);}
    points.push([e.lat,e.lon,0.7]);
  });
  if(points.length) heatLayer=L.heatLayer(points,{radius:28,blur:18}).addTo(map);
}

function renderTable(events){
  if(!eventsTableBody) return;
  eventsTableBody.innerHTML="";
  events.sort((a,b)=>b.date-a.date).forEach(e=>{const tr=document.createElement("tr"); tr.innerHTML=`<td>${escapeHtml(e.date.toISOString().split("T")[0])}</td><td>${escapeHtml(e.country)}</td><td>${escapeHtml(e.title)}</td>`; eventsTableBody.appendChild(tr);});
}

function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

loadEvents();
