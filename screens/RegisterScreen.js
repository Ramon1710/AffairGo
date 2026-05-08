import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, GENDER_OPTIONS, HAIR_OPTIONS, MONTH_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 82 }, (_, index) => currentYear - 18 - index);

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
  selfieDeletionStatus: 'not_requested',
  selfieDeletionConfirmedAt: '',
  selfieDeletionReceiptId: '',
  selfieRetentionPolicy: '',
  selfieLivenessScore: 0,
  selfieFakeScore: 0,
});

const shouldShowPenisSizeField = (gender) => gender === 'männlich' || gender === 'divers' || gender === 'paare';
const shouldShowBraSizeField = (gender) => gender === 'weiblich' || gender === 'divers' || gender === 'paare';

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

  const birthLabel = `${form.birthDay}, ${MONTH_OPTIONS[form.birthMonth]} ${form.birthYear} (${age} Jahre)`;

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
      if (age < 18) {
        setError('Registrierung erst ab 18 Jahren.');
        setIsSubmitting(false);
        return;
      }
      const result = await register({
        ...form,
        age,
        birthLabel,
        ageVerified: true,
        ageVerificationStatus: 'verified',
        ageVerificationProvider: 'birthdate-check',
        ageVerificationReferenceId: '',
        ageVerificationCheckedAt: new Date().toISOString(),
        selfieVerified: false,
        selfieVerificationStatus: 'not_required',
      });
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
      console.warn('Night-Whisper register failed', registerError);
      setError(registerError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppBackground>
      <ScreenHeader
        title="Sign Up To Night-Whisper"
        subtitle="Geburtsdatum, Profilbild und Profildaten"
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
            <Text style={styles.uploadText}>Wähle dein sichtbares Profilbild für dein Profil.</Text>
          </View>
        </Pressable>

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
        <Text style={styles.birthHint}>Für die Registrierung wird dein Alter direkt aus dem Geburtsdatum berechnet. Night-Whisper ist nur ab 18 Jahren verfügbar.</Text>

        <View style={styles.row}>
          <View style={styles.half}><FormField label="Körpergröße" value={form.height} onChangeText={(value) => updateField('height', value)} placeholder="1,75 m" /></View>
          <View style={styles.half}><Text style={styles.pickerLabel}>Figur</Text><View style={styles.pickerWrap}><Picker selectedValue={form.figure} onValueChange={(value) => updateField('figure', value)} dropdownIconColor={affairGoTheme.colors.text}>{FIGURE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
        </View>

        {shouldShowPenisSizeField(form.gender) ? <FormField label="Penisgröße" value={form.penisSize} onChangeText={(value) => updateField('penisSize', value)} hint="Angabe im erigierten Zustand" placeholder="16 cm" /> : null}
        {shouldShowBraSizeField(form.gender) ? <FormField label="BH-Größe" value={form.braSize} onChangeText={(value) => updateField('braSize', value)} placeholder="75B" /> : null}

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
  birthHint: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
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