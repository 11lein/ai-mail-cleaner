# Privacy – AI Mail Cleaner

*Last updated: November 6, 2026 · [Deutsch](#datenschutz--deutsch) · [Español](#privacidad--español)*

AI Mail Cleaner runs entirely inside Thunderbird. There is **no developer server**, no telemetry,
no analytics and no ads.

## What leaves your computer?

Only when **you start a scan**, and only to **the provider you chose**:

| Data | When |
|---|---|
| Sender (name and address) and subject | every scan |
| A shortened text excerpt of the mail (default 1,500 characters) | only if “Send a text excerpt to the model” is on |
| Your API key (as an `Authorization` header) | every request to a provider that needs a key |

- **Decision model / OpenRouter:** requests go to `openrouter.ai`. The
  [OpenRouter privacy policy](https://openrouter.ai/privacy) and that of the model provider apply.
- **OpenAI-compatible:** requests go to the configured base URL (e.g. `api.openai.com`,
  `api.groq.com`); their privacy policies apply.
- **Ollama / LM Studio (local):** requests go to `localhost` – **nothing leaves your computer**.

Trusted senders (whitelist) are **never** sent or scored. The mail preview loads **no** remote
content (images, trackers, fonts).

## Newsletters and unsubscribing

- **Detection** reads the visible mails (headers and text) from **your own mail server** – nothing
  is sent to anyone.
- **Unsubscribing** only happens when you click. Depending on the newsletter it either opens the
  unsubscribe page **in your browser** (your browser then contacts the newsletter sender) or opens
  a **draft** in Thunderbird that you check and send yourself. The add-on never sends mail on its own.

## What is stored locally?

In Thunderbird's `storage.local` (stays on your computer, **not** synced):
- settings (provider, base URL, model, whitelist, columns)
- the API key, **obfuscated** (not real encryption, see README)
- spam scores and newsletter info per Message-ID, so mails are not processed again

Thunderbird deletes this data when the add-on is removed.

## Permissions

- **Read accounts, folders and messages / move / delete:** to show, score and clean up. Delete
  moves to the trash.
- **Compose:** only to open unsubscribe drafts when you ask for it.
- **`https://openrouter.ai/*`:** default provider.
- **Optional: access to other websites:** requested only when you use another provider (or
  `localhost` for Ollama), and only for that address.

Contact: via the issues of the GitHub repository.

---

## Datenschutz – Deutsch

AI Mail Cleaner läuft vollständig in Thunderbird – **kein Server des Entwicklers**, keine
Telemetrie, keine Analyse, keine Werbung.

**Daten verlassen den Rechner nur beim Scan** und nur zum **gewählten Anbieter**: Absender, Betreff,
optional ein gekürzter Textausschnitt (Standard 1.500 Zeichen) sowie dein API-Schlüssel als
`Authorization`-Header. Mit Ollama/LM Studio auf `localhost` bleibt alles lokal. Vertrauenswürdige
Absender werden nie gesendet. Die Vorschau lädt keine externen Inhalte.

**Newsletter:** Die Erkennung liest die sichtbaren Mails von deinem eigenen Mailserver – es wird
nichts gesendet. Abgemeldet wird nur auf Klick: Die Abmeldeseite öffnet sich in deinem Browser,
oder es öffnet sich ein Entwurf, den du selbst prüfst und sendest.

**Lokal gespeichert** (`storage.local`, nicht synchronisiert): Einstellungen, der API-Schlüssel
(verschleiert, keine echte Verschlüsselung), Spam-Bewertungen und Newsletter-Infos je Message-ID.

**Berechtigungen:** Konten/Ordner/Nachrichten lesen, verschieben, löschen (= Papierkorb);
Verfassen nur für Abmelde-Entwürfe; `openrouter.ai`; andere Hosts erst bei Benutzung.

## Privacidad – Español

AI Mail Cleaner funciona por completo dentro de Thunderbird: **sin servidor del desarrollador**,
sin telemetría, sin analítica y sin publicidad.

**Los datos solo salen de tu ordenador al analizar**, y solo al **proveedor que elegiste**:
remitente, asunto, opcionalmente un extracto acortado del texto (1500 caracteres por defecto) y tu
clave de API como cabecera `Authorization`. Con Ollama/LM Studio en `localhost` todo queda en local.
Los remitentes de confianza nunca se envían. La vista previa no carga contenido externo.

**Boletines:** la detección lee los correos visibles de tu propio servidor de correo; no se envía
nada. La baja solo ocurre al hacer clic: se abre la página de baja en tu navegador o un borrador que
revisas y envías tú mismo.

**Guardado en local** (`storage.local`, sin sincronizar): ajustes, la clave de API (ofuscada, no es
cifrado real), puntuaciones de spam e información de boletines por Message-ID.

**Permisos:** leer cuentas/carpetas/mensajes, mover, eliminar (= papelera); redactar solo para
borradores de baja; `openrouter.ai`; otros hosts solo al usarlos.
