# Live Diabetes Quiz

Anonieme live quiz voor Diabetes Liga Midden-Limburg.

## Onderdelen

- **Quizmaster:** maakt een activiteit en bedient de vragen via een quizmasterlink, ook op een andere computer.
- **Deelnemer:** opent de vaste QR-code of het webadres op het vooraf afgedrukte briefje. Deelnemers op afstand ontvangen de deelnemerslink via e-mail.
- **Groot zaalscherm:** toont dezelfde vraag en antwoorden als de gsm, plus de live aantallen.
- **Deelnemersbriefje:** twee briefjes per A4 met vaste QR-code, optionele TinyURL-link (anders de oorspronkelijke link) en optionele zaalwifi.
- **GitHub Pages:** publiceert de statische website uit de map `docs`.
- **Firebase:** verzorgt anonieme toegang en realtime synchronisatie.

Deelnemers geven geen naam of e-mailadres op. Firebase maakt per toestel alleen
een tijdelijk willekeurig nummer aan om dubbele antwoorden tegen te houden.

## Online adressen

Na publicatie:

- Startpagina: `https://fredje4711.github.io/live-diabetes-quiz/`
- Quizmaster: `https://fredje4711.github.io/live-diabetes-quiz/quizmaster.html`
- Deelnemer: `https://fredje4711.github.io/live-diabetes-quiz/deelnemer.html`
- Groot zaalscherm: `https://fredje4711.github.io/live-diabetes-quiz/projectie.html`

Maak eerst een activiteit en kies **Deelnemersbriefjes voorbereiden**.
Bewaar eventueel een geteste TinyURL-link en de internetkeuze. Druk de briefjes af
of bewaar eerst een PDF; bevestig pas na het werkelijk afdrukken dat de papieren briefjes klaar zijn.
Ga terug en kies **Startbestand voor de quizmaster bewaren**.
Neem het HTML-bestand mee naar de zaal, eventueel via e-mail of USB-stick naar een andere laptop met internet.
Open het bestand en ga naar **In de zaal: ga hier verder**. De voorbereiding hoeft niet opnieuw.
Het bestand haalt de laatste bewaarde gegevens op en hoeft na wijzigingen niet opnieuw gedownload te worden.
De unieke QR-code op het briefje opent
rechtstreeks het deelnemerscherm van die activiteit. Bij een nieuwe ronde blijven
de briefjes geldig en gaan verbonden deelnemers automatisch mee. Alleen
**Activiteit definitief afsluiten** maakt de link onbruikbaar voor verdere deelname.
Voor een andere gelegenheid maakt u een nieuwe activiteit en nieuwe briefjes.
Een korte link mag met of zonder `https://` worden ingevoerd. Op het briefje staat het adres
zonder `https://` of `www.`. Deelnemers typen het in de adresbalk van hun browser, niet in het
zoekvak op de Google-pagina. De QR-code blijft rechtstreeks de oorspronkelijke link gebruiken.
De top 3 op het zaalscherm toont per vraag aantallen en percentage, het juiste antwoord met de
letter en alle drie foute opties met hun letters en aantallen. De berekening gebruikt de ontvangen
antwoorden voor die vraag. Definitief afsluiten toont het bedankscherm; nog een ronde starten niet.

De actuele uitleg staat in `docs/handleiding.html`, met apart `docs/uitleg/oefenen.html`
en `docs/uitleg/organiseren.html`. De korte uitlegvideo (4 minuten en 2 seconden)
toont de huidige quiz en staat op `docs/assets/video/live-diabetes-quiz-uitleg.mp4`.
Dit is de enige aangeboden video; latere wijzigingen worden in deze korte versie verwerkt.

### Techniek en controle

`activities/{id}` verwijst naar de huidige ronde in `sessions/{id}`. De 256-bit
quizmasterlink staat niet in het openbare activiteitsdocument. De geheime sleutel
geeft een nieuwe anonieme organisator toestemming om dezelfde activiteit te bedienen.
Sluiten is definitief; oude antwoorden worden niet verwijderd. Deel een quizmasterlink
nooit met deelnemers. Als zowel de bewaarde link als de bevoegde browser verloren
zijn, is een nieuwe activiteit nodig.

`tests/activity-flow.html?emulator=1` controleert in een lokale webserver (projectroot)
vijftien herstarts, gelijktijdige herstarts, nieuwe browseridentiteit en definitief sluiten.
Gebruik uitsluitend de lokale Auth- en Firestore-emulators hiervoor.

## Beheer

De Firebase-instellingen staan in `firebase.json` en `firestore.rules`.
De beveiligingsregels kunnen worden getest met:

```text
npx firebase-tools@14.22.0 emulators:exec --only firestore "npm.cmd test"
```

Publiceer Firebase-configuratie met:

```text
npx firebase-tools deploy --only firestore:rules --project diabetes-quiz
```

De website zelf wordt via GitHub Pages gepubliceerd vanuit de map `docs`.
