/* Schlichtes, eigenes SVG-Strich-Icon-Set (24er Raster, currentColor).
 * Ersetzt Emojis für ein konsistentes, scharfes Erscheinungsbild.
 * Die Pfade sind statische Konstanten (keine Nutzerdaten); sie werden einmal
 * per DOMParser geparst, gecacht und danach nur noch geklont.
 */
const SVG_NS = "http://www.w3.org/2000/svg";

const P = {
  inbox: '<path d="M3 13h4.5l1.5 2.5h6l1.5-2.5H21"/><path d="M5.6 5h12.8L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  "folder-move": '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M9 13.5h6M12.5 11l2.5 2.5-2.5 2.5"/>',
  send: '<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  pencil: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 6.5l3 3"/>',
  file: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/>',
  trash: '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l.9 12a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12"/><path d="M10 11v6M14 11v6"/>',
  archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.2"/><path d="M5 8.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5"/><path d="M10 12.5h4"/>',
  ban: '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
  at: '<circle cx="12" cy="12" r="3.6"/><path d="M15.6 12v1.4a2.4 2.4 0 0 0 4.8 0V12a8.4 8.4 0 1 0-3.3 6.7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  sliders: '<path d="M4 7h8.5M16.5 7H20M4 12h2.5M10.5 12H20M4 17h10.5M18.5 17H20"/><circle cx="14.5" cy="7" r="2"/><circle cx="8.5" cy="12" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  sparkles: '<path d="M11 3.5l1.6 4.4 4.4 1.6-4.4 1.6L11 15.5l-1.6-4.4L5 9.5l4.4-1.6z"/><path d="M18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2" fill="currentColor" stroke="none"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4v4.5H15"/>',
  "panel-left": '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
  "chevron-right": '<path d="M9.5 6l6 6-6 6"/>',
  "chevron-left": '<path d="M14.5 6l-6 6 6 6"/>',
  "chevron-down": '<path d="M6 9.5l6 6 6-6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  newspaper: '<path d="M4.5 5.5h11v12.5a2 2 0 0 0 2 2H6.5a2 2 0 0 1-2-2z"/><path d="M15.5 9h3.5v9a2 2 0 0 1-2 2"/><path d="M7.5 9h5M7.5 12.5h5M7.5 16h3.5"/>',
  "log-out": '<path d="M9.5 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.5"/><path d="M15.5 16.5 20 12l-4.5-4.5M20 12H9.5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18.5 14v4.5a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5V7a1.5 1.5 0 0 1 1.5-1.5H10"/>',
  funnel: '<path d="M4 5h16l-6.2 7.4V18l-3.6 1.8v-7.4z"/>',
  "check-square": '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.4 2.4 4.8-5"/>',
  shield: '<path d="M12 3.5l7 2.8v5.2c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6.3z"/>',
  "shield-check": '<path d="M12 3.5l7 2.8v5.2c0 4.6-3 7.8-7 9-4-1.2-7-4.4-7-9V6.3z"/><path d="M9 12l2.1 2.1L15.2 10"/>',
  "arrow-up": '<path d="M12 18.5v-13M6.5 11L12 5.5 17.5 11"/>',
  "arrow-down": '<path d="M12 5.5v13M6.5 13L12 18.5 17.5 13"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M4 7.5l8 5.5 8-5.5"/>',
  paperclip: '<path d="M20 11.6l-7.9 7.9a4.9 4.9 0 0 1-6.9-6.9l8.3-8.3a3.3 3.3 0 0 1 4.6 4.6l-8.2 8.2a1.6 1.6 0 0 1-2.3-2.3l7.4-7.4"/>',
  cloud: '<path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.4 9.2 4.7 4.7 0 0 0 7 18.5z"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.5"/><path d="M3.5 7v4c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V7"/><path d="M9.5 16.4c.9.4 2.1.6 3.5.6 3 0 5.5-1.1 5.5-2.5v-4"/><path d="M14.6 10.4C17 10.6 18.5 11.5 18.5 12.5"/>',
  "hard-drive": '<rect x="3.5" y="13" width="17" height="6.5" rx="2"/><path d="M5.5 13l2.2-6.6A2 2 0 0 1 9.6 5h4.8a2 2 0 0 1 1.9 1.4L18.5 13M16.5 16.3h.1M13.5 16.3h.1"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8.5-8.5M16 7l2.5 2.5M18.5 4.5l2 2"/>',
  "list-check": '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="M3.5 6.5l1.5 1.5 2.5-2.5M3.5 12l1.5 1.5L7.5 11M3.5 17.5l1.5 1.5 2.5-2.5"/>',
  "image-off": '<path d="M4 4l16 16"/><path d="M20.5 16.5V6a2 2 0 0 0-2-2H8M3.5 7v11a2 2 0 0 0 2 2H17"/><path d="M3.5 16l4.5-4.5 3 3M14 11l1.5-1.5 5 5"/>',
  rocket: '<path d="M14.5 4.5c2.6-.9 4.6-.8 5 .1.4.4.5 2.4-.4 5L13 16.7 7.3 11z"/><path d="M7.3 11L4.5 10.4l2.6-3.1 4.6.4M13 16.7l.6 2.8 3.1-2.6-.4-4.6M8.5 15.5c-1.5.2-3 1.6-3.5 4 2.4-.5 3.8-2 4-3.5"/>',
  gear: '<circle cx="12" cy="12" r="5.6"/><circle cx="12" cy="12" r="2.1"/><path d="M12 3.4v2.1M12 18.5v2.1M3.4 12h2.1M18.5 12h2.1M5.9 5.9l1.5 1.5M16.6 16.6l1.5 1.5M5.9 18.1l1.5-1.5M16.6 7.4l1.5-1.5" stroke-width="2.6"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.8.8c0 1.7-2.4 2.1-2.4 3.7M12 16.9v.1"/>',
  undo: '<path d="M8.5 7L4 11.5 8.5 16"/><path d="M4.5 11.5h10a5 5 0 0 1 0 10H12"/>',
  alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.4M12 17.1v.1"/>',
  "check-circle": '<circle cx="12" cy="12" r="8.5"/><path d="M8.3 12.3l2.5 2.5 5-5.3"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5z"/>',
  keyboard: '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M6.5 10h.1M10 10h.1M13.5 10h.1M17 10h.1M7.5 14h9"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

// Vorlagen-Cache: jedes Icon wird nur einmal geparst und danach geklont
// (spürbar schneller bei Tausenden Tabellenzeilen).
const cache = new Map();
function template(name) {
  let tpl = cache.get(name);
  if (!tpl) {
    tpl = document.createElementNS(SVG_NS, "svg");
    tpl.setAttribute("viewBox", "0 0 24 24");
    tpl.setAttribute("fill", "none");
    tpl.setAttribute("stroke", "currentColor");
    tpl.setAttribute("stroke-width", "1.8");
    tpl.setAttribute("stroke-linecap", "round");
    tpl.setAttribute("stroke-linejoin", "round");
    tpl.setAttribute("aria-hidden", "true");
    tpl.setAttribute("focusable", "false");
    // statische Konstante (siehe oben) – inert per DOMParser statt innerHTML
    const parsed = new DOMParser().parseFromString(
      `<svg xmlns="${SVG_NS}">${P[name] || P.folder}</svg>`, "image/svg+xml");
    for (const n of [...parsed.documentElement.childNodes]) tpl.appendChild(document.importNode(n, true));
    cache.set(name, tpl);
  }
  return tpl;
}

/** SVG-Icon als DOM-Element. */
export function icon(name, size = 16, cls = "") {
  const svg = template(name).cloneNode(true);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("class", ("ico " + cls).trim());
  return svg;
}

/** Ersetzt <span data-icon="name"> im statischen HTML durch SVG-Icons. */
export function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.querySelector("svg")) return;
    el.classList.add("ico-wrap");
    el.appendChild(icon(el.dataset.icon, Number(el.dataset.size) || 16));
  });
}
