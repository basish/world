// Configuration
const TIMER_DURATION = 20 * 60; // 20 minutes in seconds
let timeRemaining = TIMER_DURATION;
let timerInterval = null;

let countries = [];
let guessedCountries = new Set();
const totalCountries = 197; // Fixed to 197 as requested

// Common abbreviations mapping
const abbreviations = {
    "usa": "United States of America",
    "us": "United States of America",
    "uk": "United Kingdom",
    "uae": "United Arab Emirates",
    "car": "Central African Republic",
    "drc": "Democratic Republic of the Congo"
};

// Selectors
const startBtn = document.getElementById('start-btn');
const timerSpan = document.getElementById('timer');
const guessInput = document.getElementById('guess-input');
const guessedCountSpan = document.getElementById('guessed-count');
const svg = d3.select("#map");

const width = 1200;
const height = 600;

const projection = d3.geoMercator().scale(130).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);

const zoom = d3.zoom()
    .scaleExtent([1, 12])
    .wheelDelta((event) => -event.deltaY * 0.002)
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });

const g = svg.append("g");

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

    svg.call(zoom);
});

startBtn.addEventListener("click", startGame);

function startGame() {
    startBtn.disabled = true;
    guessInput.disabled = false;
    guessInput.value = '';
    guessInput.focus();
    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeRemaining = TIMER_DURATION;
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerSpan.textContent = `${minutes}:${seconds.toString().padStart(2,'0')}`;
}

function endGame() {
    guessInput.disabled = true;
}

guessInput.addEventListener("input", handleGuess);

function handleGuess() {
    let currentGuess = guessInput.value.trim().toLowerCase();

    // Replace abbreviations if matched
    if (abbreviations[currentGuess]) {
        currentGuess = abbreviations[currentGuess].toLowerCase();
    }

    const matchedCountry = countries.find(c =>
        c.name && c.name.toLowerCase() === currentGuess && !guessedCountries.has(c.name)
    );

    if (matchedCountry) {
        guessedCountries.add(matchedCountry.name);
        highlightCountry(matchedCountry);
        guessInput.value = '';
        guessedCountSpan.textContent = `${guessedCountries.size}/${totalCountries}`;
    }
}

function highlightCountry(country) {
    g.selectAll("path")
      .filter(d => d.properties.ADMIN === country.name)
      .classed("highlighted", true);

    const centroid = path.centroid(country.feature);
    const bounds = path.bounds(country.feature);
    const boxWidth = bounds[1][0] - bounds[0][0];
    const boxHeight = bounds[1][1] - bounds[0][1];

    // Adjust sizing: smaller text with both min and max constraints
    const rawFontSize = Math.min(boxWidth, boxHeight) / 50;
    const fontSize = Math.max(Math.min(rawFontSize, 12), 4); // between 4px and 12px

    g.append("text")
     .attr("class", "country-label")
     .attr("x", centroid[0])
     .attr("y", centroid[1])
     .attr("font-size", fontSize + "px")
     .text(country.name);
}

// Always allow typing into the guess input
document.addEventListener('keydown', () => {
    guessInput.focus();
});

function endGame() {
    guessInput.disabled = true;
    // If all countries are guessed
    if (guessedCountries.size === totalCountries) {
        const totalTimeTaken = TIMER_DURATION - timeRemaining;
        const minutes = Math.floor(totalTimeTaken / 60);
        const seconds = totalTimeTaken % 60;
        const finalTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        const congratsMessage = document.createElement('div');
        congratsMessage.style.marginTop = '20px';
        congratsMessage.style.fontSize = '18px';
        congratsMessage.style.fontWeight = 'bold';
        congratsMessage.textContent = `Congratulations! You guessed all countries in ${finalTime}.`;
        
        document.getElementById('game-container').appendChild(congratsMessage);
    } else {
        // If time runs out
        const message = document.createElement('div');
        message.style.marginTop = '20px';
        message.style.fontSize = '18px';
        message.style.fontWeight = 'bold';
        message.textContent = `Time's up! You guessed ${guessedCountries.size}/${totalCountries} countries.`;
        
        document.getElementById('game-container').appendChild(message);
    }
}
