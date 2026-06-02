import { AudioRecorder } from './recorder.js';
import { transcribe, TranscriptionError } from './transcription.js';
import { HotkeyService, hotkeyLabel, saveHotkey } from './hotkey.js';
import { OPENAI_API_KEY } from './config.js';

const $ = (id) => document.getElementById(id);

// --- Audio & Hotkey ---
const recorder = new AudioRecorder((level) => updateWaveform(level));
let isRecording = false;

const hotkey = new HotkeyService({
  onStart: () => startRecording(),
  onStop:  () => stopAndTranscribe(),
});
hotkey.enable();

// --- Hotkey-Anzeige ---
function renderHotkeyLabel() {
  $('hotkeyLabel').textContent = hotkeyLabel(hotkey.hotkey);
}
renderHotkeyLabel();

// --- Hotkey aufzeichnen ---
$('changeHotkey').addEventListener('click', () => {
  $('hotkeyLabel').textContent = 'Taste drücken… (Esc = Abbrechen)';
  $('changeHotkey').disabled = true;

  hotkey.captureNext((newHotkey) => {
    if (newHotkey) {
      hotkey.update(newHotkey);
      showStatus('Hotkey gespeichert.', 'ok');
    }
    renderHotkeyLabel();
    $('changeHotkey').disabled = false;
  });
});

// --- Aufnahme-Button (Fallback für Maus) ---
$('recordBtn').addEventListener('click', async () => {
  if (!isRecording) await startRecording();
  else await stopAndTranscribe();
});

// --- Kopieren ---
$('copyBtn').addEventListener('click', () => {
  const text = $('result').value;
  if (!text) return;
  navigator.clipboard.writeText(text);
  showStatus('In Zwischenablage kopiert. Jetzt Strg+V in der Ziel-App drücken.', 'ok');
});

// --- Aufnahme-Logik ---
async function startRecording() {
  if (isRecording) return;
  clearStatus();
  $('result').value = '';
  $('copyBtn').disabled = true;

  try {
    await recorder.start();
  } catch (err) {
    showStatus(err.message, 'error');
    return;
  }

  isRecording = true;
  $('recordBtn').textContent = '⏹  Stopp & Transkribieren';
  $('recordBtn').classList.add('recording');
  $('status').textContent = `Aufnahme läuft… (${hotkeyLabel(hotkey.hotkey)} loslassen zum Stoppen)`;
}

async function stopAndTranscribe() {
  if (!isRecording) return;
  isRecording = false;
  $('recordBtn').textContent = '⏳  Wird transkribiert…';
  $('recordBtn').disabled = true;
  $('recordBtn').classList.remove('recording');

  let blob;
  try {
    blob = await recorder.stop();
  } catch (err) {
    showStatus('Aufnahme-Fehler: ' + err.message, 'error');
    resetButton();
    return;
  }

  try {
    showStatus('Sende an Whisper API…', 'info');
    const text = await transcribe(blob, OPENAI_API_KEY);
    $('result').value = text;
    $('copyBtn').disabled = false;

    try {
      await navigator.clipboard.writeText(text);
      showStatus('✓ In Zwischenablage kopiert → jetzt Strg+V in Ziel-App drücken', 'ok');
    } catch (_) {
      // Fallback: Nutzer muss manuell kopieren (z.B. bei fehlender Clipboard-Berechtigung)
      showStatus('Bitte "Kopieren" klicken und dann Strg+V in der Ziel-App drücken.', 'info');
    }
  } catch (err) {
    showStatus(err instanceof TranscriptionError ? err.message : 'Fehler: ' + err.message, 'error');
  } finally {
    resetButton();
  }
}

function resetButton() {
  $('recordBtn').textContent = '● Aufnehmen';
  $('recordBtn').disabled = false;
  $('recordBtn').classList.remove('recording');
}

function showStatus(msg, type) {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status ' + type;
}

function clearStatus() {
  $('status').textContent = '';
  $('status').className = 'status';
}

// --- Waveform ---
const bars = Array.from($('waveform').querySelectorAll('.bar'));

function updateWaveform(level) {
  bars.forEach((bar, i) => {
    const offset = Math.abs(Math.sin((i / bars.length) * Math.PI));
    const height = isRecording ? Math.max(4, level * 40 * (0.4 + offset * 0.6)) : 4;
    bar.style.height = height + 'px';
  });
}
