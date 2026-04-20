# AffairGo

AffairGo ist hier als gemeinsame Expo-Webapp und Mobile-App-Demo umgesetzt. Die Landingpage bildet die Website ab, die restlichen Screens die verbundene Webapp. Beide greifen auf denselben zentralen App-Zustand zu.

Geplante Domain: https://www.affair-go.com

## Enthaltene Demo-Bausteine

- Landingpage als Website mit Funktionsschema, Preisen und Sicherheitslogik
- Login mit Spitzname oder E-Mail, Passwort-Reset-Flow und Passwortwechsel
- Registrierung mit 18+-Logik, Fake-Check-Simulation und erstem Onboarding
- Dashboard, Profil, Matching Map, Swipe, Chat, Events, Urlaub und Dienstreise
- Premium-, Gold- und Community-Ideenbox-Logik auf Mockdatenbasis

## Starten

1. Abhaengigkeiten installieren

```bash
npm install
```

2. Web oder App starten

```bash
npm run web
```

```bash
npm run android
```

```bash
npm run ios
```

## Deploy auf Vercel

Wenn das Projekt bereits mit Vercel und dem GitHub-Repo verbunden ist, reicht ein Push auf `main`.

1. Aenderungen committen

```bash
git add .
git commit -m "Update AffairGo"
```

2. Nach GitHub pushen

```bash
git push origin main
```

Vercel startet danach automatisch ein neues Deployment.

Falls das Repo noch nicht in Vercel importiert wurde:

1. Repo zuerst nach GitHub pushen

```bash
git add .
git commit -m "Initial AffairGo deploy"
git push origin main
```

2. Danach in Vercel:

- `Add New -> Project`
- GitHub-Repo `Ramon1710/AffairGo` auswaehlen
- Root Project unveraendert lassen
- Build Command: `npm run build:web`
- Output Directory: `dist`

Optional mit Vercel CLI:

```bash
npm i -g vercel
vercel
vercel --prod
```

## Hinweis

Die aktuelle Umsetzung ist eine produktnahe Frontend-Demo mit gemeinsamem State. Reale Backend-Themen wie DSGVO-konforme Speicherung, echte Altersverifizierung, Mapbox/OpenStreetMap, Stripe, Apple/Google In-App-Kaeufe, Screenshot-Schutz auf nativen Plattformen und KI-Selfie-Abgleich sind hier bewusst als UI- und Flow-Modell vorbereitet, aber noch nicht an produktive Dienste angebunden.
