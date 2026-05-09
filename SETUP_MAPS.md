# Setup Maps

## Stack-Anpassung

Dieses Projekt nutzt Expo mit React Native und React Native Web.
Die echte Karte ist deshalb als React-Leaflet-Implementierung fuer Web eingebaut.
Auf nativen Targets bleibt die restliche Matching-Logik erhalten, die echte Leaflet-Karte laeuft aber in der Webansicht.

## Benoetigte Pakete

Im Projektroot installieren:

```bash
npm install leaflet react-leaflet geofire-common
```

## Environment Variable

Fuer diesen Expo-Stack wird folgende Variable verwendet:

```bash
EXPO_PUBLIC_STADIA_API_KEY=dein_oeffentlicher_stadia_tile_key
```

## Beispiel fuer .env

```bash
cp .env.example .env
```

Dann in .env oder .env.local mindestens setzen:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_DATABASE_URL=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
EXPO_PUBLIC_STADIA_API_KEY=dein_oeffentlicher_stadia_tile_key
```

## Wo der Stadia API-Key eingetragen wird

Nur in die lokale oder gehostete Environment-Konfiguration eintragen, nie hart im Frontend-Code:

- lokal: .env oder .env.local
- Vercel oder anderes Hosting: Projekt-Environment-Variable EXPO_PUBLIC_STADIA_API_KEY

Nach jeder Aenderung an .env oder .env.local Expo komplett neu starten, damit der Client die neuen EXPO_PUBLIC-Werte uebernimmt.

Verwendete Tile-URL:

```text
https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=EXPO_PUBLIC_STADIA_API_KEY
```

## Firestore-Struktur

Die Kartenlogik nutzt zwei Ebenen:

1. users/{uid}
   Oeffentliche Profildaten ohne exakte Live-Koordinaten.

2. mapLocations/{uid}
   Oeffentlich lesbare, aber anonymisierte Kartenposition fuer Radiusabfragen.
   Enthalten sind unter anderem:

```json
{
  "userId": "uid123",
  "nickname": "NightPulse",
  "status": "active",
  "visible": true,
  "searchActive": true,
  "online": true,
  "coordinate": {
    "latitude": 50.9389,
    "longitude": 6.9571
  },
  "geohash": "u1hcy...",
  "updatedAt": "server timestamp"
}
```

3. users/{uid}/private/liveLocation
   Nur fuer den Owner lesbare exakte Standortdaten.

## Firebase Deploy-Schritte

1. Abhaengigkeiten im Root installieren

```bash
npm install
```

2. Falls Functions genutzt werden, dort ebenfalls installieren

```bash
cd functions
npm install
cd ..
```

3. Firebase Login und Projektwahl

```bash
firebase login
firebase use <dein-firebase-projekt>
```

4. Firestore Rules deployen

```bash
firebase deploy --only firestore:rules
```

5. Falls du auch Functions oder Storage mit ausrollen willst

```bash
firebase deploy --only firestore:rules,functions,storage
```

## Lokaler Test

1. Pakete installieren

```bash
npm install leaflet react-leaflet geofire-common
```

2. .env oder .env.local anlegen und EXPO_PUBLIC_STADIA_API_KEY setzen

3. Expo-Webserver starten

```bash
npm run web
```

4. Im Browser einloggen

5. Auf Matching Map wechseln

6. Standortfreigabe im Browser erlauben

7. Pruefen:

- die Leaflet-Karte laedt echte Stadia-Tiles
- dein Standort wird lokal exakt verwendet
- andere Nutzer erscheinen als Marker nur anonymisiert
- Klick auf Marker oeffnet Popup mit Spitzname, Alter, Matching-Prozent, Entfernung und Status
- Events erscheinen ebenfalls als Marker
- ohne API-Key erscheint die Fallback-Meldung statt einer kaputten Karte

## Launch-Blocker

Fuer produktive Karten brauchst du weiterhin:

- ein Firebase-Projekt mit ausgerollten Rules
- einen oeffentlichen Stadia Maps Tile-Key
- reale Firestore-Profildaten und mapLocations-Eintraege
- korrekt gesetzte Expo-Web-Environment-Variablen im Hosting
