# Blitztext

> Sprache per Hotkey in Text – direkt in die Ziel-App eingefügt.

Blitztext ist ein experimentelles Open-Source-Tool, das Audio-Aufnahme, KI-gestützte Transkription und optionale LLM-Nachbearbeitung in einem einzigen Tastendruck vereint. Das Projekt befindet sich im Aufbau und steht unter dem Motto: **bring your own OpenAI API key, no backend, no warranty**.

---

## Inhaltsverzeichnis

- [Versionen: unsecured-key vs. secure](#versionen-unsecured-key-vs-secure)
- [Projektübersicht](#projektübersicht)
- [Architektur & Portierungs-Status](#architektur--portierungs-status)
- [Feature-Liste & Workflows](#feature-liste--workflows)
- [Setup & Konfiguration](#setup--konfiguration)
  - [Option A: Lokale Entwicklung](#option-a-lokale-entwicklung-localhost)
  - [Option B: Eigener Webserver](#option-b-eigener-webserver-apache--nginx)
  - [Option C: VPS](#option-c-vps-ubuntu--debian)
- [Bekannte Einschränkungen & Workarounds](#bekannte-einschränkungen--workarounds)
- [Roadmap](#roadmap)
- [Technischer Stack](#technischer-stack)

---

## Versionen: unsecured-key vs. secure

Dieses Repository enthält zwei Varianten der Web-App:

| | `blitztext-web-unsecured-key/` | `blitztext-web-secure/` |
|---|---|---|
| **API-Key-Speicherung** | `config.js` im Webroot (im Browser lesbar) | `config.js` im Webroot (im Browser lesbar) |
| **Zielgruppe** | Ausschließlich Eigennutzung auf localhost | Webserver / Intranet / VPS |
| **Rate-Limiting** | Keines | 2-Sekunden-Cooldown zwischen Requests |
| **Input-Validierung** | Keine (Custom Terms ungefiltert) | Länge, Zeichensatz, Anzahl geprüft |
| **Fehler-Details** | OpenAI-Rohmeldungen sichtbar | Generische Fehlertexte |
| **Mikrofon-Timeout** | Kein Timeout | 10-Sekunden-Timeout |
| **Security-Header** | Nicht konfiguriert | In Webserver-Beispielen enthalten |

### ⚠️ WARNUNG: blitztext-web-unsecured-key

> **Diese Version ist ausschließlich für die private Eigennutzung auf dem eigenen Rechner (localhost) gedacht.**

Der OpenAI API-Key liegt in `config.js` und ist für jeden sichtbar, der die Seite öffnen kann – im Netzwerk-Tab der Browser-DevTools, in gespeicherten Dateien, in Server-Logs.

**NEVER EVER diese Version auf einem Webserver, VPS, im Heimnetzwerk, im Firmennetz oder sonst irgendwo betreiben, wo andere Personen die URL aufrufen könnten.**

Wer Zugriff auf die URL hat, kann:
- deinen OpenAI API-Key auslesen
- auf deine Kosten beliebig viele Whisper-Anfragen stellen
- deinen Key in Sekunden durch automatisierte Scans finden und missbrauchen

**Für jeden Zugriff durch andere Personen: ausschließlich `blitztext-web-secure/` verwenden** – und auch dort liegt der Key noch im Browser. Für echte Multi-User-Szenarien ist ein Backend-Proxy zwingend erforderlich (siehe [Roadmap](#roadmap)).

---

## Projektübersicht

Blitztext automatisiert den Diktier-Workflow:

1. Hotkey halten
2. Sprechen
3. Loslassen → Text erscheint in der Ziel-App

Dieses Repository enthält ausschließlich die **Web-MVP-Portierung** (Varianten `blitztext-web-unsecured-key/` und `blitztext-web-secure/`). Den originalen macOS-Quellcode (Swift) findet man hier:

> **macOS-Original:** [github.com/cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app)

| Version | Status | Quelle |
|---------|--------|--------|
| macOS MenuBar-App (Swift) | Funktionsfähig, macOS 14+ | [cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app) |
| Web-MVP (Vanilla JS) | Funktionsfähig, intern | dieses Repository |

Die macOS-App ist die vollständige Referenz-Implementierung mit systemweitem Hotkey und automatischem Einfügen. Die Web-App ist ein plattformunabhängiger MVP mit eingeschränktem Funktionsumfang (Details siehe [Einschränkungen](#bekannte-einschränkungen--workarounds)).

---

## Architektur & Portierungs-Status

### Ursprung: macOS-App

Die Referenz-Implementierung ([cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app)) ist eine native macOS MenuBar-App (Swift 5.10, SwiftUI + AppKit). Sie nutzt tief in das macOS-Ökosystem eingebettete APIs:

- **NSEvent** für systemweite Hotkeys
- **CGEvent** für automatisches Tastatur-Simulieren (Auto-Paste)
- **AVFoundation** für Audio-Aufnahme
- **Security Framework / Keychain** für API-Key-Verwaltung
- **WhisperKit / CoreML** für lokale Offline-Transkription

Etwa **65 % der macOS-Codebasis** sind direkt an Apple-APIs gebunden und können nicht ohne Neuentwicklung portiert werden.

### Portierung: Web-MVP → Electron

Die Portierung erfolgt schrittweise:

>> Schritt 1 (abgeschlossen): Web-MVP
   Audio-Aufnahme + Whisper-API + Tab-lokale Hotkeys
   → blitztext-web/ (Vanilla JS, kein Build-Tool)

   Schritt 2 (geplant): Electron-Wrapper
   Gleicher Web-Code + globale Hotkeys + Auto-Paste via robotjs/nut-js

   Schritt 3 (geplant): Lokale Transkription
   WhisperKit-Ersatz via ONNX Runtime / whisper.cpp <<

Die ~**35 % plattformunabhängige Geschäftslogik** (HTTP-Clients für Whisper & LLM, Workflow-Orchestrierung, Qualitätsprüfung) wurde direkt von Swift nach JavaScript portiert.

---

## Feature-Liste & Workflows

### macOS-App: 5 Workflows

| Workflow | Hotkey | Funktion |
|----------|--------|---------|
| **Blitztext** | `fn` + `Shift` | Sprache → OpenAI Whisper (remote) → Text |
| **Blitztext Lokal** | `fn` + `Shift` + `Ctrl` | Sprache → WhisperKit/CoreML (offline) → Text |
| **Blitztext+** | `fn` + `Ctrl` | Sprache → Whisper → GPT-4o-mini (Textverbesserung) |
| **Blitztext $%&!** | `fn` + `Option` | Sprache → Whisper → GPT-4o (Wut-Nachricht → sachlich) |
| **Blitztext :)** | `fn` + `Cmd` | Sprache → Whisper → GPT-4o-mini (Emojis ergänzen) |

> Alle Workflows folgen dem Prinzip: Taste halten = aufnehmen, loslassen = verarbeiten und einfügen.

### Web-MVP: Implementierter Kern

Die Web-App implementiert derzeit den Basis-Workflow **Blitztext** (Transkription) mit konfigurierbarem Hotkey:

- Hotkey konfigurierbar (Standard: `Linke Strg` + `Leertaste`)
- Linke vs. rechte Modifier-Taste wird unterschieden
- Hotkey-Aufzeichnung per Klick auf "Ändern" im UI
- Waveform-Visualisierung während der Aufnahme
- Automatisches Kopieren in die Zwischenablage nach Transkription

---

## Setup & Konfiguration

### Voraussetzungen (alle Installationsarten)

- Moderner Browser (Chrome oder Edge empfohlen)
- OpenAI API Key mit Zugriff auf `whisper-1`
- **HTTPS ist Pflicht** für Mikrofon-Zugriff (einzige Ausnahme: `localhost`)

---

### Schritt 1: Repository klonen

>> git clone https://github.com/<dein-username>/blitztext-web.git
   cd blitztext-web <<

---

### Schritt 2: config.js erstellen (API-Key)

> **Wichtig:** Die Datei `config.js` ist in `.gitignore` eingetragen und wird **nicht** mit dem Repository ausgeliefert. Sie muss auf jedem System manuell erstellt werden.

Im Verzeichnis `blitztext-web/` die Datei `config.js` anlegen:

>> Datei: blitztext-web/config.js

   export const OPENAI_API_KEY = 'sk-HIER_DEINEN_API_KEY_EINTRAGEN'; <<

> **Sicherheitshinweis:** Diese Datei enthält einen geheimen Schlüssel. Niemals in ein öffentliches Repository einchecken. Die `.gitignore` verhindert dies automatisch.

---

### Option A: Lokale Entwicklung (localhost)

Geeignet für: Entwicklung, Tests, einzelne Arbeitsplätze ohne Netzwerkzugriff.

**Voraussetzung:** Python 3 installiert

>> # Im Elternverzeichnis starten, damit /blitztext-web/ als Pfad erreichbar ist
   cd /pfad/zum/repository
   python3 -m http.server 8181 <<

Aufruf im Browser:

>> http://localhost:8181/blitztext-web/ <<

`localhost` gilt als sicherer Kontext – Mikrofon-Zugriff funktioniert ohne HTTPS.

---

### Option B: Eigener Webserver (Apache / Nginx)

Geeignet für: Firmen-Intranet, lokales Netzwerk, bereits vorhandene Webserver-Infrastruktur.

> **HTTPS-Hinweis:** Für den Mikrofon-Zugriff muss der Webserver zwingend über HTTPS erreichbar sein. Bei einem internen Server kann ein selbstsigniertes Zertifikat verwendet werden – der Browser muss dieses dann einmalig manuell akzeptieren.

**Schritt 1: Dateien hochladen**

Die Dateien aus `blitztext-web/` (ohne `config.js`) in das Webroot des Servers kopieren:

>> scp -r blitztext-web/ benutzer@server:/var/www/html/blitztext/ <<

**Schritt 2: config.js auf dem Server anlegen**

>> ssh benutzer@server
   nano /var/www/html/blitztext/config.js <<

Inhalt:

>> export const OPENAI_API_KEY = 'sk-HIER_DEINEN_API_KEY_EINTRAGEN'; <<

**Nginx-Konfiguration** (`/etc/nginx/sites-available/blitztext`):

>> server {
       listen 443 ssl;
       server_name blitztext.intern.example.com;

       ssl_certificate     /etc/ssl/certs/intern.crt;
       ssl_certificate_key /etc/ssl/private/intern.key;

       root /var/www/html;
       index index.html;

       location /blitztext/ {
           try_files $uri $uri/ =404;
           add_header Cache-Control "no-store";
           add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
           add_header X-Content-Type-Options "nosniff" always;
           add_header X-Frame-Options "DENY" always;
           add_header Referrer-Policy "no-referrer" always;
           add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.openai.com; media-src 'self' blob:; script-src 'self'" always;
       }
   } <<

**Apache-Konfiguration** (`.htaccess` im Verzeichnis `blitztext/`):

>> Options -Indexes
   Header set Cache-Control "no-store"
   Header always set X-Content-Type-Options "nosniff"
   Header always set X-Frame-Options "DENY"
   Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
   Header always set Referrer-Policy "no-referrer"
   Header always set Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.openai.com; media-src 'self' blob:; script-src 'self'" <<

Nach der Konfiguration Nginx bzw. Apache neu laden:

>> # Nginx
   sudo nginx -t && sudo systemctl reload nginx

   # Apache
   sudo systemctl reload apache2 <<

Aufruf im Browser:

>> https://blitztext.intern.example.com/blitztext/ <<

---

### Option C: VPS (Ubuntu / Debian)

Geeignet für: öffentlich erreichbare Instanz, Team-Nutzung, Fernzugriff.

> Diese Anleitung verwendet **Nginx** als Webserver und **Certbot / Let's Encrypt** für ein kostenloses HTTPS-Zertifikat. Voraussetzung: Eine Domain zeigt per DNS-A-Record auf die VPS-IP.

**Schritt 1: Pakete installieren**

>> sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx <<

**Schritt 2: Dateien übertragen**

>> scp -r blitztext-web/ root@DEINE-VPS-IP:/var/www/html/blitztext/ <<

**Schritt 3: config.js auf dem VPS anlegen**

>> ssh root@DEINE-VPS-IP
   nano /var/www/html/blitztext/config.js <<

Inhalt:

>> export const OPENAI_API_KEY = 'sk-HIER_DEINEN_API_KEY_EINTRAGEN'; <<

**Schritt 4: Nginx konfigurieren**

>> sudo nano /etc/nginx/sites-available/blitztext <<

Inhalt:

>> server {
       listen 80;
       server_name deine-domain.de;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl;
       server_name deine-domain.de;

       # SSL wird von Certbot automatisch ergänzt

       root /var/www/html;
       index index.html;

       location /blitztext/ {
           try_files $uri $uri/ =404;
           add_header Cache-Control "no-store";
           add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
           add_header X-Content-Type-Options "nosniff" always;
           add_header X-Frame-Options "DENY" always;
           add_header Referrer-Policy "no-referrer" always;
           add_header Content-Security-Policy "default-src 'self'; connect-src 'self' https://api.openai.com; media-src 'self' blob:; script-src 'self'" always;
       }
   } <<

Konfiguration aktivieren:

>> sudo ln -s /etc/nginx/sites-available/blitztext /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx <<

**Schritt 5: HTTPS-Zertifikat einrichten (Let's Encrypt)**

>> sudo certbot --nginx -d deine-domain.de <<

Certbot ergänzt die Nginx-Konfiguration automatisch um SSL. Nach erfolgreichem Durchlauf ist die App erreichbar unter:

>> https://deine-domain.de/blitztext/ <<

Zertifikat läuft nach 90 Tagen ab – automatische Erneuerung prüfen:

>> sudo certbot renew --dry-run <<

**Schritt 6: Mikrofon-Berechtigung im Browser erteilen**

Beim ersten Aufruf fragt der Browser nach der Mikrofon-Berechtigung. **Zulassen** wählen.

Falls die Berechtigung versehentlich verweigert wurde:

- **Chrome / Edge:** Schloss-Symbol → Mikrofon → Zulassen → Seite neu laden
- **Firefox:** Schloss-Symbol → Berechtigungen → Mikrofon → Zulassen

---

### Hotkey anpassen

Der Standard-Hotkey (`Linke Strg` + `Leertaste`) kann im UI geändert werden:

1. Auf **"Ändern"** neben dem Hotkey-Feld klicken
2. Gewünschte Tastenkombination drücken (z. B. `Ctrl` + `Space` oder `Alt` + `R`)
3. Kombination wird sofort gespeichert und angezeigt

`Esc` bricht die Aufzeichnung ab. Die Einstellung wird in `localStorage` gespeichert.

---

## Bekannte Einschränkungen & Workarounds

### Funktionsvergleich: macOS-App vs. Web-MVP

| Funktion | macOS-App | Web-MVP |
|----------|-----------|---------|
| Transkription (remote, Whisper) | ✅ | ✅ |
| Lokale Transkription (offline) | ✅ WhisperKit/CoreML | ✗ |
| LLM-Workflows (Blitztext+, etc.) | ✅ | ✗ (geplant) |
| Globale Hotkeys (systemweit) | ✅ | ✗ nur bei aktivem Tab |
| Auto-Paste in Ziel-App | ✅ CGEvent | ✗ |
| Automatisch in Zwischenablage | ✅ | ✅ |
| Autostart beim Login | ✅ SMAppService | ✗ |
| API-Key sicher gespeichert | ✅ Keychain | ⚠️ config.js (intern) |

---

### Workaround: Manueller Paste-Workflow (Web)

Da der Browser aus Sicherheitsgründen keinen direkten Zugriff auf andere Anwendungen hat, ist Auto-Paste nicht möglich. Der Workflow im Web-MVP lautet:

>> 1. Ziel-App vorbereiten (Cursor an die gewünschte Stelle setzen)
   2. Zum Browser-Tab wechseln
   3. Hotkey halten → sprechen → loslassen
   4. Text wird transkribiert und automatisch in die Zwischenablage kopiert
   5. Zurück in die Ziel-App wechseln
   6. Strg+V drücken <<

> Der "Kopieren"-Button entfällt – die Web-App kopiert nach erfolgreicher Transkription automatisch.

---

### Hotkeys funktionieren nur bei aktivem Browser-Tab

Browser-Sicherheitsmodell: JavaScript empfängt Tastaturereignisse nur, solange der Tab den Fokus hat. Wenn die Ziel-App im Vordergrund ist, sind die Hotkeys inaktiv.

**Konsequenz für den Workflow:** Tab-Wechsel ist erforderlich (siehe Workaround oben).

**Langfristige Lösung:** Electron-App mit `globalShortcut` (siehe Roadmap).

---

### HTTPS-Pflicht für Mikrofon-Zugriff

`navigator.mediaDevices.getUserMedia()` funktioniert ausschließlich über:
- `https://` (verschlüsselte Verbindung)
- `http://localhost` (lokale Entwicklung)

Beim Zugriff über eine externe IP-Adresse oder Domain via `http://` verweigert der Browser den Mikrofon-Zugriff. Für VPS und Webserver ist daher ein gültiges SSL-Zertifikat zwingend erforderlich.

---

## Roadmap

### Kurzfristig – Web-MVP erweitern

- [ ] Sprache manuell wählbar (DE, EN, …)
- [ ] Custom Terms / Fachbegriffe konfigurierbar
- [ ] Aufnahmedauer-Anzeige
- [ ] LLM-Workflows (Blitztext+, Rage-Mode, Emoji) portieren

### Mittelfristig – Electron-App

- [ ] Electron-Wrapper um den bestehenden Web-Code
- [ ] Globale Hotkeys via `electron.globalShortcut`
- [ ] Auto-Paste in native Apps via `robotjs` oder `nut-js`
- [ ] Sichere API-Key-Verwaltung via `keytar` (plattformübergreifende Keychain)
- [ ] Autostart via `auto-launch`

### Langfristig – Vollständige Parität

- [ ] Lokale Transkription via ONNX Runtime / `whisper.cpp` (WhisperKit-Ersatz)
- [ ] Windows-Installer (.exe)
- [ ] Benutzerauthentifizierung (statt API-Key in Datei)

---

## Technischer Stack

### macOS-App (Referenz-Implementierung)

Quellcode: [github.com/cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app)

| Komponente | Technologie |
|-----------|-------------|
| Sprache | Swift 5.10 |
| UI | SwiftUI + AppKit |
| Build | XcodeGen + Xcode 16 |
| Audio | AVFoundation |
| Lokale KI | WhisperKit 0.18.0 (CoreML) |
| Persistenz | Keychain (Security Framework) + JSON |
| Concurrency | async/await + @Observable |

### Web-MVP (dieses Repository)

| Komponente | Technologie |
|-----------|-------------|
| Sprache | Vanilla JavaScript (ES Modules) |
| UI | HTML + CSS (kein Framework) |
| Build-Tool | keines (direkt per Browser ausführbar) |
| Audio | Web Audio API (MediaRecorder) |
| Transkription | OpenAI Whisper API (`whisper-1`) |
| Hotkey | `KeyboardEvent.code` (inkl. Links/Rechts-Unterscheidung) |
| Persistenz | `config.js` (API-Key) + `localStorage` (Hotkey) |

---

## Lizenz

Dieses Projekt steht unter den Bedingungen der im Repository hinterlegten Lizenz.

> **Hinweis:** Experimenteller Status. Keine Produktionsgarantie, kein gehostetes Backend, kein Support-Versprechen. Bring your own API key.

---

*Web-Portierung basierend auf [cmagnussen/blitztext-app](https://github.com/cmagnussen/blitztext-app) – Juni 2026.*
