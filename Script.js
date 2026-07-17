const STORAGE_KEY = "copa-intercultural-torneo-v7";
const ACTIVITY_MAX = { draw: 5, memory: 20, guess: 20, scenario: 20, sound: 15, commitment: 20 };
const ACTIVITY_BY_STATION = ["draw", "memory", "guess", "scenario", "sound", "commitment"];
const STATIONS = [
  { id: 0, label: "1 Sorteo" },
  { id: 1, label: "2 Memoria" },
  { id: 2, label: "3 Adivina" },
  { id: 3, label: "4 Convivencia" },
  { id: 4, label: "5 Musica" },
  { id: 5, label: "6 Cierre" }
];

const state = {
  activeTeamKey: "",
  tournament: { teams: [] },
  memory: { lock: false, first: null, matches: 0, active: false, done: false },
  guess: { country: null, active: false, done: false, revealed: 0 },
  scenario: { active: false, done: false, opened: new Set(), answered: new Set(), correct: new Set() },
  sound: { active: false, done: false, opened: new Set(), currentIndex: 0, resumeGeneralAfter: false },
  commitment: { active: false, done: false },
  timers: {}
};

let audioEngine = null;

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

function freshSeed(name){
  return (hashText(name) ^ Date.now() ^ Math.floor(Math.random() * 900000)) >>> 0;
}

function newScores(){
  return { draw: 0, memory: 0, guess: 0, scenario: 0, sound: 0, commitment: 0 };
}

function newLocks(){
  return { draw: false, memory: false, guess: false, scenario: false, sound: false, commitment: false };
}

function loadTournament(){
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  state.tournament = saved.tournament || { teams: [] };
  state.activeTeamKey = saved.activeTeamKey || "";
  state.tournament.teams.forEach(team => {
    team.activityScores = { ...newScores(), ...(team.activityScores || {}) };
    team.activityLocked = { ...newLocks(), ...(team.activityLocked || {}) };
    team.stamps = team.stamps || [];
    team.commitments = team.commitments || [];
    team.score = totalScore(team);
  });
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
}

function ensureTeam(){
  if(activeTeam()) return true;
  showTeamMessage("Guarden el equipo antes de iniciar actividades.", true);
  return false;
}

function saveTeam(){
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
  showTeamMessage(team ? `Equipo guardado: ${team.name}. Maximo total: 100 puntos.` : "Cada nombre queda guardado en este PC y no se puede repetir.");
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
    btn.textContent = done ? (id === 5 ? "Cierre sellado automaticamente" : "Estacion sellada automaticamente") : "Sello automatico";
  });
}

function startDrawTimer(){
  if(!ensureTeam() || isLocked("draw")) return;
  const team = activeTeam();
  if(!team.countryId){
    $("#drawStatus").textContent = "Primero deben sortear el pais. Esta es la unica estacion con ese orden.";
    return;
  }
  $("#drawStatus").textContent = "Cronometro activo: celebren la bandera, organicen grito de equipo y esperen el sello.";
  startTimer("draw", 20, $("#drawTimer"), () => {
    setActivityScore("draw", ACTIVITY_MAX.draw);
    lockActivity("draw");
    autoSealStation("draw");
    $("#drawStatus").textContent = "Tiempo terminado. Estacion sellada automaticamente.";
  });
}

function drawCountry(){
  const team = activeTeam();
  if(!ensureTeam()) return;
  if(isLocked("draw")){
    $("#drawStatus").textContent = "Esta actividad ya esta cerrada.";
    return;
  }
  if(team.countryId){
    updateCountryResult();
    return;
  }
  const used = assignedCountryIds(team.key);
  const available = shuffled(COUNTRIES, 15).filter(country => !used.has(country.id));
  if(!available.length){
    showTeamMessage("Ya no quedan paises disponibles. Finalicen o reinicien el juego.", true);
    return;
  }
  team.countryId = available[0].id;
  $("#drawStatus").textContent = "Pais asignado. Ahora activen el cronometro para completar y sellar.";
  updateCountryResult();
  updateMusicForStation(currentStationId());
  saveTournament();
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
  $("#drawStatus").textContent = "Primero sorteen el pais; despues activen el cronometro para sellar automaticamente.";
  $("#memoryStatus").textContent = "Pulsa iniciar ronda. Sin cronometro las fichas de pais-capital estan bloqueadas.";
  $("#guessStatus").textContent = "Pulsa nueva ronda para iniciar el cronometro.";
  $("#scenarioStatus").textContent = "Elijan una tarjeta y respondan rapido.";
  $("#soundStatus").textContent = "Primero activen cronometro. Las canciones se habilitan una por una.";
  $("#commitmentStatus").textContent = "Minimo 5 frases para puntuar el cierre.";
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
  if(target) $(target).textContent = "El sello es automatico: termina el tiempo o completa la actividad.";
}

function buildMemory(){
  const board = $("#memoryBoard");
  board.innerHTML = "";
  const countries = shuffled(COUNTRIES, 21).slice(0, 10);
  const cards = [];
  countries.forEach(country => {
    cards.push({ id: country.id, text: `${country.flag} ${country.name}` });
    cards.push({ id: country.id, text: country.capital });
  });
  shuffled(cards, 22).forEach((card, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "memory-card is-disabled";
    btn.dataset.id = card.id;
    btn.dataset.index = index;
    btn.innerHTML = `<span class="memory-card__back">?</span><span class="memory-card__front">${card.text}</span>`;
    btn.addEventListener("click", () => flipMemory(btn));
    board.appendChild(btn);
  });
  state.memory = { lock: false, first: null, matches: 0, active: false, done: false };
  $("#memoryStatus").textContent = "Pulsa iniciar ronda. Sin cronometro las fichas de pais-capital estan bloqueadas.";
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
  $("#memoryStatus").textContent = "Ronda activa: formen parejas pais-capital y griten la capital al encontrarla.";
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
    ? `Ronda completa: ${score}/20. ${elapsedMs <= 60000 ? "Lo lograron en el primer minuto." : "Lo lograron despues del primer minuto."} Estacion sellada automaticamente.`
    : `Tiempo terminado: ${score}/20. Estacion sellada automaticamente.`;
}

function buildGuessRound(){
  if(!ensureTeam() || isLocked("guess")) return;
  const teamCountry = selectedCountry();
  const candidates = shuffled(COUNTRIES, 41).filter(country => country.id !== teamCountry.id);
  state.guess = {
    country: shuffled([teamCountry, ...candidates.slice(0, 9)], Date.now() % 100000)[0],
    active: true,
    done: false,
    revealed: 0
  };
  $("#guessInput").value = "";
  $("#guessFeedback").textContent = "";
  $("#guessStatus").textContent = "Ronda activa: cada pista desde la tercera baja el puntaje.";
  const clues = [
    `Bandera: ${state.guess.country.flag}`,
    `Region: ${state.guess.country.region}`,
    `Saludo: ${state.guess.country.greeting}`,
    `Comida: ${state.guess.country.food}`,
    `Musica: ${state.guess.country.rhythm}`,
    `Lenguas: ${state.guess.country.language}`
  ];
  const clueGrid = $("#guessClues");
  clueGrid.innerHTML = "";
  shuffled(clues, 43).forEach((clue, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clue-card";
    btn.innerHTML = `<span>Pista ${index + 1}</span><strong>?</strong>`;
    btn.addEventListener("click", () => revealGuessClue(btn, clue, index));
    clueGrid.appendChild(btn);
  });
  startTimer("guess", 30 + (activeTeam().seed % 16), $("#guessTimer"), () => finishGuess(false));
  updateMusicCountry(state.guess.country);
  if(audioEngine && audioEngine.enabled) audioEngine.setCountry(state.guess.country);
}

function revealGuessClue(btn, clue, index){
  if(!state.guess.active || state.guess.done || btn.classList.contains("revealed")) return;
  state.guess.revealed += 1;
  btn.classList.add("revealed");
  btn.innerHTML = `<span>Pista ${index + 1}</span><strong>${clue}</strong>`;
  $("#guessStatus").textContent = `Pistas abiertas: ${state.guess.revealed}. Puntaje posible: ${guessPotentialScore()}/20`;
}

function guessPotentialScore(){
  const r = Math.max(1, state.guess.revealed);
  if(r <= 2) return 20;
  if(r === 3) return 15;
  if(r === 4) return 10;
  if(r === 5) return 5;
  return 3;
}

function checkGuess(){
  if(!state.guess.active || state.guess.done || !state.guess.country) return;
  const guess = normalize($("#guessInput").value);
  const answer = normalize(state.guess.country.name);
  if(guess && (guess === answer || answer.includes(guess))){
    finishGuess(true);
  } else {
    $("#guessFeedback").textContent = "Casi. Consulten al equipo, destapen otra pista si lo necesitan y vuelvan a responder antes de que termine el tiempo.";
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
    ? `Correcto: ${state.guess.country.flag} ${state.guess.country.name}. Puntaje: ${score}/20. Estacion sellada.`
    : `Tiempo. Era ${state.guess.country.flag} ${state.guess.country.name}. Puntaje: 0/20. Estacion sellada.`;
}

function buildGuessRoundPreview(){
  $("#guessClues").innerHTML = "";
  $("#guessFeedback").textContent = "";
  $("#guessStatus").textContent = "Pulsa nueva ronda para iniciar el cronometro.";
  $("#guessTimer").textContent = "00";
  $("#guessInput").disabled = false;
  $("#checkGuessBtn").disabled = false;
}

function buildScenarios(){
  const deck = $("#scenarioDeck");
  deck.innerHTML = "";
  state.scenario = { active: false, done: false, opened: new Set(), answered: new Set(), correct: new Set() };
  shuffled(SCENARIOS, 61).slice(0, 6).forEach((scenario, index) => {
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
    scenario.options.forEach((option, optionIndex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scenario-option";
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
  state.scenario.active = true;
  $all(".scenario-card").forEach(card => card.classList.remove("is-disabled"));
  $("#scenarioStatus").textContent = "Ronda activa: tienen 1 minuto y medio para abrir fichas y elegir respuestas correctas.";
  startTimer("scenario", 90, $("#scenarioTimer"), finishScenario);
}

function openScenarioCard(card){
  if(!state.scenario.active || state.scenario.done || card.classList.contains("open")) return;
  card.classList.add("open");
  state.scenario.opened.add(card.dataset.index);
  $("#scenarioStatus").textContent = `Fichas abiertas: ${state.scenario.opened.size}/6. Ahora seleccionen la opcion correcta.`;
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
    card.querySelectorAll(".scenario-option")[scenario.correct].classList.add("correct");
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
  buildSoundChallenge();
  state.sound.active = true;
  state.sound.resumeGeneralAfter = false;
  activateSoundCard(0);
  $("#soundStatus").textContent = "Ronda activa: reproduzcan la primera cancion. Solo hay una oportunidad por cancion.";
  startTimer("sound", 25, $("#soundTimer"), finishSoundGame);
}

function buildSoundChallenge(){
  const container = $("#soundChallenge");
  container.innerHTML = "";
  state.sound = { active: false, done: false, opened: new Set(), correct: new Set(), currentIndex: 0, resumeGeneralAfter: state.sound.resumeGeneralAfter || false };
  const tracks = shuffled(COUNTRIES, 81).slice(0, 3);
  tracks.forEach((country, index) => {
    const card = document.createElement("article");
    card.className = "sound-card is-disabled";
    card.dataset.index = index;
    card.innerHTML = `
      <span>♪</span>
      <strong>Cancion ${index + 1}</strong>
      <p>Reproduce el audio y elige una bandera.</p>
      <button class="action-btn action-btn--small play-track" type="button">Reproducir</button>
      <div class="sound-options"></div>
    `;
    card.querySelector(".play-track").addEventListener("click", () => playMusicTrack(country, index));
    const options = card.querySelector(".sound-options");
    shuffled(COUNTRIES, 91 + index).forEach(option => {
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

async function playMusicTrack(country, index){
  if(!state.sound.active || state.sound.done || index !== state.sound.currentIndex) return;
  const audio = $("#countryAudio");
  state.sound.resumeGeneralAfter = state.sound.resumeGeneralAfter || isGeneralMusicPlaying();
  pauseGeneralMusic();
  if(audio){
    audio.pause();
    audio.currentTime = 0;
  }
  audio.src = `assets/music/${country.id}.mp3`;
  audio.play().then(() => {
    $("#countryAudioHint").textContent = `Cancion ${index + 1}: reproduciendo audio local.`;
  }).catch(async () => {
    $("#countryAudioHint").textContent = `No encontre el MP3 de la cancion ${index + 1}. Uso musica generada sin revelar el pais.`;
    await startGeneratedAudio();
    ensureAudio().setCountry(country);
  });
}

function answerSoundTrack(card, btn, targetCountry, option){
  const cardIndex = Number(card.dataset.index);
  if(!state.sound.active || state.sound.done || cardIndex !== state.sound.currentIndex || state.sound.opened.has(card.dataset.index)) return;
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
    $("#soundStatus").textContent = `Cancion ${cardIndex + 1} respondida. Ahora se habilita la cancion ${nextIndex + 1}.`;
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
  $("#commitmentStatus").textContent = "Ronda activa: minimo 5 frases, cada una al balon colectivo.";
  startTimer("commitment", 60, $("#commitmentTimer"), finishCommitment);
}

function addCommitment(){
  const team = activeTeam();
  if(!team || !state.commitment.active || state.commitment.done || isLocked("commitment")){
    $("#commitmentStatus").textContent = "Primero activen el cronometro del cierre.";
    return;
  }
  const input = $("#commitmentInput");
  const text = input.value.trim();
  if(!text) return;
  team.commitments.unshift(text);
  input.value = "";
  renderCommitments();
  $("#commitmentStatus").textContent = `Frases en el balon: ${team.commitments.length}/5 minimo.`;
  if(team.commitments.length >= 5) finishCommitment();
  saveTournament();
}

function finishCommitment(){
  const team = activeTeam();
  if(!team) return;
  clearTimer("commitment");
  state.commitment.active = false;
  state.commitment.done = true;
  lockActivity("commitment");
  const score = team.commitments.length >= 5 ? ACTIVITY_MAX.commitment : Math.round((team.commitments.length / 5) * ACTIVITY_MAX.commitment);
  setActivityScore("commitment", score);
  autoSealStation("commitment");
  $("#commitmentStatus").textContent = team.commitments.length >= 5
    ? "Cierre completo: 20/20. Estacion sellada automaticamente."
    : `Tiempo terminado: ${score}/20 por ${team.commitments.length} frases. Estacion sellada.`;
}

function updateFinalMessage(){
  const team = activeTeam();
  const msg = $("#finalMessage");
  const score = team ? team.score : 0;
  if(score >= 85) msg.textContent = "Copa levantada: rapidez, respeto, movimiento y escucha activa.";
  else if(score >= 55) msg.textContent = "Buen partido intercultural. Aun pueden mejorar participacion y cierre colectivo.";
  else msg.textContent = "Completen actividades con cronometro para sumar hasta 100 puntos.";
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
      $("#musicCountryName").textContent = "Adivina el pais por la musica";
      $("#musicCountryText").textContent = "Opciones: Argentina, Brasil, Colombia, Ecuador, Haiti, Mexico, Panama, Paraguay, Peru y Uruguay.";
      if(audioEngine) audioEngine.setCountry(null);
    } else {
      const country = id === 2 && state.guess.country ? state.guess.country : selectedCountry();
      updateMusicCountry(country);
      if(audioEngine) audioEngine.setCountry(country);
    }
  } else {
    $("#musicCountryFlag").textContent = "♪";
    $("#musicCountryName").textContent = "Musica general";
    $("#musicCountryText").textContent = "En la actividad musical puedes usar MP3 por pais o musica generada.";
    if(audioEngine) audioEngine.setCountry(null);
  }
}

async function toggleSound(){
  if(isGeneralMusicPlaying()){
    pauseGeneralMusic();
    $("#soundToggle").setAttribute("aria-pressed", "false");
    $("#soundLabel").textContent = "Activar musica";
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
    $("#soundLabel").textContent = "Pausar musica";
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
    list.innerHTML = `<div class="leaderboard-empty">Todavia no hay equipos guardados.</div>`;
    return;
  }
  teams.forEach((team, index) => {
    const country = countryById(team.countryId);
    const row = document.createElement("article");
    row.className = "leaderboard-card";
    row.innerHTML = `
      <span class="leaderboard-card__rank">${index + 1}</span>
      <span class="leaderboard-card__flag">${country ? country.flag : "◌"}</span>
      <div><h3>${team.name}</h3><p>${country ? country.name : "Pais sin sortear"}</p></div>
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
  state.tournament = { teams: [] };
  resetRoundState();
  $("#leaderboardModal").hidden = true;
  buildAllGames();
  refreshHeader();
  goToStation(0);
  $("#soundToggle").setAttribute("aria-pressed", "false");
  $("#soundLabel").textContent = "Activar musica";
  if(restartGeneralMusic){
    playGeneralMusic();
  }
}

function resetRoundState(){
  state.memory = { lock: false, first: null, matches: 0, active: false, done: false };
  state.guess = { country: null, active: false, done: false, revealed: 0 };
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
  $all(".stamp-btn").forEach(btn => btn.addEventListener("click", () => stampStation(Number(btn.dataset.station))));
}

function init(){
  loadTournament();
  buildNav();
  wireEvents();
  buildAllGames();
  refreshHeader();
  goToStation(0);
}

document.addEventListener("DOMContentLoaded", init);
