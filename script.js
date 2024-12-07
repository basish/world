// Configuration
const TIMER_DURATION = 20 * 60; // 20 minutes
let timeRemaining = TIMER_DURATION;
let timerInterval = null;

let countries = [];
let guessedCountries = new Set();
const totalCountries = 197;

const abbreviations = {
    "usa": "United States of America",
    "us": "United States of America",
    "uk": "United Kingdom",
    "uae": "United Arab Emirates",
    "car": "Central African Republic",
    "drc": "Democratic Republic of the Congo"
};

const startBtn = document.getElementById('start-btn');
const timerSpan = document.getElementById('timer');
const guessInput = document.getElementById('guess-input');
const guessedCountSpan = document.getElementById('guessed-count');
const svg = d3.select("#map");

const width = 1200;
const height = 600;

const projection = d3.geoMercator()
    .scale(130)
    .translate([width / 2, height / 2]);

const path = d3.geoPath().projection(projection);

let currentTransform = d3.zoomIdentity;
const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .wheelDelta(event => -event.deltaY * 0.002)
    .on("zoom", (event) => {
        currentTransform = event.transform;
        g.attr("transform", currentTransform);
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
     .attr("d", path)
     .on("mouseover", function() {
         d3.select(this).classed("hovered", true);
     })
     .on("mouseout", function() {
         d3.select(this).classed("hovered", false);
     });

    svg.call(zoom);
});

startBtn.addEventListener("click", startGame);
guessInput.addEventListener("input", handleGuess);
document.addEventListener('keydown', () => guessInput.focus());

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
    if (guessedCountries.size === totalCountries) {
        const totalTimeTaken = TIMER_DURATION - timeRemaining;
        const m = Math.floor(totalTimeTaken / 60);
        const s = totalTimeTaken % 60;
        const finalTime = `${m}:${s.toString().padStart(2, '0')}`;

        const congratsMessage = document.createElement('div');
        congratsMessage.style.marginTop = '20px';
        congratsMessage.style.fontSize = '18px';
        congratsMessage.style.fontWeight = 'bold';
        congratsMessage.textContent = `Congratulations! You guessed all countries in ${finalTime}.`;
        document.getElementById('game-container').appendChild(congratsMessage);
    } else {
        const message = document.createElement('div');
        message.style.marginTop = '20px';
        message.style.fontSize = '18px';
        message.style.fontWeight = 'bold';
        message.textContent = `Time's up! You guessed ${guessedCountries.size}/${totalCountries} countries.`;
        document.getElementById('game-container').appendChild(message);
    }
}

function handleGuess() {
    let currentGuess = guessInput.value.trim().toLowerCase();
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

        if (isCountryFullyOutOfView(matchedCountry)) {
            centerOnCountry(matchedCountry);
        }
    }
}

function highlightCountry(country) {
    g.selectAll("path")
      .filter(d => d.properties.ADMIN === country.name)
      .classed("highlighted", true);

    const bounds = path.bounds(country.feature);
    const boxWidth = bounds[1][0] - bounds[0][0];
    const boxHeight = bounds[1][1] - bounds[0][1];

    const rawFontSize = Math.min(boxWidth, boxHeight) / 50;
    const scaledFontSize = rawFontSize * 0.7; // 30% smaller
    const fontSize = Math.max(Math.min(scaledFontSize, 12), 4);

    const centroid = path.centroid(country.feature);

    g.append("text")
     .attr("class", "country-label")
     .attr("x", centroid[0])
     .attr("y", centroid[1])
     .attr("font-size", fontSize + "px")
     .text(country.name);
}

function isCountryFullyOutOfView(country) {
    const bounds = path.bounds(country.feature);
    const t = currentTransform;

    const topLeft = t.apply(bounds[0]);
    const bottomRight = t.apply(bounds[1]);

    if (bottomRight[0] < 0) return true;       // Entirely left
    if (topLeft[0] > width) return true;       // Entirely right
    if (bottomRight[1] < 0) return true;       // Entirely above
    if (topLeft[1] > height) return true;      // Entirely below

    return false;
}

function centerOnCountry(country) {
    const centroid = path.centroid(country.feature); // Get the country's centroid (map coordinates)
    const scale = currentTransform.k; // Keep the current zoom level (scale)

    // Calculate new translation to move the country's centroid to the center of the map
    const translateX = width / 2 - centroid[0] * scale;
    const translateY = height / 2 - centroid[1] * scale;

    // Update the current transform state
    const newTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);

    // Apply the new transformation
    g.attr("transform", newTransform.toString());
    currentTransform = newTransform; // Update the global current transform
}
