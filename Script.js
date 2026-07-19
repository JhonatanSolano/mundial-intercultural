const STORAGE_KEY = "copa-intercultural-torneo-v7";
const ACTIVITY_MAX = { draw: 5, memory: 20, guess: 20, scenario: 20, sound: 15, commitment: 20 };
const ACTIVITY_BY_STATION = ["draw", "memory", "guess", "scenario", "sound", "commitment"];
const STATIONS = [
  { id: 0, label: "1 Sorteo" },
  { id: 1, label: "2 Memoria" },
  { id: 2, label: "3 Adivina" },
  { id: 3, label: "4 Convivencia" },
  { id: 4, label: "5 Música" },
  { id: 5, label: "6 Cierre" }
];

const state = {
  activeTeamKey: "",
  tournament: { teams: [], guessCountryQueue: [], guessCountryHistory: [], soundCountryQueue: [], soundCountryHistory: [] },
  draw: { active: false, awaitingScore: false, done: false },
  memory: { lock: false, first: null, matches: 0, active: false, done: false },
  guess: { country: null, active: false, done: false, revealed: 0, wrongAttempts: 0 },
  scenario: { active: false, done: false, opened: new Set(), answered: new Set(), correct: new Set() },
  sound: { active: false, done: false, opened: new Set(), currentIndex: 0, resumeGeneralAfter: false },
  commitment: { active: false, done: false },
  timers: {}
};

let audioEngine = null;
let countryAudioToken = 0;
const soundAudioCache = new Map();
let resumeGeneralMusicOnReturn = false;
let teamMessageTimer = null;
let welcomeNoticeTimer = null;

function $(selector){ return document.querySelector(selector); }
function $all(selector){ return [...document.querySelectorAll(selector)]; }

function normalize(text){
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function hashText(text){
  let h = 2166136261;
  for(const ch of normalize(text)){
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function activeTeam(){
  return state.tournament.teams.find(team => team.key === state.activeTeamKey) || null;
}

function shuffled(list, salt = 0){
  const team = activeTeam();
  const random = rng((team ? team.seed : 2026) + salt);
  const copy = [...list];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomSalt(){
  if(window.crypto && window.crypto.getRandomValues){
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0;
}

function shuffledWithEntropy(list, salt = 0){
  const team = activeTeam();
  const seed = ((team ? team.seed : 2026) ^ randomSalt() ^ Date.now() ^ salt) >>> 0;
  const random = rng(seed);
  const copy = [...list];
  for(let i = copy.length - 1; i > 0; i--){
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function freshSeed(name){
  return (hashText(name) ^ Date.now() ^ Math.floor(Math.random() * 900000)) >>> 0;
}

function usageBalancedCountries(kind, excludedIds = new Set(), salt = 0){
  const usage = new Map(COUNTRIES.map(country => [country.id, 0]));
  state.tournament.teams.forEach(team => {
    const ids = kind === "draw" ? [team.countryId] : (team[`${kind}CountryIds`] || []);
    ids.filter(Boolean).forEach(id => usage.set(id, (usage.get(id) || 0) + 1));
  });
  return shuffledWithEntropy(COUNTRIES.filter(country => !excludedIds.has(country.id)), salt).sort((a, b) => {
    const byUsage = (usage.get(a.id) || 0) - (usage.get(b.id) || 0);
    return byUsage || 0;
  });
}

function newScores(){
  return { draw: 0, memory: 0, guess: 0, scenario: 0, sound: 0, commitment: 0 };
}

function newLocks(){
  return { draw: false, memory: false, guess: false, scenario: false, sound: false, commitment: false };
}

function loadTournament(){
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state.tournament = saved.tournament || { teams: [], guessCountryQueue: [], guessCountryHistory: [], soundCountryQueue: [], soundCountryHistory: [] };
  state.tournament.guessCountryQueue = Array.isArray(state.tournament.guessCountryQueue) ? state.tournament.guessCountryQueue : [];
  state.tournament.guessCountryHistory = Array.isArray(state.tournament.guessCountryHistory) ? state.tournament.guessCountryHistory : [];
  state.tournament.soundCountryQueue = Array.isArray(state.tournament.soundCountryQueue) ? state.tournament.soundCountryQueue : [];
  state.tournament.soundCountryHistory = Array.isArray(state.tournament.soundCountryHistory) ? state.tournament.soundCountryHistory : [];
  state.activeTeamKey = saved.activeTeamKey || "";
  state.tournament.teams.forEach(team => {
    team.activityScores = { ...newScores(), ...(team.activityScores || {}) };
    team.activityLocked = { ...newLocks(), ...(team.activityLocked || {}) };
    team.stamps = team.stamps || [];
    team.commitments = team.commitments || [];
    team.guessCountryIds = team.guessCountryIds || [];
    team.soundCountryIds = team.soundCountryIds || team.soundTrackIds || [];
    team.score = totalScore(team);
  });
  if(!state.tournament.soundCountryHistory.length){
    state.tournament.soundCountryHistory = state.tournament.teams
      .flatMap(team => team.soundCountryIds || team.soundTrackIds || [])
      .slice(-30);
  }
  if(!state.tournament.guessCountryHistory.length){
    state.tournament.guessCountryHistory = state.tournament.teams
      .flatMap(team => team.guessCountryIds || [])
      .slice(-30);
  }
}

function saveTournament(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeTeamKey: state.activeTeamKey, tournament: state.tournament }));
}

function countryById(id){
  return COUNTRIES.find(country => country.id === id) || null;
}

function selectedCountry(){
  const team = activeTeam();
  return countryById(team && team.countryId) || shuffled(COUNTRIES, 11)[0];
}

function assignedCountryIds(exceptKey = ""){
  return new Set(state.tournament.teams.filter(team => team.key !== exceptKey && team.countryId).map(team => team.countryId));
}

function totalScore(team){
  return Math.min(100, Math.round(Object.values(team.activityScores || {}).reduce((sum, value) => sum + Number(value || 0), 0)));
}

function setActivityScore(activity, value){
  const team = activeTeam();
  if(!team) return;
  team.activityScores[activity] = Math.max(0, Math.min(ACTIVITY_MAX[activity], Math.round(value)));
  team.score = totalScore(team);
  $("#scoreValue").textContent = team.score;
  $("#finalScore").textContent = team.score;
  updateFinalMessage();
  saveTournament();
}

function lockActivity(activity){
  const team = activeTeam();
  if(!team) return;
  team.activityLocked[activity] = true;
  saveTournament();
}

function isLocked(activity){
  const team = activeTeam();
  return Boolean(team && team.activityLocked && team.activityLocked[activity]);
}

function stationForActivity(activity){
  return ACTIVITY_BY_STATION.indexOf(activity);
}

function autoSealStation(activity){
  const team = activeTeam();
  const stationId = stationForActivity(activity);
  if(!team || stationId < 0 || team.stamps.includes(stationId)) return;
  team.stamps.push(stationId);
  $("#stampValue").textContent = `${team.stamps.length}/6`;
  refreshStampButtons();
  refreshNavState();
  saveTournament();
}

function showTeamMessage(message, isError = false){
  const el = $("#teamSeedText");
  el.textContent = message;
  el.classList.toggle("team-note--error", isError);
  el.classList.remove("team-note--welcome");
}

function showTemporaryTeamMessage(message, duration = 5000){
  const el = $("#teamSeedText");
  clearTimeout(teamMessageTimer);
  el.textContent = message;
  el.classList.remove("team-note--error");
  el.classList.add("team-note--welcome");
  showWelcomeNotice(message, duration);
  teamMessageTimer = setTimeout(() => {
    const team = activeTeam();
    showTeamMessage(team ? `Equipo guardado: ${team.name}. Máximo total: 100 puntos.` : "Cada nombre queda guardado en este PC y no se puede repetir.");
  }, duration);
}

function showWelcomeNotice(message, duration = 5000){
  const notice = $("#welcomeNotice");
  if(!notice) return;
  clearTimeout(welcomeNoticeTimer);
  $("#welcomeNoticeTitle").textContent = message;
  $("#welcomeNoticeText").textContent = "Comiencen por la actividad 1.";
  notice.hidden = false;
  notice.classList.remove("welcome-notice--show");
  void notice.offsetWidth;
  notice.classList.add("welcome-notice--show");
  welcomeNoticeTimer = setTimeout(() => {
    notice.hidden = true;
    notice.classList.remove("welcome-notice--show");
  }, duration);
}

function closeWelcomeNotice(){
  clearTimeout(welcomeNoticeTimer);
  const notice = $("#welcomeNotice");
  if(!notice) return;
  notice.hidden = true;
  notice.classList.remove("welcome-notice--show");
}

function ensureTeam(){
  if(activeTeam()) return true;
  showTeamMessage("Guarden el equipo antes de iniciar actividades.", true);
  return false;
}

function saveTeam(){
  closeWelcomeNotice();
  closeFinishCelebration();
  const name = $("#teamName").value.trim();
  if(!name){
    showTeamMessage("Escribe un nombre de equipo para continuar.", true);
    return;
  }
  const key = normalize(name);
  const repeated = state.tournament.teams.some(team => team.key === key && team.key !== state.activeTeamKey);
  if(repeated){
    showTeamMessage("No se puede: ese nombre ya esta guardado. Cambien el nombre del equipo.", true);
    return;
  }
  let team = activeTeam();
  if(team && team.key === key){
    team.name = name;
  } else {
    team = {
      key,
      name,
      seed: freshSeed(name),
      countryId: "",
      score: 0,
      stamps: [],
      activityScores: newScores(),
      activityLocked: newLocks(),
      commitments: [],
      guessCountryIds: [],
      soundCountryIds: [],
      finished: false,
      createdAt: new Date().toISOString()
    };
    state.tournament.teams.push(team);
    state.activeTeamKey = key;
    stopAllTimers();
    clearTransientUi();
    resetRoundState();
    buildAllGames();
  }
  saveTournament();
  refreshHeader();
  $("#teamName").value = "";
  showTemporaryTeamMessage(`¡Bienvenidos al juego, ${team.name}!`);
  renderCommitments();
  goToStation(0);
}

function buildNav(){
  const nav = $("#stationNav");
  nav.innerHTML = "";
  STATIONS.forEach(station => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "station-nav__btn";
    btn.textContent = station.label;
    btn.dataset.station = station.id;
    btn.addEventListener("click", () => goToStation(station.id));
    nav.appendChild(btn);
  });
}

function goToStation(id){
  const team = activeTeam();
  if(!isStationUnlocked(id)){
    refreshNavState();
    return;
  }
  $all(".station").forEach(section => section.classList.toggle("active", section.id === `station-${id}`));
  refreshNavState(id);
  updateMusicForStation(id);
}

function isStationUnlocked(id){
  const team = activeTeam();
  if(id === 0) return true;
  return Boolean(team && team.stamps.includes(id - 1));
}

function refreshNavState(activeId = currentStationId()){
  const team = activeTeam();
  $all(".station-nav__btn").forEach(btn => {
    const stationId = Number(btn.dataset.station);
    const unlocked = isStationUnlocked(stationId);
    btn.disabled = !unlocked;
    btn.classList.toggle("locked", !unlocked);
    btn.classList.toggle("active", stationId === activeId);
    btn.classList.toggle("done", Boolean(team && team.stamps.includes(stationId)));
  });
}

function refreshHeader(){
  const team = activeTeam();
  $("#teamName").value = team ? team.name : "";
  $("#scoreValue").textContent = team ? team.score : 0;
  $("#stampValue").textContent = `${team ? team.stamps.length : 0}/6`;
  $("#finalScore").textContent = team ? team.score : 0;
  $("#finalTeamName").textContent = team ? team.name : "Equipo sin nombre";
  showTeamMessage(team ? `Equipo guardado: ${team.name}. Máximo total: 100 puntos.` : "Cada nombre queda guardado en este PC y no se puede repetir.");
  updateCountryResult();
  refreshStampButtons();
  refreshNavState();
  updateFinalMessage();
}

function refreshStampButtons(){
  const team = activeTeam();
  $all(".stamp-btn").forEach(btn => {
    const id = Number(btn.dataset.station);
    const done = Boolean(team && team.stamps.includes(id));
    btn.textContent = done ? (id === 5 ? "Cierre sellado automáticamente" : "Estación sellada automáticamente") : "Sello automático";
  });
}

function startDrawTimer(){
  if(!ensureTeam() || isLocked("draw")) return;
  const team = activeTeam();
  if(!team.countryId){
    $("#drawStatus").textContent = "Primero deben sortear el país. Esta es la única estación con ese orden.";
    return;
  }
  state.draw = { active: true, awaitingScore: false, done: false };
  toggleDrawScoring(false);
  $("#startDrawBtn").disabled = true;
  $("#drawCountryBtn").disabled = true;
  $("#drawStatus").textContent = "Cronómetro activo: dibujen la bandera y escriban el nombre del país en 20 segundos.";
  startTimer("draw", 20, $("#drawTimer"), () => {
    state.draw.active = false;
    state.draw.awaitingScore = true;
    toggleDrawScoring(true);
    $("#drawStatus").textContent = "Tiempo terminado. Evalúen el dibujo y el nombre del país para sellar la estación.";
  });
}

function drawCountry(){
  const team = activeTeam();
  if(!ensureTeam()) return;
  if(isLocked("draw")){
    $("#drawStatus").textContent = "Esta actividad ya está cerrada.";
    return;
  }
  if(team.countryId){
    updateCountryResult();
    return;
  }
  const used = assignedCountryIds(team.key);
  const available = usageBalancedCountries("draw", used, 15);
  if(!available.length){
    showTeamMessage("Ya no quedan países disponibles. Finalicen o reinicien el juego.", true);
    return;
  }
  team.countryId = available[0].id;
  $("#drawStatus").textContent = "País asignado. Ahora activen el cronómetro para dibujar y escribir el nombre.";
  updateCountryResult();
  updateMusicForStation(currentStationId());
  saveTournament();
}

function toggleDrawScoring(enabled){
  const panel = $("#drawScoring");
  if(panel) panel.hidden = !enabled;
  $all(".draw-score-btn").forEach(btn => btn.disabled = !enabled);
}

function scoreDraw(value){
  if(!ensureTeam() || isLocked("draw") || !state.draw.awaitingScore) return;
  const score = Number(value);
  state.draw.awaitingScore = false;
  state.draw.done = true;
  toggleDrawScoring(false);
  setActivityScore("draw", score);
  lockActivity("draw");
  autoSealStation("draw");
  $("#drawStatus").textContent = `Estación sellada: ${score}/${ACTIVITY_MAX.draw} puntos por bandera y nombre del país.`;
}

function updateCountryResult(){
  const result = $("#countryDrawResult");
  const team = activeTeam();
  if(!team || !team.countryId){
    result.innerHTML = `<span class="country-result__placeholder">◌</span><strong>Esperando sorteo</strong><p>Guarden el nombre del equipo. Luego sorteen una bandera para dibujarla.</p>`;
    return;
  }
  const country = selectedCountry();
  result.innerHTML = `<img class="country-result__flag-img" src="${country.flagImage}" alt="Bandera para dibujar">`;
}

function clearTransientUi(){
  ["draw", "memory", "guess", "scenario", "sound", "commitment"].forEach(key => {
    const timer = $(`#${key}Timer`);
    if(timer) timer.textContent = "00";
  });
  $("#drawStatus").textContent = "Primero sorteen el país; después activen el cronómetro.";
  toggleDrawScoring(false);
  $("#startDrawBtn").disabled = false;
  $("#drawCountryBtn").disabled = false;
  $("#memoryStatus").textContent = "Pulsa iniciar ronda. Sin cronómetro las fichas están bloqueadas.";
  $("#guessStatus").textContent = "Pulsa nueva ronda para iniciar el cronómetro.";
  $("#scenarioStatus").textContent = "Elijan una tarjeta y respondan rápido.";
  $("#soundStatus").textContent = "Primero activen cronómetro. Las canciones se habilitan una por una.";
  $("#commitmentStatus").textContent = "Mínimo 5 frases para puntuar el cierre.";
  $("#guessInput").value = "";
  $("#guessInput").disabled = false;
  $("#checkGuessBtn").disabled = false;
  $("#guessFeedback").textContent = "";
  $("#commitmentInput").value = "";
  $("#countryAudioHint").textContent = "Archivos esperados: argentina.mp3, brasil.mp3, colombia.mp3, ecuador.mp3, haiti.mp3, mexico.mp3, panama.mp3, paraguay.mp3, peru.mp3 y uruguay.mp3.";
  const countryAudio = $("#countryAudio");
  if(countryAudio){
    countryAudio.pause();
    countryAudio.removeAttribute("src");
    countryAudio.load();
  }
}

function stampStation(id){
  const activity = ACTIVITY_BY_STATION[id];
  const statusMap = {
    draw: "#drawStatus",
    memory: "#memoryStatus",
    guess: "#guessStatus",
    scenario: "#scenarioStatus",
    sound: "#soundStatus",
    commitment: "#commitmentStatus"
  };
  const target = statusMap[activity];
  if(target) $(target).textContent = "El sello es automático: termina el tiempo o completa la actividad.";
}

function buildMemory(){
  const board = $("#memoryBoard");
  board.innerHTML = "";
  const countries = shuffledWithEntropy(COUNTRIES, 21).slice(0, 10);
  const mode = shuffledWithEntropy(["capital", "food"], 24)[0];
  const modeLabel = mode === "capital" ? "país-capital" : "país-comida típica";
  const cards = [];
  countries.forEach(country => {
    cards.push({ id: country.id, text: `${country.flag} ${country.name}` });
    cards.push({ id: country.id, text: mode === "capital" ? country.capital : country.food });
  });
  shuffledWithEntropy(cards, 22).forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "memory-card is-disabled";
    btn.dataset.id = card.id;
    btn.dataset.index = index;
    btn.innerHTML = `<span class="memory-card__back">?</span><span class="memory-card__front">${card.text}</span>`;
    btn.addEventListener("click", () => flipMemory(btn));
    board.appendChild(btn);
  });
  state.memory = { lock: false, first: null, matches: 0, active: false, done: false, mode };
  $("#memoryStatus").textContent = `Pulsa iniciar ronda. Esta vez jugarán memoria de ${modeLabel}.`;
}

function flipMemory(card){
  if(!state.memory.active || state.memory.done || state.memory.lock || card.classList.contains("matched") || card.classList.contains("open")) return;
  card.classList.add("open");
  if(!state.memory.first){
    state.memory.first = card;
    return;
  }
  const first = state.memory.first;
  state.memory.first = null;
  if(first.dataset.id === card.dataset.id){
    first.classList.add("matched");
    card.classList.add("matched");
    state.memory.matches += 1;
    $("#memoryStatus").textContent = `Parejas encontradas: ${state.memory.matches}/10`;
    if(state.memory.matches === 10) finishMemory(true);
  } else {
    state.memory.lock = true;
    setTimeout(() => {
      first.classList.remove("open");
      card.classList.remove("open");
      state.memory.lock = false;
    }, 650);
  }
}

function startMemory(){
  if(!ensureTeam() || isLocked("memory")) return;
  buildMemory();
  state.memory.active = true;
  state.memory.startedAt = Date.now();
  $all(".memory-card").forEach(card => card.classList.remove("is-disabled"));
  const label = state.memory.mode === "capital" ? "país-capital" : "país-comida típica";
  $("#memoryStatus").textContent = `Ronda activa: formen parejas de ${label} y celebren cada acierto.`;
  startTimer("memory", 120, $("#memoryTimer"), () => finishMemory(false));
}

function finishMemory(completed){
  state.memory.active = false;
  state.memory.done = true;
  clearTimer("memory");
  lockActivity("memory");
  $all(".memory-card").forEach(card => card.classList.add("is-disabled"));
  const elapsedMs = state.memory.startedAt ? Date.now() - state.memory.startedAt : 120000;
  const score = completed
    ? (elapsedMs <= 60000 ? ACTIVITY_MAX.memory : Math.round(ACTIVITY_MAX.memory / 2))
    : Math.round((state.memory.matches / 10) * ACTIVITY_MAX.memory);
  setActivityScore("memory", score);
  autoSealStation("memory");
  $("#memoryStatus").textContent = completed
    ? `Ronda completa: ${score}/20. ${elapsedMs <= 60000 ? "Lo lograron en el primer minuto." : "Lo lograron después del primer minuto."} Estación sellada automáticamente.`
    : `Tiempo terminado: ${score}/20. Estación sellada automáticamente.`;
}

function buildGuessRound(){
  if(!ensureTeam() || isLocked("guess")) return;
  const team = activeTeam();
  const teamCountry = selectedCountry();
  state.guess = {
    country: selectGuessCountry(teamCountry.id),
    active: true,
    done: false,
    revealed: 0,
    wrongAttempts: 0
  };
  team.guessCountryIds = [...new Set([...(team.guessCountryIds || []), state.guess.country.id])];
  saveTournament();
  $("#guessInput").value = "";
  $("#guessFeedback").textContent = "";
  $("#guessStatus").textContent = "Ronda activa: abran las pistas en orden. La bandera solo aparece al final.";
  const clues = [
    ...(state.guess.country.guessClues || [state.guess.country.clue]),
    `Bandera: ${state.guess.country.flag}`
  ];
  const clueGrid = $("#guessClues");
  clueGrid.innerHTML = "";
  clues.forEach((clue, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clue-card";
    btn.disabled = index !== 0;
    btn.innerHTML = `<span>Pista ${index + 1}</span><strong>?</strong>`;
    btn.addEventListener("click", () => revealGuessClue(btn, clue, index));
    clueGrid.appendChild(btn);
  });
  startTimer("guess", 30 + (activeTeam().seed % 16), $("#guessTimer"), () => finishGuess(false));
  updateMusicCountry(state.guess.country);
  if(audioEngine && audioEngine.enabled) audioEngine.setCountry(state.guess.country);
}

function selectGuessCountry(excludedCountryId = ""){
  while(true){
    if(!state.tournament.guessCountryQueue.length){
      refillGuessCountryQueue(new Set([excludedCountryId].filter(Boolean)));
    }
    const id = state.tournament.guessCountryQueue.shift();
    const country = countryById(id);
    if(country && country.id !== excludedCountryId){
      state.tournament.guessCountryHistory.push(country.id);
      state.tournament.guessCountryHistory = state.tournament.guessCountryHistory.slice(-30);
      saveTournament();
      return country;
    }
  }
}

function refillGuessCountryQueue(excludedIds = new Set()){
  const recent = new Set((state.tournament.guessCountryHistory || []).slice(-3));
  let pool = COUNTRIES.filter(country => !excludedIds.has(country.id) && !recent.has(country.id));
  if(!pool.length){
    pool = COUNTRIES.filter(country => !excludedIds.has(country.id));
  }
  state.tournament.guessCountryQueue = shuffledWithEntropy(pool, 41).map(country => country.id);
}

function revealGuessClue(btn, clue, index){
  if(!state.guess.active || state.guess.done || btn.classList.contains("revealed") || index !== state.guess.revealed) return;
  state.guess.revealed += 1;
  btn.classList.add("revealed");
  btn.innerHTML = `<span>Pista ${index + 1}</span><strong>${clue}</strong>`;
  $("#guessStatus").textContent = `Pistas abiertas: ${state.guess.revealed}. Intentos fallidos: ${state.guess.wrongAttempts || 0}. Puntaje posible: ${guessPotentialScore()}/20`;
  const next = $all(".clue-card")[state.guess.revealed];
  if(next) next.disabled = false;
}

function guessPotentialScore(){
  const r = Math.max(1, state.guess.revealed);
  let base = 3;
  if(r <= 2) base = 20;
  else if(r === 3) base = 15;
  else if(r === 4) base = 10;
  else if(r === 5) base = 5;
  const wrongPenalty = (state.guess.wrongAttempts || 0) * 3;
  return Math.max(0, base - wrongPenalty);
}

function checkGuess(){
  if(!state.guess.active || state.guess.done || !state.guess.country) return;
  const guess = normalize($("#guessInput").value);
  const answer = normalize(state.guess.country.name);
  if(guess && (guess === answer || answer.includes(guess))){
    finishGuess(true);
  } else {
    state.guess.wrongAttempts = (state.guess.wrongAttempts || 0) + 1;
    $("#guessFeedback").textContent = `Intento fallido ${state.guess.wrongAttempts}: se descuentan 3 puntos. Consulten al equipo antes de volver a responder.`;
    $("#guessStatus").textContent = `Pistas abiertas: ${state.guess.revealed}. Intentos fallidos: ${state.guess.wrongAttempts}. Puntaje posible: ${guessPotentialScore()}/20`;
    $("#guessInput").value = "";
  }
}

function finishGuess(success){
  clearTimer("guess");
  state.guess.active = false;
  state.guess.done = true;
  lockActivity("guess");
  $all(".clue-card").forEach(card => card.classList.add("is-disabled"));
  $("#guessInput").disabled = true;
  $("#checkGuessBtn").disabled = true;
  const score = success ? guessPotentialScore() : 0;
  setActivityScore("guess", score);
  autoSealStation("guess");
  $("#guessFeedback").textContent = success
    ? `Correcto: ${state.guess.country.flag} ${state.guess.country.name}. Puntaje: ${score}/20. Estación sellada.`
    : `Tiempo. Era ${state.guess.country.flag} ${state.guess.country.name}. Puntaje: 0/20. Estación sellada.`;
}

function buildGuessRoundPreview(){
  $("#guessClues").innerHTML = "";
  $("#guessFeedback").textContent = "";
  $("#guessStatus").textContent = "Pulsa nueva ronda para iniciar el cronómetro.";
  $("#guessTimer").textContent = "00";
  $("#guessInput").disabled = false;
  $("#checkGuessBtn").disabled = false;
}

function buildScenarios(){
  const deck = $("#scenarioDeck");
  deck.innerHTML = "";
  state.scenario = { active: false, done: false, opened: new Set(), answered: new Set(), correct: new Set() };
  shuffledWithEntropy(SCENARIOS, 61).slice(0, 6).forEach((scenario, index) => {
    const card = document.createElement("article");
    card.className = "scenario-card is-disabled";
    card.dataset.index = index;
    card.innerHTML = `
      <span>Ficha ${index + 1}</span>
      <strong>?</strong>
      <p>${scenario.prompt}</p>
      <div class="scenario-options"></div>
    `;
    const options = card.querySelector(".scenario-options");
    const mixedOptions = shuffledWithEntropy(scenario.options.map((option, optionIndex) => ({ option, optionIndex })), 70 + index);
    mixedOptions.forEach(({ option, optionIndex }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scenario-option";
      btn.dataset.correct = String(optionIndex === scenario.correct);
      btn.textContent = option;
      btn.addEventListener("click", event => {
        event.stopPropagation();
        answerScenarioCard(card, btn, scenario, optionIndex);
      });
      options.appendChild(btn);
    });
    card.addEventListener("click", () => openScenarioCard(card));
    deck.appendChild(card);
  });
}

function startScenarioTimer(){
  if(!ensureTeam() || isLocked("scenario")) return;
  buildScenarios();
  state.scenario.active = true;
  $all(".scenario-card").forEach(card => card.classList.remove("is-disabled"));
  $("#scenarioStatus").textContent = "Ronda activa: tienen 1 minuto y medio para abrir fichas y elegir respuestas correctas.";
  startTimer("scenario", 90, $("#scenarioTimer"), finishScenario);
}

function openScenarioCard(card){
  if(!state.scenario.active || state.scenario.done || card.classList.contains("open")) return;
  card.classList.add("open");
  state.scenario.opened.add(card.dataset.index);
  $("#scenarioStatus").textContent = `Fichas abiertas: ${state.scenario.opened.size}/6. Ahora seleccionen la opción correcta.`;
}

function answerScenarioCard(card, btn, scenario, optionIndex){
  if(!state.scenario.active || state.scenario.done || !card.classList.contains("open") || state.scenario.answered.has(card.dataset.index)) return;
  state.scenario.answered.add(card.dataset.index);
  card.classList.add("answered");
  card.querySelectorAll(".scenario-option").forEach(optionBtn => optionBtn.disabled = true);
  if(optionIndex === scenario.correct){
    state.scenario.correct.add(card.dataset.index);
    btn.classList.add("correct");
  } else {
    btn.classList.add("wrong");
    [...card.querySelectorAll(".scenario-option")].find(optionBtn => optionBtn.dataset.correct === "true")?.classList.add("correct");
  }
  $("#scenarioStatus").textContent = `Fichas respondidas: ${state.scenario.answered.size}/6. Correctas: ${state.scenario.correct.size}.`;
  if(state.scenario.answered.size === 6) finishScenario();
}

function finishScenario(){
  clearTimer("scenario");
  state.scenario.active = false;
  state.scenario.done = true;
  lockActivity("scenario");
  $all(".scenario-card").forEach(card => card.classList.add("is-disabled"));
  const score = Math.round((state.scenario.correct.size / 6) * ACTIVITY_MAX.scenario);
  setActivityScore("scenario", score);
  autoSealStation("scenario");
  $("#scenarioStatus").textContent = `Actividad cerrada y sellada: ${score}/20 por ${state.scenario.correct.size} respuestas correctas. Las fichas no abiertas o no respondidas no suman.`;
}

function startSoundGame(){
  if(!ensureTeam() || isLocked("sound")) return;
  buildSoundChallenge(true);
  preloadSoundTracks(state.sound.tracks || []);
  state.sound.active = true;
  state.sound.resumeGeneralAfter = false;
  activateSoundCard(0);
  $("#soundStatus").textContent = "Ronda activa: reproduzcan la primera canción. Solo hay una oportunidad por canción.";
  startTimer("sound", 25, $("#soundTimer"), finishSoundGame);
}

function buildSoundChallenge(persistTracks = false){
  const container = $("#soundChallenge");
  container.innerHTML = "";
  state.sound = { active: false, done: false, opened: new Set(), correct: new Set(), currentIndex: 0, resumeGeneralAfter: state.sound.resumeGeneralAfter || false, tracks: [] };
  const tracks = persistTracks ? selectSoundTracks() : previewSoundTracks();
  state.sound.tracks = tracks.map(country => country.id);
  const team = activeTeam();
  if(team && persistTracks){
    team.soundTrackIds = [...new Set([...(team.soundTrackIds || []), ...state.sound.tracks])];
    team.soundCountryIds = [...new Set([...(team.soundCountryIds || []), ...state.sound.tracks])];
    saveTournament();
  }
  tracks.forEach((country, index) => {
    const card = document.createElement("article");
    card.className = "sound-card is-disabled";
    card.dataset.index = index;
    card.innerHTML = `
      <span>♪</span>
      <strong>Canción ${index + 1}</strong>
      <p>Reproduce el audio y elige una bandera.</p>
      <button class="action-btn action-btn--small play-track" type="button">Reproducir</button>
      <div class="sound-options"></div>
    `;
    card.querySelector(".play-track").addEventListener("click", event => playMusicTrack(country, index, event.currentTarget));
    const options = card.querySelector(".sound-options");
    shuffledWithEntropy(COUNTRIES, 91 + index).forEach(option => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sound-option";
      btn.textContent = `${option.flag} ${option.name}`;
      btn.addEventListener("click", () => answerSoundTrack(card, btn, country, option));
      options.appendChild(btn);
    });
    container.appendChild(card);
  });
}

function selectSoundTracks(){
  const selected = [];
  const selectedIds = new Set();
  while(selected.length < 3){
    if(!state.tournament.soundCountryQueue.length){
      refillSoundCountryQueue(selectedIds);
    }
    const id = state.tournament.soundCountryQueue.shift();
    const country = countryById(id);
    if(!country || selectedIds.has(id)) continue;
    selected.push(country);
    selectedIds.add(id);
    state.tournament.soundCountryHistory.push(id);
  }
  state.tournament.soundCountryHistory = state.tournament.soundCountryHistory.slice(-30);
  saveTournament();
  return selected;
}

function previewSoundTracks(){
  return shuffledWithEntropy(COUNTRIES, 80).slice(0, 3);
}

function refillSoundCountryQueue(excludedIds = new Set()){
  const recent = new Set((state.tournament.soundCountryHistory || []).slice(-3));
  let pool = COUNTRIES.filter(country => !excludedIds.has(country.id) && !recent.has(country.id));
  if(pool.length < 3){
    pool = COUNTRIES.filter(country => !excludedIds.has(country.id));
  }
  state.tournament.soundCountryQueue = shuffledWithEntropy(pool, 83).map(country => country.id);
}

function preloadSoundTracks(countryIds){
  countryIds.forEach(id => {
    if(soundAudioCache.has(id)) return;
    const audio = new Audio(`assets/music/${id}.mp3`);
    audio.preload = "auto";
    audio.load();
    soundAudioCache.set(id, audio);
  });
}

async function playMusicTrack(country, index, triggerBtn){
  if(!state.sound.active || state.sound.done || index !== state.sound.currentIndex) return;
  const audio = $("#countryAudio");
  const token = ++countryAudioToken;
  state.sound.resumeGeneralAfter = state.sound.resumeGeneralAfter || isGeneralMusicPlaying();
  pauseGeneralMusic();
  if(audioEngine && audioEngine.enabled) audioEngine.stop();
  if(!audio){
    $("#countryAudioHint").textContent = `No encontré el reproductor de la canción ${index + 1}. Uso música generada sin revelar el país.`;
    await startGeneratedAudio();
    ensureAudio().setCountry(country);
    return;
  }
  if(audio){
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    const cached = soundAudioCache.get(country.id);
    audio.src = cached ? cached.src : `assets/music/${country.id}.mp3`;
    audio.preload = "auto";
    audio.volume = 1;
    audio.currentTime = 0;
    audio.load();
  }
  if(triggerBtn) triggerBtn.disabled = true;
  $("#countryAudioHint").textContent = `Canción ${index + 1}: cargando audio local...`;
  try {
    await audio.play();
    if(token !== countryAudioToken) return;
    $("#countryAudioHint").textContent = `Canción ${index + 1}: reproduciendo audio local.`;
  } catch(error) {
    if(token !== countryAudioToken) return;
    $("#countryAudioHint").textContent = `No encontré el MP3 de la canción ${index + 1}. Uso música generada sin revelar el país.`;
    await startGeneratedAudio();
    ensureAudio().setCountry(country);
  } finally {
    if(triggerBtn && state.sound.active && !state.sound.done && index === state.sound.currentIndex){
      triggerBtn.disabled = false;
    }
  }
}

function answerSoundTrack(card, btn, targetCountry, option){
  const cardIndex = Number(card.dataset.index);
  if(!state.sound.active || state.sound.done || cardIndex !== state.sound.currentIndex || state.sound.opened.has(card.dataset.index)) return;
  stopCurrentCountryAudio();
  state.sound.opened.add(card.dataset.index);
  card.classList.add("done");
  card.querySelectorAll(".sound-option").forEach(optionBtn => optionBtn.disabled = true);
  if(option.id === targetCountry.id){
    state.sound.correct.add(card.dataset.index);
    btn.classList.add("correct");
  } else {
    btn.classList.add("wrong");
    [...card.querySelectorAll(".sound-option")].find(optionBtn => optionBtn.textContent.includes(targetCountry.name))?.classList.add("correct");
  }
  const nextIndex = cardIndex + 1;
  if(nextIndex >= 3){
    $("#soundStatus").textContent = `Canciones respondidas: 3/3. Aciertos: ${state.sound.correct.size}.`;
    finishSoundGame();
  } else {
    state.sound.currentIndex = nextIndex;
    activateSoundCard(nextIndex);
    $("#soundStatus").textContent = `Canción ${cardIndex + 1} respondida. Ahora se habilita la canción ${nextIndex + 1}.`;
  }
}

function activateSoundCard(index){
  $all(".sound-card").forEach(card => {
    const cardIndex = Number(card.dataset.index);
    const active = cardIndex === index;
    card.classList.toggle("is-disabled", !active || card.classList.contains("done"));
    card.querySelectorAll("button").forEach(btn => {
      if(!card.classList.contains("done")) btn.disabled = !active;
    });
  });
}

function stopCurrentCountryAudio(){
  countryAudioToken += 1;
  const audio = $("#countryAudio");
  if(audio){
    audio.pause();
    audio.currentTime = 0;
  }
  if(audioEngine && audioEngine.enabled){
    audioEngine.stop();
  }
}

function finishSoundGame(){
  clearTimer("sound");
  state.sound.active = false;
  state.sound.done = true;
  stopSoundActivityAudio();
  lockActivity("sound");
  $all(".sound-card").forEach(card => card.classList.add("is-disabled"));
  const score = Math.round((state.sound.correct.size / 3) * ACTIVITY_MAX.sound);
  setActivityScore("sound", score);
  autoSealStation("sound");
  $("#soundStatus").textContent = `Actividad cerrada y sellada: ${score}/15 por ${state.sound.correct.size} canciones correctas.`;
}

function stopSoundActivityAudio(){
  countryAudioToken += 1;
  const audio = $("#countryAudio");
  if(audio){
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  if(audioEngine && audioEngine.enabled){
    audioEngine.stop();
  }
  $("#countryAudioHint").textContent = "Actividad musical finalizada: audio detenido.";
  if(state.sound.resumeGeneralAfter){
    playGeneralMusic();
    state.sound.resumeGeneralAfter = false;
  }
}

function renderCommitments(){
  const team = activeTeam();
  const list = $("#commitmentList");
  list.innerHTML = "";
  const items = team && team.commitments.length ? team.commitments : [];
  items.forEach(text => {
    const item = document.createElement("div");
    item.className = "commitment";
    item.textContent = text;
    list.appendChild(item);
  });
}

function startCommitment(){
  if(!ensureTeam() || isLocked("commitment")) return;
  state.commitment = { active: true, done: false };
  $("#commitmentStatus").textContent = "Ronda activa: mínimo 5 frases, cada una al balón colectivo.";
  startTimer("commitment", 60, $("#commitmentTimer"), finishCommitment);
}

function addCommitment(){
  const team = activeTeam();
  if(!team || !state.commitment.active || state.commitment.done || isLocked("commitment")){
    $("#commitmentStatus").textContent = "Primero activen el cronómetro del cierre.";
    return;
  }
  const input = $("#commitmentInput");
  const text = input.value.trim();
  if(!text) return;
  team.commitments.unshift(text);
  input.value = "";
  renderCommitments();
  $("#commitmentStatus").textContent = `Frases en el balón: ${team.commitments.length}/5 mínimo.`;
  if(team.commitments.length >= 5) finishCommitment();
  saveTournament();
}

function finishCommitment(){
  const team = activeTeam();
  if(!team || state.commitment.done || isLocked("commitment")) return;
  clearTimer("commitment");
  state.commitment.active = false;
  state.commitment.done = true;
  lockActivity("commitment");
  const score = team.commitments.length >= 5 ? ACTIVITY_MAX.commitment : Math.round((team.commitments.length / 5) * ACTIVITY_MAX.commitment);
  setActivityScore("commitment", score);
  autoSealStation("commitment");
  $("#commitmentStatus").textContent = team.commitments.length >= 5
    ? "Cierre completo: 20/20. Estación sellada automáticamente."
    : `Tiempo terminado: ${score}/20 por ${team.commitments.length} frases. Estación sellada.`;
  showFinishCelebration();
}

function showFinishCelebration(){
  const modal = $("#finishCelebration");
  if(!modal) return;
  modal.hidden = false;
  modal.classList.remove("celebration--burst");
  void modal.offsetWidth;
  modal.classList.add("celebration--burst");
}

function closeFinishCelebration(){
  const modal = $("#finishCelebration");
  if(modal) modal.hidden = true;
}

function updateFinalMessage(){
  const team = activeTeam();
  const msg = $("#finalMessage");
  const score = team ? team.score : 0;
  if(score >= 85) msg.textContent = "Copa levantada: rapidez, respeto, movimiento y escucha activa.";
  else if(score >= 55) msg.textContent = "Buen partido intercultural. Aún pueden mejorar participación y cierre colectivo.";
  else msg.textContent = "Completen actividades con cronómetro para sumar hasta 100 puntos.";
}

function startTimer(key, seconds, el, onDone){
  clearTimer(key);
  let remaining = seconds;
  el.textContent = String(remaining).padStart(2, "0");
  state.timers[key] = setInterval(() => {
    remaining -= 1;
    el.textContent = String(Math.max(remaining, 0)).padStart(2, "0");
    if(remaining <= 0){
      clearTimer(key);
      onDone();
    }
  }, 1000);
}

function clearTimer(key){
  if(state.timers[key]) clearInterval(state.timers[key]);
  state.timers[key] = null;
}

function stopAllTimers(){
  Object.keys(state.timers).forEach(clearTimer);
}

function currentStationId(){
  const active = $(".station.active");
  return active ? Number(active.id.replace("station-", "")) : 0;
}

class ProceduralAudio {
  constructor(){
    this.context = null;
    this.master = null;
    this.interval = null;
    this.enabled = false;
    this.country = null;
    this.step = 0;
  }

  async start(){
    if(!this.context){
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.context.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.context.destination);
    }
    await this.context.resume();
    this.enabled = true;
    this.playLoop();
    this.tick();
  }

  stop(){
    this.enabled = false;
    if(this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  setCountry(country){
    this.country = country;
    this.step = 0;
    if(this.enabled){
      this.playLoop();
      this.tick();
    }
  }

  playLoop(){
    if(this.interval) clearInterval(this.interval);
    const tempo = this.country ? this.country.music.tempo : 92;
    this.interval = setInterval(() => this.tick(), Math.max(150, 60000 / tempo / 2));
  }

  tick(){
    if(!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const scale = this.country ? this.country.music.scale : [262, 330, 392, 494, 523];
    const note = scale[this.step % scale.length];
    const accent = this.step % 4 === 0;
    this.tone(note, now, 0.16, accent ? 0.18 : 0.09, accent ? "square" : "sine");
    if(this.step % 2 === 0) this.percussion(now, this.country ? this.country.music.drum : "general", accent);
    this.step = (this.step + 1) % 16;
  }

  tone(freq, when, duration, gainValue, type){
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain).connect(this.master);
    osc.start(when);
    osc.stop(when + duration + 0.04);
  }

  percussion(when, drum, accent){
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const baseMap = { cumbia: 150, tango: 120, samba: 210, cueca: 170, festejo: 190, sanjuanito: 145, morenada: 125, polca: 180, candombe: 165, joropo: 200, tamborito: 185, calipso: 155, son: 132, punta: 215, xuc: 175, sonnica: 150, mariachi: 188, kompa: 156, general: 140 };
    const base = baseMap[drum] || 150;
    osc.type = accent ? "square" : "triangle";
    osc.frequency.setValueAtTime(base, when);
    osc.frequency.exponentialRampToValueAtTime(58, when + 0.11);
    gain.gain.setValueAtTime(accent ? 0.22 : 0.12, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    osc.connect(gain).connect(this.master);
    osc.start(when);
    osc.stop(when + 0.14);
  }

  victory(){
    if(!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    [392, 523, 659, 784, 1046].forEach((freq, i) => this.tone(freq, now + i * 0.16, 0.24, 0.20, "triangle"));
    [120, 160, 210].forEach((freq, i) => this.percussion(now + i * 0.18, "general", true));
  }
}

function ensureAudio(){
  if(!audioEngine) audioEngine = new ProceduralAudio();
  return audioEngine;
}

async function startGeneratedAudio(){
  const engine = ensureAudio();
  try{
    await engine.start();
    updateMusicForStation(currentStationId());
    return true;
  } catch(error){
    return false;
  }
}

function updateMusicCountry(country){
  const activeCountry = country || selectedCountry();
  $("#musicCountryFlag").textContent = activeCountry.flag;
  $("#musicCountryName").textContent = `${activeCountry.flag} ${activeCountry.name} · ${activeCountry.rhythm}`;
  $("#musicCountryText").textContent = activeCountry.value;
}

function updateMusicForStation(id){
  const team = activeTeam();
  if(id >= 1 && id <= 5 && team){
    if(id === 4){
      $("#musicCountryFlag").textContent = "♪";
      $("#musicCountryName").textContent = "Adivina el país por la música";
      $("#musicCountryText").textContent = "Opciones: Argentina, Brasil, Colombia, Ecuador, Haití, México, Panamá, Paraguay, Perú y Uruguay.";
      if(audioEngine) audioEngine.setCountry(null);
    } else {
      const country = id === 2 && state.guess.country ? state.guess.country : selectedCountry();
      updateMusicCountry(country);
      if(audioEngine) audioEngine.setCountry(country);
    }
  } else {
    $("#musicCountryFlag").textContent = "♪";
    $("#musicCountryName").textContent = "Música general";
    $("#musicCountryText").textContent = "En la actividad musical puedes usar MP3 por país o música generada.";
    if(audioEngine) audioEngine.setCountry(null);
  }
}

async function toggleSound(){
  if(isGeneralMusicPlaying()){
    pauseGeneralMusic();
    $("#soundToggle").setAttribute("aria-pressed", "false");
    $("#soundLabel").textContent = "Activar música";
  } else {
    await playGeneralMusic();
  }
}

function isGeneralMusicPlaying(){
  const audio = $("#generalMusic");
  return Boolean(audio && !audio.paused);
}

async function playGeneralMusic(){
  const audio = $("#generalMusic");
  if(!audio) return false;
  try{
    audio.loop = true;
    await audio.play();
    $("#soundToggle").setAttribute("aria-pressed", "true");
    $("#soundLabel").textContent = "Pausar música";
    return true;
  } catch(error){
    $("#soundLabel").textContent = "Audio bloqueado";
    return false;
  }
}

function pauseGeneralMusic(){
  const audio = $("#generalMusic");
  if(audio) audio.pause();
}

function shouldResumeGeneralMusic(){
  const toggle = $("#soundToggle");
  const generalWasEnabled = isGeneralMusicPlaying() || Boolean(toggle && toggle.getAttribute("aria-pressed") === "true");
  return generalWasEnabled && !state.sound.active;
}

function pauseAudioForPageExit(){
  if(shouldResumeGeneralMusic()){
    resumeGeneralMusicOnReturn = true;
  }
  pauseGeneralMusic();
  stopCurrentCountryAudio();
  if(audioEngine && audioEngine.enabled){
    audioEngine.stop();
  }
}

function resumeAudioAfterPageReturn(){
  if(!resumeGeneralMusicOnReturn) return;
  if(document.hidden) return;
  resumeGeneralMusicOnReturn = false;
  playGeneralMusic();
}

function handleVisibilityChange(){
  if(document.hidden){
    pauseAudioForPageExit();
  } else {
    resumeAudioAfterPageReturn();
  }
}

function wirePageAudioLifecycle(){
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("freeze", pauseAudioForPageExit);
  document.addEventListener("resume", resumeAudioAfterPageReturn);
  window.addEventListener("pagehide", pauseAudioForPageExit);
  window.addEventListener("pageshow", resumeAudioAfterPageReturn);
  window.addEventListener("blur", pauseAudioForPageExit);
  window.addEventListener("focus", resumeAudioAfterPageReturn);
}

function finishGame(){
  const team = activeTeam();
  if(team) team.finished = true;
  saveTournament();
  renderLeaderboard();
  $("#leaderboardModal").hidden = false;
  startGeneratedAudio().then(() => {
    ensureAudio().setCountry(null);
    ensureAudio().victory();
  });
}

function renderLeaderboard(){
  const list = $("#leaderboardList");
  list.innerHTML = "";
  const teams = [...state.tournament.teams].sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
  if(!teams.length){
    list.innerHTML = `<div class="leaderboard-empty">Todavía no hay equipos guardados.</div>`;
    return;
  }
  teams.forEach((team, index) => {
    const country = countryById(team.countryId);
    const row = document.createElement("article");
    row.className = "leaderboard-card";
    row.innerHTML = `
      <span class="leaderboard-card__rank">${index + 1}</span>
      <span class="leaderboard-card__flag">${country ? country.flag : "◌"}</span>
      <div><h3>${team.name}</h3><p>${country ? country.name : "País sin sortear"}</p></div>
      <strong>${team.score}/100</strong>
    `;
    list.appendChild(row);
  });
}

function resetGame(){
  const restartGeneralMusic = isGeneralMusicPlaying();
  stopAllTimers();
  if(audioEngine) audioEngine.stop();
  pauseGeneralMusic();
  const generalAudio = $("#generalMusic");
  if(generalAudio) generalAudio.currentTime = 0;
  const countryAudio = $("#countryAudio");
  if(countryAudio){
    countryAudio.pause();
    countryAudio.removeAttribute("src");
    countryAudio.load();
  }
  localStorage.removeItem(STORAGE_KEY);
  state.activeTeamKey = "";
  state.tournament = { teams: [], guessCountryQueue: [], guessCountryHistory: [], soundCountryQueue: [], soundCountryHistory: [] };
  resetRoundState();
  $("#leaderboardModal").hidden = true;
  closeFinishCelebration();
  buildAllGames();
  refreshHeader();
  goToStation(0);
  $("#soundToggle").setAttribute("aria-pressed", "false");
  $("#soundLabel").textContent = "Activar música";
  if(restartGeneralMusic){
    playGeneralMusic();
  }
}

function resetRoundState(){
  state.draw = { active: false, awaitingScore: false, done: false };
  state.memory = { lock: false, first: null, matches: 0, active: false, done: false };
  state.guess = { country: null, active: false, done: false, revealed: 0, wrongAttempts: 0 };
  state.scenario = { active: false, done: false, opened: new Set(), answered: new Set(), correct: new Set() };
  state.sound = { active: false, done: false, opened: new Set(), correct: new Set(), currentIndex: 0, resumeGeneralAfter: false };
  state.commitment = { active: false, done: false };
}

function buildAllGames(){
  updateCountryResult();
  buildMemory();
  buildGuessRoundPreview();
  buildScenarios();
  buildSoundChallenge();
  renderCommitments();
}

function wireEvents(){
  $("#saveTeamBtn").addEventListener("click", saveTeam);
  $("#teamName").addEventListener("keydown", event => { if(event.key === "Enter") saveTeam(); });
  $("#startDrawBtn").addEventListener("click", startDrawTimer);
  $("#drawCountryBtn").addEventListener("click", drawCountry);
  $all(".draw-score-btn").forEach(btn => btn.addEventListener("click", () => scoreDraw(btn.dataset.score)));
  $("#startMemoryBtn").addEventListener("click", startMemory);
  $("#startGuessBtn").addEventListener("click", buildGuessRound);
  $("#checkGuessBtn").addEventListener("click", checkGuess);
  $("#guessInput").addEventListener("keydown", event => { if(event.key === "Enter") checkGuess(); });
  $("#startScenarioBtn").addEventListener("click", startScenarioTimer);
  $("#startSoundGameBtn").addEventListener("click", startSoundGame);
  $("#startCommitmentBtn").addEventListener("click", startCommitment);
  $("#addCommitmentBtn").addEventListener("click", addCommitment);
  $("#commitmentInput").addEventListener("keydown", event => { if(event.key === "Enter") addCommitment(); });
  $("#soundToggle").addEventListener("click", toggleSound);
  $("#finishGameBtn").addEventListener("click", finishGame);
  $("#resetGameBtn").addEventListener("click", resetGame);
  $("#closeCelebrationBtn").addEventListener("click", closeFinishCelebration);
  $all(".stamp-btn").forEach(btn => btn.addEventListener("click", () => stampStation(Number(btn.dataset.station))));
}

function init(){
  loadTournament();
  buildNav();
  wireEvents();
  wirePageAudioLifecycle();
  buildAllGames();
  refreshHeader();
  goToStation(0);
}

document.addEventListener("DOMContentLoaded", init);
