import {
  loadSettings, saveSettings, isConfigured, isLocalUrl, PROVIDERS, SOURCES, kindOf, sourceFor, keyHost, keyFor, modelSlot, isOllamaUrl,
  isOllayaUrl, OLLAYA, matchesWhitelist, parseWhitelist, loadScoreCache, saveScoreCache, loadListCache, saveListCache
} from "./settings.js";
import {
  testConnection, scoreMessages, listModels, estimateCost, estimateRate, isFreeModel, hostOf, decisionApi, isOllamaServer,
  isOllayaServer
} from "./ai.js";
import { icon, hydrateIcons } from "./icons.js";
import {
  t, tn, localizeDocument, fmtInt, fmtPct, fmtUsd, fmtSize, fmtDate, fmtDateLong, fmtDateMedium, fmtDateSmart, fmtDuration
} from "./i18n.js";
import { collectText, snippetFrom, buildPreviewDoc, htmlToText } from "./preview.js";
import { extractListInfo, parseMailto, packList, unpackList } from "./newsletter.js";

/* ================================================================== */
/* State                                                               */
/* ================================================================== */
let settings = null;
let folderTree = [];             // [{ isAccount, name, rootFolder, children }]
let folderNodes = [];            // all folder nodes (without accounts)
let accountIdentities = new Map(); // account name -> [{ id, email }]
let currentNode = null;
let currentFolder = null;
let moveTargetNode = null;
let moveIds = [];
const expandedState = new Map();

let rows = [];                   // all loaded mails (see buildRow)
const rowIndex = new Map();      // id -> row
let view = [];                   // filtered + sorted (table order)
let loading = false;
let loadToken = 0;
let rowsVersion = 0, scoresVersion = 0, wlVersion = 0;

let scores = new Map();          // id -> % (session)
let scoreCache = {};             // headerMessageId -> % (persisted)
let idToMsgId = new Map();
let scoreSaveTimer = null;
const queuedIds = new Set();     // in the running scan, still open
const failedIds = new Map();     // id -> error message

let listCache = {};              // headerMessageId -> packed newsletter info (persisted)
let listSaveTimer = null;
let contactSet = new Set();      // e-mail addresses from the address books (lowercase, local only)

let selected = new Set();
let anchorId = null;             // anchor for shift selection
let focusId = null;              // keyboard cursor in the table
let sortKey = "date";
let sortDir = -1;
let groupMode = "domain";
let activeGroup = null;
let searchText = "";
let spamFilter = { mode: "all", lo: 0, hi: 100 }; // all | range | unscored
let scanning = false;
let scanAbort = null;
let firstScanDone = false;

let columnOrder = [];
let columnWidths = {};
let dragCol = null;

// virtual table
const OVERSCAN = 10;
let rowH = 46, headH = 38, winStart = -1, winEnd = -1, scrollRaf = 0;

// preview
let pvId = null, pvMode = "html", pvData = null, pvToken = 0;

const $ = (id) => document.getElementById(id);

/* Reorderable data columns (selection + actions stay at the edges) */
const COLUMNS = {
  spam:    { labelKey: "colSpam", sort: "spam", cls: "c-spam", w: 96 },
  from:    { labelKey: "colFrom", sort: "name", cls: "c-from", w: 230 },
  domain:  { labelKey: "colDomain", sort: "domain", cls: "c-domain", w: 170 },
  subject: { labelKey: "colSubject", sort: "subject", cls: "c-subject", w: null, min: 260 }, // takes the rest
  date:    { labelKey: "colDate", sort: "date", cls: "c-date", w: 108 },
  size:    { labelKey: "colSize", sort: "size", cls: "c-size", w: 74 }
};
const CHECK_W = 40, ACT_W = 44;
function colW(key) {
  const v = Number(columnWidths[key]);
  return v ? Math.max(40, v) : COLUMNS[key].w;
}
function sanitizeOrder(order) {
  const valid = Object.keys(COLUMNS);
  const seen = new Set();
  const out = [];
  for (const k of (Array.isArray(order) ? order : [])) if (valid.includes(k) && !seen.has(k)) { seen.add(k); out.push(k); }
  for (const k of valid) if (!seen.has(k)) out.push(k);
  return out;
}

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
function parseAuthor(author) {
  const raw = (author || "").trim();
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  let name = "", email = "";
  if (m) { name = (m[1] || "").trim(); email = (m[2] || "").trim(); }
  else if (/@/.test(raw)) email = raw.replace(/[<>]/g, "").trim();
  else name = raw;
  const at = email.lastIndexOf("@");
  const domain = at >= 0 ? email.slice(at + 1).toLowerCase() : "";
  if (!name) name = email || t("unknown");
  return { name, email, domain };
}
function addrOf(s) {
  const m = String(s || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(s || "")).trim().toLowerCase();
}
function toMs(date) {
  if (!date) return 0;
  if (date instanceof Date) return date.getTime();
  const v = new Date(date).getTime();
  return Number.isFinite(v) ? v : 0;
}
function fmtCostApprox(v) {
  if (v == null) return "";
  if (v === 0) return t("freeLower");
  return v < 0.01 ? "< " + fmtUsd(0.01) : "≈ " + fmtUsd(v);
}
function fmtPerMillion(perToken) {
  const v = perToken * 1e6;
  return fmtUsd(v, v < 0.1 ? 3 : 2);
}
function textSpan(s) { const el = document.createElement("span"); el.textContent = s; return el; }
function setStatus(text) { $("statusText").textContent = text; }
function byId(id) { return rowIndex.get(id); }
function rowEl(id) { return $("mailBody").querySelector(`tr[data-id="${id}"]`); }
/** "Decision model" – or for LLMs the provider's name (OpenRouter, Ollama, LM Studio …) */
function engineLabel(s) {
  if (s.provider === "decision") return t("provDecisionLabel");
  const src = currentSource(s.provider, s.aiBaseUrl);
  return src ? sourceLabel(src) : t("provLlmLabel");
}
function openExternal(url) {
  try {
    if (messenger.windows && messenger.windows.openDefaultBrowser) return messenger.windows.openDefaultBrowser(url);
  } catch (_) {}
  window.open(url, "_blank", "noopener");
}

/* ----- badges & avatars ----- */
function band(p) { return p >= 80 ? "b-high" : p >= 40 ? "b-mid" : "b-low"; }
function makeSpamBadge(p, long) {
  const b = document.createElement("span");
  b.className = "spam-badge " + band(p);
  b.textContent = long ? t("pctSpam", fmtPct(p)) : fmtPct(p);
  b.title = t("spamProbTitle", fmtPct(p));
  return b;
}
function makeWlBadge() {
  const b = document.createElement("span");
  b.className = "spam-badge wl";
  b.title = t("trustedBadgeTitle");
  b.appendChild(icon("shield-check", 13));
  b.appendChild(document.createTextNode(t("trustedBadge")));
  return b;
}
function hashHue(s) {
  const str = String(s || "");
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}
function initials(name, addr) {
  let src = (name && name !== addr ? name : String(addr || "").split("@")[0]) || "?";
  src = src.replace(/["'()<>[\]]/g, " ").trim();
  const parts = src.split(/[\s._\-+]+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = Array.from(parts[0])[0] || "?";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] || "") : "";
  return (first + last).toUpperCase();
}
function avatarHue(r) { return hashHue(r.fromDomain || r.fromAddress || r.fromName); }
function makeAvatar(r) {
  const el = document.createElement("span");
  el.className = "avatar";
  el.style.setProperty("--h", String(avatarHue(r)));
  el.textContent = initials(r.fromName, r.fromAddress);
  return el;
}

/* ================================================================== */
/* Whitelist & scores                                                  */
/* ================================================================== */
function isWhitelisted(r) { return matchesWhitelist(r.fromAddress, r.fromDomain, settings && settings.whitelist); }
function effectiveScore(r) {
  if (isWhitelisted(r)) return 0;
  return scores.has(r.id) ? scores.get(r.id) : -1;
}
function addressWhitelisted(r) {
  const a = (r.fromAddress || "").toLowerCase();
  return !!a && (settings.whitelist || []).includes(a);
}
function domainWhitelisted(r) { return matchesWhitelist("", r.fromDomain, settings && settings.whitelist); }
async function setWhitelist(list) {
  settings = await saveSettings({ whitelist: list });
  wlVersion++;
  render();
  if (pvId != null) renderPreviewHeader();
}
async function toggleWhitelistValue(value) {
  const v = (value || "").toLowerCase().trim();
  if (!v) return;
  const list = (settings.whitelist || []).slice();
  const i = list.indexOf(v);
  if (i >= 0) list.splice(i, 1); else list.push(v);
  await setWhitelist(list);
  toast(i >= 0 ? t("untrustedToast", v) : t("trustedToast", v));
}
async function trustRows(list) {
  const wl = (settings.whitelist || []).slice();
  let added = 0;
  for (const r of list) {
    const a = (r.fromAddress || "").toLowerCase();
    if (a && !wl.includes(a)) { wl.push(a); added++; }
  }
  if (!added) { toast(t("allSendersTrusted")); return; }
  await setWhitelist(wl);
  toast(tn("sendersTrusted", added));
}

// Caches are keyed by headerMessageId (from the mail → accept only OWN keys and valid values)
function cachedScore(mid) {
  if (!mid || !Object.prototype.hasOwnProperty.call(scoreCache, mid)) return undefined;
  const v = scoreCache[mid];
  return typeof v === "number" ? v : undefined;
}
function cachedList(mid) {
  if (!mid || !Object.prototype.hasOwnProperty.call(listCache, mid)) return undefined;
  return unpackList(listCache[mid]);
}
function cacheScore(id, percent) {
  const mid = idToMsgId.get(id);
  if (mid) scoreCache[mid] = percent;
}
function scheduleScoreCacheSave() {
  if (scoreSaveTimer) return;
  scoreSaveTimer = setTimeout(() => {
    scoreSaveTimer = null;
    saveScoreCache(scoreCache).catch((e) => console.error("Saving score cache:", e));
  }, 2000);
}
function flushScoreCache() {
  if (scoreSaveTimer) { clearTimeout(scoreSaveTimer); scoreSaveTimer = null; }
  return saveScoreCache(scoreCache).catch((e) => console.error("Saving score cache:", e));
}
function scheduleListCacheSave() {
  if (listSaveTimer) return;
  listSaveTimer = setTimeout(() => {
    listSaveTimer = null;
    saveListCache(listCache).catch((e) => console.error("Saving newsletter cache:", e));
  }, 2500);
}
function setScore(id, p) {
  scores.set(id, p);
  failedIds.delete(id);
  queuedIds.delete(id);
  cacheScore(id, p);
  scheduleScoreCacheSave();
  scoresVersion++;
  updateSpamCell(id);
  scheduleLiveCounts();
}
// Refresh counters (chips, status line, groups) during a scan, throttled –
// without re-sorting, so rows don't jump away under the mouse.
let liveTimer = 0;
function scheduleLiveCounts() {
  if (liveTimer) return;
  liveTimer = setTimeout(() => {
    liveTimer = 0;
    updateChips(baseRows());
    updateSelectionUI();
    renderGroups();
    updateChrome();
  }, 400);
}
function markNotSpam(ids) {
  for (const id of ids) setScore(id, 0);
  render();
  toast(ids.length === 1 ? t("markedNotSpam") : tn("markedNotSpamN", ids.length));
}

/* ================================================================== */
/* Newsletter detection & unsubscribe                                  */
/* ================================================================== */
/* r.list: undefined = not checked yet · null = no newsletter · { url, mail, oneClick, fromBody }
 * Visible rows are checked in the background (getFull, read locally/from the IMAP server –
 * nothing is sent anywhere). Scans and the preview reuse the same getFull result. */
const PROBE_MAX_SIZE = 3 * 1024 * 1024;
const PROBE_CONCURRENCY = 2;
const probing = new Set();
const probeSkip = new Set();
const probeQueue = [];
let probeActive = 0, probeTimer = 0;

function ownAddresses(r) {
  const set = new Set();
  for (const x of [...(r.to || []), ...(r.cc || [])]) { const a = addrOf(x); if (a) set.add(a); }
  for (const id of accountIdentities.get(r.account) || []) if (id.email) set.add(id.email.toLowerCase());
  return set;
}
function noteListInfo(id, full) {
  const r = byId(id);
  if (!r || r.list !== undefined) return;
  const acc = { plain: [], html: [] };
  collectText(full, acc);
  let info = null;
  try { info = extractListInfo(full, acc.html, acc.plain, ownAddresses(r)); } catch (e) { console.warn(e); }
  r.list = info;
  if (r.msgId) { listCache[r.msgId] = packList(info); scheduleListCacheSave(); }
  updateSubjectCell(id);
  if (id === pvId) renderPreviewHeader();
}
function scheduleProbe() {
  if (!settings || settings.detectNewsletters === false) return;
  clearTimeout(probeTimer);
  probeTimer = setTimeout(probeVisible, 350);
}
function probeVisible() {
  probeQueue.length = 0;
  if (winStart < 0) return;
  for (let i = winStart; i < winEnd; i++) {
    const r = view[i];
    if (r && r.list === undefined && !probing.has(r.id) && !probeSkip.has(r.id)) probeQueue.push(r);
  }
  pumpProbe();
}
function pumpProbe() {
  const token = loadToken;
  while (probeActive < PROBE_CONCURRENCY && probeQueue.length) {
    const r = probeQueue.shift();
    if (r.list !== undefined || probing.has(r.id)) continue;
    if (r.size && r.size > PROBE_MAX_SIZE) { probeSkip.add(r.id); continue; }
    probing.add(r.id);
    probeActive++;
    messenger.messages.getFull(r.id)
      .then((full) => { if (token === loadToken) noteListInfo(r.id, full); })
      .catch(() => probeSkip.add(r.id))
      .finally(() => { probing.delete(r.id); probeActive--; pumpProbe(); });
  }
}
function unsubTip(info) {
  if (!info.url && !info.mail) return t("unsubTipNone");
  let s;
  if (info.url && info.mail) s = t("unsubTipBoth", hostOf(info.url));
  else if (info.url) s = t("unsubTipUrl", hostOf(info.url));
  else s = t("unsubTipMail", (parseMailto(info.mail) || { to: [""] }).to[0]);
  return info.fromBody ? s + " " + t("unsubFromBody") : s;
}
function makeNlTag(r) {
  const info = r.list;
  const can = Boolean(info.url || info.mail);
  const b = document.createElement("button");
  b.className = "nl-tag" + (can ? "" : " no-unsub");
  b.appendChild(icon("newspaper", 12));
  const label = textSpan(t("newsletterTag"));
  label.className = "nl-text";
  b.appendChild(label);
  b.title = unsubTip(info);
  b.setAttribute("aria-label", b.title);
  b.addEventListener("click", (e) => { e.stopPropagation(); if (can) unsubscribe(r, b); });
  return b;
}
async function unsubscribe(r, anchor) {
  const info = r && r.list;
  if (!info || (!info.url && !info.mail)) return;
  const s = effectiveScore(r);
  if (s >= 80) {
    // Unsubscribing from spam usually just confirms that the address is alive.
    const choice = await confirmDialog(t("unsubSpamTitle"), t("unsubSpamBody", fmtPct(s)), [
      { label: t("unsubAnyway"), value: "go", cls: "ghost" },
      { label: t("cancel"), value: false },
      { label: t("trashInstead"), value: "trash", cls: "danger-solid", icon: "trash" }
    ]);
    if (choice === "trash") { deleteIds([r.id]); return; }
    if (choice !== "go") return;
  }
  const viaWeb = () => { unsubWeb(info.url); offerCleanup(r); };
  const viaMail = async () => { if (await unsubMail(r, info.mail)) offerCleanup(r); };
  if (info.url && info.mail) {
    const rect = (anchor && document.contains(anchor)) ? anchor.getBoundingClientRect() : null;
    showMenu([
      { icon: "globe", label: t("unsubViaWeb", hostOf(info.url)), run: viaWeb },
      { icon: "mail", label: t("unsubViaMail", parseMailto(info.mail).to[0]), run: viaMail }
    ], rect ? rect.left : window.innerWidth / 2 - 150, rect ? rect.bottom + 4 : window.innerHeight / 3);
    return;
  }
  if (info.url) viaWeb();
  else viaMail();
}
function unsubWeb(url) {
  openExternal(url);
  toast(t("unsubOpenedWeb", hostOf(url)));
}
/* Mails that apparently belong to the same newsletter: same sender address or same List-Id */
function relatedNewsletterRows(r) {
  const addr = (r.fromAddress || "").toLowerCase();
  const lid = r.list && r.list.listId;
  return rows.filter((x) => (addr && (x.fromAddress || "").toLowerCase() === addr) ||
    (lid && x.list && x.list.listId === lid));
}
// After unsubscribing: offer to move the newsletter's mails to the trash
async function offerCleanup(r) {
  const related = relatedNewsletterRows(r);
  if (!related.length) return;
  const dates = related.map((x) => x.dateMs).filter(Boolean).sort((a, b) => a - b);
  const sender = r.fromName && r.fromName !== r.fromAddress ? `${r.fromName} <${r.fromAddress}>` : (r.fromAddress || r.fromName);
  const body = cfList([
    { icon: "user", text: sender },
    dates.length > 1 ? { icon: "clock", text: t("dateRange", fmtDateMedium(dates[0]), fmtDateMedium(dates[dates.length - 1])) } : null,
    { icon: "undo", text: t("cfUndoHint") }
  ]);
  const ok = await confirmDialog(tn("unsubCleanupTitle", related.length), body, [
    { label: t("keepThem"), value: false },
    { label: tn("ctxTrashN", related.length), value: true, cls: "danger-solid", icon: "trash" }
  ]);
  if (!ok) return;
  const ids = related.map((x) => x.id).filter((id) => rowIndex.has(id));
  if (pvId != null && ids.includes(pvId)) closePreview();
  deleteIds(ids, { skipConfirm: true });
}
function identityFor(r) {
  const ids = accountIdentities.get(r.account) || [];
  const rec = new Set([...(r.to || []), ...(r.cc || [])].map(addrOf));
  const hit = ids.find((i) => rec.has((i.email || "").toLowerCase()));
  return (hit || ids[0] || {}).id;
}
async function unsubMail(r, mailto) {
  const p = parseMailto(mailto);
  if (!p) return false;
  try {
    const details = {
      to: p.to,
      subject: p.subject || "unsubscribe",
      isPlainText: true,
      plainTextBody: p.body || "unsubscribe"
    };
    const identityId = identityFor(r);
    if (identityId) details.identityId = identityId;
    await messenger.compose.beginNew(details); // opens a draft – the user checks and sends it
    toast(t("unsubDraftOpened"));
    return true;
  } catch (e) {
    showBanner(t("unsubDraftFailed", (e && e.message) || String(e)));
    return false;
  }
}

/* ================================================================== */
/* List filter by sender / domain (shares state with the group list)    */
/* ================================================================== */
function filterMode(kind) { return kind === "domain" ? "domain" : "sender"; }
function isListFilter(kind, value) { return activeGroup != null && activeGroup === value && groupMode === filterMode(kind); }
function syncGroupSegs() {
  document.querySelectorAll(".seg-btn[data-group]").forEach((x) => x.classList.toggle("active", x.dataset.group === groupMode));
}
function setListFilter(kind, value) {
  if (!value) return;
  groupMode = filterMode(kind);
  syncGroupSegs();
  activeGroup = value;
  $("tableWrap").scrollTop = 0;
  render();
}
function clearListFilter() {
  if (activeGroup == null) return;
  activeGroup = null;
  render();
}
function toggleListFilter(kind, value) {
  if (isListFilter(kind, value)) clearListFilter(); else setListFilter(kind, value);
}
function filterBtn(kind, value) {
  const active = isListFilter(kind, value);
  const b = document.createElement("button");
  b.className = "cellfilter" + (active ? " active" : "");
  b.appendChild(icon("funnel", 14));
  b.title = active ? t("filterClear") : t(kind === "domain" ? "filterByDomain" : "filterBySender", value);
  b.setAttribute("aria-label", b.title);
  b.setAttribute("aria-pressed", active ? "true" : "false");
  b.addEventListener("click", (e) => { e.stopPropagation(); toggleListFilter(kind, value); });
  return b;
}
function updateFilterChip() {
  const chip = $("filterChip");
  chip.classList.toggle("hidden", activeGroup == null);
  if (activeGroup == null) return;
  $("filterChipText").textContent = t(groupMode === "domain" ? "filterChipDomain" : "filterChipSender", activeGroup);
  chip.title = $("filterChipText").textContent;
}

/* ================================================================== */
/* Dialogs, toasts, banner, menus                                      */
/* ================================================================== */
const dialogStack = [];
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
function focusablesIn(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
}
function openDialog(id, focusSel) {
  const bd = $(id);
  if (!bd.classList.contains("hidden")) return;
  hideCtx();
  dialogStack.push({ id, lastFocus: document.activeElement });
  bd.classList.remove("hidden");
  requestAnimationFrame(() => {
    const el = (focusSel && bd.querySelector(focusSel)) || focusablesIn(bd)[0];
    if (el) el.focus({ preventScroll: true });
  });
}
function closeDialog(id) {
  const bd = $(id);
  if (bd.classList.contains("hidden")) return;
  bd.classList.add("hidden");
  const i = dialogStack.map((d) => d.id).lastIndexOf(id);
  const entry = i >= 0 ? dialogStack.splice(i, 1)[0] : null;
  if (entry && entry.lastFocus && document.contains(entry.lastFocus) && typeof entry.lastFocus.focus === "function") {
    entry.lastFocus.focus({ preventScroll: true });
  }
}
function topDialog() { return dialogStack.length ? dialogStack[dialogStack.length - 1].id : null; }
function trapTab(e) {
  const top = topDialog();
  if (!top) return;
  const root = $(top).firstElementChild;
  const f = focusablesIn(root);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { first.focus(); e.preventDefault(); }
}
function bindBackdropClose(backdrop, onClose) {
  let downOutside = false;
  backdrop.addEventListener("mousedown", (e) => { downOutside = e.target === backdrop; });
  backdrop.addEventListener("click", (e) => {
    if (downOutside && e.target === backdrop) onClose();
    downOutside = false;
  });
}

let cfResolve = null;
/** Own confirmation dialog. buttons: [{label, value, cls, icon}] – the last one is the default. */
function confirmDialog(title, body, buttons) {
  return new Promise((resolve) => {
    if (cfResolve) cfResolve(false);
    cfResolve = resolve;
    $("cfTitle").textContent = title;
    const b = $("cfBody");
    b.textContent = "";
    if (typeof body === "string") { const p = document.createElement("p"); p.textContent = body; b.appendChild(p); }
    else if (body) b.appendChild(body);
    const bw = $("cfButtons");
    bw.textContent = "";
    for (const bt of buttons) {
      const el = document.createElement("button");
      if (bt.cls) el.className = bt.cls;
      if (bt.icon) el.appendChild(icon(bt.icon, 15));
      el.appendChild(textSpan(bt.label));
      el.addEventListener("click", () => resolveConfirm(bt.value));
      bw.appendChild(el);
    }
    openDialog("confirmBackdrop", "#cfButtons button:last-child");
  });
}
function resolveConfirm(v) {
  const r = cfResolve;
  cfResolve = null;
  closeDialog("confirmBackdrop");
  if (r) r(v);
}
function cfList(items) {
  const ul = document.createElement("ul");
  ul.className = "cf-list";
  for (const it of items) {
    if (!it) continue;
    const li = document.createElement("li");
    li.appendChild(icon(it.icon, 16));
    const s = textSpan(it.text);
    if (it.warn) s.className = "cf-warn";
    li.appendChild(s);
    ul.appendChild(li);
  }
  return ul;
}

function toast(message, opts = {}) {
  const host = $("toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.appendChild(textSpan(message));
  let timer = 0;
  const remove = () => { clearTimeout(timer); el.classList.add("leaving"); setTimeout(() => el.remove(), 220); };
  if (opts.action) {
    const b = document.createElement("button");
    if (opts.actionIcon) b.appendChild(icon(opts.actionIcon, 15));
    b.appendChild(textSpan(opts.action));
    b.addEventListener("click", () => { remove(); opts.onAction(); });
    el.appendChild(b);
  }
  host.appendChild(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  timer = setTimeout(remove, opts.timeout || 4500);
}

function showBanner(text, actions = [], kind = "error") {
  const b = $("banner");
  b.classList.toggle("info", kind === "info");
  $("bannerText").textContent = text;
  const a = $("bannerActions");
  a.textContent = "";
  for (const act of actions) {
    const btn = document.createElement("button");
    btn.className = "sm";
    btn.textContent = act.label;
    btn.addEventListener("click", () => { if (!act.keep) hideBanner(); act.onClick(); });
    a.appendChild(btn);
  }
  b.classList.remove("hidden");
}
function hideBanner() { $("banner").classList.add("hidden"); }

function hideCtx() { $("ctxMenu").classList.add("hidden"); }
/** Popup menu at (x, y). items: [{icon, label, run, danger}] or "sep" */
function showMenu(items, x, y) {
  const menu = $("ctxMenu");
  menu.textContent = "";
  for (const it of items) {
    if (!it) continue;
    if (it === "sep") { const s = document.createElement("div"); s.className = "sep"; menu.appendChild(s); continue; }
    const b = document.createElement("button");
    b.setAttribute("role", "menuitem");
    if (it.danger) b.className = "danger-item";
    b.appendChild(icon(it.icon, 15));
    const s = textSpan(it.label);
    s.style.overflow = "hidden";
    s.style.textOverflow = "ellipsis";
    b.appendChild(s);
    b.addEventListener("click", () => { hideCtx(); it.run(); });
    menu.appendChild(b);
  }
  menu.style.maxWidth = "400px";
  menu.classList.remove("hidden");
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - mw - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - mh - 8)) + "px";
  const first = menu.querySelector("button");
  if (first) first.focus({ preventScroll: true });
}

/* ================================================================== */
/* Permissions                                                         */
/* ================================================================== */
/* Only openrouter.ai is granted up front. Other providers (or localhost for
 * Ollama/LM Studio) are requested on first use.
 * IMPORTANT: must be called synchronously in the click handler (before any await). */
function hostPattern(url) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return null;
    return `${u.protocol}//${u.hostname}/*`;
  } catch (_) {
    return null;
  }
}
/** Ask for access to a provider's host (call synchronously in a click). For Ollama – and for
 *  Ollaya only when asked to (originFixToo, after a 403) – also the optional webRequest permission,
 *  so the add-on can fix the Origin header (see below). */
function requestHostPermission(url, provider, originFixToo) {
  const pat = hostPattern(url);
  if (!pat || pat === "https://openrouter.ai/*") return Promise.resolve(true);
  const api = typeof messenger !== "undefined" && messenger.permissions;
  if (!api || typeof api.request !== "function") return Promise.resolve(true);
  const guarded = provider === "ollama" || Boolean(originFixToo);
  const ollaya = provider === "decision" && isOllayaUrl(url);
  try {
    const req = guarded ? { origins: [pat], permissions: ORIGIN_FIX_PERMS } : { origins: [pat] };
    return Promise.resolve(api.request(req))
      // Ollaya: a webRequest permission granted earlier still gets the fix (no-op without it)
      .then((ok) => { if (ok && (guarded || ollaya)) installOriginFix(url); return ok; })
      .catch(() => false);
  } catch (_) {
    return Promise.resolve(false);
  }
}

/* Ollama and Ollaya answer 403 to requests that carry a browser-extension Origin
 * (moz-extension://…) unless OLLAMA_ORIGINS / OLLAYA_ORIGINS allows it. Ollaya is started from a
 * terminal, so the hint tells to start it with OLLAYA_ORIGINS='moz-extension://*'; Ollama's desktop
 * apps can't easily be started with it. Either way, with the optional webRequest permission the
 * add-on can set the Origin header of its OWN requests to the server's own address instead: their
 * CORS check (Ollaya mirrors Ollama's) allows http://127.0.0.1 / localhost on any port (the same
 * approach other Firefox add-ons for Ollama use). Nothing else is touched – not other add-ons,
 * not web pages, not other servers. */
const ORIGIN_FIX_PERMS = ["webRequest", "webRequestBlocking"];
/** The local server with such an Origin check that `s` talks to – its name for messages, or "". */
function guardedServer(s) { return isOllamaServer(s) ? "Ollama" : isOllayaServer(s) ? "Ollaya" : ""; }
/** Its start command – Ollaya's with Thunderbird allowed. */
function serveCmd(name) { return name === "Ollaya" ? originsCmd(name) : "ollama serve"; }
/** Fallback: allow Thunderbird in the server itself (Ollama's desktop apps read the variable at
 *  start; Ollaya's is started from a terminal with it). */
function originsCmd(name) {
  const p = String((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "");
  const win = /win/i.test(p) && !/darwin/i.test(p);
  if (name === "Ollaya") return win ? "$env:OLLAYA_ORIGINS='moz-extension://*'; ollaya serve" : "OLLAYA_ORIGINS='moz-extension://*' ollaya serve";
  if (/mac/i.test(p)) return "launchctl setenv OLLAMA_ORIGINS 'moz-extension://*'";
  if (win) return "setx OLLAMA_ORIGINS \"moz-extension://*\"";
  return "OLLAMA_ORIGINS='moz-extension://*' ollama serve";
}
/** what to do when the server still says 403 with the Origin fix (or without webRequest) */
function manual403(name) { return t(name === "Ollaya" ? "errOllaya403Manual" : "errOllama403Manual", originsCmd(name)); }
/** a 403 from Ollama/Ollaya = its Origin check (Ollama sends no body, Ollaya code FORBIDDEN) */
function originBlocked(s, err) { return Boolean(guardedServer(s)) && err && err.status === 403; }
/** Ollaya doesn't have the model yet (404 MODEL_NOT_FOUND) → the pull command */
function ollayaMissing(s, err) { return isOllayaServer(s) && err && err.status === 404 && (!err.code || err.code === "MODEL_NOT_FOUND"); }
let originFix = null; // { origin, listener }
function installOriginFix(url) {
  let origin;
  try { origin = new URL(url).origin; } catch (_) { return false; }
  if (originFix && originFix.origin === origin) return true;
  let ev = null;
  try { ev = messenger.webRequest && messenger.webRequest.onBeforeSendHeaders; } catch (_) { /* no permission */ }
  if (!ev) return false;
  const self = messenger.runtime.getURL("");
  const listener = (d) => {
    const from = d.originUrl || d.documentUrl || "";
    if (!from.startsWith(self) || !d.url.startsWith(origin + "/")) return {};
    for (const h of d.requestHeaders) if (h.name.toLowerCase() === "origin") h.value = origin;
    return { requestHeaders: d.requestHeaders };
  };
  try {
    if (originFix) ev.removeListener(originFix.listener);
    ev.addListener(listener, { urls: [hostPattern(url)] }, ["blocking", "requestHeaders"]);
  } catch (_) {
    originFix = null;
    return false;
  }
  originFix = { origin, listener };
  return true;
}

/* ================================================================== */
/* Folders                                                             */
/* ================================================================== */
function folderIconName(type) {
  switch (type) {
    case "inbox": return "inbox";
    case "sent": case "outbox": return "send";
    case "drafts": return "pencil";
    case "templates": return "file";
    case "trash": return "trash";
    case "junk": return "ban";
    case "archives": return "archive";
    default: return "folder";
  }
}
function nodeKey(node) { return node.isAccount ? "acc:" + node.name : "f:" + node.accountName + ":" + node.path; }
function isExpanded(node) {
  const k = nodeKey(node);
  if (expandedState.has(k)) return expandedState.get(k);
  return Boolean(node.isAccount);
}
function setExpanded(node, v) { expandedState.set(nodeKey(node), v); }

function buildFolderNode(f, accountName, depth) {
  const path = (f.path || f.name || "").replace(/^\//, "");
  const node = { folder: f, name: f.name || path.split("/").pop() || path, path, accountName, folderType: f.type || "", depth, children: [] };
  folderNodes.push(node);
  for (const sf of f.subFolders || []) node.children.push(buildFolderNode(sf, accountName, depth + 1));
  return node;
}

async function loadAccountsAndFolders() {
  const prev = currentNode ? nodeKey(currentNode) : null;
  const accounts = await messenger.accounts.list(true);
  folderTree = [];
  folderNodes = [];
  accountIdentities = new Map();
  for (const acc of accounts) {
    const node = { isAccount: true, name: acc.name, rootFolder: acc.rootFolder || null, children: [] };
    const subs = acc.folders || (acc.rootFolder && acc.rootFolder.subFolders) || [];
    for (const f of subs) node.children.push(buildFolderNode(f, acc.name, 1));
    folderTree.push(node);
    accountIdentities.set(acc.name, (acc.identities || []).map((i) => ({ id: i.id, email: i.email || "" })));
  }
  currentNode = (prev && folderNodes.find((n) => nodeKey(n) === prev)) || null;
  if (!currentNode) currentNode = folderNodes.find((n) => n.folderType === "inbox") || folderNodes[0] || null;
  currentFolder = currentNode ? currentNode.folder : null;
  renderFolderTree();
  updateCrumb();
}
function expandToNode(node) {
  const parts = node.path.split("/").filter(Boolean);
  let acc = "";
  for (let i = 0; i < parts.length; i++) {
    acc = i === 0 ? parts[0] : acc + "/" + parts[i];
    expandedState.set("f:" + node.accountName + ":" + acc, true);
  }
}
function trashFolderOf(accountName) {
  return folderNodes.find((n) => n.accountName === accountName && n.folderType === "trash") || null;
}

function updateCrumb() {
  const el = $("currentFolderLabel");
  el.textContent = "";
  if (!currentNode) return;
  const segs = currentNode.path.split("/").filter(Boolean);
  const parts = [currentNode.accountName, ...segs.slice(0, -1), currentNode.name];
  parts.forEach((p, i) => {
    if (i) el.appendChild(icon("chevron-right", 12, "crumb-sep"));
    const s = document.createElement("span");
    s.className = i === parts.length - 1 ? "crumb-cur" : "crumb-part";
    s.textContent = p;
    el.appendChild(s);
  });
  el.title = parts.join(" › ");
}

function renderFolderTree() { renderTreeInto($("folderTree"), "nav"); }
function renderMoveTree() { renderTreeInto($("moveTree"), "move"); }
function renderTreeInto(ul, mode) {
  ul.textContent = "";
  if (!folderTree.length) {
    const li = document.createElement("li");
    li.className = "tree-empty";
    li.textContent = t("noFolders");
    ul.appendChild(li);
    return;
  }
  for (const acc of folderTree) renderNode(acc, ul, 0, mode);
}
function renderNode(node, ul, depth, mode) {
  const li = document.createElement("li");
  li.className = "tree-item" + (node.isAccount ? " is-account" : "");
  li.style.paddingLeft = (4 + depth * 14) + "px";
  li.tabIndex = 0;
  li.setAttribute("role", "treeitem");
  const hasChildren = node.children.length > 0;
  const open = hasChildren && isExpanded(node);
  if (hasChildren) li.setAttribute("aria-expanded", open ? "true" : "false");

  const tog = document.createElement("span");
  tog.className = "tw-toggle" + (open ? " open" : "");
  if (hasChildren) {
    tog.appendChild(icon("chevron-right", 12));
    tog.title = open ? t("collapse") : t("expand");
    tog.addEventListener("click", (e) => {
      e.stopPropagation();
      setExpanded(node, !isExpanded(node));
      (mode === "move" ? renderMoveTree : renderFolderTree)();
    });
  }
  li.appendChild(tog);
  li.appendChild(icon(node.isAccount ? "at" : folderIconName(node.folderType), 15, "tw-ico"));
  const label = document.createElement("span");
  label.className = "tw-label";
  label.textContent = node.name;
  label.title = node.isAccount ? node.name : node.path;
  li.appendChild(label);

  const sel = mode === "move" ? moveTargetNode : currentNode;
  if (node === sel) { li.classList.add("active"); li.setAttribute("aria-selected", "true"); }

  const activate = () => {
    if (mode === "move") pickMoveTarget(node);
    else if (node.isAccount) { setExpanded(node, !isExpanded(node)); renderFolderTree(); }
    else selectFolderNode(node);
  };
  li.addEventListener("click", activate);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    else if (e.key === "ArrowRight" && hasChildren && !open) { e.preventDefault(); setExpanded(node, true); (mode === "move" ? renderMoveTree : renderFolderTree)(); }
    else if (e.key === "ArrowLeft" && open) { e.preventDefault(); setExpanded(node, false); (mode === "move" ? renderMoveTree : renderFolderTree)(); }
  });
  ul.appendChild(li);
  if (open) for (const c of node.children) renderNode(c, ul, depth + 1, mode);
}
function selectFolderNode(node) {
  currentNode = node;
  currentFolder = node.folder;
  activeGroup = null;
  renderFolderTree();
  updateCrumb();
  loadMessages();
}

/* ================================================================== */
/* Loading (progressive) + attachment info                             */
/* ================================================================== */
function gatherNodes(node, includeSub) {
  const out = [];
  (function walk(n) { out.push(n); if (includeSub) for (const c of n.children) walk(c); })(node);
  return out;
}
function folderQuery(folder, extra) {
  // TB ≥ 121 knows folderId, TB 115 expects the folder object
  return folder && folder.id ? { folderId: folder.id, ...extra } : { folder, ...extra };
}
function buildRow(msg, node, includeSub) {
  const { name, email, domain } = parseAuthor(msg.author);
  const msgId = msg.headerMessageId || "";
  return {
    id: msg.id,
    msgId,
    fromName: name,
    fromAddress: email,
    fromDomain: domain,
    subject: msg.subject || "",
    dateMs: toMs(msg.date),
    size: typeof msg.size === "number" ? msg.size : null,
    read: Boolean(msg.read),
    junk: Boolean(msg.junk),
    to: Array.isArray(msg.recipients) ? msg.recipients : [],
    cc: Array.isArray(msg.ccList) ? msg.ccList : [],
    folder: node.folder,
    account: node.accountName,
    folderLabel: includeSub ? node.path : "",
    hasAtt: false,
    list: cachedList(msgId)
  };
}

async function loadMessages() {
  if (!currentNode) return;
  const token = ++loadToken;
  const includeSub = Boolean($("includeSub").checked);
  const nodes = gatherNodes(currentNode, includeSub);
  const limit = Number(settings.loadLimit) || 5000;

  selected.clear();
  anchorId = focusId = null;
  rows = [];
  rowIndex.clear();
  scores.clear();
  idToMsgId = new Map();
  failedIds.clear();
  queuedIds.clear();
  probeQueue.length = 0;
  probeSkip.clear();
  rowsVersion++;
  loading = true;
  $("tableWrap").scrollTop = 0;
  showLoadingPill(0);
  setStatus(includeSub ? t("loadingHeadersSub", tn("subfolders", nodes.length - 1)) : t("loadingHeaders"));
  render();

  let truncated = false, fromCache = 0, lastPaint = 0;
  try {
    outer: for (const n of nodes) {
      let page = await messenger.messages.list(n.folder);
      for (;;) {
        if (token !== loadToken) return;
        for (const m of page.messages || []) {
          if (rows.length >= limit) { truncated = true; break outer; }
          const r = buildRow(m, n, includeSub);
          rows.push(r);
          rowIndex.set(r.id, r);
          if (r.msgId) {
            idToMsgId.set(r.id, r.msgId);
            const cv = cachedScore(r.msgId);
            if (cv !== undefined) { scores.set(r.id, cv); fromCache++; }
          }
        }
        const now = performance.now();
        if (now - lastPaint > 300) { lastPaint = now; rowsVersion++; showLoadingPill(rows.length); render(); }
        if (!page.id) break;
        page = await messenger.messages.continueList(page.id);
      }
    }
    const what = includeSub ? t("mailsFromFolders", tn("mails", rows.length), tn("folders", nodes.length)) : tn("mails", rows.length);
    setStatus((truncated ? t("loadedTruncated", what, fmtInt(limit)) : t("loaded", what)) +
      (fromCache ? " " + t("fromCache", fmtInt(fromCache)) : ""));
  } catch (err) {
    if (token !== loadToken) return;
    setStatus(t("loadError", err.message));
    showBanner(t("loadFailedBanner", err.message), [{ label: t("retry"), onClick: loadMessages }]);
    console.error(err);
  }
  if (token !== loadToken) return;
  loading = false;
  hideProgress();
  rowsVersion++;
  scoresVersion++;
  render();
  loadAttachmentFlags(nodes, token);
}

async function loadAttachmentFlags(nodes, token) {
  if (!messenger.messages.query) return;
  const ids = new Set();
  try {
    for (const n of nodes) {
      let page = await messenger.messages.query(folderQuery(n.folder, { attachment: true }));
      for (;;) {
        if (token !== loadToken) return;
        for (const m of page.messages || []) ids.add(m.id);
        if (!page.id) break;
        page = await messenger.messages.continueList(page.id);
      }
    }
  } catch (e) {
    console.warn("Attachment info not available:", e);
    return;
  }
  if (token !== loadToken || !ids.size) return;
  for (const r of rows) if (ids.has(r.id)) r.hasAtt = true;
  renderWindow(true);
}

/* ================================================================== */
/* Filter, sort, group                                                 */
/* ================================================================== */
function matchesSearch(x, q) {
  return x.fromName.toLowerCase().includes(q) || x.fromAddress.toLowerCase().includes(q) ||
    x.fromDomain.toLowerCase().includes(q) || x.subject.toLowerCase().includes(q);
}
function baseRows() {
  let r = rows;
  if (activeGroup) r = r.filter((x) => groupKeyOf(x) === activeGroup);
  if (searchText) {
    const q = searchText.toLowerCase();
    r = r.filter((x) => matchesSearch(x, q));
  }
  return r;
}
function applySpamFilter(r) {
  if (spamFilter.mode === "unscored") return r.filter((x) => effectiveScore(x) < 0);
  if (spamFilter.mode === "range") {
    const { lo, hi } = spamFilter;
    return r.filter((x) => { const s = effectiveScore(x); return s >= 0 && s >= lo && s <= hi; });
  }
  return r;
}
function sortRows(r) {
  const dir = sortDir;
  const arr = r.slice();
  arr.sort((a, b) => {
    let va, vb;
    switch (sortKey) {
      case "spam": {
        const sa = effectiveScore(a), sb = effectiveScore(b);
        if (sa === -1 && sb === -1) return b.dateMs - a.dateMs;
        if (sa === -1) return 1;
        if (sb === -1) return -1;
        if (sa === sb) return b.dateMs - a.dateMs;
        va = sa; vb = sb; break;
      }
      case "name": va = a.fromName.toLowerCase(); vb = b.fromName.toLowerCase(); break;
      case "domain": va = a.fromDomain; vb = b.fromDomain; break;
      case "subject": va = a.subject.toLowerCase(); vb = b.subject.toLowerCase(); break;
      case "size": va = a.size || 0; vb = b.size || 0; break;
      default: va = a.dateMs; vb = b.dateMs;
    }
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
  return arr;
}
function groupKeyOf(x) { return groupMode === "domain" ? (x.fromDomain || t("noDomain")) : (x.fromAddress || t("unknown")); }
function computeGroups(r) {
  const map = new Map();
  for (const x of r) {
    const key = groupKeyOf(x);
    let g = map.get(key);
    if (!g) {
      const label = groupMode === "domain" ? key : (x.fromName && x.fromName !== x.fromAddress ? x.fromName : x.fromAddress);
      g = { key, label, count: 0, sum: 0, scored: 0 };
      map.set(key, g);
    }
    g.count++;
    const s = effectiveScore(x);
    if (s >= 0) { g.sum += s; g.scored++; }
  }
  return [...map.values()]
    .map((g) => ({ ...g, avg: g.scored ? Math.round(g.sum / g.scored) : null }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/* ================================================================== */
/* Rendering                                                           */
/* ================================================================== */
function render() {
  const base = baseRows();
  view = sortRows(applySpamFilter(base));
  renderColgroup();
  renderHeader();
  renderTable();
  renderGroups();
  updateChips(base);
  updateFilterChip();
  updateSelectionUI();
  updateChrome();
}

function renderColgroup() {
  const cg = $("colGroup");
  cg.textContent = "";
  const mk = (w) => { const c = document.createElement("col"); if (w) c.style.width = w + "px"; return c; };
  let fixed = CHECK_W + ACT_W;
  cg.appendChild(mk(CHECK_W));
  for (const key of columnOrder) {
    const w = colW(key);
    cg.appendChild(mk(w));
    fixed += w || COLUMNS[key].min || 200;
  }
  cg.appendChild(mk(ACT_W));
  $("mailTable").style.minWidth = fixed + "px";
}

function renderHeader() {
  const hr = $("headRow");
  hr.textContent = "";
  const thC = document.createElement("th");
  thC.className = "c-check";
  const sa = document.createElement("input");
  sa.type = "checkbox";
  sa.id = "selectAll";
  sa.title = t("selectAllVisible");
  sa.setAttribute("aria-label", sa.title);
  sa.addEventListener("change", (e) => onSelectAllChange(e.target.checked));
  thC.appendChild(sa);
  hr.appendChild(thC);

  for (const key of columnOrder) {
    const def = COLUMNS[key];
    const th = document.createElement("th");
    th.className = "th-col th-" + key;
    th.dataset.key = key;
    th.draggable = true;
    th.title = t("thTitle");
    const inner = document.createElement("span");
    inner.className = "th-inner";
    inner.appendChild(textSpan(t(def.labelKey)));
    if (sortKey === def.sort) {
      th.classList.add("sorted");
      th.setAttribute("aria-sort", sortDir === 1 ? "ascending" : "descending");
      inner.appendChild(icon(sortDir === 1 ? "arrow-up" : "arrow-down", 13, "arrow"));
    }
    th.appendChild(inner);
    th.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".col-resize")) return;
      sortByKey(def.sort);
    });
    const rz = document.createElement("div");
    rz.className = "col-resize";
    rz.addEventListener("mousedown", (e) => startResize(e, key, th));
    rz.addEventListener("click", (e) => e.stopPropagation());
    th.appendChild(rz);
    th.addEventListener("dragstart", (e) => onColDragStart(e, key, th));
    th.addEventListener("dragover", (e) => onColDragOver(e, key, th));
    th.addEventListener("dragleave", () => th.classList.remove("drop-before", "drop-after"));
    th.addEventListener("drop", (e) => onColDrop(e, key, th));
    th.addEventListener("dragend", onColDragEnd);
    hr.appendChild(th);
  }
  const thA = document.createElement("th");
  thA.className = "c-act";
  hr.appendChild(thA);
}

function sortByKey(key) {
  if (sortKey === key) sortDir = -sortDir;
  else { sortKey = key; sortDir = (key === "spam" || key === "date") ? -1 : 1; }
  render();
}

/* ----- virtual table: only visible rows are in the DOM ----- */
function renderTable() {
  const body = $("mailBody");
  const empty = $("emptyState");
  if (!view.length) {
    winStart = winEnd = -1;
    body.textContent = "";
    if (loading) { empty.classList.add("hidden"); renderSkeleton(body); }
    else if (rows.length) showEmpty("funnel", t("emptyNoMatchTitle"), t("emptyNoMatchHint"), { label: t("resetFilters"), onClick: resetFilters });
    else if (currentFolder) showEmpty("inbox", t("emptyFolderTitle"), t("emptyFolderHint"));
    else showEmpty("folder", t("noFolderTitle"), t("noFolderHint"));
    return;
  }
  empty.classList.add("hidden");
  renderWindow(true);
}

function renderWindow(force) {
  if (!view.length) return;
  const wrap = $("tableWrap");
  const vh = Math.max(rowH, wrap.clientHeight - headH);
  // after a filter/folder change scrollTop may lie behind the new end
  const maxTop = Math.max(0, view.length * rowH - vh);
  let top = wrap.scrollTop;
  if (top > maxTop) { top = maxTop; force = true; }
  const start = Math.max(0, Math.floor(top / rowH) - OVERSCAN);
  const end = Math.min(view.length, Math.ceil((top + vh) / rowH) + OVERSCAN);
  if (!force && start === winStart && end === winEnd) return;
  winStart = start;
  winEnd = end;
  const cols = 2 + columnOrder.length;
  const frag = document.createDocumentFragment();
  if (start > 0) frag.appendChild(spacerRow(start * rowH, cols));
  for (let i = start; i < end; i++) frag.appendChild(buildRowEl(view[i]));
  if (end < view.length) frag.appendChild(spacerRow((view.length - end) * rowH, cols));
  const body = $("mailBody");
  body.textContent = "";
  body.appendChild(frag);
  if (wrap.scrollTop > top) wrap.scrollTop = top;
  measureRows();
  scheduleProbe();
}
function measureRows() {
  const head = $("headRow").getBoundingClientRect().height;
  if (head > 10) headH = head;
  const tr = $("mailBody").querySelector("tr[data-id]");
  if (!tr) return;
  const h = tr.getBoundingClientRect().height;
  if (h > 20 && Math.abs(h - rowH) > 0.5) { rowH = h; renderWindow(true); }
}
function spacerRow(h, cols) {
  const tr = document.createElement("tr");
  tr.className = "vspace";
  tr.setAttribute("aria-hidden", "true");
  const td = document.createElement("td");
  td.colSpan = cols;
  td.style.height = h + "px";
  tr.appendChild(td);
  return tr;
}
function scrollRowIntoView(id) {
  const idx = view.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const wrap = $("tableWrap");
  const vh = wrap.clientHeight - headH;
  const top = idx * rowH, bottom = top + rowH;
  if (top < wrap.scrollTop) wrap.scrollTop = top;
  else if (bottom > wrap.scrollTop + vh) wrap.scrollTop = bottom - vh;
  renderWindow(false);
}

function renderSkeleton(body) {
  const cols = 2 + columnOrder.length;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 14; i++) {
    const tr = document.createElement("tr");
    tr.className = "skel-row";
    for (let c = 0; c < cols; c++) {
      const td = document.createElement("td");
      if (c > 0 && c < cols - 1) {
        const s = document.createElement("span");
        s.className = "skel";
        s.style.width = (35 + ((i * 37 + c * 53) % 55)) + "%";
        td.appendChild(s);
      }
      tr.appendChild(td);
    }
    frag.appendChild(tr);
  }
  body.appendChild(frag);
}
function showEmpty(iconName, title, hint, action) {
  const empty = $("emptyState");
  empty.textContent = "";
  const box = document.createElement("div");
  box.className = "empty-box";
  const ic = document.createElement("div");
  ic.className = "empty-ico";
  ic.appendChild(icon(iconName, 22));
  const ti = document.createElement("div");
  ti.className = "empty-title";
  ti.textContent = title;
  const h = document.createElement("div");
  h.className = "empty-hint";
  h.textContent = hint || "";
  box.append(ic, ti, h);
  if (action) {
    const b = document.createElement("button");
    b.className = "sm";
    b.textContent = action.label;
    b.addEventListener("click", action.onClick);
    box.appendChild(b);
  }
  empty.appendChild(box);
  empty.classList.remove("hidden");
}

/* ----- cells ----- */
function fillSpamCell(td, r) {
  td.textContent = "";
  if (isWhitelisted(r)) td.appendChild(makeWlBadge());
  else if (scores.has(r.id)) td.appendChild(makeSpamBadge(scores.get(r.id)));
  else if (queuedIds.has(r.id)) {
    const s = document.createElement("span");
    s.className = "spam-queued";
    s.textContent = "•••";
    s.title = t("scoring");
    td.appendChild(s);
  } else if (failedIds.has(r.id)) {
    const s = document.createElement("span");
    s.className = "spam-failed";
    s.textContent = "!";
    s.title = t("notScored", failedIds.get(r.id));
    td.appendChild(s);
  } else {
    const s = document.createElement("span");
    s.className = "spam-none";
    s.textContent = "–";
    s.title = t("notScoredYet");
    td.appendChild(s);
  }
}
function updateSpamCell(id) {
  const tr = rowEl(id);
  const r = byId(id);
  if (tr && r) { const cell = tr.querySelector(".c-spam"); if (cell) fillSpamCell(cell, r); }
  if (id === pvId) renderPreviewHeader();
}
function updateSubjectCell(id) {
  const tr = rowEl(id);
  const r = byId(id);
  if (!tr || !r) return;
  const cell = tr.querySelector(".c-subject");
  if (cell) cell.replaceWith(buildCell("subject", r));
}
function wlToggle(value, active, kind) {
  const b = document.createElement("button");
  b.className = "wltoggle" + (active ? " active" : "");
  b.appendChild(icon(active ? "shield-check" : "shield", 15));
  b.setAttribute("aria-pressed", active ? "true" : "false");
  b.title = active ? t("wlActiveTitle", value) : t(kind === "domain" ? "wlTrustDomain" : "wlTrustAddr", value);
  b.setAttribute("aria-label", b.title);
  b.addEventListener("click", (e) => { e.stopPropagation(); toggleWhitelistValue(value); });
  return b;
}
function buildCell(key, r) {
  const td = document.createElement("td");
  td.className = COLUMNS[key].cls;
  switch (key) {
    case "spam":
      fillSpamCell(td, r);
      break;
    case "from": {
      const wrap = document.createElement("div");
      wrap.className = "cell-from";
      wrap.appendChild(makeAvatar(r));
      const lines = document.createElement("div");
      lines.className = "from-lines";
      const nm = document.createElement("span");
      nm.className = "from-name";
      nm.textContent = r.fromName;
      lines.appendChild(nm);
      if (r.fromAddress && r.fromAddress !== r.fromName) {
        const ad = document.createElement("span");
        ad.className = "from-addr";
        ad.textContent = r.fromAddress;
        lines.appendChild(ad);
      }
      wrap.appendChild(lines);
      td.appendChild(wrap);
      td.title = r.fromAddress && r.fromAddress !== r.fromName ? `${r.fromName} <${r.fromAddress}>` : r.fromName;
      if (r.fromAddress) td.append(filterBtn("sender", r.fromAddress), wlToggle(r.fromAddress, addressWhitelisted(r), "addr"));
      break;
    }
    case "domain": {
      const txt = document.createElement("span");
      txt.className = "domtext";
      txt.textContent = r.fromDomain;
      txt.title = r.fromDomain;
      td.appendChild(txt);
      if (r.fromDomain) td.append(filterBtn("domain", r.fromDomain), wlToggle(r.fromDomain, domainWhitelisted(r), "domain"));
      break;
    }
    case "subject": {
      const wrap = document.createElement("div");
      wrap.className = "cell-subj";
      const pv = document.createElement("button");
      pv.className = "pv-btn";
      pv.title = t("previewSpace");
      pv.setAttribute("aria-label", t("preview"));
      pv.appendChild(icon("search", 14));
      pv.addEventListener("click", (e) => { e.stopPropagation(); openPreview(r.id); });
      const subjText = r.subject || t("noSubject");
      const subj = document.createElement("span");
      subj.className = "subj";
      subj.textContent = subjText;
      subj.title = t("openSubjectTitle", subjText);
      subj.addEventListener("click", (e) => { e.stopPropagation(); openMessage(r.id); });
      wrap.append(pv, subj);
      if (r.list) wrap.appendChild(makeNlTag(r));
      if (r.folderLabel) {
        const tag = document.createElement("span");
        tag.className = "srcfolder";
        tag.textContent = r.folderLabel;
        tag.title = t("folderTitle", r.folderLabel);
        wrap.appendChild(tag);
      }
      const att = document.createElement("span");
      att.className = "att-slot";
      if (r.hasAtt) { att.appendChild(icon("paperclip", 14)); att.title = t("hasAttachment"); att.setAttribute("aria-label", att.title); }
      wrap.appendChild(att);
      td.appendChild(wrap);
      break;
    }
    case "date":
      td.textContent = fmtDateSmart(r.dateMs);
      td.title = fmtDate(r.dateMs);
      break;
    case "size":
      td.textContent = fmtSize(r.size);
      break;
  }
  return td;
}
function buildRowEl(r) {
  const tr = document.createElement("tr");
  tr.id = "row-" + r.id;
  tr.dataset.id = String(r.id);
  tr.setAttribute("role", "row");
  const sel = selected.has(r.id);
  tr.setAttribute("aria-selected", sel ? "true" : "false");
  if (sel) tr.classList.add("selected");
  if (!r.read) tr.classList.add("unread");
  if (r.id === pvId) tr.classList.add("peek");
  if (r.id === focusId) tr.classList.add("focus");

  const tdC = document.createElement("td");
  tdC.className = "c-check";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = sel;
  cb.tabIndex = -1;
  cb.setAttribute("aria-label", t("select"));
  cb.addEventListener("click", (e) => { e.stopPropagation(); setFocusRow(r.id, true); onRowSelectClick(r.id, e.shiftKey); });
  tdC.appendChild(cb);
  tr.appendChild(tdC);

  for (const key of columnOrder) tr.appendChild(buildCell(key, r));

  const tdAct = document.createElement("td");
  tdAct.className = "c-act";
  const del = document.createElement("button");
  del.className = "rowdel";
  del.title = t("trashDel");
  del.setAttribute("aria-label", t("moveToTrash"));
  del.appendChild(icon("trash", 15));
  del.addEventListener("click", (e) => { e.stopPropagation(); deleteIds([r.id]); });
  tdAct.appendChild(del);
  tr.appendChild(tdAct);

  tr.addEventListener("click", (e) => {
    if (e.target.closest("input,button,.subj")) return;
    setFocusRow(r.id, true);
    onRowSelectClick(r.id, e.shiftKey);
  });
  tr.addEventListener("dblclick", (e) => { if (!e.target.closest("input,button,.subj")) openPreview(r.id); });
  tr.addEventListener("contextmenu", (e) => openCtx(e, r));
  return tr;
}

/* ----- groups (only redrawn when something changed) ----- */
let groupsSig = "";
function renderGroups() {
  const sig = [groupMode, activeGroup, searchText, rowsVersion, scoresVersion, wlVersion].join("|");
  if (sig === groupsSig) return;
  groupsSig = sig;
  const ul = $("groupList");
  ul.textContent = "";
  const groups = computeGroups(searchText ? rows.filter((x) => matchesSearch(x, searchText.toLowerCase())) : rows);
  const frag = document.createDocumentFragment();
  if (activeGroup) {
    const li = document.createElement("li");
    li.className = "clear-item";
    li.tabIndex = 0;
    li.appendChild(icon("x", 13));
    li.appendChild(textSpan(t("clearGroupFilter")));
    frag.appendChild(li);
  }
  for (const g of groups) {
    const li = document.createElement("li");
    li.dataset.key = g.key;
    li.tabIndex = 0;
    li.setAttribute("role", "option");
    if (g.key === activeGroup) { li.classList.add("active"); li.setAttribute("aria-selected", "true"); }
    const name = document.createElement("span");
    name.className = "g-name";
    name.textContent = g.label;
    name.title = g.key;
    li.appendChild(name);
    if (g.avg != null) {
      const avg = document.createElement("span");
      avg.className = "g-avg " + band(g.avg);
      avg.textContent = "Ø " + fmtPct(g.avg);
      avg.title = t("avgTitle", fmtInt(g.scored));
      li.appendChild(avg);
    }
    const count = document.createElement("span");
    count.className = "g-count";
    count.textContent = fmtInt(g.count);
    li.appendChild(count);
    const acts = document.createElement("span");
    acts.className = "g-actions";
    const s = document.createElement("button");
    s.className = "g-act";
    s.dataset.act = "sel";
    s.title = t("selectAllCount", fmtInt(g.count));
    s.setAttribute("aria-label", s.title);
    s.appendChild(icon("check-square", 14));
    const d = document.createElement("button");
    d.className = "g-act g-del";
    d.dataset.act = "del";
    d.title = t("trashAllCount", fmtInt(g.count));
    d.setAttribute("aria-label", d.title);
    d.appendChild(icon("trash", 14));
    acts.append(s, d);
    li.appendChild(acts);
    frag.appendChild(li);
  }
  ul.appendChild(frag);
}

/* ----- filter chips ----- */
const PRESETS = {
  all: { mode: "all", lo: 0, hi: 100 },
  spam: { mode: "range", lo: 80, hi: 100 },
  unsure: { mode: "range", lo: 40, hi: 79 },
  unscored: { mode: "unscored", lo: 0, hi: 100 }
};
function activePreset() {
  for (const [k, p] of Object.entries(PRESETS)) {
    if (p.mode === spamFilter.mode && (p.mode !== "range" || (p.lo === spamFilter.lo && p.hi === spamFilter.hi))) return k;
  }
  return null;
}
function updateChips(base) {
  let spam = 0, unsure = 0, unscored = 0;
  for (const x of base) {
    const s = effectiveScore(x);
    if (s < 0) unscored++;
    else if (s >= 80) spam++;
    else if (s >= 40) unsure++;
  }
  $("cntSpam").textContent = fmtInt(spam);
  $("cntUnsure").textContent = fmtInt(unsure);
  $("cntUnscored").textContent = fmtInt(unscored);
  const ap = activePreset();
  document.querySelectorAll(".chip").forEach((c) => {
    const on = c.dataset.preset === ap;
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const filtered = spamFilter.mode !== "all";
  $("selectFilteredBtn").classList.toggle("hidden", !filtered || !view.length);
  $("selectFilteredLabel").textContent = t("selectAllCount", fmtInt(view.length));
  const isSpam = ap === "spam" || (spamFilter.mode === "range" && spamFilter.lo >= 80);
  $("trashFilteredBtn").classList.toggle("hidden", !isSpam || !view.length);
  $("trashFilteredLabel").textContent = tn("trashSpamN", view.length);
}
function setSpamFilter(f) {
  spamFilter = { ...f };
  $("spamMin").value = spamFilter.mode === "range" ? spamFilter.lo : 0;
  $("spamMax").value = spamFilter.mode === "range" ? spamFilter.hi : 100;
  updateRangeUI();
  render();
}
function updateRangeUI() {
  const lo = Number($("spamMin").value), hi = Number($("spamMax").value);
  $("rangeLabel").textContent = spamFilter.mode === "unscored" ? t("unscoredLower") : t("rangeFmt", fmtInt(lo), fmtInt(hi));
  const fill = $("rangeFill");
  fill.style.left = lo + "%";
  fill.style.width = (hi - lo) + "%";
  fill.style.backgroundPosition = `-${(lo / 100) * 104}px 0`;
}
/* Double slider: pick and drag the thumb nearest to the pointer ourselves (see cleaner.css .range).
 * The inputs keep their keyboard handling; here we only set their value and fire "input". */
const RANGE_INSET = 8; // = half thumb width = .range-track left/right
function wireRangePointer() {
  const range = $("spamRange");
  const lo = $("spamMin"), hi = $("spamMax");
  let drag = null;
  const valueAt = (clientX) => {
    const r = range.getBoundingClientRect();
    const pct = (clientX - r.left - RANGE_INSET) / Math.max(1, r.width - 2 * RANGE_INSET);
    return Math.round(Math.max(0, Math.min(1, pct)) * 100);
  };
  const apply = (v) => {
    const next = drag === lo ? Math.min(v, Number(hi.value)) : Math.max(v, Number(lo.value));
    if (Number(drag.value) === next) return;
    drag.value = next;
    drag.dispatchEvent(new Event("input"));
  };
  range.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const v = valueAt(e.clientX);
    const a = Number(lo.value), b = Number(hi.value);
    const dA = Math.abs(v - a), dB = Math.abs(v - b);
    // nearest thumb; if both sit on the same spot, the click direction decides
    drag = dA < dB ? lo : dB < dA ? hi : (v < a ? lo : hi);
    drag.focus({ preventScroll: true, focusVisible: false }); // arrow keys then move this thumb
    range.classList.add("dragging");
    try { range.setPointerCapture(e.pointerId); } catch (_) {}
    apply(v);
  });
  range.addEventListener("pointermove", (e) => { if (drag) apply(valueAt(e.clientX)); });
  const end = (e) => {
    if (!drag) return;
    drag = null;
    range.classList.remove("dragging");
    try { range.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  range.addEventListener("pointerup", end);
  range.addEventListener("pointercancel", end);
  range.addEventListener("lostpointercapture", end);
}
function resetFilters() {
  activeGroup = null;
  searchText = "";
  $("searchBox").value = "";
  setSpamFilter(PRESETS.all);
}

/* ----- selection bar, scan button, onboarding, model chip ----- */
function updateSelectionUI() {
  const n = selected.size;
  let visSel = 0;
  for (const r of view) if (selected.has(r.id)) visSel++;
  const hidden = n - visSel;
  const info = $("selInfo");
  info.textContent = "";
  document.querySelector(".subbar").classList.toggle("has-sel", n > 0);
  $("selActions").classList.toggle("hidden", n === 0);
  if (n > 0) {
    const b = document.createElement("b");
    b.textContent = fmtInt(n);
    info.append(b, document.createTextNode(" " + t("selectedSuffix")));
  } else {
    let scored = 0, spam = 0;
    for (const r of rows) { const s = effectiveScore(r); if (scores.has(r.id)) scored++; if (s >= 80) spam++; }
    const shown = view.length === rows.length ? tn("mails", rows.length) : t("xOfY", fmtInt(view.length), tn("mails", rows.length));
    const parts = [shown, t("nScored", fmtInt(scored))];
    if (spam) parts.push(t("nSpam", fmtInt(spam)));
    if (loading) parts.push(t("loadingShort"));
    info.textContent = parts.join(" · ");
  }
  const vo = $("selVisibleOnly");
  vo.classList.toggle("hidden", hidden <= 0);
  vo.textContent = t("hiddenKeepVisible", fmtInt(hidden));
  const all = $("selectAll");
  if (all) {
    all.checked = view.length > 0 && visSel === view.length;
    all.indeterminate = visSel > 0 && visSel < view.length;
  }
}
function scanTodo() { return view.filter((r) => !scores.has(r.id) && !isWhitelisted(r)); }
function updateChrome() {
  const configured = isConfigured(settings);
  $("onboard").classList.toggle("hidden", configured);
  const btn = $("scanBtn");
  const lbl = $("scanLabel");
  if (!configured) {
    lbl.textContent = t("setup");
    btn.title = t("setupTitle");
    btn.disabled = false;
  } else {
    const todo = scanTodo();
    const n = todo.length;
    // only mails that failed last time are left → say so instead of "Scan N"
    const retry = n > 0 && todo.every((r) => failedIds.has(r.id));
    lbl.textContent = !n ? t("allScoredBtn") : retry ? tn("retryN", n) : tn("scanN", n);
    btn.title = !n ? t("allScored") : retry ? t("retryTitle") : t("scanBtnTitle");
    btn.disabled = !n || loading;
  }
  const ic = $("modelChipIcon");
  ic.textContent = "";
  ic.appendChild(icon(settings.provider === "decision" ? "target"
    : settings.provider === "ollama" || isLocalUrl(settings.aiBaseUrl) ? "cpu" : "sparkles", 13));
  $("modelChipText").textContent = `${engineLabel(settings)} · ${settings.aiModel || t("noModel")}`;
}

/* ================================================================== */
/* Selection & keyboard cursor                                         */
/* ================================================================== */
function toggleSelect(id, on) {
  if (on) selected.add(id); else selected.delete(id);
  const tr = rowEl(id);
  if (tr) {
    tr.classList.toggle("selected", on);
    tr.setAttribute("aria-selected", on ? "true" : "false");
    const cb = tr.querySelector('input[type="checkbox"]');
    if (cb) cb.checked = on;
  }
  updateSelectionUI();
}
function selectRange(aId, bId) {
  const i = view.findIndex((r) => r.id === aId), j = view.findIndex((r) => r.id === bId);
  if (i === -1 || j === -1) { selected.add(bId); return; }
  for (let k = Math.min(i, j); k <= Math.max(i, j); k++) selected.add(view[k].id);
}
function onRowSelectClick(id, shift) {
  if (shift && anchorId != null) {
    selectRange(anchorId, id);
    renderWindow(true);
    updateSelectionUI();
  } else {
    toggleSelect(id, !selected.has(id));
    anchorId = id;
  }
}
function onSelectAllChange(checked) {
  for (const r of view) { if (checked) selected.add(r.id); else selected.delete(r.id); }
  anchorId = null;
  renderWindow(true);
  updateSelectionUI();
}
function clearSelection() {
  selected.clear();
  anchorId = null;
  renderWindow(true);
  updateSelectionUI();
}
function setFocusRow(id, fromMouse) {
  const old = $("mailBody").querySelector("tr.focus");
  if (old) old.classList.remove("focus");
  focusId = id;
  if (id == null) return;
  if (!fromMouse) scrollRowIntoView(id);
  const tr = rowEl(id);
  if (tr) tr.classList.add("focus");
  $("tableWrap").setAttribute("aria-activedescendant", "row-" + id);
}
function moveFocus(delta, extend) {
  if (!view.length) return;
  let i = view.findIndex((r) => r.id === focusId);
  if (i < 0) i = delta > 0 ? -1 : view.length;
  const j = Math.max(0, Math.min(view.length - 1, i + delta));
  const id = view[j].id;
  if (extend) {
    if (anchorId == null) anchorId = focusId != null ? focusId : id;
    selectRange(anchorId, id);
    setFocusRow(id);
    renderWindow(true);
    updateSelectionUI();
  } else {
    anchorId = id;
    setFocusRow(id);
  }
}

/* ================================================================== */
/* Actions: trash (with undo), move, groups                            */
/* ================================================================== */
function removeRows(ids) {
  const set = new Set(ids);
  rows = rows.filter((r) => !set.has(r.id));
  let changed = false;
  for (const id of ids) {
    rowIndex.delete(id);
    selected.delete(id);
    scores.delete(id);
    failedIds.delete(id);
    queuedIds.delete(id);
    const mid = idToMsgId.get(id);
    if (mid && Object.prototype.hasOwnProperty.call(scoreCache, mid)) { delete scoreCache[mid]; changed = true; }
    idToMsgId.delete(id);
  }
  if (focusId != null && set.has(focusId)) focusId = null;
  rowsVersion++;
  if (changed) scheduleScoreCacheSave();
}

async function confirmDelete(items) {
  let spam = 0, unsure = 0, low = 0, unscored = 0, trusted = 0;
  const viewIds = new Set(view.map((r) => r.id));
  let hidden = 0;
  const doms = new Map();
  for (const r of items) {
    if (!viewIds.has(r.id)) hidden++;
    if (isWhitelisted(r)) trusted++;
    else {
      const s = effectiveScore(r);
      if (s < 0) unscored++; else if (s >= 80) spam++; else if (s >= 40) unsure++; else low++;
    }
    const d = r.fromDomain || r.fromAddress;
    doms.set(d, (doms.get(d) || 0) + 1);
  }
  const parts = [];
  if (spam) parts.push(t("cfSpamPart", fmtInt(spam)));
  if (unsure) parts.push(t("cfUnsurePart", fmtInt(unsure)));
  if (low) parts.push(t("cfLowPart", fmtInt(low)));
  if (unscored) parts.push(t("cfUnscoredPart", fmtInt(unscored)));
  const top = [...doms.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => `${d} (${fmtInt(c)})`).join(", ");
  const body = cfList([
    parts.length ? { icon: "target", text: parts.join(" · ") } : null,
    top ? { icon: "globe", text: t("cfMostly", top) } : null,
    trusted ? { icon: "shield", text: tn("cfTrustedWarn", trusted), warn: true } : null,
    hidden ? { icon: "alert", text: tn("cfHiddenWarn", hidden), warn: true } : null,
    { icon: "undo", text: t("cfUndoHint") }
  ]);
  return confirmDialog(tn("cfTrashTitle", items.length), body, [
    { label: t("cancel"), value: false },
    { label: t("moveToTrash"), value: true, cls: "danger-solid", icon: "trash" }
  ]);
}

async function deleteIds(ids, opts = {}) {
  const items = ids.map(byId).filter(Boolean);
  if (!items.length) return false;
  if (items.length > 1 && !opts.skipConfirm && !(await confirmDelete(items))) return false;
  const list = items.map((r) => r.id);
  // remember scores so "Undo" can restore them
  const savedScores = items.filter((r) => r.msgId && scores.has(r.id)).map((r) => [r.msgId, scores.get(r.id)]);
  setStatus(tn("statusTrashing", list.length));
  try {
    await messenger.messages.delete(list, false); // false = trash, not permanent
  } catch (err) {
    showBanner(t("deleteFailed", err.message));
    console.error(err);
    return false;
  }
  removeRows(list);
  render();
  setStatus(tn("statusTrashed", list.length));
  toast(tn("toastInTrash", list.length), {
    action: t("undo"), actionIcon: "undo", timeout: 8000, onAction: () => undoDelete(items, savedScores)
  });
  return true;
}

// Undo: find the mails in the trash by Message-ID and move them back
async function undoDelete(items, savedScores) {
  for (const [mid, p] of savedScores || []) scoreCache[mid] = p;
  if (savedScores && savedScores.length) scheduleScoreCacheSave();
  let restored = 0, missing = 0;
  const byAccount = new Map();
  for (const r of items) {
    if (!byAccount.has(r.account)) byAccount.set(r.account, []);
    byAccount.get(r.account).push(r);
  }
  for (const [account, list] of byAccount) {
    const trash = trashFolderOf(account);
    if (!trash || !messenger.messages.query) { missing += list.length; continue; }
    const targets = new Map();
    for (const r of list) {
      if (!r.msgId) { missing++; continue; }
      try {
        const page = await messenger.messages.query(folderQuery(trash.folder, { headerMessageId: r.msgId }));
        const m = (page.messages || [])[0];
        if (!m) { missing++; continue; }
        const key = r.folder.path;
        if (!targets.has(key)) targets.set(key, { folder: r.folder, ids: [] });
        targets.get(key).ids.push(m.id);
      } catch (_) { missing++; }
    }
    for (const { folder, ids } of targets.values()) {
      try { await messenger.messages.move(ids, folder); restored += ids.length; }
      catch (e) { missing += ids.length; console.error(e); }
    }
  }
  if (restored) { toast(tn("toastRestored", restored)); await loadMessages(); }
  if (missing) showBanner(tn("undoMissing", missing), [], "info");
}

function rowsInGroup(key) { return rows.filter((x) => groupKeyOf(x) === key); }
function selectIds(ids, label) {
  for (const id of ids) selected.add(id);
  anchorId = null;
  renderWindow(true);
  updateSelectionUI();
  if (label) toast(label);
}
function selectGroup(key) { const ids = rowsInGroup(key).map((r) => r.id); selectIds(ids, tn("toastSelectedFrom", ids.length, key)); }
function deleteGroup(key) { deleteIds(rowsInGroup(key).map((r) => r.id)); }
function selectFiltered() { selectIds(view.map((r) => r.id), tn("toastSelected", view.length)); }

/* ----- move ----- */
function moveStatus(msg, kind) {
  const el = $("moveStatus");
  el.textContent = msg || "";
  el.style.color = kind === "ok" ? "var(--ok)" : kind === "err" ? "var(--danger-text)" : "var(--muted)";
}
function openMoveModal(ids) {
  moveIds = (ids && ids.length ? ids : [...selected]).filter((id) => rowIndex.has(id));
  if (!moveIds.length) return;
  moveTargetNode = currentNode && !currentNode.isAccount ? currentNode : null;
  $("moveSub").textContent = tn("moveSub", moveIds.length);
  $("newFolderName").value = "";
  if (moveTargetNode) expandToNode(moveTargetNode);
  renderMoveTree();
  refreshMoveButtons();
  openDialog("moveBackdrop", "#moveTree .active, #moveTree li");
}
function closeMoveModal() { closeDialog("moveBackdrop"); }
function refreshMoveButtons() {
  $("moveConfirm").disabled = !(moveTargetNode && !moveTargetNode.isAccount && moveTargetNode.folder);
  if (!moveTargetNode) moveStatus(t("movePickTarget"));
  else if (moveTargetNode.isAccount) moveStatus(t("moveAccountHint", moveTargetNode.name));
  else moveStatus(t("moveTarget", moveTargetNode.path));
}
function pickMoveTarget(node) { moveTargetNode = node; renderMoveTree(); refreshMoveButtons(); }
async function performMove() {
  const ids = moveIds.filter((id) => rowIndex.has(id));
  if (!ids.length || !moveTargetNode || moveTargetNode.isAccount) return;
  const target = moveTargetNode;
  moveStatus(tn("statusMoving", ids.length));
  $("moveConfirm").disabled = true;
  try {
    await messenger.messages.move(ids, target.folder);
    removeRows(ids);
    closeMoveModal();
    render();
    toast(tn("toastMoved", ids.length, target.name));
  } catch (err) {
    moveStatus(t("moveFailed", err.message), "err");
    refreshMoveButtons();
  }
}
async function createFolder() {
  const name = $("newFolderName").value.trim();
  if (!name) { moveStatus(t("enterFolderName"), "err"); return; }
  if (!moveTargetNode) { moveStatus(t("pickLocationFirst"), "err"); return; }
  const parent = moveTargetNode.isAccount ? moveTargetNode.rootFolder : moveTargetNode.folder;
  if (!parent) { moveStatus(t("pickSubfolderForAccount"), "err"); return; }
  moveStatus(t("creatingFolder", name));
  $("newFolderBtn").disabled = true;
  try {
    const created = await messenger.folders.create(parent, name);
    const createdPath = String((created && created.path) || "").replace(/^\//, "");
    const account = moveTargetNode.isAccount ? moveTargetNode.name : moveTargetNode.accountName;
    await loadAccountsAndFolders();
    const node = folderNodes.find((n) => n.accountName === account && n.path === createdPath);
    if (node) { expandToNode(node); moveTargetNode = node; }
    renderMoveTree();
    refreshMoveButtons();
    $("newFolderName").value = "";
    moveStatus(node ? t("folderCreatedSelected", name) : t("folderCreated", name), "ok");
  } catch (err) {
    moveStatus(t("createFailed", err.message), "err");
  } finally {
    $("newFolderBtn").disabled = false;
  }
}

/* ================================================================== */
/* Context menu                                                        */
/* ================================================================== */
function openCtx(e, r) {
  e.preventDefault();
  setFocusRow(r.id, true);
  const ids = selected.has(r.id) && selected.size > 1 ? [...selected] : [r.id];
  const multi = ids.length > 1;
  const canUnsub = r.list && (r.list.url || r.list.mail);
  showMenu([
    { icon: "search", label: t("preview"), run: () => openPreview(r.id) },
    { icon: "external", label: t("openInTb"), run: () => openMessage(r.id) },
    canUnsub ? { icon: "log-out", label: t("unsubscribeEllipsis"), run: () => unsubscribe(r, null) } : null,
    "sep",
    { icon: "check-circle", label: multi ? tn("ctxNotSpamN", ids.length) : t("notSpam"), run: () => markNotSpam(ids) },
    r.fromAddress ? { icon: "shield-check", label: addressWhitelisted(r) ? t("ctxUntrust", r.fromAddress) : t("ctxTrustSender", r.fromAddress), run: () => toggleWhitelistValue(r.fromAddress) } : null,
    r.fromDomain ? { icon: "globe", label: domainWhitelisted(r) ? t("ctxUntrust", r.fromDomain) : t("ctxTrustDomain", r.fromDomain), run: () => toggleWhitelistValue(r.fromDomain) } : null,
    "sep",
    activeGroup != null ? { icon: "x", label: t("filterClear"), run: clearListFilter } : null,
    r.fromAddress && !isListFilter("sender", r.fromAddress) ? { icon: "funnel", label: t("filterBySender", r.fromAddress), run: () => setListFilter("sender", r.fromAddress) } : null,
    r.fromDomain && !isListFilter("domain", r.fromDomain) ? { icon: "funnel", label: t("filterByDomain", r.fromDomain), run: () => setListFilter("domain", r.fromDomain) } : null,
    isConfigured(settings) ? { icon: "refresh", label: multi ? tn("ctxRescoreN", ids.length) : t("rescore"), run: () => rescore(ids) } : null,
    "sep",
    r.fromDomain ? { icon: "check-square", label: t("ctxSelectAllFrom", r.fromDomain), run: () => selectIds(rows.filter((x) => x.fromDomain === r.fromDomain).map((x) => x.id), t("toastSelectedAllFrom", r.fromDomain)) } : null,
    { icon: "folder-move", label: multi ? tn("ctxMoveN", ids.length) : t("moveEllipsis"), run: () => openMoveModal(ids) },
    { icon: "trash", label: multi ? tn("ctxTrashN", ids.length) : t("moveToTrash"), danger: true, run: () => deleteIds(ids) }
  ], e.clientX, e.clientY);
}

/* ================================================================== */
/* Scan                                                                */
/* ================================================================== */
function showLoadingPill(n) {
  const p = $("progress");
  p.classList.remove("hidden");
  p.querySelector(".bar").classList.add("hidden");
  $("progressText").textContent = n ? t("loadingN", fmtInt(n)) : t("loading");
}
function hideProgress() {
  const p = $("progress");
  p.classList.add("hidden");
  p.querySelector(".bar").classList.remove("hidden");
}
function setScanningUI(on) {
  scanning = on;
  $("scanBtn").classList.toggle("hidden", on);
  $("stopBtn").classList.toggle("hidden", !on);
}
function modelInfoFor(s) {
  const info = s.modelInfo && s.modelInfo[s.provider];
  return info && info.id === s.aiModel ? info : null;
}

async function confirmScan(n) {
  const s = settings;
  const rate = estimateRate(s);
  const cost = estimateCost(modelInfoFor(s), s, n);
  const local = s.provider === "ollama" || isLocalUrl(s.aiBaseUrl);
  const dur = s.provider === "ollama"
    ? t("durHardware")
    : t("durationLabel", n / rate < 1 ? t("durUnder1") : t("approx", fmtDuration(n / rate))) + (isFreeModel(s) ? " " + t("freeModelNote") : "");
  const costText = cost === null ? t("costUnknown") : t("costLabel", cost === 0 ? t("costNone") : fmtCostApprox(cost));
  const privacy = local
    ? t("staysLocal")
    : (s.scanBody ? t("sentToWithBody", hostOf(s.aiBaseUrl), fmtInt(Number(s.bodyChars) || 0)) : t("sentToNoBody", hostOf(s.aiBaseUrl))) +
      (s.sendContext !== false ? " " + t("ctxAlsoSent") : "");
  const body = cfList([
    { icon: "clock", text: dur },
    { icon: "coins", text: costText },
    { icon: local ? "cpu" : "cloud", text: privacy }
  ]);
  const buttons = [{ label: t("cancel"), value: false }];
  if (n > 50) buttons.push({ label: t("only50"), value: "50" });
  buttons.push({ label: t("scanAllN", fmtInt(n)), value: "all", cls: "primary", icon: "sparkles" });
  return confirmDialog(tn("scanTitle", n), body, buttons);
}

function onScanClick() {
  if (!isConfigured(settings)) { openSettings(); return; }
  const perm = requestHostPermission(settings.aiBaseUrl, settings.provider); // synchronously in the click
  startScan(perm);
}
async function startScan(perm) {
  if (scanning || loading) return;
  const todoAll = scanTodo();
  if (!todoAll.length) { setStatus(t("allScored")); return; }
  let todo = todoAll;
  if (needsScanConfirm(todoAll.length)) {
    const choice = await confirmScan(todoAll.length);
    if (!choice) return;
    if (choice === "50") todo = todoAll.slice().sort((a, b) => b.dateMs - a.dateMs).slice(0, 50);
  }
  await perm;
  runScan(todo);
}
// Decision models (fast, fractions of a cent) and local models scan right away;
// only paid cloud LLMs ask first – there cost and duration can add up.
function needsScanConfirm(n) {
  return n > 25 && settings.provider === "openai" && !isLocalUrl(settings.aiBaseUrl) && !isFreeModel(settings);
}

/* ----- context for the model: address book, mails from the sender, open rate ----- */
async function loadContacts() {
  const ab = typeof messenger !== "undefined" && messenger.addressBooks;
  if (!ab || typeof ab.list !== "function") return;
  try {
    const set = new Set();
    const addFrom = (c) => {
      const p = (c && c.properties) || {};
      for (const k of ["PrimaryEmail", "SecondEmail"]) if (p[k]) set.add(String(p[k]).trim().toLowerCase());
      const vc = String(p.vCard || (c && c.vCard) || "");
      for (const m of vc.matchAll(/^(?:item\d+\.)?EMAIL[^:\r\n]*:([^\r\n]+)/gim)) set.add(m[1].trim().toLowerCase());
    };
    for (const book of await ab.list(true)) for (const c of book.contacts || []) if (!c.type || c.type === "contact") addFrom(c);
    contactSet = set;
  } catch (e) {
    console.warn("Address books not available:", e);
  }
}
function senderStats() {
  const byAddr = new Map(), byDom = new Map();
  const add = (m, k, read) => {
    if (!k) return;
    let s = m.get(k);
    if (!s) { s = { n: 0, read: 0 }; m.set(k, s); }
    s.n++;
    if (read) s.read++;
  };
  for (const r of rows) { add(byAddr, r.fromAddress.toLowerCase(), r.read); add(byDom, r.fromDomain, r.read); }
  return { byAddr, byDom };
}
function contextFor(r, st) {
  const a = st.byAddr.get(r.fromAddress.toLowerCase()) || { n: 0, read: 0 };
  const d = st.byDom.get(r.fromDomain) || { n: 0, read: 0 };
  return {
    known: contactSet.has(r.fromAddress.toLowerCase()),
    senderCount: a.n, senderReadPct: a.n ? Math.round((a.read / a.n) * 100) : null,
    domainCount: d.n, domainReadPct: d.n ? Math.round((d.read / d.n) * 100) : null,
    junk: Boolean(r.junk)
  };
}

/** Score selected mails again (forgets their stored score first). */
function rescore(ids) {
  if (scanning || loading) { toast(t("scanRunning")); return; }
  if (!isConfigured(settings)) { openSettings(); return; }
  const perm = requestHostPermission(settings.aiBaseUrl, settings.provider); // synchronously in the click
  const items = ids.map(byId).filter(Boolean);
  for (const r of items) {
    scores.delete(r.id);
    failedIds.delete(r.id);
    if (r.msgId && Object.prototype.hasOwnProperty.call(scoreCache, r.msgId)) delete scoreCache[r.msgId];
  }
  scoresVersion++;
  scheduleScoreCacheSave();
  render();
  perm.then(() => runScan(items));
}

async function runScan(todo) {
  settings = await loadSettings();
  if (settings.sendContext !== false) await loadContacts();
  const stats = settings.sendContext !== false ? senderStats() : null;
  const batch = stats ? todo.map((r) => ({ ...r, meta: contextFor(r, stats) })) : todo;
  scanAbort = new AbortController();
  setScanningUI(true);
  hideBanner();
  for (const r of todo) { queuedIds.add(r.id); failedIds.delete(r.id); }
  renderWindow(true);
  const prog = $("progress");
  prog.classList.remove("hidden");
  prog.querySelector(".bar").classList.remove("hidden");
  $("progressFill").style.width = "0%";
  $("progressText").textContent = `0 / ${fmtInt(todo.length)}`;
  setStatus(settings.scanBody ? t("scanningBody") : t("scanningHead"));
  const t0 = Date.now();
  const fetchSnippet = settings.scanBody ? (id) => getBodySnippet(id, settings.bodyChars) : undefined;
  let res = { scored: 0, failed: 0, stopped: false, lastError: null };
  try {
    res = await scoreMessages(batch, settings, {
      onProgress: (done, total) => {
        $("progressFill").style.width = Math.round((done / total) * 100) + "%";
        let eta = "";
        const el = (Date.now() - t0) / 60000;
        if (done >= 3 && el > 0) {
          const left = (total - done) / (done / el);
          eta = " · " + (left < 1 ? t("etaSoon") : t("etaLeft", fmtDuration(left)));
        }
        $("progressText").textContent = `${fmtInt(done)} / ${fmtInt(total)}${eta}`;
      },
      onResult: (id, p) => setScore(id, p),
      onFail: (id, err) => { queuedIds.delete(id); failedIds.set(id, err.message); updateSpamCell(id); },
      fetchSnippet,
      signal: scanAbort.signal
    });
  } catch (err) {
    res.lastError = err;
    console.error(err);
  } finally {
    queuedIds.clear();
    scanAbort = null;
    setScanningUI(false);
    flushScoreCache();
    setTimeout(hideProgress, 1200);
  }
  setStatus(t(res.stopped ? "scanStopped" : "scanDone", tn("mails", res.scored)) +
    (res.failed ? t("scanFailedPart", fmtInt(res.failed)) : ""));
  if (res.lastError) showScanError(res.lastError, todo);
  if (!firstScanDone && res.scored) {
    firstScanDone = true;
    if (sortKey !== "spam") { sortKey = "spam"; sortDir = -1; }
  }
  scoresVersion++;
  render();
}
function stopScan() {
  if (scanAbort) { scanAbort.abort(); setStatus(t("stopping")); }
}
function showScanError(err, todo) {
  const retry = { label: t("retry"), onClick: () => { const again = todo.filter((r) => failedIds.has(r.id) && rowIndex.has(r.id)); if (again.length) runScan(again); } };
  const pick = { label: t("chooseModelBtn"), onClick: () => openSettings() };
  const n = failedIds.size;
  const srv = guardedServer(settings);
  if (originBlocked(settings, err)) {
    // no Origin fix yet → offer it (the click may ask for permission); fix active but still 403 → the server's own setting
    const manual = () => showBanner(manual403(srv), [retry]);
    const allow = { label: t("allowAccess"), onClick: () => {
      requestHostPermission(settings.aiBaseUrl, settings.provider, true).then((ok) => {
        if (!ok) return;
        if (originFix) retry.onClick();
        else manual();
      });
    } };
    if (originFix) manual();
    // Ollaya: first the start command with OLLAYA_ORIGINS, the webRequest fix as the alternative
    else showBanner(srv === "Ollaya" ? t("errOllaya403", originsCmd(srv)) : t("errOrigin403", srv), [allow, retry]);
    return;
  }
  if (ollayaMissing(settings, err)) {
    showBanner(t("errOllayaPull", settings.aiModel, "ollaya pull " + settings.aiModel), [retry, pick]);
    return;
  }
  switch (err.kind) {
    case "auth": showBanner(t("errAuth"), [{ label: t("settings"), onClick: () => openSettings() }]); break;
    case "rate": showBanner(t("errRate") + " " + tn("unscoredLeft", n), [retry, pick]); break;
    case "notfound": showBanner(t("errNotFound", settings.aiModel), [pick]); break;
    case "network": showBanner(srv ? t("errServerDown", srv, serveCmd(srv))
      : jevDown(settings, err) ? t("pkJevDown", hostOf(settings.aiBaseUrl)) + " " + jevServeCmd(settings.aiBaseUrl)
      : t("errNoConn", hostOf(settings.aiBaseUrl)), [retry]); break;
    case "parse": showBanner(t("errParse") + (err.unreadable ? " " + err.message : ""), [pick]); break;
    case "config": showBanner(err.message, [{ label: t("settings"), onClick: () => openSettings() }]); break;
    case "origin": showBanner(err.message, [retry]); break;
    default: showBanner(t("errScan", err.message), [retry]);
  }
}

/* ----- text excerpt for the scan (the same getFull also feeds the newsletter check) ----- */
async function getBodySnippet(id, maxChars) {
  try {
    const full = await messenger.messages.getFull(id);
    noteListInfo(id, full);
    return snippetFrom(full, maxChars);
  } catch (_) {
    return "";
  }
}
async function openMessage(id) {
  try {
    await messenger.messageDisplay.open({ messageId: id, location: "tab" });
  } catch (e) {
    showBanner(t("openFailed", e.message));
  }
}

/* ================================================================== */
/* Preview (rendered safely – see preview.js)                          */
/* ================================================================== */
function isPreviewOpen() { return !$("previewBackdrop").classList.contains("hidden"); }
function markPeek() {
  $("mailBody").querySelectorAll("tr.peek").forEach((x) => x.classList.remove("peek"));
  if (pvId == null) return;
  scrollRowIntoView(pvId);
  const tr = rowEl(pvId);
  if (tr) tr.classList.add("peek");
}
async function openPreview(id) {
  const r = byId(id);
  if (!r) return;
  hideCtx();
  if (!isPreviewOpen()) openDialog("previewBackdrop", "#preview");
  pvId = id;
  anchorId = id;
  setFocusRow(id);
  pvData = null;
  const token = ++pvToken;
  markPeek();
  renderPreviewHeader();
  renderAttachments(null);
  renderPreviewBody();
  $("preview").focus({ preventScroll: true });
  if (messenger.messages.listAttachments) {
    messenger.messages.listAttachments(id).then((list) => { if (token === pvToken) renderAttachments(list); }).catch(() => {});
  }
  try {
    const full = await messenger.messages.getFull(id);
    if (token !== pvToken) return;
    noteListInfo(id, full);
    const acc = { plain: [], html: [] };
    collectText(full, acc);
    const html = acc.html.join("\n");
    let text = acc.plain.join("\n\n").trim();
    if (!text && html) text = htmlToText(html);
    pvData = { html, text };
  } catch (e) {
    if (token !== pvToken) return;
    pvData = { error: (e && e.message) || String(e) };
  }
  renderPreviewBody();
}
function renderAttachments(list) {
  const el = $("pvAtt");
  el.textContent = "";
  const items = (list || []).filter((a) => a && a.name);
  el.classList.toggle("hidden", !items.length);
  for (const a of items) {
    const c = document.createElement("span");
    c.className = "att-chip";
    c.appendChild(icon("paperclip", 13));
    const n = document.createElement("span");
    n.className = "att-name";
    n.textContent = a.name;
    c.appendChild(n);
    if (a.size) { const s = document.createElement("span"); s.className = "att-size"; s.textContent = fmtSize(a.size); c.appendChild(s); }
    c.title = a.name;
    el.appendChild(c);
  }
}
function renderPreviewHeader() {
  const r = byId(pvId);
  if (!r) return;
  $("pvSubject").textContent = r.subject || t("noSubject");
  const av = $("pvAvatar");
  av.textContent = initials(r.fromName, r.fromAddress);
  av.style.setProperty("--h", String(avatarHue(r)));
  $("pvFromName").textContent = r.fromName;
  $("pvFromAddr").textContent = r.fromAddress && r.fromAddress !== r.fromName ? r.fromAddress : (r.fromDomain || "");
  $("pvDate").textContent = fmtDateLong(r.dateMs);
  const sp = $("pvSpam");
  sp.textContent = "";
  if (isWhitelisted(r)) sp.appendChild(makeWlBadge());
  else if (scores.has(r.id)) sp.appendChild(makeSpamBadge(scores.get(r.id), true));
  const to = $("pvTo");
  to.textContent = "";
  const rec = [...(r.to || []), ...(r.cc || [])];
  if (rec.length) {
    const b = document.createElement("b");
    b.textContent = t("toLabel") + " ";
    to.append(b, document.createTextNode(rec.join(", ")));
    to.title = rec.join(", ");
    to.classList.remove("hidden");
  } else to.classList.add("hidden");
  const i = view.findIndex((x) => x.id === pvId);
  $("pvPos").textContent = i >= 0 ? `${fmtInt(i + 1)} / ${fmtInt(view.length)}` : "";
  $("pvPrev").disabled = i <= 0;
  $("pvNext").disabled = i < 0 || i >= view.length - 1;
  const trusted = addressWhitelisted(r);
  const tb = $("pvTrust");
  tb.classList.toggle("active", trusted);
  tb.disabled = !r.fromAddress;
  tb.title = trusted ? t("pvTrustedTitle") : t("pvTrustTitle");
  const tl = tb.querySelector("span:last-child");
  if (tl) tl.textContent = trusted ? t("trusted") : t("trust");
  const ub = $("pvUnsub");
  const canUnsub = Boolean(r.list && (r.list.url || r.list.mail));
  ub.classList.toggle("hidden", !canUnsub);
  if (canUnsub) ub.title = unsubTip(r.list) + " (U)";
}
function previewMessage(text) {
  const m = document.createElement("div");
  m.className = "pv-msg";
  m.textContent = text;
  $("pvBody").appendChild(m);
}
function renderPreviewBody() {
  const body = $("pvBody");
  body.textContent = "";
  const seg = $("pvMode");
  const note = $("pvBlocked");
  note.textContent = "";
  if (!pvData) {
    seg.classList.add("hidden");
    const box = document.createElement("div");
    box.className = "pv-loading";
    for (const w of [94, 82, 88, 64, 76, 40, 70]) {
      const s = document.createElement("span");
      s.className = "skel";
      s.style.width = w + "%";
      s.style.height = "11px";
      box.appendChild(s);
    }
    body.appendChild(box);
    return;
  }
  if (pvData.error) { seg.classList.add("hidden"); previewMessage(t("previewUnavailable", pvData.error)); return; }
  const hasHtml = Boolean(pvData.html), hasText = Boolean(pvData.text);
  seg.classList.toggle("hidden", !(hasHtml && hasText));
  let mode = pvMode;
  if (mode === "html" && !hasHtml) mode = "text";
  if (mode === "text" && !hasText) mode = "html";
  seg.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  if (!hasHtml && !hasText) { previewMessage(t("noDisplayableText")); return; }
  if (mode === "html") {
    const built = buildPreviewDoc(pvData.html);
    const f = document.createElement("iframe");
    f.className = "pv-frame";
    f.setAttribute("sandbox", "");
    f.setAttribute("referrerpolicy", "no-referrer");
    f.setAttribute("title", t("mailContent"));
    f.srcdoc = built.doc;
    body.appendChild(f);
    note.appendChild(icon("shield", 13));
    const parts = [];
    if (built.blocked) parts.push(tn("imagesBlocked", built.blocked));
    if (built.trackers) parts.push(tn("trackersRemoved", built.trackers));
    parts.push(t("linksDisabled"));
    note.appendChild(textSpan(parts.join(" · ")));
  } else {
    const el = document.createElement("div");
    el.className = "pv-text";
    el.textContent = pvData.text.slice(0, 200000);
    body.appendChild(el);
    note.appendChild(icon("shield", 13));
    note.appendChild(textSpan(t("textOnlyNote")));
  }
}
function closePreview() {
  if (!isPreviewOpen()) return;
  closeDialog("previewBackdrop");
  pvToken++;
  pvId = null;
  pvData = null;
  $("pvBody").textContent = "";
  $("mailBody").querySelectorAll("tr.peek").forEach((x) => x.classList.remove("peek"));
  $("tableWrap").focus({ preventScroll: true });
}
function navPreview(dir) {
  const i = view.findIndex((x) => x.id === pvId);
  if (i < 0) return;
  const j = i + dir;
  if (j >= 0 && j < view.length) openPreview(view[j].id);
}
async function previewDelete() {
  if (pvId == null) return;
  const id = pvId;
  const i = view.findIndex((x) => x.id === id);
  $("pvDelete").disabled = true;
  const ok = await deleteIds([id]);
  $("pvDelete").disabled = false;
  if (!ok) return;
  if (!view.length) { closePreview(); return; }
  openPreview(view[Math.min(Math.max(i, 0), view.length - 1)].id);
}
function previewNotSpam() {
  if (pvId == null) return;
  const id = pvId;
  const i = view.findIndex((x) => x.id === id);
  setScore(id, 0);
  render();
  toast(t("markedNotSpam"));
  const j = view.findIndex((x) => x.id === id);
  const next = view[(j >= 0 ? j : i) + 1];
  if (next) openPreview(next.id); else renderPreviewHeader();
}

/* ================================================================== */
/* Settings                                                            */
/* ================================================================== */
let draft = null;
// matched against the server's host name only (anchored), not the whole URL
const KEY_URLS = [
  [/(^|\.)openrouter\.ai$/, "https://openrouter.ai/keys"],
  [/^api\.openai\.com$/, "https://platform.openai.com/api-keys"],
  [/(^|\.)groq\.com$/, "https://console.groq.com/keys"],
  [/(^|\.)mistral\.ai$/, "https://console.mistral.ai/api-keys"],
  [/(^|\.)together\.(xyz|ai)$/, "https://api.together.ai/settings/api-keys"],
  [/(^|\.)deepseek\.com$/, "https://platform.deepseek.com/api_keys"]
];
function keyUrlFor(base) {
  let host = "";
  try { host = new URL(base).hostname.toLowerCase(); } catch (_) { return null; }
  for (const [re, url] of KEY_URLS) if (re.test(host)) return url;
  return null;
}
function openSettings(msg) {
  draft = {
    provider: settings.provider,
    llm: settings.provider === "ollama" ? "ollama" : "openai", // last LLM API, for the LLM card
    profiles: Object.fromEntries(Object.entries(settings.profiles).map(([k, p]) => [k, { baseUrl: p.baseUrl, model: p.model }])),
    keys: {},                     // host → { typed, cleared } – what changed in this dialog
    models: { ...(settings.models || {}) },
    sourceUrls: { ...(settings.sourceUrls || {}) },
    whitelist: [...(settings.whitelist || [])],
    modelInfo: { ...(settings.modelInfo || {}) }
  };
  $("mScanBody").checked = settings.scanBody !== false;
  $("mSendCtx").checked = settings.sendContext !== false;
  $("mNlDetect").checked = settings.detectNewsletters !== false;
  renderCacheInfo();
  $("mConc").value = settings.aiConcurrency;
  $("mBatch").value = settings.aiBatchSize;
  $("mLimit").value = settings.loadLimit;
  $("mChars").value = settings.bodyChars;
  $("wlInput").value = "";
  renderSettings();
  $("settingsBackdrop").querySelector(".modal-body").scrollTop = 0;
  settingsStatus(msg || "", msg ? "warn" : "");
  const p = draft.profiles[draft.provider];
  const needKey = PROVIDERS[draft.provider].needsKey && !isLocalUrl(p.baseUrl) && !draftKeyFor(p.baseUrl);
  openDialog("settingsBackdrop", needKey ? "#mApiKey" : ".prov[aria-checked='true']");
}
function closeSettings() { closeDialog("settingsBackdrop"); }
function settingsStatus(msg, kind) {
  const el = $("mStatus");
  el.textContent = msg || "";
  el.style.color = kind === "ok" ? "var(--ok)" : kind === "err" ? "var(--danger-text)" : kind === "warn" ? "var(--warn)" : "var(--muted)";
}
function stashFields() {
  if (!draft) return;
  const p = draft.profiles[draft.provider];
  p.baseUrl = $("mBaseUrl").value.trim();
  p.model = $("mModel").value.trim();
  const typed = $("mApiKey").value;
  const st = keyState(p.baseUrl);
  if (typed && st) { st.typed = typed; st.cleared = false; }
}
/* API keys belong to a server (host incl. port): switching to another provider and back
 * brings its key back; OpenRouter's one key serves decision and LLM models. */
function keyState(url) {
  const h = keyHost(url);
  if (!h) return null;
  return draft.keys[h] || (draft.keys[h] = { typed: "", cleared: false });
}
function draftKeyFor(url) {
  const st = keyState(url);
  if (!st) return "";
  return st.typed || (st.cleared ? "" : keyFor(settings.keys, url));
}
function draftSettings() {
  stashFields();
  const prov = draft.provider;
  const p = draft.profiles[prov];
  return {
    ...settings,
    provider: prov,
    aiBaseUrl: p.baseUrl,
    aiModel: p.model,
    aiApiKey: draftKeyFor(p.baseUrl),
    scanBody: $("mScanBody").checked,
    sendContext: $("mSendCtx").checked,
    aiConcurrency: Number($("mConc").value) || 3,
    aiBatchSize: Number($("mBatch").value) || 8,
    bodyChars: Number($("mChars").value) || 1500,
    modelInfo: draft.modelInfo
  };
}
function ctxLabel(n) { return t("ctxK", fmtInt(Math.round(n / 1000))); }
function modelInfoPills(info, s, container) {
  container.textContent = "";
  if (!info) return;
  const add = (text, cls) => { const p = document.createElement("span"); p.className = "pill" + (cls ? " " + cls : ""); p.textContent = text; container.appendChild(p); };
  if (info.local) add(t("localFree"), "local");
  else if (info.free) add(t("free"), "free");
  else if (info.pricePrompt != null) add(t("perMTok", fmtPerMillion(info.pricePrompt)), "paid");
  if (info.params) add(info.params + (info.quant ? " · " + info.quant : ""));
  if (info.sizeBytes) add(fmtSize(info.sizeBytes));
  if (info.contextLength) add(ctxLabel(info.contextLength));
  if (info.jsonMode && s.provider === "openai") add(t("pillJson"), "json");
  const n = rows.length;
  if (n && !info.local && !info.free && info.pricePrompt != null) {
    const c = estimateCost(info, s, n);
    if (c != null) add(t("costForFolder", fmtCostApprox(c), tn("mails", n)));
  }
}
function renderSettings() {
  const prov = draft.provider;
  const kind = kindOf(prov);
  const meta = PROVIDERS[prov];
  const p = draft.profiles[prov];
  const local = prov === "ollama" || isLocalUrl(p.baseUrl);
  document.querySelectorAll(".prov").forEach((b) => b.setAttribute("aria-checked", b.dataset.kind === kind ? "true" : "false"));
  $("provDesc").textContent = t(kind === "decision" ? "provDecisionDesc" : "provLlmDesc");

  // provider drop-down: cloud first, then this computer, then a custom URL
  const cur = currentSource(prov, p.baseUrl);
  const sel = $("presetSelect");
  sel.textContent = "";
  for (const group of ["cloud", "local"]) {
    const og = document.createElement("optgroup");
    og.label = t(group === "cloud" ? "groupCloud" : "groupLocal");
    for (const src of SOURCES[kind].filter((x) => x.group === group)) {
      const o = document.createElement("option");
      o.value = src.id;
      o.textContent = sourceLabel(src);
      o.selected = src === cur;
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = t("customUrl");
  custom.selected = !cur;
  sel.appendChild(custom);
  renderSourceHint(cur, p);

  // key – one per server, kept when switching providers
  $("keyField").classList.toggle("hidden", isOllamaServer({ provider: prov, aiBaseUrl: p.baseUrl }));
  $("mApiKeyLabel").textContent = t("apiKey") + (local ? " " + t("optionalParen") : "");
  const st = keyState(p.baseUrl) || { typed: "", cleared: false };
  $("mApiKey").value = st.typed || "";
  const saved = Boolean(keyFor(settings.keys, p.baseUrl)) && !st.cleared;
  $("mApiKey").placeholder = saved ? t("keySavedPh") : (/openrouter/.test(p.baseUrl) ? "sk-or-…" : "sk-…");
  $("mKeyState").textContent = saved ? t("keySavedState", keyHost(p.baseUrl)) : st.cleared ? t("keyWillBeRemoved") : "";
  $("mKeyClear").classList.toggle("hidden", !saved);
  const keyUrl = keyUrlFor(p.baseUrl);
  $("mKeyLink").classList.toggle("hidden", !keyUrl);
  $("mKeyLink").dataset.url = keyUrl || "";

  // model
  $("mBaseUrl").value = p.baseUrl;
  $("mModel").value = p.model;
  $("mModel").placeholder = meta.model || t("chooseModelPh");
  const info = draft.modelInfo[prov];
  modelInfoPills(info && info.id === p.model ? info : null, draftSettingsLite(), $("mModelInfo"));

  // privacy
  const host = hostOf(p.baseUrl);
  $("privacyNote").textContent = local
    ? t("allLocal")
    : ($("mScanBody").checked ? t("privacyBody", host, fmtInt(Number($("mChars").value) || 0)) : t("privacyNoBody", host)) +
      ($("mSendCtx").checked ? " " + t("ctxAlsoSent") : "");

  renderWlChips();
}
/** The command that starts the jev-style server for this URL – with `--port` unless it's the
 * default 8765. `--allow-any-host` exists only in newer jev-style versions (0.6.3 has no origin
 * check and rejects the flag), so it's only suggested after the server answered 403. */
function jevServeCmd(url, extra) {
  let port = "";
  try { const u = new URL(url); if (u.port && u.port !== "8765") port = " --port " + u.port; } catch { /* custom text */ }
  return "jev-style serve" + port + (extra ? " " + extra : "");
}
/** local decision server not reachable? */
function jevDown(s, err) {
  return s.provider === "decision" && decisionApi(s) === "systemone" && isLocalUrl(s.aiBaseUrl) && !isOllamaUrl(s.aiBaseUrl) &&
    err && err.kind === "network";
}
/** The drop-down entry for a provider + URL. A local decision server on another port is still
 * LM Studio / Jev-Style (by its API); anything else unknown is a custom URL (null). */
function currentSource(prov, url) {
  const exact = sourceFor(prov, url);
  if (exact || prov !== "decision" || !isLocalUrl(url)) return exact;
  const api = decisionApi({ aiBaseUrl: url });
  const id = api === "letters" ? "lmstudio" : api === "ollaya" ? "ollaya" : "jevstyle";
  return SOURCES.decision.find((x) => x.id === id) || null;
}
function sourceLabel(src) { return src.labelKey ? t(src.labelKey) : src.label; }
/** Note under the drop-down: what the provider is, how to set it up, links to it. */
function renderSourceHint(src, p) {
  const ico = $("srcHintIcon");
  ico.textContent = "";
  ico.appendChild(icon(!src ? "globe" : src.group === "local" ? "cpu" : "cloud", 15));
  const text = !src ? t(draft.provider === "decision" ? "srcHintCustomDecision" : "srcHintCustom")
    : src.hintKey === "jevHint" ? t("jevHint", hostOf(p.baseUrl), jevServeCmd(p.baseUrl))
    : t(src.hintKey);
  richText($("srcHintText"), text);
  const links = $("srcLinks");
  links.textContent = "";
  for (const [labelKey, url] of (src && src.links) || []) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "linkbtn";
    b.appendChild(textSpan(t(labelKey)));
    b.appendChild(icon("external", 13));
    b.addEventListener("click", () => openExternal(url));
    links.appendChild(b);
  }
}
/** Remember URL and model of the provider being left, so switching back restores them. */
function rememberSource() {
  const prov = draft.provider;
  const p = draft.profiles[prov];
  if (p.model) draft.models[modelSlot(prov, p.baseUrl)] = p.model;
  if (prov === "ollama") return;
  const cur = currentSource(prov, p.baseUrl);
  draft.sourceUrls[kindOf(prov) + ":" + (cur ? cur.id : "custom")] = p.baseUrl;
}
function selectSource(id) {
  stashFields();
  rememberSource();
  const kind = kindOf(draft.provider);
  const src = SOURCES[kind].find((x) => x.id === id);
  if (src && src.provider === "ollama") {
    draft.provider = draft.llm = "ollama";
  } else {
    const prov = src ? src.provider : kind === "decision" ? "decision" : "openai";
    if (prov === "openai") draft.llm = "openai";
    draft.provider = prov;
    const p = draft.profiles[prov];
    const url = draft.sourceUrls[kind + ":" + (src ? src.id : "custom")] || (src ? src.baseUrl : "");
    if (!src || p.baseUrl !== url) {
      p.baseUrl = url;
      p.model = draft.models[modelSlot(prov, url)] || (src && src.model) || "";
    }
  }
  renderSettings();
  settingsStatus("");
  if (!src) { $("settingsBackdrop").querySelector("details.adv").open = true; $("mBaseUrl").focus(); }
}
/** Text with `code` spans (from a translation) – built with text nodes only, no HTML. */
function richText(el, text) {
  el.textContent = "";
  String(text).split("`").forEach((part, i) => {
    if (!part) return;
    if (i % 2) { const c = document.createElement("code"); c.textContent = part; el.appendChild(c); }
    else el.appendChild(document.createTextNode(part));
  });
}
function renderCacheInfo() {
  $("cacheInfo").textContent = t("cacheInfo", fmtInt(Object.keys(scoreCache).length), fmtInt(Object.keys(listCache).length));
}
async function clearCache() {
  const nScores = Object.keys(scoreCache).length, nLists = Object.keys(listCache).length;
  const ok = await confirmDialog(t("clearCacheTitle"), t("clearCacheBody", fmtInt(nScores), fmtInt(nLists)), [
    { label: t("cancel"), value: false },
    { label: t("clearCache"), value: true, cls: "danger-solid", icon: "trash" }
  ]);
  if (!ok) return;
  if (scoreSaveTimer) { clearTimeout(scoreSaveTimer); scoreSaveTimer = null; }
  if (listSaveTimer) { clearTimeout(listSaveTimer); listSaveTimer = null; }
  scoreCache = {};
  listCache = {};
  await Promise.all([saveScoreCache({}), saveListCache({})]);
  scores.clear();
  failedIds.clear();
  probeSkip.clear();
  for (const r of rows) r.list = undefined;
  firstScanDone = false;
  rowsVersion++;
  scoresVersion++;
  render();
  renderCacheInfo();
  settingsStatus(t("cacheCleared"), "ok");
}
function draftSettingsLite() {
  return { ...settings, provider: draft.provider, aiBaseUrl: draft.profiles[draft.provider].baseUrl, aiModel: draft.profiles[draft.provider].model, scanBody: $("mScanBody").checked, bodyChars: Number($("mChars").value) || 1500, aiBatchSize: Number($("mBatch").value) || 8 };
}
function renderWlChips() {
  const box = $("wlChips");
  box.textContent = "";
  if (!draft.whitelist.length) {
    const e = document.createElement("span");
    e.className = "wl-empty";
    e.textContent = t("wlEmpty");
    box.appendChild(e);
    return;
  }
  for (const v of draft.whitelist) {
    const c = document.createElement("span");
    c.className = "wl-chip";
    c.appendChild(icon(v.includes("@") ? "user" : "globe", 12));
    c.appendChild(textSpan(v));
    const x = document.createElement("button");
    x.type = "button";
    x.title = t("removeX", v);
    x.setAttribute("aria-label", x.title);
    x.appendChild(icon("x", 12));
    x.addEventListener("click", () => { draft.whitelist = draft.whitelist.filter((w) => w !== v); renderWlChips(); });
    c.appendChild(x);
    box.appendChild(c);
  }
}
function addWlFromInput() {
  const vals = parseWhitelist($("wlInput").value);
  for (const v of vals) if (!draft.whitelist.includes(v)) draft.whitelist.push(v);
  $("wlInput").value = "";
  renderWlChips();
}
/** card click: decision models ↔ language models (back to the LLM API used last) */
function switchKind(kind) {
  if (!draft || kindOf(draft.provider) === kind) return;
  stashFields();
  rememberSource();
  draft.provider = kind === "decision" ? "decision" : draft.llm;
  renderSettings();
  settingsStatus("");
}
async function saveSettingsDialog(perm) {
  const s = draftSettings();
  addWlFromInput();
  rememberSource();
  const profiles = {};
  for (const [k, p] of Object.entries(draft.profiles)) profiles[k] = { baseUrl: p.baseUrl, model: p.model };
  const keys = { ...settings.keys };
  for (const [h, st] of Object.entries(draft.keys)) {
    if (st.typed) keys[h] = st.typed;
    else if (st.cleared) delete keys[h];
  }
  const prevLimit = settings.loadLimit;
  const nlBefore = settings.detectNewsletters !== false;
  settings = await saveSettings({
    provider: s.provider,
    profiles,
    keys,
    models: draft.models,
    sourceUrls: draft.sourceUrls,
    modelInfo: draft.modelInfo,
    whitelist: draft.whitelist,
    scanBody: s.scanBody,
    sendContext: $("mSendCtx").checked,
    detectNewsletters: $("mNlDetect").checked,
    aiConcurrency: Math.max(1, Math.min(10, s.aiConcurrency)),
    aiBatchSize: Math.max(1, Math.min(25, s.aiBatchSize)),
    bodyChars: Math.max(0, Math.min(20000, s.bodyChars)),
    loadLimit: Math.max(100, Math.min(100000, Number($("mLimit").value) || 5000))
  });
  await perm;
  wlVersion++;
  closeSettings();
  toast(t("settingsSaved"));
  if (settings.loadLimit !== prevLimit) loadMessages(); else render();
  if (!nlBefore && settings.detectNewsletters) scheduleProbe();
}
async function testSettings(perm) {
  const s = draftSettings();
  if (!s.aiBaseUrl || !s.aiModel) { settingsStatus(t("pickModelFirst"), "err"); return; }
  if (!isConfigured(s)) { settingsStatus(t("enterApiKey"), "err"); return; }
  settingsStatus(t("testing"));
  await perm;
  try {
    const r = await testConnection(s);
    // a jev-style server runs exactly one model – take over its real name (not Ollaya: there the
    // answer names the routed model, e.g. laya:en for a "laya" request)
    if (s.provider === "decision" && decisionApi(s) === "systemone" && r.servedModel && isLocalUrl(s.aiBaseUrl) && r.servedModel !== s.aiModel) {
      draft.profiles.decision.model = r.servedModel;
      renderSettings();
    }
    settingsStatus(t("connectionOk", r.model, r.reply), "ok");
  } catch (err) {
    const srv = guardedServer(s);
    const msg = srv && err.kind === "network" ? t("errServerDown", srv, serveCmd(srv))
      : originBlocked(s, err)
        ? (originFix ? manual403(srv) : srv === "Ollaya" ? t("errOllaya403", originsCmd(srv)) : t("errOriginShort", srv))
      : ollayaMissing(s, err) ? t("errOllayaPull", s.aiModel, "ollaya pull " + s.aiModel)
      : jevDown(s, err) ? t("pkJevDown", hostOf(s.aiBaseUrl)) + " " + jevServeCmd(s.aiBaseUrl)
      : t("failed", err.message);
    settingsStatus(msg, "err");
  }
}

/* ================================================================== */
/* Model picker                                                        */
/* ================================================================== */
let pk = { models: [], sel: null, loading: false, error: null, s: null };
function openPicker() {
  const s = draftSettings();
  const perm = requestHostPermission(s.aiBaseUrl, s.provider); // synchronously in the click
  pk = { models: [], sel: s.aiModel || null, loading: true, error: null, s };
  const src = currentSource(s.provider, s.aiBaseUrl);
  $("pkSub").textContent = `${t(s.provider === "decision" ? "provDecisionLabel" : "provLlmLabel")} · ${src ? sourceLabel(src) + " · " : ""}${hostOf(s.aiBaseUrl)}`;
  $("pkSearch").value = "";
  $("pkSort").value = "rec";
  $("pkFree").checked = false;
  renderPicker();
  openDialog("pickerBackdrop", "#pkSearch");
  perm.then(loadPickerModels);
}
function closePicker() { closeDialog("pickerBackdrop"); }
async function loadPickerModels() {
  pk.loading = true;
  pk.error = null;
  renderPicker();
  try {
    pk.models = await listModels(pk.s);
    // Ollama/Ollaya list "laya:latest" for the model "laya"
    if (pk.sel && !pk.sel.includes(":") && !pk.models.some((m) => m.id === pk.sel) && pk.models.some((m) => m.id === pk.sel + ":latest")) pk.sel += ":latest";
    // a previously chosen model that isn't offered (e.g. an audio model) shouldn't stay preselected
    const filtered = pk.s.provider === "openai" || (pk.s.provider === "decision" && decisionApi(pk.s) === "letters");
    if (filtered && pk.sel && !pk.models.some((m) => m.id === pk.sel)) pk.sel = null;
  } catch (e) {
    pk.error = e;
    pk.models = [];
  }
  pk.loading = false;
  renderPicker();
  const sel = $("pkList").querySelector(".pk-item.sel");
  if (sel) sel.scrollIntoView({ block: "nearest" });
}
function paramsNum(p) { const m = String(p || "").match(/[\d.]+/); return m ? Number(m[0]) : Infinity; }
function pickerItems() {
  const q = $("pkSearch").value.trim().toLowerCase();
  const freeOnly = $("pkFree").checked;
  const list = pk.models.filter((m) => (!freeOnly || m.free || m.local) &&
    (!q || m.id.toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q)));
  // sort price = estimated cost per 1,000 mails (input + output tokens)
  const price = (m) => {
    if (m.free || m.local) return 0;
    const c = estimateCost(m, { ...pk.s, aiModel: m.id }, 1000);
    return c == null ? Infinity : c;
  };
  const size = (m) => m.sizeBytes || paramsNum(m.params);
  switch ($("pkSort").value) {
    case "price": list.sort((a, b) => price(a) - price(b) || a.id.localeCompare(b.id)); break;
    case "name": list.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)); break;
    case "ctx": list.sort((a, b) => (b.contextLength || 0) - (a.contextLength || 0)); break;
    case "size": list.sort((a, b) => size(a) - size(b)); break;
    default:
      // local model stores: smallest first – Ollaya's recommended model (laya:en) before that
      if (isOllamaServer(pk.s) || isOllayaServer(pk.s)) {
        const rec = (m) => (isOllayaServer(pk.s) && m.id === OLLAYA.model ? 1 : 0);
        list.sort((a, b) => rec(b) - rec(a) || size(a) - size(b));
      }
      // LLMs: models with a JSON response format first (much more reliable), then the cheapest
      else list.sort((a, b) => (b.jsonMode ? 1 : 0) - (a.jsonMode ? 1 : 0) || price(a) - price(b) || (a.name || a.id).localeCompare(b.name || b.id));
  }
  return list;
}
function pickerMsg(text, code) {
  const d = document.createElement("div");
  d.className = "pk-msg";
  d.appendChild(textSpan(text));
  if (code) { d.appendChild(document.createElement("br")); const c = document.createElement("code"); c.textContent = code; d.appendChild(c); }
  $("pkList").appendChild(d);
}
function renderPicker() {
  const list = $("pkList");
  list.textContent = "";
  $("pkApply").disabled = !pk.sel;
  $("pkSel").textContent = pk.sel ? t("selectedModel", pk.sel) : "";
  if (pk.loading) {
    for (let i = 0; i < 6; i++) {
      const it = document.createElement("div");
      it.className = "pk-item";
      const s1 = document.createElement("span"); s1.className = "skel"; s1.style.width = "60%";
      const s2 = document.createElement("span"); s2.className = "skel"; s2.style.width = "40%"; s2.style.marginTop = "8px";
      const box = document.createElement("div"); box.append(s1, s2); box.style.gridColumn = "2";
      it.appendChild(box);
      list.appendChild(it);
    }
    return;
  }
  if (pk.error) {
    const e = pk.error;
    const srv = guardedServer(pk.s);
    if (srv && e.kind === "network") pickerMsg(t("pkServerDown", srv), serveCmd(srv));
    else if (originBlocked(pk.s, e)) pickerMsg(t(srv === "Ollaya" ? "pkOllayaOrigins" : "pkOriginBlocked", srv), originsCmd(srv));
    else if (e.kind === "origin") pickerMsg(e.message, jevServeCmd(pk.s.aiBaseUrl, "--allow-any-host"));
    else if (jevDown(pk.s, e)) pickerMsg(t("pkJevDown", hostOf(pk.s.aiBaseUrl)), jevServeCmd(pk.s.aiBaseUrl));
    else if (e.kind === "auth") pickerMsg(t("pkNeedKey"));
    else pickerMsg(t("pkLoadFailed", e.message));
    return;
  }
  const items = pickerItems();
  if (!pk.models.length) {
    if (pk.s.provider === "ollama") pickerMsg(t("pkNoOllamaModels"), "ollama pull llama3.2:3b");
    else if (isOllayaServer(pk.s)) pickerMsg(t("pkNoOllayaModels"), "ollaya pull " + OLLAYA.model);
    else if (pk.s.provider === "decision" && decisionApi(pk.s) === "letters") pickerMsg(t("pkNoLmDecision"), "chaoliangUNSW/Jev-Style-Qwen3.5-2B-Decision-GGUF");
    else pickerMsg(t("pkNoModels"));
    return;
  }
  if (!items.length) { pickerMsg(t("pkNoHits")); return; }
  const n = rows.length;
  const frag = document.createDocumentFragment();
  for (const m of items) {
    const it = document.createElement("div");
    it.className = "pk-item" + (m.id === pk.sel ? " sel" : "");
    it.setAttribute("role", "option");
    it.setAttribute("aria-selected", m.id === pk.sel ? "true" : "false");
    it.dataset.id = m.id;
    const radio = document.createElement("span");
    radio.className = "pk-radio";
    const main = document.createElement("div");
    main.className = "pk-main";
    const nm = document.createElement("div"); nm.className = "pk-name"; nm.textContent = m.name || m.id;
    const idEl = document.createElement("div"); idEl.className = "pk-id"; idEl.textContent = m.id;
    main.append(nm, idEl);
    if (m.description) { const d = document.createElement("div"); d.className = "pk-desc"; d.textContent = m.description; main.appendChild(d); }
    const meta = document.createElement("div");
    meta.className = "pk-meta";
    const pill = (txt, c) => { const p = document.createElement("span"); p.className = "pill" + (c ? " " + c : ""); p.textContent = txt; meta.appendChild(p); };
    if (m.local) pill(t("pillLocal"), "local");
    else if (m.free) pill(t("free"), "free");
    else if (m.pricePrompt != null) pill(t("pillPaid"), "paid");
    if (m.params) pill((m.local ? "" : "~") + m.params + (m.quant ? " · " + m.quant : ""));
    if (m.sizeBytes) pill(fmtSize(m.sizeBytes));
    if (m.contextLength) pill(ctxLabel(m.contextLength));
    if (m.jsonMode && pk.s.provider === "openai") { pill(t("pillJson"), "json"); meta.lastChild.title = t("pillJsonTitle"); }
    if (!m.local && /:free$/.test(m.id)) pill(t("pillFreeRate"));
    if (meta.childNodes.length) main.appendChild(meta);
    const price = document.createElement("div");
    price.className = "pk-price";
    const b = document.createElement("b");
    const sp = document.createElement("span");
    if (m.local) { b.textContent = fmtUsd(0, 0); sp.textContent = t("runsLocally"); }
    else if (m.free) { b.textContent = fmtUsd(0, 0); sp.textContent = t("freeLower"); }
    else if (m.pricePrompt != null) {
      b.textContent = fmtPerMillion(m.pricePrompt);
      sp.textContent = t("perMTokShort");
      const c = estimateCost(m, { ...pk.s, aiModel: m.id }, 1000);
      if (c != null) {
        const e = document.createElement("span");
        e.className = "pk-est";
        e.textContent = t("perThousandMails", fmtCostApprox(c));
        if (n) e.title = t("costForFolder", fmtCostApprox(estimateCost(m, { ...pk.s, aiModel: m.id }, n)), tn("mails", n));
        price.append(b, sp, e);
      }
    } else { b.textContent = "–"; sp.textContent = t("priceUnknown"); }
    if (!price.childNodes.length) price.append(b, sp);
    it.append(radio, main, price);
    it.addEventListener("click", () => { pk.sel = m.id; renderPickerSelection(); });
    it.addEventListener("dblclick", () => { pk.sel = m.id; applyPicker(); });
    frag.appendChild(it);
  }
  list.appendChild(frag);
}
function renderPickerSelection() {
  $("pkList").querySelectorAll(".pk-item").forEach((el) => {
    const on = el.dataset.id === pk.sel;
    el.classList.toggle("sel", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
    if (on) el.scrollIntoView({ block: "nearest" });
  });
  $("pkApply").disabled = !pk.sel;
  $("pkSel").textContent = pk.sel ? t("selectedModel", pk.sel) : "";
}
function movePickerSel(delta) {
  const items = [...$("pkList").querySelectorAll(".pk-item[data-id]")];
  if (!items.length) return;
  let i = items.findIndex((el) => el.dataset.id === pk.sel);
  i = Math.max(0, Math.min(items.length - 1, (i < 0 ? -1 : i) + delta));
  pk.sel = items[i].dataset.id;
  renderPickerSelection();
}
function applyPicker() {
  if (!pk.sel || !draft) return;
  const m = pk.models.find((x) => x.id === pk.sel);
  const prov = pk.s.provider;
  draft.profiles[prov].model = pk.sel;
  if (m) {
    draft.modelInfo[prov] = {
      id: m.id, pricePrompt: m.pricePrompt, priceCompletion: m.priceCompletion, free: m.free, local: m.local,
      contextLength: m.contextLength, params: m.params, quant: m.quant, sizeBytes: m.sizeBytes,
      jsonMode: Boolean(m.jsonMode), textOut: m.textOut !== false
    };
  }
  closePicker();
  if (draft.provider === prov) $("mModel").value = pk.sel;
  renderSettings();
  settingsStatus(t("modelApplied"));
}

/* ================================================================== */
/* Columns: width & order                                              */
/* ================================================================== */
function startResize(e, key, th) {
  e.preventDefault();
  e.stopPropagation();
  th.draggable = false;
  const startX = e.clientX;
  const startW = colW(key) || th.getBoundingClientRect().width;
  const colIdx = columnOrder.indexOf(key) + 1;
  function onMove(ev) {
    const w = Math.max(60, Math.round(startW + (ev.clientX - startX)));
    columnWidths[key] = w;
    const col = $("colGroup").children[colIdx];
    if (col) col.style.width = w + "px";
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    th.draggable = true;
    renderColgroup();
    saveSettings({ columnWidths }).then((s) => { settings = s; });
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}
function onColDragStart(e, key, th) {
  dragCol = key;
  th.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  try { e.dataTransfer.setData("text/plain", key); } catch (_) {}
}
function onColDragOver(e, key, th) {
  if (!dragCol || dragCol === key) return;
  e.preventDefault();
  const rect = th.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  th.classList.toggle("drop-before", before);
  th.classList.toggle("drop-after", !before);
}
function onColDrop(e, key, th) {
  e.preventDefault();
  th.classList.remove("drop-before", "drop-after");
  if (!dragCol || dragCol === key) return;
  const rect = th.getBoundingClientRect();
  const before = (e.clientX - rect.left) < rect.width / 2;
  const order = columnOrder.filter((k) => k !== dragCol);
  let idx = order.indexOf(key);
  if (!before) idx += 1;
  order.splice(idx, 0, dragCol);
  columnOrder = order;
  saveSettings({ columnOrder }).then((s) => { settings = s; });
  render();
}
function onColDragEnd() {
  dragCol = null;
  document.querySelectorAll(".th-col").forEach((x) => x.classList.remove("dragging", "drop-before", "drop-after"));
}

/* ================================================================== */
/* Sidebar                                                             */
/* ================================================================== */
function applySidebarState() {
  const collapsed = Boolean(settings.sidebarCollapsed);
  document.querySelector(".sidebar").classList.toggle("collapsed", collapsed);
  const btn = $("sidebarToggle");
  btn.title = collapsed ? t("sidebarShow") : t("sidebarHide");
  btn.setAttribute("aria-pressed", collapsed ? "true" : "false");
  requestAnimationFrame(() => renderWindow(true));
}
async function toggleSidebar() {
  settings = await saveSettings({ sidebarCollapsed: !settings.sidebarCollapsed });
  applySidebarState();
}

/* ================================================================== */
/* Keyboard                                                            */
/* ================================================================== */
const DIALOG_CLOSERS = {
  previewBackdrop: () => closePreview(),
  settingsBackdrop: () => closeSettings(),
  pickerBackdrop: () => closePicker(),
  moveBackdrop: () => closeMoveModal(),
  confirmBackdrop: () => resolveConfirm(false),
  helpBackdrop: () => closeDialog("helpBackdrop")
};
function onKeyDown(e) {
  const tg = e.target;
  const inField = tg && tg.closest && tg.closest("input, textarea, select, [contenteditable='true']");
  const onButton = tg && tg.closest && tg.closest("button, summary");
  const top = topDialog();

  if (e.key === "Tab" && top) { trapTab(e); return; }
  if (!$("ctxMenu").classList.contains("hidden")) {
    if (e.key === "Escape") { hideCtx(); e.preventDefault(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const items = [...$("ctxMenu").querySelectorAll("button")];
      let i = items.indexOf(document.activeElement);
      i = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[i].focus();
      e.preventDefault();
    }
    return;
  }
  if (e.key === "Escape") {
    if (top) { DIALOG_CLOSERS[top](); e.preventDefault(); return; }
    if (tg === $("searchBox") && $("searchBox").value) { $("searchBox").value = ""; searchText = ""; render(); e.preventDefault(); return; }
    if (selected.size) { clearSelection(); e.preventDefault(); }
    else if (activeGroup != null) { clearListFilter(); e.preventDefault(); }
    return;
  }
  if (e.altKey) return;

  if (top === "previewBackdrop") {
    if (inField || e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowRight" || e.key === "j") { navPreview(1); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "k") { navPreview(-1); e.preventDefault(); }
    else if (e.key === "ArrowDown") { $("pvBody").scrollBy({ top: 60 }); e.preventDefault(); }
    else if (e.key === "ArrowUp") { $("pvBody").scrollBy({ top: -60 }); e.preventDefault(); }
    else if (e.key === "Delete" || e.key === "Backspace") { previewDelete(); e.preventDefault(); }
    else if (e.key === "n" || e.key === "N") { previewNotSpam(); e.preventDefault(); }
    else if (e.key === "u" || e.key === "U") { unsubscribe(byId(pvId), $("pvUnsub")); e.preventDefault(); }
    else if (e.key === " " && !onButton) { closePreview(); e.preventDefault(); }
    return;
  }
  if (top === "pickerBackdrop") {
    if (e.key === "ArrowDown") { movePickerSel(1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { movePickerSel(-1); e.preventDefault(); }
    else if (e.key === "Enter" && !onButton) { applyPicker(); e.preventDefault(); }
    return;
  }
  if (top) return;
  if (inField) return;

  if ((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A")) { onSelectAllChange(true); e.preventDefault(); return; }
  if (e.metaKey || e.ctrlKey) return;
  const inSidebar = tg && tg.closest && tg.closest(".sidebar");
  switch (e.key) {
    case "/": $("searchBox").focus(); $("searchBox").select(); e.preventDefault(); break;
    case "?": openDialog("helpBackdrop"); e.preventDefault(); break;
    case "ArrowDown": case "j": if (!inSidebar) { moveFocus(1, e.shiftKey); $("tableWrap").focus({ preventScroll: true }); e.preventDefault(); } break;
    case "ArrowUp": case "k": if (!inSidebar) { moveFocus(-1, e.shiftKey); $("tableWrap").focus({ preventScroll: true }); e.preventDefault(); } break;
    case "Home": if (!inSidebar && view.length) { moveFocus(-view.length, e.shiftKey); e.preventDefault(); } break;
    case "End": if (!inSidebar && view.length) { moveFocus(view.length, e.shiftKey); e.preventDefault(); } break;
    case "x": case "X": if (focusId != null) { toggleSelect(focusId, !selected.has(focusId)); anchorId = focusId; e.preventDefault(); } break;
    case "u": case "U":
      if (focusId != null) { const tr = rowEl(focusId); unsubscribe(byId(focusId), tr && tr.querySelector(".nl-tag")); e.preventDefault(); }
      break;
    case "Enter": case " ":
      if (onButton || inSidebar) break;
      { const id = focusId != null && rowIndex.has(focusId) ? focusId : (view[0] || {}).id; if (id != null) { openPreview(id); e.preventDefault(); } }
      break;
    case "Delete": case "Backspace":
      if (inSidebar) break;
      if (selected.size) deleteIds([...selected]); else if (focusId != null) deleteIds([focusId]);
      e.preventDefault();
      break;
  }
}

/* ================================================================== */
/* Events                                                              */
/* ================================================================== */
function wireEvents() {
  $("sidebarToggle").addEventListener("click", toggleSidebar);
  $("reloadBtn").addEventListener("click", loadMessages);
  $("includeSub").addEventListener("change", async (e) => {
    settings = await saveSettings({ includeSubfolders: e.target.checked });
    loadMessages();
  });
  let searchTimer = 0;
  $("searchBox").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const v = e.target.value.trim();
    searchTimer = setTimeout(() => { searchText = v; render(); }, 120);
  });

  // selection bar
  $("deleteBtn").addEventListener("click", () => deleteIds([...selected]));
  $("moveBtn").addEventListener("click", () => openMoveModal());
  $("trustBtn").addEventListener("click", () => trustRows([...selected].map(byId).filter(Boolean)));
  $("clearSelBtn").addEventListener("click", clearSelection);
  $("selVisibleOnly").addEventListener("click", () => {
    const vis = new Set(view.map((r) => r.id));
    for (const id of [...selected]) if (!vis.has(id)) selected.delete(id);
    updateSelectionUI();
  });

  // filter
  document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => setSpamFilter(PRESETS[c.dataset.preset])));
  const onRange = (which) => () => {
    let lo = Number($("spamMin").value), hi = Number($("spamMax").value);
    if (lo > hi) { if (which === "min") hi = lo; else lo = hi; $("spamMin").value = lo; $("spamMax").value = hi; }
    spamFilter = lo === 0 && hi === 100 ? { ...PRESETS.all } : { mode: "range", lo, hi };
    updateRangeUI();
    render();
  };
  $("spamMin").addEventListener("input", onRange("min"));
  $("spamMax").addEventListener("input", onRange("max"));
  wireRangePointer();
  $("selectFilteredBtn").addEventListener("click", selectFiltered);
  $("trashFilteredBtn").addEventListener("click", () => deleteIds(view.map((r) => r.id)));

  // groups (event delegation)
  const groupClick = (li, actEl) => {
    if (li.classList.contains("clear-item")) { activeGroup = null; render(); return; }
    const key = li.dataset.key;
    if (actEl && actEl.dataset.act === "sel") return selectGroup(key);
    if (actEl && actEl.dataset.act === "del") return deleteGroup(key);
    activeGroup = activeGroup === key ? null : key;
    render();
  };
  $("groupList").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li) groupClick(li, e.target.closest("[data-act]"));
  });
  $("groupList").addEventListener("keydown", (e) => {
    const li = e.target.closest("li");
    if (li && e.target === li && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); groupClick(li, null); }
  });
  document.querySelectorAll(".seg-btn[data-group]").forEach((b) => b.addEventListener("click", () => {
    groupMode = b.dataset.group;
    activeGroup = null;
    syncGroupSegs();
    render();
  }));
  $("filterChipClear").addEventListener("click", clearListFilter);

  // scan
  $("scanBtn").addEventListener("click", onScanClick);
  $("stopBtn").addEventListener("click", stopScan);
  $("bannerClose").addEventListener("click", hideBanner);

  // onboarding & help
  $("obSetup").addEventListener("click", () => openSettings());
  $("obKey").addEventListener("click", () => openExternal("https://openrouter.ai/keys"));
  $("helpBtn").addEventListener("click", () => openDialog("helpBackdrop"));
  $("hpClose").addEventListener("click", () => closeDialog("helpBackdrop"));
  bindBackdropClose($("helpBackdrop"), () => closeDialog("helpBackdrop"));
  $("modelChip").addEventListener("click", () => openSettings());

  // settings
  $("settingsBtn").addEventListener("click", () => openSettings());
  $("setClose").addEventListener("click", closeSettings);
  $("mCancel").addEventListener("click", closeSettings);
  bindBackdropClose($("settingsBackdrop"), closeSettings);
  document.querySelectorAll(".prov").forEach((b) => b.addEventListener("click", () => switchKind(b.dataset.kind)));
  $("presetSelect").addEventListener("change", (e) => selectSource(e.target.value));
  $("mApiKey").addEventListener("input", () => {
    const st = keyState($("mBaseUrl").value.trim());
    if (!st) return;
    st.typed = $("mApiKey").value;
    if (st.typed) st.cleared = false;
  });
  $("mKeyClear").addEventListener("click", () => {
    stashFields();
    const st = keyState(draft.profiles[draft.provider].baseUrl);
    if (st) { st.cleared = true; st.typed = ""; }
    renderSettings();
  });
  $("mKeyLink").addEventListener("click", () => { const u = $("mKeyLink").dataset.url; if (u) openExternal(u); });
  $("mBaseUrl").addEventListener("change", () => { stashFields(); renderSettings(); });
  $("mModel").addEventListener("change", () => { stashFields(); renderSettings(); });
  $("mScanBody").addEventListener("change", () => { stashFields(); renderSettings(); });
  $("mSendCtx").addEventListener("change", () => { stashFields(); renderSettings(); });
  $("mClearCache").addEventListener("click", clearCache);
  $("mChars").addEventListener("change", () => { stashFields(); renderSettings(); });
  $("wlAdd").addEventListener("click", addWlFromInput);
  $("wlInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addWlFromInput(); } });
  $("mPick").addEventListener("click", openPicker);
  $("mSave").addEventListener("click", () => { stashFields(); saveSettingsDialog(requestHostPermission(draft.profiles[draft.provider].baseUrl, draft.provider)); });
  $("mTest").addEventListener("click", () => { stashFields(); testSettings(requestHostPermission(draft.profiles[draft.provider].baseUrl, draft.provider)); });

  // model picker
  $("pkClose").addEventListener("click", closePicker);
  $("pkCancel").addEventListener("click", closePicker);
  $("pkApply").addEventListener("click", applyPicker);
  $("pkReload").addEventListener("click", () => { const perm = requestHostPermission(pk.s.aiBaseUrl, pk.s.provider); perm.then(loadPickerModels); });
  bindBackdropClose($("pickerBackdrop"), closePicker);
  let pkTimer = 0;
  $("pkSearch").addEventListener("input", () => { clearTimeout(pkTimer); pkTimer = setTimeout(renderPicker, 100); });
  $("pkSort").addEventListener("change", renderPicker);
  $("pkFree").addEventListener("change", renderPicker);

  // move
  $("moveClose").addEventListener("click", closeMoveModal);
  $("moveCancel").addEventListener("click", closeMoveModal);
  $("moveConfirm").addEventListener("click", performMove);
  $("newFolderBtn").addEventListener("click", createFolder);
  $("newFolderName").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); createFolder(); } });
  bindBackdropClose($("moveBackdrop"), closeMoveModal);

  // confirmation
  $("cfClose").addEventListener("click", () => resolveConfirm(false));
  bindBackdropClose($("confirmBackdrop"), () => resolveConfirm(false));

  // preview
  $("pvClose").addEventListener("click", closePreview);
  $("pvPrev").addEventListener("click", () => navPreview(-1));
  $("pvNext").addEventListener("click", () => navPreview(1));
  $("pvDelete").addEventListener("click", previewDelete);
  $("pvNotSpam").addEventListener("click", previewNotSpam);
  $("pvUnsub").addEventListener("click", () => unsubscribe(byId(pvId), $("pvUnsub")));
  $("pvTrust").addEventListener("click", () => { const r = byId(pvId); if (r && r.fromAddress) toggleWhitelistValue(r.fromAddress); });
  $("pvOpen").addEventListener("click", () => { const id = pvId; closePreview(); if (id != null) openMessage(id); });
  $("pvMode").querySelectorAll(".seg-btn").forEach((b) => b.addEventListener("click", () => { pvMode = b.dataset.mode; renderPreviewBody(); }));
  bindBackdropClose($("previewBackdrop"), closePreview);

  // table: virtual scrolling
  const wrap = $("tableWrap");
  wrap.addEventListener("scroll", () => {
    hideCtx();
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; renderWindow(false); });
  }, { passive: true });
  if (typeof ResizeObserver === "function") new ResizeObserver(() => renderWindow(true)).observe(wrap);
  else window.addEventListener("resize", () => renderWindow(true));

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousedown", (e) => { if (!e.target.closest("#ctxMenu")) hideCtx(); });
  window.addEventListener("blur", hideCtx);
}

/* ================================================================== */
/* Start                                                               */
/* ================================================================== */
async function init() {
  localizeDocument();
  hydrateIcons();
  settings = await loadSettings();
  [scoreCache, listCache] = await Promise.all([loadScoreCache(), loadListCache()]);
  columnOrder = sanitizeOrder(settings.columnOrder);
  columnWidths = { ...(settings.columnWidths || {}) };
  wireEvents();
  applySidebarState();
  $("includeSub").checked = Boolean(settings.includeSubfolders);
  updateRangeUI();
  updateChrome();
  try {
    await loadAccountsAndFolders();
  } catch (err) {
    showBanner(t("accountsFailed", err.message));
    console.error(err);
    return;
  }
  // #settings (from the add-on options) opens the settings dialog directly
  const checkHash = () => {
    if (location.hash !== "#settings") return;
    history.replaceState(null, "", location.pathname + location.search);
    if (topDialog() !== "settingsBackdrop") openSettings();
  };
  window.addEventListener("hashchange", checkHash);
  checkHash();
  if (!folderNodes.length) { setStatus(t("noAccounts")); return; }
  await loadMessages();
}

init();
