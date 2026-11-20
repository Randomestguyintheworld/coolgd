const levels = [
  { id: 'sunny', name: 'Sunny Side', creator: 'CoolGD', difficulty: 'Easy', stars: 3, plays: 'A gentle warm-up', speed: 245, length: 2700, sky: ['#244f68', '#142c43'], accent: '#a7e83b', hazards: [[430,'spike'],[710,'spike'],[930,'block'],[1190,'spike'],[1218,'spike'],[1510,'block'],[1780,'spike'],[2020,'spike'],[2048,'spike'],[2310,'block'],[2530,'spike']] },
  { id: 'neon', name: 'Neon Sprint', creator: 'PixelPilot', difficulty: 'Normal', stars: 6, plays: 'A speedy dash', speed: 285, length: 3000, sky: ['#382c72', '#171d48'], accent: '#55f4d0', hazards: [[380,'spike'],[580,'block'],[820,'spike'],[848,'spike'],[1080,'block'],[1320,'spike'],[1510,'spike'],[1538,'spike'],[1780,'block'],[2010,'spike'],[2038,'spike'],[2250,'block'],[2480,'spike'],[2508,'spike'],[2760,'block']] },
  { id: 'starlight', name: 'Starlight Rush', creator: 'OrbitFox', difficulty: 'Hard', stars: 10, plays: 'A tricky challenge', speed: 320, length: 3200, sky: ['#622c61', '#241743'], accent: '#ffce55', hazards: [[350,'spike'],[520,'spike'],[548,'spike'],[760,'block'],[950,'spike'],[978,'spike'],[1160,'block'],[1370,'spike'],[1398,'spike'],[1580,'spike'],[1608,'spike'],[1830,'block'],[2020,'spike'],[2048,'spike'],[2220,'spike'],[2248,'spike'],[2470,'block'],[2670,'spike'],[2698,'spike'],[2900,'spike'],[2928,'spike']] }
];
const leaders = [['1','Zyphron','8,742','98.4%'],['2','NovaBee','8,410','97.8%'],['3','Lunar','7,996','96.9%'],['4','PixelDust','7,521','95.2%'],['5','PyroKid','7,338','94.7%'],['6','VoidEcho','6,980','93.1%']];
const $ = id => document.getElementById(id);
let selectedLevel = levels[0], gameState = 'ready', distance = 0, playerY = 0, playerVY = 0, lastFrame = 0, frameId = 0, toastTimer;
const canvas = $('gameCanvas'), ctx = canvas.getContext('2d');
const playerSize = 30, playerX = 128, gravity = 1500, jumpPower = 570;

function card(level) {
  return `<article class="level-card"><div class="level-cover" style="--cover:linear-gradient(135deg,${level.sky[0]},${level.accent})"><span class="difficulty">${level.difficulty}</span><span class="cover-gem">◆</span></div><div class="level-info"><h3>${level.name}</h3><div class="level-meta"><span>by <strong>${level.creator}</strong></span><span><b class="stars">★ ${level.stars}</b> · ${level.plays}</span></div><button class="play-level" data-level="${level.id}">Play level <span>→</span></button></div></article>`;
}
function renderLevels() {
  const query = $('searchInput').value.toLowerCase(), difficulty = $('difficultyFilter').value;
  const filtered = levels.filter(level => (difficulty === 'all' || level.difficulty === difficulty) && `${level.name} ${level.creator}`.toLowerCase().includes(query));
  $('levelGrid').innerHTML = filtered.length ? filtered.map(card).join('') : '<p class="empty-state">No levels found. Try another search.</p>';
  document.querySelectorAll('.play-level').forEach(button => button.addEventListener('click', () => openGame(button.dataset.level)));
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
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));
document.querySelector('.brand').addEventListener('click', () => showView('home'));
$('playButton').addEventListener('click', () => showView('levels'));
$('createButton').addEventListener('click', () => toast('Controls: Space, ↑, W, click, or tap to jump.'));
$('profile-button')?.addEventListener('click', () => toast('This is a local demo profile.'));
$('searchInput').addEventListener('input', renderLevels);
$('difficultyFilter').addEventListener('change', renderLevels);
$('backButton').addEventListener('click', () => { stopLoop(); showView('levels'); });
$('restartButton').addEventListener('click', startGame);
$('overlayButton').addEventListener('click', () => gameState === 'won' || gameState === 'dead' ? startGame() : startGame());

function openGame(id) {
  selectedLevel = levels.find(level => level.id === id) || levels[0];
  $('gameTitle').textContent = selectedLevel.name;
  $('gameOverlay').classList.remove('hidden');
  $('overlayIcon').textContent = '◆'; $('overlayTitle').textContent = 'Ready?';
  $('overlayText').textContent = 'Jump over the hazards and reach the finish.'; $('overlayButton').textContent = 'Start level';
  showView('game'); resizeCanvas(); drawScene();
}
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawScene();
}
function floorY() { return canvas.clientHeight - 52; }
function drawScene() {
  if (!canvas.clientWidth || !canvas.clientHeight) return;
  const w = canvas.clientWidth, h = canvas.clientHeight, floor = floorY();
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, selectedLevel.sky[0]); gradient.addColorStop(1, selectedLevel.sky[1]);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 32; i++) { const x = (i * 97 + 31) % w, y = (i * 47 + 23) % Math.max(1, floor - 35); ctx.fillRect(x, y, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2); }
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  for (let i = 0; i < 7; i++) { const x = (i * 180 - distance * .22 % 180); ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 75, floor - 100 - (i % 3) * 28); ctx.lineTo(x + 160, floor); ctx.fill(); }
  ctx.fillStyle = '#17212b'; ctx.fillRect(0, floor, w, h - floor);
  ctx.fillStyle = selectedLevel.accent; ctx.fillRect(0, floor, w, 4);
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
  for (let x = -((distance * .8) % 40); x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, floor + 4); ctx.lineTo(x - 25, h); ctx.stroke(); }
  selectedLevel.hazards.forEach(([worldX, type], index) => {
    const x = playerX + worldX - distance;
    if (x < -55 || x > w + 55) return;
    if (type === 'block') { ctx.fillStyle = index % 2 ? '#f267cb' : selectedLevel.accent; ctx.fillRect(x, floor - 34, 34, 34); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.strokeRect(x + 5, floor - 29, 24, 24); }
    else { ctx.fillStyle = '#ff5f75'; ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 18, floor - 34); ctx.lineTo(x + 36, floor); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.78)'; ctx.beginPath(); ctx.moveTo(x + 12, floor - 11); ctx.lineTo(x + 18, floor - 23); ctx.lineTo(x + 24, floor - 11); ctx.fill(); }
  });
  const y = floor - playerSize - playerY;
  ctx.save(); ctx.translate(playerX + playerSize / 2, y + playerSize / 2);
  if (gameState === 'running') ctx.rotate(Math.min(distance / 80, Math.PI * 8));
  ctx.fillStyle = selectedLevel.accent; ctx.shadowColor = selectedLevel.accent; ctx.shadowBlur = 14;
  ctx.fillRect(-playerSize / 2, -playerSize / 2, playerSize, playerSize); ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(-playerSize / 2 + 5, -playerSize / 2 + 5, playerSize - 10, playerSize - 10);
  ctx.fillStyle = '#fff'; ctx.fillRect(-5, -4, 4, 4); ctx.fillRect(4, -4, 4, 4); ctx.restore();
  const progress = Math.min(100, Math.floor(distance / selectedLevel.length * 100));
  $('progressFill').style.width = progress + '%'; $('progressText').textContent = progress + '%';
  if (gameState === 'running') $('gameMessage').textContent = selectedLevel.name;
}
function startGame() {
  stopLoop(); distance = 0; playerY = 0; playerVY = 0; gameState = 'running'; lastFrame = 0;
  $('gameOverlay').classList.add('hidden'); $('gameMessage').textContent = 'Go!'; drawScene(); frameId = requestAnimationFrame(tick);
}
function stopLoop() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; }
function tick(timestamp) {
  if (gameState !== 'running') return;
  const dt = Math.min((timestamp - (lastFrame || timestamp)) / 1000, 0.035); lastFrame = timestamp;
  distance += selectedLevel.speed * dt;
  playerVY += gravity * dt; playerY = Math.max(0, playerY + playerVY * dt);
  if (playerY === 0) playerVY = 0;
  const playerWorld = distance + playerX, playerBottom = floorY() - playerY;
  for (const [hazardX, type] of selectedLevel.hazards) {
    const hazardW = type === 'block' ? 34 : 36, hazardH = type === 'block' ? 34 : 34;
    const overlapsX = playerWorld + playerSize - 5 > hazardX + 4 && playerWorld + 5 < hazardX + hazardW - 4;
    const overlapsY = playerBottom > floorY() - hazardH + 5;
    if (overlapsX && overlapsY) { finishGame(false); return; }
  }
  if (distance >= selectedLevel.length) { finishGame(true); return; }
  drawScene(); frameId = requestAnimationFrame(tick);
}
function finishGame(won) {
  stopLoop(); gameState = won ? 'won' : 'dead';
  $('gameOverlay').classList.remove('hidden');
  $('overlayIcon').textContent = won ? '★' : '↻';
  $('overlayTitle').textContent = won ? 'Level complete!' : 'Crash!';
  $('overlayText').textContent = won ? `Nice run — you cleared ${selectedLevel.name}.` : 'No worries. Hit retry and give it another go.';
  $('overlayButton').textContent = won ? 'Play again' : 'Retry';
  $('gameMessage').textContent = won ? 'Complete!' : 'Try again'; drawScene();
}
function jump() {
  if (!document.getElementById('gameView').classList.contains('active')) return;
  if (gameState === 'running' && playerY <= 0.5) { playerVY = -jumpPower; }
  else if (gameState === 'ready') startGame();
}
window.addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) { event.preventDefault(); if (!event.repeat) jump(); }
  if (event.code === 'Escape' && gameState === 'running') { stopLoop(); gameState = 'paused'; $('gameOverlay').classList.remove('hidden'); $('overlayTitle').textContent = 'Paused'; $('overlayText').textContent = 'Take a breather, then continue your run.'; $('overlayButton').textContent = 'Resume'; $('overlayButton').onclick = () => { $('overlayButton').onclick = null; gameState = 'ready'; startGame(); }; }
});
canvas.addEventListener('pointerdown', event => { event.preventDefault(); jump(); });
window.addEventListener('resize', resizeCanvas);
function toast(message) { const element = $('toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('show'), 2200); }
$('profile-button')?.addEventListener('click', () => toast('This is a local demo profile.'));
// The class is used for reliable selection while keeping the profile button label accessible.
document.querySelector('.profile-button').addEventListener('click', () => toast('This is a local demo profile.'));
