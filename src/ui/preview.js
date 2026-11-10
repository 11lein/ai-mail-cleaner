/* Safe rendering of mail content (preview) and text extraction.
 *
 * HTML mails are NOT rendered in the privileged extension page but in an
 * <iframe sandbox> without any permissions (no scripts, forms, popups,
 * navigation; opaque origin). In addition:
 *  - a CSP inside the document blocks every remote load (tracking pixels,
 *    remote images/fonts/CSS) – only data: images and inline styles;
 *  - a sanitizer removes scripts, frames, forms, meta refresh and on* handlers,
 *    replaces remote images with placeholders and disables links – but shows
 *    their real target (phishing hint when the link text names another domain);
 *  - getFull does not mark the mail as read.
 */
import { t } from "./i18n.js";

export function collectText(part, acc, depth = 0) {
  if (!part || depth > 30) return;
  if (Array.isArray(part.parts) && part.parts.length) { for (const p of part.parts) collectText(p, acc, depth + 1); return; }
  const ct = (part.contentType || "").toLowerCase();
  if (part.body) {
    if (ct.startsWith("text/plain")) acc.plain.push(part.body);
    else if (ct.startsWith("text/html")) acc.html.push(part.body);
  }
}

export function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'");
}

/** Plain-text excerpt of a getFull() result (for scoring). */
export function snippetFrom(full, maxChars) {
  const acc = { plain: [], html: [] };
  collectText(full, acc);
  let text = acc.plain.join("\n").trim();
  if (!text && acc.html.length) text = stripHtml(acc.html.join("\n").slice(0, 400000));
  text = text.replace(/\s+/g, " ").trim();
  return maxChars ? text.slice(0, maxChars) : text;
}

const PV_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'";
const PV_BASE_CSS =
  "html{background:#fff;color:#1f2329}" +
  "body{margin:0;padding:22px 26px 40px;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;overflow-wrap:anywhere}" +
  "img{max-width:100%;height:auto}table{max-width:100%}a{color:#4f46e5;text-decoration:underline;cursor:default}pre{white-space:pre-wrap}" +
  "blockquote{margin:0 0 0 .4em;padding-left:.9em;border-left:3px solid #e5e7eb;color:#555}" +
  ".amc-img{display:inline-block;margin:2px 0;padding:6px 10px;border:1px dashed #cbd5e1;border-radius:6px;background:#f8fafc;color:#64748b;font:12px/1.4 system-ui,sans-serif}" +
  ".amc-host{display:inline-block;margin-left:4px;padding:0 5px;border-radius:4px;background:#eef2ff;color:#4338ca;font:11px/1.6 system-ui,sans-serif;text-decoration:none;vertical-align:1px}" +
  ".amc-warn{background:#fee2e2;color:#b91c1c;font-weight:600}";
const PV_DROP = "script,noscript,iframe,frame,frameset,object,embed,applet,meta,link,base,form,input,button,textarea,select,option,template,portal,audio,video,source,track";
const PV_URL_ATTRS = /^(href|src|action|background|poster|lowsrc|dynsrc|xlink:href|data|srcset)$/;
// SVG animation elements can set attributes later – e.g. turn an <a> back into a link
const PV_ANIM = /^(animate|animatemotion|animatetransform|set|discard)$/;
const HTML_NS = "http://www.w3.org/1999/xhtml";
const PV_MAX = 2000000;

function extractHost(text) {
  const m = String(text || "").toLowerCase().match(/(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?=[\/\s:?#]|$)/);
  return m ? m[1].replace(/^www\./, "") : "";
}
function sameSite(a, b) { return a === b || a.endsWith("." + b) || b.endsWith("." + a); }

function sanitizeMail(html) {
  const doc = new DOMParser().parseFromString(String(html).slice(0, PV_MAX), "text/html"); // inert
  doc.querySelectorAll(PV_DROP).forEach((n) => n.remove());
  for (const el of [...doc.querySelectorAll("*")]) {
    if (el.namespaceURI !== HTML_NS && PV_ANIM.test(el.localName.toLowerCase())) { el.remove(); continue; }
    // only HTML <a> keeps its href for now – it is disabled below, with its target shown. Any other
    // link (<area>, SVG/MathML xlink:href) would still navigate the preview frame on a click.
    const htmlLink = el.namespaceURI === HTML_NS && el.localName === "a";
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || n === "srcdoc" || n === "formaction" || n === "ping" || n === "http-equiv") { el.removeAttribute(a.name); continue; }
      if ((n === "href" || n === "xlink:href") && !htmlLink) { el.removeAttribute(a.name); continue; }
      if (PV_URL_ATTRS.test(n) && /^\s*(javascript|vbscript|data:(?!image\/(png|gif|jpe?g|webp);))/i.test(a.value)) el.removeAttribute(a.name);
    }
  }
  let blocked = 0, trackers = 0;
  for (const img of [...doc.querySelectorAll("img")]) {
    const src = img.getAttribute("src") || "";
    if (/^data:image\//i.test(src)) continue;
    const w = parseInt(img.getAttribute("width"), 10) || 0, h = parseInt(img.getAttribute("height"), 10) || 0;
    if ((w && w <= 3) || (h && h <= 3)) { img.remove(); trackers++; continue; }
    blocked++;
    const ph = doc.createElement("span");
    ph.className = "amc-img";
    const alt = (img.getAttribute("alt") || "").trim();
    ph.textContent = alt ? t("imgBlockedAlt", alt) : t("imgBlocked");
    img.replaceWith(ph);
  }
  for (const a of [...doc.querySelectorAll("a[href]")]) {
    const href = a.getAttribute("href") || "";
    let host = "";
    try { const u = new URL(href); if (/^https?:$/.test(u.protocol)) host = u.hostname.replace(/^www\./, ""); } catch (_) {}
    a.removeAttribute("href");
    a.setAttribute("title", t("linkDisabled", href.slice(0, 300)));
    if (host) {
      const th = extractHost(a.textContent);
      const tag = doc.createElement("span");
      const warn = th && !sameSite(th, host);
      tag.className = "amc-host" + (warn ? " amc-warn" : "");
      tag.textContent = warn ? t("linkLeadsTo", host) : "→ " + host;
      a.after(tag);
    }
  }
  const head = doc.head ? [...doc.head.querySelectorAll("style")].map((s) => s.outerHTML).join("") : "";
  const body = doc.body ? doc.body.innerHTML : "";
  return { head, body, blocked, trackers };
}

export function buildPreviewDoc(html) {
  const s = sanitizeMail(html);
  return {
    doc: '<!doctype html><html><head><meta charset="utf-8">' +
      '<meta http-equiv="Content-Security-Policy" content="' + PV_CSP + '">' +
      "<style>" + PV_BASE_CSS + "</style>" + s.head + "</head><body>" + s.body + "</body></html>",
    blocked: s.blocked,
    trackers: s.trackers
  };
}

export function htmlToText(html) {
  const marked = String(html).slice(0, PV_MAX).replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6]|\/table|\/blockquote|\/section|\/article|\/header|\/footer)\b[^>]*>/gi, "$&\n");
  const doc = new DOMParser().parseFromString(marked, "text/html");
  doc.querySelectorAll("script,style,head,title,noscript,template").forEach((n) => n.remove());
  return ((doc.body && doc.body.textContent) || "")
    .replace(/\r/g, "").replace(/[ \t\f\v ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
