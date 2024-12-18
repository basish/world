// Configuration
const TIMER_DURATION = 15 * 60; // 15 minutes in seconds
let timeRemaining = TIMER_DURATION;
let timerInterval = null;
let isPaused = false;
let isGameOver = false;
let userName = "";
let gameStartTime = null;

let countries = [];
let guessedCountries = new Set();
const totalCountries = 197;

const abbreviations = {
    "usa": "United States of America",
    "uk": "United Kingdom",
    "uae": "United Arab Emirates",
    "car": "Central African Republic",
    "drc": "Democratic Republic of the Congo"
};

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
   "Democratic Republic of the Congo": "Africa"
};

const allContinents = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];
let continentCounts = {};
let continentTotals = {};

allContinents.forEach(cont => {
    continentCounts[cont] = 0;
    continentTotals[cont] = 0;
});

let countryCircles = new Map();

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const endBtn = document.getElementById('end-btn');
const timerSpan = document.getElementById('timer');
const guessInput = document.getElementById('guess-input');
const guessedCountSpan = document.getElementById('guessed-count');
const nameInput = document.getElementById('name-input');

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
    });

const g = svg.append("g");

// Load GeoJSON
function loadGeoJSON() {
    d3.json("world.geojson").then(data => {
        countries = data.features.map(d => ({
            name: d.properties.ADMIN,
            feature: d
        }));

        g.selectAll("path")
         .data(data.features)
         .enter().append("path")
         .attr("class", "country")
         .attr("d", path);

        countries.forEach(c => {
            const centroid = path.centroid(c.feature);
            const circle = g.append("circle")
                .attr("cx", centroid[0])
                .attr("cy", centroid[1])
                .attr("r", 0.5)
                .attr("fill", "darkblue");

            countryCircles.set(c.name, circle);

            let cont = continents[c.name];
            if (cont) {
                continentTotals[cont] = (continentTotals[cont] || 0) + 1;
            }
        });

        svg.call(zoom);
    });
}

loadGeoJSON();

// Event listeners
nameInput.addEventListener('input', () => {
    startBtn.disabled = !nameInput.value.trim();
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
endBtn.addEventListener("click", endGameEarly);
guessInput.addEventListener("input", handleGuess);

function startGame() {
    userName = nameInput.value.trim();
    if (!userName) return;
    startBtn.disabled = true;
    guessInput.disabled = false;
    pauseBtn.disabled = false;
    endBtn.disabled = false;
    guessInput.focus();
    gameStartTime = Date.now();

    startTimer();
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        clearInterval(timerInterval);
        guessInput.disabled = true;
        pauseBtn.textContent = "Unpause";
    } else {
        startTimer();
        guessInput.disabled = false;
        pauseBtn.textContent = "Pause";
    }
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (!isPaused) {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerSpan.textContent = `${minutes}:${seconds.toString().padStart(2,'0')}`;
}

function handleGuess() {
    if (isPaused || isGameOver) return;
    let currentGuess = guessInput.value.trim().toLowerCase();
    currentGuess = abbreviations[currentGuess] || currentGuess;

    const matchedCountry = countries.find(c => c.name.toLowerCase() === currentGuess);
    if (matchedCountry) {
        guessedCountries.add(matchedCountry.name);
        guessedCountSpan.textContent = `${guessedCountries.size}/${totalCountries}`;

        const circle = countryCircles.get(matchedCountry.name);
        if (circle) circle.remove();

        guessInput.value = '';
    }
}

function endGame() {
    if (isGameOver) return;
    isGameOver = true;
    clearInterval(timerInterval);
    
    countries.filter(c => !guessedCountries.has(c.name)).forEach(m => {
        const centroid = path.centroid(m.feature);
        const fontSize = Math.min(12, Math.max(4, Math.min(20, 10)));
        g.append("text")
         .attr("class", "missed-label")
         .attr("x", centroid[0])
         .attr("y", centroid[1])
         .attr("font-size", fontSize + "px")
         .text(m.name);
    });
}

function endGameEarly() {
    if (isGameOver) return;
    timeRemaining = 0;
    endGame();
}
