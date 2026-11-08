/* AI Mail Cleaner – Hintergrundskript
 * Öffnet die Oberfläche in einem eigenen Thunderbird-Tab (Toolbar-Button,
 * Erstinstallation, Add-on-Einstellungen) und nutzt einen offenen Tab wieder.
 */

const UI_URL = messenger.runtime.getURL("ui/cleaner.html");
let cleanerTabId = null;

async function findCleanerTab() {
  if (cleanerTabId !== null) {
    try {
      return await messenger.tabs.get(cleanerTabId);
    } catch (_) {
      cleanerTabId = null; // Tab wurde geschlossen
    }
  }
  const tabs = await messenger.tabs.query({});
  return tabs.find((t) => t.url && t.url.startsWith(UI_URL)) || null;
}

async function openCleaner(hash = "") {
  const url = UI_URL + hash;
  const tab = await findCleanerTab();
  if (tab) {
    cleanerTabId = tab.id;
    await messenger.tabs.update(tab.id, hash ? { active: true, url } : { active: true });
    return;
  }
  const created = await messenger.tabs.create({ url });
  cleanerTabId = created.id;
}

messenger.browserAction.onClicked.addListener(() => {
  openCleaner().catch((err) => console.error("AI Mail Cleaner:", err));
});

messenger.tabs.onRemoved.addListener((tabId) => {
  if (tabId === cleanerTabId) cleanerTabId = null;
});

// Nach der Erstinstallation direkt öffnen – das Onboarding führt durch die Einrichtung.
messenger.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") openCleaner().catch((err) => console.error("AI Mail Cleaner:", err));
});

// Add-on-Einstellungen (Add-ons-Manager) → Einstellungsdialog im Cleaner
messenger.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "open-settings") return openCleaner("#settings");
  return undefined;
});
