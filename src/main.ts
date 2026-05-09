import { Game } from './game';
import { Renderer } from './renderer';
import { spawnPiece } from './piece';
import { Background } from './background';
import { Water } from './water';
import { AudioManager, randomDetune } from './audio';

// 检测 file:// 协议：浏览器会拒绝在该协议下用 fetch() 加载本地音频，
// 导致所有 SFX 与 BGM 静默失效。提示用户改走 dev server。
if (window.location.protocol === 'file:') {
  const banner = document.getElementById('file-protocol-banner');
  if (banner) banner.classList.add('show');
  console.error(
    '[ai-tetris] file:// 协议下浏览器会阻止加载音频资源。' +
      '请通过 `npm run dev` 启动后访问 http://localhost:8080/。',
  );
}

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const nextCanvas = document.getElementById('next-canvas') as HTMLCanvasElement;
const overlay = document.getElementById('overlay') as HTMLDivElement;

const elScore = document.getElementById('score') as HTMLElement;
const elLines = document.getElementById('lines') as HTMLElement;
const elLevel = document.getElementById('level') as HTMLElement;
const elSpeed = document.getElementById('speed') as HTMLElement;
const elStatus = document.getElementById('status') as HTMLElement;

const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
const btnAI = document.getElementById('btn-ai') as HTMLButtonElement;
const btnSlower = document.getElementById('btn-slower') as HTMLButtonElement;
const btnFaster = document.getElementById('btn-faster') as HTMLButtonElement;
const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement;
const btnRestart2 = document.getElementById('btn-restart-2') as HTMLButtonElement;
const btnSound = document.getElementById('btn-sound') as HTMLButtonElement;
const stageEl = document.getElementById('stage') as HTMLDivElement;
const sideEl = document.getElementById('side') as HTMLElement;

const game = new Game();
const renderer = new Renderer(canvas, nextCanvas);
game.getCellSize = () => renderer.cellSize();
const bgCanvas = document.getElementById('bg-canvas') as HTMLCanvasElement;
const waterCanvas = document.getElementById('water-canvas') as HTMLCanvasElement;
const background = new Background(bgCanvas);
const boardRect = (): DOMRect => canvas.getBoundingClientRect();
background.attachBoard(canvas, boardRect);
background.start();

let water: Water | null = null;
try {
  water = new Water(waterCanvas);
  water.attachBoard(canvas, boardRect);
  water.configure({
    getWaterY: () => background.waterLineY(),
    getFlash: () => background.getFlash(),
  });
} catch (err) {
  console.warn('WebGL water layer disabled:', err);
}

const audio = new AudioManager();
audio.attachUnlock(window);

function refreshSoundButton(): void {
  btnSound.textContent = audio.isMuted() ? '🔇 静音' : '🔊 声音';
  btnSound.classList.toggle('active', !audio.isMuted());
}
refreshSoundButton();

game.onMove = () => audio.playSfx('move', { volume: 0.55, detuneCents: randomDetune(), throttleMs: 40 });
game.onRotate = () => audio.playSfx('rotate', { volume: 0.6, detuneCents: randomDetune(), throttleMs: 60 });
game.onLock = () => audio.playSfx('drop', { volume: 0.55, detuneCents: randomDetune() });
game.onLineClear = (count) => {
  background.flashLightning(count);
  const magnitude = 4 + count * 3;
  const duration = 0.35 + count * 0.08;
  renderer.shake(magnitude, duration);
  audio.playSfx('lineClear', { volume: 0.75 });
};
background.onRipple = () => audio.playSfx('waterDrop', { volume: 0.18, detuneCents: randomDetune(), throttleMs: 180 });
background.onThunder = () => audio.playSfx('thunder', { volume: 0.85, detuneCents: randomDetune() });

function syncUI(): void {
  const s = game.snapshot();
  elScore.textContent = String(s.score);
  elLines.textContent = String(s.lines);
  elLevel.textContent = String(s.level);
  elSpeed.textContent = `${s.speed.toFixed(2)}x`;
  if (s.status === 'gameover') elStatus.textContent = 'Game Over';
  else if (s.status === 'paused') elStatus.textContent = '已暂停';
  else elStatus.textContent = s.aiEnabled ? 'AI 自动' : '手动控制';

  btnPause.textContent = s.status === 'paused' ? '继续' : '暂停';
  btnAI.textContent = s.aiEnabled ? 'AI: 开' : 'AI: 关';
  btnAI.classList.toggle('active', s.aiEnabled);

  overlay.classList.toggle('show', s.status === 'gameover');
}

function loop(now: number): void {
  const dt = Math.min(50, now - lastTime);
  lastTime = now;
  game.step(dt);
  game.updateVisual(dt);
  game.updateParticles(dt);
  renderer.render(game.board, game.visualPiece(), game.ghost(), game.particles);
  renderer.renderNext(game.next ? spawnPiece(game.next) : null);
  water?.render(now / 1000);
  syncUI();
  requestAnimationFrame(loop);
}
let lastTime = performance.now();
requestAnimationFrame(loop);

btnPause.addEventListener('click', () => {
  if (game.status === 'gameover') return;
  game.togglePause();
});
btnAI.addEventListener('click', () => game.setAIEnabled(!game.aiEnabled));
btnSlower.addEventListener('click', () => game.bumpSpeed(-1));
btnFaster.addEventListener('click', () => game.bumpSpeed(+1));
btnRestart.addEventListener('click', () => game.reset());
btnRestart2.addEventListener('click', () => game.reset());
btnSound.addEventListener('click', () => {
  audio.toggleMute();
  refreshSoundButton();
});

const STAGE_PADDING_X = 16;
const STAGE_PADDING_TOP = 32;
const REFLECTION_RESERVE_RATIO = 0.4;
const REFLECTION_RESERVE_MAX = 320;
const REFLECTION_RESERVE_MIN = 120;

function fitBoard(): void {
  const stageRect = stageEl.getBoundingClientRect();
  const reflectionReserve = Math.min(
    REFLECTION_RESERVE_MAX,
    Math.max(REFLECTION_RESERVE_MIN, stageRect.height * REFLECTION_RESERVE_RATIO),
  );
  const availW = Math.max(0, stageRect.width - STAGE_PADDING_X * 2);
  const availH = Math.max(0, stageRect.height - STAGE_PADDING_TOP - reflectionReserve);
  renderer.fitTo(availW, availH);
}

if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(fitBoard);
  ro.observe(stageEl);
  ro.observe(sideEl);
} else {
  window.addEventListener('resize', fitBoard);
}
window.addEventListener('orientationchange', fitBoard);
fitBoard();

window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    if (game.status !== 'gameover') game.togglePause();
    e.preventDefault();
    return;
  }
  if (e.key === 'a' || e.key === 'A') {
    game.setAIEnabled(!game.aiEnabled);
    e.preventDefault();
    return;
  }
  if (e.key === 'm' || e.key === 'M') {
    audio.toggleMute();
    refreshSoundButton();
    e.preventDefault();
    return;
  }
  if (e.key === '[') {
    game.bumpSpeed(-1);
    return;
  }
  if (e.key === ']') {
    game.bumpSpeed(+1);
    return;
  }

  if (game.aiEnabled || game.status !== 'playing') return;

  switch (e.key) {
    case 'ArrowLeft':
      game.moveLeft();
      e.preventDefault();
      break;
    case 'ArrowRight':
      game.moveRight();
      e.preventDefault();
      break;
    case 'ArrowUp':
      game.rotate();
      e.preventDefault();
      break;
    case 'ArrowDown':
      game.softDropping = true;
      e.preventDefault();
      break;
    case ' ':
      game.hardDrop();
      e.preventDefault();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowDown') {
    game.softDropping = false;
  }
});
