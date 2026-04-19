// helpers.js

/**
 * Berechnet das Alter basierend auf Tag, Monat und Jahr.
 * Gibt entweder eine Zahl oder null zurück.
 */
export const calculateAge = (day, month, year) => {
  if (!day || month === '' || !year) return null;
  try {
    const birthDate = new Date(year, Number(month), Number(day));
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (err) {
    return null;
  }
};

/**
 * Zeigt einen Standard-Fehler-Alert mit Titel + Nachricht
 */
export const showAlert = (title = 'Fehler', message = 'Etwas ist schiefgelaufen.') => {
  alert(`${title}: ${message}`);
};

/**
 * Wandelt Firebase-Fehlermeldungen in verständliche Texte um
 */
export const parseFirebaseError = (error) => {
  if (!error?.code) return 'Unbekannter Fehler';

  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Diese E-Mail-Adresse wird bereits verwendet.';
    case 'auth/invalid-email':
      return 'Ungültige E-Mail-Adresse.';
    case 'auth/weak-password':
      return 'Passwort ist zu schwach (mind. 6 Zeichen).';
    case 'auth/user-not-found':
      return 'Nutzer nicht gefunden.';
    case 'auth/wrong-password':
      return 'Falsches Passwort.';
    default:
      return error.message || 'Unbekannter Fehler.';
  }
};
