import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, GENDER_OPTIONS, HAIR_OPTIONS, MONTH_OPTIONS, SEARCH_GENDER_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';
import { getProfileCompletionState } from '../untils/profileStatus';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from '../untils/screenCapture';

const IMAGE_MEDIA_TYPE = ImagePicker.MediaTypeOptions?.Images ?? ImagePicker.MediaType?.Images;

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam oder Scam' },
  { value: 'fraud', label: 'Betrugsverdacht' },
  { value: 'fake_profile', label: 'Fake-Profil' },
  { value: 'harassment', label: 'Belästigung' },
  { value: 'explicit_content', label: 'Unangemessene Inhalte' },
  { value: 'underage', label: 'Minderjährig oder falsches Alter' },
  { value: 'other', label: 'Sonstiges' },
];

const shouldShowPenisSizeField = (gender) => gender === 'männlich' || gender === 'divers' || gender === 'paare';
const shouldShowBraSizeField = (gender) => gender === 'weiblich' || gender === 'divers' || gender === 'paare';

const formatBirthDetails = (profile) => {
  if (profile?.birthLabel) {
    return profile.birthLabel;
  }

  const birthDay = Number(profile?.birthDay);
  const birthMonthIndex = Number(profile?.birthMonth);
  const birthYear = Number(profile?.birthYear);
  const hasBirthDate = Number.isInteger(birthDay)
    && birthDay >= 1
    && Number.isInteger(birthMonthIndex)
    && birthMonthIndex >= 0
    && birthMonthIndex < MONTH_OPTIONS.length
    && Number.isInteger(birthYear)
    && birthYear >= 1900;

  if (hasBirthDate) {
    const birthMonth = MONTH_OPTIONS[birthMonthIndex] || String(birthMonthIndex + 1);
    const ageSuffix = Number.isFinite(Number(profile?.age)) ? ` (${profile.age} Jahre)` : '';
    return `${birthDay}, ${birthMonth} ${birthYear}${ageSuffix}`;
  }

  if (Number.isFinite(Number(profile?.age))) {
    return `Alter ${profile.age} Jahre`;
  }

  return 'Geburtsdatum nicht hinterlegt';
};

const normalizeTextValue = (value) => (typeof value === 'string' ? value.trim() : '');

const getRelationshipStatusLabel = (profile) => normalizeTextValue(
  profile?.relationshipStatus
  || profile?.beziehungsstatus
  || profile?.relationship
  || profile?.relationshipGoal
);

const getZodiacLabel = (profile) => {
  const birthDay = Number(profile?.birthDay);
  const birthMonthIndex = Number(profile?.birthMonth);

  if (!Number.isInteger(birthDay) || birthDay < 1 || !Number.isInteger(birthMonthIndex) || birthMonthIndex < 0 || birthMonthIndex > 11) {
    return '';
  }

  const birthMonth = birthMonthIndex + 1;
  const zodiacRanges = [
    { sign: 'Steinbock', from: [12, 22], to: [1, 20] },
    { sign: 'Wassermann', from: [1, 21], to: [2, 19] },
    { sign: 'Fische', from: [2, 20], to: [3, 20] },
    { sign: 'Widder', from: [3, 21], to: [4, 20] },
    { sign: 'Stier', from: [4, 21], to: [5, 20] },
    { sign: 'Zwillinge', from: [5, 21], to: [6, 21] },
    { sign: 'Krebs', from: [6, 22], to: [7, 22] },
    { sign: 'Loewe', from: [7, 23], to: [8, 23] },
    { sign: 'Jungfrau', from: [8, 24], to: [9, 23] },
    { sign: 'Waage', from: [9, 24], to: [10, 23] },
    { sign: 'Skorpion', from: [10, 24], to: [11, 22] },
    { sign: 'Schuetze', from: [11, 23], to: [12, 21] },
  ];

  const inRange = ([fromMonth, fromDay], [toMonth, toDay]) => {
    if (fromMonth <= toMonth) {
      return (
        (birthMonth > fromMonth || (birthMonth === fromMonth && birthDay >= fromDay))
        && (birthMonth < toMonth || (birthMonth === toMonth && birthDay <= toDay))
      );
    }

    return (
      birthMonth > fromMonth
      || birthMonth < toMonth
      || (birthMonth === fromMonth && birthDay >= fromDay)
      || (birthMonth === toMonth && birthDay <= toDay)
    );
  };

  return zodiacRanges.find((entry) => inRange(entry.from, entry.to))?.sign || '';
};

const hasDisplayValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(normalizeTextValue(value) || Number.isFinite(Number(value)));
};

const buildProfileFactRows = (profile, zodiacLabel) => [
  { label: 'Ort', value: profile?.city },
  { label: 'Geschlecht', value: profile?.gender },
  { label: 'Sternzeichen', value: zodiacLabel },
  { label: 'Koerpergroesse', value: profile?.height },
  { label: 'Figur', value: profile?.figure },
  { label: 'Haarfarbe', value: profile?.hairColor },
  { label: 'Augenfarbe', value: profile?.eyeColor },
  { label: 'Hauttyp', value: profile?.skinType },
  { label: 'Penisgroesse', value: profile?.penisSize },
  { label: 'BH-Groesse', value: profile?.braSize },
].filter((entry) => hasDisplayValue(entry.value));

const buildSearchFactRows = (profile) => {
  const searchAgeMin = Number(profile?.searchAgeMin);
  const searchAgeMax = Number(profile?.searchAgeMax);
  const ageRange = Number.isFinite(searchAgeMin) && Number.isFinite(searchAgeMax)
    ? `${searchAgeMin} bis ${searchAgeMax} Jahre`
    : '';

  return [
    { label: 'Gesuchtes Alter', value: ageRange },
    { label: 'Ich suche nach', value: Array.isArray(profile?.searchGenders) ? profile.searchGenders.join(', ') : '' },
  ].filter((entry) => hasDisplayValue(entry.value));
};

const ProfilScreen = () => {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, users, chats, updateCurrentUser, addGalleryItem, logout, preferenceOptions, tabooOptions, getMatchEligibility, changePassword, getProfileTravelSummary, verifyPendingEmail, accessStatusLabel, confirmPendingNickname, exportMyData, requestAccountDeletion, updateProfilePhoto, reportUser, moderationBackendConfigured, moderationAuditTrail, moderationFlags } = useAffairGo();
  const isCompactWeb = Platform.OS === 'web' && width < 768;
  const viewedProfile = useMemo(() => (route.params?.profileId ? users.find((entry) => entry.id === route.params.profileId) : currentUser), [currentUser, route.params?.profileId, users]);
  const isOwnProfile = !route.params?.profileId || route.params.profileId === currentUser.id;
  const [draft, setDraft] = useState(currentUser);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCheckingEmailVerification, setIsCheckingEmailVerification] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportPayload, setExportPayload] = useState('');
  const [isConfirmingNickname, setIsConfirmingNickname] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isRequestingDeletion, setIsRequestingDeletion] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [uploadFeedback, setUploadFeedback] = useState('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (isOwnProfile) {
      setDraft(currentUser);
      return;
    }

    if (viewedProfile) {
      setDraft(viewedProfile);
    }
  }, [currentUser, isOwnProfile, viewedProfile]);

  const updateField = (key, value) => {
    setSaveFeedback('');
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const updateSearchAgeField = (key, value) => {
    const numericValue = Number.parseInt(String(value).replace(/\D/g, ''), 10);

    setDraft((previous) => ({
      ...previous,
      [key]: Number.isFinite(numericValue) ? numericValue : '',
    }));
    setSaveFeedback('');
  };
  const toggleListValue = (key, value) => {
    setSaveFeedback('');
    setDraft((previous) => ({
      ...previous,
      [key]: previous[key].includes(value) ? previous[key].filter((entry) => entry !== value) : [...previous[key], value],
    }));
  };
  const save = async () => {
    try {
      setSaveFeedback('');
      const result = await updateCurrentUser(draft);
      if (result?.changed && result?.pendingEmail) {
        setSaveFeedback(`Aenderung gespeichert. Bitte bestaetige jetzt ${result.pendingEmail} per E-Mail.`);
        Alert.alert('Bestätigung erforderlich', `Deine neue E-Mail-Adresse ${result.pendingEmail} muss erst bestätigt werden. Bitte prüfe dein Postfach.`);
        return;
      }

      if (result?.pendingEmailCleared) {
        setSaveFeedback('Profil gespeichert. Die ausstehende E-Mail-Aenderung wurde entfernt.');
        Alert.alert('Gespeichert', 'Die ausstehende E-Mail-Änderung wurde entfernt. Deine bisherige E-Mail-Adresse bleibt aktiv.');
        return;
      }

      if (result?.pendingNickname) {
        setSaveFeedback(`Profil gespeichert. Spitzname ${result.pendingNickname} ist vorgemerkt.`);
        Alert.alert('Spitzname vorgemerkt', `Dein neuer Spitzname ${result.pendingNickname} ist vorgemerkt. Übernimm ihn danach separat im Profil.`);
        return;
      }

      setSaveFeedback('Deine Profilaenderungen wurden gespeichert.');
      Alert.alert('Gespeichert', 'Dein Profil wurde aktualisiert.');
    } catch (saveError) {
      setSaveFeedback('');
      Alert.alert('Fehler', saveError.message || 'Profil konnte nicht gespeichert werden.');
    }
  };
  const savePassword = async () => {
    if (!newPassword || newPassword !== repeatPassword) {
      setPasswordError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    try {
      await changePassword({ currentPassword, newPassword });
      setPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setPasswordError('');
      Alert.alert('Gespeichert', 'Dein Passwort wurde aktualisiert.');
    } catch (changeError) {
      setPasswordError(changeError.message || 'Passwort konnte nicht geändert werden.');
    }
  };

  const checkEmailVerification = async () => {
    try {
      setIsCheckingEmailVerification(true);
      const verified = await verifyPendingEmail();

      if (verified) {
        Alert.alert('Bestätigt', 'Deine E-Mail-Bestätigung wurde übernommen.');
        return;
      }

      Alert.alert('Noch offen', 'Es liegt noch keine bestätigte E-Mail vor. Bitte öffne zuerst den Link aus der Bestätigungs-Mail.');
    } catch (verificationError) {
      Alert.alert('Fehler', verificationError.message || 'Der Bestätigungsstatus konnte nicht geprüft werden.');
    } finally {
      setIsCheckingEmailVerification(false);
    }
  };

  const handleConfirmPendingNickname = async () => {
    try {
      setIsConfirmingNickname(true);
      const result = await confirmPendingNickname();

      if (result?.changed) {
        setDraft((previous) => ({ ...previous, nickname: result.nickname, pendingNickname: '' }));
        Alert.alert('Spitzname übernommen', `Dein sichtbarer Spitzname ist jetzt ${result.nickname}.`);
      }
    } catch (error) {
      Alert.alert('Spitzname konnte nicht übernommen werden', error.message || 'Bitte versuche es erneut.');
    } finally {
      setIsConfirmingNickname(false);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExportingData(true);
      const exportText = await exportMyData();
      setExportPayload(exportText);
      setExportModalOpen(true);
    } catch (error) {
      Alert.alert('Datenexport fehlgeschlagen', error.message || 'Der Export konnte nicht erzeugt werden.');
    } finally {
      setIsExportingData(false);
    }
  };

  const handleRequestDeletion = () => {
    Alert.alert(
      'Löschanfrage starten',
      'Dein Profil wird aus der aktiven Suche genommen und die Löschung zur weiteren Bearbeitung markiert. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschung anfragen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRequestingDeletion(true);
              const requestedAt = await requestAccountDeletion();
              setDraft((previous) => ({ ...previous, accountDeletionRequestedAt: requestedAt, searchActive: false }));
              Alert.alert('Löschanfrage gespeichert', 'Dein Konto wurde als Löschanfrage markiert und aus der aktiven Sichtbarkeit genommen.');
            } catch (error) {
              Alert.alert('Löschanfrage fehlgeschlagen', error.message || 'Die Löschanfrage konnte nicht gespeichert werden.');
            } finally {
              setIsRequestingDeletion(false);
            }
          },
        },
      ]
    );
  };

  const pickImageAsset = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error('Bitte erlaube den Zugriff auf deine Mediathek.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: IMAGE_MEDIA_TYPE,
      allowsEditing: true,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return result.assets[0];
  };

  const handleUploadProfilePhoto = async () => {
    try {
      setUploadFeedback('');
      setIsUploadingMedia(true);
      const asset = await pickImageAsset();
      if (!asset) {
        return;
      }

      const uploadResult = await updateProfilePhoto(asset);
      setDraft((previous) => ({
        ...previous,
        profilePhotoUrl: uploadResult.profilePhotoUrl,
        profileImageUri: uploadResult.profileImageUri,
        profilePhotoAgeMonths: 0,
        verificationState: uploadResult.verificationState || 'uploaded',
      }));
      setUploadFeedback('Profilbild gespeichert.');
      Alert.alert(
        'Profilbild aktualisiert',
        'Das Profilbild wurde gespeichert.'
      );
    } catch (error) {
      setUploadFeedback(error.message || 'Profilbild konnte nicht hochgeladen werden.');
      Alert.alert('Profilbild konnte nicht hochgeladen werden', error.message || 'Bitte versuche es erneut.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleAddGalleryImage = async () => {
    try {
      setIsUploadingMedia(true);
      const asset = await pickImageAsset();
      if (!asset) {
        return;
      }

      await addGalleryItem(asset);
      setDraft((previous) => ({
        ...previous,
        gallery: [
          ...previous.gallery,
          {
            id: `gallery-preview-${Date.now()}`,
            label: `Bild ${previous.gallery.length + 1}`,
            ageLabel: 'Gerade hochgeladen',
            imageUri: asset.uri,
          },
        ],
      }));
      Alert.alert('Galeriebild gespeichert', 'Dein Bild wurde in die Galerie aufgenommen.');
    } catch (error) {
      Alert.alert('Galeriebild konnte nicht gespeichert werden', error.message || 'Bitte versuche es erneut.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleReportUser = async () => {
    if (!viewedProfile?.id || isOwnProfile) {
      return;
    }

    try {
      setIsSubmittingReport(true);
      const result = await reportUser({
        targetUserId: viewedProfile.id,
        reason: reportReason,
        description: reportDescription,
      });
      setReportModalOpen(false);
      setReportDescription('');
      setReportReason(REPORT_REASONS[0].value);
      Alert.alert('Meldung gespeichert', result.message || 'Das Profil wurde an die Moderation übergeben.');
    } catch (error) {
      Alert.alert('Meldung fehlgeschlagen', error.message || 'Das Profil konnte nicht gemeldet werden.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  useEffect(() => {
    preventScreenCaptureAsync().catch(() => undefined);

    return () => {
      allowScreenCaptureAsync().catch(() => undefined);
    };
  }, []);

  const profile = isOwnProfile ? draft : viewedProfile;

  if (!profile) {
    return null;
  }

  const canSeeSensitiveMatchDetails = isOwnProfile || chats.some((chat) => chat.userId === profile?.id && chat.match);
  const moderationProfile = isOwnProfile ? currentUser : profile;
  const travelSummary = getProfileTravelSummary(profile);
  const verificationTone = profile.verificationState === 'expired'
    ? 'danger'
    : profile.verificationState === 'review'
      ? 'warning'
      : profile.verificationState === 'uploaded'
        ? 'neutral'
        : 'success';
  const verificationLabel = profile.verificationState === 'expired'
    ? 'Foto veraltet'
    : profile.verificationState === 'review'
      ? 'Prüfung offen'
      : profile.verificationState === 'uploaded'
        ? 'Profilbild hochgeladen'
        : 'Verifiziert';
  const ageVerificationTone = profile.ageVerified ? 'success' : profile.ageVerificationStatus === 'pending' ? 'warning' : 'neutral';
  const ageVerificationLabel = profile.ageVerified
    ? '18+ bestätigt'
    : profile.ageVerificationStatus === 'pending'
      ? '18+ in Prüfung'
      : '18+ offen';
  const moderationTone = moderationProfile?.moderationState === 'restricted' ? 'danger' : moderationProfile?.moderationState === 'review' ? 'warning' : 'success';
  const moderationLabel = moderationProfile?.moderationState === 'restricted' ? 'Sicherheitsstatus eingeschränkt' : moderationProfile?.moderationState === 'review' ? 'Moderation prüft' : 'Sicherheitsstatus unauffällig';
  const recentModerationEntries = (moderationAuditTrail || []).slice(0, 5);
  const viewedProfileMatch = !isOwnProfile && profile ? getMatchEligibility(currentUser, profile) : null;

  const profileCompletion = getProfileCompletionState(profile);
  const zodiacLabel = getZodiacLabel(profile);
  const relationshipStatusLabel = getRelationshipStatusLabel(profile);
  const fullName = [profile.firstName, profile.lastName].filter((value) => normalizeTextValue(value)).join(' ').trim();
  const displayName = isOwnProfile ? (fullName || profile.nickname) : (profile.nickname || fullName || 'Profil');
  const secondaryNameLine = isOwnProfile
    ? (profile.nickname && profile.nickname !== displayName ? profile.nickname : '')
    : (fullName && fullName !== displayName ? fullName : '');
  const heroMetaLine = [
    Number.isFinite(Number(profile.age)) ? `${profile.age} Jahre` : '',
    zodiacLabel,
    relationshipStatusLabel || profile.gender,
  ].filter(Boolean).join(' • ');
  const profileFactRows = buildProfileFactRows(profile, zodiacLabel);
  const searchFactRows = buildSearchFactRows(profile);
  const galleryItems = Array.isArray(profile.gallery) ? profile.gallery : [];
  const shouldShowGallery = isOwnProfile || galleryItems.length > 0;

  return (
    <AppBackground>
      <ScreenHeader
        title={isOwnProfile ? 'Dein Profil' : profile.nickname}
        subtitle={isOwnProfile ? 'Persönliche Daten' : `${viewedProfileMatch?.commonPreferenceCount || 0} gemeinsame Vorlieben`}
        leftAction={!isOwnProfile ? (
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.accentSoft} />
          </Pressable>
        ) : null}
      />

      <GlassCard strong style={styles.heroCard}>
        <View style={styles.avatar}>
          {profile.profileImageUri ? (
            <Image source={{ uri: profile.profileImageUri }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <Ionicons name="person" size={76} color={affairGoTheme.colors.text} />
          )}
        </View>
        {isOwnProfile ? <AccentButton label={isUploadingMedia ? 'Bild wird hochgeladen...' : 'Profilbild ändern'} variant="secondary" onPress={handleUploadProfilePhoto} disabled={isUploadingMedia} style={styles.avatarButton} /> : null}
        {isOwnProfile && uploadFeedback ? <Text style={styles.uploadFeedback}>{uploadFeedback}</Text> : null}
        <Text style={styles.nameLine}>{displayName}</Text>
        {secondaryNameLine ? <Text style={styles.nameSecondary}>{secondaryNameLine}</Text> : null}
        <Text style={styles.metaLine}>{formatBirthDetails(profile)}</Text>
        {heroMetaLine ? <Text style={styles.heroMetaLine}>{heroMetaLine}</Text> : null}
        <View style={styles.heroStatusRow}>
          <StatusPill label={verificationLabel} tone={verificationTone} style={styles.statusPill} />
          <StatusPill label={ageVerificationLabel} tone={ageVerificationTone} style={styles.statusPill} />
          {isOwnProfile ? <StatusPill label={moderationLabel} tone={moderationTone} style={styles.statusPill} /> : null}
        </View>
        {profile.ageVerificationProvider ? <Text style={styles.photoAge}>Altersprüfung: bestätigt</Text> : null}
        <Text style={styles.photoAge}>
          {profile.profilePhotoUrl || profile.profileImageUri
            ? `Profilbild hochgeladen: vor ${profile.profilePhotoAgeMonths} Monaten`
            : 'Noch kein Profilbild gespeichert'}
        </Text>
        {profile.profilePhotoAgeMonths >= 12 ? <Text style={styles.warnRed}>Rote Warnung: Profilbild älter als 12 Monate</Text> : null}
        {profile.profilePhotoAgeMonths >= 6 && profile.profilePhotoAgeMonths < 12 ? <Text style={styles.warnSoft}>Hinweis: Profilbild älter als 6 Monate</Text> : null}
        {!isOwnProfile ? <AccentButton label="Profil melden" variant="secondary" onPress={() => setReportModalOpen(true)} style={styles.avatarButton} /> : null}
      </GlassCard>

      {isOwnProfile ? (
        <GlassCard style={styles.infoCard}>
          <View style={styles.completionHeader}>
            <View style={styles.completionCopy}>
              <Text style={styles.groupTitle}>Profil-Vollständigkeit</Text>
              <Text style={styles.copyLine}>Dein Profil bleibt sichtbar, je vollständiger die Basisdaten und das Profilbild gepflegt sind.</Text>
            </View>
            <StatusPill label={`${profileCompletion.percent}% vollständig`} tone={profileCompletion.isComplete ? 'success' : 'warning'} />
          </View>
          {profileCompletion.isComplete ? (
            <Text style={styles.readonlyLine}>Alle Pflichtangaben für die Profilfreigabe sind vorhanden.</Text>
          ) : (
            <Text style={styles.readonlyLine}>Es fehlen noch: {profileCompletion.missingFieldLabels.join(', ')}.</Text>
          )}
        </GlassCard>
      ) : null}

      {travelSummary || isOwnProfile ? (
        <GlassCard style={styles.infoCard}>
          <Text style={styles.groupTitle}>Reiseplanung</Text>
          {travelSummary ? (
            <>
              <Text style={styles.readonlyLine}>{travelSummary.label}</Text>
              {travelSummary.location ? <Text style={styles.readonlyLine}>Ort: {travelSummary.location}</Text> : null}
              {travelSummary.period ? <Text style={styles.readonlyLine}>Zeitraum: {travelSummary.period}</Text> : null}
            </>
          ) : (
            <Text style={styles.copyLine}>Plane Urlaub oder Dienstreise direkt aus deinem Profil. Die vorhandene Reiseplanung bleibt die zentrale Quelle für Dashboard und Matching Map.</Text>
          )}
          {isOwnProfile ? (
            <View style={styles.travelActionRow}>
              <AccentButton label="Urlaub" variant="secondary" onPress={() => navigation.navigate('TravelPlanner', { mode: 'vacation' })} style={styles.travelActionButton} />
              <AccentButton label="Dienstreise" variant="secondary" onPress={() => navigation.navigate('TravelPlanner', { mode: 'business' })} style={styles.travelActionButton} />
            </View>
          ) : null}
        </GlassCard>
      ) : null}

      <GlassCard style={styles.infoCard}>
              {isOwnProfile ? (
                <>
                  <Text style={styles.groupTitle}>Zugang und Sichtbarkeit</Text>
                  <Text style={styles.readonlyLine}>Aktueller Zugang: {accessStatusLabel}</Text>
                  <View style={styles.visibilityBox}>
                    <Text style={styles.visibilityTitle}>Matchingvoraussetzungen</Text>
                    <Text style={styles.visibilityText}>Du siehst nur Profile, deren Alter und Suchziel zu dir passen. Gleichzeitig bist du auch nur für diese Personen sichtbar.</Text>
                    <View style={[styles.filterToggleRow, isCompactWeb && styles.filterToggleRowCompact]}>
                      <Text style={styles.filterToggleText}>Nur verifizierte Matches anzeigen</Text>
                      <ToggleChip label="Nur verifiziert" active={Boolean(profile.verifiedMatchesOnly)} onPress={() => updateField('verifiedMatchesOnly', !profile.verifiedMatchesOnly)} />
                    </View>
                    <View style={[styles.filterToggleRow, isCompactWeb && styles.filterToggleRowCompact]}>
                      <Text style={styles.filterToggleText}>Community-Aktivität aggregiert anzeigen</Text>
                      <ToggleChip label={profile.showCommunityActivityStatus === false ? 'Verborgen' : 'Sichtbar'} active={profile.showCommunityActivityStatus !== false} onPress={() => updateField('showCommunityActivityStatus', profile.showCommunityActivityStatus === false)} />
                    </View>
                    <Text style={styles.visibilityText}>Wenn du diesen Status verbirgst, tauchst du weder individuell noch in aggregierten Community-Aktivitätszahlen auf.</Text>
                    <View style={[styles.row, isCompactWeb && styles.rowCompact]}>
                      <View style={[styles.half, isCompactWeb && styles.halfCompact]}>
                        <FormField
                          label="Suche Alter von"
                          value={String(profile.searchAgeMin ?? '')}
                          onChangeText={(value) => updateSearchAgeField('searchAgeMin', value)}
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={[styles.half, isCompactWeb && styles.halfCompact]}>
                        <FormField
                          label="Suche Alter bis"
                          value={String(profile.searchAgeMax ?? '')}
                          onChangeText={(value) => updateSearchAgeField('searchAgeMax', value)}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <Text style={styles.pickerLabel}>Ich suche nach</Text>
                    <View style={styles.chipsCompact}>
                      {SEARCH_GENDER_OPTIONS.map((item) => (
                        <View key={item} style={styles.chipItem}>
                          <ToggleChip label={item} active={profile.searchGenders.includes(item)} onPress={() => toggleListValue('searchGenders', item)} />
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.sectionSpacer} />
                  <Text style={styles.groupTitle}>Persönlich</Text>
                  <Text style={styles.readonlyLine}>{formatBirthDetails(profile)}</Text>
                  {zodiacLabel ? <Text style={styles.readonlyLine}>Sternzeichen: {zodiacLabel}</Text> : null}
                  {relationshipStatusLabel ? <Text style={styles.readonlyLine}>Beziehungsstatus: {relationshipStatusLabel}</Text> : null}
                  <FormField label="Bestätigte E-Mail-Adresse" value={profile.email} onChangeText={(value) => updateField('email', value)} hint="Änderung wird erst nach Bestätigung aktiv" />
                  {profile.pendingEmail ? (
                    <View style={styles.pendingEmailBox}>
                      <Text style={styles.pendingEmailTitle}>Ausstehende E-Mail-Änderung</Text>
                      <Text style={styles.pendingEmailText}>{profile.pendingEmail}</Text>
                      <Text style={styles.pendingEmailHint}>Diese Adresse wird erst aktiv, wenn du den Bestätigungslink aus der E-Mail öffnest.</Text>
                      <AccentButton
                        label={isCheckingEmailVerification ? 'Bestätigung wird geprüft...' : 'Bestätigung prüfen'}
                        variant="secondary"
                        onPress={checkEmailVerification}
                        disabled={isCheckingEmailVerification}
                        style={styles.pendingEmailButton}
                      />
                    </View>
                  ) : null}
                  {profile.pendingNickname ? (
                    <View style={styles.pendingEmailBox}>
                      <Text style={styles.pendingEmailTitle}>Ausstehender Spitzname</Text>
                      <Text style={styles.pendingEmailText}>{profile.pendingNickname}</Text>
                      <Text style={styles.pendingEmailHint}>Der neue Spitzname wird erst nach deiner ausdrücklichen Bestätigung sichtbar übernommen.</Text>
                      <AccentButton
                        label={isConfirmingNickname ? 'Spitzname wird übernommen...' : 'Spitzname übernehmen'}
                        variant="secondary"
                        onPress={handleConfirmPendingNickname}
                        disabled={isConfirmingNickname}
                        style={styles.pendingEmailButton}
                      />
                    </View>
                  ) : null}
                  <FormField label="Spitzname" value={profile.nickname} onChangeText={(value) => updateField('nickname', value)} hint="Öffentlich sichtbar, nur falls verfügbar" />
                  <View style={[styles.row, isCompactWeb && styles.rowCompact]}>
                    <View style={[styles.half, isCompactWeb && styles.halfCompact]}><FormField label="Vorname" value={profile.firstName} onChangeText={(value) => updateField('firstName', value)} /></View>
                    <View style={[styles.half, isCompactWeb && styles.halfCompact]}><FormField label="Nachname" value={profile.lastName} onChangeText={(value) => updateField('lastName', value)} /></View>
                  </View>
                  <FormField label="Ort" value={profile.city} onChangeText={(value) => updateField('city', value)} />
                  <Text style={styles.pickerLabel}>Geschlecht</Text>
                  <View style={styles.chipsCompact}>
                    {GENDER_OPTIONS.map((item) => (
                      <View key={item} style={styles.chipItem}>
                        <ToggleChip label={item} active={profile.gender === item} onPress={() => updateField('gender', item)} />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.groupTitle}>Aussehen</Text>
                  <View style={[styles.row, isCompactWeb && styles.rowCompact]}>
                    <View style={[styles.half, isCompactWeb && styles.halfCompact]}><FormField label="Körpergröße" value={profile.height} onChangeText={(value) => updateField('height', value)} /></View>
                    <View style={[styles.half, isCompactWeb && styles.halfCompact]}><Text style={styles.pickerLabel}>Figur</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.figure} onValueChange={(value) => updateField('figure', value)}>{FIGURE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
                  </View>
                  <AccentButton label="Passwort ändern" variant="secondary" onPress={() => setPasswordModalOpen(true)} style={styles.passwordButton} />
                  {shouldShowPenisSizeField(profile.gender) ? <FormField label="Penisgröße" value={profile.penisSize} onChangeText={(value) => updateField('penisSize', value)} /> : null}
                  {shouldShowBraSizeField(profile.gender) ? <FormField label="BH-Größe" value={profile.braSize} onChangeText={(value) => updateField('braSize', value)} /> : null}
                  <View style={[styles.row, isCompactWeb && styles.rowCompact]}>
                    <View style={[styles.half, isCompactWeb && styles.halfCompact]}><Text style={styles.pickerLabel}>Haarfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.hairColor} onValueChange={(value) => updateField('hairColor', value)}>{HAIR_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
                    <View style={[styles.half, isCompactWeb && styles.halfCompact]}><Text style={styles.pickerLabel}>Augenfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.eyeColor} onValueChange={(value) => updateField('eyeColor', value)}>{EYE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
                  </View>
                  <Text style={styles.pickerLabel}>Hauttyp</Text>
                  <View style={styles.pickerWrap}><Picker selectedValue={profile.skinType} onValueChange={(value) => updateField('skinType', value)}>{SKIN_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View>
                  <Text style={styles.groupTitle}>Suche</Text>
                  {searchFactRows.length ? (
                    <View style={styles.factList}>
                      {searchFactRows.map((entry) => (
                        <View key={entry.label} style={styles.factRow}>
                          <Text style={styles.factLabel}>{entry.label}</Text>
                          <Text style={styles.factValue}>{entry.value}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <AccentButton label="Profil speichern" onPress={save} style={styles.saveButton} />
                  {saveFeedback ? <Text style={styles.saveFeedback}>{saveFeedback}</Text> : null}
                </>
              ) : (
                <>
                  <Text style={styles.groupTitle}>Profil</Text>
                  <View style={styles.factList}>
                    {profileFactRows.map((entry) => (
                      <View key={entry.label} style={styles.factRow}>
                        <Text style={styles.factLabel}>{entry.label}</Text>
                        <Text style={styles.factValue}>{entry.value}</Text>
                      </View>
                    ))}
                  </View>
                  {searchFactRows.length ? (
                    <>
                      <Text style={styles.groupTitle}>Suche</Text>
                      <View style={styles.factList}>
                        {searchFactRows.map((entry) => (
                          <View key={entry.label} style={styles.factRow}>
                            <Text style={styles.factLabel}>{entry.label}</Text>
                            <Text style={styles.factValue}>{entry.value}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : null}
                  <AccentButton label="Direkt schreiben" variant="secondary" onPress={() => navigation.navigate('Chat', { userId: profile.id })} style={styles.passwordButton} />
                </>
              )}
            </GlassCard>

            {isOwnProfile ? (
              <GlassCard style={styles.infoCard}>
                <Text style={styles.groupTitle}>Datenschutz und Konto</Text>
                <Text style={styles.copyLine}>Datenexport zuletzt angefordert: {profile.dataExportRequestedAt || 'Noch nie'}</Text>
                <Text style={styles.copyLine}>Löschanfrage: {profile.accountDeletionRequestedAt || 'Keine offene Anfrage'}</Text>
                <AccentButton label={isExportingData ? 'Datenexport wird erstellt...' : 'Datenexport erstellen'} variant="secondary" onPress={handleExportData} style={styles.privacyButton} disabled={isExportingData} />
                <AccentButton label={isRequestingDeletion ? 'Löschanfrage wird gespeichert...' : 'Konto-Löschung anfragen'} variant="ghost" onPress={handleRequestDeletion} disabled={isRequestingDeletion} />
                <AccentButton
                  label="Abmelden"
                  variant="secondary"
                  onPress={async () => {
                    await logout();
                    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                  }}
                  style={styles.logoutButton}
                />
              </GlassCard>
            ) : null}

      <GlassCard style={styles.infoCard}>
        <Text style={styles.groupTitle}>Vorlieben</Text>
        {canSeeSensitiveMatchDetails ? (
          <>
            <View style={styles.chips}>
              {preferenceOptions.map((item) => (
                <View key={item} style={styles.chipItem}>
                  <ToggleChip label={item} active={profile.preferences.includes(item)} onPress={() => isOwnProfile && toggleListValue('preferences', item)} />
                </View>
              ))}
            </View>
            <Text style={styles.groupTitle}>Tabus</Text>
            <View style={styles.chips}>
              {tabooOptions.map((item) => (
                <View key={item} style={styles.chipItem}>
                  <ToggleChip label={item} active={profile.taboos.includes(item)} onPress={() => isOwnProfile && toggleListValue('taboos', item)} />
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.copyLine}>Vorlieben und Tabus werden erst sichtbar, wenn zwischen euch ein Match besteht.</Text>
        )}
      </GlassCard>

      {shouldShowGallery ? (
        <GlassCard style={styles.infoCard}>
          <Text style={styles.groupTitle}>Galerie</Text>
          <View style={styles.galleryRow}>
            {galleryItems.map((item) => (
              <View key={item.id} style={[styles.galleryItem, isCompactWeb && styles.galleryItemCompact]}>
                {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.galleryImage} resizeMode="cover" /> : <Ionicons name="image-outline" size={28} color={affairGoTheme.colors.textMuted} />}
                <Text style={styles.galleryLabel}>{item.label}</Text>
                <Text style={styles.galleryAge}>{item.ageLabel}</Text>
              </View>
            ))}
            {isOwnProfile && galleryItems.length < 10 ? (
              <Pressable style={[styles.galleryItem, isCompactWeb && styles.galleryItemCompact]} onPress={handleAddGalleryImage}>
                <Ionicons name="add" size={34} color={affairGoTheme.colors.text} />
                <Text style={styles.galleryLabel}>Foto hinzufügen</Text>
              </Pressable>
            ) : null}
          </View>
        </GlassCard>
      ) : null}

      <Modal transparent visible={passwordModalOpen} animationType="fade" onRequestClose={() => setPasswordModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.groupTitle}>Passwort ändern</Text>
            <FormField label="Aktuelles Passwort" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
            <FormField label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <FormField label="Neues Passwort wiederholen" value={repeatPassword} onChangeText={setRepeatPassword} secureTextEntry />
            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}
            <AccentButton label="Speichern" onPress={savePassword} style={styles.modalButton} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => { setPasswordModalOpen(false); setCurrentPassword(''); setNewPassword(''); setRepeatPassword(''); setPasswordError(''); }} />
          </GlassCard>
        </View>
      </Modal>

      <Modal transparent visible={exportModalOpen} animationType="fade" onRequestClose={() => setExportModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.groupTitle}>Datenexport</Text>
            <ScrollView style={styles.exportScroll}>
              <Text style={styles.exportText}>{exportPayload}</Text>
            </ScrollView>
            <AccentButton label="Schließen" onPress={() => setExportModalOpen(false)} style={styles.modalButton} />
          </GlassCard>
        </View>
      </Modal>

      <Modal transparent visible={reportModalOpen} animationType="fade" onRequestClose={() => setReportModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.groupTitle}>Profil melden</Text>
            <Text style={styles.copyLine}>Meldegrund</Text>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={reportReason} onValueChange={setReportReason}>
                {REPORT_REASONS.map((reasonOption) => <Picker.Item key={reasonOption.value} label={reasonOption.label} value={reasonOption.value} color="#111" />)}
              </Picker>
            </View>
            <FormField label="Beschreibung" value={reportDescription} onChangeText={setReportDescription} placeholder="Was ist passiert?" multiline />
            <AccentButton label={isSubmittingReport ? 'Meldung wird gesendet...' : 'Meldung absenden'} onPress={handleReportUser} style={styles.modalButton} disabled={isSubmittingReport} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => { setReportModalOpen(false); setReportDescription(''); setReportReason(REPORT_REASONS[0].value); }} />
          </GlassCard>
        </View>
      </Modal>

    </AppBackground>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarButton: {
    marginBottom: 12,
  },
  uploadFeedback: {
    color: affairGoTheme.colors.accentSoft,
    marginBottom: 12,
    textAlign: 'center',
  },
  nameLine: {
    color: affairGoTheme.colors.text,
    fontSize: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  metaLine: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    flex: 1,
  },
  securityCard: {
    marginBottom: 14,
  },
  securityTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  securityText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  visibilityBox: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: affairGoTheme.radius.md,
    padding: 14,
    marginTop: 10,
  },
  visibilityTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  visibilityText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginBottom: 12,
  },
  visibilityHint: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginTop: 10,
  },
  filterToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  filterToggleRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  filterToggleText: {
    color: affairGoTheme.colors.text,
    flex: 1,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  rowCompact: {
    flexDirection: 'column',
    marginHorizontal: 0,
  },
  half: {
    flex: 1,
    marginHorizontal: 6,
  },
  halfCompact: {
    marginHorizontal: 0,
  },
  pickerLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerWrap: {
    minHeight: 50,
    borderRadius: affairGoTheme.radius.md,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  saveButton: {
    marginTop: 8,
  },
  saveFeedback: {
    color: affairGoTheme.colors.accentSoft,
    lineHeight: 22,
    marginTop: 10,
  },
  passwordButton: {
    marginBottom: 14,
  },
  sectionSpacer: {
    height: 18,
  },
  pendingEmailBox: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: affairGoTheme.radius.md,
    padding: 14,
    marginBottom: 14,
  },
  pendingEmailTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  pendingEmailText: {
    color: affairGoTheme.colors.accent,
    fontSize: 15,
    marginBottom: 6,
  },
  pendingEmailHint: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  pendingEmailButton: {
    marginTop: 12,
  },
  copyLine: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginBottom: 10,
  },
  privacyButton: {
    marginTop: 6,
    marginBottom: 10,
  },
  travelActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  travelActionButton: {
    flex: 1,
  },
  logoutButton: {
    marginTop: 6,
  },
  readonlyLine: {
    color: affairGoTheme.colors.text,
    lineHeight: 26,
  },
  factList: {
    marginBottom: 12,
  },
  factRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: affairGoTheme.colors.line,
  },
  factLabel: {
    flex: 1,
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
  },
  factValue: {
    flex: 1,
    color: affairGoTheme.colors.text,
    lineHeight: 22,
    textAlign: 'right',
  },
  groupTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chipItem: {
    marginRight: 8,
    marginBottom: 8,
  },
  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryItem: {
    width: '31%',
    minHeight: 120,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: 18,
    marginRight: '2%',
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
  },
  galleryItemCompact: {
    width: '100%',
    marginRight: 0,
  },
  galleryImage: {
    width: '100%',
    height: 60,
    borderRadius: 12,
    marginBottom: 8,
  },
  galleryLabel: {
    color: affairGoTheme.colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  galleryAge: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  passwordError: {
    color: affairGoTheme.colors.danger,
    marginBottom: 12,
  },
  modalButton: {
    marginBottom: 10,
  },
  exportScroll: {
    maxHeight: 320,
    marginBottom: 12,
  },
  exportText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
    fontSize: 12,
  },
  auditList: {
    marginTop: 8,
  },
  auditItem: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: affairGoTheme.radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 12,
    marginBottom: 10,
  },
  auditTitle: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  auditMeta: {
    color: affairGoTheme.colors.textMuted,
    marginBottom: 4,
  },
  auditReason: {
    color: affairGoTheme.colors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  auditFlags: {
    color: affairGoTheme.colors.accentSoft,
    lineHeight: 20,
  },
});

export default ProfilScreen;