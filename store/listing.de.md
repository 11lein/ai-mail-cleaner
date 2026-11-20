# Store-Listing (Deutsch)

## Name
AI Mail Cleaner

## Zusammenfassung (max. 250 Zeichen)
Hilft beim Aufräumen voller Postfächer: Jede Mail bekommt einen Spam-Wert von 0 bis 100 %, Newsletter lassen sich direkt abbestellen, und was weg kann, wandert gesammelt in den Papierkorb. Mit Cloud-Modellen oder lokal.

## Beschreibung

Ich habe mir dieses Add-on gebaut, um mein eigenes Postfach aufzuräumen. Weil es mir hilft,
stelle ich es hier für alle bereit.

Was mich gestört hat: Newsletter, die ich nie abbestellt habe, Werbung und Spam, der am Filter
vorbeigekommen ist. Das Mail für Mail durchzugehen dauert ewig. Jetzt macht ein Modell den ersten
Durchgang, und ich entscheide nur noch.

**Wie es funktioniert**

Du wählst einen Ordner, und das Add-on zeigt alle Mails darin als Liste. Ein Klick auf „Scannen“
schickt Absender, Betreff und auf Wunsch einen kurzen Textausschnitt an ein Modell. Das gibt für
jede Mail einen Spam-Wert von 0 bis 100 % zurück. Dann filterst du zum Beispiel auf
„Spam ≥ 80 %“, schaust kurz drüber und legst alles in den Papierkorb. Wenn du dich vertan hast,
gibt es „Rückgängig“.

Newsletter erkennt das Add-on am List-Unsubscribe-Header oder am Abmeldehinweis im Text. Ein
Klick auf das Newsletter-Etikett öffnet einen kleinen Dialog: abmelden über die Webseite oder per
Mail, und wenn du willst, gleich alle alten Mails dieses Newsletters in den Papierkorb. Sieht die
Mail nach Spam aus, rät das Add-on vom Abmelden ab, weil das oft nur bestätigt, dass deine Adresse
existiert.

**Welches Modell?**

Ich nutze selbst Jev über OpenRouter: schnell und Bruchteile eines Cents pro Mail. Span-01-lite
ist kostenlos, schafft aber nur etwa 20 Mails pro Minute. Wer keine Mail aus dem Haus geben will,
kann alles lokal laufen lassen, mit Ollaya, LM Studio oder Ollama. Normale Sprachmodelle von
OpenAI, Mistral, Groq und anderen gehen auch.

Auf Wunsch bekommt das Modell etwas Kontext mit: ob der Absender in deinem Adressbuch steht, wie
viele Mails von ihm im Ordner liegen und wie viele davon du geöffnet hast. Das hilft bei Mails,
die für sich genommen harmlos aussehen, aber von jemandem kommen, den du nie liest.

**Außerdem**
- Gruppen nach Domain oder Absender, ganze Gruppen auswählen oder löschen
- Filter nach Zeitraum und nur Newsletter, dazu eine Suche
- Absender und Domains, denen du vertraust, werden nie bewertet und nie gesendet
- Vorschau ohne externe Bilder und Tracker
- Modellauswahl mit Preis und geschätzten Kosten pro 1.000 Mails
- Verschieben in Ordner, Tastatursteuerung, hell und dunkel
- Deutsch, Englisch und Spanisch

**Datenschutz**

Es gibt keinen Server von mir, keine Telemetrie und keine Werbung. Daten gehen nur beim Scannen
raus und nur an den Anbieter, den du selbst eingestellt hast. Mit einem lokalen Modell verlässt
nichts deinen Rechner. Endgültig gelöscht wird nie, alles landet im Papierkorb.

Der Quellcode ist offen (MIT-Lizenz) und liegt auf GitHub. Über Fehlermeldungen und Ideen freue
ich mich.

## Kategorie
Message and News Reading (alternativ: Privacy and Security)

## Tags
spam, aufräumen, newsletter, abmelden, ki, ollaya, ollama, openrouter

## Lizenz
MIT
