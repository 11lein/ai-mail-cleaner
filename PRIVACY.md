# Privacy – AI Mail Cleaner

*Last updated: November 10, 2026 · [Deutsch](#datenschutz--deutsch) · [Español](#privacidad--español)*

AI Mail Cleaner runs entirely inside Thunderbird. There is **no developer server**, no telemetry,
no analytics and no ads.

## What leaves your computer?

Only when **you start a scan**, and only to **the provider you chose**:

| Data | When |
|---|---|
| Sender (name and address) and subject | every scan |
| A shortened text excerpt of the mail (default 1,500 characters) | only if “Send a text excerpt to the model” is on |
| Context: is the sender in your address book (yes/no), number of mails from the sender/domain in the folder and how many were opened, Thunderbird's junk flag | only if “Send context” is on (default) |
| Your API key (as an `Authorization` header) | every request to a provider that needs a key |

The **address book itself is never sent** – it is read locally and only the yes/no answer for the
sender of the scanned mail is included.

- **Decision model / OpenRouter:** requests go to `openrouter.ai`. The
  [OpenRouter privacy policy](https://openrouter.ai/privacy) and that of the model provider apply.
- **OpenAI-compatible:** requests go to the configured base URL (e.g. `api.openai.com`,
  `api.groq.com`); their privacy policies apply.
- **Ollaya / Ollama / LM Studio / Jev-Style server (local):** requests go to `localhost` /
  `127.0.0.1` – **nothing leaves your computer**.
- **Always encrypted:** requests to a provider use HTTPS. Plain `http://` is accepted only for a
  server on your own computer (`localhost`, `127.0.0.1`, `::1`); for any other address the add-on
  refuses it and sends nothing.

Trusted senders (whitelist) are **never** sent or scored. The mail preview loads **no** remote
content (images, trackers, fonts).

## Newsletters and unsubscribing

- **Detection** reads the visible mails (headers and text) – with the *Newsletters* filter on, all
  mails in the chosen range – from **your own mail server**. Nothing is sent to anyone.
- **Unsubscribing** only happens when you click. Depending on the newsletter and your choice it either opens the
  unsubscribe page **in your browser** (your browser then contacts the newsletter sender) or opens
  a **draft** in Thunderbird that you check and send yourself. The add-on never sends mail on its own.

## What is stored locally?

In Thunderbird's `storage.local` (stays on your computer, **not** synced):
- settings (provider, base URL, model, whitelist, columns)
- the API key, **obfuscated** (not real encryption, see README)
- spam scores and newsletter info per Message-ID, so mails are not processed again
- timings of the last scan for the statistics next to the model (counts and durations, no mail content)

Thunderbird deletes this data when the add-on is removed.

## Permissions

- **Read accounts, folders and messages / move / delete:** to show, score and clean up. Delete
  moves to the trash.
- **Optional: address books (read):** only to check whether a sender is a known contact (see
  above). Thunderbird asks at the first scan with *Send context* on (or via *Allow access* in the
  settings); without it that signal is simply left out. Switching *Send context* off gives the
  access back.
- **Optional: access to the provider's address:** none at installation. Thunderbird asks when you
  first use a provider (saving the settings, testing, loading the model list or scanning) – for
  OpenRouter as for any other provider, `localhost` / `127.0.0.1` for Ollaya, Ollama … – and only
  for that address. If you say no, nothing is sent there.
- **Optional: `webRequest` (Ollaya and Ollama only):** requested together with Ollama's address,
  and for Ollaya only when it refuses Thunderbird and you click *Allow access*. Both reject
  requests from add-ons by default; the add-on therefore sets the `Origin` header of its own
  requests to the server's own address. It sees and changes nothing else – no web pages,
  no other add-ons, no other servers.

Contact: via the issues of the GitHub repository.

---

## Datenschutz – Deutsch

AI Mail Cleaner läuft vollständig in Thunderbird – **kein Server des Entwicklers**, keine
Telemetrie, keine Analyse, keine Werbung.

**Daten verlassen den Rechner nur beim Scan** und nur zum **gewählten Anbieter**: Absender, Betreff,
optional ein gekürzter Textausschnitt (Standard 1.500 Zeichen), optional Kontext (Absender im
Adressbuch ja/nein, Anzahl seiner Mails im Ordner und wie viele geöffnet, Junk-Markierung von
Thunderbird – das Adressbuch selbst wird nie gesendet) sowie dein API-Schlüssel als
`Authorization`-Header – immer verschlüsselt per HTTPS; unverschlüsseltes `http://` nimmt das Add-on
nur für einen Server auf deinem eigenen Rechner an (`localhost`). Mit Ollaya, Ollama, LM Studio oder einem lokalen Jev-Style-Server bleibt alles lokal. Vertrauenswürdige
Absender werden nie gesendet. Die Vorschau lädt keine externen Inhalte.

**Newsletter:** Die Erkennung liest die sichtbaren Mails – bei aktivem Newsletter-Filter alle Mails
im gewählten Zeitraum – von deinem eigenen Mailserver. Es wird nichts gesendet. Abgemeldet wird nur auf Klick: Die Abmeldeseite öffnet sich in deinem Browser,
oder es öffnet sich ein Entwurf, den du selbst prüfst und sendest.

**Lokal gespeichert** (`storage.local`, nicht synchronisiert): Einstellungen, der API-Schlüssel
(verschleiert, keine echte Verschlüsselung), Spam-Bewertungen und Newsletter-Infos je Message-ID, die Zeiten des letzten Scans (Anzahlen und Dauer, kein Mailinhalt).

**Berechtigungen:** Konten/Ordner/Nachrichten lesen, verschieben, löschen (= Papierkorb);
optional Adressbücher lesen (nur für „bekannter Kontakt“, erfragt beim ersten Scan mit Kontext,
zurückgegeben wenn Kontext aus ist); Zugriff auf die Adresse des Anbieters (auch openrouter.ai)
erst bei Benutzung – lehnst du ab, wird dorthin nichts gesendet; nur für
Ollaya und Ollama optional `webRequest`, um bei den eigenen Anfragen an sie den `Origin`-Header auf
die Adresse des Servers zu setzen (sonst lehnen beide Add-ons ab) – sonst wird nichts gelesen oder geändert.

## Privacidad – Español

AI Mail Cleaner funciona por completo dentro de Thunderbird: **sin servidor del desarrollador**,
sin telemetría, sin analítica y sin publicidad.

**Los datos solo salen de tu ordenador al analizar**, y solo al **proveedor que elegiste**:
remitente, asunto, opcionalmente un extracto acortado del texto (1500 caracteres por defecto),
opcionalmente contexto (si el remitente está en tu libreta sí/no, cuántos correos suyos hay en la
carpeta y cuántos se abrieron, la marca de correo basura de Thunderbird; la libreta en sí nunca se
envía) y tu clave de API como cabecera `Authorization`, siempre cifrado por HTTPS (el complemento solo
acepta `http://` sin cifrar para un servidor en tu propio ordenador, `localhost`). Con Ollaya, Ollama, LM Studio o un servidor Jev-Style local todo queda en local.
Los remitentes de confianza nunca se envían. La vista previa no carga contenido externo.

**Boletines:** la detección lee los correos visibles (con el filtro de boletines activo, todos los
del periodo elegido) de tu propio servidor de correo; no se envía nada. La baja solo ocurre al hacer clic: se abre la página de baja en tu navegador o un borrador que
revisas y envías tú mismo.

**Guardado en local** (`storage.local`, sin sincronizar): ajustes, la clave de API (ofuscada, no es
cifrado real), puntuaciones de spam e información de boletines por Message-ID, y los tiempos del último análisis (cantidades y duraciones, sin contenido de correos).

**Permisos:** leer cuentas/carpetas/mensajes, mover, eliminar (= papelera);
leer libretas de direcciones de forma opcional (solo para «contacto conocido», se pide en el primer
análisis con contexto y se devuelve al desactivar el contexto); acceso a la dirección del proveedor
(también openrouter.ai) solo al usarlo; si lo rechazas, no se envía nada allí; solo para Ollaya y Ollama,
`webRequest` opcional para fijar la cabecera `Origin` de las propias solicitudes a ellos en la
dirección del servidor (si no, ambos rechazan los complementos); no se lee ni se cambia nada más.
