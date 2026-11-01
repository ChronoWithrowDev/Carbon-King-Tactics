/**
 * Procedural Web Audio soundstage plus system speech synthesis.
 * No downloaded samples are required: transients, surface foley, gun reports, anime ability
 * sweeps and the dial-up handshake are assembled from cached noise, filters and oscillators.
 */

import { clamp } from './rng';

export type FootstepSurface = 'grass' | 'dirt' | 'gravel' | 'concrete' | 'asphalt' | 'snow' | 'sand';
export type AbilitySound = 'buff' | 'heal' | 'synth' | 'scan' | 'warp' | 'flash';

interface VoiceProfile {
  pitch: number;
  rate: number;
  preferred: RegExp;
  fallbackIndex: number;
  signature: [number, number, number];
}

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private isMuted: boolean = false;
  private speechVoices: SpeechSynthesisVoice[] = [];
  private noiseCache = new Map<number, AudioBuffer>();
  private outdoorImpulse: ConvolverNode | null = null;

  constructor() {
    // Lazy audio context init on user gesture
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', () => this.ensureContext(), { once: true });
      window.addEventListener('keydown', () => this.ensureContext(), { once: true });
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = () => {
          this.speechVoices = window.speechSynthesis.getVoices();
        };
        this.speechVoices = window.speechSynthesis.getVoices();
      }
    }
  }

  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-12, this.ctx.currentTime);
        limiter.knee.setValueAtTime(18, this.ctx.currentTime);
        limiter.ratio.setValueAtTime(6, this.ctx.currentTime);
        limiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
        limiter.release.setValueAtTime(0.24, this.ctx.currentTime);
        this.masterGain.connect(limiter);
        limiter.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        this.voiceGain = this.ctx.createGain();
        this.voiceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
        this.voiceGain.connect(this.masterGain);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1.0, this.ctx.currentTime);
    }
    if (this.isMuted) {
      this.stopVoice();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // --- NOISE GENERATION UTILS ---
  private createNoiseBuffer(duration = 1.0): AudioBuffer | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    const key = Math.max(1, Math.ceil(duration * 10));
    const cached = this.noiseCache.get(key);
    if (cached) return cached;
    const cachedDuration = key / 10;
    const bufferSize = Math.ceil(ctx.sampleRate * cachedDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseCache.set(key, buffer);
    return buffer;
  }

  /** Short outdoor reflection tail. Cached and reused by every firearm. */
  private getOutdoorImpulse(): ConvolverNode | null {
    const ctx = this.ensureContext();
    if (!ctx) return null;
    if (this.outdoorImpulse) return this.outdoorImpulse;
    const seconds = 0.82;
    const buffer = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        const t = i / data.length;
        const early = i > ctx.sampleRate * 0.06 && i < ctx.sampleRate * 0.11 ? 0.45 : 0;
        data[i] = (Math.random() * 2 - 1) * (Math.pow(1 - t, 3.4) * 0.2 + early);
      }
    }
    const convolver = ctx.createConvolver();
    convolver.buffer = buffer;
    if (this.sfxGain) convolver.connect(this.sfxGain);
    this.outdoorImpulse = convolver;
    return convolver;
  }

  private noiseBurst(
    when: number,
    duration: number,
    volume: number,
    type: BiquadFilterType,
    frequency: number,
    q = 0.8,
    destination: AudioNode | null = this.sfxGain,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !destination) return;
    const noise = this.createNoiseBuffer(duration);
    if (!noise) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(frequency, when);
    filter.Q.setValueAtTime(q, when);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + Math.min(0.006, duration * 0.15));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    src.start(when, Math.random() * Math.max(0, noise.duration - duration), duration);
    src.stop(when + duration + 0.01);
  }

  private tone(
    when: number,
    duration: number,
    frequency: number,
    volume: number,
    wave: OscillatorType = 'sine',
    destination: AudioNode | null = this.sfxGain,
    endFrequency?: number,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !destination) return;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(1, frequency), when);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), when + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), when + Math.min(0.01, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(when);
    osc.stop(when + duration + 0.01);
  }

  // --- REALISTIC COMBAT SOUND EFFECTS ---

  /** Realistic sharp metallic sword slice with whoosh and resonance */
  public playSwordSlash() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Whoosh component (filtered noise sweep)
    const noise = this.createNoiseBuffer(0.25);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(900, now);
      bpf.frequency.exponentialRampToValueAtTime(3200, now + 0.12);
      bpf.Q.setValueAtTime(3.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      src.connect(bpf);
      bpf.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.24);
    }

    // Metallic ring and edge zing
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.15);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.0, now);
    oscGain.gain.setValueAtTime(0.4, now + 0.03);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now + 0.02);
    osc.stop(now + 0.3);
  }

  /** Heavy blunt mace/hammer impact shockwave with deep punch */
  public playMaceSlam() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Sub-bass heavy transient punch
    const sub = ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.32);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.4);

    // Stone / metal crunch noise
    const noise = this.createNoiseBuffer(0.35);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const lpf = ctx.createBiquadFilter();
      lpf.type = 'lowpass';
      lpf.frequency.setValueAtTime(800, now);
      lpf.frequency.exponentialRampToValueAtTime(120, now + 0.25);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.8, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      src.connect(lpf);
      lpf.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.35);
    }
  }

  /** Swift high-velocity piercing spear thrust */
  public playSpearThrust() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.12);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(1800, now);
    bpf.Q.setValueAtTime(4.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(bpf);
    bpf.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /**
   * Layered firearm report: supersonic crack, propellant bark, pressure wave, receiver action,
   * brass and a short outdoor reflection. Each weapon class uses a different acoustic profile.
   */
  public playGunshot(kind: 'Pistol' | 'SMG' | 'Assault' | 'LongRifle' = 'Pistol') {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const P = {
      Pistol:    { crack: 0.58, bark: 0.58, body: 0.38, tail: 0.32, low: 118, cutoff: 4200, action: 0.085 },
      SMG:       { crack: 0.42, bark: 0.42, body: 0.26, tail: 0.18, low: 105, cutoff: 5000, action: 0.065 },
      Assault:   { crack: 0.72, bark: 0.76, body: 0.5,  tail: 0.45, low: 92,  cutoff: 4600, action: 0.095 },
      LongRifle: { crack: 0.95, bark: 1.0,  body: 0.72, tail: 0.72, low: 70,  cutoff: 6200, action: 0.14 },
    }[kind];

    // The supersonic snap is much shorter and brighter than the propellant body.
    this.noiseBurst(now, 0.018, P.crack, 'highpass', 2900, 0.45);
    this.noiseBurst(now + 0.002, kind === 'LongRifle' ? 0.21 : 0.12, P.bark, 'bandpass', P.cutoff, 0.65);
    this.noiseBurst(now + 0.005, kind === 'LongRifle' ? 0.48 : 0.25, P.body, 'lowpass', kind === 'LongRifle' ? 1200 : 900, 0.55);
    this.tone(now, kind === 'LongRifle' ? 0.25 : 0.15, kind === 'LongRifle' ? 150 : 185, P.body * 0.72, 'sine', this.sfxGain, P.low);

    // Send a quieter copy of the report through an outdoor impulse response.
    const convolver = this.getOutdoorImpulse();
    if (convolver) {
      this.noiseBurst(now + 0.008, kind === 'LongRifle' ? 0.36 : 0.2, P.tail, 'bandpass', 1500, 0.7, convolver);
    }

    // Receiver / bolt motion: hard metal click followed by a lower return click.
    this.noiseBurst(now + P.action, 0.024, 0.18, 'highpass', 4200, 1.6);
    this.tone(now + P.action, 0.035, kind === 'LongRifle' ? 1850 : 2400, 0.11, 'triangle');
    this.noiseBurst(now + P.action + 0.065, 0.03, 0.12, 'bandpass', 2100, 2.1);

    // Open Colorado reflections arrive late and quiet; a rifle carries much farther.
    const echoDelay = kind === 'LongRifle' ? 0.24 : 0.15;
    this.noiseBurst(now + echoDelay, 0.12, P.tail * 0.22, 'bandpass', 1050, 0.5);
    if (kind === 'LongRifle') this.noiseBurst(now + 0.42, 0.16, 0.12, 'bandpass', 720, 0.45);

    window.setTimeout(() => this.playShellCasingDrop(), (P.action + 0.09) * 1000);
  }

  /** Hot brass casing bounce sound */
  public playShellCasingDrop() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3200 + Math.random() * 800, now);
    osc.frequency.exponentialRampToValueAtTime(2600, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** Directed Energy Weapon (DEW) beam hum and sci-fi arc discharge */
  public playEnergyBeam() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Carrier laser pulse
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(1400, now);
    osc1.frequency.exponentialRampToValueAtTime(220, now + 0.28);

    // FM Modulator for electric buzz
    const mod = ctx.createOscillator();
    mod.type = 'square';
    mod.frequency.setValueAtTime(75, now);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(400, now);
    mod.connect(modGain);
    modGain.connect(osc1.frequency);

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(2400, now);
    bpf.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc1.connect(bpf);
    bpf.connect(gain);
    gain.connect(this.sfxGain);

    mod.start(now);
    osc1.start(now);
    mod.stop(now + 0.32);
    osc1.stop(now + 0.32);
  }

  /** Flesh or armor hit impact */
  public playHitImpact(isHeavy = false) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = isHeavy ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isHeavy ? 160 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + (isHeavy ? 0.18 : 0.12));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isHeavy ? 0.8 : 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.22 : 0.14));

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Metallic / Aegis energy shield block deflection */
  public playShieldDeflect() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // High crystalline gong / deflection ring
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.setValueAtTime(1470, now + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.48);

    // Energy shimmer
    const noise = this.createNoiseBuffer(0.2);
    if (noise) {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(4200, now);
      bpf.Q.setValueAtTime(6.0, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.4, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      src.connect(bpf);
      bpf.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.2);
    }
  }

  /** Distant whistle and massive explosion for Artillery / Airstrike */
  public playExplosion(isAir = false) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Whistle incoming
    const whistle = ctx.createOscillator();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(isAir ? 3200 : 1800, now);
    whistle.frequency.exponentialRampToValueAtTime(isAir ? 600 : 250, now + 0.35);

    const wGain = ctx.createGain();
    wGain.gain.setValueAtTime(0.01, now);
    wGain.gain.linearRampToValueAtTime(0.4, now + 0.25);
    wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    whistle.connect(wGain);
    wGain.connect(this.sfxGain);
    whistle.start(now);
    whistle.stop(now + 0.4);

    // Huge concussive explosion at 0.35s
    window.setTimeout(() => {
      if (this.isMuted || !ctx || !this.sfxGain) return;
      const t = ctx.currentTime;

      // Deep rumble sub
      const sub = ctx.createOscillator();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(90, t);
      sub.frequency.exponentialRampToValueAtTime(24, t + 0.85);

      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(1.0, t);
      sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

      sub.connect(sGain);
      sGain.connect(this.sfxGain);
      sub.start(t);
      sub.stop(t + 1.0);

      // Noise blast
      const noise = this.createNoiseBuffer(1.2);
      if (noise) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.setValueAtTime(1400, t);
        lpf.frequency.exponentialRampToValueAtTime(80, t + 1.1);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(1.0, t);
        nGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

        src.connect(lpf);
        lpf.connect(nGain);
        nGain.connect(this.sfxGain);
        src.start(t);
        src.stop(t + 1.2);
      }
    }, 350);
  }

  /** Surface-aware boot foley: every tile material has a different transient and texture. */
  public playFootstep(surface: FootstepSurface = 'dirt', weight = 1) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const w = clamp(weight, 0.55, 1.45);
    // Boot heel / body is present on every surface, but hard ground is brighter.
    const hard = surface === 'concrete' || surface === 'asphalt';
    this.tone(now, hard ? 0.055 : 0.075, hard ? 150 : 92, (hard ? 0.24 : 0.2) * w, 'sine', this.sfxGain, hard ? 82 : 48);

    if (surface === 'concrete' || surface === 'asphalt') {
      // Heel clack + sole slap. Asphalt is slightly darker and more rubbery.
      const bright = surface === 'concrete' ? 2500 : 1750;
      this.noiseBurst(now, 0.028, (surface === 'concrete' ? 0.34 : 0.28) * w, 'highpass', bright, 1.1);
      this.tone(now + 0.004, 0.065, surface === 'concrete' ? 1180 : 760, 0.18 * w, 'triangle', this.sfxGain, 540);
      this.noiseBurst(now + 0.045, 0.035, 0.14 * w, 'bandpass', surface === 'concrete' ? 1950 : 1200, 1.4);
      return;
    }

    if (surface === 'grass') {
      // Long fibrous swish plus a soft soil compression underneath.
      this.noiseBurst(now - 0.025, 0.15, 0.22 * w, 'bandpass', 1700 + Math.random() * 500, 0.75);
      this.noiseBurst(now + 0.018, 0.11, 0.13 * w, 'lowpass', 520, 0.5);
      return;
    }

    if (surface === 'sand') {
      this.noiseBurst(now - 0.01, 0.15, 0.2 * w, 'lowpass', 680, 0.6);
      this.noiseBurst(now + 0.02, 0.1, 0.1 * w, 'bandpass', 1050, 0.8);
      return;
    }

    const gravel = surface === 'gravel' || surface === 'snow';
    const baseFreq = surface === 'snow' ? 1500 : surface === 'gravel' ? 1200 : 720;
    // Main compressed crunch/scuff.
    this.noiseBurst(now - 0.006, gravel ? 0.13 : 0.1, (gravel ? 0.28 : 0.22) * w, 'bandpass', baseFreq, gravel ? 0.85 : 0.65);
    this.noiseBurst(now + 0.018, gravel ? 0.1 : 0.08, 0.15 * w, 'lowpass', surface === 'dirt' ? 580 : 920, 0.5);
    // Individual stones / ice crystals make the recognizable crunchy texture.
    const grains = surface === 'gravel' ? 7 : surface === 'snow' ? 9 : 4;
    for (let i = 0; i < grains; i++) {
      const t = now + 0.01 + Math.random() * 0.09;
      this.noiseBurst(t, 0.012 + Math.random() * 0.018, (0.045 + Math.random() * 0.05) * w, 'highpass', baseFreq + 900 + Math.random() * 2800, 1.4);
    }
  }

  /** Old-school anime RPG ability sweep: rising energy, sparkling arpeggio and a resolved impact chord. */
  public playAnimePowerUp(kind: AbilitySound = 'buff') {
    if (this.isMuted || kind === 'flash') return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const roots: Record<Exclude<AbilitySound, 'flash'>, number[]> = {
      buff: [330, 440, 554, 659, 880],
      heal: [392, 523, 659, 784, 1047],
      synth: [220, 330, 660, 990, 1320],
      scan: [740, 880, 1110, 1480, 1760],
      warp: [880, 1240, 620, 1560, 2080],
    };
    const notes = roots[kind];

    // Continuous rising energy ribbon with vibrato generated by a frequency modulator.
    const carrier = ctx.createOscillator();
    carrier.type = kind === 'synth' || kind === 'warp' ? 'sawtooth' : 'triangle';
    carrier.frequency.setValueAtTime(notes[0], now);
    carrier.frequency.exponentialRampToValueAtTime(notes[notes.length - 1], now + 0.78);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.setValueAtTime(kind === 'warp' ? 18 : 11, now);
    const vibratoDepth = ctx.createGain();
    vibratoDepth.gain.setValueAtTime(kind === 'warp' ? 95 : 36, now);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(carrier.frequency);
    const sweep = ctx.createBiquadFilter();
    sweep.type = 'lowpass';
    sweep.frequency.setValueAtTime(700, now);
    sweep.frequency.exponentialRampToValueAtTime(5200, now + 0.72);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, now);
    cg.gain.exponentialRampToValueAtTime(0.19, now + 0.16);
    cg.gain.setValueAtTime(0.19, now + 0.58);
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    carrier.connect(sweep); sweep.connect(cg); cg.connect(this.sfxGain);
    carrier.start(now); vibrato.start(now);
    carrier.stop(now + 0.92); vibrato.stop(now + 0.92);

    // Sparkling ascending anime arpeggio.
    notes.forEach((freq, i) => {
      const t = now + 0.08 + i * 0.11;
      this.tone(t, 0.25, freq, 0.13, 'sine');
      this.tone(t + 0.012, 0.18, freq * 2, 0.045, 'triangle');
    });
    this.noiseBurst(now + 0.08, 0.68, 0.09, 'highpass', kind === 'heal' ? 3800 : 2600, 0.7);

    // Resolve into a brief fifth / octave chord (the classic transformation lock-in).
    const root = notes[1];
    this.tone(now + 0.68, 0.42, root, 0.18, 'triangle');
    this.tone(now + 0.68, 0.42, root * 1.5, 0.13, 'triangle');
    this.tone(now + 0.68, 0.42, root * 2, 0.1, 'sine');
  }

  /** Classic dial-up modem handshake, compressed into the flash-inference window. */
  public playFlashCycle() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    // Bell-style dial tone.
    this.tone(now, 0.14, 350, 0.12, 'sine');
    this.tone(now, 0.14, 440, 0.1, 'sine');

    // DTMF dial digits (paired row / column frequencies).
    const digits: [number, number][] = [[697, 1209], [770, 1336], [697, 1477], [852, 1209]];
    digits.forEach(([a, b], i) => {
      const t = now + 0.14 + i * 0.075;
      this.tone(t, 0.052, a, 0.12, 'sine');
      this.tone(t, 0.052, b, 0.12, 'sine');
    });

    // Answer carrier, phase reversal and guard tone.
    this.tone(now + 0.46, 0.24, 2100, 0.2, 'sine', this.sfxGain, 2050);
    this.tone(now + 0.69, 0.1, 1800, 0.17, 'square', this.sfxGain, 980);

    // Negotiation squeals: stepped carriers, chirps and data hiss, like a V.90 handshake.
    const carriers = [1650, 2250, 980, 2800, 1320, 2450, 760, 3100, 1840, 2600, 1120, 3450];
    carriers.forEach((f, i) => {
      const t = now + 0.78 + i * 0.105;
      const next = carriers[Math.min(carriers.length - 1, i + 1)];
      this.tone(t, 0.095, f, 0.11 + (i % 3) * 0.035, i % 2 ? 'sawtooth' : 'square', this.sfxGain, next);
      if (i % 2 === 0) this.noiseBurst(t, 0.07, 0.07, 'bandpass', f, 4.5);
    });

    // Final broadband carrier lock.
    this.noiseBurst(now + 1.95, 0.3, 0.16, 'bandpass', 2600, 1.8);
    this.tone(now + 1.95, 0.3, 1200, 0.1, 'sawtooth', this.sfxGain, 2400);
  }

  /** UI click / tile select chime */
  public playUiClick() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /** Victory fanfare chime */
  public playVictoryFanfare() {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    const notes = [440, 554, 659, 880]; // A major
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.12;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  // --- FULLY VOICED CHARACTER DIALOGUE SYSTEM ---

  public stopVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Deliberately wide pitch spread. Browsers expose different installed voices, so each profile
   * also has a deterministic fallback voice index and its own three-note BCI signature.
   */
  private getCharacterVoiceProfile(speaker: string): VoiceProfile {
    const s = speaker.toUpperCase();
    switch (s) {
      case 'RYE':
        return { pitch: 1.28, rate: 1.08, preferred: /alex|david|guy|male|george|aaron/i, fallbackIndex: 0, signature: [523, 659, 784] };
      case 'JUNE':
        return { pitch: 1.02, rate: 1.04, preferred: /samantha|karen|zira|female|ava|susan/i, fallbackIndex: 1, signature: [440, 554, 659] };
      case 'SEVEN':
        return { pitch: 1.68, rate: 0.9, preferred: /google uk female|samantha|zira|female/i, fallbackIndex: 2, signature: [880, 1320, 1760] };
      case 'MAYA':
        return { pitch: 0.87, rate: 1.0, preferred: /victoria|moira|serena|female|karen/i, fallbackIndex: 3, signature: [330, 494, 740] };
      case 'SILAS':
        return { pitch: 0.65, rate: 1.1, preferred: /fred|richard|daniel|male|ralph/i, fallbackIndex: 4, signature: [196, 247, 330] };
      case 'VOSS':
        return { pitch: 0.5, rate: 0.84, preferred: /daniel|oliver|male|george|arthur/i, fallbackIndex: 5, signature: [147, 220, 294] };
      case 'IMOGEN':
        return { pitch: 0.78, rate: 0.9, preferred: /victoria|moira|female|serena|kate/i, fallbackIndex: 6, signature: [262, 392, 523] };
      case 'CHOIR':
        return { pitch: 1.48, rate: 0.72, preferred: /google uk|samantha|zira|female/i, fallbackIndex: 7, signature: [528, 792, 1056] };
      default:
        return { pitch: 1.0, rate: 1.0, preferred: /english|en-/i, fallbackIndex: 0, signature: [392, 523, 659] };
    }
  }

  /**
   * Speak character dialogue using SpeechSynthesis with tailored character voice profiles
   * and an accompanying synthesized BCI audio telemetry carrier.
   */
  public speakDialogue(speaker: string, text: string, onEnd?: () => void) {
    if (this.isMuted) {
      onEnd?.();
      return;
    }
    this.stopVoice();

    // Clean up stage directions like "(sitting, furious about it)" for speech output
    const spokenText = text.replace(/\([^)]*\)/g, '').trim() || text;

    // Accompanying electronic voice-activation blip
    this.playRadioBleep(speaker);

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    try {
      const profile = this.getCharacterVoiceProfile(speaker);
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.pitch = clamp(profile.pitch, 0.1, 2);
      utterance.rate = clamp(profile.rate, 0.5, 1.5);
      utterance.volume = 1.0;

      // Prefer a different installed timbre per character; pitch remains distinctive even
      // on devices that provide only one English system voice.
      const voices = this.speechVoices.length > 0 ? this.speechVoices : window.speechSynthesis.getVoices();
      const english = voices.filter(v => /^en([_-]|$)/i.test(v.lang));
      const pool = english.length ? english : voices;
      const matched = pool.find(v => profile.preferred.test(v.name)) || pool[profile.fallbackIndex % Math.max(1, pool.length)] || voices[0];
      if (matched) {
        utterance.voice = matched;
      }

      utterance.onend = () => {
        onEnd?.();
      };
      utterance.onerror = () => {
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      onEnd?.();
    }
  }

  /** BCI Radio transmission comms chirps for each dialogue line */
  private playRadioBleep(speaker: string) {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.voiceGain) return;
    const now = ctx.currentTime;
    const name = speaker.toUpperCase();
    const profile = this.getCharacterVoiceProfile(name);
    const digital = name === 'CHOIR' || name === 'SEVEN';

    // Every character has a tiny identifying three-note telemetry call sign.
    profile.signature.forEach((freq, i) => {
      this.tone(now + i * 0.035, digital ? 0.16 : 0.055, freq, digital ? 0.075 : 0.055, digital ? 'sine' : 'triangle', this.voiceGain);
      if (digital) this.tone(now + i * 0.035, 0.14, freq * 1.5, 0.035, 'sine', this.voiceGain);
    });

    // Squelch gives human BCI channels a dry radio-open transient.
    if (!digital) this.noiseBurst(now, 0.045, 0.035, 'highpass', 3200, 1.2, this.voiceGain);
  }
}

export const sound = new SoundSystem();
