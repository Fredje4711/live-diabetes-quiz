# Live Diabetes Quiz

Anonieme live quiz voor Diabetes Liga Midden-Limburg.

## Onderdelen

- **Quizmaster:** maakt een activiteit en bedient de vragen via een privébeheerlink, ook op een andere computer.
- **Deelnemer:** opent de vaste QR-code of volledige link op het vooraf afgedrukte briefje; geen cijfercode nodig.
- **Groot zaalscherm:** toont dezelfde vraag en antwoorden als de gsm, plus de live aantallen.
- **Deelnemersbriefje:** twee briefjes per A4 met vaste QR-code, volledige deelnemerslink en optionele zaalwifi.
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

Maak eerst een activiteit en bewaar de privébeheerlink. Gebruik daarna in het quizmasterscherm de knop
**Deelnemersbriefjes afdrukken**. De unieke QR-code op het briefje opent
rechtstreeks het deelnemerscherm van die activiteit. Bij een nieuwe ronde blijven
de briefjes geldig en gaan verbonden deelnemers automatisch mee. Alleen
**Activiteit definitief afsluiten** maakt de link onbruikbaar voor verdere deelname.
Voor een andere gelegenheid maakt u een nieuwe activiteit en nieuwe briefjes.
Oude driecijferige sessies blijven ondersteund; hun briefjes worden niet omgezet.

De actuele uitleg staat in `docs/handleiding.html`, met apart `docs/uitleg/oefenen.html`
en `docs/uitleg/organiseren.html`. De behouden video's tonen de oude werkwijze;
op de handleiding staat daarom een waarschuwing bij deze video's.

### Techniek en controle

`activities/{id}` verwijst naar de huidige ronde in `sessions/{id}`. De 256-bit
beheerlink staat niet in het openbare activiteitsdocument. De geheime sleutel
geeft een nieuwe anonieme organisator toestemming om dezelfde activiteit te bedienen.
Sluiten is definitief; oude antwoorden worden niet verwijderd. Deel een beheerlink
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
