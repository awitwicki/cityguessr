// ════════════════════════════════════════════════════════════
//  CityGuessr — game logic
// ════════════════════════════════════════════════════════════

const ROUND_TIME = 15;           // seconds per city
const MAX_DISTANCE_SCORE = 5000; // perfect-hit points
const MAX_SPEED_BONUS = 1000;    // extra for answering fast
const RING_CIRC = 2 * Math.PI * 19; // timer ring circumference

// ─────────────────── State ───────────────────
const state = {
  selectedCountries: new Set(),
  famousOnly: false, // only capital + most-famous cities
  pool: [],          // remaining cities to ask
  current: null,     // current city
  phase: "idle",     // idle | guessing | revealed
  timeLeft: ROUND_TIME,
  timerId: null,
  totalRounds: 10,   // 0 = endless
  round: 0,
  totalScore: 0,
  history: [],       // { city, distance, points }
};

// ─────────────────── DOM helpers ───────────────────
const $ = (id) => document.getElementById(id);
const tree = buildContinentTree();

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("is-active"));
  $(id).classList.add("is-active");
  // Language switch overlaps the in-game HUD — hide it while playing
  $("lang-switch").classList.toggle("hidden", id === "game");
}

// ════════════════════════════════════════════════════════════
//  MENU — build continent / country selector
// ════════════════════════════════════════════════════════════
function buildMenu() {
  const list = $("continent-list");
  list.innerHTML = "";

  for (const continent of CONTINENT_ORDER) {
    const countries = tree[continent];
    const countryNames = Object.keys(countries).sort();
    if (countryNames.length === 0) continue;

    const cityCount = countryNames.reduce((n, c) => n + countries[c].length, 0);

    const block = document.createElement("div");
    block.className = "continent";
    block.dataset.continent = continent;

    // Header row
    const row = document.createElement("div");
    row.className = "continent-row";
    row.innerHTML = `
      <span class="chev">▶</span>
      <span class="cbox" data-role="continent-box"></span>
      <span class="continent-name">${tContinent(continent)}</span>
      <span class="continent-badge">${countryNames.length} ${t("continentCountries")} · ${cityCount} ${t("continentCities")}</span>
    `;

    // Toggle accordion (but not when clicking the checkbox)
    row.addEventListener("click", (e) => {
      if (e.target.closest("[data-role='continent-box']")) return;
      block.classList.toggle("open");
    });
    // Continent checkbox -> select/deselect all its countries
    row.querySelector("[data-role='continent-box']").addEventListener("click", (e) => {
      e.stopPropagation();
      const allOn = countryNames.every((c) => state.selectedCountries.has(c));
      countryNames.forEach((c) =>
        allOn ? state.selectedCountries.delete(c) : state.selectedCountries.add(c)
      );
      refreshMenuState();
    });

    block.appendChild(row);

    // Country grid
    const grid = document.createElement("div");
    grid.className = "country-grid";
    for (const country of countryNames) {
      const cr = document.createElement("div");
      cr.className = "country-row";
      cr.dataset.country = country;
      cr.innerHTML = `
        <span class="cbox" data-role="country-box"></span>
        <span class="country-name">${country}</span>
        <span class="country-count">${countries[country].length}</span>
      `;
      cr.addEventListener("click", () => {
        state.selectedCountries.has(country)
          ? state.selectedCountries.delete(country)
          : state.selectedCountries.add(country);
        refreshMenuState();
      });
      grid.appendChild(cr);
    }
    block.appendChild(grid);
    list.appendChild(block);
  }

  refreshMenuState();
}

function refreshMenuState() {
  // Country checkboxes
  document.querySelectorAll(".country-row").forEach((cr) => {
    const on = state.selectedCountries.has(cr.dataset.country);
    cr.querySelector(".cbox").classList.toggle("checked", on);
  });

  // Continent checkboxes (checked / indeterminate / off)
  document.querySelectorAll(".continent").forEach((block) => {
    const countryNames = Object.keys(tree[block.dataset.continent]);
    const selected = countryNames.filter((c) => state.selectedCountries.has(c)).length;
    const box = block.querySelector("[data-role='continent-box']");
    box.classList.toggle("checked", selected === countryNames.length && selected > 0);
    box.classList.toggle("indet", selected > 0 && selected < countryNames.length);
  });

  // Footer count + start button (respects famous-only mode)
  const cities = selectedCities().length;
  $("selection-count").textContent = cities;
  $("start-btn").disabled = cities === 0;
}

// Cities playable given current country selection + mode
function selectedCities() {
  return CITIES.filter(
    (c) => state.selectedCountries.has(c.country) && (!state.famousOnly || c.fam)
  );
}

// ════════════════════════════════════════════════════════════
//  MAP
// ════════════════════════════════════════════════════════════
let map = null;
let guessMarker = null;
let answerMarker = null;
let line = null;

function initMap() {
  if (map) return;
  map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 16,
    zoomControl: true,
    attributionControl: true,
    maxBounds: [[-85, -180], [85, 180]],
    maxBoundsViscosity: 0.7,
  }).setView([25, 10], 2);

  // Satellite imagery (Esri World Imagery — free, no key)
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      attribution:
        "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      maxZoom: 16,
    }
  ).addTo(map);

  map.on("click", onMapClick);
}

function clearMapShapes() {
  [guessMarker, answerMarker, line].forEach((l) => l && map.removeLayer(l));
  guessMarker = answerMarker = line = null;
}

function pinIcon(kind, labelText) {
  const label = labelText ? `<span class="label">${labelText}</span>` : "";
  return L.divIcon({
    className: `${kind}-marker`,
    html: `${label}<span class="pin"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// ════════════════════════════════════════════════════════════
//  GAME FLOW
// ════════════════════════════════════════════════════════════
function startGame() {
  // Build pool from selected countries
  state.pool = selectedCities();
  shuffle(state.pool);
  state.round = 0;
  state.totalScore = 0;
  state.history = [];

  showScreen("game");
  initMap();
  // Leaflet needs a size recalculation once the screen is visible
  setTimeout(() => {
    map.invalidateSize();
    map.setView([25, 10], 2);
    nextRound();
  }, 60);
}

function nextRound() {
  clearMapShapes();
  if (state.pool.length === 0) {
    // Refill so endless mode never runs out
    state.pool = selectedCities();
    shuffle(state.pool);
  }
  state.current = state.pool.pop();
  state.round += 1;
  state.phase = "guessing";

  // Reset HUD
  $("target-city").textContent = state.current.city;
  $("target-country").textContent = state.current.country;
  $("round-value").textContent =
    state.totalRounds > 0 ? `${state.round}/${state.totalRounds}` : state.round;
  $("score-value").textContent = state.totalScore;

  // Hide result, show hint + timer
  $("result-panel").classList.remove("show");
  $("click-hint").classList.remove("hidden");
  $("timer-wrap").classList.remove("hidden", "danger");
  $("time-bar").classList.remove("hidden", "danger");

  map.getContainer().style.cursor = "crosshair";
  startTimer();
}

function startTimer() {
  clearInterval(state.timerId);
  state.timeLeft = ROUND_TIME;
  updateTimerUI();
  state.timerId = setInterval(() => {
    state.timeLeft -= 0.1;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      updateTimerUI();
      timeOut();
    } else {
      updateTimerUI();
    }
  }, 100);
}

function updateTimerUI() {
  const frac = state.timeLeft / ROUND_TIME;
  const danger = state.timeLeft <= 5;
  $("timer-progress").style.strokeDashoffset = RING_CIRC * (1 - frac);
  $("timer-num").textContent = Math.ceil(state.timeLeft);
  $("timer-wrap").classList.toggle("danger", danger);
  $("time-bar-fill").style.width = (frac * 100) + "%";
  $("time-bar").classList.toggle("danger", danger);
}

function stopTimer() {
  clearInterval(state.timerId);
  state.timerId = null;
}

function onMapClick(e) {
  if (state.phase !== "guessing") return;
  resolveRound(e.latlng);
}

function timeOut() {
  if (state.phase !== "guessing") return;
  resolveRound(null); // no guess → zero points
}

function resolveRound(latlng) {
  stopTimer();
  state.phase = "revealed";
  map.getContainer().style.cursor = "grab";
  $("click-hint").classList.add("hidden");
  $("timer-wrap").classList.add("hidden");
  $("time-bar").classList.add("hidden");

  const answer = L.latLng(state.current.lat, state.current.lon);

  let distance, points, speedBonus = 0;
  if (latlng) {
    distance = map.distance(latlng, answer) / 1000; // km
    const distScore = Math.round(MAX_DISTANCE_SCORE * Math.exp(-distance / 2000));
    speedBonus = Math.round(MAX_SPEED_BONUS * (state.timeLeft / ROUND_TIME));
    points = distScore + speedBonus;

    guessMarker = L.marker(latlng, { icon: pinIcon("guess") }).addTo(map);
  } else {
    distance = Infinity;
    points = 0;
  }

  // Answer marker + connecting line
  answerMarker = L.marker(answer, {
    icon: pinIcon("answer", state.current.city),
  }).addTo(map);

  if (latlng) {
    line = L.polyline([latlng, answer], {
      color: "#d3a84b",
      weight: 2,
      opacity: 0.85,
      dashArray: "2 8",
      lineCap: "round",
    }).addTo(map);
    map.fitBounds(L.latLngBounds([latlng, answer]).pad(0.4), { maxZoom: 7 });
  } else {
    map.flyTo(answer, 4, { duration: 1 });
  }

  // Tally
  state.totalScore += points;
  state.history.push({ city: state.current, distance, points });
  $("score-value").textContent = state.totalScore;

  showResult(distance, points, speedBonus, latlng !== null);
}

function showResult(distance, points, speedBonus, guessed) {
  const grade = gradeFor(guessed ? distance : Infinity);
  $("result-grade").textContent = grade;
  $("result-distance").textContent = guessed ? formatKm(distance) : "—";
  $("result-points").textContent = points;

  // Last round? swap the button to finish the expedition
  const arrow = isLastRound() ? "✦" : "→";
  $("next-btn").innerHTML =
    `${isLastRound() ? t("viewSummary") : t("nextCity")} <span aria-hidden="true">${arrow}</span>`;

  $("result-panel").classList.add("show");
}

function isLastRound() {
  return state.totalRounds > 0 && state.round >= state.totalRounds;
}

function onNext() {
  if (isLastRound()) endGame();
  else nextRound();
}

function gradeFor(distance) {
  if (distance === Infinity) return t("gradeTimeout");
  if (distance < 25) return t("gradePerfect");
  if (distance < 150) return t("gradeGreat");
  if (distance < 500) return t("gradeClose");
  if (distance < 1500) return t("gradeOk");
  if (distance < 4000) return t("gradeFar");
  return t("gradeWayOff");
}

// ════════════════════════════════════════════════════════════
//  SUMMARY
// ════════════════════════════════════════════════════════════
function endGame() {
  stopTimer();
  const h = state.history;
  showScreen("summary");

  $("sum-total").textContent = state.totalScore.toLocaleString(localeTag());
  $("sum-rounds").textContent = h.length;

  if (h.length === 0) {
    $("sum-avg-dist").textContent = "—";
    $("sum-avg-score").textContent = "—";
    $("sum-best").textContent = "—";
    return;
  }

  const measured = h.filter((r) => isFinite(r.distance));
  const avgDist = measured.length
    ? measured.reduce((s, r) => s + r.distance, 0) / measured.length
    : Infinity;
  const avgScore = Math.round(state.totalScore / h.length);
  const best = h.reduce((b, r) => (r.points > b.points ? r : b), h[0]);

  $("sum-avg-dist").textContent = isFinite(avgDist) ? formatKm(avgDist) : "—";
  $("sum-avg-score").textContent = avgScore.toLocaleString(localeTag());
  const bestDist = isFinite(best.distance) ? `${formatKm(best.distance)} ${t("km")} · ` : "";
  $("sum-best").textContent = `${best.city.city} · ${bestDist}+${best.points}`;
}

// ════════════════════════════════════════════════════════════
//  Utilities
// ════════════════════════════════════════════════════════════
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatKm(km) {
  if (km < 10) return km.toFixed(1);
  return Math.round(km).toLocaleString(localeTag());
}

// ════════════════════════════════════════════════════════════
//  Wire up events
// ════════════════════════════════════════════════════════════
function setLang(lang) {
  LANG = lang;
  try { localStorage.setItem("cg_lang", lang); } catch (_) { /* ignore */ }
  applyStaticI18n();
  buildMenu();      // continent names + badges depend on language
  updateLangSwitch();
}

function updateLangSwitch() {
  $("lang-switch").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.lang === LANG)
  );
}

function init() {
  LANG = detectLang();
  applyStaticI18n();
  buildMenu();
  updateLangSwitch();

  $("lang-switch").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  });

  $("select-all").addEventListener("click", () => {
    CITIES.forEach((c) => state.selectedCountries.add(c.country));
    refreshMenuState();
  });
  $("clear-all").addEventListener("click", () => {
    state.selectedCountries.clear();
    refreshMenuState();
  });

  // City-set mode selector (All / Famous only)
  $("mode-seg").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.famousOnly = btn.dataset.fam === "1";
      $("mode-seg").querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      refreshMenuState();
    });
  });

  // Rounds selector (segmented control)
  $("rounds-seg").querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.totalRounds = parseInt(btn.dataset.rounds, 10);
      $("rounds-seg").querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  $("start-btn").addEventListener("click", startGame);
  $("next-btn").addEventListener("click", onNext);
  $("quit-btn").addEventListener("click", endGame);
  $("again-btn").addEventListener("click", startGame);
  $("menu-btn").addEventListener("click", () => showScreen("menu"));

  // Open Europe by default so the menu feels alive
  const first = document.querySelector(".continent");
  if (first) first.classList.add("open");
}

document.addEventListener("DOMContentLoaded", init);
