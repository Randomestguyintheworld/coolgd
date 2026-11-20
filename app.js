const levels = [
  { id: 'sunny', name: 'Sunny Side', creator: 'CoolGD', difficulty: 'Easy', stars: 3, plays: 'A gentle warm-up', speed: 245, bpm: 105, length: 2700, sky: ['#244f68', '#142c43'], accent: '#a7e83b', hazards: [[430,'spike'],[710,'spike'],[930,'block'],[1190,'pad'],[1510,'block'],[1780,'spike'],[2020,'orb',88],[2310,'block'],[2530,'spike']] },
  { id: 'neon', name: 'Neon Sprint', creator: 'PixelPilot', difficulty: 'Normal', stars: 6, plays: 'A speedy dash', speed: 285, bpm: 124, length: 3000, sky: ['#382c72', '#171d48'], accent: '#55f4d0', hazards: [[380,'spike'],[580,'block'],[820,'pad'],[1080,'block',34],[1080,'block'],[1320,'spike'],[1510,'orb',100],[1780,'block'],[2010,'spike'],[2250,'ship'],[2480,'spike'],[2760,'cube']] },
  { id: 'starlight', name: 'Starlight Rush', creator: 'OrbitFox', difficulty: 'Hard', stars: 10, plays: 'A tricky challenge', speed: 320, bpm: 140, length: 3200, sky: ['#622c61', '#241743'], accent: '#ffce55', hazards: [[350,'spike'],[520,'spike'],[760,'pad'],[950,'block',34],[950,'block'],[1160,'block'],[1370,'orb',120],[1580,'spike'],[1830,'ship'],[2020,'spike'],[2220,'spike'],[2470,'cube'],[2670,'pad'],[2900,'spike']] }
];
const leaders = [['1','Zyphron','8,742','98.4%'],['2','NovaBee','8,410','97.8%'],['3','Lunar','7,996','96.9%'],['4','PixelDust','7,521','95.2%'],['5','PyroKid','7,338','94.7%'],['6','VoidEcho','6,980','93.1%']];
const $ = id => document.getElementById(id);
let selectedLevel = levels[0], gameState = 'ready', distance = 0, playerY = 0, playerVY = 0, lastFrame = 0, frameId = 0, toastTimer;
let playerMode = 'cube', grounded = true, rotation = 0, jumpHeld = false, attempts = {}, activatedHazards = new Set(), particles = [];
let audioContext = null, musicTimer = null, musicStep = 0;
const canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
const playerSize = 30, playerX = 128, gravity = 1500, jumpPower = 570;

function card(level) {
  return `<article class="level-card"><div class="level-cover" style="--cover:linear-gradient(135deg,${level.sky[0]},${level.accent})"><span class="difficulty">${level.difficulty}</span><span class="cover-gem">◆</span></div><div class="level-info"><h3>${level.name}</h3><div class="level-meta"><span>by <strong>${level.creator}</strong></span><span><b class="stars">★ ${level.stars}</b> · ${level.plays}</span></div><button class="play-level" data-level="${level.id}">Play level <span>→</span></button></div></article>`;
}
function renderLevels() {
  const query = $('searchInput').value.toLowerCase(), difficulty = $('difficultyFilter').value;
  const filtered = levels.filter(level => (difficulty === 'all' || level.difficulty === difficulty) && `${level.name} ${level.creator}`.toLowerCase().includes(query));
  $('levelGrid').innerHTML = filtered.length ? filtered.map(card).join('') : '<p class="empty-state">No levels found. Try another search.</p>';
  document.querySelectorAll('#levelGrid .play-level').forEach(button => button.addEventListener('click', () => openGame(button.dataset.level)));
}
function bindCards() {
  $('featuredLevels').innerHTML = levels.map(card).join('');
  document.querySelectorAll('#featuredLevels .play-level').forEach(button => button.addEventListener('click', () => openGame(button.dataset.level)));
  renderLevels();
}
bindCards();
$('leaderboard').innerHTML = leaders.map(player => `<div class="rank-row"><div class="rank-num">${player[0]}</div><div class="rank-player"><span class="rank-avatar">${player[1][0]}</span>${player[1]}</div><div class="rank-stat"><strong>${player[2]}</strong><br>Stars</div><div class="rank-stat"><strong>${player[3]}</strong><br>Completion</div></div>`).join('');

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('themeToggle').querySelector('span').textContent = theme === 'dark' ? '☾' : '☀';
  try { localStorage.setItem('coolgd-theme', theme); } catch (_) { /* Private/file browsing can disable storage. */ }
}
let initialTheme = 'light';
try { initialTheme = localStorage.getItem('coolgd-theme') || 'light'; } catch (_) { /* Use the default theme. */ }
setTheme(initialTheme);
$('themeToggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

function showView(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
  $(name + 'View').classList.add('active');
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  if (name === 'game') resizeCanvas();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => { if (gameState === 'running') pauseGame(); else stopMusic(); showView(button.dataset.view); }));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));
document.querySelector('.brand').addEventListener('click', () => { stopLoop(); stopMusic(); showView('home'); });
$('playButton').addEventListener('click', () => showView('levels'));
$('createButton').addEventListener('click', () => toast('Controls: Space, ↑, W, click, or tap to jump. In ship sections, hold to fly.'));
document.querySelector('.profile-button').addEventListener('click', () => toast('This is a local demo profile.'));
$('searchInput').addEventListener('input', renderLevels);
$('difficultyFilter').addEventListener('change', renderLevels);
$('backButton').addEventListener('click', () => { stopLoop(); stopMusic(); gameState = 'ready'; showView('levels'); });
$('restartButton').addEventListener('click', startGame);
$('overlayButton').addEventListener('click', () => {
  if (gameState === 'paused') resumeGame();
  else startGame();
});

function openGame(id) {
  stopLoop(); stopMusic();
  if (selectedLevel.id !== id) attempts[id] = 0;
  selectedLevel = levels.find(level => level.id === id) || levels[0];
  attempts[selectedLevel.id] = attempts[selectedLevel.id] || 0;
  gameState = 'ready'; distance = 0; playerY = 0; playerVY = 0; playerMode = 'cube'; grounded = true; rotation = 0;
  activatedHazards = new Set(); particles = [];
  $('gameTitle').textContent = selectedLevel.name;
  $('gameOverlay').classList.remove('hidden');
  $('overlayIcon').textContent = '◆'; $('overlayTitle').textContent = 'Ready?';
  $('overlayText').textContent = 'Jump over hazards, activate orbs, and reach the finish.'; $('overlayButton').textContent = 'Start level';
  showView('game'); resizeCanvas(); drawScene();
}
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawScene();
}
function floorY() { return canvas.clientHeight - 52; }
function worldX(hazard) { return hazard[0]; }
function drawScene() {
  if (!canvas.clientWidth || !canvas.clientHeight) return;
  const w = canvas.clientWidth, h = canvas.clientHeight, floor = floorY();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, selectedLevel.sky[0]); gradient.addColorStop(1, selectedLevel.sky[1]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 32; i++) { const x = (i * 97 + 31) % w, y = (i * 47 + 23) % Math.max(1, floor - 35); ctx.fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2); }
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 0; i < 7; i++) { const x = i * 180 - (distance * .22 % 180); ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 75, floor - 100 - (i % 3) * 28); ctx.lineTo(x + 160, floor); ctx.fill(); }
  ctx.fillStyle = '#17212b'; ctx.fillRect(0, floor, w, h - floor);
  ctx.fillStyle = selectedLevel.accent; ctx.fillRect(0, floor, w, 4);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  for (let x = -((distance * .8) % 40); x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, floor + 4); ctx.lineTo(x - 25, h); ctx.stroke(); }
  selectedLevel.hazards.forEach((hazard, index) => {
    const [wx, type, value = 0] = hazard, x = playerX + wx - distance;
    if (x < -65 || x > w + 65) return;
    if (type === 'block') {
      const base = value, top = base + 34, y = floor - top;
      ctx.fillStyle = index % 2 ? '#f267cb' : selectedLevel.accent; ctx.fillRect(x, y, 34, 34);
      ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 3; ctx.strokeRect(x + 5, y + 5, 24, 24);
    } else if (type === 'spike') {
      ctx.fillStyle = '#ff5f75'; ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 18, floor - 34); ctx.lineTo(x + 36, floor); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.beginPath(); ctx.moveTo(x + 12, floor - 11); ctx.lineTo(x + 18, floor - 23); ctx.lineTo(x + 24, floor - 11); ctx.fill();
    } else if (type === 'pad') {
      ctx.fillStyle = '#ffce55'; ctx.shadowColor = '#ffce55'; ctx.shadowBlur = 12; ctx.fillRect(x + 3, floor - 10, 30, 10); ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 10, floor - 11); ctx.lineTo(x + 18, floor - 23); ctx.lineTo(x + 26, floor - 11); ctx.fill();
    } else if (type === 'orb') {
      const cy = floor - value, color = selectedLevel.accent;
      ctx.beginPath(); ctx.arc(x + 18, cy, 13, 0, Math.PI * 2); ctx.strokeStyle = color; ctx.lineWidth = 5; ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.stroke(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(x + 18, cy, 4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    } else if (type === 'ship' || type === 'cube') {
      ctx.fillStyle = type === 'ship' ? '#9e5df7' : '#35a9ff'; ctx.globalAlpha = .8; ctx.fillRect(x + 7, floor - 160, 22, 160); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(x + 5, floor - 160, 26, 160);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(type.toUpperCase(), x + 18, floor - 170);
    }
  });
  const playerTop = floor - playerY - playerSize;
  ctx.save(); ctx.translate(playerX + playerSize / 2, playerTop + playerSize / 2);
  if (playerMode === 'cube') {
    ctx.rotate(rotation);
    ctx.fillStyle = selectedLevel.accent; ctx.shadowColor = selectedLevel.accent; ctx.shadowBlur = 14; ctx.fillRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(-playerSize / 2 + 5, -playerSize / 2 + 5, playerSize - 10, playerSize - 10);
    ctx.fillStyle = '#fff'; ctx.fillRect(-5, -4, 4, 4); ctx.fillRect(4, -4, 4, 4);
  } else {
    ctx.rotate(Math.max(-.45, Math.min(.45, -playerVY / 1000)));
    ctx.fillStyle = selectedLevel.accent; ctx.shadowColor = selectedLevel.accent; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(15, -11); ctx.lineTo(10, 0); ctx.lineTo(15, 11); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(1, 0, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => { ctx.save(); ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore(); });
  if (attempts[selectedLevel.id] > 0) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 18px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`Attempt ${attempts[selectedLevel.id]}`, w / 2, 42); }
  const progress = Math.min(100, Math.floor(distance / selectedLevel.length * 100));
  $('progressFill').style.width = progress + '%'; $('progressText').textContent = progress + '%';
  if (gameState === 'running') $('gameMessage').textContent = playerMode === 'ship' ? 'SHIP MODE — HOLD TO FLY' : selectedLevel.name;
}

function ensureAudio() {
  if (!audioContext) { const AudioCtor = window.AudioContext || window.webkitAudioContext; if (AudioCtor) audioContext = new AudioCtor(); }
  if (audioContext?.state === 'suspended') audioContext.resume();
}
function tone(freq, duration = .12, waveform = 'sine', volume = .12, endFreq = null) {
  if (!audioContext) return;
  const now = audioContext.currentTime, oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.type = waveform; oscillator.frequency.setValueAtTime(freq, now);
  if (endFreq) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
  oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(now); oscillator.stop(now + duration);
}
function sfx(kind) {
  ensureAudio();
  if (!audioContext) return;
  if (kind === 'jump') tone(540, .09, 'square', .045, 760);
  if (kind === 'pad') { tone(420, .18, 'triangle', .12, 980); setTimeout(() => tone(760, .12, 'sine', .07, 1100), 55); }
  if (kind === 'orb') tone(840, .16, 'sine', .1, 1250);
  if (kind === 'crash') { tone(210, .28, 'sawtooth', .12, 55); tone(90, .32, 'square', .06, 35); }
  if (kind === 'win') { [523,659,784,1047].forEach((note,i) => setTimeout(() => tone(note,.2,'triangle',.09), i*100)); }
}
function startMusic() {
  stopMusic(); ensureAudio(); if (!audioContext) return;
  const beatMs = 60000 / selectedLevel.bpm; musicStep = 0;
  const beat = () => {
    if (!audioContext || gameState !== 'running') return;
    const step = musicStep++ % 8;
    if (step % 4 === 0) tone(95, .15, 'sine', .08, 42);
    if (step % 2 === 1) tone([392,440,523,659][Math.floor(step / 2)], .09, 'triangle', .035);
    if (step === 2 || step === 6) tone(170, .055, 'square', .025, 90);
  };
  beat(); musicTimer = window.setInterval(beat, beatMs / 2);
}
function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
function startGame() {
  stopLoop(); stopMusic(); ensureAudio();
  distance = 0; playerY = 0; playerVY = 0; playerMode = 'cube'; grounded = true; rotation = 0;
  activatedHazards = new Set(); particles = []; attempts[selectedLevel.id] = (attempts[selectedLevel.id] || 0) + 1;
  gameState = 'running'; lastFrame = 0; jumpHeld = false;
  $('overlayButton').onclick = null; $('gameOverlay').classList.add('hidden'); $('gameMessage').textContent = 'Go!';
  drawScene(); startMusic(); frameId = requestAnimationFrame(tick);
}
function stopLoop() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; }
function resumeGame() {
  if (gameState !== 'paused') return;
  gameState = 'running'; lastFrame = 0; $('gameOverlay').classList.add('hidden'); startMusic(); frameId = requestAnimationFrame(tick);
}
function pauseGame() {
  if (gameState !== 'running') return;
  stopLoop(); stopMusic(); gameState = 'paused'; jumpHeld = false;
  $('gameOverlay').classList.remove('hidden'); $('overlayIcon').textContent = 'Ⅱ'; $('overlayTitle').textContent = 'Paused'; $('overlayText').textContent = 'Your progress is saved. Resume when you are ready.'; $('overlayButton').textContent = 'Resume'; drawScene();
}
function tick(timestamp) {
  if (gameState !== 'running') return;
  const dt = Math.min((timestamp - (lastFrame || timestamp)) / 1000, .035); lastFrame = timestamp;
  distance += selectedLevel.speed * dt;
  const previousY = playerY;
  if (playerMode === 'ship') {
    playerVY += (jumpHeld ? 2050 : -1250) * dt;
    playerY = Math.max(0, Math.min(floorY() - playerSize - 12, playerY + playerVY * dt));
    if (playerY === 0 && playerVY < 0) playerVY = 0;
    if (playerY >= floorY() - playerSize - 12 && playerVY > 0) playerVY = 0;
    grounded = false;
  } else {
    playerVY -= gravity * dt;
    playerY = Math.max(0, playerY + playerVY * dt);
    grounded = false;
  }
  const playerWorld = distance + playerX, left = playerWorld + 4, right = playerWorld + playerSize - 4;
  let landed = false, landingHeight = -1;
  for (let i = 0; i < selectedLevel.hazards.length; i++) {
    const [hazardX, type, value = 0] = selectedLevel.hazards[i], key = `${i}:${hazardX}:${type}`;
    const hazardW = type === 'block' ? 34 : 36;
    const overlapsX = right > hazardX + 3 && left < hazardX + hazardW - 3;
    if (type === 'ship' || type === 'cube') {
      if (!activatedHazards.has(key) && playerWorld >= hazardX) { playerMode = type; playerY = Math.max(playerY, 8); playerVY = 0; grounded = false; activatedHazards.add(key); }
      continue;
    }
    if (!overlapsX) continue;
    if (type === 'block') {
      const base = value, top = base + 34;
      if (playerVY <= 0 && previousY >= top - 1 && playerY <= top && previousY + playerSize > base) {
        if (top > landingHeight) { landingHeight = top; landed = true; }
      } else if (playerY < top - 2 && playerY + playerSize > base + 3) { finishGame(false); return; }
    } else if (type === 'spike') {
      if (playerY < 30 && playerY + playerSize > 3) { finishGame(false); return; }
    } else if (type === 'pad' && playerMode === 'cube') {
      if (!activatedHazards.has(key) && playerY < 20 && playerVY <= 0) {
        playerVY = jumpPower * 1.35; grounded = false; activatedHazards.add(key); sfx('pad');
      }
    }
  }
  if (playerMode === 'cube' && landed) { playerY = landingHeight; playerVY = 0; grounded = true; rotation = Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2); }
  else if (playerMode === 'cube' && playerY === 0) { playerVY = 0; grounded = true; rotation = Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2); }
  if (playerMode === 'cube' && !grounded && playerY > 0) rotation += 6.5 * dt;
  particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.life -= dt; p.rotation += p.spin * dt; });
  if (distance >= selectedLevel.length) { finishGame(true); return; }
  drawScene(); frameId = requestAnimationFrame(tick);
}
function activateOrb() {
  const playerWorld = distance + playerX, centerX = playerWorld + playerSize / 2, centerY = playerY + playerSize / 2;
  for (let i = 0; i < selectedLevel.hazards.length; i++) {
    const [x, type, height = 0] = selectedLevel.hazards[i], key = `${i}:${x}:${type}`;
    if (type !== 'orb' || activatedHazards.has(key)) continue;
    const dx = centerX - (x + 18), dy = centerY - height;
    if (Math.hypot(dx, dy) < 38) { playerVY = jumpPower * 1.12; playerMode = 'cube'; grounded = false; activatedHazards.add(key); sfx('orb'); return true; }
  }
  return false;
}
function jump() {
  if (!$('gameView').classList.contains('active')) return;
  if (gameState === 'ready') { startGame(); return; }
  if (gameState !== 'running') return;
  if (playerMode === 'ship') { jumpHeld = true; return; }
  if (activateOrb()) return;
  if (grounded || playerY <= .5) { playerVY = jumpPower; grounded = false; sfx('jump'); }
}
function releaseJump() { jumpHeld = false; }
function spawnCrashParticles() {
  const colors = [selectedLevel.accent, '#ff5f75', '#ffce55', '#55f4d0', '#ffffff'];
  const px = playerX + playerSize / 2, py = floorY() - playerY - playerSize / 2;
  for (let i = 0; i < 28; i++) { const angle = Math.random() * Math.PI * 2, speed = 80 + Math.random() * 260; particles.push({x:px,y:py,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-60,size:4+Math.random()*8,rotation:Math.random()*Math.PI,spin:(Math.random()-.5)*12,life:.45+Math.random()*.5,maxLife:1,color:colors[i%colors.length]}); }
  $('gameShell')?.classList.remove('shake'); void $('gameShell')?.offsetWidth; $('gameShell')?.classList.add('shake'); setTimeout(() => $('gameShell')?.classList.remove('shake'), 450);
}
function finishGame(won) {
  stopLoop(); stopMusic(); gameState = won ? 'won' : 'dead';
  if (won) sfx('win'); else { spawnCrashParticles(); sfx('crash'); }
  $('gameOverlay').classList.remove('hidden'); $('overlayIcon').textContent = won ? '★' : '↻';
  $('overlayTitle').textContent = won ? 'Level complete!' : 'Crash!';
  $('overlayText').textContent = won ? `Nice run — you cleared ${selectedLevel.name}.` : 'No worries. Hit retry and give it another go.';
  $('overlayButton').textContent = won ? 'Play again' : 'Retry'; $('gameMessage').textContent = won ? 'Complete!' : 'Try again'; drawScene();
}
window.addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) { event.preventDefault(); if (!event.repeat) jump(); }
  if (event.code === 'Escape') { if (gameState === 'running') pauseGame(); else if (gameState === 'paused') resumeGame(); }
});
window.addEventListener('keyup', event => { if (['Space','ArrowUp','KeyW'].includes(event.code)) releaseJump(); });
canvas.addEventListener('pointerdown', event => { event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); jump(); });
window.addEventListener('pointerup', releaseJump);
window.addEventListener('pointercancel', releaseJump);
window.addEventListener('blur', releaseJump);
window.addEventListener('resize', resizeCanvas);
function toast(message) { const element = $('toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 2200); }
