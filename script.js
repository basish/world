// Configuration
const TIMER_DURATION = 20 * 60; // 20 minutes
let timeRemaining = TIMER_DURATION;
let timerInterval = null;

let countries = [];
let guessedCountries = new Set();
const totalCountries = 197; // fixed count

// Common abbreviations
const abbreviations = {
    "usa": "United States of America",
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

const projection = d3.geoMercator().scale(130).translate([width / 2, height / 2]);
const path = d3.geoPath().projection(projection);

let currentTransform = d3.zoomIdentity;
const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .wheelDelta(event => -event.deltaY * 0.002)
    .on("zoom", (event) => {
        currentTransform = event.transform;
        g.attr("transform", currentTransform);
        updateTiles();
    });

const tile = d3.tile().size([width, height]);
const tileGroup = svg.append("g");
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
    updateTiles(); // Draw initial tiles
});

startBtn.addEventListener("click", startGame);
guessInput.addEventListener("input", handleGuess);
document.addEventListener('keydown', () => { guessInput.focus(); });

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
        // All guessed
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
        // Time ran out
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

        // If the entire country is off-screen, pan it into view
        if (isCountryFullyOutOfView(matchedCountry)) {
            panToCountry(matchedCountry);
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

    // Entirely left: right edge < 0
    if (bottomRight[0] < 0) return true;
    // Entirely right: left edge > width
    if (topLeft[0] > width) return true;
    // Entirely above: bottom edge < 0
    if (bottomRight[1] < 0) return true;
    // Entirely below: top edge > height
    if (topLeft[1] > height) return true;

    return false;
}

function panToCountry(country) {
    const bounds = path.bounds(country.feature);
    const t = currentTransform;
    const scale = t.k;

    const topLeft = t.apply(bounds[0]);
    const bottomRight = t.apply(bounds[1]);

    let dx = 0, dy = 0;

    if (bottomRight[0] < 0) {
        // Entirely to the left: move right
        dx = width/2 - (topLeft[0] + bottomRight[0])/2;
    }
    else if (topLeft[0] > width) {
        // Entirely to the right: move left
        dx = width/2 - (topLeft[0] + bottomRight[0])/2;
    }

    if (bottomRight[1] < 0) {
        // Entirely above: move down
        dy = height/2 - (topLeft[1] + bottomRight[1])/2;
    }
    else if (topLeft[1] > height) {
        // Entirely below: move up
        dy = height/2 - (topLeft[1] + bottomRight[1])/2;
    }

    // Adjust by scale
    dx = dx / scale;
    dy = dy / scale;

    const newTransform = d3.zoomIdentity
        .translate(t.x + dx*scale, t.y + dy*scale)
        .scale(scale);

    svg.transition()
       .duration(750)
       .call(zoom.transform, newTransform);
}

function updateTiles() {
    const t = currentTransform;
    const scale = t.k / projection.scale();
    const translate = [t.x, t.y];

    const tiles = tile
        .scale(projection.scale() * 2 * Math.PI * scale)
        .translate(translate)();

    const image = tileGroup
        .selectAll("image")
        .data(tiles, d => d);

    image.exit().remove();

    image.enter().append("image")
        .attr("xlink:href", d => `https://stamen-tiles.a.ssl.fastly.net/terrain-background/${d[2]}/${d[0]}/${d[1]}.png`)
        .attr("x", d => d[0] * 256)
        .attr("y", d => d[1] * 256)
        .attr("width", 256)
        .attr("height", 256);

    tileGroup
        .attr("transform", `scale(${tiles.scale})translate(${tiles.translate[0]},${tiles.translate[1]})`);
}
