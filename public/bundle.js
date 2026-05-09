"use strict";
(() => {
  // src/piece.ts
  var PIECE_COLOR_ID = {
    I: 1,
    O: 2,
    T: 3,
    S: 4,
    Z: 5,
    J: 6,
    L: 7
  };
  var COLOR_BY_ID = {
    1: "#00f0f0",
    2: "#f0f000",
    3: "#a000f0",
    4: "#00f000",
    5: "#f00000",
    6: "#3060f0",
    7: "#f0a000"
  };
  var SHAPES = {
    I: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0]
      ],
      [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0]
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0]
      ]
    ],
    O: [
      [
        [1, 1],
        [1, 1]
      ],
      [
        [1, 1],
        [1, 1]
      ],
      [
        [1, 1],
        [1, 1]
      ],
      [
        [1, 1],
        [1, 1]
      ]
    ],
    T: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0]
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0]
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0]
      ]
    ],
    S: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0]
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1]
      ],
      [
        [0, 0, 0],
        [0, 1, 1],
        [1, 1, 0]
      ],
      [
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0]
      ]
    ],
    Z: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0]
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0]
      ],
      [
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 1]
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0]
      ]
    ],
    J: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0]
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0]
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1]
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0]
      ]
    ],
    L: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0]
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1]
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0]
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0]
      ]
    ]
  };
  function getShape(type, rotation) {
    const list = SHAPES[type];
    return list[(rotation % 4 + 4) % 4];
  }
  function getColor(type) {
    return COLOR_BY_ID[PIECE_COLOR_ID[type]];
  }
  var ALL_TYPES = ["I", "O", "T", "S", "Z", "J", "L"];
  var PieceBag = class {
    constructor() {
      this.bag = [];
    }
    next() {
      if (this.bag.length === 0) {
        this.bag = [...ALL_TYPES];
        for (let i = this.bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
      }
      return this.bag.pop();
    }
  };
  function spawnPiece(type) {
    return { type, x: type === "O" ? 4 : 3, y: 0, rotation: 0 };
  }
  function forEachCell(type, rotation, cb) {
    const shape = getShape(type, rotation);
    for (let r = 0; r < shape.length; r++) {
      const row = shape[r];
      for (let c = 0; c < row.length; c++) {
        if (row[c]) cb(c, r);
      }
    }
  }

  // src/board.ts
  var COLS = 10;
  var ROWS = 20;
  function createEmptyGrid() {
    const g = [];
    for (let r = 0; r < ROWS; r++) {
      g.push(new Array(COLS).fill(0));
    }
    return g;
  }
  var Board = class _Board {
    constructor(grid) {
      this.grid = grid ?? createEmptyGrid();
    }
    clone() {
      return new _Board(this.grid.map((row) => row.slice()));
    }
    collides(piece, dx = 0, dy = 0, rotation = piece.rotation) {
      let hit = false;
      forEachCell(piece.type, rotation, (cx, cy) => {
        if (hit) return;
        const x = piece.x + cx + dx;
        const y = piece.y + cy + dy;
        if (x < 0 || x >= COLS || y >= ROWS) {
          hit = true;
          return;
        }
        if (y < 0) return;
        if (this.grid[y][x] !== 0) hit = true;
      });
      return hit;
    }
    merge(piece) {
      const colorId = PIECE_COLOR_ID[piece.type];
      forEachCell(piece.type, piece.rotation, (cx, cy) => {
        const x = piece.x + cx;
        const y = piece.y + cy;
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
          this.grid[y][x] = colorId;
        }
      });
    }
    clearLines() {
      const cleared = [];
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r].every((v) => v !== 0)) cleared.push(r);
      }
      if (cleared.length === 0) return { clearedRows: [], count: 0 };
      const remaining = this.grid.filter((_, idx) => !cleared.includes(idx));
      while (remaining.length < ROWS) remaining.unshift(new Array(COLS).fill(0));
      this.grid = remaining;
      return { clearedRows: cleared, count: cleared.length };
    }
    columnHeights() {
      const heights = new Array(COLS).fill(0);
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (this.grid[r][c] !== 0) {
            heights[c] = ROWS - r;
            break;
          }
        }
      }
      return heights;
    }
    countHoles() {
      let holes = 0;
      for (let c = 0; c < COLS; c++) {
        let blockSeen = false;
        for (let r = 0; r < ROWS; r++) {
          if (this.grid[r][c] !== 0) blockSeen = true;
          else if (blockSeen) holes++;
        }
      }
      return holes;
    }
  };

  // src/particles.ts
  var GRAVITY = 900;
  var MAX_PARTICLES = 600;
  var ParticleSystem = class {
    constructor() {
      this.list = [];
    }
    spawn(p) {
      if (this.list.length >= MAX_PARTICLES) this.list.shift();
      this.list.push(p);
    }
    spawnBurst(cx, cy, color, cellSize) {
      const count = 5;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 220;
        this.spawn({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 120,
          size: cellSize * (0.18 + Math.random() * 0.22),
          color,
          life: 0.7 + Math.random() * 0.4,
          maxLife: 1.1,
          rotation: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 8
        });
      }
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.list.splice(i, 1);
          continue;
        }
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.vr * dt;
      }
    }
    forEach(cb) {
      this.list.forEach(cb);
    }
    clear() {
      this.list = [];
    }
  };

  // src/ai.ts
  var W_HEIGHT = -0.510066;
  var W_LINES = 0.760666;
  var W_HOLES = -0.35663;
  var W_BUMP = -0.184483;
  function simulateDrop(board, piece, rotation, x) {
    const test = { ...piece, x, y: 0, rotation };
    if (board.collides(test, 0, 0, rotation)) return null;
    let dy = 0;
    while (!board.collides(test, 0, dy + 1, rotation)) dy++;
    const finalPiece = { ...test, y: test.y + dy };
    const next = board.clone();
    next.merge(finalPiece);
    return next;
  }
  function evaluate(board) {
    const heights = board.columnHeights();
    const aggregate = heights.reduce((a, b) => a + b, 0);
    const holes = board.countHoles();
    let bumpiness = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }
    let completed = 0;
    for (let r = 0; r < ROWS; r++) {
      if (board.grid[r].every((v) => v !== 0)) completed++;
    }
    return W_HEIGHT * aggregate + W_LINES * completed + W_HOLES * holes + W_BUMP * bumpiness;
  }
  function computeBestMove(board, piece) {
    let best = { rotation: 0, targetX: piece.x, score: -Infinity };
    for (let rot = 0; rot < 4; rot++) {
      let minDx = -COLS;
      let maxDx = COLS;
      for (let x = minDx; x <= maxDx; x++) {
        const test = { ...piece, x, y: 0, rotation: rot };
        let inBounds = true;
        forEachCell(test.type, rot, (cx) => {
          const px = test.x + cx;
          if (px < 0 || px >= COLS) inBounds = false;
        });
        if (!inBounds) continue;
        const next = simulateDrop(board, piece, rot, x);
        if (!next) continue;
        const score = evaluate(next);
        if (score > best.score) best = { rotation: rot, targetX: x, score };
      }
    }
    return best;
  }

  // src/game.ts
  var BASE_DROP_INTERVAL_MS = 600;
  var SOFT_DROP_INTERVAL_MS = 30;
  var AI_TICK_MS = 90;
  var Game = class {
    constructor() {
      this.board = new Board();
      this.bag = new PieceBag();
      this.current = null;
      this.particles = new ParticleSystem();
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.status = "playing";
      this.aiEnabled = true;
      this.speedMultiplier = 1;
      this.softDropping = false;
      this.visualX = 0;
      this.visualY = 0;
      this.onLineClear = null;
      this.onMove = null;
      this.onRotate = null;
      this.onLock = null;
      this.getCellSize = () => 28;
      this.dropAccum = 0;
      this.aiAccum = 0;
      this.aiDecision = null;
      this.next = this.bag.next();
      this.spawn();
    }
    spawn() {
      const type = this.next;
      this.next = this.bag.next();
      this.current = spawnPiece(type);
      this.aiDecision = null;
      if (this.current) {
        this.visualX = this.current.x;
        this.visualY = this.current.y - 0.6;
      }
      if (this.current && this.board.collides(this.current, 0, 0)) {
        this.status = "gameover";
        this.current = null;
      }
    }
    reset() {
      this.board = new Board();
      this.bag = new PieceBag();
      this.particles.clear();
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.speedMultiplier = 1;
      this.status = "playing";
      this.softDropping = false;
      this.next = this.bag.next();
      this.spawn();
    }
    togglePause() {
      if (this.status === "playing") this.status = "paused";
      else if (this.status === "paused") this.status = "playing";
    }
    setAIEnabled(v) {
      this.aiEnabled = v;
      this.aiDecision = null;
    }
    bumpSpeed(delta) {
      const steps = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8];
      const idx = steps.indexOf(this.speedMultiplier);
      const ni = Math.max(0, Math.min(steps.length - 1, (idx === -1 ? 3 : idx) + delta));
      this.speedMultiplier = steps[ni];
    }
    dropInterval() {
      if (this.softDropping) return SOFT_DROP_INTERVAL_MS;
      const levelFactor = Math.max(0.15, 1 - (this.level - 1) * 0.08);
      return BASE_DROP_INTERVAL_MS * levelFactor / this.speedMultiplier;
    }
    aiTickInterval() {
      return Math.max(8, AI_TICK_MS / this.speedMultiplier);
    }
    ghost() {
      if (!this.current) return null;
      let dy = 0;
      while (!this.board.collides(this.current, 0, dy + 1)) dy++;
      return { ...this.current, y: this.current.y + dy };
    }
    moveLeft() {
      if (!this.current || this.status !== "playing") return false;
      if (!this.board.collides(this.current, -1, 0)) {
        this.current.x -= 1;
        this.onMove?.();
        return true;
      }
      return false;
    }
    moveRight() {
      if (!this.current || this.status !== "playing") return false;
      if (!this.board.collides(this.current, 1, 0)) {
        this.current.x += 1;
        this.onMove?.();
        return true;
      }
      return false;
    }
    rotate() {
      if (!this.current || this.status !== "playing") return false;
      const next = (this.current.rotation + 1) % 4;
      const kicks = [0, -1, 1, -2, 2];
      for (const k of kicks) {
        if (!this.board.collides(this.current, k, 0, next)) {
          this.current.x += k;
          this.current.rotation = next;
          this.onRotate?.();
          return true;
        }
      }
      return false;
    }
    hardDrop() {
      if (!this.current || this.status !== "playing") return;
      let dy = 0;
      while (!this.board.collides(this.current, 0, dy + 1)) dy++;
      this.current.y += dy;
      this.score += dy * 2;
      this.lockAndAdvance();
    }
    lockAndAdvance() {
      if (!this.current) return;
      this.onLock?.();
      this.board.merge(this.current);
      const result = this.board.clearLines();
      if (result.count > 0) {
        const cell = this.getCellSize();
        for (const row of result.clearedRows) {
          for (let c = 0; c < COLS; c++) {
            this.particles.spawnBurst(
              (c + 0.5) * cell,
              (row + 0.5) * cell,
              getColor(this.current.type),
              cell
            );
          }
        }
        const lineScores = [0, 100, 300, 500, 800];
        this.score += (lineScores[result.count] ?? 0) * this.level;
        this.lines += result.count;
        this.level = 1 + Math.floor(this.lines / 10);
        this.onLineClear?.(result.count);
      }
      this.spawn();
    }
    step(dtMs) {
      if (this.status !== "playing") return;
      if (!this.current) return;
      if (this.aiEnabled) {
        this.aiAccum += dtMs;
        const aiInterval = this.aiTickInterval();
        let aiBudget = 24;
        while (this.aiAccum >= aiInterval && aiBudget-- > 0) {
          this.aiAccum -= aiInterval;
          if (!this.current) break;
          if (!this.aiDecision) this.aiDecision = computeBestMove(this.board, this.current);
          this.aiAdvance();
        }
        this.dropAccum = 0;
        return;
      }
      this.dropAccum += dtMs;
      let gravityBudget = 64;
      let interval = this.dropInterval();
      while (this.dropAccum >= interval && gravityBudget-- > 0) {
        this.dropAccum -= interval;
        this.gravityTick();
        if (!this.current) break;
        interval = this.dropInterval();
      }
      if (this.dropAccum > interval * 4) this.dropAccum = 0;
    }
    aiAdvance() {
      if (!this.current || !this.aiDecision) return;
      if (this.current.rotation !== this.aiDecision.rotation) {
        this.rotate();
        return;
      }
      if (this.current.x < this.aiDecision.targetX) {
        if (!this.moveRight()) this.gravityTick();
        return;
      }
      if (this.current.x > this.aiDecision.targetX) {
        if (!this.moveLeft()) this.gravityTick();
        return;
      }
      this.gravityTick();
    }
    gravityTick() {
      if (!this.current) return;
      if (!this.board.collides(this.current, 0, 1)) {
        this.current.y += 1;
        if (this.softDropping) this.score += 1;
      } else {
        this.lockAndAdvance();
      }
    }
    updateParticles(dtMs) {
      this.particles.update(dtMs / 1e3);
    }
    updateVisual(dtMs) {
      if (!this.current) return;
      const dt = dtMs / 1e3;
      const lerpRate = 22;
      const k = 1 - Math.exp(-lerpRate * dt);
      this.visualX += (this.current.x - this.visualX) * k;
      this.visualY += (this.current.y - this.visualY) * k;
      if (Math.abs(this.visualX - this.current.x) < 1e-3) this.visualX = this.current.x;
      if (Math.abs(this.visualY - this.current.y) < 1e-3) this.visualY = this.current.y;
    }
    visualPiece() {
      if (!this.current) return null;
      return { ...this.current, x: this.visualX, y: this.visualY };
    }
    snapshot() {
      return {
        score: this.score,
        lines: this.lines,
        level: this.level,
        speed: this.speedMultiplier,
        status: this.status,
        aiEnabled: this.aiEnabled,
        manualControl: !this.aiEnabled
      };
    }
  };

  // src/renderer.ts
  var MIN_CELL = 12;
  var MAX_CELL = 64;
  var SCAN_SPEED_PX = 180;
  var SCAN_WIDTH_PX = 140;
  var Renderer = class {
    constructor(canvas2, nextCanvas2) {
      this.canvas = canvas2;
      this.nextCanvas = nextCanvas2;
      this.cell = 28;
      this.elapsed = 0;
      this.shakeTime = 0;
      this.shakeMagnitude = 0;
      this.lastNow = performance.now();
      const ctx = canvas2.getContext("2d");
      const nctx = nextCanvas2.getContext("2d");
      if (!ctx || !nctx) throw new Error("Canvas 2D unsupported");
      this.ctx = ctx;
      this.nextCtx = nctx;
      this.applyCellSize();
    }
    shake(magnitude, duration) {
      this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
      this.shakeTime = Math.max(this.shakeTime, duration);
    }
    fitTo(availWidth, availHeight) {
      if (availWidth <= 0 || availHeight <= 0) return;
      const byWidth = Math.floor(availWidth / COLS);
      const byHeight = Math.floor(availHeight / ROWS);
      const target = Math.max(MIN_CELL, Math.min(MAX_CELL, Math.min(byWidth, byHeight)));
      if (target === this.cell) return;
      this.cell = target;
      this.applyCellSize();
    }
    applyCellSize() {
      this.canvas.width = COLS * this.cell;
      this.canvas.height = ROWS * this.cell;
    }
    cellSize() {
      return this.cell;
    }
    render(board, piece, ghost, particles) {
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastNow) / 1e3);
      this.lastNow = now;
      this.elapsed += dt;
      if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - dt);
      const ctx = this.ctx;
      const cell = this.cell;
      const W = this.canvas.width;
      const H = this.canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      let shakeX = 0;
      let shakeY = 0;
      if (this.shakeTime > 0 && this.shakeMagnitude > 0) {
        const decay = this.shakeTime / 0.6;
        const amp = this.shakeMagnitude * decay;
        shakeX = (Math.random() - 0.5) * 2 * amp;
        shakeY = (Math.random() - 0.5) * 2 * amp;
        if (this.shakeTime <= 0) this.shakeMagnitude = 0;
      }
      ctx.setTransform(1, 0, 0, 1, shakeX, shakeY);
      ctx.fillStyle = "#11141d";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * cell, 0);
        ctx.lineTo(c * cell, H);
        ctx.stroke();
      }
      for (let r = 1; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * cell);
        ctx.lineTo(W, r * cell);
        ctx.stroke();
      }
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = board.grid[r][c];
          if (v) drawBlock(ctx, c * cell, r * cell, cell, COLOR_BY_ID[v]);
        }
      }
      this.drawScanLight(ctx, W, H, cell, board);
      if (ghost) {
        forEachCell(ghost.type, ghost.rotation, (dx, dy) => {
          const x = (ghost.x + dx) * cell;
          const y = (ghost.y + dy) * cell;
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
          ctx.strokeStyle = "rgba(255,255,255,0.25)";
          ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
        });
      }
      if (piece) {
        const color = getColor(piece.type);
        forEachCell(piece.type, piece.rotation, (dx, dy) => {
          drawBlock(ctx, (piece.x + dx) * cell, (piece.y + dy) * cell, cell, color);
        });
      }
      particles.forEach((p) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    drawScanLight(ctx, W, H, cell, board) {
      const diagMax = W + H;
      const period = diagMax + SCAN_WIDTH_PX * 2;
      const wavePos = this.elapsed * SCAN_SPEED_PX % period - SCAN_WIDTH_PX;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = board.grid[r][c];
          if (!v) continue;
          const cx = c * cell + cell / 2;
          const cy = r * cell + cell / 2;
          const distToWave = Math.abs(cx + cy - wavePos);
          if (distToWave > SCAN_WIDTH_PX) continue;
          const wave = 1 - distToWave / SCAN_WIDTH_PX;
          const intensity = wave * wave * 0.55;
          ctx.fillStyle = `rgba(180, 220, 255, ${intensity})`;
          ctx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "rgba(160, 210, 255, 0.18)";
      ctx.lineWidth = 1;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const cx = c * cell + cell / 2;
          const cy = r * cell + cell / 2;
          const distToWave = Math.abs(cx + cy - wavePos);
          if (distToWave > SCAN_WIDTH_PX) continue;
          const wave = 1 - distToWave / SCAN_WIDTH_PX;
          ctx.globalAlpha = wave * wave * 0.5;
          ctx.strokeRect(c * cell + 0.5, r * cell + 0.5, cell - 1, cell - 1);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    renderNext(piece) {
      const ctx = this.nextCtx;
      const w = this.nextCanvas.width;
      const h = this.nextCanvas.height;
      ctx.fillStyle = "#11141d";
      ctx.fillRect(0, 0, w, h);
      if (!piece) return;
      let minX = 4, minY = 4, maxX = -1, maxY = -1;
      forEachCell(piece.type, 0, (cx, cy) => {
        if (cx < minX) minX = cx;
        if (cy < minY) minY = cy;
        if (cx > maxX) maxX = cx;
        if (cy > maxY) maxY = cy;
      });
      const pw = maxX - minX + 1;
      const ph = maxY - minY + 1;
      const cell = Math.min(w / (pw + 1), h / (ph + 1));
      const ox = (w - pw * cell) / 2 - minX * cell;
      const oy = (h - ph * cell) / 2 - minY * cell;
      const color = getColor(piece.type);
      forEachCell(piece.type, 0, (cx, cy) => {
        drawBlock(ctx, ox + cx * cell, oy + cy * cell, cell, color);
      });
    }
  };
  function drawBlock(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
    const inset = Math.max(1, size * 0.08);
    ctx.fillStyle = lighten(color, 0.35);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size - inset, y + inset);
    ctx.lineTo(x + inset, y + inset);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x + inset, y + size - inset);
    ctx.lineTo(x + inset, y + inset);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = darken(color, 0.4);
    ctx.beginPath();
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size - inset, y + size - inset);
    ctx.lineTo(x + size - inset, y + inset);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x + size - inset, y + size - inset);
    ctx.lineTo(x + inset, y + size - inset);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = parseInt(h, 16);
    return [v >> 16 & 255, v >> 8 & 255, v & 255];
  }
  function rgbToHex(r, g, b) {
    const c = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`;
  }
  function lighten(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  }
  function darken(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
  }

  // src/background.ts
  var RAIN_COUNT = 240;
  var WIND_X = -120;
  var RAIN_SPEED_MIN = 800;
  var RAIN_SPEED_MAX = 1300;
  var CLOUD_HEIGHT = 200;
  var SPLASH_RAIN_PROB = 0.45;
  var SPLASH_GRAVITY = 1400;
  var NOISE_TILE_W = 512;
  var NOISE_TILE_H = 256;
  var Background = class {
    constructor(canvas2) {
      this.canvas = canvas2;
      this.dpr = 1;
      this.widthCss = 0;
      this.heightCss = 0;
      this.rain = [];
      this.splashes = [];
      this.bolts = [];
      this.flashes = [];
      this.cloudTile = null;
      this.rafId = null;
      this.elapsed = 0;
      this.boardCanvas = null;
      this.getBoardRect = null;
      this.onRipple = null;
      this.onThunder = null;
      this.resize = () => {
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.widthCss = window.innerWidth;
        this.heightCss = window.innerHeight;
        this.canvas.width = Math.floor(this.widthCss * this.dpr);
        this.canvas.height = Math.floor(this.heightCss * this.dpr);
        this.canvas.style.width = `${this.widthCss}px`;
        this.canvas.style.height = `${this.heightCss}px`;
      };
      const ctx = canvas2.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D unsupported");
      this.ctx = ctx;
      this.resize();
      window.addEventListener("resize", this.resize);
      this.initRain();
      this.cloudTile = generateCloudNoiseTile(NOISE_TILE_W, NOISE_TILE_H);
    }
    attachBoard(boardCanvas, getRect) {
      this.boardCanvas = boardCanvas;
      this.getBoardRect = getRect;
    }
    waterLineY() {
      if (this.getBoardRect) {
        const r = this.getBoardRect();
        return r.bottom + 24;
      }
      return this.heightCss * 0.7;
    }
    initRain() {
      this.rain = [];
      for (let i = 0; i < RAIN_COUNT; i++) {
        this.rain.push(this.makeDrop(true));
      }
    }
    makeDrop(initial = false) {
      const speed = RAIN_SPEED_MIN + Math.random() * (RAIN_SPEED_MAX - RAIN_SPEED_MIN);
      const depth = (speed - RAIN_SPEED_MIN) / (RAIN_SPEED_MAX - RAIN_SPEED_MIN);
      const water2 = this.waterLineY();
      return {
        x: Math.random() * (this.widthCss + 200) - 100,
        y: initial ? Math.random() * water2 : -20 - Math.random() * 80,
        len: 10 + depth * 18,
        speed,
        alpha: 0.18 + depth * 0.42,
        hitY: water2
      };
    }
    getFlash() {
      return this.currentFlash();
    }
    flashLightning(linesCleared) {
      const intensity = Math.min(1, 0.55 + linesCleared * 0.18);
      this.flashes.push({ life: 0.55, maxLife: 0.55, intensity });
      const boltCount = 1 + Math.min(2, Math.floor(linesCleared / 2));
      for (let i = 0; i < boltCount; i++) {
        this.bolts.push(this.makeBolt());
      }
      this.onThunder?.();
    }
    makeBolt() {
      const startX = this.widthCss * (0.15 + Math.random() * 0.7);
      const startY = 30 + Math.random() * (CLOUD_HEIGHT - 60);
      const segments = [{ x: startX, y: startY }];
      let x = startX;
      let y = startY;
      const targetY = this.heightCss * (0.4 + Math.random() * 0.35);
      while (y < targetY) {
        const stepY = 16 + Math.random() * 26;
        const stepX = (Math.random() - 0.5) * 70;
        x += stepX;
        y += stepY;
        segments.push({ x, y });
      }
      return { segments, life: 0.22, maxLife: 0.22, startX, startY };
    }
    spawnSplash(x, y) {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 0.65;
        const speed = 90 + Math.random() * 120;
        const life = 0.32 + Math.random() * 0.18;
        this.splashes.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life,
          maxLife: life,
          size: 1 + Math.random() * 1.4
        });
      }
      if (this.splashes.length > 240) this.splashes.splice(0, this.splashes.length - 240);
      this.onRipple?.();
    }
    start() {
      if (this.rafId !== null) return;
      let last = performance.now();
      const tick = (now) => {
        const dt = Math.min(50, now - last) / 1e3;
        last = now;
        this.elapsed += dt;
        this.update(dt);
        this.draw();
        this.rafId = requestAnimationFrame(tick);
      };
      this.rafId = requestAnimationFrame(tick);
    }
    update(dt) {
      const water2 = this.waterLineY();
      for (let i = 0; i < this.rain.length; i++) {
        const d = this.rain[i];
        d.x += WIND_X * dt;
        d.y += d.speed * dt;
        if (d.y >= d.hitY) {
          if (Math.random() < SPLASH_RAIN_PROB) {
            this.spawnSplash(d.x, water2);
          }
          this.rain[i] = this.makeDrop();
        } else if (d.x < -50) {
          this.rain[i] = this.makeDrop();
        }
      }
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.life -= dt;
        if (s.life <= 0) {
          this.splashes.splice(i, 1);
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += SPLASH_GRAVITY * dt;
      }
      for (let i = this.bolts.length - 1; i >= 0; i--) {
        this.bolts[i].life -= dt;
        if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
      }
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        this.flashes[i].life -= dt;
        if (this.flashes[i].life <= 0) this.flashes.splice(i, 1);
      }
    }
    currentFlash() {
      let a = 0;
      for (const f of this.flashes) {
        const t = f.life / f.maxLife;
        a = Math.max(a, t * t * f.intensity);
      }
      return a;
    }
    draw() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const flash = this.currentFlash();
      const water2 = this.waterLineY();
      const skyGrad = ctx.createLinearGradient(0, 0, 0, this.heightCss);
      skyGrad.addColorStop(0, "#070a13");
      skyGrad.addColorStop(0.55, "#0d1320");
      skyGrad.addColorStop(1, "#050811");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, this.widthCss, this.heightCss);
      this.drawClouds(ctx, flash);
      this.drawRain(ctx, water2);
      this.drawSplashes(ctx);
      this.drawBolts(ctx);
      if (flash > 0) {
        ctx.fillStyle = `rgba(220, 230, 255, ${flash * 0.45})`;
        ctx.fillRect(0, 0, this.widthCss, this.heightCss);
      }
    }
    drawClouds(ctx, flash) {
      const tile = this.cloudTile;
      if (!tile) return;
      const w = this.widthCss;
      const tileW = tile.width;
      const tileH = tile.height;
      const layers = [
        { scaleX: 1, scaleY: 0.55, speed: 9, alpha: 0.55, tint: 18 },
        { scaleX: 1.6, scaleY: 0.85, speed: 16, alpha: 0.4, tint: 0 },
        { scaleX: 0.7, scaleY: 0.4, speed: 26, alpha: 0.3, tint: 30 }
      ];
      ctx.save();
      for (const layer of layers) {
        const drawW = tileW * layer.scaleX;
        const drawH = tileH * layer.scaleY;
        const offset = this.elapsed * layer.speed % drawW;
        const baseY = -drawH * 0.15;
        const baseAlpha = layer.alpha + flash * 0.45;
        ctx.globalAlpha = Math.min(0.95, baseAlpha);
        const tintShift = layer.tint + Math.round(flash * 180);
        ctx.globalCompositeOperation = flash > 0.05 ? "screen" : "source-over";
        const filterTint = 30 + tintShift;
        ctx.filter = `brightness(${0.5 + flash * 1.2}) hue-rotate(${filterTint}deg)`;
        let x = -offset - drawW;
        while (x < w + drawW) {
          ctx.drawImage(tile, x, baseY, drawW, drawH);
          x += drawW;
        }
      }
      ctx.restore();
    }
    drawRain(ctx, water2) {
      ctx.strokeStyle = "rgba(180, 210, 255, 0.6)";
      ctx.lineWidth = 1;
      for (const d of this.rain) {
        if (d.y > water2 && d.hitY > water2) continue;
        const tail = Math.atan2(d.speed, WIND_X);
        const dx = Math.cos(tail) * d.len;
        const dy = Math.sin(tail) * d.len;
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - dx, d.y - dy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    drawSplashes(ctx) {
      ctx.fillStyle = "rgba(190, 220, 255, 1)";
      for (const s of this.splashes) {
        const t = s.life / s.maxLife;
        const alpha = Math.min(1, t * 1.6);
        ctx.globalAlpha = alpha * 0.85;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawBolts(ctx) {
      for (const b of this.bolts) {
        const t = b.life / b.maxLife;
        ctx.shadowColor = "rgba(180, 210, 255, 0.95)";
        ctx.shadowBlur = 24;
        ctx.strokeStyle = `rgba(255, 255, 255, ${t * 0.95})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(b.segments[0].x, b.segments[0].y);
        for (let i = 1; i < b.segments.length; i++) {
          ctx.lineTo(b.segments[i].x, b.segments[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(220, 235, 255, ${t})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        const halo = ctx.createRadialGradient(b.startX, b.startY, 0, b.startX, b.startY, 90);
        halo.addColorStop(0, `rgba(220, 235, 255, ${t * 0.55})`);
        halo.addColorStop(1, "rgba(220, 235, 255, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(b.startX, b.startY, 90, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  function generateCloudNoiseTile(width, height) {
    const tile = document.createElement("canvas");
    tile.width = width;
    tile.height = height;
    const ctx = tile.getContext("2d");
    if (!ctx) return tile;
    const img = ctx.createImageData(width, height);
    const data = img.data;
    const octaves = [
      { cellsX: 8, cellsY: 4, amp: 0.5 },
      { cellsX: 16, cellsY: 8, amp: 0.28 },
      { cellsX: 32, cellsY: 16, amp: 0.15 },
      { cellsX: 64, cellsY: 32, amp: 0.07 }
    ];
    const grids = octaves.map((o) => {
      const arr = new Float32Array(o.cellsX * o.cellsY);
      for (let i = 0; i < arr.length; i++) arr[i] = Math.random();
      return arr;
    });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let oi = 0; oi < octaves.length; oi++) {
          const o = octaves[oi];
          const grid = grids[oi];
          const fx = x / width * o.cellsX;
          const fy = y / height * o.cellsY;
          const ix = Math.floor(fx);
          const iy = Math.floor(fy);
          const tx = smoothstep(fx - ix);
          const ty = smoothstep(fy - iy);
          const ix0 = ix % o.cellsX;
          const ix1 = (ix + 1) % o.cellsX;
          const iy0 = Math.min(iy, o.cellsY - 1);
          const iy1 = Math.min(iy + 1, o.cellsY - 1);
          const v00 = grid[iy0 * o.cellsX + ix0];
          const v10 = grid[iy0 * o.cellsX + ix1];
          const v01 = grid[iy1 * o.cellsX + ix0];
          const v11 = grid[iy1 * o.cellsX + ix1];
          const a = v00 + (v10 - v00) * tx;
          const b = v01 + (v11 - v01) * tx;
          sum += (a + (b - a) * ty) * o.amp;
        }
        const yNorm = y / height;
        const fade = Math.sin(yNorm * Math.PI);
        const v = Math.max(0, sum * fade - 0.18);
        const alpha = Math.min(255, Math.round(v * 320));
        const idx = (y * width + x) * 4;
        data[idx] = 30;
        data[idx + 1] = 36;
        data[idx + 2] = 52;
        data[idx + 3] = alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    return tile;
  }
  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  // src/water.ts
  var VERT_SRC = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;
  var FRAG_SRC = `
precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_board;
uniform vec4 u_boardRect;
uniform vec2 u_resolution;
uniform float u_waterY;
uniform float u_time;
uniform float u_flash;
uniform vec4 u_boardBg;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec2 waterDisplacement(vec2 px, float depth) {
  float t = u_time;

  float dx = 0.0;
  dx += sin(px.y * 0.045 + t * 1.7) * 6.0;
  dx += sin(px.y * 0.012 - t * 1.1 + px.x * 0.004) * 4.5;
  dx += sin(px.y * 0.09 + t * 3.1 + px.x * 0.02) * 2.2;
  dx += (vnoise(vec2(px.x * 0.012, px.y * 0.02 + t * 0.6)) - 0.5) * 8.0;

  float dy = 0.0;
  dy += sin(px.x * 0.03 + t * 1.4) * 1.6;
  dy += (vnoise(vec2(px.x * 0.02 - t * 0.4, px.y * 0.03)) - 0.5) * 3.0;

  float depthFactor = clamp(depth / 80.0, 0.25, 1.4);
  return vec2(dx, dy) * depthFactor;
}

float surfaceShimmer(vec2 px) {
  float t = u_time;
  float n1 = vnoise(vec2(px.x * 0.05 - t * 0.7, px.y * 0.08 + t * 0.5));
  float n2 = vnoise(vec2(px.x * 0.12 + t * 1.1, px.y * 0.18 - t * 0.9));
  return n1 * 0.6 + n2 * 0.4;
}

void main() {
  vec2 px = v_uv * u_resolution;
  px.y = u_resolution.y - px.y;

  if (px.y < u_waterY) {
    discard;
  }

  float depth = px.y - u_waterY;
  vec2 mirrorPx = vec2(px.x, u_waterY - depth);

  vec2 disp = waterDisplacement(px, depth);
  mirrorPx += disp;

  vec2 boardUV = (mirrorPx - u_boardRect.xy) / u_boardRect.zw;

  vec4 reflectColor;
  if (boardUV.x >= 0.0 && boardUV.x <= 1.0 && boardUV.y >= 0.0 && boardUV.y <= 1.0) {
    reflectColor = texture2D(u_board, boardUV);
  } else {
    reflectColor = u_boardBg;
  }

  float fade = exp(-depth / 220.0);
  float edgeBand = exp(-depth / 5.0) * 0.55;

  float shimmer = surfaceShimmer(px);
  float shimmerHi = smoothstep(0.62, 0.95, shimmer) * (0.35 + edgeBand * 0.6);

  vec3 waterTint = mix(vec3(0.05, 0.08, 0.13), vec3(0.10, 0.16, 0.24), fade);
  vec3 col = mix(waterTint, reflectColor.rgb * vec3(0.85, 0.92, 1.05), fade * 0.72);
  col += vec3(0.55, 0.7, 0.95) * edgeBand;
  col += vec3(0.75, 0.85, 1.0) * shimmerHi;
  col += vec3(0.7, 0.78, 0.95) * u_flash * 0.35 * fade;

  float alpha = 0.55 + fade * 0.4;
  gl_FragColor = vec4(col, alpha);
}
`;
  var Water = class {
    constructor(canvas2) {
      this.canvas = canvas2;
      this.dpr = 1;
      this.widthCss = 0;
      this.heightCss = 0;
      this.boardCanvas = null;
      this.getBoardRect = null;
      this.getWaterY = () => 0;
      this.getFlash = () => 0;
      this.uLoc = {};
      this.resize = () => {
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.widthCss = window.innerWidth;
        this.heightCss = window.innerHeight;
        this.canvas.width = Math.floor(this.widthCss * this.dpr);
        this.canvas.height = Math.floor(this.heightCss * this.dpr);
        this.canvas.style.width = `${this.widthCss}px`;
        this.canvas.style.height = `${this.heightCss}px`;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      };
      const gl = canvas2.getContext("webgl", { premultipliedAlpha: false, alpha: true });
      if (!gl) throw new Error("WebGL unsupported");
      this.gl = gl;
      this.program = createProgram(gl, VERT_SRC, FRAG_SRC);
      gl.useProgram(this.program);
      this.cacheUniforms();
      this.quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW
      );
      const aPos = gl.getAttribLocation(this.program, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      this.resize();
      window.addEventListener("resize", this.resize);
    }
    attachBoard(boardCanvas, getRect) {
      this.boardCanvas = boardCanvas;
      this.getBoardRect = getRect;
    }
    configure(opts) {
      this.getWaterY = opts.getWaterY;
      this.getFlash = opts.getFlash;
    }
    cacheUniforms() {
      const gl = this.gl;
      const names = [
        "u_board",
        "u_boardRect",
        "u_resolution",
        "u_waterY",
        "u_time",
        "u_flash",
        "u_boardBg"
      ];
      for (const n of names) this.uLoc[n] = gl.getUniformLocation(this.program, n);
    }
    render(timeSeconds) {
      const gl = this.gl;
      if (!this.boardCanvas || !this.getBoardRect) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return;
      }
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.boardCanvas);
      const rect = this.getBoardRect();
      const waterY = this.getWaterY();
      const flash = this.getFlash();
      gl.useProgram(this.program);
      gl.uniform1i(this.uLoc["u_board"], 0);
      gl.uniform4f(this.uLoc["u_boardRect"], rect.left, rect.top, rect.width, rect.height);
      gl.uniform2f(this.uLoc["u_resolution"], this.widthCss, this.heightCss);
      gl.uniform1f(this.uLoc["u_waterY"], waterY);
      gl.uniform1f(this.uLoc["u_time"], timeSeconds);
      gl.uniform1f(this.uLoc["u_flash"], flash);
      gl.uniform4f(this.uLoc["u_boardBg"], 17 / 255, 20 / 255, 29 / 255, 1);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  };
  function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    if (!sh) throw new Error("createShader failed");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(sh) ?? "";
      gl.deleteShader(sh);
      throw new Error(`Shader compile failed: ${info}`);
    }
    return sh;
  }
  function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program) ?? "";
      throw new Error(`Program link failed: ${info}`);
    }
    return program;
  }

  // src/audio.ts
  var STORAGE_KEY = "ai-tetris.audio";
  var SFX_FILES = {
    move: "public/audio/move.mp3",
    rotate: "public/audio/rotate.mp3",
    drop: "public/audio/drop.wav",
    lineClear: "public/audio/line-clear.mp3",
    waterDrop: "public/audio/water-drop.mp3",
    thunder: "public/audio/thunder.mp3"
  };
  var LOOP_FILES = {
    bgm: "public/audio/bgm.mp3",
    rain: "public/audio/rain-loop.mp3"
  };
  var DEFAULT_STATE = {
    muted: false,
    master: 0.85,
    music: 0.55,
    ambient: 0.45,
    sfx: 0.7
  };
  var AudioManager = class {
    constructor() {
      this.ctx = null;
      this.buffers = /* @__PURE__ */ new Map();
      this.loops = /* @__PURE__ */ new Map();
      this.lastPlayedAt = /* @__PURE__ */ new Map();
      this.loadingPromise = null;
      this.unlocked = false;
      this.state = this.loadState();
    }
    loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
      } catch {
      }
      return { ...DEFAULT_STATE };
    }
    saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
      }
    }
    isMuted() {
      return this.state.muted;
    }
    ensureContext() {
      if (this.ctx) return this.ctx;
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.ambientBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.ambientBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyVolumes();
      return this.ctx;
    }
    attachUnlock(target = window) {
      const handler = async () => {
        const ctx = this.ensureContext();
        if (ctx.state === "suspended") {
          try {
            await ctx.resume();
          } catch {
          }
        }
        if (ctx.state === "running") {
          this.unlocked = true;
          await this.preload();
          this.startBackgroundLoops();
          target.removeEventListener("pointerdown", handler);
          target.removeEventListener("keydown", handler);
          target.removeEventListener("touchstart", handler);
        }
      };
      target.addEventListener("pointerdown", handler);
      target.addEventListener("keydown", handler);
      target.addEventListener("touchstart", handler, { passive: true });
    }
    preload() {
      if (this.loadingPromise) return this.loadingPromise;
      const ctx = this.ensureContext();
      const all = [];
      for (const [name, url] of Object.entries(SFX_FILES)) {
        all.push(this.loadInto(ctx, name, url));
      }
      for (const [name, url] of Object.entries(LOOP_FILES)) {
        all.push(this.loadInto(ctx, name, url));
      }
      this.loadingPromise = Promise.all(all).then(() => void 0);
      return this.loadingPromise;
    }
    async loadInto(ctx, name, url) {
      if (this.buffers.has(name)) return;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ab = await res.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        this.buffers.set(name, buf);
      } catch (err) {
        console.warn(`[audio] failed to load ${name}: ${err.message}`);
      }
    }
    startBackgroundLoops() {
      this.playLoop("bgm");
      this.playLoop("rain");
    }
    playSfx(name, opts = {}) {
      if (!this.unlocked || this.state.muted) return;
      const ctx = this.ctx;
      if (!ctx) return;
      const buffer = this.buffers.get(name);
      if (!buffer) return;
      const throttle = opts.throttleMs ?? 0;
      if (throttle > 0) {
        const last = this.lastPlayedAt.get(name) ?? 0;
        const now = performance.now();
        if (now - last < throttle) return;
        this.lastPlayedAt.set(name, now);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      if (opts.detuneCents) {
        try {
          src.detune.value = opts.detuneCents;
        } catch {
        }
      }
      const g = ctx.createGain();
      g.gain.value = opts.volume ?? 1;
      src.connect(g);
      g.connect(this.sfxBus);
      src.start(0);
    }
    playLoop(name) {
      const ctx = this.ctx;
      if (!ctx) return;
      const buffer = this.buffers.get(name);
      if (!buffer) return;
      if (this.loops.has(name)) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = 1;
      src.connect(g);
      g.connect(name === "bgm" ? this.musicBus : this.ambientBus);
      src.start(0);
      this.loops.set(name, { source: src, gain: g });
    }
    stopLoop(name) {
      const h = this.loops.get(name);
      if (!h || !this.ctx) return;
      const t = this.ctx.currentTime;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setValueAtTime(h.gain.gain.value, t);
      h.gain.gain.linearRampToValueAtTime(0, t + 0.4);
      h.source.stop(t + 0.45);
      this.loops.delete(name);
    }
    setMuted(muted) {
      this.state.muted = muted;
      this.saveState();
      this.applyVolumes();
    }
    toggleMute() {
      this.setMuted(!this.state.muted);
      return this.state.muted;
    }
    applyVolumes() {
      if (!this.ctx) return;
      const m = this.state.muted ? 0 : this.state.master;
      this.master.gain.value = m;
      this.musicBus.gain.value = this.state.music;
      this.ambientBus.gain.value = this.state.ambient;
      this.sfxBus.gain.value = this.state.sfx;
    }
  };
  function randomDetune() {
    return (Math.random() - 0.5) * 100;
  }

  // src/main.ts
  if (window.location.protocol === "file:") {
    const banner = document.getElementById("file-protocol-banner");
    if (banner) banner.classList.add("show");
    console.error(
      "[ai-tetris] file:// \u534F\u8BAE\u4E0B\u6D4F\u89C8\u5668\u4F1A\u963B\u6B62\u52A0\u8F7D\u97F3\u9891\u8D44\u6E90\u3002\u8BF7\u901A\u8FC7 `npm run dev` \u542F\u52A8\u540E\u8BBF\u95EE http://localhost:8080/\u3002"
    );
  }
  var canvas = document.getElementById("canvas");
  var nextCanvas = document.getElementById("next-canvas");
  var overlay = document.getElementById("overlay");
  var elScore = document.getElementById("score");
  var elLines = document.getElementById("lines");
  var elLevel = document.getElementById("level");
  var elSpeed = document.getElementById("speed");
  var elStatus = document.getElementById("status");
  var btnPause = document.getElementById("btn-pause");
  var btnAI = document.getElementById("btn-ai");
  var btnSlower = document.getElementById("btn-slower");
  var btnFaster = document.getElementById("btn-faster");
  var btnRestart = document.getElementById("btn-restart");
  var btnRestart2 = document.getElementById("btn-restart-2");
  var btnSound = document.getElementById("btn-sound");
  var stageEl = document.getElementById("stage");
  var sideEl = document.getElementById("side");
  var game = new Game();
  var renderer = new Renderer(canvas, nextCanvas);
  game.getCellSize = () => renderer.cellSize();
  var bgCanvas = document.getElementById("bg-canvas");
  var waterCanvas = document.getElementById("water-canvas");
  var background = new Background(bgCanvas);
  var boardRect = () => canvas.getBoundingClientRect();
  background.attachBoard(canvas, boardRect);
  background.start();
  var water = null;
  try {
    water = new Water(waterCanvas);
    water.attachBoard(canvas, boardRect);
    water.configure({
      getWaterY: () => background.waterLineY(),
      getFlash: () => background.getFlash()
    });
  } catch (err) {
    console.warn("WebGL water layer disabled:", err);
  }
  var audio = new AudioManager();
  audio.attachUnlock(window);
  function refreshSoundButton() {
    btnSound.textContent = audio.isMuted() ? "\u{1F507} \u9759\u97F3" : "\u{1F50A} \u58F0\u97F3";
    btnSound.classList.toggle("active", !audio.isMuted());
  }
  refreshSoundButton();
  game.onMove = () => audio.playSfx("move", { volume: 0.55, detuneCents: randomDetune(), throttleMs: 40 });
  game.onRotate = () => audio.playSfx("rotate", { volume: 0.6, detuneCents: randomDetune(), throttleMs: 60 });
  game.onLock = () => audio.playSfx("drop", { volume: 0.55, detuneCents: randomDetune() });
  game.onLineClear = (count) => {
    background.flashLightning(count);
    const magnitude = 4 + count * 3;
    const duration = 0.35 + count * 0.08;
    renderer.shake(magnitude, duration);
    audio.playSfx("lineClear", { volume: 0.75 });
  };
  background.onRipple = () => audio.playSfx("waterDrop", { volume: 0.18, detuneCents: randomDetune(), throttleMs: 180 });
  background.onThunder = () => audio.playSfx("thunder", { volume: 0.85, detuneCents: randomDetune() });
  function syncUI() {
    const s = game.snapshot();
    elScore.textContent = String(s.score);
    elLines.textContent = String(s.lines);
    elLevel.textContent = String(s.level);
    elSpeed.textContent = `${s.speed.toFixed(2)}x`;
    if (s.status === "gameover") elStatus.textContent = "Game Over";
    else if (s.status === "paused") elStatus.textContent = "\u5DF2\u6682\u505C";
    else elStatus.textContent = s.aiEnabled ? "AI \u81EA\u52A8" : "\u624B\u52A8\u63A7\u5236";
    btnPause.textContent = s.status === "paused" ? "\u7EE7\u7EED" : "\u6682\u505C";
    btnAI.textContent = s.aiEnabled ? "AI: \u5F00" : "AI: \u5173";
    btnAI.classList.toggle("active", s.aiEnabled);
    overlay.classList.toggle("show", s.status === "gameover");
  }
  function loop(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;
    game.step(dt);
    game.updateVisual(dt);
    game.updateParticles(dt);
    renderer.render(game.board, game.visualPiece(), game.ghost(), game.particles);
    renderer.renderNext(game.next ? spawnPiece(game.next) : null);
    water?.render(now / 1e3);
    syncUI();
    requestAnimationFrame(loop);
  }
  var lastTime = performance.now();
  requestAnimationFrame(loop);
  btnPause.addEventListener("click", () => {
    if (game.status === "gameover") return;
    game.togglePause();
  });
  btnAI.addEventListener("click", () => game.setAIEnabled(!game.aiEnabled));
  btnSlower.addEventListener("click", () => game.bumpSpeed(-1));
  btnFaster.addEventListener("click", () => game.bumpSpeed(1));
  btnRestart.addEventListener("click", () => game.reset());
  btnRestart2.addEventListener("click", () => game.reset());
  btnSound.addEventListener("click", () => {
    audio.toggleMute();
    refreshSoundButton();
  });
  var STAGE_PADDING_X = 16;
  var STAGE_PADDING_TOP = 32;
  var REFLECTION_RESERVE_RATIO = 0.4;
  var REFLECTION_RESERVE_MAX = 320;
  var REFLECTION_RESERVE_MIN = 120;
  function fitBoard() {
    const stageRect = stageEl.getBoundingClientRect();
    const reflectionReserve = Math.min(
      REFLECTION_RESERVE_MAX,
      Math.max(REFLECTION_RESERVE_MIN, stageRect.height * REFLECTION_RESERVE_RATIO)
    );
    const availW = Math.max(0, stageRect.width - STAGE_PADDING_X * 2);
    const availH = Math.max(0, stageRect.height - STAGE_PADDING_TOP - reflectionReserve);
    renderer.fitTo(availW, availH);
  }
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(fitBoard);
    ro.observe(stageEl);
    ro.observe(sideEl);
  } else {
    window.addEventListener("resize", fitBoard);
  }
  window.addEventListener("orientationchange", fitBoard);
  fitBoard();
  window.addEventListener("keydown", (e) => {
    if (e.key === "p" || e.key === "P") {
      if (game.status !== "gameover") game.togglePause();
      e.preventDefault();
      return;
    }
    if (e.key === "a" || e.key === "A") {
      game.setAIEnabled(!game.aiEnabled);
      e.preventDefault();
      return;
    }
    if (e.key === "m" || e.key === "M") {
      audio.toggleMute();
      refreshSoundButton();
      e.preventDefault();
      return;
    }
    if (e.key === "[") {
      game.bumpSpeed(-1);
      return;
    }
    if (e.key === "]") {
      game.bumpSpeed(1);
      return;
    }
    if (game.aiEnabled || game.status !== "playing") return;
    switch (e.key) {
      case "ArrowLeft":
        game.moveLeft();
        e.preventDefault();
        break;
      case "ArrowRight":
        game.moveRight();
        e.preventDefault();
        break;
      case "ArrowUp":
        game.rotate();
        e.preventDefault();
        break;
      case "ArrowDown":
        game.softDropping = true;
        e.preventDefault();
        break;
      case " ":
        game.hardDrop();
        e.preventDefault();
        break;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowDown") {
      game.softDropping = false;
    }
  });
})();
//# sourceMappingURL=bundle.js.map
