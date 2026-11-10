/* Einstellungen für AI Mail Cleaner.
 * IMAP-Konten verwaltet Thunderbird selbst – konfiguriert wird nur das Spam-Modell.
 *
 * Im Dialog gibt es zwei Arten (Decision-Modell / LLM), je mit Anbietern in der
 * Cloud und auf dem eigenen Rechner (SOURCES). Intern zählt die API (provider):
 *   - "decision": Decision-Modell (nicht-generativ, z. B. Jev/Span-01) über die
 *                 OpenRouter-Decisions-API – Standard –, lokal über Ollaya (/api/decide),
 *                 einen Jev-kompatiblen Server (/v1/systemone) oder LM Studio (Logprobs).
 *   - "openai":   beliebiger Anbieter mit OpenAI-kompatibler Chat-API (LLM).
 *   - "ollama":   lokales Modell über Ollama (LLM, nichts verlässt den Rechner).
 * profiles[provider] = aktuelle Auswahl (Basis-URL, Modell) je API.
 * keys[host]          = API-Schlüssel je Server (Host inkl. Port) – wechselt man den
 *                       Anbieter und wieder zurück, ist der Schlüssel noch da; ein
 *                       OpenRouter-Schlüssel gilt für Decision- und LLM-Modelle.
 * models[provider + " " + baseUrl] = zuletzt gewähltes Modell je Anbieter.
 * aiBaseUrl/aiApiKey/aiModel spiegeln immer die aktive Auswahl (für den Rest der App).
 */

// Reihenfolge der (verschiebbaren) Datenspalten – Standard.
export const DEFAULT_COLUMN_ORDER = ["spam", "from", "domain", "subject", "date", "size"];

// the APIs and their defaults
export const PROVIDERS = {
  decision: { baseUrl: "https://openrouter.ai/api/alpha/decisions", model: "respan/span-01-lite:free", needsKey: true },
  openai: { baseUrl: "https://openrouter.ai/api/v1", model: "", needsKey: true },
  ollama: { baseUrl: "http://localhost:11434", model: "llama3.2:3b", needsKey: false }
};

/* What the settings dialog offers: two kinds, each with providers in the cloud and on this
 * computer. `provider` = the API behind it, `group` = cloud | local, labelKey only where the
 * name needs translating, hintKey + links = the note under the drop-down (links: [labelKey, url]).
 * Decision servers: OpenRouter's Decisions API, Ollaya (open decision models, run the way Ollama
 * runs LLMs; native POST /api/decide, default 127.0.0.1:11435), LM Studio's chat endpoint with
 * log-probs (only Jev-Style 2B v1: option-letter readout) or a Jev-compatible POST /v1/systemone
 * (`jev-style serve`, default port 8765 – one model per server). Ollama keeps its own profile's URL. */
const LMSTUDIO_SITE = "https://lmstudio.ai";
/* laya:en (853 MB): in a test with German and English sample mails it scored better than the
 * router "laya" (which picks laya:multilingual for German mail – far too many false alarms). */
export const OLLAYA = { baseUrl: "http://127.0.0.1:11435", model: "laya:en" };
export const SOURCES = {
  decision: [
    { id: "openrouter", provider: "decision", group: "cloud", label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/alpha/decisions", model: "respan/span-01-lite:free",
      hintKey: "srcHintOrDecision", links: [["linkWebsite", "https://openrouter.ai"]] },
    { id: "ollaya", provider: "decision", group: "local", label: "Ollaya", ...OLLAYA,
      hintKey: "srcHintOllaya", links: [["linkWebsite", "https://ollaya.dev"], ["linkModels", "https://ollaya.dev/search"]] },
    { id: "lmstudio", provider: "decision", group: "local", labelKey: "presetLmStudioDecision",
      baseUrl: "http://localhost:1234/v1/chat/completions", model: "jev-style-qwen3.5-2b-decision",
      hintKey: "lmDecisionHint", links: [["linkLmStudio", LMSTUDIO_SITE],
        ["linkModel", "https://huggingface.co/chaoliangUNSW/Jev-Style-Qwen3.5-2B-Decision-GGUF"]] },
    { id: "jevstyle", provider: "decision", group: "local", labelKey: "presetJevStyle",
      baseUrl: "http://127.0.0.1:8765", model: "jev-style-0.8b-decision-v3",
      hintKey: "jevHint", links: [["linkGuide", "https://github.com/lawrence3699/jev-style"]] }
  ],
  llm: [
    { id: "openrouter", provider: "openai", group: "cloud", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1",
      hintKey: "srcHintOpenRouter", links: [["linkModels", "https://openrouter.ai/models"]] },
    { id: "openai", provider: "openai", group: "cloud", label: "OpenAI", baseUrl: "https://api.openai.com/v1",
      hintKey: "srcHintOpenAI", links: [["linkWebsite", "https://platform.openai.com"]] },
    { id: "groq", provider: "openai", group: "cloud", label: "Groq", baseUrl: "https://api.groq.com/openai/v1",
      hintKey: "srcHintGroq", links: [["linkWebsite", "https://console.groq.com"]] },
    { id: "mistral", provider: "openai", group: "cloud", label: "Mistral", baseUrl: "https://api.mistral.ai/v1",
      hintKey: "srcHintMistral", links: [["linkWebsite", "https://console.mistral.ai"]] },
    { id: "together", provider: "openai", group: "cloud", label: "Together AI", baseUrl: "https://api.together.xyz/v1",
      hintKey: "srcHintTogether", links: [["linkWebsite", "https://www.together.ai"]] },
    { id: "deepseek", provider: "openai", group: "cloud", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1",
      hintKey: "srcHintDeepSeek", links: [["linkWebsite", "https://platform.deepseek.com"]] },
    { id: "lmstudio", provider: "openai", group: "local", label: "LM Studio", baseUrl: "http://localhost:1234/v1",
      hintKey: "srcHintLmStudio", links: [["linkLmStudio", LMSTUDIO_SITE]] },
    { id: "ollama", provider: "ollama", group: "local", label: "Ollama",
      hintKey: "srcHintOllama", links: [["linkOllama", "https://ollama.com/download"]] }
  ]
};

/** Ollama's address (default port 11434). */
export function isOllamaUrl(url) {
  try { return new URL(url).port === "11434"; } catch (_) { return false; }
}
/** Ollaya's address (default port 11435, or its native /api/decide endpoint) – it gets Ollaya's
 *  own endpoint, model list, error hints and the Origin fix. */
export function isOllayaUrl(url) {
  try {
    const u = new URL(url);
    return u.port === "11435" || /\/api\/decide\/?$/.test(u.pathname);
  } catch (_) { return false; }
}

/** dialog kind of an API: decision models vs. language models */
export function kindOf(provider) { return provider === "decision" ? "decision" : "llm"; }

/** The SOURCES entry a provider + URL belongs to – null for a custom URL. */
export function sourceFor(provider, url) {
  const list = SOURCES[kindOf(provider)];
  if (provider === "ollama") return list.find((x) => x.id === "ollama");
  const u = String(url || "").trim().replace(/\/+$/, "");
  return list.find((x) => x.provider === provider && x.baseUrl === u) ||
    // OpenRouter decisions under a slightly different spelling are still OpenRouter
    (provider === "decision" && /^https?:\/\/([^/]+\.)?openrouter\.ai(\/|$)/i.test(u) ? list[0] : null);
}

function defaultProfiles() {
  const out = {};
  for (const [k, p] of Object.entries(PROVIDERS)) out[k] = { baseUrl: p.baseUrl, model: p.model };
  return out;
}

export const DEFAULT_SETTINGS = {
  schema: 4,
  provider: "decision",
  profiles: defaultProfiles(),
  keys: {},                      // API-Schlüssel je Host (inkl. Port), verschleiert abgelegt
  models: {},                    // zuletzt gewähltes Modell je Anbieter (provider + " " + baseUrl)
  sourceUrls: {},                // zuletzt genutzte Adresse je Anbieter im Dialog ("llm:openrouter" → URL)
  modelInfo: {},                 // je API: Infos zum gewählten Modell (Preis, Größe …)
  aiBaseUrl: PROVIDERS.decision.baseUrl,
  aiApiKey: "",
  aiModel: PROVIDERS.decision.model,
  aiConcurrency: 3,              // parallele Anfragen
  aiBatchSize: 8,                // Mails pro Anfrage (nur LLM-Anbieter)
  loadLimit: 5000,
  scanBody: true,                // zusätzlich einen Mail-Textausschnitt mitbewerten
  sendContext: true,             // Kontext mitsenden: Adressbuch, Anzahl Mails vom Absender, Öffnungsquote
  bodyChars: 1500,               // max. Zeichen des Ausschnitts pro Mail
  detectNewsletters: true,       // sichtbare Mails auf List-Unsubscribe prüfen (lokal)
  includeSubfolders: false,      // Ordner inkl. Unterordner laden/scannen
  sidebarCollapsed: false,       // linke Seitenleiste eingeklappt?
  whitelist: [],                 // Absender-Adressen/Domains, nie als Spam (0 %)
  columnOrder: DEFAULT_COLUMN_ORDER.slice(), // Spaltenreihenfolge (verschiebbar)
  columnWidths: {}               // Spalten-Breiten in px je Schlüssel
};

// Vorschläge für das Modell-Feld, bis per API geladen wird (Decision-Modelle).
export const DECISION_MODEL_FALLBACK = [
  "respan/span-01-lite:free",
  "typesafe/jev-1.14",
  "~typesafe/jev-latest"
];

/** Lokale Adresse (localhost/127.0.0.1/::1)? Dann ist kein Schlüssel nötig. */
export function isLocalUrl(url) {
  try {
    const h = new URL(url).hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1" || h.endsWith(".localhost");
  } catch (_) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* API-Schlüssel-Ablage                                                */
/* ------------------------------------------------------------------ */
/* Wichtig: Wir nutzen ausschließlich storage.local – diese Daten bleiben
 * auf dem Rechner (anders als storage.sync, das mit dem Mozilla-Konto
 * synchronisiert würde). Thunderbird-Erweiterungen haben KEINEN Zugriff
 * auf einen OS-Schlüsselbund.
 *
 * Zusätzlich wird der Schlüssel vor dem Ablegen leicht VERSCHLEIERT, damit
 * der Klartext-Token (z. B. „sk-or-…") nicht unverschleiert in der Profil-
 * datei oder in Backups steht und nicht per Muster-Scan gefunden wird.
 * Das ist KEINE echte Verschlüsselung (der Schlüssel zum Entschleiern steckt
 * im Code). Für echten Schutz der Profildaten: Betriebssystem-Konto absichern
 * bzw. in Thunderbird ein Hauptpasswort setzen. */
const OBF_PREFIX = "obf1:";
const OBF_SALT = "ai-mail-cleaner/v1";

function xorStr(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    out += String.fromCharCode(s.charCodeAt(i) ^ OBF_SALT.charCodeAt(i % OBF_SALT.length));
  }
  return out;
}
function obfuscate(plain) {
  if (!plain) return "";
  try { return OBF_PREFIX + btoa(unescape(encodeURIComponent(xorStr(plain)))); }
  catch (_) { return plain; }
}
function deobfuscate(stored) {
  if (!stored) return "";
  if (typeof stored !== "string") return "";
  if (!stored.startsWith(OBF_PREFIX)) return stored; // Altbestand (Klartext) weiter lesbar
  try { return xorStr(decodeURIComponent(escape(atob(stored.slice(OBF_PREFIX.length))))); }
  catch (_) { return ""; }
}

function mapProfiles(profiles) {
  const out = defaultProfiles();
  for (const k of Object.keys(out)) {
    const p = (profiles && typeof profiles[k] === "object" && profiles[k]) || {};
    out[k] = {
      baseUrl: typeof p.baseUrl === "string" ? p.baseUrl : out[k].baseUrl,
      model: typeof p.model === "string" ? p.model : out[k].model
    };
  }
  return out;
}

/** host → key map through fn (obfuscate/deobfuscate); drops empty entries */
function mapKeys(keys, fn) {
  const out = {};
  if (keys && typeof keys === "object") {
    for (const [h, k] of Object.entries(keys)) {
      const v = typeof k === "string" && k ? fn(k) : "";
      if (h && v) out[h] = v;
    }
  }
  return out;
}

/** Host incl. port: the key belongs to the server – two local servers (LM Studio :1234,
 *  jev-style :8765) don't share one, OpenRouter's decision and chat APIs do. */
export function keyHost(url) {
  try { return new URL(url).host; } catch (_) { return ""; }
}
/** saved API key for a server URL */
export function keyFor(keys, url) {
  const h = keyHost(url);
  return (h && keys && keys[h]) || "";
}
/** remembered model for a provider + server URL */
export function modelSlot(provider, url) {
  return provider + " " + String(url || "").trim().replace(/\/+$/, "");
}

// aiBaseUrl/aiApiKey/aiModel = aktives Profil
function syncActive(s) {
  if (!PROVIDERS[s.provider]) s.provider = "decision";
  const p = s.profiles[s.provider];
  s.aiBaseUrl = p.baseUrl || "";
  s.aiApiKey = keyFor(s.keys, s.aiBaseUrl);
  s.aiModel = p.model || "";
  return s;
}

// Einstellungen aus Versionen < 2.0 (ohne Profile) übernehmen
function migrate(s, raw) {
  if (raw.schema >= 2 && raw.profiles) return s;
  const base = String(raw.aiBaseUrl || "");
  const model = String(raw.aiModel || "");
  let provider = "decision";
  if (/:11434\b/.test(base) || /\/api\/chat$/.test(base)) provider = "ollama";
  else if (/\/decisions$/.test(base) || /^~?(typesafe|respan)\//.test(model) || !base) provider = "decision";
  else provider = "openai";
  s.provider = provider;
  s.profiles = defaultProfiles();
  if (base || model) {
    s.profiles[provider] = { baseUrl: base || PROVIDERS[provider].baseUrl, model: model || PROVIDERS[provider].model };
  }
  const key = deobfuscate(raw.aiApiKey);
  const h = keyHost(s.profiles[provider].baseUrl);
  if (key && h && !s.keys[h]) s.keys[h] = key;
  return s;
}

export async function loadSettings() {
  const stored = await messenger.storage.local.get("settings");
  const raw = stored.settings || {};
  const s = { ...DEFAULT_SETTINGS, ...raw, schema: 4 };
  s.keys = mapKeys(raw.keys, deobfuscate);          // im Speicher immer Klartext
  // up to 2.2.x the key sat in each profile: move it to its server
  if (raw.profiles && typeof raw.profiles === "object") {
    for (const p of Object.values(raw.profiles)) {
      const key = p && deobfuscate(p.apiKey);
      const h = p && keyHost(p.baseUrl);
      if (key && h && !s.keys[h]) s.keys[h] = key;
    }
  }
  s.profiles = mapProfiles(raw.profiles);
  s.models = (raw.models && typeof raw.models === "object") ? { ...raw.models } : {};
  s.sourceUrls = (raw.sourceUrls && typeof raw.sourceUrls === "object") ? { ...raw.sourceUrls } : {};
  s.modelInfo = (raw.modelInfo && typeof raw.modelInfo === "object") ? raw.modelInfo : {};
  migrate(s, raw);
  // 2.4.0 offered Ollama for decision models; since 2.5.0 that is Ollaya's job (once – a custom
  // Ollama URL entered later stays)
  if ((Number(raw.schema) || 0) < 4 && isOllamaUrl(s.profiles.decision.baseUrl)) {
    s.profiles.decision = { ...OLLAYA };
    if (s.modelInfo.decision) delete s.modelInfo.decision;
  }
  return syncActive(s);
}

export async function saveSettings(partial) {
  const current = await loadSettings();           // Klartext-Schlüssel in current
  const next = { ...current, ...partial };
  if (partial.profiles) next.profiles = mapProfiles({ ...current.profiles, ...partial.profiles });
  if (partial.keys) next.keys = mapKeys(partial.keys, (k) => k);
  if (!partial.profiles && ("aiBaseUrl" in partial || "aiModel" in partial)) {
    // Alt-Aufrufe ohne Profile: ins aktive Profil schreiben
    const p = { ...current.profiles[next.provider] };
    if ("aiBaseUrl" in partial) p.baseUrl = partial.aiBaseUrl;
    if ("aiModel" in partial) p.model = partial.aiModel;
    next.profiles = { ...current.profiles, [next.provider]: p };
  }
  if (!partial.keys && "aiApiKey" in partial) {
    const h = keyHost(next.profiles[next.provider].baseUrl);
    next.keys = { ...current.keys };
    if (h) { if (partial.aiApiKey) next.keys[h] = partial.aiApiKey; else delete next.keys[h]; }
  }
  syncActive(next);
  const toStore = { ...next, aiApiKey: "", keys: mapKeys(next.keys, obfuscate) }; // verschleiert ablegen
  await messenger.storage.local.set({ settings: toStore });
  return next;                                     // App bekommt Klartext zurück
}

/* ------------------------------------------------------------------ */
/* Score-Cache: Spam-Bewertungen überdauern das Schließen des Tabs.    */
/* Schlüssel = headerMessageId (Message-ID, neustart-stabil),          */
/* NICHT die interne message.id (die ist nur sitzungsstabil).          */
/* ------------------------------------------------------------------ */
export async function loadScoreCache() {
  const s = await messenger.storage.local.get("scoreCache");
  return s.scoreCache || {};
}

export async function saveScoreCache(cache) {
  await messenger.storage.local.set({ scoreCache: cache || {} });
}

/* Newsletter-Cache: headerMessageId → 0 (kein Newsletter) | { u, m, o, b } (siehe newsletter.js) */
export async function loadListCache() {
  const s = await messenger.storage.local.get("listCache");
  return (s.listCache && typeof s.listCache === "object") ? s.listCache : {};
}

export async function saveListCache(cache) {
  await messenger.storage.local.set({ listCache: cache || {} });
}

/** Ist das aktive Profil vollständig? (Schlüssel nur für entfernte Anbieter nötig) */
export function isConfigured(settings) {
  if (!settings || !settings.aiBaseUrl || !settings.aiModel) return false;
  const needsKey = settings.provider !== "ollama" && !isLocalUrl(settings.aiBaseUrl) && !isOllamaUrl(settings.aiBaseUrl);
  return !needsKey || Boolean(settings.aiApiKey);
}

/* ------------------------------------------------------------------ */
/* Whitelist helpers                                                   */
/* ------------------------------------------------------------------ */

// Freitext (Zeilen/Kommata/Leerzeichen getrennt) -> bereinigte Liste.
// Einträge mit "@" gelten als Adresse, sonst als Domain.
export function parseWhitelist(text) {
  const out = [];
  const seen = new Set();
  for (let token of String(text || "").split(/[\s,;]+/)) {
    token = token.trim().toLowerCase().replace(/^mailto:/, "").replace(/[<>]/g, "");
    if (!token) continue;
    if (!token.includes("@")) token = token.replace(/^@+/, ""); // reine Domain
    if (token && !seen.has(token)) { seen.add(token); out.push(token); }
  }
  return out;
}

export function formatWhitelist(list) {
  return (Array.isArray(list) ? list : []).join("\n");
}

// Passt eine Adresse/Domain auf die Whitelist? Domain matcht auch Subdomains.
export function matchesWhitelist(address, domain, list) {
  if (!Array.isArray(list) || !list.length) return false;
  const addr = String(address || "").toLowerCase();
  const dom = String(domain || "").toLowerCase();
  for (const e of list) {
    if (e.includes("@")) {
      if (addr && addr === e) return true;
    } else if (dom && (dom === e || dom.endsWith("." + e))) {
      return true;
    }
  }
  return false;
}
