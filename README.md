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

## Hinweis

Die aktuelle Umsetzung ist eine produktnahe Frontend-Demo mit gemeinsamem State. Reale Backend-Themen wie DSGVO-konforme Speicherung, echte Altersverifizierung, Mapbox/OpenStreetMap, Stripe, Apple/Google In-App-Kaeufe, Screenshot-Schutz auf nativen Plattformen und KI-Selfie-Abgleich sind hier bewusst als UI- und Flow-Modell vorbereitet, aber noch nicht an produktive Dienste angebunden.
