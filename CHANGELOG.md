# Changelog

## 2.5.0 – 2026-11-10

### Changed
- **Ollaya instead of Ollama for local decision models:** *Settings → Decision model → Ollaya*
  (first under *On this computer*). [Ollaya](https://ollaya.dev) runs open decision models the way
  Ollama runs LLMs; the add-on uses its native `POST /api/decide` at `http://127.0.0.1:11435`, with
  `laya:en` as the default model. Ollama stays a provider for language models. A decision setup
  that pointed at Ollama (2.4.0) is switched to Ollaya once.
- The note under the provider list says how to install Ollaya, pull the model and start it –
  with `OLLAYA_ORIGINS='moz-extension://*' ollaya serve`, without which Ollaya refuses
  Thunderbird – and links to its website and model list. *Choose model…* lists the models you
  pulled (sizes, parameters, precision; the recommended one first).

### Improved
- Tuned for laya with 20 German and English sample mails against a real Ollaya 0.18: a short
  statement instead of the long question, and the context signals before the mail text (laya
  reads 512 tokens and cuts the rest). Spam and wanted mail no longer overlap in that test
  (before: e.g. a train ticket 58 %, a friend's invitation 31 %). `laya:en` beat the router `laya`,
  which sends German mail to `laya:multilingual`.
- Clear messages for Ollaya: not running or refusing Thunderbird (403) – both with the start
  command including `OLLAYA_ORIGINS` – and model not pulled yet (`ollaya pull laya:en`). The
  `webRequest` Origin fix is offered for Ollaya only after a 403 (*Allow access*), so choosing
  Ollaya asks for host access only.
- Model lists in TypeSafe's `/v1/models` shape (`models[].name`) are read too.

### Security
- **Mail preview:** links in image maps (`<area href>`) and in SVG/MathML (`xlink:href`, or set
  later by SVG animation elements) stayed clickable – a click loaded the remote page inside the
  preview frame although the preview says “links disabled”. The sanitizer now removes them like
  every other link and drops SVG animation elements.

### Development
- GitHub Actions: CI (syntax and version check, translations, build, `addons-linter`,
  `npm audit`, dependency review for pull requests) and CodeQL for the JavaScript and the
  workflows. Dependabot keeps the build tools and the (SHA-pinned) actions up to date.
- `addons-linter` is pinned in `package-lock.json` instead of always running the latest version
  via `npx`; `npm run check` checks syntax and that manifest and package versions match.
- New `SECURITY.md` (private vulnerability reporting).

## 2.4.0 – 2026-11-09

### New
- **Ollama for decision models:** *Settings → Decision model → Ollama*. Current Ollama versions run
  decision models natively (capability `decision`, e.g. `ollama run <model> --ask …`); the add-on
  scores with them through Ollama's `POST /v1/systemone` – the same calibrated yes/no probability
  as via OpenRouter, nothing leaves the computer, no key needed.

### Improved
- Ollama's model lists follow its `capabilities`: *Choose model…* shows only decision models for
  decision models, and only chat models (no decision or embedding models) for language models.
- Decision models named like `…-jev` are recognised and refused as language models.

## 2.3.1 – 2026-11-09

### Fixed
- **Ollama “rejects the request (403)”:** Ollama refuses requests from browser add-ons unless
  `OLLAMA_ORIGINS` allows them – and the Ollama app on macOS/Windows can't simply be started with
  it. When you choose Ollama, Thunderbird now asks once for access including the optional
  `webRequest` permission; the add-on then sets the `Origin` header of its own requests to
  Ollama's address, which Ollama accepts. Nothing else is read or changed.
- If that permission is declined, the error banner offers **Allow access**; if Ollama still
  refuses, it shows the right command for the system (macOS app: `launchctl setenv …`, then
  restart Ollama) instead of the `ollama serve` hint that didn't fit the app.

## 2.3.0 – 2026-11-09

### Changed
- **Simpler settings:** only two choices – **Decision model** or **Language model (LLM)** – and a
  provider list below: cloud providers first (OpenRouter, OpenAI, Groq …), then *On this computer*
  (LM Studio, Ollama, Jev-Style server), then a custom URL. Ollama is now one of the LLM providers
  instead of a third choice.
- A **note under the provider list** explains the chosen provider – what it costs, how to set it up
  locally (install commands, LM Studio server, `ollama pull`, `jev-style serve` with the right
  port) – with links to its website, download or model page.

### Fixed
- **The API key is kept per provider:** switching e.g. from OpenAI to Groq and back no longer
  loses the OpenAI key – keys are stored per server (host and port). One OpenRouter key still serves
  decision and language models; LM Studio's token serves both of its entries. The last model and
  address (e.g. jev-style on port 8766) are remembered per provider too. Existing keys are taken
  over automatically.

## 2.2.5 – 2026-11-09

### Fixed
- **Wrong start command for the jev-style server:** the add-on suggested
  `jev-style serve --allow-any-host`, but the current jev-style release (0.6.3) doesn't know that
  option and quits with “unrecognized arguments”. The hints now say `jev-style serve` – with
  `--port N` when the configured URL uses a port other than 8765. `--allow-any-host` is only
  suggested when the server actually refuses Thunderbird with 403 (newer jev-style versions).

## 2.2.4 – 2026-11-08

### New
- **Decision models in LM Studio:** *Settings → Decision model → Server “LM Studio (local,
  Jev-Style 2B v1)”*. The add-on sends the model's decision prompt to LM Studio's chat endpoint,
  asks for one token with `logprobs` and renormalises the probabilities of “A = yes” / “B = no” –
  the model's calibrated spam probability, nothing leaves the computer. Also works with
  `llama-server` (custom URL ending in `/v1/chat/completions`).
- The model picker for this server lists only decision models LM Studio can score.

### Changed
- Jev-Style **0.8B v3 / 2B v4** in LM Studio are refused right away with an explanation: their
  score is read from a verdict slot inside the model, which LM Studio can't expose – they need the
  jev-style server.
- Hints and error messages name both local options (LM Studio with 2B v1, jev-style server).

## 2.2.3 – 2026-11-08

### New
- **Decision models on your own computer:** the decision model can now use a local Jev-compatible
  server instead of OpenRouter – *Settings → Decision model → Server “Jev-Style (local server)”*
  (`jev-style serve`, `POST /v1/systemone`, default `http://127.0.0.1:8765`).
  Same calibrated yes/no score, nothing leaves the computer. *Test connection* takes over the
  name of the model the server runs.

### Fixed
- **Decision models in LM Studio / Ollama** (e.g. `jev-style-0.8b-decision-v3`) produced only
  “yes no no no …” and the scan ended with “no usable answers”. They can't work through a chat
  API, so the add-on now refuses them right away – no wasted requests – and points to the local
  decision server. They are also no longer offered in the LLM model picker.
- A local server that isn't running (Ollama, LM Studio, Jev-Style) now stops the scan after a
  few seconds with a clear hint, instead of retrying every batch.
- The API key is only shared between profiles with the same host **and port** (two local servers
  no longer share a key).
- Replies that only contain `reasoning_content` (LM Studio, llama.cpp) are read too.

## 2.2.2 – 2026-11-08

### Fixed
- **LLM providers: the model picker offered models that cannot answer in text** – e.g. Google
  Lyria (music), image and video models. Listed as “free”, they even sorted to the top. The picker
  now shows only models with text output (OpenRouter `output_modalities`, plus a name filter for
  providers without modality info, e.g. embeddings/TTS/Whisper/DALL-E at OpenAI).
- **Models that reject `temperature`** (e.g. reasoning models) are retried without it – also for
  requests that were already running in parallel.

### Improved
- Models that support a JSON response format are marked **JSON**, sorted first under
  “Recommended”, and are called with `response_format: json_object` – much more reliable.
- Clear error messages: the banner and “Test connection” now quote what the model actually
  answered (or say that the reply was empty), and a scan stops after two unusable batches instead
  of wasting requests. Replies split into content parts or only present as reasoning text are read too.

## 2.2.1 – 2026-11-08

### Fixed
- **Spam range slider jumped** while dragging: the “Select all N” button appeared next to it and
  pushed the slider sideways under the mouse; in Thunderbird every click also went to the upper
  of the two stacked range inputs. Buttons that come and go now sit left of the chips (the slider
  stays put), the label has a fixed width, and the add-on itself moves the handle nearest to the
  pointer. Arrow keys keep working on the last dragged handle; no more focus box around the slider.
- **Filter funnel and trust shield jumped down** when clicked (the button press effect overrode
  their vertical centering).

## 2.2.0 – 2026-11-08

### New
- **Context for the model** (setting, on by default): whether the sender is in your address book,
  how many mails from the sender/domain are in the folder and how many of them you opened, and
  whether Thunderbird's own junk filter flagged the mail. The decision model gets it as a clearly
  marked “Context” section, LLMs as extra JSON fields. The address book itself is read locally;
  only “yes/no” and the counts are sent.
- **Clean up after unsubscribing:** after opening the unsubscribe page or draft, the add-on offers
  to move all mails of that newsletter (same sender or same `List-Id`) to the trash – with undo.
- **Filter the list by sender or domain:** funnel button next to the sender/domain on hover, or via
  the context menu; an active filter shows as a chip above the list (✕ or Esc clears it).
- **Clear cache** in the settings (stored scores and newsletter checks) to scan everything again,
  and **Score again** in the context menu for selected mails.

### Changed
- Decision models and local models **scan right away** – no confirmation dialog. Only paid cloud
  LLMs still ask first (cost and duration add up there; “only 50 newest” remains available there).
- If only mails that failed last time are left, the scan button says **“Retry N failed”** instead
  of “Scan N”.
- New permission `addressBooks` (read-only, for the context signal).

## 2.1.0 – 2026-11-06

### New
- **Newsletter detection** – a *Newsletter* tag right after the subject. Sources: the
  `List-Unsubscribe` / `List-Unsubscribe-Post` / `List-Id` / `Precedence` headers, or – if there
  are none – an unsubscribe link or address in the mail text (“send an email with ‘unsubscribe’
  to …”). The tooltip says where it leads.
- **One-click unsubscribe** from the tag, the preview (`Unsubscribe` button), the context menu or
  the `U` key: opens the unsubscribe page in the browser, or a **ready-made unsubscribe draft**
  (correct sender identity, never sent automatically). If both exist, a small menu lets you pick.
  For likely spam (≥ 80 %) a warning suggests the trash instead.
- **Languages:** the UI is now **English** by default, with **German** and **Spanish**
  translations (follows Thunderbird's language). Numbers, dates, percentages and prices are
  formatted per locale.
- Setting “Recognize newsletters” (on by default) – checks only the visible mails, read from your
  own mail server.

### Changed
- Manifest uses `default_locale` and localized name/description; new permission `compose`
  (only for unsubscribe drafts).
- Code split into `i18n.js`, `newsletter.js` and `preview.js`.
- Translation workflow: `scripts/i18n/<lang>.mjs` → `node scripts/i18n/build.mjs` →
  `src/_locales`, with a completeness and placeholder check.

## 2.0.0 – 2026-11-06

### New
- **Several providers:** decision model (OpenRouter, default), any **OpenAI-compatible** provider
  (OpenRouter, OpenAI, Groq, Mistral, Together, DeepSeek, LM Studio) and **Ollama (local)** – each
  with its own profile. One OpenRouter key works for both OpenRouter profiles.
- **Model picker** as a large dialog: search, sorting, “free only”, price per 1M tokens, estimated
  cost per 1,000 mails, context length, parameter size, quantization, download size (Ollama).
- **Paperclip** at the end of the subject for mails with attachments; attachments in the preview.
- **Setup card** on first start; the UI opens right after installation.
- **Scan dialog** before large scans (duration, cost, data sent, “only 50 newest”); progress with ETA.
- **Filter chips** with counters and a “Move N spam mails to the trash” button; sorted by spam
  after the first scan.
- **Undo** (8 s) after deleting, including the scores; own delete dialog with a breakdown.
- **Keyboard** control, **context menu**, help overlay, group averages, safer preview
  (blocked-image placeholders, link targets with phishing hints).

### Improved
- **Performance:** virtualized table, progressive loading, icon cache, throttled updates.
- Free models are throttled instead of running into rate limits; automatic retries on 429/5xx.
- Clear error banners with actions; three spam bands; consistent dates; better contrast.

### Technical
- `browser_specific_settings`; only `https://openrouter.ai/*` is granted up front, other hosts
  via `optional_permissions`. PNG icons, build script, dev preview with mock API.

## 1.9.0
- Safe mail preview (sandboxed iframe, CSP, sanitizer), UI refresh.

## 1.8.0 and earlier
- Folder tree, subfolder scan, move with folder creation, whitelist, decision models, obfuscated
  key storage, adjustable columns, spam range filter, shift selection, stop button, score cache,
  group bulk actions, collapsible sidebar.
