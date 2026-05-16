export type SfxName = 'move' | 'rotate' | 'drop' | 'lineClear' | 'thunder';
export type LoopName = 'bgm' | 'rain';

interface SfxOptions {
  volume?: number;
  detuneCents?: number;
  throttleMs?: number;
}

interface LoopHandle {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

const STORAGE_KEY = 'ai-tetris.audio';

interface PersistState {
  muted: boolean;
  master: number;
  music: number;
  ambient: number;
  sfx: number;
}

const SFX_FILES: Record<SfxName, string> = {
  move: 'public/audio/move.mp3',
  rotate: 'public/audio/rotate.mp3',
  drop: 'public/audio/drop.mp3',
  lineClear: 'public/audio/line-clear.mp3',
  thunder: 'public/audio/thunder.mp3',
};

const LOOP_FILES: Record<LoopName, string> = {
  bgm: 'public/audio/bgm.mp3',
  rain: 'public/audio/rain-loop.mp3',
};

const DEFAULT_STATE: PersistState = {
  muted: false,
  master: 0.85,
  music: 0.35,
  ambient: 0.45,
  sfx: 0.7,
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private ambientBus!: GainNode;
  private sfxBus!: GainNode;

  private buffers = new Map<string, AudioBuffer>();
  private loops = new Map<LoopName, LoopHandle>();
  private lastPlayedAt = new Map<SfxName, number>();
  private loadingPromise: Promise<void> | null = null;
  private state: PersistState;
  private unlocked = false;

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): PersistState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      // localStorage may be unavailable (privacy mode); fall back to defaults
    }
    return { ...DEFAULT_STATE };
  }

  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore persistence errors
    }
  }

  isMuted(): boolean {
    return this.state.muted;
  }

  ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  attachUnlock(target: Window | HTMLElement = window): void {
    const handler = async (): Promise<void> => {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // resume may reject; ignore and let user retry
        }
      }
      if (ctx.state === 'running') {
        this.unlocked = true;
        await this.preload();
        this.startBackgroundLoops();
        target.removeEventListener('pointerdown', handler);
        target.removeEventListener('keydown', handler);
        target.removeEventListener('touchstart', handler);
      }
    };
    target.addEventListener('pointerdown', handler);
    target.addEventListener('keydown', handler);
    target.addEventListener('touchstart', handler, { passive: true });
  }

  preload(): Promise<void> {
    if (this.loadingPromise) return this.loadingPromise;
    const ctx = this.ensureContext();
    const all: Array<Promise<void>> = [];
    for (const [name, url] of Object.entries(SFX_FILES)) {
      all.push(this.loadInto(ctx, name, url));
    }
    for (const [name, url] of Object.entries(LOOP_FILES)) {
      all.push(this.loadInto(ctx, name, url));
    }
    this.loadingPromise = Promise.all(all).then(() => undefined);
    return this.loadingPromise;
  }

  private async loadInto(ctx: AudioContext, name: string, url: string): Promise<void> {
    if (this.buffers.has(name)) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      this.buffers.set(name, buf);
    } catch (err) {
      console.warn(`[audio] failed to load ${name}: ${(err as Error).message}`);
    }
  }

  private startBackgroundLoops(): void {
    this.playLoop('bgm');
    this.playLoop('rain');
  }

  playSfx(name: SfxName, opts: SfxOptions = {}): void {
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
        // detune unsupported on some older browsers; ignore
      }
    }
    const g = ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start(0);
  }

  playLoop(name: LoopName): void {
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
    g.connect(name === 'bgm' ? this.musicBus : this.ambientBus);
    src.start(0);
    this.loops.set(name, { source: src, gain: g });
  }

  stopLoop(name: LoopName): void {
    const h = this.loops.get(name);
    if (!h || !this.ctx) return;
    const t = this.ctx.currentTime;
    h.gain.gain.cancelScheduledValues(t);
    h.gain.gain.setValueAtTime(h.gain.gain.value, t);
    h.gain.gain.linearRampToValueAtTime(0, t + 0.4);
    h.source.stop(t + 0.45);
    this.loops.delete(name);
  }

  setMuted(muted: boolean): void {
    this.state.muted = muted;
    this.saveState();
    this.applyVolumes();
  }

  toggleMute(): boolean {
    this.setMuted(!this.state.muted);
    return this.state.muted;
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const m = this.state.muted ? 0 : this.state.master;
    this.master.gain.value = m;
    this.musicBus.gain.value = this.state.music;
    this.ambientBus.gain.value = this.state.ambient;
    this.sfxBus.gain.value = this.state.sfx;
  }
}

export function randomDetune(): number {
  return (Math.random() - 0.5) * 100;
}
