// Builds src/_locales/<lang>/messages.json from scripts/i18n/<lang>.mjs
// and checks that every key used in the UI exists in every language.
//   node scripts/i18n/build.mjs          → write files + check
//   node scripts/i18n/build.mjs --check  → check only (exit 1 on problems)
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const LANGS = ["en", "de", "es"];
const checkOnly = process.argv.includes("--check");

const dicts = {};
for (const l of LANGS) dicts[l] = (await import(join(here, `${l}.mjs`))).default;

// ---- keys used in the code ----
const uiDir = join(root, "src", "ui");
const used = new Set(["extName", "extDescription", "actionTitle", "actionLabel"]);
const plural = new Set();
for (const f of readdirSync(uiDir)) {
  if (f.startsWith("_")) continue;
  const src = readFileSync(join(uiDir, f), "utf8");
  if (f.endsWith(".js")) {
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) used.add(m[1]);
    for (const m of src.matchAll(/\btn\(\s*"([A-Za-z0-9_]+)"/g)) plural.add(m[1]);
    for (const m of src.matchAll(/(?:labelKey|descKey|hintKey):\s*"([A-Za-z0-9_]+)"/g)) used.add(m[1]);
    // provider links in settings.js: ["linkWebsite", "https://…"]
    for (const m of src.matchAll(/\[\s*"(link[A-Za-z0-9_]+)"\s*,/g)) used.add(m[1]);
    for (const m of src.matchAll(/\?\s*"([A-Za-z0-9_]+)"\s*:\s*"([A-Za-z0-9_]+)"/g)) {
      // t(cond ? "a" : "b") – only count when it sits inside t(...)
      const before = src.slice(Math.max(0, m.index - 60), m.index);
      if (/\bt\([^()]*$/.test(before)) { used.add(m[1]); used.add(m[2]); }
    }
  } else if (f.endsWith(".html")) {
    for (const m of src.matchAll(/data-i18n(?:-title|-placeholder|-aria)?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
  }
}
for (const p of plural) { used.add(p + "_one"); used.add(p + "_other"); }

let problems = 0;
for (const l of LANGS) {
  const d = dicts[l];
  const missing = [...used].filter((k) => !(k in d));
  if (missing.length) { problems++; console.error(`[${l}] missing: ${missing.join(", ")}`); }
  for (const [k, v] of Object.entries(d)) {
    if (!/^[A-Za-z0-9_@]+$/.test(k)) { problems++; console.error(`[${l}] invalid key: ${k}`); }
    if (/\$\d\$/.test(v)) { problems++; console.error(`[${l}] ${k}: "$n$" would be read as a named placeholder`); }
    const nIn = (s) => (s.match(/\$\d/g) || []).sort().join();
    if (l !== "en" && k in dicts.en && nIn(v) !== nIn(dicts.en[k])) { problems++; console.error(`[${l}] ${k}: placeholders differ from en`); }
  }
  if (l !== "en") {
    const extra = Object.keys(d).filter((k) => !(k in dicts.en));
    if (extra.length) console.warn(`[${l}] not in en: ${extra.join(", ")}`);
  }
}
const unused = Object.keys(dicts.en).filter((k) => !used.has(k) && !k.startsWith("opt"));
if (unused.length) console.warn(`[en] unused: ${unused.join(", ")}`);

if (!checkOnly) {
  for (const l of LANGS) {
    const out = {};
    for (const k of Object.keys(dicts[l]).sort()) out[k] = { message: dicts[l][k] };
    const dir = join(root, "src", "_locales", l);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "messages.json"), JSON.stringify(out, null, 2) + "\n");
  }
  console.log(`Wrote ${LANGS.map((l) => `src/_locales/${l}/messages.json (${Object.keys(dicts[l]).length})`).join(", ")}`);
}
console.log(problems ? `${problems} problem(s)` : `OK – ${used.size} keys used, all present in ${LANGS.join("/")}`);
process.exit(problems ? 1 : 0);
