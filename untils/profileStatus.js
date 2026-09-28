const normalizeStringValue = (value) => (typeof value === 'string' ? value.trim() : '');

const pickFirstNonEmptyString = (...values) => {
  const match = values.find((value) => normalizeStringValue(value));
  return match ? normalizeStringValue(match) : '';
};

const resolveProfilePhotoValue = (profile = {}) => pickFirstNonEmptyString(
  profile.profilePhotoUrl,
  profile.profileImageUri,
  profile.profileImage,
);

const PROFILE_COMPLETION_FIELDS = Object.freeze([
  { key: 'firstName', label: 'Vorname', isComplete: (profile) => Boolean(pickFirstNonEmptyString(profile.firstName, profile.firstname, profile.vorname)) },
  { key: 'lastName', label: 'Nachname', isComplete: (profile) => Boolean(pickFirstNonEmptyString(profile.lastName, profile.lastname, profile.nachname)) },
  { key: 'gender', label: 'Geschlecht', isComplete: (profile) => Boolean(pickFirstNonEmptyString(profile.gender, profile.geschlecht, profile.sex)) },
  { key: 'height', label: 'Groesse', isComplete: (profile) => Boolean(pickFirstNonEmptyString(profile.height, profile.groesse, profile.koerpergroesse, profile.bodyHeight)) },
  { key: 'figure', label: 'Figur', isComplete: (profile) => Boolean(pickFirstNonEmptyString(profile.figure, profile.figur, profile.bodyType)) },
  { key: 'profilePhoto', label: 'Profilbild', isComplete: (profile) => Boolean(resolveProfilePhotoValue(profile)) },
]);

const getProfileCompletionState = (profile = {}) => {
  const completedFields = PROFILE_COMPLETION_FIELDS.filter((field) => field.isComplete(profile));
  const missingFields = PROFILE_COMPLETION_FIELDS.filter((field) => !field.isComplete(profile));
  const totalFields = PROFILE_COMPLETION_FIELDS.length;
  const completedCount = completedFields.length;

  return {
    completedCount,
    totalFields,
    percent: Math.round((completedCount / totalFields) * 100),
    isComplete: completedCount === totalFields,
    missingFieldKeys: missingFields.map((field) => field.key),
    missingFieldLabels: missingFields.map((field) => field.label),
  };
};

export {
  PROFILE_COMPLETION_FIELDS,
  getProfileCompletionState,
  resolveProfilePhotoValue,
};