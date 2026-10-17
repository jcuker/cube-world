// Authentic 2005 Radica Cube World Piezo Buzzer Synthesizer (Web Audio API)
window.CW = window.CW || {};

class PiezoAudio {
  constructor() {
    this.enabled = true;
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  tone(freq, durationMs, delayMs = 0, type = 'square', gainVal = 0.045) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const start = this.ctx.currentTime + delayMs / 1000;
    const dur = durationMs / 1000;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(gainVal, start);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(start);
    osc.stop(start + dur);
  }

  // Iconic magnetic snap + handshake recognition chime
  playSnap() {
    this.tone(520, 45, 0, 'square', 0.05);
    this.tone(1046, 55, 50, 'square', 0.05);
    this.tone(1318, 70, 110, 'square', 0.055);
    this.tone(1568, 95, 185, 'square', 0.05);
  }

  playDetach() {
    this.tone(980, 50, 0, 'square', 0.04);
    this.tone(620, 65, 55, 'square', 0.04);
  }

  playButton() {
    this.tone(1200, 35, 0, 'square', 0.04);
  }

  playDoorCross() {
    this.tone(740, 35, 0, 'square', 0.03);
    this.tone(880, 45, 40, 'square', 0.03);
  }

  playTrick(id = '') {
    if (id === 'mic' || id === 'hiphop') {
      this.tone(659, 70, 0);
      this.tone(784, 70, 80);
      this.tone(987, 90, 160);
      this.tone(1318, 120, 260);
    } else if (id === 'scoop') {
      // Bark-bark!
      this.tone(440, 45, 0, 'sawtooth', 0.045);
      this.tone(620, 35, 25, 'square', 0.045);
      this.tone(440, 45, 110, 'sawtooth', 0.045);
      this.tone(640, 35, 135, 'square', 0.045);
    } else if (id === 'scifi') {
      this.tone(1600, 50, 0, 'sine', 0.05);
      this.tone(1100, 50, 50, 'sine', 0.05);
      this.tone(1900, 80, 100, 'sine', 0.05);
    } else {
      this.tone(880, 45, 0);
      this.tone(1174, 55, 55);
    }
  }

  playTilt() {
    this.tone(600, 50, 0);
    this.tone(480, 60, 55);
    this.tone(360, 90, 120);
  }

  playShake() {
    [0, 60, 120, 180].forEach((d, idx) => {
      this.tone(500 + (idx % 2) * 350, 45, d, 'square', 0.045);
    });
  }
}

window.CW.audio = new PiezoAudio();
