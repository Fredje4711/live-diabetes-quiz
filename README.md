# Live Diabetes Quiz

Anonieme live quiz voor Diabetes Liga Midden-Limburg.

## Onderdelen

- **Quizmaster:** maakt een sessie en bedient de vragen.
- **Deelnemer:** opent de quiz via QR-code of zescijferige code.
- **Projectie:** toont vragen en resultaten in de zaal.
- **GitHub Pages:** publiceert de statische website uit de map `docs`.
- **Firebase:** verzorgt anonieme toegang en realtime synchronisatie.

Deelnemers geven geen naam of e-mailadres op. Firebase maakt per toestel alleen
een tijdelijk willekeurig nummer aan om dubbele antwoorden tegen te houden.

## Online adressen

Na publicatie:

- Startpagina: `https://fredje4711.github.io/live-diabetes-quiz/`
- Quizmaster: `https://fredje4711.github.io/live-diabetes-quiz/quizmaster.html`
- Deelnemer: `https://fredje4711.github.io/live-diabetes-quiz/deelnemer.html`
- Projectie: `https://fredje4711.github.io/live-diabetes-quiz/projectie.html`

## Beheer

De Firebase-instellingen staan in `firebase.json` en `firestore.rules`.
De beveiligingsregels kunnen worden getest met:

```text
npx firebase-tools@14.22.0 emulators:exec --only firestore "npm.cmd test"
```

Publiceer Firebase-configuratie met:

```text
npx firebase-tools deploy --only auth,firestore:rules
```

De website zelf wordt via GitHub Pages gepubliceerd vanuit de map `docs`.

## Lokale voorganger

De eerdere PHP/SQLite-proefversie blijft lokaal bewaard in
`live-diabetes-quiz`, maar wordt bewust niet naar GitHub geüpload.
