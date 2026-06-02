// Entspricht TranscriptionService.swift (URLSession multipart → fetch + FormData)
const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export class TranscriptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

const MAX_TERMS = 20;
const MAX_TERM_LENGTH = 100;
const SAFE_TERM_RE = /^[\p{L}\p{N}\s\-'.]+$/u;

export async function transcribe(audioBlob, apiKey, { language = '', customTerms = [] } = {}) {
  if (!apiKey || apiKey.startsWith('sk-HIER')) {
    throw new TranscriptionError('OpenAI API Key fehlt. Bitte config.js ausfüllen.');
  }

  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  if (language.trim()) form.append('language', language.trim());
  if (customTerms.length > 0) {
    const validated = customTerms
      .slice(0, MAX_TERMS)
      .map(t => String(t).trim().slice(0, MAX_TERM_LENGTH))
      .filter(t => t.length > 0 && SAFE_TERM_RE.test(t));
    if (validated.length > 0) {
      form.append('prompt', `Eigennamen und Begriffe: ${validated.join(', ')}`);
    }
  }

  let response;
  try {
    response = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    throw new TranscriptionError(`Netzwerkfehler: ${err.message}`);
  }

  if (!response.ok) {
    if (response.status === 401) throw new TranscriptionError('API Key ungültig oder abgelaufen.');
    if (response.status === 429) throw new TranscriptionError('API-Limit erreicht. Bitte kurz warten.');
    throw new TranscriptionError(`Transkription fehlgeschlagen (HTTP ${response.status}).`);
  }

  const text = await response.text();
  const result = text.trim();
  if (!result) throw new TranscriptionError('Transkription leer – bitte erneut versuchen.');
  return result;
}
