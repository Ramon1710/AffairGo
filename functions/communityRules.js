const { HttpsError } = require('firebase-functions/v2/https');

const COMMUNITY_RULES_CONFIG_DOC_PATH = 'communityConfig/rules';
const COMMUNITY_RULES_VERSIONS_COLLECTION = 'communityRuleVersions';
const COMMUNITY_RULE_ACCEPTANCES_COLLECTION = 'communityRuleAcceptances';
const DEFAULT_COMMUNITY_RULES_VERSION = '1.0';
const COMMUNITY_RULES_VERSION_PATTERN = /^\d+\.\d+(?:\.\d+)?$/;
const DEFAULT_COMMUNITY_RULES_TITLE = 'Night-Whisper Community-Regeln';
const DEFAULT_COMMUNITY_RULES_SECTIONS = Object.freeze([
  {
    heading: '1. Nur für Erwachsene',
    paragraphs: ['Die Night-Whisper Community ist ausschließlich für volljährige Nutzer bestimmt.'],
  },
  {
    heading: '2. Respektiere Grenzen',
    paragraphs: ['Ein Nein ist ein Nein.', 'Andere Nutzer dürfen nicht bedrängt, unter Druck gesetzt oder belästigt werden.'],
  },
  {
    heading: '3. Öffentlicher Chat bedeutet keine sexuelle Zustimmung',
    paragraphs: [
      'Die Teilnahme an einem Community-Chat, einem Event-Chat oder einer Diskussion bedeutet nicht, dass eine Person Kontakt möchte, private Nachrichten möchte, sich treffen möchte oder sexuelle Handlungen möchte.',
    ],
  },
  {
    heading: '4. Private Kontaktregeln bleiben bestehen',
    paragraphs: ['Der öffentliche Community-Chat hebt die bestehende Matching- und Kontaktlogik von Night-Whisper nicht auf.'],
  },
  {
    heading: '5. Keine Belästigung',
    paragraphs: ['Nicht erlaubt sind insbesondere wiederholte unerwünschte Kontaktversuche, Beleidigungen, Bedrohungen, Einschüchterung und aggressives Nachstellen.'],
  },
  {
    heading: '6. Keine Minderjährigen',
    paragraphs: ['Minderjährige dürfen die Plattform nicht verwenden.', 'Hinweise auf möglicherweise minderjährige Nutzer sollen über die Meldefunktion gemeldet werden.'],
  },
  {
    heading: '7. Keine illegalen Inhalte',
    paragraphs: ['Keine Inhalte veröffentlichen, die gegen geltendes Recht verstoßen.'],
  },
  {
    heading: '8. Keine Veröffentlichung fremder persönlicher Daten',
    paragraphs: ['Nicht veröffentlichen: Telefonnummern anderer Personen, Adressen anderer Personen, Klarnamen anderer Personen, private Nachrichten anderer Personen oder Standortdaten anderer Personen ohne deren Zustimmung.'],
  },
  {
    heading: '9. Kein Spam',
    paragraphs: ['Nicht erlaubt sind wiederholte Werbung, automatisierte Nachrichten, Link-Spam und massenhafte Kontaktwerbung.'],
  },
  {
    heading: '10. Veranstalter und Events',
    paragraphs: ['Event-Chats dienen dem Austausch über Veranstaltungen.', 'Die Teilnahme an einem Event-Chat bedeutet nicht automatisch, dass ein Nutzer an dieser Veranstaltung teilnimmt.'],
  },
  {
    heading: '11. Melden und Blockieren',
    paragraphs: ['Bei problematischem Verhalten können Nutzer Nachrichten melden, Nutzer melden und Nutzer blockieren.'],
  },
  {
    heading: '12. Moderation',
    paragraphs: ['Night-Whisper kann Community-Inhalte moderieren und bei Regelverstößen insbesondere Nachrichten entfernen, Nutzer verwarnen sowie Schreibzugriffe vorübergehend oder dauerhaft sperren.'],
  },
]);

const cloneRulesSections = (sections = DEFAULT_COMMUNITY_RULES_SECTIONS) => JSON.parse(JSON.stringify(sections));

const getCommunityRulesErrorDetails = (reason, extra = {}) => ({
  scope: 'community-rules',
  reason,
  ...extra,
});

const normalizeOptionalString = (value) => (typeof value === 'string' ? value.trim() : '');

const validateCommunityRulesVersion = (value) => {
  const version = normalizeOptionalString(value);

  if (!COMMUNITY_RULES_VERSION_PATTERN.test(version)) {
    throw new HttpsError('invalid-argument', 'Die Regelversion ist ungültig.', getCommunityRulesErrorDetails('invalid_rules_version', { version }));
  }

  return version;
};

const sanitizeCommunityRulesTitle = (value) => {
  const title = normalizeOptionalString(value);

  if (!title) {
    throw new HttpsError('invalid-argument', 'Der Regel-Titel ist erforderlich.', getCommunityRulesErrorDetails('missing_rules_title'));
  }

  if (title.length > 120) {
    throw new HttpsError('invalid-argument', 'Der Regel-Titel ist zu lang.', getCommunityRulesErrorDetails('rules_title_too_long'));
  }

  return title;
};

const sanitizeCommunityRulesSections = (value) => {
  if (!Array.isArray(value) || !value.length) {
    throw new HttpsError('invalid-argument', 'Die Regeln benötigen mindestens einen Abschnitt.', getCommunityRulesErrorDetails('missing_rules_sections'));
  }

  return value.map((section, index) => {
    const heading = normalizeOptionalString(section?.heading);
    const paragraphs = Array.isArray(section?.paragraphs)
      ? section.paragraphs.map((entry) => normalizeOptionalString(entry)).filter(Boolean)
      : [];

    if (!heading) {
      throw new HttpsError('invalid-argument', 'Jeder Regelabschnitt benötigt eine Überschrift.', getCommunityRulesErrorDetails('missing_rules_heading', { index }));
    }

    if (!paragraphs.length) {
      throw new HttpsError('invalid-argument', 'Jeder Regelabschnitt benötigt mindestens einen Absatz.', getCommunityRulesErrorDetails('missing_rules_paragraphs', { index }));
    }

    return {
      heading,
      paragraphs,
    };
  });
};

const buildDefaultCommunityRulesConfig = ({ fieldValue = null } = {}) => {
  const publishedAt = fieldValue ? fieldValue.serverTimestamp() : new Date().toISOString();

  return {
    version: DEFAULT_COMMUNITY_RULES_VERSION,
    title: DEFAULT_COMMUNITY_RULES_TITLE,
    sections: cloneRulesSections(),
    publishedAt,
    updatedAt: publishedAt,
    active: true,
  };
};

const buildCommunityRulesVersionRecord = ({ version, title, sections, publishedAt, createdBy, fieldValue }) => ({
  version,
  title,
  sections,
  active: true,
  publishedAt: publishedAt || fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
  createdBy,
});

const buildCommunityRulesConfigRecord = ({ version, title, sections, fieldValue }) => ({
  version,
  title,
  sections,
  active: true,
  publishedAt: fieldValue.serverTimestamp(),
  updatedAt: fieldValue.serverTimestamp(),
});

const normalizeCommunityRulesConfig = (value = {}) => ({
  version: normalizeOptionalString(value.version),
  title: normalizeOptionalString(value.title),
  sections: Array.isArray(value.sections)
    ? value.sections.map((section) => ({
      heading: normalizeOptionalString(section?.heading),
      paragraphs: Array.isArray(section?.paragraphs)
        ? section.paragraphs.map((entry) => normalizeOptionalString(entry)).filter(Boolean)
        : [],
    })).filter((section) => section.heading && section.paragraphs.length)
    : [],
  active: value.active !== false,
  publishedAt: value.publishedAt || null,
  updatedAt: value.updatedAt || null,
});

const buildCommunityRulesAcceptanceRecord = ({ uid, version, existingHistory = [], fieldValue }) => {
  const dedupedHistory = Array.isArray(existingHistory)
    ? existingHistory.filter((entry) => normalizeOptionalString(entry?.version) && normalizeOptionalString(entry?.version) !== version)
    : [];

  return {
    userId: uid,
    latestAcceptedVersion: version,
    latestAcceptedAt: fieldValue.serverTimestamp(),
    updatedAt: fieldValue.serverTimestamp(),
    acceptedVersions: [
      ...dedupedHistory,
      {
        version,
        acceptedAt: fieldValue.serverTimestamp(),
      },
    ],
  };
};

module.exports = {
  COMMUNITY_RULE_ACCEPTANCES_COLLECTION,
  COMMUNITY_RULES_CONFIG_DOC_PATH,
  COMMUNITY_RULES_VERSION_PATTERN,
  COMMUNITY_RULES_VERSIONS_COLLECTION,
  DEFAULT_COMMUNITY_RULES_SECTIONS,
  DEFAULT_COMMUNITY_RULES_TITLE,
  DEFAULT_COMMUNITY_RULES_VERSION,
  buildCommunityRulesAcceptanceRecord,
  buildCommunityRulesConfigRecord,
  buildCommunityRulesVersionRecord,
  buildDefaultCommunityRulesConfig,
  cloneRulesSections,
  getCommunityRulesErrorDetails,
  normalizeCommunityRulesConfig,
  sanitizeCommunityRulesSections,
  sanitizeCommunityRulesTitle,
  validateCommunityRulesVersion,
};
