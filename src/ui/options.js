/* Add-on options in the Add-ons Manager: points to the settings dialog in the
 * cleaner tab (providers, model picker, trusted senders, …). */
import { localizeDocument } from "./i18n.js";

localizeDocument();
document.getElementById("open").addEventListener("click", () => {
  messenger.runtime.sendMessage({ type: "open-settings" }).catch((e) => console.error(e));
});
