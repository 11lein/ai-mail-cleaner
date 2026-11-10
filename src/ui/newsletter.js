/* Newsletter detection and unsubscribe targets.
 *
 * Sources, in this order:
 *  1. Headers: List-Unsubscribe (RFC 2369), List-Unsubscribe-Post (RFC 8058 one-click),
 *     List-Id, Precedence: bulk/list.
 *  2. If there is no unsubscribe header: links or addresses in the mail text near words like
 *     "unsubscribe" / "abmelden" / "darse de baja" (e.g. "send an email with 'unsubscribe' to …").
 *
 * Everything here comes from untrusted mail content: URLs are restricted to http(s),
 * mailto targets to plain addresses, and the user's own addresses are never used as target.
 */

const UNSUB_RE = /unsubscri|opt[\s-]?out|abmeld|abbestell|austragen|newsletter\s+k(?:ü|ue|u)ndigen|darse\s+de\s+baja|dar(?:te|se)?\s+de\s+baja|date\s+de\s+baja|cancelar\s+(?:la\s+|tu\s+|su\s+)?suscripci|anular\s+(?:la\s+)?suscripci|desuscrib|d[ée]sabonner|d[ée]sinscri/i;
const ADDR_RE = /^[^\s@<>"(),;:]+@[^\s@<>"(),;:]+\.[^\s@<>"(),;:]{2,}$/;
const ADDR_FIND = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const URL_FIND = /https?:\/\/[^\s<>"')\]]+/i;
const MAX_URL = 2048;

function headerMap(full) {
  const out = {};
  const h = full && full.headers;
  if (h && typeof h === "object") {
    for (const [k, v] of Object.entries(h)) out[String(k).toLowerCase()] = (Array.isArray(v) ? v : [v]).join(", ");
  }
  return out;
}

/** http(s) URL or "" */
export function safeHttpUrl(v) {
  try {
    const u = new URL(String(v || "").trim());
    if ((u.protocol === "https:" || u.protocol === "http:") && u.href.length <= MAX_URL) return u.href;
  } catch (_) {}
  return "";
}

/** mailto:… → { to: [addr], subject, body } | null */
export function parseMailto(v) {
  let s = String(v || "").trim();
  if (!/^mailto:/i.test(s) || s.length > MAX_URL) return null;
  s = s.slice(7);
  const q = s.indexOf("?");
  const addrPart = q >= 0 ? s.slice(0, q) : s;
  const to = [];
  const addAddrs = (list) => {
    for (const a of String(list).split(",")) {
      const x = a.trim();
      if (ADDR_RE.test(x)) to.push(x);
    }
  };
  try { addAddrs(decodeURIComponent(addrPart)); } catch (_) { return null; }
  let subject = "", body = "";
  if (q >= 0) {
    for (const pair of s.slice(q + 1).split("&")) {
      const eq = pair.indexOf("=");
      const key = (eq >= 0 ? pair.slice(0, eq) : pair).toLowerCase();
      let val = eq >= 0 ? pair.slice(eq + 1) : "";
      try { val = decodeURIComponent(val); } catch (_) {}
      if (key === "subject") subject = val;
      else if (key === "body") body = val;
      else if (key === "to") addAddrs(val);
    }
  }
  if (!to.length) return null;
  return { to: [...new Set(to)].slice(0, 3), subject: subject.slice(0, 200), body: body.slice(0, 1000) };
}

function findInText(text, own) {
  const s = String(text || "").slice(0, 300000);
  const re = new RegExp(UNSUB_RE.source, "gi");
  let url = "", mail = "", m;
  while ((m = re.exec(s)) && !(url && mail)) {
    const after = s.slice(m.index, m.index + 260);
    const before = s.slice(Math.max(0, m.index - 180), m.index);
    if (!mail) {
      for (const part of [after, before]) {
        const found = [...part.matchAll(ADDR_FIND)].map((x) => x[0]).find((a) => !own.has(a.toLowerCase()));
        if (found) { mail = `mailto:${found}?subject=unsubscribe`; break; }
      }
    }
    if (!url) {
      const u = after.match(URL_FIND);
      if (u) url = safeHttpUrl(u[0]);
    }
  }
  return { url, mail };
}

function findInHtml(html, own) {
  const doc = new DOMParser().parseFromString(String(html).slice(0, 1500000), "text/html"); // inert
  let url = "", mail = "";
  const consider = (a) => {
    const href = (a.getAttribute("href") || "").trim();
    if (/^mailto:/i.test(href)) {
      const p = parseMailto(href);
      if (!mail && p && !p.to.some((x) => own.has(x.toLowerCase()))) mail = href;
    } else if (!url) {
      url = safeHttpUrl(href);
    }
  };
  const anchors = [...doc.querySelectorAll("a[href]")];
  // 1. link text, title or URL says "unsubscribe"
  for (const a of anchors) {
    const label = `${a.textContent || ""} ${a.getAttribute("title") || ""} ${a.getAttribute("href") || ""}`;
    if (UNSUB_RE.test(label)) consider(a);
  }
  // 2. "To unsubscribe, click here" – the sentence around the link says it
  if (!url && !mail) {
    for (const a of anchors) {
      const ctx = ((a.parentElement && a.parentElement.textContent) || "").slice(0, 400);
      if (UNSUB_RE.test(ctx) && (a.textContent || "").trim().length <= 40) consider(a);
    }
  }
  // 3. address/URL written in the text
  if (!url || !mail) {
    const txt = findInText(doc.body ? doc.body.textContent : "", own);
    if (!mail) mail = txt.mail;
    if (!url && !mail) url = txt.url;
  }
  return { url, mail };
}

/**
 * @param full     result of messages.getFull()
 * @param html     array of text/html bodies
 * @param plain    array of text/plain bodies
 * @param ownAddrs Set of the user's own addresses (lowercase) – never used as target
 * @returns null (not a newsletter) | { url, mail, oneClick, fromBody }
 */
export function extractListInfo(full, html, plain, ownAddrs) {
  const own = ownAddrs || new Set();
  const h = headerMap(full);
  const lu = h["list-unsubscribe"] || "";
  let url = "", mail = "";
  for (const m of lu.matchAll(/<([^>]+)>/g)) {
    const v = m[1].trim();
    if (!url) url = safeHttpUrl(v);
    if (!mail && parseMailto(v)) mail = v;
  }
  const oneClick = Boolean(url) && /one-click/i.test(h["list-unsubscribe-post"] || "");
  let isList = Boolean(lu || h["list-id"] || /^\s*(bulk|list)\s*$/i.test(h.precedence || ""));
  let fromBody = false;
  if (!url && !mail) {
    let found = { url: "", mail: "" };
    for (const x of html || []) { found = findInHtml(x, own); if (found.url || found.mail) break; }
    if (!found.url && !found.mail) {
      for (const x of plain || []) { found = findInText(x, own); if (found.url || found.mail) break; }
    }
    if (found.url || found.mail) { url = found.url; mail = found.mail; isList = true; fromBody = true; }
  }
  if (!isList) return null;
  return { url, mail, oneClick, fromBody, listId: listIdOf(h["list-id"]) };
}

/** "Product News <news.example.com>" → "news.example.com" (lowercase, for grouping) */
export function listIdOf(v) {
  const s = String(v || "");
  const m = s.match(/<([^<>\s]{1,200})>/);
  const id = (m ? m[1] : s).trim().toLowerCase();
  return /^[a-z0-9._@+-]{3,200}$/.test(id) ? id : "";
}

/* Compact cache format (storage.local): 0 = no newsletter, otherwise { u, m, o, b } */
export function packList(info) {
  if (!info) return 0;
  const o = {};
  if (info.url) o.u = info.url;
  if (info.mail) o.m = info.mail;
  if (info.oneClick) o.o = 1;
  if (info.fromBody) o.b = 1;
  if (info.listId) o.l = info.listId;
  return o;
}
export function unpackList(v) {
  if (v === 0) return null;
  if (!v || typeof v !== "object") return undefined; // unknown → probe again
  const url = safeHttpUrl(v.u);
  const mail = parseMailto(v.m) ? String(v.m) : "";
  return { url, mail, oneClick: Boolean(url && v.o), fromBody: Boolean(v.b), listId: listIdOf(v.l ? `<${v.l}>` : "") };
}
