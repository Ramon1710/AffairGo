export const MONTH_OPTIONS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];

export const FIGURE_OPTIONS = ['Mager', 'Schlank', 'Sportlich', 'Normal', 'Pummelig', 'Dick'];
export const HAIR_OPTIONS = ['Blond', 'Braun', 'Schwarz', 'Rot', 'Grau', 'Glatze', 'Gefärbt'];
export const EYE_OPTIONS = ['Blau', 'Braun', 'Grün', 'Grau', 'Schwarz', 'Gemischt'];
export const SKIN_OPTIONS = ['Sehr hell', 'Hell', 'Mittel', 'Oliv', 'Dunkel', 'Sehr dunkel'];
export const GENDER_OPTIONS = ['männlich', 'weiblich', 'divers', 'paare'];
export const SEARCH_GENDER_OPTIONS = ['männlich', 'weiblich', 'divers', 'paare'];
export const VISIBILITY_OPTIONS = ['Ab sofort sichtbar', '2 Wochen vorher sichtbar', 'Ab Stichtag sichtbar'];
export const RADIUS_OPTIONS = [5, 10, 20, 25, 50, 100, 150];
export const PHOTO_AGE_FILTERS = [1, 2, 3, 6, 12];

export const PROFILE_STATUS_OPTIONS = [
  { key: 'verified', label: 'Verifiziert', tone: 'verified' },
  { key: 'review', label: 'Prüfung offen', tone: 'review' },
  { key: 'expired', label: 'Foto veraltet', tone: 'expired' },
];

export const ACCESS_OPTIONS = [
  { key: 'free', label: 'Kostenfrei', pitch: 'Alle Funktionen sind vorübergehend freigeschaltet' },
];

export const EVENT_CATEGORIES = ['Lounge', 'Private Party', 'Afterwork', 'Hotel Date', 'Travel Meetup'];

export const DASHBOARD_SIGNAL_CARDS = [
  {
    id: 'signal-1',
    title: 'Diskrete Sichtbarkeit',
    detail: 'Nur während aktiver Suche sichtbar, danach wieder verborgen.',
    icon: 'shield-checkmark-outline',
  },
  {
    id: 'signal-2',
    title: 'Fotoalter im Blick',
    detail: 'Alte Profilbilder werden im Matching deutlich markiert.',
    icon: 'images-outline',
  },
  {
    id: 'signal-3',
    title: 'Reise-Modus',
    detail: 'Plane Urlaubs- und Dienstreise-Fenster vorab für die Sichtbarkeit.',
    icon: 'navigate-outline',
  },
];

export const PREFERENCE_OPTIONS = [
  'Oralsex geben',
  'Oralsex empfangen',
  '69-Stellung',
  'Zungenküsse',
  'Vorspiel genießen',
  'Langes Liebesspiel',
  'Spontaner Sex',
  'Dominant sein',
  'Devot sein',
  'Leichte Fesselspiele',
  'Dirty Talk',
  'Rollenspiele',
  'Anal aktiv',
  'Anal passiv',
  'Toys benutzen',
  'Zärtlich und romantisch',
  'Schnell und hart',
  'Erotik mit Augenbinde',
  'Sex mit Musik',
  'Fesselspiele',
  'BDSM soft',
  'BDSM hart',
  'Gruppensex oder Dreier',
  'Wechselnde Stellungen',
  'Langsamer sinnlicher Sex',
];

export const TABOO_OPTIONS = [
  'Kein Analverkehr',
  'Kein Oralsex geben',
  'Kein Oralsex empfangen',
  'Kein ungeschützter Sex',
  'Kein Sex ohne Emotion',
  'Kein BDSM',
  'Keine Gewaltspiele',
  'Kein Rollenspiel',
  'Keine Fesselspiele',
  'Kein Gruppensex',
  'Kein Dreier',
  'Keine Öffentlichkeit',
  'Kein Dominanz-Spiel',
  'Kein Dirty Talk',
  'Keine Toys',
  'Kein Fußfetisch',
  'Keine erniedrigenden Praktiken',
  'Keine harten Praktiken',
  'Kein Tausch intimer Bilder',
  'Kein Küssen',
  'Kein Küssen auf den Mund',
  'Kein Kuscheln danach',
  'Kein emotionaler Kontakt',
  'Keine Übernachtungen',
  'Kein Kontakt außerhalb',
  'Kein Sex beim ersten Treffen',
];

export const GAME_OPTIONS = [
  { id: 'connect4', title: 'Vier Gewinnt', reward: 20 },
  { id: 'rps', title: 'Schere Stein Papier', reward: 10 },
  { id: 'quiz', title: 'Flirt Quiz', reward: 25 },
  { id: 'emoji', title: 'Emoji Rätsel', reward: 15 },
  { id: 'truth', title: 'Wahrheit oder Pflicht Light', reward: 30 },
];

export const GAME_LIBRARY = {
  connect4: {
    columns: 4,
    rows: 4,
  },
  rps: {
    choices: ['Schere', 'Stein', 'Papier'],
  },
  quiz: {
    questions: [
      {
        id: 'quiz-1',
        prompt: 'Was wirkt beim ersten Treffen am offensten?',
        options: ['Eine klare Erwartungshaltung', 'Ein lockeres Gespräch auf Augenhöhe', 'Direkt intime Details'],
        correctIndex: 1,
      },
      {
        id: 'quiz-2',
        prompt: 'Welche Nachricht eignet sich am besten als respektvoller Icebreaker?',
        options: ['Na, was geht?', 'Sag sofort deine Tabus', 'Welche Art von Date macht dir am meisten Spaß?'],
        correctIndex: 2,
      },
    ],
  },
  emoji: {
    puzzles: [
      { id: 'emoji-1', prompt: '🍷🌃✨', solution: 'Date Night' },
      { id: 'emoji-2', prompt: '🏖️😎🍹', solution: 'Urlaub' },
      { id: 'emoji-3', prompt: '💬❤️🔥', solution: 'Flirt Chat' },
    ],
  },
  truth: {
    prompts: [
      'Wahrheit: Welche Eigenschaft macht ein Match sofort sympathisch?',
      'Pflicht: Schreibe deinem Match einen charmanten Ein-Satz-Icebreaker.',
      'Wahrheit: Was wäre dein ideales erstes Treffen auf Reisen?',
    ],
  },
};

export const ICEBREAKER_SUGGESTIONS = [
  'Welche drei Dinge machen für dich ein wirklich gutes erstes Treffen aus?',
  'Welchen Wochenendplan würdest du spontan sofort mitnehmen?',
  'Welche Vorliebe ist dir wichtig, über die man offen sprechen sollte?',
  'Bist du eher Team Reiseplanung oder Team spontanes Abenteuer?',
];

export const FREE_ACCESS_PLANS = [
  {
    key: 'free',
    title: 'Kostenfrei bis Anfang 2027',
    price: '0 EUR',
    accent: '#b95d5d',
    features: ['Unbegrenzte Swipes', 'Matching Map', 'Fotoalter-Filter', 'Vor dem Match schreiben', 'Explore-Modus', 'Spiele und Icebreaker'],
    activation: { membership: 'free', billingCycle: 'free', priceLabel: 'Kostenfrei bis Anfang 2027' },
    buttonLabel: 'Jetzt kostenfrei nutzen',
  },
];

export const WEBSITE_SECTIONS = [
  {
    title: 'Profil und Sicherheit',
    items: [
      'Nur Spitzname ist öffentlich sichtbar',
      '18+ Prüfung beim Onboarding',
      'Profilbild-Verifizierung mit Selfie-Check',
      'Warnung bei alten Fotos und klarer Verifizierungsstatus',
    ],
  },
  {
    title: 'Matching und Sichtbarkeit',
    items: [
      'Nur gegenseitig passende Profile werden angezeigt',
      'Kein freies Durchsuchen anderer Profile',
      'Live-Sichtbarkeit nur im aktiven Suchmodus',
      'Radar, Karten- und Listenansicht mit Radiuslogik',
    ],
  },
  {
    title: 'Reisen, Events und Community',
    items: [
      'Urlaub und Dienstreise bis zu zwei Wochen im Voraus planen',
      'Swinger-Events anlegen und anonym verwalten',
      'Community-Ideenbox mit Belohnungen',
      'Website und Webapp greifen auf denselben App-Zustand zu',
    ],
  },
];

export const INITIAL_CURRENT_USER = {
  id: 'me',
  email: 'demo@night-whisper.app',
  password: 'NightWhisper123',
  nickname: 'NightPulse',
  firstName: 'Anna',
  lastName: 'Muster',
  birthDay: '17',
  birthMonth: 9,
  birthYear: 1989,
  age: 36,
  gender: 'weiblich',
  height: '1,72 m',
  figure: 'Sportlich',
  penisSize: '',
  braSize: '75B',
  hairColor: 'Braun',
  eyeColor: 'Grün',
  skinType: 'Hell',
  profilePhotoAgeMonths: 3,
  gallery: [
    { id: 'g1', label: 'Studio', ageLabel: 'Vor 2 Monaten' },
    { id: 'g2', label: 'Weekend', ageLabel: 'Vor 6 Monaten' },
  ],
  preferences: ['Zungenküsse', 'Vorspiel genießen', 'Sex mit Musik', 'Zärtlich und romantisch'],
  taboos: ['Kein BDSM', 'Kein Dreier'],
  searchAgeMin: 28,
  searchAgeMax: 48,
  searchGenders: ['männlich'],
  radius: 25,
  membership: 'free',
  searchActive: true,
  online: true,
  verified: true,
  verificationState: 'verified',
  emailVerified: true,
  onboardingCompleted: true,
  points: 140,
  forcePasswordChange: false,
  joinedLabel: 'Vor 3 Wochen',
  featureSuggestions: [],
  travelPlans: {
    business: [
      {
        id: 'travel-business-1',
        startDate: '21.05.2026',
        endDate: '24.05.2026',
        fromTime: '18:00',
        toTime: '23:30',
        postalCode: '50667',
        city: 'Köln',
        street: 'Domkloster 4',
        visibility: ['Ab sofort sichtbar'],
      },
    ],
    vacation: [
      {
        id: 'travel-vacation-1',
        startDate: '08.06.2026',
        endDate: '15.06.2026',
        fromTime: '19:00',
        toTime: '01:00',
        postalCode: '25980',
        city: 'Westerland',
        street: 'Strandweg 7',
        visibility: ['2 Wochen vorher sichtbar'],
      },
    ],
  },
};

export const INITIAL_USERS = [
  {
    id: 'u1',
    nickname: 'BlueHarbor',
    firstName: 'Mila',
    lastName: 'K',
    age: 39,
    gender: 'weiblich',
    city: 'Köln',
    distanceKm: 12,
    x: '20%',
    y: '48%',
    status: 'active',
    travelMode: 'vacation',
    verified: true,
    verificationState: 'verified',
    profilePhotoAgeMonths: 2,
    joinedLabel: 'Vor 2 Monaten',
    height: '1,68 m',
    figure: 'Schlank',
    braSize: '80C',
    hairColor: 'Blond',
    eyeColor: 'Blau',
    skinType: 'Hell',
    preferences: ['Zungenküsse', 'Spontaner Sex', 'Sex mit Musik', 'Zärtlich und romantisch'],
    taboos: ['Kein BDSM', 'Kein Dreier'],
    searchAgeMin: 30,
    searchAgeMax: 48,
    searchGenders: ['männlich'],
    searchActive: true,
    online: true,
    travelPlans: {
      business: [],
      vacation: [
        {
          id: 'u1-travel-1',
          startDate: '02.06.2026',
          endDate: '09.06.2026',
          fromTime: '18:00',
          toTime: '23:00',
          postalCode: '25980',
          city: 'Westerland',
          street: 'Dünenweg 5',
          visibility: ['Ab sofort sichtbar'],
        },
      ],
    },
    gallery: [
      { id: 'u1g1', label: 'Seaside', ageLabel: 'Vor 1 Monat' },
      { id: 'u1g2', label: 'City', ageLabel: 'Vor 4 Monaten' },
    ],
  },
  {
    id: 'u2',
    nickname: 'NightTrip',
    firstName: 'Lars',
    lastName: 'S',
    age: 48,
    gender: 'männlich',
    city: 'Düsseldorf',
    distanceKm: 23,
    x: '68%',
    y: '68%',
    status: 'active',
    travelMode: 'business',
    verified: true,
    verificationState: 'verified',
    profilePhotoAgeMonths: 7,
    joinedLabel: 'Vor 1 Woche',
    height: '1,85 m',
    figure: 'Normal',
    penisSize: '18 cm',
    hairColor: 'Braun',
    eyeColor: 'Braun',
    skinType: 'Mittel',
    preferences: ['Dirty Talk', 'Rollenspiele', 'Vorspiel genießen', 'Zungenküsse'],
    taboos: ['Kein Kuscheln danach'],
    searchAgeMin: 30,
    searchAgeMax: 45,
    searchGenders: ['weiblich'],
    searchActive: true,
    online: true,
    travelPlans: {
      business: [
        {
          id: 'u2-travel-1',
          startDate: '14.05.2026',
          endDate: '16.05.2026',
          fromTime: '19:00',
          toTime: '23:30',
          postalCode: '50667',
          city: 'Köln',
          street: 'Messeplatz 3',
          visibility: ['2 Wochen vorher sichtbar'],
        },
      ],
      vacation: [],
    },
    gallery: [
      { id: 'u2g1', label: 'Business', ageLabel: 'Vor 7 Monaten' },
      { id: 'u2g2', label: 'Hotel', ageLabel: 'Vor 12 Monaten' },
    ],
  },
  {
    id: 'u3',
    nickname: 'VelvetWave',
    firstName: 'Chris',
    lastName: 'M',
    age: 42,
    gender: 'divers',
    city: 'Bonn',
    distanceKm: 17,
    x: '72%',
    y: '28%',
    status: 'active',
    travelMode: 'active',
    verified: false,
    verificationState: 'expired',
    profilePhotoAgeMonths: 13,
    joinedLabel: 'Vor 5 Tagen',
    height: '1,74 m',
    figure: 'Sportlich',
    penisSize: '15 cm',
    braSize: '85B',
    hairColor: 'Gefärbt',
    eyeColor: 'Grau',
    skinType: 'Oliv',
    preferences: ['Rollenspiele', 'Dirty Talk', 'Leichte Fesselspiele', 'Sex mit Musik'],
    taboos: ['Kein ungeschützter Sex', 'Kein emotionaler Kontakt'],
    searchAgeMin: 28,
    searchAgeMax: 55,
    searchGenders: ['weiblich', 'männlich', 'divers'],
    searchActive: true,
    online: false,
    gallery: [
      { id: 'u3g1', label: 'Night', ageLabel: 'Vor 8 Monaten' },
    ],
  },
  {
    id: 'u4',
    nickname: 'LakeLine',
    firstName: 'Sofia',
    lastName: 'P',
    age: 36,
    gender: 'weiblich',
    city: 'Leverkusen',
    distanceKm: 9,
    x: '14%',
    y: '75%',
    status: 'active',
    travelMode: 'vacation',
    verified: true,
    verificationState: 'review',
    profilePhotoAgeMonths: 1,
    joinedLabel: 'Vor 4 Wochen',
    height: '1,70 m',
    figure: 'Normal',
    braSize: '80B',
    hairColor: 'Schwarz',
    eyeColor: 'Grün',
    skinType: 'Mittel',
    preferences: ['Spontaner Sex', 'Zungenküsse', 'Zärtlich und romantisch', 'Langes Liebesspiel'],
    taboos: ['Kein Sex beim ersten Treffen'],
    searchAgeMin: 32,
    searchAgeMax: 46,
    searchGenders: ['männlich', 'divers'],
    searchActive: true,
    online: true,
    travelPlans: {
      business: [],
      vacation: [
        {
          id: 'u4-travel-1',
          startDate: '25.06.2026',
          endDate: '29.06.2026',
          fromTime: '20:00',
          toTime: '01:00',
          postalCode: '10115',
          city: 'Berlin',
          street: 'Spreeufer 8',
          visibility: ['Ab Stichtag sichtbar'],
        },
      ],
    },
    gallery: [
      { id: 'u4g1', label: 'Portrait', ageLabel: 'Vor 3 Wochen' },
    ],
  },
];

export const INITIAL_EVENTS = [
  {
    id: 'e1',
    title: 'Private Swingerparty',
    category: 'Private Party',
    date: 'Fr., 17. Mai',
    time: '21:00',
    address: '50259 Pulheim, Musterstraße 7',
    distanceKm: 23,
    participants: { total: 15, women: 3, men: 11, divers: 1 },
    maxParticipants: 20,
    verifiedOnly: true,
    description: 'Privates Loft, Dresscode elegant, Teilnahme anonym bestätigt.',
    imageLabel: 'Loft',
  },
  {
    id: 'e2',
    title: 'Afterwork Lounge',
    category: 'Afterwork',
    date: 'Sa., 24. Mai',
    time: '20:30',
    address: '50674 Köln, Belgische Allee 2',
    distanceKm: 8,
    participants: { total: 9, women: 4, men: 4, divers: 1 },
    maxParticipants: 18,
    verifiedOnly: false,
    description: 'Chillige Runde mit Musik, Cocktails und geschuetztem Einlass.',
    imageLabel: 'Bar',
  },
];

export const INITIAL_CHATS = [
  {
    id: 'c1',
    userId: 'u1',
    match: true,
    inactivityDays: 1,
    messages: [
      { id: 'm1', from: 'u1', text: 'Hi NightPulse, dein Musikgeschmack klingt spannend.', time: '19:04' },
      { id: 'm2', from: 'me', text: 'Danke, vielleicht testen wir direkt einen guten Icebreaker?', time: '19:07' },
    ],
  },
  {
    id: 'c2',
    userId: 'u4',
    match: true,
    inactivityDays: 8,
    messages: [
      { id: 'm3', from: 'u4', text: 'Ich bin über das Wochenende in der Stadt.', time: '17:30' },
      { id: 'm4', from: 'me', text: 'Perfekt, ich schaue gerade auf die Matching Map.', time: '17:42' },
    ],
  },
];

export const EXPLORE_CITIES = ['Berlin', 'Hamburg', 'München', 'Wien', 'Amsterdam'];

export const EMPTY_STATE_COPY = {
  matches: {
    title: 'Noch keine passenden Profile',
    detail: 'Erhöhe Radius oder lockere einen Filter, damit neue Vorschläge sichtbar werden.',
  },
  chats: {
    title: 'Noch keine aktiven Chats',
    detail: 'Ein Match oder eine Direktnachricht startet hier deinen ersten Verlauf.',
  },
  events: {
    title: 'Noch keine Events in Reichweite',
    detail: 'Lege selbst ein Event an oder erweitere deine Sichtbarkeit für neue Termine.',
  },
};