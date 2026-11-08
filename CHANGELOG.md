# Changelog

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
