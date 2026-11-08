/* Einstellungen für AI Mail Cleaner.
 * IMAP-Konten verwaltet Thunderbird selbst – konfiguriert wird nur das Spam-Modell.
 *
 * Anbieter (provider):
 *   - "decision": Decision-Modell (nicht-generativ, z. B. Jev/Span-01) über die
 *                 OpenRouter-Decisions-API – Standard.
 *   - "openai":   beliebiger Anbieter mit OpenAI-kompatibler Chat-API (LLM).
 *   - "ollama":   lokales Modell über Ollama (LLM, nichts verlässt den Rechner).
 * Jeder Anbieter hat ein eigenes Profil (Basis-URL, Schlüssel, Modell), damit
 * beim Wechseln nichts verloren geht. aiBaseUrl/aiApiKey/aiModel spiegeln immer
 * das aktive Profil (für den Rest der App).
 */

// Reihenfolge der (verschiebbaren) Datenspalten – Standard.
export const DEFAULT_COLUMN_ORDER = ["spam", "from", "domain", "subject", "date", "size"];

// labelKey/descKey → _locales/*/messages.json
export const PROVIDERS = {
  decision: {
    labelKey: "provDecisionLabel",
    descKey: "provDecisionDesc",
    icon: "target",
    baseUrl: "https://openrouter.ai/api/alpha/decisions",
    model: "respan/span-01-lite:free",
    needsKey: true
  },
  openai: {
    labelKey: "provOpenaiLabel",
    descKey: "provOpenaiDesc",
    icon: "cloud",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    needsKey: true
  },
  ollama: {
    labelKey: "provOllamaLabel",
    descKey: "provOllamaDesc",
    icon: "cpu",
    baseUrl: "http://localhost:11434",
    model: "llama3.2:3b",
    needsKey: false
  }
};

// Presets for OpenAI-compatible providers (labelKey only where the name needs translating)
export const OPENAI_PRESETS = [
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { id: "together", label: "Together AI", baseUrl: "https://api.together.xyz/v1" },
  { id: "deepseek", label: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { id: "lmstudio", labelKey: "presetLmStudio", baseUrl: "http://localhost:1234/v1" }
];

function defaultProfiles() {
  const out = {};
  for (const [k, p] of Object.entries(PROVIDERS)) out[k] = { baseUrl: p.baseUrl, apiKey: "", model: p.model };
  return out;
}

export const DEFAULT_SETTINGS = {
  schema: 2,
  provider: "decision",
  profiles: defaultProfiles(),
  modelInfo: {},                 // je Anbieter: Infos zum gewählten Modell (Preis, Größe …)
  aiBaseUrl: PROVIDERS.decision.baseUrl,
  aiApiKey: "",
  aiModel: PROVIDERS.decision.model,
  aiConcurrency: 3,              // parallele Anfragen
  aiBatchSize: 8,                // Mails pro Anfrage (nur LLM-Anbieter)
  loadLimit: 5000,
  scanBody: true,                // zusätzlich einen Mail-Textausschnitt mitbewerten
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

function mapProfiles(profiles, fn) {
  const out = defaultProfiles();
  for (const k of Object.keys(out)) {
    const p = (profiles && typeof profiles[k] === "object" && profiles[k]) || {};
    out[k] = {
      baseUrl: typeof p.baseUrl === "string" ? p.baseUrl : out[k].baseUrl,
      apiKey: fn(typeof p.apiKey === "string" ? p.apiKey : ""),
      model: typeof p.model === "string" ? p.model : out[k].model
    };
  }
  return out;
}

function hostname(url) {
  try { return new URL(url).hostname; } catch (_) { return ""; }
}

/** Schlüssel eines Profils – oder der eines anderen Profils mit gleichem Host
 *  (z. B. OpenRouter für Decision- und Chat-Modelle: nur einmal eintragen). */
export function profileKey(profiles, provider) {
  const p = profiles && profiles[provider];
  if (!p) return { key: "", from: null };
  if (p.apiKey) return { key: p.apiKey, from: provider };
  const host = hostname(p.baseUrl);
  if (host) {
    for (const [k, o] of Object.entries(profiles)) {
      if (k !== provider && o && o.apiKey && hostname(o.baseUrl) === host) return { key: o.apiKey, from: k };
    }
  }
  return { key: "", from: null };
}

// aiBaseUrl/aiApiKey/aiModel = aktives Profil
function syncActive(s) {
  if (!PROVIDERS[s.provider]) s.provider = "decision";
  const p = s.profiles[s.provider];
  s.aiBaseUrl = p.baseUrl || "";
  s.aiApiKey = profileKey(s.profiles, s.provider).key;
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
  if (base || model || s.aiApiKey) {
    s.profiles[provider] = {
      baseUrl: base || PROVIDERS[provider].baseUrl,
      apiKey: s.aiApiKey || "",
      model: model || PROVIDERS[provider].model
    };
  }
  s.schema = 2;
  return s;
}

export async function loadSettings() {
  const stored = await messenger.storage.local.get("settings");
  const raw = stored.settings || {};
  const s = { ...DEFAULT_SETTINGS, ...raw };
  s.aiApiKey = deobfuscate(s.aiApiKey);           // im Speicher immer Klartext
  s.profiles = mapProfiles(raw.profiles, deobfuscate);
  s.modelInfo = (raw.modelInfo && typeof raw.modelInfo === "object") ? raw.modelInfo : {};
  migrate(s, raw);
  return syncActive(s);
}

export async function saveSettings(partial) {
  const current = await loadSettings();           // Klartext-Schlüssel in current
  const next = { ...current, ...partial };
  if (partial.profiles) {
    next.profiles = mapProfiles({ ...current.profiles, ...partial.profiles }, (k) => k);
  } else if ("aiBaseUrl" in partial || "aiApiKey" in partial || "aiModel" in partial) {
    // Alt-Aufrufe ohne Profile: ins aktive Profil schreiben
    const p = { ...current.profiles[next.provider] };
    if ("aiBaseUrl" in partial) p.baseUrl = partial.aiBaseUrl;
    if ("aiApiKey" in partial) p.apiKey = partial.aiApiKey;
    if ("aiModel" in partial) p.model = partial.aiModel;
    next.profiles = { ...current.profiles, [next.provider]: p };
  }
  syncActive(next);
  const toStore = {
    ...next,
    aiApiKey: obfuscate(next.aiApiKey),             // verschleiert ablegen
    profiles: mapProfiles(next.profiles, obfuscate)
  };
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
  const needsKey = settings.provider !== "ollama" && !isLocalUrl(settings.aiBaseUrl);
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
