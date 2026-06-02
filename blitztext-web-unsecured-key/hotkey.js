const STORAGE_KEY = 'blitztext_hotkey';

const DEFAULT_HOTKEY = {
  code: 'Space',
  ctrlKey: true,
  shiftKey: false,
  altKey: false,
  requireLeftCtrl: true, // ControlLeft vs. ControlRight
};

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight',
  'ShiftLeft', 'ShiftRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
]);

const CODE_LABELS = {
  Space: 'Leertaste', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc',
  Backspace: 'Rücktaste', Delete: 'Entf',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
};
for (let i = 1; i <= 12; i++) CODE_LABELS[`F${i}`] = `F${i}`;

export function loadHotkey() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_HOTKEY, ...JSON.parse(raw) };
  } catch (_) {}
  return { ...DEFAULT_HOTKEY };
}

export function saveHotkey(hotkey) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hotkey));
}

export function hotkeyLabel(h) {
  const parts = [];
  if (h.ctrlKey)  parts.push(h.requireLeftCtrl ? 'Linke Strg' : 'Strg');
  if (h.shiftKey) parts.push('Umschalt');
  if (h.altKey)   parts.push('Alt');
  const code = h.code;
  const label =
    CODE_LABELS[code] ??
    code.replace('Key', '').replace('Digit', '');
  parts.push(label);
  return parts.join(' + ');
}

export class HotkeyService {
  constructor({ onStart, onStop }) {
    this.onStart = onStart;
    this.onStop = onStop;
    this.hotkey = loadHotkey();
    this._active = false;
    this._capturing = false;
    this._captureCallback = null;
    this._lastCtrlCode = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp   = this._onKeyUp.bind(this);
  }

  enable() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup',   this._onKeyUp);
  }

  disable() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup',   this._onKeyUp);
  }

  captureNext(callback) {
    this._capturing = true;
    this._captureCallback = callback;
  }

  cancelCapture() {
    this._capturing = false;
    this._captureCallback = null;
  }

  update(hotkey) {
    this.hotkey = hotkey;
    saveHotkey(hotkey);
  }

  _matchesHotkey(e) {
    const h = this.hotkey;
    if (e.code !== h.code)          return false;
    if (!!h.ctrlKey  !== e.ctrlKey)  return false;
    if (!!h.shiftKey !== e.shiftKey) return false;
    if (!!h.altKey   !== e.altKey)   return false;
    if (h.ctrlKey && h.requireLeftCtrl && this._lastCtrlCode !== 'ControlLeft') return false;
    return true;
  }

  _onKeyDown(e) {
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      this._lastCtrlCode = e.code;
    }

    // Aufnahme-Modus: nächste Kombination als neuen Hotkey speichern
    if (this._capturing) {
      if (MODIFIER_CODES.has(e.code)) return; // Modifier allein ignorieren
      if (e.code === 'Escape') {
        this.cancelCapture();
        this._captureCallback?.(null); // abgebrochen
        return;
      }
      const newHotkey = {
        code: e.code,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        requireLeftCtrl: e.ctrlKey && this._lastCtrlCode === 'ControlLeft',
      };
      e.preventDefault();
      this._capturing = false;
      const cb = this._captureCallback;
      this._captureCallback = null;
      cb(newHotkey);
      return;
    }

    // Eingabefelder nicht unterbrechen
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (!this._active && this._matchesHotkey(e)) {
      e.preventDefault();
      this._active = true;
      this.onStart();
    }
  }

  _onKeyUp(e) {
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      this._lastCtrlCode = null;
    }

    // Stopp wenn Hotkey-Taste oder ein benötigter Modifier losgelassen wird
    if (this._active) {
      const h = this.hotkey;
      const triggerReleased = e.code === h.code;
      const ctrlReleased = h.ctrlKey && (e.code === 'ControlLeft' || e.code === 'ControlRight');
      const shiftReleased = h.shiftKey && (e.code === 'ShiftLeft' || e.code === 'ShiftRight');
      const altReleased = h.altKey && (e.code === 'AltLeft' || e.code === 'AltRight');
      if (triggerReleased || ctrlReleased || shiftReleased || altReleased) {
        this._active = false;
        this.onStop();
      }
    }
  }
}
