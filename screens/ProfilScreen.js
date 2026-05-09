import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { buildFaceLivenessUrl } from '../constants/profilePhotoVerificationProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, HAIR_OPTIONS, MONTH_OPTIONS, SEARCH_GENDER_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from '../untils/screenCapture';

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

  const hasBirthDate = Number.isFinite(Number(profile?.birthDay))
    && Number.isFinite(Number(profile?.birthMonth))
    && Number.isFinite(Number(profile?.birthYear));

  if (hasBirthDate) {
    const birthDay = Number(profile.birthDay);
    const birthMonth = MONTH_OPTIONS[Number(profile.birthMonth)] || String(Number(profile.birthMonth) + 1);
    const birthYear = Number(profile.birthYear);
    const ageSuffix = Number.isFinite(Number(profile?.age)) ? ` (${profile.age} Jahre)` : '';
    return `${birthDay}, ${birthMonth} ${birthYear}${ageSuffix}`;
  }

  if (Number.isFinite(Number(profile?.age))) {
    return `Alter ${profile.age} Jahre`;
  }

  return 'Geburtsdatum nicht hinterlegt';
};

const ProfilScreen = () => {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, users, chats, updateCurrentUser, addGalleryItem, logout, preferenceOptions, tabooOptions, getCompatibility, changePassword, getProfileTravelSummary, verifyPendingEmail, accessStatusLabel, confirmPendingNickname, exportMyData, requestAccountDeletion, updateProfilePhoto, completeProfilePhotoVerification, discardPendingProfilePhotoVerification, launchProfilePhotoLivenessFlow, profilePhotoVerificationConfigured, profilePhotoVerificationSetupInstructions, reportUser, moderationBackendConfigured, moderationAuditTrail, moderationFlags } = useAffairGo();
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
  const [pendingProfilePhotoVerification, setPendingProfilePhotoVerification] = useState(null);
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

  const updateField = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const updateSearchAgeField = (key, value) => {
    const numericValue = Number.parseInt(String(value).replace(/\D/g, ''), 10);

    setDraft((previous) => ({
      ...previous,
      [key]: Number.isFinite(numericValue) ? numericValue : '',
    }));
  };
  const toggleListValue = (key, value) => {
    setDraft((previous) => ({
      ...previous,
      [key]: previous[key].includes(value) ? previous[key].filter((entry) => entry !== value) : [...previous[key], value],
    }));
  };
  const save = async () => {
    try {
      const result = await updateCurrentUser(draft);
      if (result?.changed && result?.pendingEmail) {
        Alert.alert('Bestätigung erforderlich', `Deine neue E-Mail-Adresse ${result.pendingEmail} muss erst bestätigt werden. Bitte prüfe dein Postfach.`);
        return;
      }

      if (result?.pendingEmailCleared) {
        Alert.alert('Gespeichert', 'Die ausstehende E-Mail-Änderung wurde entfernt. Deine bisherige E-Mail-Adresse bleibt aktiv.');
        return;
      }

      if (result?.pendingNickname) {
        Alert.alert('Spitzname vorgemerkt', `Dein neuer Spitzname ${result.pendingNickname} ist vorgemerkt. Übernimm ihn danach separat im Profil.`);
        return;
      }

      Alert.alert('Gespeichert', 'Dein Profil wurde aktualisiert.');
    } catch (saveError) {
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
      mediaTypes: ['images'],
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
      setIsUploadingMedia(true);
      const asset = await pickImageAsset();
      if (!asset) {
        return;
      }

      const verificationSession = await updateProfilePhoto(asset);

      if (verificationSession.directUpload) {
        setPendingProfilePhotoVerification(null);
        setDraft((previous) => ({
          ...previous,
          profilePhotoUrl: verificationSession.profilePhotoUrl,
          profileImageUri: verificationSession.profileImageUri,
          profilePhotoVerified: Boolean(verificationSession.profilePhotoVerified),
          profilePhotoVerifiedAt: verificationSession.profilePhotoVerifiedAt || '',
          faceMatchSimilarity: Number(verificationSession.faceMatchSimilarity || 0),
          profilePhotoAgeMonths: 0,
          verificationState: verificationSession.verificationState || 'uploaded',
        }));
        Alert.alert(
          'Profilbild aktualisiert',
          profilePhotoVerificationConfigured
            ? 'Das Profilbild wurde gespeichert.'
            : 'Das Profilbild wurde direkt gespeichert. Die Live-Selfie-Prüfung ist aktuell nicht konfiguriert.'
        );
        return;
      }

      const nextPendingVerification = {
        ...verificationSession,
        previewUri: asset.uri,
      };

      setPendingProfilePhotoVerification(nextPendingVerification);
      setDraft((previous) => ({
        ...previous,
        verificationState: 'review',
      }));

      await launchProfilePhotoLivenessFlow({
        sessionId: verificationSession.sessionId,
        verificationToken: verificationSession.verificationToken,
      });

      Alert.alert('Live-Selfie starten', 'Die Live-Selfie-Prüfung wurde geöffnet. Kehre danach zurück und tippe auf "Prüfung abschließen".');
    } catch (error) {
      Alert.alert('Profilbild konnte nicht hochgeladen werden', error.message || 'Bitte versuche es erneut.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleCompleteProfilePhotoVerification = async () => {
    if (!pendingProfilePhotoVerification) {
      return;
    }

    try {
      setIsUploadingMedia(true);
      const result = await completeProfilePhotoVerification(pendingProfilePhotoVerification);

      if (result.pending) {
        Alert.alert('Analyse läuft noch', result.message || 'Bitte schließe die Prüfung in wenigen Sekunden erneut ab.');
        return;
      }

      if (!result.approved) {
        setPendingProfilePhotoVerification(null);
        Alert.alert('Profilbild abgelehnt', result.message || 'Das Bild konnte nicht verifiziert werden.');
        return;
      }

      setPendingProfilePhotoVerification(null);
      setDraft((previous) => ({
        ...previous,
        profilePhotoUrl: result.profilePhotoUrl,
        profileImageUri: result.profileImageUri,
        profilePhotoVerified: true,
        profilePhotoVerifiedAt: result.profilePhotoVerifiedAt,
        faceMatchSimilarity: result.faceMatchSimilarity,
        profilePhotoAgeMonths: 0,
        verificationState: 'verified',
      }));
      Alert.alert('Profilbild freigegeben', `Die Gesichtsähnlichkeit liegt bei ${Math.round(result.faceMatchSimilarity)} %. Dein Profilbild ist jetzt aktiv.`);
    } catch (error) {
      Alert.alert('Prüfung fehlgeschlagen', error.message || 'Die Profilbild-Prüfung konnte nicht abgeschlossen werden.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleDiscardPendingProfilePhotoVerification = async () => {
    if (!pendingProfilePhotoVerification) {
      return;
    }

    try {
      setIsUploadingMedia(true);
      await discardPendingProfilePhotoVerification(pendingProfilePhotoVerification);
      setPendingProfilePhotoVerification(null);
      Alert.alert('Temporäres Bild gelöscht', 'Das ausstehende Profilbild wurde verworfen.');
    } catch (error) {
      Alert.alert('Löschen fehlgeschlagen', error.message || 'Das temporäre Profilbild konnte nicht gelöscht werden.');
    } finally {
      setIsUploadingMedia(false);
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !pendingProfilePhotoVerification) {
      return undefined;
    }

    const livenessUrl = buildFaceLivenessUrl({
      sessionId: pendingProfilePhotoVerification.sessionId,
      verificationToken: pendingProfilePhotoVerification.verificationToken,
    });
    const expectedOrigin = livenessUrl ? new URL(livenessUrl, window.location.href).origin : window.location.origin;

    const handleLivenessMessage = (event) => {
      const payload = event.data;

      if (!payload || payload.type !== 'affairgo-face-liveness') {
        return;
      }

      if (expectedOrigin && event.origin !== expectedOrigin) {
        return;
      }

      if (payload.sessionId !== pendingProfilePhotoVerification.sessionId || payload.verificationToken !== pendingProfilePhotoVerification.verificationToken) {
        return;
      }

      if (payload.status === 'analysis_complete') {
        handleCompleteProfilePhotoVerification();
        return;
      }

      if (payload.status === 'cancelled') {
        Alert.alert('Live-Selfie abgebrochen', 'Die Aufnahme wurde abgebrochen. Du kannst die Prüfung erneut öffnen oder das temporäre Bild verwerfen.');
        return;
      }

      if (payload.status === 'error') {
        Alert.alert('Live-Selfie fehlgeschlagen', payload.errorMessage || 'Die Liveness-Prüfung konnte nicht abgeschlossen werden.');
      }
    };

    window.addEventListener('message', handleLivenessMessage);
    return () => window.removeEventListener('message', handleLivenessMessage);
  }, [pendingProfilePhotoVerification]);

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

  const profile = isOwnProfile ? draft : viewedProfile;
  const canSeeSensitiveMatchDetails = isOwnProfile || chats.some((chat) => chat.userId === profile?.id && chat.match);
  const moderationProfile = isOwnProfile ? currentUser : profile;
  const travelSummary = getProfileTravelSummary(profile);
  const verificationTone = profile.verificationState === 'expired' ? 'danger' : profile.verificationState === 'review' ? 'warning' : 'success';
  const verificationLabel = profile.verificationState === 'expired' ? 'Foto veraltet' : profile.verificationState === 'review' ? 'Prüfung offen' : 'Verifiziert';
  const ageVerificationTone = profile.ageVerified ? 'success' : profile.ageVerificationStatus === 'pending' ? 'warning' : 'neutral';
  const ageVerificationLabel = profile.ageVerified
    ? '18+ bestätigt'
    : profile.ageVerificationStatus === 'pending'
      ? '18+ in Prüfung'
      : '18+ offen';
  const moderationTone = moderationProfile?.moderationState === 'restricted' ? 'danger' : moderationProfile?.moderationState === 'review' ? 'warning' : 'success';
  const moderationLabel = moderationProfile?.moderationState === 'restricted' ? 'Sicherheitsstatus eingeschränkt' : moderationProfile?.moderationState === 'review' ? 'Moderation prüft' : 'Sicherheitsstatus unauffällig';
  const recentModerationEntries = (moderationAuditTrail || []).slice(0, 5);

  useEffect(() => {
    preventScreenCaptureAsync().catch(() => undefined);

    return () => {
      allowScreenCaptureAsync().catch(() => undefined);
    };
  }, []);

  if (!profile) {
    return null;
  }

  return (
    <AppBackground>
      <ScreenHeader
        title={isOwnProfile ? 'Dein Profil' : profile.nickname}
        subtitle={isOwnProfile ? 'Persönliche Daten' : `Kompatibilität ${getCompatibility(currentUser, profile)}%`}
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.accentSoft} />
          </Pressable>
        }
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
        {isOwnProfile && pendingProfilePhotoVerification ? <AccentButton label="Live-Selfie öffnen" variant="secondary" onPress={() => launchProfilePhotoLivenessFlow({ sessionId: pendingProfilePhotoVerification.sessionId, verificationToken: pendingProfilePhotoVerification.verificationToken })} disabled={isUploadingMedia} style={styles.avatarButton} /> : null}
        {isOwnProfile && pendingProfilePhotoVerification ? <AccentButton label={isUploadingMedia ? 'Prüfung läuft...' : 'Prüfung abschließen'} onPress={handleCompleteProfilePhotoVerification} disabled={isUploadingMedia} style={styles.avatarButton} /> : null}
        {isOwnProfile && pendingProfilePhotoVerification ? <AccentButton label="Temporäres Bild verwerfen" variant="secondary" onPress={handleDiscardPendingProfilePhotoVerification} disabled={isUploadingMedia} style={styles.avatarButton} /> : null}
        <Text style={styles.nameLine}>{isOwnProfile ? `${profile.firstName} ${profile.lastName}` : profile.nickname}</Text>
        <Text style={styles.metaLine}>{formatBirthDetails(profile)}</Text>
        <Text style={styles.metaLine}>{profile.gender}</Text>
        <StatusPill label={verificationLabel} tone={verificationTone} style={styles.statusPill} />
        <StatusPill label={ageVerificationLabel} tone={ageVerificationTone} style={styles.statusPill} />
        {isOwnProfile ? <StatusPill label={moderationLabel} tone={moderationTone} style={styles.statusPill} /> : null}
        {profile.ageVerificationProvider ? <Text style={styles.photoAge}>Altersprüfung: bestätigt</Text> : null}
        {profile.profilePhotoVerifiedAt ? <Text style={styles.photoAge}>Profilbild verifiziert: {new Date(profile.profilePhotoVerifiedAt).toLocaleString('de-DE')}</Text> : null}
        {profile.faceMatchSimilarity ? <Text style={styles.photoAge}>Face-Match: {Math.round(profile.faceMatchSimilarity)} %</Text> : null}
        <Text style={styles.photoAge}>
          {profile.profilePhotoUrl || profile.profileImageUri
            ? `Profilbild hochgeladen: vor ${profile.profilePhotoAgeMonths} Monaten`
            : 'Noch kein Profilbild gespeichert'}
        </Text>
        {profile.profilePhotoAgeMonths >= 12 ? <Text style={styles.warnRed}>Rote Warnung: Profilbild älter als 12 Monate</Text> : null}
        {profile.profilePhotoAgeMonths >= 6 && profile.profilePhotoAgeMonths < 12 ? <Text style={styles.warnSoft}>Hinweis: Profilbild älter als 6 Monate</Text> : null}
        {isOwnProfile && pendingProfilePhotoVerification ? <Text style={styles.warnSoft}>Temporäres Bild gewählt. Bitte schließe jetzt die Live-Selfie-Prüfung ab und bestätige danach die Freigabe.</Text> : null}
        {!isOwnProfile ? <AccentButton label="Profil melden" variant="secondary" onPress={() => setReportModalOpen(true)} style={styles.avatarButton} /> : null}
      </GlassCard>

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
          </>
        ) : null}

        {travelSummary ? (
          <>
            <Text style={styles.groupTitle}>Reiseplanung</Text>
            <Text style={styles.readonlyLine}>{travelSummary.label}</Text>
            {travelSummary.location ? <Text style={styles.readonlyLine}>Ort: {travelSummary.location}</Text> : null}
            {travelSummary.period ? <Text style={styles.readonlyLine}>Zeitraum: {travelSummary.period}</Text> : null}
          </>
        ) : null}

        {isOwnProfile ? (
          <>
            {travelSummary ? <View style={styles.sectionSpacer} /> : null}
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
            <AccentButton label="Profil speichern" onPress={save} style={styles.saveButton} />
          </>
        ) : (
          <>
            {travelSummary ? <View style={styles.sectionSpacer} /> : null}
            <Text style={styles.readonlyLine}>Spitzname: {profile.nickname}</Text>
            <Text style={styles.readonlyLine}>Körpergröße: {profile.height}</Text>
            <Text style={styles.readonlyLine}>Figur: {profile.figure}</Text>
            {profile.penisSize ? <Text style={styles.readonlyLine}>Penisgröße: {profile.penisSize}</Text> : null}
            {profile.braSize ? <Text style={styles.readonlyLine}>BH-Größe: {profile.braSize}</Text> : null}
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

      <GlassCard style={styles.infoCard}>
        <Text style={styles.groupTitle}>Galerie</Text>
        <View style={styles.galleryRow}>
          {profile.gallery.map((item) => (
            <View key={item.id} style={[styles.galleryItem, isCompactWeb && styles.galleryItemCompact]}>
              {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.galleryImage} resizeMode="cover" /> : <Ionicons name="image-outline" size={28} color={affairGoTheme.colors.textMuted} />}
              <Text style={styles.galleryLabel}>{item.label}</Text>
              <Text style={styles.galleryAge}>{item.ageLabel}</Text>
            </View>
          ))}
          {isOwnProfile && profile.gallery.length < 10 ? (
            <Pressable style={[styles.galleryItem, isCompactWeb && styles.galleryItemCompact]} onPress={handleAddGalleryImage}>
              <Ionicons name="add" size={34} color={affairGoTheme.colors.text} />
              <Text style={styles.galleryLabel}>Foto hinzufügen</Text>
            </Pressable>
          ) : null}
        </View>
      </GlassCard>

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
  },
  photoAge: {
    color: affairGoTheme.colors.text,
    marginTop: 14,
  },
  warnSoft: {
    color: affairGoTheme.colors.accentSoft,
    marginTop: 6,
  },
  warnRed: {
    color: affairGoTheme.colors.danger,
    marginTop: 6,
  },
  infoCard: {
    marginBottom: 14,
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
  logoutButton: {
    marginTop: 6,
  },
  readonlyLine: {
    color: affairGoTheme.colors.text,
    lineHeight: 26,
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