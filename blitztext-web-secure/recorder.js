// Entspricht AudioRecorder.swift (AVFoundation → Web Audio API)
const MAX_RECORDING_MS = 180_000; // 3 Minuten – Whisper-API-Limit: 25 MB

export class AudioRecorder {
  constructor(onLevelUpdate, onAutoStop = null) {
    this.onLevelUpdate = onLevelUpdate;
    this.onAutoStop = onAutoStop;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.animationId = null;
    this._maxDurationTimer = null;
    this.chunks = [];
    this.stream = null;
  }

  async start() {
    this.chunks = [];
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Mikrofon-Zugriff erfordert HTTPS. ' +
        'Bitte die Coder-HTTPS-URL verwenden (nicht die direkte IP-Adresse).'
      );
    }
    let micTimeoutId;
    const micTimeout = new Promise((_, reject) => {
      micTimeoutId = setTimeout(() => reject(new Error('Mikrofon antwortet nicht (Timeout).')), 10000);
    });
    this.stream = await Promise.race([
      navigator.mediaDevices.getUserMedia({ audio: true }),
      micTimeout,
    ]);
    clearTimeout(micTimeoutId);

    // Pegel-Analyse (entspricht AVAudioRecorder.averagePower)
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
    this._startMetering();

    // Aufnahme – webm/opus wird von Whisper API akzeptiert
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();

    this._maxDurationTimer = setTimeout(() => {
      this.onAutoStop?.();
    }, MAX_RECORDING_MS);
  }

  stop() {
    return new Promise((resolve) => {
      this._stopMetering();
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        this._cleanup();
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  discard() {
    this._stopMetering();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this._cleanup();
  }

  _startMetering() {
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      this.analyser.getByteFrequencyData(data);
      const avg = data.reduce((s, v) => s + v, 0) / data.length;
      // Normalisiert 0–1 (entspricht normalized = max(0, min(1, (power + 50) / 50)))
      this.onLevelUpdate(Math.min(1, avg / 128));
      this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
  }

  _stopMetering() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.onLevelUpdate(0);
  }

  _cleanup() {
    if (this._maxDurationTimer) {
      clearTimeout(this._maxDurationTimer);
      this._maxDurationTimer = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioContext?.close();
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }
}
