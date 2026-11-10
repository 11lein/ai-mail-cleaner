# Store listing (English – primary)

## Name
AI Mail Cleaner

## Summary (max. 250 characters)
Clean out your mailbox with AI: every mail gets a spam probability, newsletters are recognized and unsubscribed with one click. Group by domain, filter, trash thousands at once – with undo. Cloud or fully local (Ollaya, Ollama).

## Description

**AI Mail Cleaner** helps you clean out large mailboxes. Instead of looking at mails one by one,
every mail gets a **spam probability from 0 to 100 %** and newsletters get a **Newsletter** tag –
so you can tidy up with confidence.

**How it works**
1. Choose **Decision model** or **Language model** and a provider – a note below the list says
   how to set it up.
2. Pick a folder. Headers load quickly, even for thousands of mails.
3. Click “Scan”. Decision models and local models start right away; for paid cloud language
   models you first see the expected duration, the cost and which data is sent.
4. Filter to “Spam ≥ 80 %” and move everything to the trash. **Undo** is one click away.
5. Newsletters you no longer read: click the tag to unsubscribe.

**Features**
- Spam scoring via a **decision model** – calibrated classifiers such as Jev or Span-01 on
  OpenRouter (free tier available), or **fully local** with **Ollaya**, LM Studio or a jev-style
  server – or via a **language model** from any OpenAI-compatible provider (OpenAI, Groq,
  Mistral …) or locally with LM Studio or **Ollama**. Locally, no mail ever leaves your computer.
- One API key per provider, kept when you switch back and forth
- **Newsletter detection** (List-Unsubscribe header or a note in the text) with **one-click
  unsubscribe**: opens the unsubscribe page, or a ready-made unsubscribe email draft. Warns you
  before unsubscribing from spam.
- Model picker with price, estimated cost per 1,000 mails, context length and model size
- **Context-aware**: knows whether the sender is in your address book and how many of their mails you open
- After unsubscribing: move all mails of that newsletter to the trash in one click
- Filter the list by sender or domain; clear the cache to scan again
- Group by **domain** or **sender** with average spam score; select or delete whole groups
- Filter chips and a spam range slider, search, sortable and reorderable columns
- 📎 Attachment indicator, safe preview (no trackers, no remote images, phishing hints on links)
- Trusted senders and domains: never treated as spam, never sent
- Move to folders, including newly created ones
- Keyboard control, context menu, light and dark mode
- English, German and Spanish

**Privacy**
No developer server, no telemetry. Sender, subject and an optional short text excerpt are sent
**only when you scan** and **only to the provider you chose**. Newsletter detection runs locally.
Your API key stays local. Delete always moves to the trash.

Source code and issue tracker: GitHub (link below).

## Category
Message and News Reading (alternatively: Privacy and Security)

## Tags
spam, cleanup, inbox, newsletter, unsubscribe, ai, ollaya, ollama, openrouter, bulk delete

## License
MIT
