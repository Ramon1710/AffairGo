import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, StatusPill, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, HAIR_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam oder Scam' },
  { value: 'fraud', label: 'Betrugsverdacht' },
  { value: 'fake_profile', label: 'Fake-Profil' },
  { value: 'harassment', label: 'Belästigung' },
  { value: 'explicit_content', label: 'Unangemessene Inhalte' },
  { value: 'underage', label: 'Minderjährig oder falsches Alter' },
  { value: 'other', label: 'Sonstiges' },
];

const ProfilScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, users, updateCurrentUser, addGalleryItem, logout, preferenceOptions, tabooOptions, getCompatibility, changePassword, getProfileTravelSummary, verifyPendingEmail, membershipStatusLabel, confirmPendingNickname, exportMyData, requestAccountDeletion, updateProfilePhoto, reportUser, moderationBackendConfigured, moderationAuditTrail, moderationFlags } = useAffairGo();
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
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0].value);
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const updateField = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
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
      'Dein Profil wird unsichtbar geschaltet und die Löschung zur weiteren Bearbeitung markiert. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschung anfragen',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRequestingDeletion(true);
              const requestedAt = await requestAccountDeletion();
              setDraft((previous) => ({ ...previous, accountDeletionRequestedAt: requestedAt, searchActive: false, invisibleMode: true }));
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

      const profileImageUri = await updateProfilePhoto(asset);
      setDraft((previous) => ({ ...previous, profileImageUri, profilePhotoAgeMonths: 0, verificationState: 'review' }));
      Alert.alert('Profilbild aktualisiert', 'Dein Profilbild wurde hochgeladen und zur erneuten Prüfung markiert.');
    } catch (error) {
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

  const profile = isOwnProfile ? draft : viewedProfile;
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
    if (Platform.OS === 'web') {
      return undefined;
    }

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
        rightAction={isOwnProfile ? <Pressable onPress={async () => { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Landing' }] }); }}><Ionicons name="log-out-outline" size={28} color={affairGoTheme.colors.text} /></Pressable> : null}
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
        <Text style={styles.nameLine}>{isOwnProfile ? `${profile.firstName} ${profile.lastName}` : profile.nickname}</Text>
        <Text style={styles.metaLine}>{profile.birthLabel || `${profile.birthDay}. ${profile.birthMonth + 1}. ${profile.birthYear} (${profile.age} Jahre)`}</Text>
        <Text style={styles.metaLine}>{profile.gender}</Text>
        <StatusPill label={verificationLabel} tone={verificationTone} style={styles.statusPill} />
        <StatusPill label={ageVerificationLabel} tone={ageVerificationTone} style={styles.statusPill} />
        {isOwnProfile ? <StatusPill label={moderationLabel} tone={moderationTone} style={styles.statusPill} /> : null}
        {profile.ageVerificationProvider ? <Text style={styles.photoAge}>KYC-Anbieter: {profile.ageVerificationProvider}</Text> : null}
        {profile.ageVerificationReferenceId ? <Text style={styles.photoAge}>KYC-Referenz: {profile.ageVerificationReferenceId}</Text> : null}
        <Text style={styles.photoAge}>Profilbild hochgeladen: vor {profile.profilePhotoAgeMonths} Monaten</Text>
        {profile.profilePhotoAgeMonths >= 12 ? <Text style={styles.warnRed}>Rote Warnung: Profilbild älter als 12 Monate</Text> : null}
        {profile.profilePhotoAgeMonths >= 6 && profile.profilePhotoAgeMonths < 12 ? <Text style={styles.warnSoft}>Hinweis: Profilbild älter als 6 Monate</Text> : null}
        {!isOwnProfile ? <AccentButton label="Profil melden" variant="secondary" onPress={() => setReportModalOpen(true)} style={styles.avatarButton} /> : null}
      </GlassCard>

      {isOwnProfile ? (
        <GlassCard style={styles.securityCard}>
          <Text style={styles.securityTitle}>Altersverifizierung</Text>
          <Text style={styles.securityText}>
            {profile.ageVerified
              ? 'Dein 18+-Status ist bestätigt. Bei einer erneuten Dokumentenprüfung oder Anbieter-Änderung wird hier der aktuelle Status angezeigt.'
              : profile.ageVerificationStatus === 'pending'
                ? 'Deine Dokumentenprüfung wurde eingereicht. Die Registrierung und sensible Bereiche bleiben bis zur Freigabe an den Anbieterstatus gebunden.'
                : 'Dein 18+-Nachweis ist noch nicht abgeschlossen. Die Prüfung erfolgt im Registrierungsflow über Dokument und Live-Selfie.'}
          </Text>
        </GlassCard>
      ) : null}

      <GlassCard style={styles.securityCard}>
        <Text style={styles.securityTitle}>Screenshot-Schutz</Text>
        <Text style={styles.securityText}>
          {Platform.OS === 'web'
            ? 'Im Web ist der Schutz als deutlicher Hinweis modelliert. In nativen Builds kann dieser Screen für Screenshot-Sperren abgesichert werden.'
            : 'Dieser Profilbereich ist für nativen Screenshot-Schutz vorbereitet, um Bilder und persönliche Daten besser zu schützen.'}
        </Text>
      </GlassCard>

      {isOwnProfile ? (
        <GlassCard style={styles.securityCard}>
          <Text style={styles.securityTitle}>Moderation und Sicherheit</Text>
          <Text style={styles.securityText}>
            {moderationBackendConfigured
              ? 'Deine kritischen Aktionen werden über das Moderations-Backend geprüft und im Audit-Trail protokolliert.'
              : 'Aktuell ist nur der lokale Sicherheits-Fallback aktiv. Fuer belastbare Fallbearbeitung musst du das Moderations-Backend in .env.local konfigurieren.'}
          </Text>
          <Text style={styles.copyLine}>Aktueller Status: {moderationLabel}</Text>
          <Text style={styles.copyLine}>Letzte Prüfung: {moderationProfile?.moderationLastCheckedAt || 'Noch keine Sicherheitsprüfung'}</Text>
          <Text style={styles.copyLine}>Aktive Flags: {(moderationFlags || []).length ? moderationFlags.join(', ') : 'Keine'}</Text>
          {moderationProfile?.moderationRateLimitUntil ? <Text style={styles.warnRed}>Aktionen begrenzt bis: {moderationProfile.moderationRateLimitUntil}</Text> : null}
          {recentModerationEntries.length ? (
            <View style={styles.auditList}>
              {recentModerationEntries.map((entry) => (
                <View key={entry.id} style={styles.auditItem}>
                  <Text style={styles.auditTitle}>{entry.actionType}</Text>
                  <Text style={styles.auditMeta}>{entry.outcome} • {entry.createdAt}</Text>
                  {entry.reason ? <Text style={styles.auditReason}>{entry.reason}</Text> : null}
                  {entry.flags?.length ? <Text style={styles.auditFlags}>Flags: {entry.flags.join(', ')}</Text> : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.copyLine}>Noch keine Moderationsfälle protokolliert.</Text>
          )}
        </GlassCard>
      ) : null}

      <GlassCard style={styles.infoCard}>
        {isOwnProfile ? (
          <>
            <Text style={styles.groupTitle}>Tarif und Sichtbarkeit</Text>
            <Text style={styles.readonlyLine}>Aktiver Tarif: {membershipStatusLabel}</Text>
            {currentUser.membership === 'gold' ? (
              <View style={styles.visibilityBox}>
                <Text style={styles.visibilityTitle}>Gold Unsichtbar-Modus</Text>
                <Text style={styles.visibilityText}>Deine Suche bleibt aktiv, aber dein Profil erscheint nicht mehr in fremden Trefferlisten.</Text>
                <ToggleChip label="Unsichtbar suchen" active={Boolean(profile.invisibleMode)} onPress={() => updateField('invisibleMode', !profile.invisibleMode)} />
              </View>
            ) : (
              <Text style={styles.visibilityHint}>Unsichtbar suchen ist im Gold-Paket verfügbar.</Text>
            )}
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
            <View style={styles.row}>
              <View style={styles.half}><FormField label="Körpergröße" value={profile.height} onChangeText={(value) => updateField('height', value)} /></View>
              <View style={styles.half}><Text style={styles.pickerLabel}>Figur</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.figure} onValueChange={(value) => updateField('figure', value)}>{FIGURE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
            </View>
            <AccentButton label="Passwort ändern" variant="secondary" onPress={() => setPasswordModalOpen(true)} style={styles.passwordButton} />
            {(profile.gender === 'männlich' || profile.gender === 'divers') ? <FormField label="Penisgröße" value={profile.penisSize} onChangeText={(value) => updateField('penisSize', value)} /> : null}
            {(profile.gender === 'weiblich' || profile.gender === 'divers') ? <FormField label="BH-Größe" value={profile.braSize} onChangeText={(value) => updateField('braSize', value)} /> : null}
            <View style={styles.row}>
              <View style={styles.half}><Text style={styles.pickerLabel}>Haarfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.hairColor} onValueChange={(value) => updateField('hairColor', value)}>{HAIR_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
              <View style={styles.half}><Text style={styles.pickerLabel}>Augenfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.eyeColor} onValueChange={(value) => updateField('eyeColor', value)}>{EYE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
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
            {currentUser.membership === 'gold' ? <AccentButton label="Vor dem Match schreiben" variant="secondary" onPress={() => navigation.navigate('Chat', { userId: profile.id })} style={styles.passwordButton} /> : null}
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
        </GlassCard>
      ) : null}

      <GlassCard style={styles.infoCard}>
        <Text style={styles.groupTitle}>Vorlieben</Text>
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
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        <Text style={styles.groupTitle}>Galerie</Text>
        <View style={styles.galleryRow}>
          {profile.gallery.map((item) => (
            <View key={item.id} style={styles.galleryItem}>
              {item.imageUri ? <Image source={{ uri: item.imageUri }} style={styles.galleryImage} resizeMode="cover" /> : <Ionicons name="image-outline" size={28} color={affairGoTheme.colors.textMuted} />}
              <Text style={styles.galleryLabel}>{item.label}</Text>
              <Text style={styles.galleryAge}>{item.ageLabel}</Text>
            </View>
          ))}
          {isOwnProfile && profile.gallery.length < 10 ? (
            <Pressable style={styles.galleryItem} onPress={handleAddGalleryImage}>
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
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  half: {
    flex: 1,
    marginHorizontal: 6,
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