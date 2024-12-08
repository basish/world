// Config
const TIMER_DURATION = 15 * 60; // 15 minutes in seconds
let timeRemaining = TIMER_DURATION;
let timerInterval = null;
let isPaused = false;
let isGameOver = false;

let countries = [];
let guessedCountries = new Set();
const totalCountries = 197; 

// Synonyms and Continent Data (Examples, adjust as needed)
const synonyms = {
    "usa": "United States of America",
    "us": "United States of America",
    "uk": "United Kingdom",
    "uae": "United Arab Emirates",
    "car": "Central African Republic",
    "drc": "Democratic Republic of the Congo",
    "serbia": "Republic of Serbia" // Adjust if needed
};

// Example continent data (adjust these mappings as needed)
// You must ensure that all country names in your GeoJSON are keys in this object.
const continents = {
   "Republic of Serbia": "Europe",
   "United States of America": "North America",
   "United Kingdom": "Europe",
   "United Arab Emirates": "Asia",
   "Central African Republic": "Africa",
   "Democratic Republic of the Congo": "Africa",
   // ... Fill in for all countries ...
};

// Continents list and counters
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
    .wheelDelta(event => -event.deltaY * 0.002)
    .on("zoom", (event) => {
        currentTransform = event.transform;
        g.attr("transform", currentTransform);
        updateTiles();
    });

const tile = d3.tile().size([width, height]);
const tileGroup = svg.append("g");
const g = svg.append("g");

// Leaderboard logic
let leaderboard = loadLeaderboard(); // load from localStorage
let userName = "";
let gameStartTime = null; // record when game started

// Enable start only if name is provided
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

d3.json("world.geojson").then(data => {
    countries = data.features.map(d => ({
        name: d.properties.ADMIN,
        feature: d
    }));

    // Calculate continentTotals
    countries.forEach(c => {
        let cont = continents[c.name];
        if (cont) {
            continentTotals[cont] = (continentTotals[cont] || 0) + 1;
        }
    });

    updateContinentStats();

    const paths = g.selectAll("path")
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

function startGame() {
    userName = nameInput.value.trim();
    if (!userName) return; // just a safeguard

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
        pauseOverlay.style.display = 'block';
        pauseBtn.textContent = "Unpause";
    } else {
        resumeTimer();
        guessInput.disabled = false;
        guessInput.focus();
        pauseOverlay.style.display = 'none';
        pauseBtn.textContent = "Pause";
    }
}

function pauseTimer() {
    clearInterval(timerInterval);
}

function resumeTimer() {
    startTimer(); // just restarts the interval with current timeRemaining
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
    if (synonyms[currentGuess]) {
        currentGuess = synonyms[currentGuess].toLowerCase();
    }

    const matchedCountry = countries.find(c =>
        c.name && c.name.toLowerCase() === currentGuess && !guessedCountries.has(c.name)
    );

    if (matchedCountry) {
        guessedCountries.add(matchedCountry.name);
        animateCountryGuess(matchedCountry);
        guessInput.value = '';
        guessedCountSpan.textContent = `${guessedCountries.size}/${totalCountries}`;

        // Update continents count
        const cont = continents[matchedCountry.name];
        if (cont) {
            continentCounts[cont] = (continentCounts[cont] || 0) + 1;
        }
        updateContinentStats();

        // Update leaderboard with current progress
        updateLeaderboardEntry();
    }
}

function animateCountryGuess(country) {
    // First dark green (#006400), then transition to #90EE90
    const sel = g.selectAll("path")
      .filter(d => d.properties.ADMIN === country.name);

    sel
      .transition().duration(0)
      .style("fill", "#006400") // Dark green immediately
      .transition().duration(1000)
      .style("fill", "#90EE90")
      .on("end", () => {
          sel.classed("highlighted", true);
      });

    // Add label (20% smaller than before)
    const bounds = path.bounds(country.feature);
    const boxWidth = bounds[1][0] - bounds[0][0];
    const boxHeight = bounds[1][1] - bounds[0][1];

    const rawFontSize = Math.min(boxWidth, boxHeight) / 50;
    const scaledFontSize = rawFontSize * 0.7; // previous scale
    const finalFontSize = scaledFontSize * 0.8; // 20% smaller again

    const fontSize = Math.max(Math.min(finalFontSize, 12), 4);

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

    // Show missing countries
    const missingCountries = countries.filter(c => !guessedCountries.has(c.name));
    missingCountries.forEach(m => {
        const centroid = path.centroid(m.feature);
        g.append("text")
          .attr("class", "country-label missed-label")
          .attr("x", centroid[0])
          .attr("y", centroid[1])
          .text(m.name);

        g.selectAll("path")
         .filter(d => d.properties.ADMIN === m.name)
         .classed("missed", true);
    });

    const totalGuessed = guessedCountries.size;
    const totalTimeTaken = (TIMER_DURATION - timeRemaining);

    // Add to leaderboard if applicable
    addToLeaderboard(userName, totalGuessed, totalTimeTaken);

    // Show final message if not ended early
    if (timeRemaining <= 0) {
        // Time ran out
        // Already showing missed countries
    } else {
        // ended early
        // Already showing missed countries
    }
}

function endGameEarly() {
    if (isGameOver) return;
    timeRemaining = 0;
    endGame();
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

    // OpenTopoMap tiles
    image.enter().append("image")
        .attr("xlink:href", d => `https://a.tile.opentopomap.org/${d[2]}/${d[0]}/${d[1]}.png`)
        .attr("x", d => d[0] * 256)
        .attr("y", d => d[1] * 256)
        .attr("width", 256)
        .attr("height", 256);

    tileGroup
        .attr("transform", `scale(${tiles.scale})translate(${tiles.translate[0]},${tiles.translate[1]})`);
}

function updateContinentStats() {
    // Build a display string
    // For each continent: X/Y
    let html = '';
    allContinents.forEach(cont => {
        let got = continentCounts[cont] || 0;
        let tot = continentTotals[cont] || 0;
        if (tot > 0) {
            html += `<span style="margin-right:10px;">${cont}: ${got}/${tot}</span>`;
        }
    });
    continentStatsDiv.innerHTML = html;
}

// Leaderboard logic
function loadLeaderboard() {
    const data = localStorage.getItem("world_game_leaderboard");
    return data ? JSON.parse(data) : [];
}

function saveLeaderboard() {
    localStorage.setItem("world_game_leaderboard", JSON.stringify(leaderboard));
}

function addToLeaderboard(name, countriesGuessed, timeTaken) {
    const entry = {
        name: name,
        date: new Date().toLocaleString(),
        countriesGuessed: countriesGuessed,
        timeTaken: timeTaken
    };

    leaderboard.push(entry);
    sortLeaderboard();
    trimLeaderboard();
    saveLeaderboard();
    renderLeaderboard(entry);
}

function sortLeaderboard() {
    // Sort by countriesGuessed desc, timeTaken asc
    leaderboard.sort((a, b) => {
        if (b.countriesGuessed === a.countriesGuessed) {
            return a.timeTaken - b.timeTaken;
        }
        return b.countriesGuessed - a.countriesGuessed;
    });
}

function trimLeaderboard() {
    // keep top 15
    if (leaderboard.length > 15) {
        leaderboard = leaderboard.slice(0, 15);
    }
}

function renderLeaderboard(highlightEntry=null) {
    const tbody = document.querySelector("#leaderboard tbody");
    tbody.innerHTML = '';

    // highlightEntry used to highlight a particular row
    leaderboard.forEach((entry, i) => {
        const tr = document.createElement('tr');

        const rank = i+1;
        tr.innerHTML = `
          <td>${rank}</td>
          <td>${entry.name}</td>
          <td>${entry.date}</td>
          <td>${entry.countriesGuessed}</td>
          <td>${entry.timeTaken}</td>
        `;

        // highlight if highlightEntry
        if (highlightEntry && highlightEntry === entry) {
            tr.classList.add('leaderboard-highlight');
        }

        tbody.appendChild(tr);
    });
}

// Called during the game to update the player's current standing if they are on the leaderboard
function updateLeaderboardEntry() {
    // If the game isn't over, we can show a "live" entry for the current user
    // This means checking if user is already in leaderboard. If not, we can add a temporary entry.
    // Then resort, highlight movement. 
    // However, user only gets added to the leaderboard at end. 
    // The request: "the leaderboard should update in real time ... as they are ahead of other users."
    // This implies we can keep a "current run" entry updated live. Let's do that:
    // We'll store a temporary entry for the current user and update it on each guess. 
    // This entry is not saved to localStorage until endGame.

    const countriesGuessedNow = guessedCountries.size;
    const timeTaken = (Date.now() - gameStartTime) / 1000 | 0;

    // Check if a temporary entry for current user already exists in an in-memory structure
    // We'll store it as this.currentUserTemp
    if (!this.currentUserTemp) {
        this.currentUserTemp = {
            name: userName,
            date: new Date().toLocaleString(),
            countriesGuessed: countriesGuessedNow,
            timeTaken: timeTaken,
            isTemp: true
        };
        leaderboard.push(this.currentUserTemp);
    } else {
        this.currentUserTemp.countriesGuessed = countriesGuessedNow;
        this.currentUserTemp.timeTaken = timeTaken;
    }

    sortLeaderboard();

    // Determine old rank vs new rank? 
    // To highlight movement, we would need to track old positions. For simplicity, just highlight on each update:
    // Find currentUserTemp in leaderboard and highlight that row.
    let highlightEntry = this.currentUserTemp;
    trimLeaderboard();
    renderLeaderboard(highlightEntry);
}

// When endGame is called, we remove the temporary entry and add a final one
// Actually we've already implemented addToLeaderboard at the end of the game. 
// We'll remove the temporary entry before finalizing:
function endGame() {
    if (isGameOver) return;
    isGameOver = true;
    guessInput.disabled = true;
    pauseBtn.disabled = true;
    endBtn.disabled = true;
    clearInterval(timerInterval);

    // Remove temporary entry if exists
    if (this.currentUserTemp) {
        const idx = leaderboard.indexOf(this.currentUserTemp);
        if (idx > -1) {
            leaderboard.splice(idx,1);
        }
        this.currentUserTemp = null;
    }

    // Show missing countries
    const missingCountries = countries.filter(c => !guessedCountries.has(c.name));
    missingCountries.forEach(m => {
        const centroid = path.centroid(m.feature);
        g.append("text")
          .attr("class", "country-label missed-label")
          .attr("x", centroid[0])
          .attr("y", centroid[1])
          .text(m.name);

        g.selectAll("path")
         .filter(d => d.properties.ADMIN === m.name)
         .classed("missed", true);
    });

    const totalGuessed = guessedCountries.size;
    const totalTimeTaken = (TIMER_DURATION - timeRemaining);

    addToLeaderboard(userName, totalGuessed, totalTimeTaken);
}

// Overwrite the existing endGame with the new logic that includes final leaderboard insertion
const originalEndGame = endGame;
endGame = originalEndGame;

// endGameEarly calls endGame
function endGameEarly() {
    if (isGameOver) return;
    timeRemaining = 0;
    endGame();
}
