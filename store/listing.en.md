# Store listing (English – primary)

## Name
AI Mail Cleaner

## Summary (max. 250 characters)
Helps you clear out a crowded mailbox: every mail gets a spam score from 0 to 100%, newsletters can be unsubscribed right there, and whatever can go is moved to the trash in bulk. Works with cloud models or locally.

## Description

I built this add-on to clean up my own mailbox. It helps me, so I'm sharing it here in case it's
useful to you too.

What bothered me: newsletters I never unsubscribed from, ads, and spam that got past the filter.
Going through all that one mail at a time takes forever. Now a model does the first pass and I
only make the decisions.

**How it works**

Pick a folder and the add-on lists all its mails. Click "Scan" and it sends the sender, the
subject and, if you like, a short excerpt of each mail to a model, which returns a spam score from
0 to 100%. Then filter on "Spam ≥ 80%", take a quick look and move it all to the trash. If you
got something wrong, there's Undo.

Newsletters are recognized by their List-Unsubscribe header or the unsubscribe note in the text.
Clicking the Newsletter tag opens a small dialog: unsubscribe on the website or by email, and, if
you want, move all older mails from that newsletter to the trash as well. If the mail looks like
spam, the add-on advises against unsubscribing, since that often just confirms your address
exists.

**Which model?**

I use Jev via OpenRouter myself: fast, and a fraction of a cent per mail. Span-01-lite is free but
manages only about 20 mails a minute. If you'd rather not send any mail out, everything can run
locally with Ollaya, LM Studio or Ollama. Regular language models from OpenAI, Mistral, Groq and
others work too.

If you want, the model also gets a bit of context: whether the sender is in your address book, how
many of their mails are in the folder and how many of those you opened. That helps with mails that
look harmless on their own but come from someone you never read.

**Also**
- groups by domain or sender; select or trash whole groups
- filters for date range and newsletters only, plus search
- senders and domains you trust are never scored and never sent anywhere
- preview without remote images or trackers
- model picker with price and estimated cost per 1,000 mails
- move to folders, keyboard shortcuts, light and dark mode
- English, German and Spanish

**Privacy**

There's no server of mine involved, no telemetry and no ads. Data only leaves your computer when
you scan, and only to the provider you set up yourself. With a local model nothing leaves at all.
Nothing is ever deleted permanently; everything goes to the trash.

The source code is open (MIT license) and on GitHub. Bug reports and ideas are welcome.

## Category
Message and News Reading (alternatively: Privacy and Security)

## Tags
spam, cleanup, inbox, newsletter, unsubscribe, ai, ollaya, ollama, openrouter, bulk delete

## License
MIT
