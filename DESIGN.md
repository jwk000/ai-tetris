# AI 俄罗斯方块（AI Tetris）设计文档

> 版本：2.x（视听增强版）
> 范围：核心玩法 + 雨夜大气场景（粒子噪声乌云、闪电、雨幕、悬浮棋盘、WebGL 水面倒影、雨滴溅水花、完整音频系统）

---

## 1. 项目概述

基于 **Node.js + TypeScript** 的浏览器端俄罗斯方块。除完整玩法外，重点构建沉浸式视听氛围：棋盘悬浮于水面之上，下方倒影持续被多层 sin/value-noise 扰动，雨滴穿过乌云击中水面溅起粒子水花，闪电触发屏幕闪光与水面高光，并配套一套 Web Audio 音频系统（移动 / 旋转 / 落地 / 消行 / 水滴 / 雷声 / BGM / 雨声循环）。

### 1.1 核心特色

| 类别 | 特性 |
|---|---|
| 玩法 | 7 种 Tetromino、AI 自动落子、手动模式、暂停 / 加减速 / 重启、消行粒子飞散 |
| 视觉 | 粒子噪声体积乌云、雨幕（带风向）、随机分支闪电、雨滴击水面溅起重力粒子、棋盘蓝色发光阴影、WebGL 水面倒影 + 持续多层扰动 |
| 音频 | Web Audio API、6 个 SFX + 2 个循环音轨（BGM / 雨声）、用户首次交互解锁、静音持久化、随机 detune 防机械感 |
| 工程 | TypeScript strict、零运行时依赖、esbuild 单 bundle、纯静态文件可托管 |

---

## 2. 技术栈

| 类别 | 选型 |
|---|---|
| 语言 | TypeScript 5.x（strict） |
| 运行时 | 浏览器（dev 时 Node.js 起 HTTP 静态服务） |
| 构建 | esbuild（单 bundle，无配置） |
| 渲染 | HTML5 Canvas 2D（棋盘 + 背景）+ WebGL 1.0（水面） |
| 音频 | Web Audio API（无库） |
| 包管理 | npm |
| 运行时依赖 | 0 |
| 开发依赖 | `typescript`、`esbuild` |

---

## 3. 目录结构

```
ai-tetris/
├── DESIGN.md              # 本文档
├── README.md              # 使用说明
├── server.js              # 极简 Node.js 静态文件服务（含 .mp3/.wav MIME）
├── package.json
├── tsconfig.json
├── index.html             # 三个 canvas 叠层 + UI
├── public/
│   ├── bundle.js          # esbuild 输出
│   ├── bundle.js.map
│   └── audio/             # 8 个音频文件（首次构建脚本下载）
│       ├── bgm.mp3
│       ├── rain-loop.mp3
│       ├── thunder.mp3
│       ├── water-drop.mp3
│       ├── line-clear.mp3
│       ├── move.mp3
│       ├── rotate.mp3
│       ├── drop.wav
│       └── CREDITS.md     # 音频来源 / 授权
├── scripts/
│   └── download-audio.sh  # 拉取 freesound / mixkit 等音频
└── src/
    ├── main.ts            # 应用入口，装配 Game / Renderer / Background / Water / Audio
    ├── game.ts            # 游戏主循环 + 状态机 + 事件回调（onMove/Rotate/Lock/LineClear）
    ├── board.ts           # 10×20 棋盘、碰撞、消行
    ├── piece.ts           # Tetromino 定义 + 旋转矩阵 + 颜色
    ├── ai.ts              # 启发式评估 + 最佳落点搜索
    ├── renderer.ts        # 棋盘 + 方块 + 粒子渲染、屏幕震动、缩放
    ├── particles.ts       # 消行粒子系统
    ├── background.ts      # 乌云 / 雨 / 闪电 / 水面溅起粒子（Canvas 2D）
    ├── water.ts           # WebGL 水面倒影 shader（持续扰动 + 棋盘镜像采样）
    ├── audio.ts           # AudioManager：buffer 加载、母线、loop、SFX、解锁、静音持久化
    ├── input.ts           # 键盘 + 滚轮事件
    └── types.ts           # 公共类型
```

---

## 4. 画面层级（z-index 自下而上）

```
┌─────────────────────────────────────────────────┐
│ #bg-canvas      Canvas 2D, z=0                  │  ← 乌云、雨、闪电、splash 粒子
├─────────────────────────────────────────────────┤
│ #water-canvas   WebGL,    z=1, pointer:none     │  ← 棋盘倒影 + 持续水面扰动
├─────────────────────────────────────────────────┤
│ #app/#canvas    DOM + Canvas 2D, z=2            │  ← 棋盘、HUD、按钮
└─────────────────────────────────────────────────┘
```

棋盘 canvas 通过 CSS box-shadow 加蓝色发光，视觉上"浮"在水面上方，下方水面层在棋盘底部 +24px 处定义水位线 `waterLineY`。

---

## 5. 核心数据结构

### 5.1 棋盘 Board (`src/board.ts`)

- `COLS = 10`, `ROWS = 20`
- `grid: number[][]`，0 空，1..7 颜色 ID
- 主要方法：`collides(piece, dx, dy, rot)`、`merge(piece)`、`clearLines()`、`isGameOver()`

### 5.2 方块 Piece (`src/piece.ts`)

7 种 Tetromino，每种 4 个预存旋转矩阵；颜色：

| 字母 | 颜色 |
|---|---|
| I | `#00f0f0` 青 |
| O | `#f0f000` 黄 |
| T | `#a000f0` 紫 |
| S | `#00f000` 绿 |
| Z | `#f00000` 红 |
| J | `#0000f0` 蓝 |
| L | `#f0a000` 橙 |

### 5.3 消行粒子 Particle (`src/particles.ts`)

```ts
interface Particle {
  x, y: number;          // 像素位置
  vx, vy: number;        // 速度（受重力）
  size: number;
  color: string;
  life, maxLife: number;
  rotation, vr: number;  // 自转
}
```

每消除一行，从该行每格爆出 4-6 个粒子，受重力 vy 加速度，渐隐淡出。

### 5.4 雨滴 Raindrop (`src/background.ts`)

```ts
interface Raindrop {
  x, y: number;
  len: number;       // 16-28 px
  speed: number;     // 800-1300 px/s（垂直分量）
  alpha: number;     // 0.35-0.85
  hitY: number;      // 击中水面的 Y（接近 waterLineY 时触发 splash）
}
```

- 总数 `RAIN_COUNT = 240`
- 风向 `WIND_X = -120`（向左飘）
- 渲染：从 (x, y) 反推一段沿速度方向的线段

### 5.5 溅起粒子 Splash (`src/background.ts`)

雨滴击中水面后产生（**取代旧版 ripple 圆环扩散**）：

```ts
interface Splash {
  x, y: number;
  vx, vy: number;
  life, maxLife: number;
  size: number;
}
```

- 触发概率 `SPLASH_RAIN_PROB = 0.45`（避免过密）
- 单次 spawn 3-5 个粒子，初速度方向 `-π/2 ± 0.65·π/2`（斜向上锥形），速度幅值 90-210 px/s
- 寿命 0.32-0.5 s
- 重力 `SPLASH_GRAVITY = 1400 px/s²`，每帧 `vy += g·dt`
- 数组上限 240（超出从头部丢弃）
- 渲染：白色实心小圆 + alpha = `min(1, t·1.6)·0.85`，t = life/maxLife

### 5.6 闪电 LightningBolt + FlashEvent (`src/background.ts`)

- 消行（≥1 行）触发 `flashLightning(count)`
- 折线分段递归生成（每段中点 ±随机偏移）+ 0-2 个分支
- 同时入栈 `FlashEvent`（屏幕白闪 + 水面高光 uniform `u_flash`）
- 触发 `onThunder` 回调播放雷声 SFX

### 5.7 体积乌云 (`src/background.ts`)

- `generateCloudNoiseTile(W=512, H=256)`：4 octaves value noise，**X 方向 tileable**（左/右取均值消接缝），结果烘焙到离屏 canvas
- 渲染时叠 3 层：不同 scrollX 速度、不同 scaleY、不同 alpha，drawImage 平铺至屏宽 + 一格冗余

---

## 6. 游戏循环

```
loop(now):
  dt = clamp(now - lastTime, 0, 50)
  game.step(dt)            // 重力 + AI 决策 + 锁定
  game.updateVisual(dt)    // 平滑移动插值
  game.updateParticles(dt) // 消行粒子
  renderer.render(...)     // 棋盘 + ghost + 粒子（独立 canvas）
  renderer.renderNext(...)
  water.render(now/1000)   // WebGL 水面层
  syncUI()
  rAF(loop)
```

`background.ts` 内部独立 rAF 循环驱动雨/云/闪电/splash。这两个循环互不阻塞。

`dropInterval` 默认 500ms，`speedMultiplier ∈ [0.25, 8]`。

---

## 7. AI 设计 (`src/ai.ts`)

经典 Pierre Dellacherie / Yiyuan Lee 启发式：枚举 `(rotation, column)` → 模拟落到最低点 → 评分。

```
score = -0.510066·aggregateHeight
        +0.760666·completedLines
        -0.356630·holes
        -0.184483·bumpiness
```

执行：每帧朝目标列移动 1 格 + 旋转 1 步 → `(rotation, x)` 到位后硬降。可视化 AI 思考过程而非瞬移。

---

## 8. WebGL 水面 (`src/water.ts`)

### 8.1 设计目标

棋盘 canvas 作为 sampler 上传到 WebGL，在水面区域**镜像采样并施加持续扰动**，营造水面倒影。无需任何离散事件触发——扰动来源是 `u_time` 驱动的多层周期函数与 value noise。

### 8.2 着色器结构

**顶点着色器**：全屏 quad。

**片元着色器**：

```glsl
uniform sampler2D u_board;     // 棋盘 canvas 作为纹理
uniform vec4      u_boardRect; // 棋盘在 CSS 坐标的 (x,y,w,h)
uniform vec2      u_resolution;
uniform float     u_waterY;    // 水面 Y（CSS 坐标，自顶向下）
uniform float     u_time;
uniform float     u_flash;     // 闪电高光强度
uniform vec4      u_boardBg;   // 棋盘背景色（用于水面映射出棋盘外的颜色）
```

`px.y < u_waterY` discard。否则：

1. `depth = px.y - u_waterY`，`mirrorPx = (px.x, u_waterY - depth)`（垂直镜像）
2. **持续扰动** `waterDisplacement(px, depth)`：
   - 4 层 sin（不同频率/方向/相位/速度）累加 `dx`
   - 1 层 value noise → `dx` 偏移
   - 2 层 sin/value noise 累加 `dy`
   - 整体乘 `depthFactor = clamp(depth/80, 0.25, 1.4)`
3. `mirrorPx += disp` → `boardUV` 采样棋盘纹理；越界用 `u_boardBg` 兜底
4. `fade = exp(-depth/220)` 远处变深
5. `edgeBand = exp(-depth/5)·0.55` 水面边缘高光
6. `surfaceShimmer` = 2 层 value noise 叠加，`smoothstep(0.62, 0.95)` 取顶 → 高光闪烁
7. 颜色合成：水色基底 + 倒影衰减 + 边缘高光 + shimmer + flash

### 8.3 关键实现点

- `gl.texImage2D(target, 0, RGBA, RGBA, UNSIGNED_BYTE, boardCanvas)` 每帧上传棋盘 canvas
- `UNPACK_FLIP_Y_WEBGL = false`、`UNPACK_PREMULTIPLY_ALPHA_WEBGL = false`
- `u_boardBg` 硬编码 `#11141d`（棋盘 canvas CSS 背景色），跨文件耦合点（在 shader 注释中标注）
- 上下文属性 `{ premultipliedAlpha:false, alpha:true }`；不使用 `preserveDrawingBuffer`

### 8.4 接口

```ts
class Water {
  constructor(canvas: HTMLCanvasElement);
  attachBoard(boardCanvas: HTMLCanvasElement, getRect: () => DOMRect): void;
  configure(opts: { getWaterY: () => number; getFlash: () => number }): void;
  render(timeSeconds: number): void;
}
```

WebGL 不可用时 main.ts 捕获异常并 `console.warn`，游戏继续运行（水面层缺失但不影响玩法）。

---

## 9. 音频系统 (`src/audio.ts`)

### 9.1 架构

```
AudioContext
   │
   └─ master (GainNode)
        ├─ musicBus     ←  bgm loop
        ├─ ambientBus   ←  rain loop
        └─ sfxBus       ←  one-shot AudioBufferSourceNode（每次新建）
```

### 9.2 音频文件清单

| 名称 | 文件 | 用途 |
|---|---|---|
| `bgm` (loop) | `bgm.mp3` | 背景音乐 |
| `rain` (loop) | `rain-loop.mp3` | 雨声环境 |
| `thunder` (sfx) | `thunder.mp3` | 闪电触发 |
| `waterDrop` (sfx) | `water-drop.mp3` | 雨滴落水（节流 180ms） |
| `lineClear` (sfx) | `line-clear.mp3` | 消行 |
| `move` (sfx) | `move.mp3` | 方块横移 |
| `rotate` (sfx) | `rotate.mp3` | 旋转 |
| `drop` (sfx) | `drop.wav` | 锁定落地 |

构建脚本 `scripts/download-audio.sh` 从 mixkit/freesound 拉取并就近放入 `public/audio/`，归属信息见 `CREDITS.md`。

### 9.3 关键功能

- **解锁**：`attachUnlock(window)` 监听首次 click/keydown/touchend，调用 `ctx.resume()` + 启动 loops
- **buffer 缓存**：`Map<filePath, AudioBuffer>`，加载并发安全
- **SFX 选项**：`{ volume, detuneCents, throttleMs }` —— `detuneCents` 每次随机 ±cents 防止机械重复
- **节流**：`lastPlayedAt` 记录每个 sfx 上次时间，`throttleMs` 内忽略
- **静音持久化**：`localStorage` key `ai-tetris.audio`；隐私模式 try/catch 静默降级
- **母线音量**：muted / master / music / ambient / sfx

### 9.4 接口

```ts
class AudioManager {
  attachUnlock(target: EventTarget): void;
  playSfx(name: SfxName, opts?: SfxOptions): void;
  startLoop(name: LoopName): Promise<void>;
  stopLoop(name: LoopName): void;
  toggleMute(): void;
  isMuted(): boolean;
  setMaster(v: number): void;
  // ...
}
```

### 9.5 事件桥接（main.ts）

```ts
game.onMove       → playSfx('move',      throttle 40,  detune)
game.onRotate     → playSfx('rotate',    throttle 60,  detune)
game.onLock       → playSfx('drop',      detune)
game.onLineClear  → playSfx('lineClear') + flashLightning + shake
background.onRipple   → playSfx('waterDrop', throttle 180, detune, low volume)
background.onThunder  → playSfx('thunder', detune, high volume)
```

> 历史名 `onRipple` 保留作为"雨滴击水"事件回调，与已废弃的 ripple 圆环视觉效果**无关**。

---

## 10. 渲染与缩放 (`src/renderer.ts`)

- `cell` 基础像素 28，`zoom ∈ [0.5, 2.5]`
- `fitTo(availW, availH)` 自适应可用区域（main.ts 通过 `ResizeObserver` 监听 stage/side 容器）
- 棋盘下方为 `reflectionReserve`（高度 ratio=0.4，clamp [120, 320]），强制水面区可见
- 方块绘制：主体填充 + 顶/左浅色高光 + 底/右深色阴影
- ghost 半透明
- 屏幕震动：消行触发 `shake(magnitude, duration)`，magnitude = 4 + count·3

---

## 11. 输入

### 11.1 手动模式（AI 关闭）

| 键 | 动作 |
|---|---|
| ← / → | 左右移 |
| ↑ | 顺时针旋转 |
| ↓ | 软降（dropInterval ÷ 20） |
| Space | 硬降 |
| P | 暂停 / 继续 |

### 11.2 通用

| 键 / 操作 | 动作 |
|---|---|
| `[` / `]` | 减速 / 加速 |
| `A` | AI 开关 |
| `M` | 静音切换 |
| 滚轮 | 缩放（停用，已改用容器自适应） |

### 11.3 屏幕按钮

`暂停/继续`、`减速`、`加速`、`AI: 开/关`、`🔊 声音 / 🔇 静音`、`重新开始`。

---

## 12. UI 布局

```
┌───────────────────────────────────────────────────────────────┐
│ AI Tetris   [AI:开] [暂停] [-/+] 速度 1x [🔊 声音] [重启]      │
├──────────────────────────────────┬────────────────────────────┤
│  乌云 + 闪电                     │ 分数 / 行数 / 等级          │
│  雨幕 ↓↓↓                        │ 下一个方块                   │
│  ┌─────────────┐ ←蓝色发光阴影    │                              │
│  │             │                 │ 状态：AI 自动                 │
│  │  Game Board │                 │                              │
│  │             │                 │                              │
│  └─────────────┘                  │                              │
│  ━━━━━━━━━━━━━━━━ 水面 ━━━━━━━     │                              │
│  ░ 棋盘倒影 + 持续扰动 ░          │                              │
│  · · · 雨滴溅起粒子 · · ·          │                              │
└──────────────────────────────────┴────────────────────────────┘
```

---

## 13. 状态机

```
INIT → PLAYING ⇄ PAUSED
       ↓
   GAME_OVER → (重启) → PLAYING
```

GAME_OVER 时半透明遮罩 + 文字 + 重启按钮（overlay `.show`）。

---

## 14. 性能与稳定性

| 项 | 上限 / 措施 |
|---|---|
| 雨滴 | 240 |
| Splash 粒子 | 240（FIFO 截断） |
| 消行粒子 | 每帧硬上限避溢出 |
| 闪电分支 | 折线段数有界 |
| AI 单步 | < 1ms（10 列 × 4 旋转 ≈ 40 次模拟） |
| 水面 shader | 全屏 quad，纯 fragment 计算；移动端 mediump |
| WebGL 不可用 | 捕获异常 + console.warn，水面层降级为透明 |
| `dt` clamp | `Math.min(50, now-lastTime)` 防止切后台后大跳 |
| localStorage 失败 | try/catch 静默 |

---

## 15. 验收标准

1. `npm install && npm run build && node server.js` → 浏览器打开 `http://localhost:8080/` 即玩
2. 默认 AI 自动落子
3. AI 关闭后键盘可控
4. 暂停 / 加减速 / 重启全部生效
5. 消行时：粒子飞散 + 屏幕震动 + 闪电 + 雷声音效
6. 雨滴持续下落，击中水面溅起白色粒子（受重力下落）
7. 水面倒影持续连续波动（不依赖任何离散事件）
8. 闪电瞬间水面有蓝白高光叠加（`u_flash`）
9. BGM + 雨声循环；首次点击/按键后才发声
10. 静音按钮切换；刷新页面状态保持
11. `tsc --noEmit` 通过
12. console 无 error（404 favicon 除外）

---

## 16. 历史变更

### v2.0 视听增强

- 新增 `background.ts`（粒子噪声乌云、雨、闪电、splash）
- 新增 `water.ts`（WebGL 水面倒影 shader）
- 新增 `audio.ts`（Web Audio 系统）
- 棋盘 CSS 加蓝色发光阴影，视觉悬浮于水面
- `index.html` 新增 `#bg-canvas`、`#water-canvas` 三层叠加

### v2.1 水面方案重构（当前版本）

**废弃**：原本基于离散 ripple 事件的圆环扩散水面扰动。该方案数据流：
雨滴击水 → 生成 Ripple → 数组传入 shader uniform → shader 内每个 ripple 计算同心圆位移。

**问题**：
- ripple 上限低（数组 uniform 大小限制），密集雨天容易"看不见反应"
- 圆环视觉强度过显，破坏雨夜静谧感
- 水面在 ripple 之间是完全静止的，看起来不像活水

**新方案**：
- 视觉上 ripple 改为重力斜抛 splash 粒子（白色小圆 + 短寿命），更接近真实水滴
- 水面扰动改为 shader 内**完全连续**的多层 sin + value noise，持续运动，无需 CPU→GPU 数据流
- 删除：`u_ripples / u_rippleR / u_rippleCount` uniforms、`rippleDisplacement`、`crest`、`getRippleSnapshot`、Ripple 数据结构

**保留**：`onRipple` 回调名（语义改为"雨滴击水"事件，仍用于触发水滴音效）。

---

## 17. 后续可扩展（非本期）

- T-Spin 检测 / 连击得分
- Hold 方块
- 多档 AI 难度 / 评估权重可调
- 在线排行榜
- 移动端触屏手势
- 动态天气（晴/雨/雪切换）
- 自定义着色器主题（霓虹 / 极光 / 火山）
