// ════════════════════════════════════════════════════════════
//  CityGuessr — internationalization
//  Default: English. Ukrainian only if the browser prefers it.
// ════════════════════════════════════════════════════════════

const I18N = {
  en: {
    title: "CityGuessr — Atlas of Expeditions",
    brandSub: "An expedition across the world's cities · guess them on a satellite map",
    menuHeading: "Choose your lands to explore",
    selectAll: "All",
    clearAll: "Clear",
    citySetLabel: "City set",
    modeAll: "All cities",
    modeFamous: "Famous only",
    modeFamousTitle: "Capital and most famous cities",
    roundsLabel: "Rounds",
    infiniteTitle: "Endless",
    countLabel: "cities in pool",
    startBtn: "Begin the expedition",
    quitTitle: "Finish",
    targetLabel: "Find the city",
    scoreLabel: "score",
    roundLabel: "round",
    clickHint: "Click on the map where you think the city is",
    metricError: "off by",
    metricPoints: "points",
    km: "km",
    nextCity: "Next city",
    viewSummary: "View summary",
    summaryEyebrow: "Expedition log",
    summaryTitle: "Journey summary",
    sumTotalLabel: "total score",
    sumRoundsLabel: "rounds",
    sumAvgDistLabel: "avg. error, km",
    sumAvgScoreLabel: "avg. score / round",
    sumBestLabel: "best shot",
    againBtn: "New expedition",
    menuBtn: "Back to region select",
    continentCountries: "countries",
    continentCities: "cities",
    gradeTimeout: "Time's up!",
    gradePerfect: "Flawless! ✦",
    gradeGreat: "Great shot!",
    gradeClose: "Very close",
    gradeOk: "Not bad",
    gradeFar: "Quite far…",
    gradeWayOff: "A whole different land",
    continents: {
      "Europe": "Europe",
      "Asia": "Asia",
      "Africa": "Africa",
      "North America": "North America",
      "South America": "South America",
      "Oceania": "Oceania",
    },
  },

  uk: {
    title: "CityGuessr — Атлас Експедицій",
    brandSub: "Експедиція світовими містами · вгадуй за супутниковою мапою",
    menuHeading: "Оберіть терени для подорожі",
    selectAll: "Усі",
    clearAll: "Очистити",
    citySetLabel: "Набір міст",
    modeAll: "Усі міста",
    modeFamous: "Лише відомі",
    modeFamousTitle: "Столиця та найвідоміші міста",
    roundsLabel: "Кількість раундів",
    infiniteTitle: "Нескінченно",
    countLabel: "міст у наборі",
    startBtn: "Розпочати експедицію",
    quitTitle: "Завершити",
    targetLabel: "Знайдіть місто",
    scoreLabel: "балів",
    roundLabel: "раунд",
    clickHint: "Клікніть на мапі, де, на вашу думку, розташоване місто",
    metricError: "похибка",
    metricPoints: "балів",
    km: "км",
    nextCity: "Наступне місто",
    viewSummary: "Підсумок експедиції",
    summaryEyebrow: "Журнал експедиції",
    summaryTitle: "Підсумок мандрівки",
    sumTotalLabel: "загальний рахунок",
    sumRoundsLabel: "раундів",
    sumAvgDistLabel: "сер. похибка, км",
    sumAvgScoreLabel: "сер. бали / раунд",
    sumBestLabel: "найкращий постріл",
    againBtn: "Нова експедиція",
    menuBtn: "До вибору теренів",
    continentCountries: "країн",
    continentCities: "міст",
    gradeTimeout: "Час вийшов!",
    gradePerfect: "Бездоганно! ✦",
    gradeGreat: "Чудовий постріл!",
    gradeClose: "Дуже близько",
    gradeOk: "Непогано",
    gradeFar: "Далеченько…",
    gradeWayOff: "Зовсім інший край",
    continents: {
      "Europe": "Європа",
      "Asia": "Азія",
      "Africa": "Африка",
      "North America": "Північна Америка",
      "South America": "Південна Америка",
      "Oceania": "Океанія",
    },
  },
};

let LANG = "en";

// Pick Ukrainian only when the browser explicitly prefers it; otherwise English.
function detectLang() {
  try {
    const saved = localStorage.getItem("cg_lang");
    if (saved && I18N[saved]) return saved;
  } catch (_) { /* storage may be unavailable */ }
  const prefs = navigator.languages || [navigator.language || "en"];
  return prefs.some((l) => l && l.toLowerCase().startsWith("uk")) ? "uk" : "en";
}

function t(key) {
  const dict = I18N[LANG] || I18N.en;
  return dict[key] ?? I18N.en[key] ?? key;
}

function tContinent(name) {
  return (I18N[LANG].continents && I18N[LANG].continents[name]) || name;
}

function localeTag() {
  return LANG === "uk" ? "uk" : "en";
}

// Fill all elements tagged with data-i18n / data-i18n-title from the dictionary
function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}
