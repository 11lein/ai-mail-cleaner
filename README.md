# AI Mail Cleaner

**A Thunderbird add-on for cleaning out mailboxes.** Every mail gets a spam probability from
0 to 100 %, newsletters are recognized and can be unsubscribed from with one click. Group by
domain, filter, and move thousands of mails to the trash in one go – with undo.
No mail composer, just cleaning up.

English · Deutsch · Español – the UI follows Thunderbird's language.

![Overview](store/screenshots/01-overview.png)

## Features

- **Spam score per mail** – two kinds of model, each in the cloud or on your own computer:
  - **Decision model** (default): non-generative classifiers such as *Jev* or *Span-01* – fast,
    cheap, calibrated probabilities. Via the OpenRouter Decisions API (free model available) or
    **locally** with [Ollaya](https://ollaya.dev), Jev-Style in LM Studio or the [jev-style](https://github.com/lawrence3699/jev-style) server;
  - **Language model (LLM)**: OpenRouter, OpenAI, Groq, Mistral, Together, DeepSeek or any
    OpenAI-compatible URL – or **locally** with LM Studio or Ollama (no key, no cost, no mail
    leaves your computer). Several mails per request.
- **One API key per provider**, kept when you switch back and forth – one OpenRouter key serves
  both kinds of model. A note under the provider list explains each provider and links to it.
- **Context-aware scoring** (optional, on by default): the model also learns whether the sender is
  in your address book, how many of their mails are in the folder and how many you opened, and
  whether Thunderbird's junk filter flagged the mail – strong signals that a text-only check misses.
- **Newsletter detection**: a *Newsletter* tag after the subject (from the `List-Unsubscribe`
  header or an unsubscribe note in the text). Clicking it unsubscribes – it opens the unsubscribe
  page in your browser, or a **ready-made unsubscribe draft** if the newsletter asks for an email –
  and then offers to **move all mails of that newsletter to the trash**. For likely spam it warns
  you first (unsubscribing would only confirm your address).
- **Filter by sender or domain** right in the list (funnel on hover or context menu).
- **Clear cache** to scan everything again, or **Score again** for selected mails.
- **Model picker** with search and sorting, price per 1M tokens, estimated cost per 1,000 mails,
  context length, parameter size, quantization and download size.
- **Scan dialog** before large scans (duration, cost, data sent, “only 50 newest”), progress with
  time left, **stop** at any time. Scores are remembered locally.
- **Filter chips** “Spam ≥ 80 %”, “Unsure”, “Unscored”, a range slider and search.
- **Groups** by domain or sender with the average spam score – select or trash whole groups.
- **Trash with undo**, move to folders (including newly created ones).
- 📎 **Attachment icon**, **safe preview** (sandboxed, no remote images or trackers, link targets
  with phishing hints).
- **Trusted senders/domains**: never spam, never sent anywhere.
- **Large folders** with thousands of mails stay smooth (virtualized table, progressive loading).
- Sortable, reorderable and resizable columns, shift range selection, context menu,
  **keyboard control** (`?` shows all shortcuts), light and dark mode.

| Newsletter & unsubscribe | Model picker | Safe preview |
|---|---|---|
| ![Newsletter](store/screenshots/03-newsletter.png) | ![Model picker](store/screenshots/05-model-picker.png) | ![Preview](store/screenshots/04-preview.png) |

## Installation

- **From the catalog** (once published): addons.thunderbird.net → “AI Mail Cleaner”.
- **From a release:** download the `.xpi` from the GitHub releases →
  Thunderbird *Add-ons Manager → gear icon → Install Add-on From File…*
- **For development:** *Menu → Developer Tools → Debug Add-ons → Load Temporary Add-on…* →
  `src/manifest.json`.

Requires Thunderbird **115** or newer.

## Getting started

1. Click the **AI Mail Cleaner** toolbar button (the tab also opens right after installation).
2. **“Set up”** → **Decision model** or **Language model (LLM)**, then a provider from the list –
   cloud providers first, then *On this computer*:
   - *Decision model · OpenRouter:* enter an [OpenRouter key](https://openrouter.ai/keys). The free
     model `respan/span-01-lite:free` is preselected (~20 mails/min); `typesafe/jev-1.14` is faster.
     Or locally: **Ollaya**, **“LM Studio (Jev-Style 2B v1)”** or **“Jev-Style server”** – see below.
   - *Language model:* pick a provider, enter its key, **“Choose model…”**. Locally: LM Studio, or
     install [Ollama](https://ollama.com) and run `ollama pull llama3.2:3b`.
3. Select a folder on the left → **“Scan N mails”**.
4. Chip **“Spam ≥ 80 %”** → **“Move N spam mails to the trash”** – **Undo** if needed.
5. Newsletters you no longer want: click the **Newsletter** tag (or press `U`).

### Ollama / Ollaya: “403 Forbidden”

Ollama and Ollaya reject requests from browser add-ons by default (they check the `Origin`
header). **Ollaya:** start it with `OLLAYA_ORIGINS='moz-extension://*' ollaya serve`. **Ollama:**
the add-on handles this itself – when you choose Ollama, Thunderbird asks once for access to its
address plus the `webRequest` permission, and the add-on then sets the `Origin` header of **its
own** requests to the server's address, so the server treats them like a local app. Nothing else
is read or changed. For Ollaya the same fix is offered as **Allow access** when it answers 403.

If you decline, or the server still answers 403, allow Thunderbird in the server itself and
restart it:

```bash
launchctl setenv OLLAMA_ORIGINS 'moz-extension://*'   # Ollama macOS app (until the next reboot), then quit & reopen Ollama
setx OLLAMA_ORIGINS "moz-extension://*"               # Ollama on Windows, then quit & reopen Ollama
OLLAMA_ORIGINS='moz-extension://*' ollama serve       # Ollama on Linux / in a terminal
OLLAYA_ORIGINS='moz-extension://*' ollaya serve       # Ollaya (quit a running one first)
```

### Decision model on your own computer

Decision models such as *Jev-Style* don't write text – their score is read from the model's
token probabilities or internals, never from a chat reply. As a *language model* the add-on
therefore refuses them with a hint. Use *Settings → Decision model* with one of these providers:

**Ollaya** (provider “Ollaya”, recommended): [Ollaya](https://ollaya.dev) runs open decision
models locally, the way Ollama runs LLMs (macOS on Apple silicon, Linux, Windows). Install it,
download a model and start it:

```bash
curl -fsSL https://ollaya.dev/install.sh | sh     # Windows: irm https://ollaya.dev/install.ps1 | iex
ollaya pull laya:en                               # ≈ 850 MB
OLLAYA_ORIGINS='moz-extension://*' ollaya serve   # http://127.0.0.1:11435, Thunderbird allowed
```

**`OLLAYA_ORIGINS='moz-extension://*'` matters:** without it Ollaya refuses requests from
Thunderbird add-ons with `403` (see above). The default model is `laya:en`: in a test with 20
German and English sample mails it separated spam from wanted mail better than the router `laya`,
which hands German mail to `laya:multilingual` (far too many false alarms there). Other models
(`decider`, `winnow:e4b` …) are listed at [ollaya.dev/search](https://ollaya.dev/search);
*Choose model…* shows the ones you pulled. The add-on calls Ollaya's native `POST /api/decide` –
the same answer as OpenRouter's Decisions API, but a long mail is cut to the model's context
instead of being refused. laya reads 512 tokens, so the context signals are put before the mail
text, and laya gets a short statement (“This email is unwanted spam, a scam or a phishing
attempt.”) instead of the long question – both scored clearly better in that test. No key needed.

**LM Studio** (provider “LM Studio (Jev-Style 2B v1)”): load
[`Jev-Style-Qwen3.5-2B-Decision-GGUF`](https://huggingface.co/chaoliangUNSW/Jev-Style-Qwen3.5-2B-Decision-GGUF)
(v1) and start LM Studio's local server. The add-on asks for a single token with `logprobs` and
renormalises the probabilities of the answers *A = yes* / *B = no* – the model's calibrated score.
This also works with `llama-server` (enter `http://localhost:8080/v1/chat/completions` under
*Advanced*). The newer *0.8B v3* and *2B v4* read a verdict slot inside the model, which LM Studio
can't expose – the add-on refuses them there and points to the jev-style server.

**jev-style server** (provider “Jev-Style server”) for the current 0.8B v3 / 2B v4, via
[jev-style](https://github.com/lawrence3699/jev-style), which speaks the same decision API as
OpenRouter:

```bash
pip install "jev-style[mlx]"          # Apple silicon; elsewhere: "jev-style[torch]"
jev-style serve                       # http://127.0.0.1:8765, add --release 2b for the 2B v4
```

Port 8765 taken? Start it with `--port 8766` and enter `http://127.0.0.1:8766` under
*Advanced → API base URL*. jev-style 0.6.3 (the current release) accepts Thunderbird's requests
as they are. Newer versions refuse requests from other origins such as Thunderbird's
`moz-extension://` with 403 – then add `--allow-any-host` (the server still listens on
`127.0.0.1` only); the add-on says so when it happens.

## Privacy & security

- Data is sent **only when you scan** and **only to the provider you chose**: sender, subject and,
  optionally, a shortened text excerpt and the context signals (contact yes/no, counts, open rate –
  never the address book itself). With Ollaya, Ollama, LM Studio or a local Jev-Style server
  everything stays local. See [PRIVACY.md](PRIVACY.md).
- **Newsletter detection** reads the visible mails from your own mail server – nothing is sent.
  Unsubscribing only happens when you click: the page opens in your browser, or a draft opens
  that you check and send yourself.
- **API keys** (one per provider server) are stored only in `storage.local` (not synced) and obfuscated. That is **not real
  encryption** – Thunderbird add-ons have no access to the system keychain. For real protection,
  secure your OS account or set a Thunderbird primary password. Saved keys are never loaded back
  into the input field.
- **Permissions:** only `openrouter.ai` is granted up front. Other providers (including `localhost`)
  are requested individually on first use. `compose` is used only to open unsubscribe drafts,
  `addressBooks` (read-only) only for the “known contact” signal, the optional `webRequest` only
  for Ollama and Ollaya (see above).
- **Delete** always moves to the trash (`messages.delete(ids, false)`).
- **HTML preview** in an `<iframe sandbox>` without permissions, with a strict CSP and a sanitizer:
  no scripts, forms, remote images, trackers or navigation.

## Development

```
src/                   the extension (gets packaged)
  manifest.json        manifest (MV2, Thunderbird ≥ 115)
  _locales/            en (default), de, es – generated, see scripts/i18n
  background.js        toolbar button, first start, add-on options → cleaner tab
  icons/               icon (SVG + PNG 16–128)
  ui/cleaner.*         UI: table, dialogs, scan
  ui/ai.js             providers: Decisions API (OpenRouter, Ollaya, jev-style, LM Studio), OpenAI-compatible, Ollama; model list; costs
  ui/newsletter.js     newsletter detection, unsubscribe targets (List-Unsubscribe, text)
  ui/preview.js        safe HTML preview, text extraction
  ui/settings.js       settings, per-provider profiles, key storage, caches
  ui/i18n.js           translations and locale-aware formatting
  ui/icons.js          SVG icon set
dev/mock-messenger.js  mock of the Thunderbird API for the browser preview (not packaged)
scripts/               dev.sh · build.sh · check.sh · icons.sh · screenshots.sh · i18n/
.github/               CI, CodeQL and Dependabot configuration
store/                 store listings (en/de/es) and screenshots (sample data only)
docs/PUBLISHING.md     GitHub releases and addons.thunderbird.net
```

```bash
npm ci --ignore-scripts         # build tools (addons-linter), pinned in package-lock.json
npm run dev                     # browser preview with sample data: http://127.0.0.1:8799/src/ui/_dev.html
                                #   ?n=5000 extra mails · ?fresh=1 first start · ?lang=de|es language
npm run i18n                    # texts: scripts/i18n/<lang>.mjs → src/_locales (+ completeness check)
npm run check                   # syntax of all scripts, manifest/package version match
npm run build                   # → dist/ai-mail-cleaner-<version>.xpi
npm run lint                    # Mozilla's addons-linter on that package
```

**CI and updates** (`.github/`): every push and pull request runs the steps above plus
`npm audit`; pull requests also get a dependency review, and CodeQL scans the code and the
workflows (results under *Security → Code scanning*). Dependabot proposes updates for the build
tools and the GitHub Actions weekly, which are pinned to commit SHAs. The add-on itself has no
third-party dependencies. See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

**Translations:** edit `scripts/i18n/en.mjs` (source) and the other languages, then run
`node scripts/i18n/build.mjs` – it fails if a key used in the UI is missing in any language or
if placeholders (`$1`, `$2`) differ. New language: copy `en.mjs`, add the code to `LANGS` in
`build.mjs`. Pull requests welcome.

Publishing: see [docs/PUBLISHING.md](docs/PUBLISHING.md). Changes: [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
