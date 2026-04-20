import { createContext, useContext, useState } from 'react';
import {
    EXPLORE_CITIES,
    INITIAL_CHATS,
    INITIAL_CURRENT_USER,
    INITIAL_EVENTS,
    INITIAL_USERS,
    PREFERENCE_OPTIONS,
    TABOO_OPTIONS,
} from '../data/mockData';

const AffairGoContext = createContext(null);

const clone = (value) => JSON.parse(JSON.stringify(value));

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
  const [currentUser, setCurrentUser] = useState(clone(INITIAL_CURRENT_USER));
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

  const allUsers = [currentUser, ...users];

  const visibleProfiles = users.filter((user) => {
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
  });

  const matchedProfiles = chats
    .filter((chat) => chat.match)
    .map((chat) => users.find((user) => user.id === chat.userId))
    .filter(Boolean);

  const nearbyOnlineProfiles = visibleProfiles.filter((profile) => profile.online).slice(0, 3);
  const selectedProfile = users.find((profile) => profile.id === selectedProfileId) || visibleProfiles[0] || users[0];

  const login = ({ identifier, password }) => {
    const normalized = identifier.trim().toLowerCase();
    const account = allUsers.find(
      (user) => user.email?.toLowerCase() === normalized || user.nickname?.toLowerCase() === normalized
    );

    if (!account) {
      throw new Error('Kein Konto zu dieser E-Mail oder diesem Spitznamen gefunden.');
    }
    if (account.password !== password) {
      throw new Error('Passwort ist nicht korrekt.');
    }
    if (!account.emailVerified) {
      throw new Error('Bitte bestaetige zuerst deine E-Mail-Adresse.');
    }

    if (account.id === 'me') {
      setIsAuthenticated(true);
      setCurrentUser({ ...currentUser });
      return { requiresPasswordChange: currentUser.forcePasswordChange, needsOnboarding: !currentUser.onboardingCompleted };
    }

    const migrated = { ...account };
    setIsAuthenticated(true);
    setCurrentUser(migrated);
    setUsers((previous) => previous.filter((user) => user.id !== account.id));
    return { requiresPasswordChange: migrated.forcePasswordChange, needsOnboarding: !migrated.onboardingCompleted };
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const requestPasswordReset = (identifier) => {
    const normalized = identifier.trim().toLowerCase();
    if (currentUser.email.toLowerCase() === normalized || currentUser.nickname.toLowerCase() === normalized) {
      setCurrentUser((previous) => ({ ...previous, forcePasswordChange: true }));
      return true;
    }
    const userExists = users.some(
      (user) => user.email?.toLowerCase() === normalized || user.nickname?.toLowerCase() === normalized
    );
    if (!userExists) {
      return false;
    }
    setUsers((previous) =>
      previous.map((user) =>
        user.email?.toLowerCase() === normalized || user.nickname?.toLowerCase() === normalized
          ? { ...user, forcePasswordChange: true }
          : user
      )
    );
    return true;
  };

  const changePassword = (newPassword) => {
    setCurrentUser((previous) => ({ ...previous, password: newPassword, forcePasswordChange: false }));
  };

  const register = (payload) => {
    const emailTaken = allUsers.some((user) => user.email?.toLowerCase() === payload.email.toLowerCase());
    if (emailTaken) {
      throw new Error('Diese E-Mail-Adresse ist bereits registriert.');
    }
    const nicknameTaken = allUsers.some(
      (user) => user.nickname?.toLowerCase() === payload.nickname.toLowerCase()
    );
    if (nicknameTaken) {
      throw new Error('Dieser Spitzname ist bereits vergeben.');
    }
    if (payload.age < 18) {
      throw new Error('Registrierung erst ab 18 Jahren.');
    }

    const nextUser = {
      id: `u${Date.now()}`,
      ...payload,
      verified: Boolean(payload.profileImageUploaded),
      profilePhotoAgeMonths: 0,
      gallery: [],
      joinedLabel: 'Heute',
      emailVerified: false,
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
      travelPlans: {
        business: { startDate: '', endDate: '', fromTime: '', toTime: '', postalCode: '', city: '', street: '', visibility: [] },
        vacation: { startDate: '', endDate: '', fromTime: '', toTime: '', postalCode: '', city: '', street: '', visibility: [] },
      },
    };

    setUsers((previous) => [nextUser, ...previous]);
    setPendingVerificationId(nextUser.id);
    return nextUser;
  };

  const verifyPendingEmail = (userId) => {
    setUsers((previous) =>
      previous.map((user) => (user.id === userId ? { ...user, emailVerified: true } : user))
    );
    setPendingVerificationId(null);
  };

  const completeOnboarding = ({ preferences, taboos }) => {
    setCurrentUser((previous) => ({
      ...previous,
      preferences,
      taboos,
      onboardingCompleted: true,
      searchActive: true,
    }));
  };

  const updateCurrentUser = (patch) => {
    setCurrentUser((previous) => ({ ...previous, ...patch }));
  };

  const addGalleryItem = () => {
    setCurrentUser((previous) => {
      if (previous.gallery.length >= 10) {
        return previous;
      }
      return {
        ...previous,
        gallery: [
          ...previous.gallery,
          {
            id: `gallery-${Date.now()}`,
            label: `Bild ${previous.gallery.length + 1}`,
            ageLabel: 'Gerade hochgeladen',
          },
        ],
      };
    });
  };

  const saveTravelPlan = (mode, payload) => {
    setCurrentUser((previous) => ({
      ...previous,
      travelPlans: {
        ...previous.travelPlans,
        [mode]: payload,
      },
    }));
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

  const activatePlan = (membership) => {
    setCurrentUser((previous) => ({ ...previous, membership }));
  };

  const playGame = (reward) => {
    setCurrentUser((previous) => ({ ...previous, points: previous.points + reward }));
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