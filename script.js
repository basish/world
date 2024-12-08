// Config
const TIMER_DURATION = 15 * 60; // 15 minutes in seconds
let timeRemaining = TIMER_DURATION;
let timerInterval = null;
let isPaused = false;
let isGameOver = false;

let countries = [];
let guessedCountries = new Set();
const totalCountries = 197;

// Synonyms and Continent Data
const synonyms = {
    "usa": "United States of America",
    "us": "United States of America",
    "uk": "United Kingdom",
    "uae": "United Arab Emirates",
    "car": "Central African Republic",
    "drc": "Democratic Republic of the Congo",
    "serbia": "Republic of Serbia"
};

const continents = {
   "Republic of Serbia": "Europe",
   "United States of America": "North America",
   "United Kingdom": "Europe",
   "United Arab Emirates": "Asia",
   "Central African Republic": "Africa",
   "Democratic Republic of the Congo": "Africa",
};

const allContinents = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
let continentCounts = {};
let continentTotals = {};

allContinents.forEach(cont => {
    continentCounts[cont] = 0;
    continentTotals[cont] = 0;
});

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const endBtn = document.getElementById('end-btn');
const timerSpan = document.getElementById('timer');
const guessInput = document.getElementById('guess-input');
const guessedCountSpan = document.getElementById('guessed-count');
const nameInput = document.getElementById('name-input');
const continentStatsDiv = document.getElementById('continent-stats');
const pauseOverlay = document.getElementById('pause-overlay');

const svg = d3.select("#map");
const width = 1200;
const height = 600;

const projection = d3.geoMercator().scale(130).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);

let currentTransform = d3.zoomIdentity;
const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .on("zoom", (event) => {
        currentTransform = event.transform;
        g.attr("transform", currentTransform);
        updateTiles();
    });

const tile = d3.tile().size([width, height]);
const tileGroup = svg.append("g");
const g = svg.append("g");

// Helper function for consistent font sizing
function calculateFontSize(feature) {
    const bounds = path.bounds(feature);
    const boxWidth = bounds[1][0] - bounds[0][0];
    const boxHeight = bounds[1][1] - bounds[0][1];
    const rawFontSize = Math.min(boxWidth, boxHeight) / 50;
    const scaledFontSize = rawFontSize * 0.7;
    return Math.max(Math.min(scaledFontSize, 12), 4);
}

d3.json("world.geojson").then(data => {
    countries = data.features.map(d => ({
        name: d.properties.ADMIN,
        feature: d
    }));

    countries.forEach(c => {
        let cont = continents[c.name];
        if (cont) {
            continentTotals[cont] = (continentTotals[cont] || 0) + 1;
        }
    });

    updateContinentStats();

    g.selectAll("path")
     .data(data.features)
     .enter().append("path")
     .attr("class", "country")
     .attr("d", path)
     .on("mouseover", function() {
         if (!isPaused && !isGameOver)
            d3.select(this).classed("hovered", true);
     })
     .on("mouseout", function() {
         d3.select(this).classed("hovered", false);
     });

    svg.call(zoom);
    updateTiles();
});

function endGame() {
    if (isGameOver) return;
    isGameOver = true;
    guessInput.disabled = true;
    pauseBtn.disabled = true;
    endBtn.disabled = true;
    clearInterval(timerInterval);

    const missingCountries = countries.filter(c => !guessedCountries.has(c.name));
    missingCountries.forEach(m => {
        const centroid = path.centroid(m.feature);
        const fontSize = calculateFontSize(m.feature);
        g.append("text")
            .attr("class", "country-label missed-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1])
            .attr("font-size", fontSize + "px")
            .text(m.name);

        g.selectAll("path")
            .filter(d => d.properties.ADMIN === m.name)
            .classed("missed", true);
    });

    const totalGuessed = guessedCountries.size;
    const totalTimeTaken = TIMER_DURATION - timeRemaining;
    addToLeaderboard(userName, totalGuessed, totalTimeTaken);
}
