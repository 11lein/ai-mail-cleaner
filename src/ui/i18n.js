/* Internationalisation.
 * Texts live in src/_locales/<lang>/messages.json (English = default_locale).
 * Placeholders: $1 … $9 (direct substitution, "$$" = literal "$").
 * Plurals: key_one / key_other, picked via Intl.PluralRules; $1 = formatted count.
 * HTML: data-i18n (text), data-i18n-title, data-i18n-placeholder, data-i18n-aria.
 */
const api = (typeof messenger !== "undefined" && messenger.i18n) || null;

export const LANG = (() => {
  try { return (api && api.getUILanguage && api.getUILanguage()) || navigator.language || "en"; }
  catch (_) { return "en"; }
})();

export function t(key, ...subs) {
  const args = subs.flat().map((s) => String(s));
  let m = "";
  try { m = api ? api.getMessage(key, args) : ""; } catch (_) { /* unknown key: the key itself is shown */ }
  return m || key;
}

const pluralRules = new Intl.PluralRules(LANG);
/** Plural: tn("mails", 3) → messages "mails_one" / "mails_other" with $1 = "3". */
export function tn(key, n, ...subs) {
  const form = pluralRules.select(Number(n) || 0) === "one" ? "one" : "other";
  return t(`${key}_${form}`, fmtInt(n), ...subs);
}

export function localizeDocument(root = document) {
  for (const el of root.querySelectorAll("[data-i18n]")) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll("[data-i18n-title]")) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll("[data-i18n-placeholder]")) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", t(el.dataset.i18nAria));
  if (root === document) document.documentElement.lang = LANG.split("-")[0];
}

/* ------------------------------------------------------------------ */
/* Locale-aware formatting                                              */
/* ------------------------------------------------------------------ */
const nfInt = new Intl.NumberFormat(LANG);
const nf1 = new Intl.NumberFormat(LANG, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nfPct = new Intl.NumberFormat(LANG, { style: "percent", maximumFractionDigits: 0 });

export const fmtInt = (n) => nfInt.format(n);
export const fmtPct = (p) => nfPct.format((Number(p) || 0) / 100);

export function fmtUsd(v, digits = 2) {
  return new Intl.NumberFormat(LANG, {
    style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits
  }).format(v);
}

export function fmtSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${nfInt.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${nfInt.format(Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${nf1.format(bytes / (1024 * 1024))} MB`;
  return `${nf1.format(bytes / (1024 * 1024 * 1024))} GB`;
}

const dtFull = new Intl.DateTimeFormat(LANG, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dtTime = new Intl.DateTimeFormat(LANG, { hour: "numeric", minute: "2-digit" });
const dtWeekday = new Intl.DateTimeFormat(LANG, { weekday: "short" });
const dtDayMonth = new Intl.DateTimeFormat(LANG, { day: "numeric", month: "short" });
const dtDayMonthYear = new Intl.DateTimeFormat(LANG, { day: "numeric", month: "short", year: "numeric" });
const dtLong = new Intl.DateTimeFormat(LANG, { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Day range for the date filter: "Mar 3 – Apr 15, 2026" (Intl merges the shared parts) */
export function fmtDayRange(a, b) {
  const da = new Date(a), db = new Date(b);
  try { return dtDayMonthYear.formatRange(da, db); } catch (_) { return `${dtDayMonthYear.format(da)} – ${dtDayMonthYear.format(db)}`; }
}
export const fmtDay = (ms) => dtDayMonthYear.format(new Date(ms));

export const fmtDate = (ms) => (ms ? dtFull.format(new Date(ms)) : "");
export const fmtDateMedium = (ms) => (ms ? dtDayMonthYear.format(new Date(ms)) : "");
export const fmtDateLong = (ms) => (ms ? dtLong.format(new Date(ms)) : "");

/** Compact: "14:32" · "Yesterday" · "Mon" · "Jul 9" · "Oct 2, 2025" */
export function fmtDateSmart(ms) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date();
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(now) - day0(d)) / 86400000);
  if (diff === 0) return dtTime.format(d);
  if (diff === 1) return t("yesterday");
  if (diff > 1 && diff < 7) return dtWeekday.format(d);
  if (d.getFullYear() === now.getFullYear()) return dtDayMonth.format(d);
  return dtDayMonthYear.format(d);
}

const nfDec = [0, 1, 2].map((d) => new Intl.NumberFormat(LANG, { minimumFractionDigits: d, maximumFractionDigits: d }));
/** Number with a fixed count of decimals (0–2) */
export const fmtDec = (n, digits = 1) => nfDec[Math.max(0, Math.min(2, digits))].format(n);

/** Seconds → "0.31 s" · "4.2 s" · "48 s" · "3 min 12 s" · "2 h 10 min" */
export function fmtSecs(sec) {
  if (!Number.isFinite(sec)) return "";
  if (sec < 10) return t("durSec", fmtDec(sec, sec < 1 ? 2 : 1));
  const whole = Math.round(sec);
  if (whole < 60) return t("durSec", fmtInt(whole));
  if (whole < 3600) {
    const m = Math.floor(whole / 60), s = whole % 60;
    return s && m < 10 ? t("durMS", fmtInt(m), fmtInt(s)) : t("durMin", fmtInt(Math.round(sec / 60)));
  }
  return fmtDuration(sec / 60);
}

/** Minutes → "under 1 min" · "5 min" · "2 h 10 min" */
export function fmtDuration(min) {
  if (!Number.isFinite(min)) return "";
  if (min < 1) return t("durUnder1");
  if (min < 60) return t("durMin", fmtInt(Math.round(min)));
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return m ? t("durHM", fmtInt(h), fmtInt(m)) : t("durH", fmtInt(h));
}
