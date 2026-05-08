# Night-Whisper

Night-Whisper ist hier als gemeinsame Expo-Webapp und Mobile-App umgesetzt. Ziel ist eine produktionsreife Anwendung fuer Web und Mobilgeraete. Die Landingpage bildet die Website ab, die restlichen Screens die verbundene Webapp. Beide greifen auf denselben zentralen App-Zustand zu.

Produktive Domain: https://night-whisper.com

## Pflicht-Hinweis Fuer Produktivreife

Sobald fuer eine Funktion eine externe Registrierung, ein API-Key, ein Produktkonto oder eine Plattform-Freigabe noetig ist, muss das direkt vor der Umsetzung geklaert werden.

Diese Anwendung ist noch nicht voll produktionsreif. Vor dem echten Livegang muessen externe Dienste verbindlich registriert, API-Schluessel hinterlegt, Serverprozesse abgesichert und Datenschutz- sowie Kaufprozesse final umgesetzt werden.

## Aktueller Funktionsstand

- Landingpage als Website mit Funktionsschema, kostenfreiem Zugang und Sicherheitslogik
- Login mit Spitzname oder E-Mail, Passwort-Reset-Flow und Passwortwechsel
- Registrierung mit 18+-Logik und erstem Onboarding
- Dashboard, Profil, Matching Map, Swipe, Chat, Events, Urlaub und Dienstreise
- Screenshot-Schutz fuer sensible Screens auf Web und nativ
- Kostenfrei freigeschaltete Vollfunktionen und Community-Ideenbox-Logik

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

## Registrierungen und APIs vor Livegang

Diese Liste ist als Erinnerung gedacht, welche externen Konten und API-Zugaenge noch fuer den produktiven Betrieb benoetigt werden.

Pflichtregistrierungen fuer einen echten Launch:

1. Firebase Console
Registrierung: https://console.firebase.google.com/
Benötigt fuer: Auth, Firestore, produktive Sicherheitsregeln, ggf. Storage, ggf. Functions
Noch einzutragen oder zu pruefen: produktive Firestore-Regeln, Auth-Domain, E-Mail-Templates, Storage-Regeln, ggf. Cloud Functions, produktive `.env`-Werte fuer Firebase

2. Stadia Maps
Registrierung: https://stadiamaps.com/
Benötigt fuer: Kartenkacheln fuer die produktionsfaehige Leaflet-Matching-Map auf Web
Noch einzutragen: oeffentlicher Stadia Tile-Key
Empfohlene Env-Variable: `EXPO_PUBLIC_STADIA_API_KEY=...`

3. Apple Developer Program und App Store Connect
Registrierung: https://developer.apple.com/programs/ und https://appstoreconnect.apple.com/
Benötigt fuer: spaeteres iOS-Release, In-App-Kaeufe auf iOS, Store-Deployment
Noch einzutragen: Produkt-IDs, Store-Konfiguration, serverseitige Kaufpruefung

4. Google Play Console
Registrierung: https://play.google.com/console/
Benötigt fuer: spaeteres Android-Release, In-App-Kaeufe auf Android, Store-Deployment
Noch einzutragen: Produkt-IDs, Billing-Konfiguration, serverseitige Kaufpruefung

5. Vercel
Registrierung: https://vercel.com/signup
Benötigt fuer: produktives Web-Hosting, Environment Variables, Deployment-Management
Noch einzutragen: Produktions-Domain, Build- und Runtime-Variablen, Deployment-Schutz

6. Domain-Provider und DNS
Benötigt fuer: produktive Domain, SSL, Subdomains, Mail-Setup
Noch einzurichten: DNS fuer Web, API, Verifizierungs-Mails und ggf. Deep Links

7. Verifizierungs- und Sicherheitsdienste
Noch auszuwählen und zu integrieren: Selfie-/Fake-Check, AWS Face Liveness fuer Profilbilder sowie Missbrauchs- und Moderationslogik

8. AWS fuer Profilbild-Fakecheck
Registrierung: https://aws.amazon.com/
Benötigt fuer: Rekognition Face Liveness, CompareFaces, kurzlebige AWS-Credentials fuer den Liveness-Webflow, Secret-Management fuer Firebase Functions
Noch einzutragen: AWS_COGNITO_IDENTITY_POOL_ID fuer den Webflow sowie die Rekognition-Berechtigungen in eu-central-1. Die Langzeit-Secrets liegen bereits in Firebase Functions Secrets.

Konkreter Registrierungsbedarf fuer den jetzt vorbereiteten Selfie- und KI-Fake-Check:
- Du brauchst einen Liveness-/Anti-Spoof-/Deepfake-Anbieter oder ein eigenes Backend, das Profilbild und Live-Selfie an einen solchen Dienst weiterleitet.
- Danach muessen in `.env.local` mindestens `EXPO_PUBLIC_SELFIE_VERIFICATION_BASE_URL` und optional `EXPO_PUBLIC_SELFIE_VERIFICATION_PUBLIC_TOKEN` gesetzt werden.
- Der Client ruft anschliessend `POST {BASE_URL}/verify-selfie` mit Profilbild, Live-Selfie, E-Mail und Spitzname auf.

Konkreter Registrierungsbedarf fuer den jetzt eingebauten AWS-Profilbild-Fakecheck:
- Du brauchst Firebase Cloud Functions auf dem Blaze-Plan sowie ein AWS-Konto in eu-central-1.
- Die Langzeit-Secrets liegen nur in Firebase Functions Secrets, nie im Expo-Client.
- Fuer den eigentlichen AWS Face Liveness Capture-Schritt braucht die App eine AWS Cognito Identity Pool Konfiguration fuer kurzlebige Browser-Credentials. Im Repo ist bereits eine eingebaute Route unter `/api/profile-photo-liveness` vorbereitet; optional kann sie ueber `EXPO_PUBLIC_PROFILE_PHOTO_LIVENESS_WEB_URL` überschrieben werden.
- Die verwendete Cognito-Rolle fuer den Browser-Flow braucht laut AWS-Liveness-Setup mindestens die IAM-Berechtigung `rekognition:StartFaceLivenessSession`.
- CompareFaces, das finale Freigeben des Profilbilds und das Loeschen von Temp-Dateien laufen serverseitig in Firebase Functions.

Konkreter Registrierungsbedarf fuer das jetzt vorbereitete Abuse-, Moderations- und Fraud-Backend:
- Du brauchst ein eigenes Moderations-Backend oder einen Anbieter fuer Trust & Safety, Rate-Limits, Fraud-Signale und Fallbearbeitung.
- Danach muessen in `.env.local` mindestens `EXPO_PUBLIC_MODERATION_BASE_URL` und optional `EXPO_PUBLIC_MODERATION_PUBLIC_TOKEN` gesetzt werden.
- Der Client ruft anschliessend `POST {BASE_URL}/moderate-action` fuer Login, Registrierung, Chats, Swipes, Events und Ideen sowie `POST {BASE_URL}/reports` fuer Nutzer-Meldungen auf.
- Ohne diesen Dienst greift nur ein lokaler Fallback fuer einfache Spam- und Fraud-Muster. Das ersetzt kein belastbares Moderations-Backend.

8. Datenschutz und Betrieb
Noch umzusetzen: DSGVO-konforme Speicherung, Loesch- und Exportprozesse, Logging, Monitoring, Backup- und Incident-Prozesse

## Kostenfreier Betrieb bis Anfang 2027

Night-Whisper ist aktuell bewusst ohne Bezahlfunktion konfiguriert. Registrierung, Login und alle eingebauten Webapp-Funktionen bleiben bis Anfang 2027 kostenfrei verfügbar.

Wichtig:

- Stripe und sonstige Checkout-Flows sind derzeit deaktiviert.
- Neue und bestehende Nutzer erhalten aktuell Vollzugang ohne Tarif-Upgrade.
- Für einen späteren Bezahlstart müssten Stripe oder alternative Store-/Billing-Konten erst wieder bewusst integriert werden. Aktuell sind dafür keine `.env.local`-Werte nötig.

## Wiedereinstieg in Bezahlung ab Anfang 2027

Wenn Night-Whisper Anfang 2027 wieder monetarisiert werden soll, müssen die externen Voraussetzungen vor der Umsetzung verbindlich vorliegen.

Mindestens erforderlich, aber erst wenn Zahlungen wirklich wieder aktiviert werden sollen:

- ein Zahlungsanbieter oder eigenes Billing-Backend
- falls Web-Checkout geplant ist: Stripe-Konto, API-Keys und Webhook-Setup
- falls native Käufe geplant sind: Apple Developer Program und Google Play Console mit Produkt-IDs
- Produktentscheidungen zu Preisstruktur, Probephase, Zugangsstufen und rechtlichen Pflichttexten

Erst danach sollten Zahlungs-UI, Checkout-Flows und serverseitige Kaufvalidierung wieder aktiviert werden.

## Karten-API lokal vorbereiten

Die Matching Map ist so vorbereitet, dass nach der Provider-Umstellung nur noch der API-Key gesetzt werden muss.

1. Erstelle im Projekt eine `.env` auf Basis von [.env.example](.env.example)
2. Optional: Erstelle fuer lokale, nicht eingecheckte Projektwerte eine `.env.local` auf Basis von [.env.local.example](.env.local.example)
3. Trage den Karten-Key als `EXPO_PUBLIC_STADIA_API_KEY` ein
4. Details und Testschritte stehen in `SETUP_MAPS.md`
5. Starte Expo danach neu

Beispiel:

```bash
cp .env.example .env
```

Dann in `.env` und bei Bedarf in `.env.local` die Platzhalter ersetzen.

Fuer Firebase muessen zusaetzlich diese Werte in `.env` gesetzt werden:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_DATABASE_URL`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`

Wichtig: Fuer echte Bild-Uploads muessen in der Firebase Console sowohl Firestore als auch Firebase Storage aktiviert und mit produktiven Sicherheitsregeln abgesichert sein.

Fuer den Selfie- und KI-Fake-Check muessen zusaetzlich diese Werte in `.env.local` gesetzt werden:

- `EXPO_PUBLIC_SELFIE_VERIFICATION_PROVIDER`
- `EXPO_PUBLIC_SELFIE_VERIFICATION_BASE_URL`
- `EXPO_PUBLIC_SELFIE_VERIFICATION_PUBLIC_TOKEN`

Fuer den AWS-Profilbild-Fakecheck muessen zusaetzlich diese Werte gesetzt werden:

- `AWS_COGNITO_IDENTITY_POOL_ID`
- `AWS_COGNITO_REGION` (optional, Standard `eu-central-1`)
- `EXPO_PUBLIC_PROFILE_PHOTO_LIVENESS_WEB_URL` (optional, Standard `/api/profile-photo-liveness`)

Fuer Firebase Functions muessen diese Secrets gesetzt werden:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `PROFILE_IMAGE_VERIFICATION_SIGNING_KEY`

Die neue Implementierung verwendet diese Firebase Functions:

- `createFaceLivenessSession`
- `getFaceLivenessResultAndCompareProfileImage`
- `approveProfileImage`
- `rejectAndDeleteTempProfileImage`

Der Upload- und Freigabefluss ist jetzt wie folgt:

1. Client lädt das gewählte Bild nach `tempProfileImages/{uid}/...` hoch.
2. `createFaceLivenessSession` erstellt die AWS-Session in `eu-central-1`.
3. Der Client öffnet die eingebaute Liveness-Webroute unter `/api/profile-photo-liveness` oder eine konfigurierte Override-URL.
4. Nach erfolgreichem Liveness-Flow ruft der Client `getFaceLivenessResultAndCompareProfileImage` auf.
5. Bei mindestens 90 Prozent Similarity ruft der Client `approveProfileImage` auf und das Bild wird nach `profileImages/{uid}/profile.jpg` verschoben.
6. Bei Fehlern oder Mismatch wird das Temp-Bild gelöscht.

Fuer Abuse-, Moderations- und Fraud-Checks muessen zusaetzlich diese Werte in `.env.local` gesetzt werden:

- `EXPO_PUBLIC_MODERATION_PROVIDER`
- `EXPO_PUBLIC_MODERATION_BASE_URL`
- `EXPO_PUBLIC_MODERATION_PUBLIC_TOKEN`

Fuer den verwalteten Passwort-Reset muessen zusaetzlich diese Werte gesetzt werden:

- `EXPO_PUBLIC_PASSWORD_RESET_BASE_URL`
- `AFFAIRGO_PASSWORD_RESET_WEBHOOK_URL`

Der Client ruft anschliessend `POST {BASE_URL}/password-reset` mit der E-Mail-Adresse auf. Wenn kein Webhook hinterlegt ist, faellt Night-Whisper automatisch auf den Firebase-Reset-Link zurueck. Fuer das im Produkttext gewuenschte temporaere Passwort per E-Mail muss serverseitig ein Mail-Workflow am Webhook haengen. Der API-Code akzeptiert zusaetzlich noch den Legacy-Alias `NIGHT_WHISPER_PASSWORD_RESET_WEBHOOK_URL`.

## Vor dem echten Launch noch offen

Fuer einen echten Onlinegang reicht der aktuelle Stand noch nicht aus. Vor dem Launch muessen mindestens diese Punkte produktiv abgeschlossen werden:

- Firebase auf produktive Regeln, Storage und ggf. Functions umstellen
- Stadia Maps Key produktiv setzen und Expo-Web-Environment sauber konfigurieren
- Reale In-App-Kaeufe nur dann produktiv anschliessen, wenn Night-Whisper nach der kostenfreien Phase wieder monetarisiert werden soll
- Selfie-/Fake-Check, AWS Face Liveness und Profilbild-Freigabe produktiv anschliessen
- Abuse-, Moderations-, Fraud- und Audit-Backend produktiv anschliessen und Fallbearbeitung serverseitig umsetzen
- Live-Standorte serverseitig speichern, filtern und absichern
- DSGVO-Prozesse fuer Datenexport, Kontoloeschung und Einwilligungen umsetzen
- Backend-Haertung, Abuse-Prevention, Monitoring und Firestore-Sicherheitsregeln finalisieren

## Deploy auf Vercel

Wenn das Projekt bereits mit Vercel und dem GitHub-Repo verbunden ist, reicht ein Push auf `main`.

1. Aenderungen committen

```bash
git add .
git commit -m "Update Night-Whisper"
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
git commit -m "Initial Night-Whisper deploy"
git push origin main
```

2. Danach in Vercel:

- `Add New -> Project`
- GitHub-Repo `Ramon1710/AffairGo` auswaehlen
- nach einem späteren GitHub-Rename entsprechend `Ramon1710/Night-Whisper` oder `Ramon1710/night-whisper` wählen
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

Der Code ist auf produktive Weiterentwicklung ausgerichtet, aber noch nicht vollstaendig livegangsbereit. Externe Anbieter wie Stadia Maps sowie Sicherheits-, Datenschutz- und Verifizierungsdienste muessen noch final integriert und technisch abgesichert werden. Die Matching Map nutzt bereits echte Geraete-Location und Leaflet auf Web; fuer den produktiven Betrieb muss vor allem der gueltige Stadia Tile-Key gesetzt werden.

## Firebase Deploy fuer Profilbild-Fakecheck

1. Functions-Abhaengigkeiten installieren

```bash
cd functions
npm install
cd ..
```

2. Firebase Login und Projektwahl

```bash
firebase login
firebase use <dein-firebase-projekt>
```

3. Secrets setzen

```bash
firebase functions:secrets:set AWS_ACCESS_KEY_ID
firebase functions:secrets:set AWS_SECRET_ACCESS_KEY
firebase functions:secrets:set PROFILE_IMAGE_VERIFICATION_SIGNING_KEY
```

4. Vercel- oder Hosting-Umgebungsvariablen fuer den Liveness-Webflow setzen

```bash
AWS_COGNITO_IDENTITY_POOL_ID=<deine-identity-pool-id>
AWS_COGNITO_REGION=eu-central-1
```

Eine komplette kopierbare Vorlage fuer lokale Werte liegt in [.env.local.example](.env.local.example).

5. Regeln und Functions deployen

```bash
firebase deploy --only functions:createFaceLivenessSession,functions:getFaceLivenessResultAndCompareProfileImage,functions:approveProfileImage,functions:rejectAndDeleteTempProfileImage,firestore:rules,storage
```

Arbeitsregel fuer die weitere Entwicklung:

- Sobald fuer einen offenen Punkt eine Registrierung bei einem externen Dienst noetig ist, muss dies vor der Umsetzung direkt benannt werden.
- Sobald fuer einen offenen Punkt ein API-Key, Secret, Webhook, Store-Produkt oder Plattformkonto fehlt, muss dies vor der Umsetzung direkt benannt werden.
