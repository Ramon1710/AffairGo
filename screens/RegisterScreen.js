import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { getAgeVerificationProviderLabel, getAgeVerificationSetupInstructions, hasConfiguredAgeVerification, submitAgeVerification } from '../constants/ageVerificationProvider';
import { getSelfieVerificationProviderLabel, getSelfieVerificationSetupInstructions, hasConfiguredSelfieVerification, submitSelfieVerification } from '../constants/selfieVerificationProvider';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, GENDER_OPTIONS, HAIR_OPTIONS, MONTH_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 82 }, (_, index) => currentYear - 18 - index);
const AGE_PROVIDER_CONFIGURED = hasConfiguredAgeVerification();
const SELFIE_PROVIDER_CONFIGURED = hasConfiguredSelfieVerification();

const createEmptyAgeVerificationState = () => ({
  ageVerified: false,
  ageVerificationStatus: 'not_started',
  ageVerificationProvider: '',
  ageVerificationReferenceId: '',
  ageVerificationCheckedAt: '',
});

const createEmptySelfieVerificationState = () => ({
  selfieVerified: false,
  selfieVerificationStatus: 'not_started',
  selfieVerificationProvider: '',
  selfieVerificationReferenceId: '',
  selfieVerificationCheckedAt: '',
  selfieLivenessScore: 0,
  selfieFakeScore: 0,
});

const RegisterScreen = () => {
  const navigation = useNavigation();
  const { register } = useAffairGo();
  const [form, setForm] = useState({
    profileImageUploaded: false,
    profileImageAsset: null,
    email: '',
    password: '',
    repeatPassword: '',
    gender: 'weiblich',
    firstName: '',
    lastName: '',
    nickname: '',
    birthDay: '17',
    birthMonth: 9,
    birthYear: 1989,
    height: '',
    figure: FIGURE_OPTIONS[2],
    penisSize: '',
    braSize: '',
    hairColor: HAIR_OPTIONS[1],
    eyeColor: EYE_OPTIONS[2],
    skinType: SKIN_OPTIONS[1],
    documentAsset: null,
    selfieAsset: null,
    ...createEmptyAgeVerificationState(),
    ...createEmptySelfieVerificationState(),
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingAge, setIsVerifyingAge] = useState(false);
  const [isVerifyingSelfie, setIsVerifyingSelfie] = useState(false);

  const age = useMemo(() => {
    const birthDate = new Date(form.birthYear, Number(form.birthMonth), Number(form.birthDay || 1));
    const today = new Date();
    let value = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
      value -= 1;
    }
    return value;
  }, [form.birthDay, form.birthMonth, form.birthYear]);

  const birthLabel = `${form.birthDay}. ${MONTH_OPTIONS[form.birthMonth]} ${form.birthYear} (${age} Jahre)`;

  const updateField = (key, value) => {
    setForm((previous) => {
      const nextForm = { ...previous, [key]: value };

      if (['email', 'nickname'].includes(key)) {
        return { ...nextForm, ...createEmptyAgeVerificationState(), ...createEmptySelfieVerificationState() };
      }

      if (['birthDay', 'birthMonth', 'birthYear'].includes(key)) {
        return { ...nextForm, ...createEmptyAgeVerificationState() };
      }

      return nextForm;
    });
  };

  const updateAssetField = (key, asset) => {
    setForm((previous) => ({
      ...previous,
      [key]: asset,
      ...(key === 'profileImageAsset'
        ? { profileImageUploaded: Boolean(asset?.uri), ...createEmptySelfieVerificationState() }
        : key === 'documentAsset'
          ? createEmptyAgeVerificationState()
          : { ...createEmptyAgeVerificationState(), ...createEmptySelfieVerificationState() }),
    }));
  };

  const pickImageFromLibrary = async ({ allowsEditing = true } = {}) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error('Bitte erlaube den Zugriff auf deine Mediathek.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing,
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return result.assets[0];
  };

  const captureSelfie = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      throw new Error('Bitte erlaube den Kamerazugriff für das Selfie.');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.front,
    });

    if (result.canceled || !result.assets?.length) {
      return null;
    }

    return result.assets[0];
  };

  const selectProfileImage = async () => {
    try {
      const asset = await pickImageFromLibrary();
      if (!asset) {
        return;
      }

      updateAssetField('profileImageAsset', asset);
    } catch (imageError) {
      Alert.alert('Profilbild fehlt', imageError.message || 'Das Profilbild konnte nicht ausgewählt werden.');
    }
  };

  const selectDocumentImage = async () => {
    try {
      const asset = await pickImageFromLibrary({ allowsEditing: false });
      if (!asset) {
        return;
      }

      updateAssetField('documentAsset', asset);
    } catch (imageError) {
      Alert.alert('Dokument fehlt', imageError.message || 'Das Dokument konnte nicht ausgewählt werden.');
    }
  };

  const selectSelfieImage = async () => {
    try {
      const asset = await captureSelfie();
      if (!asset) {
        return;
      }

      updateAssetField('selfieAsset', asset);
    } catch (imageError) {
      Alert.alert('Selfie fehlt', imageError.message || 'Das Selfie konnte nicht aufgenommen werden.');
    }
  };

  const handleVerifyAge = async () => {
    if (age < 18) {
      setError('Registrierung erst ab 18 Jahren.');
      return;
    }

    if (!form.email.trim() || !form.nickname.trim()) {
      setError('Bitte trage zuerst E-Mail und Spitznamen ein, bevor du die Altersverifizierung startest.');
      return;
    }

    if (!form.documentAsset?.uri || !form.selfieAsset?.uri) {
      setError('Bitte lade ein Ausweisdokument und ein aktuelles Selfie hoch.');
      return;
    }

    try {
      setError('');
      setIsVerifyingAge(true);
      const verification = await submitAgeVerification({
        documentAsset: form.documentAsset,
        selfieAsset: form.selfieAsset,
        birthDateLabel: birthLabel,
        email: form.email.trim(),
        nickname: form.nickname.trim(),
      });

      const verified = Boolean(verification.verified && verification.minimumAgeVerified);

      setForm((previous) => ({
        ...previous,
        ageVerified: verified,
        ageVerificationStatus: verified ? 'verified' : verification.status || 'pending',
        ageVerificationProvider: verification.provider || '',
        ageVerificationReferenceId: verification.referenceId || '',
        ageVerificationCheckedAt: verification.checkedAt || '',
      }));

      if (!verified) {
        throw new Error('Die Altersverifizierung ist noch nicht freigegeben. Bitte warte auf die Bestätigung deines Anbieters.');
      }

      Alert.alert('Altersverifizierung abgeschlossen', `Dein 18+-Nachweis wurde über ${verification.provider || getAgeVerificationProviderLabel()} bestätigt.`);
    } catch (verificationError) {
      setError(verificationError.message || 'Die Altersverifizierung konnte nicht abgeschlossen werden.');
    } finally {
      setIsVerifyingAge(false);
    }
  };

  const handleVerifySelfie = async () => {
    if (!form.email.trim() || !form.nickname.trim()) {
      setError('Bitte trage zuerst E-Mail und Spitznamen ein, bevor du den Selfie-Check startest.');
      return;
    }

    if (!form.profileImageAsset?.uri || !form.selfieAsset?.uri) {
      setError('Bitte lade zuerst ein Profilbild und ein Live-Selfie hoch.');
      return;
    }

    try {
      setError('');
      setIsVerifyingSelfie(true);
      const verification = await submitSelfieVerification({
        profileImageAsset: form.profileImageAsset,
        selfieAsset: form.selfieAsset,
        email: form.email.trim(),
        nickname: form.nickname.trim(),
      });

      const verified = Boolean(verification.verified && verification.livenessPassed && !verification.fakeDetected);

      setForm((previous) => ({
        ...previous,
        selfieVerified: verified,
        selfieVerificationStatus: verified ? 'verified' : verification.status || 'pending',
        selfieVerificationProvider: verification.provider || '',
        selfieVerificationReferenceId: verification.referenceId || '',
        selfieVerificationCheckedAt: verification.checkedAt || '',
        selfieLivenessScore: verification.livenessScore || 0,
        selfieFakeScore: verification.fakeScore || 0,
      }));

      if (!verified) {
        throw new Error('Der Live-Selfie- oder KI-Fake-Check ist noch nicht freigegeben. Bitte warte auf die Bestätigung deines Anbieters.');
      }

      Alert.alert('Selfie-Check abgeschlossen', `Dein Live-Selfie wurde über ${verification.provider || getSelfieVerificationProviderLabel()} erfolgreich bestätigt.`);
    } catch (verificationError) {
      setError(verificationError.message || 'Der Selfie- und KI-Fake-Check konnte nicht abgeschlossen werden.');
    } finally {
      setIsVerifyingSelfie(false);
    }
  };

  const verificationDescription = form.ageVerified
    ? `Verifiziert über ${form.ageVerificationProvider || getAgeVerificationProviderLabel()}`
    : form.ageVerificationStatus === 'pending'
      ? 'Prüfung eingereicht. Registrierung bleibt gesperrt, bis dein Anbieter 18+ bestätigt.'
      : 'Lade Dokument und Selfie hoch und starte danach die 18+-Prüfung.';

  const selfieVerificationDescription = form.selfieVerified
    ? `Selfie bestätigt über ${form.selfieVerificationProvider || getSelfieVerificationProviderLabel()}`
    : form.selfieVerificationStatus === 'pending'
      ? 'Der Live-Selfie-Check wurde eingereicht. Registrierung bleibt gesperrt, bis Liveness und Fake-Erkennung positiv bestätigt sind.'
      : 'Vergleiche Profilbild und Live-Selfie mit deinem KI-/Liveness-Anbieter, bevor du registrierst.';

  const handleRegister = async () => {
    try {
      setError('');
      setIsSubmitting(true);
      if (form.password !== form.repeatPassword) {
        setError('Die Passwörter stimmen nicht überein.');
        setIsSubmitting(false);
        return;
      }
      if (!form.profileImageUploaded) {
        setError('Bitte lade zuerst ein Profilbild hoch.');
        setIsSubmitting(false);
        return;
      }
      if (!form.ageVerified || form.ageVerificationStatus !== 'verified') {
        setError('Bitte schließe zuerst die Altersverifizierung erfolgreich ab.');
        setIsSubmitting(false);
        return;
      }
      if (!form.selfieVerified || form.selfieVerificationStatus !== 'verified') {
        setError('Bitte schließe zuerst den Selfie- und KI-Fake-Check erfolgreich ab.');
        setIsSubmitting(false);
        return;
      }
      const result = await register({ ...form, age, birthLabel });
      let successMessage = result?.emailSent
        ? `Registrierung erfolgreich. Wir haben eine Verifizierungs-Mail an ${form.email} gesendet.`
        : `Konto angelegt für ${form.email}, aber die Verifizierungs-Mail konnte nicht gesendet werden. Bitte versuche den Login, damit wir sie erneut senden.`;

      if (!result?.profileSaved) {
        successMessage += ' Deine Profildaten konnten noch nicht vollständig bestätigt werden. Bitte logge dich nach der Mail-Bestätigung erneut ein; wir versuchen die Profilspeicherung dann erneut.';
      }

      navigation.reset({
        index: 0,
        routes: [{
          name: 'Login',
          params: {
            infoMessage: successMessage,
            prefillEmail: form.email,
            showSuccessModal: true,
          },
        }],
      });
    } catch (registerError) {
      console.warn('AffairGo register failed', registerError);
      setError(registerError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Sign Up To AffairGo"
        subtitle="Selfie-Check, 18+ und Profildaten"
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.accent} />
          </Pressable>
        }
      />

      <GlassCard strong style={styles.card}>
        <Pressable style={styles.uploadTile} onPress={selectProfileImage}>
          <View style={[styles.uploadPreview, form.profileImageUploaded && styles.uploadPreviewActive]}>
            {form.profileImageAsset?.uri ? (
              <Image source={{ uri: form.profileImageAsset.uri }} style={styles.uploadImage} resizeMode="cover" />
            ) : (
              <Ionicons name={form.profileImageUploaded ? 'checkmark' : 'camera-outline'} size={28} color={affairGoTheme.colors.text} />
            )}
          </View>
          <View style={styles.uploadCopy}>
            <Text style={styles.uploadTitle}>Profilbild</Text>
            <Text style={styles.uploadText}>Wähle dein sichtbares Profilbild. Der Verifikations-Upload für 18+ erfolgt separat darunter.</Text>
          </View>
        </Pressable>

        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View>
              <Text style={styles.verificationTitle}>18+-Verifizierung</Text>
              <Text style={styles.verificationText}>{verificationDescription}</Text>
            </View>
            <View style={[styles.statusBadge, form.ageVerified ? styles.statusBadgeSuccess : styles.statusBadgeNeutral]}>
              <Text style={styles.statusBadgeText}>{form.ageVerified ? 'Verifiziert' : form.ageVerificationStatus === 'pending' ? 'In Prüfung' : 'Offen'}</Text>
            </View>
          </View>

          {!AGE_PROVIDER_CONFIGURED ? <Text style={styles.setupHint}>{getAgeVerificationSetupInstructions()}</Text> : null}

          <View style={styles.verificationUploads}>
            <Pressable style={styles.documentTile} onPress={selectDocumentImage}>
              <View style={[styles.documentPreview, form.documentAsset?.uri && styles.documentPreviewActive]}>
                {form.documentAsset?.uri ? (
                  <Image source={{ uri: form.documentAsset.uri }} style={styles.documentImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="card-outline" size={24} color={affairGoTheme.colors.text} />
                )}
              </View>
              <Text style={styles.documentTitle}>Ausweis oder Dokument</Text>
              <Text style={styles.documentText}>{form.documentAsset?.fileName || 'Vorderseite oder Dokumentseite hochladen'}</Text>
            </Pressable>

            <Pressable style={styles.documentTile} onPress={selectSelfieImage}>
              <View style={[styles.documentPreview, form.selfieAsset?.uri && styles.documentPreviewActive]}>
                {form.selfieAsset?.uri ? (
                  <Image source={{ uri: form.selfieAsset.uri }} style={styles.documentImage} resizeMode="cover" />
                ) : (
                  <Ionicons name="camera-outline" size={24} color={affairGoTheme.colors.text} />
                )}
              </View>
              <Text style={styles.documentTitle}>Live-Selfie</Text>
              <Text style={styles.documentText}>{form.selfieAsset?.fileName || 'Direkt mit der Frontkamera aufnehmen'}</Text>
            </Pressable>
          </View>

          {form.ageVerificationReferenceId ? <Text style={styles.referenceText}>Referenz: {form.ageVerificationReferenceId}</Text> : null}

          <AccentButton
            label={isVerifyingAge ? 'Altersverifizierung läuft...' : 'Altersverifizierung starten'}
            onPress={handleVerifyAge}
            disabled={isVerifyingAge || isSubmitting || !AGE_PROVIDER_CONFIGURED}
            style={styles.buttonGap}
          />
        </View>

        <View style={styles.verificationCard}>
          <View style={styles.verificationHeader}>
            <View>
              <Text style={styles.verificationTitle}>Selfie- und KI-Fake-Check</Text>
              <Text style={styles.verificationText}>{selfieVerificationDescription}</Text>
            </View>
            <View style={[styles.statusBadge, form.selfieVerified ? styles.statusBadgeSuccess : styles.statusBadgeNeutral]}>
              <Text style={styles.statusBadgeText}>{form.selfieVerified ? 'Verifiziert' : form.selfieVerificationStatus === 'pending' ? 'In Prüfung' : 'Offen'}</Text>
            </View>
          </View>

          {!SELFIE_PROVIDER_CONFIGURED ? <Text style={styles.setupHint}>{getSelfieVerificationSetupInstructions()}</Text> : null}

          <Text style={styles.documentText}>Profilbild und Live-Selfie werden an deinen Liveness-/Fake-Check-Endpunkt gesendet. Besteht der Check nicht, bleibt die Registrierung gesperrt.</Text>
          {form.selfieVerificationReferenceId ? <Text style={styles.referenceText}>Referenz: {form.selfieVerificationReferenceId}</Text> : null}
          {form.selfieVerificationCheckedAt ? <Text style={styles.scoreText}>Geprüft am: {form.selfieVerificationCheckedAt}</Text> : null}
          {form.selfieVerified || form.selfieVerificationStatus === 'pending' ? <Text style={styles.scoreText}>Liveness-Score: {form.selfieLivenessScore}</Text> : null}
          {form.selfieVerified || form.selfieVerificationStatus === 'pending' ? <Text style={styles.scoreText}>Fake-Score: {form.selfieFakeScore}</Text> : null}

          <AccentButton
            label={isVerifyingSelfie ? 'Selfie-Check läuft...' : 'Selfie-Check starten'}
            onPress={handleVerifySelfie}
            disabled={isVerifyingSelfie || isSubmitting || !SELFIE_PROVIDER_CONFIGURED}
            style={styles.buttonGap}
          />
        </View>

        <FormField label="E-Mail" value={form.email} onChangeText={(value) => updateField('email', value)} autoCapitalize="none" placeholder="name@mail.de" />
        <FormField label="Passwort" value={form.password} onChangeText={(value) => updateField('password', value)} secureTextEntry placeholder="Passwort" />
        <FormField label="Passwort wiederholen" value={form.repeatPassword} onChangeText={(value) => updateField('repeatPassword', value)} secureTextEntry placeholder="Passwort wiederholen" />

        <Text style={styles.sectionLabel}>Geschlecht</Text>
        <View style={styles.chipWrap}>
          {GENDER_OPTIONS.map((gender) => (
            <View key={gender} style={styles.chipItem}>
              <ToggleChip label={gender} active={form.gender === gender} onPress={() => updateField('gender', gender)} />
            </View>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.half}><FormField label="Vorname" value={form.firstName} onChangeText={(value) => updateField('firstName', value)} hint="Nicht sichtbar für andere Nutzer" placeholder="Vorname" /></View>
          <View style={styles.half}><FormField label="Nachname" value={form.lastName} onChangeText={(value) => updateField('lastName', value)} hint="Nicht sichtbar für andere Nutzer" placeholder="Nachname" /></View>
        </View>

        <FormField label="Spitzname" value={form.nickname} onChangeText={(value) => updateField('nickname', value)} hint="Öffentlich sichtbar im Profil" placeholder="Spitzname" />

        <Text style={styles.sectionLabel}>Geburtsdatum</Text>
        <View style={styles.row}>
          <View style={styles.day}><FormField label="Tag" value={form.birthDay} onChangeText={(value) => updateField('birthDay', value)} placeholder="17" keyboardType="number-pad" /></View>
          <View style={styles.month}><Text style={styles.pickerLabel}>Monat</Text><View style={styles.pickerWrap}><Picker selectedValue={form.birthMonth} onValueChange={(value) => updateField('birthMonth', value)} dropdownIconColor={affairGoTheme.colors.text}>{MONTH_OPTIONS.map((month, index) => <Picker.Item key={month} label={month} value={index} color="#111" />)}</Picker></View></View>
          <View style={styles.year}><Text style={styles.pickerLabel}>Jahr</Text><View style={styles.pickerWrap}><Picker selectedValue={form.birthYear} onValueChange={(value) => updateField('birthYear', value)} dropdownIconColor={affairGoTheme.colors.text}>{yearOptions.map((year) => <Picker.Item key={year} label={String(year)} value={year} color="#111" />)}</Picker></View></View>
        </View>
        <Text style={styles.birthLabel}>{birthLabel}</Text>

        <View style={styles.row}>
          <View style={styles.half}><FormField label="Körpergröße" value={form.height} onChangeText={(value) => updateField('height', value)} placeholder="1,75 m" /></View>
          <View style={styles.half}><Text style={styles.pickerLabel}>Figur</Text><View style={styles.pickerWrap}><Picker selectedValue={form.figure} onValueChange={(value) => updateField('figure', value)} dropdownIconColor={affairGoTheme.colors.text}>{FIGURE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
        </View>

        {(form.gender === 'männlich' || form.gender === 'divers') ? <FormField label="Penisgröße" value={form.penisSize} onChangeText={(value) => updateField('penisSize', value)} hint="Angabe im erigierten Zustand" placeholder="16 cm" /> : null}
        {(form.gender === 'weiblich' || form.gender === 'divers') ? <FormField label="BH-Größe" value={form.braSize} onChangeText={(value) => updateField('braSize', value)} placeholder="75B" /> : null}

        <View style={styles.row}>
          <View style={styles.half}><Text style={styles.pickerLabel}>Haarfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={form.hairColor} onValueChange={(value) => updateField('hairColor', value)} dropdownIconColor={affairGoTheme.colors.text}>{HAIR_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
          <View style={styles.half}><Text style={styles.pickerLabel}>Augenfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={form.eyeColor} onValueChange={(value) => updateField('eyeColor', value)} dropdownIconColor={affairGoTheme.colors.text}>{EYE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
        </View>

        <Text style={styles.pickerLabel}>Hauttyp</Text>
        <View style={styles.pickerWrap}><Picker selectedValue={form.skinType} onValueChange={(value) => updateField('skinType', value)} dropdownIconColor={affairGoTheme.colors.text}>{SKIN_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <AccentButton label={isSubmitting ? 'Registrierung läuft...' : 'Registrieren'} onPress={handleRegister} disabled={isSubmitting} style={styles.buttonGap} />
        <AccentButton label="Zum Login" variant="secondary" onPress={() => navigation.navigate('Login')} disabled={isSubmitting} />
      </GlassCard>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 22,
  },
  uploadTile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  uploadPreview: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  uploadPreviewActive: {
    backgroundColor: 'rgba(255,67,67,0.26)',
    borderColor: affairGoTheme.colors.accent,
  },
  uploadImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  uploadCopy: {
    flex: 1,
  },
  uploadTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
  },
  verificationCard: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: affairGoTheme.radius.lg,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 18,
  },
  verificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  verificationTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  verificationText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
    maxWidth: 220,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeNeutral: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(44,179,120,0.2)',
  },
  statusBadgeText: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
  },
  setupHint: {
    color: affairGoTheme.colors.accentSoft,
    lineHeight: 20,
    marginBottom: 12,
  },
  verificationUploads: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  documentTile: {
    flex: 1,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    borderRadius: affairGoTheme.radius.md,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  documentPreview: {
    height: 120,
    borderRadius: 16,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  documentPreviewActive: {
    borderWidth: 1,
    borderColor: affairGoTheme.colors.accent,
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  documentTitle: {
    color: affairGoTheme.colors.text,
    fontWeight: '700',
    marginBottom: 4,
  },
  documentText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 18,
  },
  referenceText: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 12,
    marginBottom: 12,
  },
  scoreText: {
    color: affairGoTheme.colors.textMuted,
    marginBottom: 8,
  },
  sectionLabel: {
    color: affairGoTheme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chipItem: {
    marginRight: 10,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
    alignItems: 'flex-start',
  },
  half: {
    flex: 1,
    marginHorizontal: 6,
  },
  day: {
    width: '22%',
    marginHorizontal: 6,
  },
  month: {
    width: '38%',
    marginHorizontal: 6,
  },
  year: {
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
  birthLabel: {
    color: affairGoTheme.colors.accentSoft,
    marginTop: -2,
    marginBottom: 16,
  },
  errorText: {
    color: affairGoTheme.colors.danger,
    marginBottom: 10,
  },
  buttonGap: {
    marginBottom: 10,
  },
});

export default RegisterScreen;