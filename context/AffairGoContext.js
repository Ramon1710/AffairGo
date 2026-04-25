import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    reload,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc
} from 'firebase/firestore';
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    EXPLORE_CITIES,
    INITIAL_CHATS,
    INITIAL_CURRENT_USER,
    INITIAL_EVENTS,
    INITIAL_USERS,
    PREFERENCE_OPTIONS,
    TABOO_OPTIONS,
} from '../data/mockData';
import { auth, db } from '../firebase';

const AffairGoContext = createContext(null);

const clone = (value) => JSON.parse(JSON.stringify(value));

const createEmptyTravelPlans = () => ({
  business: { startDate: '', endDate: '', fromTime: '', toTime: '', postalCode: '', city: '', street: '', visibility: [] },
  vacation: { startDate: '', endDate: '', fromTime: '', toTime: '', postalCode: '', city: '', street: '', visibility: [] },
});

const createDefaultCurrentUser = () => ({
  ...clone(INITIAL_CURRENT_USER),
  id: 'me',
  email: '',
  nickname: '',
  firstName: '',
  lastName: '',
  birthDay: '',
  birthMonth: 0,
  birthYear: new Date().getFullYear() - 18,
  age: 18,
  height: '',
  braSize: '',
  penisSize: '',
  city: '',
  gallery: [],
  preferences: [],
  taboos: [],
  verified: false,
  emailVerified: false,
  onboardingCompleted: false,
  searchActive: false,
  forcePasswordChange: false,
  membership: 'basic',
  points: 0,
  joinedLabel: 'Neu',
  travelPlans: createEmptyTravelPlans(),
});

const normalizeUserProfile = (profile = {}, firebaseUser = null) => {
  const defaults = createDefaultCurrentUser();
  const resolvedTravelPlans = {
    ...createEmptyTravelPlans(),
    ...(profile.travelPlans || {}),
  };

  return {
    ...defaults,
    ...profile,
    id: profile.id || firebaseUser?.uid || defaults.id,
    email: profile.email || firebaseUser?.email || defaults.email,
    emailVerified: firebaseUser?.emailVerified ?? profile.emailVerified ?? false,
    verified: profile.verified ?? Boolean(profile.profileImageUploaded),
    gallery: Array.isArray(profile.gallery) ? profile.gallery : defaults.gallery,
    preferences: Array.isArray(profile.preferences) ? profile.preferences : defaults.preferences,
    taboos: Array.isArray(profile.taboos) ? profile.taboos : defaults.taboos,
    travelPlans: resolvedTravelPlans,
    forcePasswordChange: false,
  };
};

const toStoredProfile = (profile) => {
  const sanitized = { ...profile };
  delete sanitized.password;
  delete sanitized.repeatPassword;
  delete sanitized.forcePasswordChange;

  return {
    ...sanitized,
    nicknameLower: profile.nickname?.trim().toLowerCase() || '',
    updatedAt: serverTimestamp(),
  };
};

const buildRegistrationProfile = (payload, uid) => ({
  id: uid,
  email: payload.email.trim().toLowerCase(),
  nickname: payload.nickname.trim(),
  firstName: payload.firstName?.trim() || '',
  lastName: payload.lastName?.trim() || '',
  birthDay: payload.birthDay,
  birthMonth: payload.birthMonth,
  birthYear: payload.birthYear,
  birthLabel: payload.birthLabel,
  age: payload.age,
  gender: payload.gender,
  height: payload.height?.trim() || '',
  figure: payload.figure,
  penisSize: payload.penisSize?.trim() || '',
  braSize: payload.braSize?.trim() || '',
  hairColor: payload.hairColor,
  eyeColor: payload.eyeColor,
  skinType: payload.skinType,
  verified: Boolean(payload.profileImageUploaded),
  profilePhotoAgeMonths: 0,
  gallery: [],
  joinedLabel: 'Heute',
  onboardingCompleted: false,
  membership: 'basic',
  searchAgeMin: 25,
  searchAgeMax: 55,
  radius: 25,
  searchActive: false,
  online: true,
  points: 0,
  preferences: [],
  taboos: [],
  city: '',
  featureSuggestions: [],
  travelPlans: createEmptyTravelPlans(),
  createdAt: serverTimestamp(),
});

const mapAuthError = (error, fallbackMessage) => {
  switch (error?.code) {
    case 'auth/email-already-in-use':
      return 'Diese E-Mail-Adresse ist bereits registriert. Bitte logge dich ein oder nutze den Passwort-Reset.';
    case 'auth/invalid-email':
      return 'Die E-Mail-Adresse ist ungueltig.';
    case 'auth/weak-password':
      return 'Das Passwort ist zu schwach. Bitte verwende mindestens 6 Zeichen.';
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'E-Mail oder Passwort ist nicht korrekt.';
    case 'auth/too-many-requests':
      return 'Zu viele Versuche in kurzer Zeit. Bitte warte kurz und versuche es erneut.';
    case 'auth/network-request-failed':
      return 'Netzwerkfehler. Bitte pruefe deine Verbindung und versuche es erneut.';
    case 'auth/user-disabled':
      return 'Dieses Konto wurde deaktiviert.';
    default:
      return fallbackMessage;
  }
};

const trySendVerificationEmail = async (user) => {
  try {
    await withTimeout(
      sendEmailVerification(user),
      10000,
      'Die Verifizierungs-Mail konnte nicht rechtzeitig angefordert werden.'
    );
    return true;
  } catch {
    return false;
  }
};

const withTimeout = async (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const trySignOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('AffairGo signOut warning', error);
  }
};

const tryStoreRegistrationProfile = async (profile, userId) => {
  try {
    await withTimeout(
      setDoc(doc(db, 'users', userId), toStoredProfile(profile)),
      10000,
      'Das Profil konnte nicht rechtzeitig gespeichert werden.'
    );
    return true;
  } catch (error) {
    console.warn('AffairGo registration profile save warning', error);
    return false;
  }
};

const getCompatibility = (sourcePreferences, targetPreferences) => {
  const base = sourcePreferences.length || 1;
  const shared = sourcePreferences.filter((entry) => targetPreferences.includes(entry)).length;
  return Math.round((shared / base) * 100);
};

const isMutualAgeMatch = (currentUser, targetUser) => {
  const userLikesTarget =
    targetUser.age >= currentUser.searchAgeMin && targetUser.age <= currentUser.searchAgeMax;
  const targetLikesUser =
    currentUser.age >= targetUser.searchAgeMin && currentUser.age <= targetUser.searchAgeMax;
  return userLikesTarget && targetLikesUser;
};

export const AffairGoProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(createDefaultCurrentUser());
  const [users, setUsers] = useState(clone(INITIAL_USERS));
  const [events, setEvents] = useState(clone(INITIAL_EVENTS));
  const [chats, setChats] = useState(clone(INITIAL_CHATS));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dismissedProfiles, setDismissedProfiles] = useState([]);
  const [swipeHistory, setSwipeHistory] = useState([]);
  const [pendingVerificationId, setPendingVerificationId] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState('u1');
  const [currentRadius, setCurrentRadius] = useState(INITIAL_CURRENT_USER.radius);
  const [photoAgeFilter, setPhotoAgeFilter] = useState(null);
  const [featureIdeas, setFeatureIdeas] = useState([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setIsAuthenticated(false);
        setCurrentUser(createDefaultCurrentUser());
        setPendingVerificationId(null);
        setCurrentRadius(INITIAL_CURRENT_USER.radius);
        setIsAuthReady(true);
        return;
      }

      let profileData = { id: firebaseUser.uid, email: firebaseUser.email };

      try {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        const profileSnapshot = await getDoc(profileRef);
        if (profileSnapshot.exists()) {
          profileData = profileSnapshot.data();
        }
      } catch (error) {
        console.warn('AffairGo profile bootstrap warning', error);
      }

      const normalizedProfile = normalizeUserProfile(profileData, firebaseUser);

      setCurrentUser(normalizedProfile);
      setCurrentRadius(normalizedProfile.radius || INITIAL_CURRENT_USER.radius);
      setIsAuthenticated(true);
      setIsAuthReady(true);
    });

    return unsubscribe;
  }, []);

  const persistCurrentUserPatch = async (patch) => {
    const userId = auth.currentUser?.uid || currentUser.id;

    if (!userId || userId === 'me') {
      return;
    }

    await setDoc(doc(db, 'users', userId), toStoredProfile({ ...currentUser, ...patch }), { merge: true });
  };

  const visibleProfiles = useMemo(() => users.filter((user) => {
    if (!currentUser.searchActive) {
      return false;
    }
    if (dismissedProfiles.includes(user.id)) {
      return false;
    }
    if (user.distanceKm > currentRadius) {
      return false;
    }
    if (photoAgeFilter && user.profilePhotoAgeMonths < photoAgeFilter) {
      return false;
    }
    if (!isMutualAgeMatch(currentUser, user)) {
      return false;
    }
    return getCompatibility(currentUser.preferences, user.preferences) >= 30;
  }), [currentRadius, currentUser, dismissedProfiles, photoAgeFilter, users]);

  const matchedProfiles = chats
    .filter((chat) => chat.match)
    .map((chat) => users.find((user) => user.id === chat.userId))
    .filter(Boolean);

  const nearbyOnlineProfiles = visibleProfiles.filter((profile) => profile.online).slice(0, 3);
  const selectedProfile = users.find((profile) => profile.id === selectedProfileId) || visibleProfiles[0] || users[0];

  const login = async ({ identifier, password }) => {
    const normalizedEmail = identifier.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Bitte eine gueltige E-Mail-Adresse eingeben.');
    }

    try {
      const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await reload(credentials.user);

      if (!credentials.user.emailVerified) {
        const resendWorked = await trySendVerificationEmail(credentials.user);
        await trySignOut();
        if (resendWorked) {
          throw new Error('Bitte bestaetige zuerst deine E-Mail-Adresse. Wir haben dir soeben erneut eine Verifizierungs-Mail gesendet. Bitte pruefe auch deinen Spam-Ordner.');
        }
        throw new Error('Dein Konto wurde angelegt, aber die Verifizierungs-Mail konnte nicht gesendet werden. Bitte pruefe die Firebase-E-Mail-Vorlagen und versuche es erneut.');
      }

      const profileSnapshot = await getDoc(doc(db, 'users', credentials.user.uid));
      const profileData = profileSnapshot.exists() ? profileSnapshot.data() : { id: credentials.user.uid, email: credentials.user.email };
      const normalizedProfile = normalizeUserProfile(profileData, credentials.user);

      setCurrentUser(normalizedProfile);
      setCurrentRadius(normalizedProfile.radius || INITIAL_CURRENT_USER.radius);
      setIsAuthenticated(true);

      return { requiresPasswordChange: false, needsOnboarding: !normalizedProfile.onboardingCompleted };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Login fehlgeschlagen.'));
    }
  };

  const logout = async () => {
    await trySignOut();
    setIsAuthenticated(false);
    setCurrentUser(createDefaultCurrentUser());
  };

  const requestPasswordReset = async (identifier) => {
    const normalizedEmail = identifier.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Bitte eine gueltige E-Mail-Adresse eingeben.');
    }

    try {
      await sendPasswordResetEmail(auth, normalizedEmail);
      return true;
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Passwort-Reset fehlgeschlagen.'));
    }
  };

  const changePassword = async (newPassword) => {
    if (!auth.currentUser) {
      throw new Error('Du musst eingeloggt sein, um dein Passwort zu aendern.');
    }

    try {
      await updatePassword(auth.currentUser, newPassword);
      setCurrentUser((previous) => ({ ...previous, forcePasswordChange: false }));
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Passwort konnte nicht geaendert werden.'));
    }
  };

  const register = async (payload) => {
    if (payload.age < 18) {
      throw new Error('Registrierung erst ab 18 Jahren.');
    }

    try {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const credentials = await withTimeout(
        createUserWithEmailAndPassword(auth, normalizedEmail, payload.password),
        15000,
        'Die Registrierung hat beim Anlegen des Kontos zu lange gedauert. Bitte pruefe Netzwerk und Firebase-Konfiguration.'
      );
      const profile = buildRegistrationProfile(payload, credentials.user.uid);
      const profileSaved = await tryStoreRegistrationProfile(profile, credentials.user.uid);
      const emailSent = await trySendVerificationEmail(credentials.user);
      await withTimeout(
        trySignOut(),
        5000,
        'Die Registrierung wurde angelegt, aber die Abmeldung danach hat zu lange gedauert.'
      );

      setPendingVerificationId(credentials.user.uid);
      return {
        profile: normalizeUserProfile(profile, credentials.user),
        emailSent,
        profileSaved,
      };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Registrierung fehlgeschlagen.'));
    }
  };

  const verifyPendingEmail = async () => {
    if (!auth.currentUser) {
      return false;
    }

    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      setCurrentUser((previous) => ({ ...previous, emailVerified: true }));
      await persistCurrentUserPatch({ emailVerified: true });
      setPendingVerificationId(null);
      return true;
    }

    return false;
  };

  const resendVerificationEmail = async ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new Error('Bitte eine gueltige E-Mail-Adresse eingeben.');
    }

    if (!password) {
      throw new Error('Bitte gib dein Passwort ein, damit wir die Verifizierungs-Mail erneut senden koennen.');
    }

    try {
      const credentials = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      await reload(credentials.user);

      if (credentials.user.emailVerified) {
        await trySignOut();
        return { alreadyVerified: true };
      }

      const emailSent = await trySendVerificationEmail(credentials.user);
      await trySignOut();

      if (!emailSent) {
        throw new Error('Die Verifizierungs-Mail konnte nicht gesendet werden. Bitte pruefe die Firebase-E-Mail-Vorlagen und versuche es erneut.');
      }

      return { alreadyVerified: false };
    } catch (error) {
      throw new Error(mapAuthError(error, error?.message || 'Verifizierungs-Mail konnte nicht erneut gesendet werden.'));
    }
  };

  const completeOnboarding = async ({ preferences, taboos }) => {
    const nextUser = {
      ...currentUser,
      preferences,
      taboos,
      onboardingCompleted: true,
      searchActive: true,
    };

    setCurrentUser(nextUser);

    persistCurrentUserPatch({ preferences, taboos, onboardingCompleted: true, searchActive: true }).catch((error) => {
      console.warn('AffairGo onboarding persist warning', error);
    });

    return nextUser;
  };

  const updateCurrentUser = async (patch) => {
    const nextPatch = { ...patch };
    delete nextPatch.password;
    delete nextPatch.repeatPassword;
    delete nextPatch.forcePasswordChange;
    delete nextPatch.email;

    setCurrentUser((previous) => ({ ...previous, ...nextPatch }));
    await persistCurrentUserPatch(nextPatch);
  };

  const addGalleryItem = async () => {
    let nextGallery = currentUser.gallery;

    setCurrentUser((previous) => {
      if (previous.gallery.length >= 10) {
        return previous;
      }

      nextGallery = [
        ...previous.gallery,
        {
          id: `gallery-${Date.now()}`,
          label: `Bild ${previous.gallery.length + 1}`,
          ageLabel: 'Gerade hochgeladen',
        },
      ];

      return {
        ...previous,
        gallery: nextGallery,
      };
    });

    if (nextGallery !== currentUser.gallery) {
      await persistCurrentUserPatch({ gallery: nextGallery });
    }
  };

  const saveTravelPlan = async (mode, payload) => {
    const nextTravelPlans = {
      ...currentUser.travelPlans,
      [mode]: payload,
    };

    setCurrentUser((previous) => ({
      ...previous,
      travelPlans: nextTravelPlans,
    }));

    await persistCurrentUserPatch({ travelPlans: nextTravelPlans });
  };

  const respondToSwipe = (profileId, action) => {
    setSwipeHistory((previous) => [...previous, { profileId, action }]);
    setDismissedProfiles((previous) => [...previous, profileId]);

    if (action === 'like') {
      const existingChat = chats.find((chat) => chat.userId === profileId);
      if (!existingChat) {
        setChats((previous) => [
          {
            id: `c${Date.now()}`,
            userId: profileId,
            match: true,
            inactivityDays: 0,
            messages: [
              { id: `m${Date.now()}`, from: profileId, text: 'Match! Lass uns direkt entspannt starten.', time: 'Jetzt' },
            ],
          },
          ...previous,
        ]);
      }
    }
  };

  const rewindLastSwipe = () => {
    if (currentUser.membership !== 'gold' || !swipeHistory.length) {
      return false;
    }
    const lastSwipe = swipeHistory[swipeHistory.length - 1];
    setSwipeHistory((previous) => previous.slice(0, -1));
    setDismissedProfiles((previous) => previous.filter((id, index) => id !== lastSwipe.profileId || index !== previous.lastIndexOf(lastSwipe.profileId)));
    return true;
  };

  const sendMessage = (userId, text) => {
    if (!text.trim()) {
      return;
    }
    setChats((previous) => {
      const existing = previous.find((chat) => chat.userId === userId);
      if (!existing) {
        return [
          {
            id: `c${Date.now()}`,
            userId,
            match: currentUser.membership === 'gold',
            inactivityDays: 0,
            messages: [{ id: `m${Date.now()}`, from: 'me', text: text.trim(), time: 'Jetzt' }],
          },
          ...previous,
        ];
      }

      return previous.map((chat) =>
        chat.userId === userId
          ? {
              ...chat,
              inactivityDays: 0,
              messages: [...chat.messages, { id: `m${Date.now()}`, from: 'me', text: text.trim(), time: 'Jetzt' }],
            }
          : chat
      );
    });
  };

  const softBlock = (userId) => {
    setChats((previous) => previous.filter((chat) => chat.userId !== userId));
    setDismissedProfiles((previous) => [...previous, userId]);
  };

  const createEvent = (payload) => {
    const nextEvent = {
      id: `e${Date.now()}`,
      title: payload.title,
      date: payload.date,
      time: payload.time,
      address: payload.address,
      distanceKm: 0,
      participants: { total: 1, women: 0, men: 0, divers: 1 },
      maxParticipants: Number(payload.maxParticipants) || 20,
      verifiedOnly: payload.verifiedOnly,
      description: payload.description,
      imageLabel: 'New',
    };
    setEvents((previous) => [nextEvent, ...previous]);
  };

  const registerForEvent = (eventId) => {
    setEvents((previous) =>
      previous.map((event) =>
        event.id === eventId
          ? {
              ...event,
              participants: {
                ...event.participants,
                total: Math.min(event.maxParticipants, event.participants.total + 1),
              },
            }
          : event
      )
    );
  };

  const submitFeatureIdea = (title) => {
    if (!title.trim()) {
      return;
    }
    const nextIdea = { id: `idea-${Date.now()}`, title: title.trim(), reward: '1 Premium-Tag' };
    setFeatureIdeas((previous) => [nextIdea, ...previous]);
    setCurrentUser((previous) => ({ ...previous, points: previous.points + 5 }));
  };

  const activatePlan = async (membership) => {
    setCurrentUser((previous) => ({ ...previous, membership }));
    await persistCurrentUserPatch({ membership });
  };

  const playGame = async (reward) => {
    const nextPoints = currentUser.points + reward;
    setCurrentUser((previous) => ({ ...previous, points: previous.points + reward }));
    await persistCurrentUserPatch({ points: nextPoints });
  };

  const value = {
    isAuthenticated,
    currentUser,
    users,
    events,
    chats,
    featureIdeas,
    currentRadius,
    photoAgeFilter,
    isAuthReady,
    visibleProfiles,
    matchedProfiles,
    nearbyOnlineProfiles,
    selectedProfile,
    pendingVerificationId,
    exploreCities: EXPLORE_CITIES,
    preferenceOptions: PREFERENCE_OPTIONS,
    tabooOptions: TABOO_OPTIONS,
    login,
    logout,
    register,
    verifyPendingEmail,
    resendVerificationEmail,
    requestPasswordReset,
    changePassword,
    completeOnboarding,
    updateCurrentUser,
    addGalleryItem,
    saveTravelPlan,
    respondToSwipe,
    rewindLastSwipe,
    sendMessage,
    softBlock,
    createEvent,
    registerForEvent,
    submitFeatureIdea,
    activatePlan,
    playGame,
    setSelectedProfileId,
    setCurrentRadius,
    setPhotoAgeFilter,
    getCompatibility,
  };

  return <AffairGoContext.Provider value={value}>{children}</AffairGoContext.Provider>;
};

export const useAffairGo = () => {
  const context = useContext(AffairGoContext);
  if (!context) {
    throw new Error('useAffairGo muss innerhalb des Providers verwendet werden.');
  }
  return context;
};