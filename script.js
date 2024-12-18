// configuration
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

// synonyms for shorthand guesses
const abbreviations = {
    "usa": "United States of America",
    "uk": "United Kingdom",
    "uae": "United Arab Emirates",
    "car": "Central African Republic",
    "drc": "Democratic Republic of the Congo"
};

// we will store references to the circles for each country
let countryCircles = new Map();

// dom elements
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

// load geojson
d3.json("world_v2.geojson").then(data => {
    countries = data.features.map(d => ({
        name: d.properties.name,
        feature: d
    }));

    g.selectAll("path")
     .data(data.features)
     .enter().append("path")
     .attr("class", "country")
     .attr("d", path);

    // add a small light blue circle for each country at its centroid
    countries.forEach(c => {
        const centroid = path.centroid(c.feature);
        const circle = g.append("circle")
            .attr("cx", centroid[0])
            .attr("cy", centroid[1])
            .attr("r", .5) // small circle
            .attr("fill", "darkblue");

        countryCircles.set(c.name, circle);
    });

    svg.call(zoom);
});

nameInput.addEventListener('input', () => {
    startBtn.disabled = !nameInput.value.trim();
});

startBtn.addEventListener("click", startGame);
pauseBtn.addEventListener("click", togglePause);
endBtn.addEventListener("click", endGameEarly);
guessInput.addEventListener("input", handleGuess);

document.addEventListener('keydown', () => {
    if (!isPaused && !isGameOver) guessInput.focus();
});

function startGame() {
    userName = nameInput.value.trim();
    if (!userName) return;
    startBtn.disabled = true;
    guessInput.disabled = false;
    pauseBtn.disabled = false;
    endBtn.disabled = false;
    guessInput.value = '';
    guessInput.focus();
    gameStartTime = Date.now();

    startTimer();
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        pauseTimer();
        guessInput.disabled = true;
        pauseBtn.textContent = "Unpause";
    } else {
        resumeTimer();
        guessInput.disabled = false;
        guessInput.focus();
        pauseBtn.textContent = "Pause";
    }
}

function pauseTimer() {
    clearInterval(timerInterval);
}

function resumeTimer() {
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        if (!isPaused) {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                endGame();
            }
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

    // apply abbreviations if any
    if (abbreviations[currentGuess]) {
        currentGuess = abbreviations[currentGuess].toLowerCase();
    }

    const matchedCountry = countries.find(c =>
        c.name && c.name.toLowerCase() === currentGuess && !guessedCountries.has(c.name)
    );

    if (matchedCountry) {
        guessedCountries.add(matchedCountry.name);
        animateCountryGuess(matchedCountry);
        guessInput.value = '';
        guessedCountSpan.textContent = `${guessedCountries.size}/${totalCountries}`;

        // remove the circle for this country since it's now guessed
        const circle = countryCircles.get(matchedCountry.name);
        if (circle) {
            circle.remove();
            countryCircles.delete(matchedCountry.name);
        }
    }
}

function computeFontSize(feature) {
    const bounds = path.bounds(feature);
    const boxWidth = bounds[1][0] - bounds[0][0];
    const boxHeight = bounds[1][1] - bounds[0][1];

    const rawFontSize = Math.min(boxWidth, boxHeight) / 50;
    const scaledFontSize = rawFontSize * 0.7; 
    const finalFontSize = scaledFontSize * 0.8 * 0.7; 
    return Math.max(Math.min(finalFontSize, 12), 4);
}

function animateCountryGuess(country) {
    const sel = g.selectAll("path")
      .filter(d => d.properties.name.toLowerCase().trim() === country.name.toLowerCase().trim());

    sel
      .transition().duration(0)
      .style("fill", "#c0ffc0") 
      .transition().duration(1800)
      .style("fill", "#90EE90") 
      .on("end", () => {
          sel.classed("highlighted", true);
      });

    const fontSize = computeFontSize(country.feature);
    const centroid = path.centroid(country.feature);
    g.append("text")
     .attr("class", "country-label")
     .attr("x", centroid[0])
     .attr("y", centroid[1])
     .attr("font-size", fontSize + "px")
     .text(country.name);
}

function endGame() {
    if (isGameOver) return;
    isGameOver = true;
    guessInput.disabled = true;
    pauseBtn.disabled = true;
    endBtn.disabled = true;
    clearInterval(timerInterval);

    const missingCountries = countries.filter(c => !guessedCountries.has(c.name));
    missingCountries.forEach(m => {
        const fontSize = computeFontSize(m.feature);
        const centroid = path.centroid(m.feature);
        g.append("text")
          .attr("class", "country-label missed-label")
          .attr("x", centroid[0])
          .attr("y", centroid[1])
          .attr("font-size", fontSize + "px")
          .text(m.name);

        g.selectAll("path")
         .filter(d => d.properties.name === m.name)
         .classed("missed", true);
    });
}

function endGameEarly() {
    if (isGameOver) return;
    timeRemaining = 0;
    endGame();
}
