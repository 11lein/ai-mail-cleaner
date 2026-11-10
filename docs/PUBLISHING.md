# Publishing

Two complementary channels: **GitHub** (source code and releases) and
**addons.thunderbird.net** (ATN, the official catalog with automatic updates).

## 0. Before every release

1. Bump the version in **`src/manifest.json`** and **`package.json`** (e.g. `2.1.1`).
2. Add an entry to **`CHANGELOG.md`**.
3. Check translations (fails if a key is missing in any language), syntax and versions:
   ```bash
   npm ci --ignore-scripts      # once: the pinned build tools
   npm run i18n
   npm run check
   ```
4. Build the package:
   ```bash
   npm run build                # → dist/ai-mail-cleaner-<version>.xpi
   ```
5. Mozilla's validator (the same one ATN uses) – CI runs it on every push, too:
   ```bash
   npm run lint
   ```
   Errors must be fixed. Expected warnings: the Thunderbird-only permissions (`accountsRead`,
   `messagesRead`, `compose` …) are reported as “Invalid permissions” by the Firefox-oriented
   linter, and `data_collection_permissions` as unsupported by the minimum version – both harmless.
6. Test in Thunderbird: *Add-ons Manager → gear icon → Install Add-on From File…* – ideally once
   with Thunderbird in English and once in German or Spanish.

## 1. GitHub

Create the repository once and push:

```bash
git add -A
git commit -m "AI Mail Cleaner 2.1.0"
gh repo create ai-mail-cleaner --public --source . --push
```

One release per version, with the `.xpi` as download (wait for the green CI run of the commit):

```bash
V=2.5.0
git tag -a v$V -m "AI Mail Cleaner $V" && git push origin v$V
gh release create v$V dist/ai-mail-cleaner-$V.xpi --title "AI Mail Cleaner $V" --notes-file notes.md
```

`notes.md` = the version's section of `CHANGELOG.md` (plus earlier versions not released on
GitHub yet).

> `dist/` is in `.gitignore` – the built package belongs in releases, not in the repository.
> `homepage_url` in the manifest points to `github.com/11lein/ai-mail-cleaner`; adjust it if the
> repository gets a different name.

## 2. addons.thunderbird.net (ATN)

1. Sign in with a Mozilla account: <https://addons.thunderbird.net/developers/>
2. **“Submit a New Add-on”** → **“On this site”** (listed, with automatic updates).
3. Upload `dist/ai-mail-cleaner-<version>.xpi`. Automatic validation runs right away.
4. **Source code:** the code is neither minified nor bundled, so **no** separate source upload is
   needed – answer “No”.
5. **Fill in the listing** – texts in [`store/listing.en.md`](../store/listing.en.md) (primary),
   [`store/listing.de.md`](../store/listing.de.md) and [`store/listing.es.md`](../store/listing.es.md)
   (ATN lets you add translations per locale):
   - name, summary (max. 250 characters), description
   - category: *Message and News Reading* or *Privacy and Security*
   - license: MIT
   - privacy policy: paste [`PRIVACY.md`](../PRIVACY.md) – **required**, because mail data can be
     sent to an external service
   - support: link to the GitHub issues
   - screenshots: `store/screenshots/*.png` (sample data only)
6. **Notes to reviewer**, e.g.:
   > Mail data (sender, subject, optional text excerpt) is sent only when the user starts a scan,
   > only to the AI provider the user configured (default openrouter.ai; other hosts via optional
   > permissions requested at first use; Ollaya or Ollama on localhost keep everything local). No developer
   > server, no telemetry. Newsletter detection reads headers/text locally via messages.getFull.
   > `compose` is used only to open an unsubscribe draft (compose.beginNew) when the user clicks
   > the Newsletter tag – nothing is sent automatically. `addressBooks` is read locally only to tell
   > the model whether the sender is a known contact (yes/no); the address book is never sent.
   > Delete = move to trash. HTML previews are
   > rendered in a sandboxed iframe with a strict CSP and a sanitizer; links and remote content are
   > disabled. The optional `webRequest` permission is requested only for a local Ollama/Ollaya
   > server and only rewrites the `Origin` header of the add-on's own requests to that server.
   > To test: install, open the tab, *Set up* → *Decision model* → *OpenRouter* with an OpenRouter
   > key – the preselected free model `respan/span-01-lite:free` works without credit – or
   > *Language model (LLM)* → *Ollama* with a local Ollama.
7. Submit. Human review usually takes a few days. After that, all users get new versions
   automatically.

**New version on ATN:** Developer Hub → *Manage Status & Versions* → *Upload a New Version*.

### Review notes

- **Permissions:** only `https://openrouter.ai/*` is granted up front. All other hosts go through
  `optional_permissions` and are requested on first use – reviewers prefer this to a blanket
  `<all_urls>`. `webRequest` + `webRequestBlocking` are optional too and requested only with an
  Ollama address, or for Ollaya after it answered 403 and the user clicked *Allow access*: one
  `onBeforeSendHeaders` listener, filtered to that host, that only
  touches requests whose `originUrl` is the add-on itself and sets their `Origin` header to the
  server's own origin (Ollama's CORS check – and Ollaya's, which mirrors it – rejects
  `moz-extension://` origins by default).
- **No remote code**, no `eval`, no assignments to `innerHTML`. Icons are created from static
  constants via `DOMParser`.
- **Data transfer:** the manifest declares
  `data_collection_permissions: { required: ["personalCommunications"] }`, because sender,
  subject and text excerpts go to the chosen AI provider. Newer Thunderbird versions show this
  at install time; older ones (115/128) ignore the key with a warning.
- **Localization:** `default_locale` is `en`; name and description come from
  `src/_locales/<lang>/messages.json` (`__MSG_extName__`, `__MSG_extDescription__`).

## 3. Distribution without the catalog

The `.xpi` from the GitHub release can be installed directly: *Add-ons Manager → gear icon →
Install Add-on From File…*. If Thunderbird refuses an unsigned package, set
`xpinstall.signatures.required` to `false` under *Settings → General → Config Editor*.
Versions published on ATN are signed and don't need this.

## Regenerating the store screenshots

```bash
sh scripts/dev.sh &                # dev preview with sample data
sh scripts/screenshots.sh          # → store/screenshots/*.png (Chrome headless, English UI)
LANG_UI=de sh scripts/screenshots.sh   # German UI (files get a -de suffix)
```

The images contain only the sample data from `dev/mock-messenger.js` (`example.com`, made-up
senders and companies) – **no real mailboxes**.
