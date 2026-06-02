// Entspricht TranscriptionService.swift (URLSession multipart → fetch + FormData)
const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

export class TranscriptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export async function transcribe(audioBlob, apiKey, { language = '', customTerms = [] } = {}) {
  if (!apiKey) throw new TranscriptionError('OpenAI API Key fehlt. Bitte oben eintragen.');

  // FormData ersetzt den manuellen multipart-Body aus TranscriptionService.swift (~60 Zeilen → 5 Zeilen)
  const form = new FormData();
  form.append('file', audioBlob, 'audio.webm');
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');

  if (language.trim()) form.append('language', language.trim());
  if (customTerms.length > 0) {
    form.append('prompt', `Eigennamen und Begriffe: ${customTerms.join(', ')}`);
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

  const text = await response.text();

  if (!response.ok) {
    let msg = `Status ${response.status}`;
    try {
      const json = JSON.parse(text);
      if (json.error?.message) msg = json.error.message;
    } catch (_) {}
    throw new TranscriptionError(`OpenAI-Fehler: ${msg}`);
  }

  const result = text.trim();
  if (!result) throw new TranscriptionError('Transkription leer – bitte erneut versuchen.');
  return result;
}
