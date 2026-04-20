import { Picker } from '@react-native-picker/picker';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, GENDER_OPTIONS, HAIR_OPTIONS, MONTH_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 82 }, (_, index) => currentYear - 18 - index);

const RegisterScreen = () => {
  const navigation = useNavigation();
  const { register } = useAffairGo();
  const [form, setForm] = useState({
    profileImageUploaded: false,
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
  });
  const [error, setError] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

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

  const updateField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  const handleRegister = async () => {
    try {
      setError('');
      if (form.password !== form.repeatPassword) {
        setError('Die Passwoerter stimmen nicht ueberein.');
        return;
      }
      await register({ ...form, age, birthLabel });
      setRegisteredEmail(form.email);
    } catch (registerError) {
      setError(registerError.message);
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
        <Pressable style={styles.uploadTile} onPress={() => updateField('profileImageUploaded', true)}>
          <View style={[styles.uploadPreview, form.profileImageUploaded && styles.uploadPreviewActive]}>
            <Ionicons name={form.profileImageUploaded ? 'checkmark' : 'camera-outline'} size={28} color={affairGoTheme.colors.text} />
          </View>
          <View style={styles.uploadCopy}>
            <Text style={styles.uploadTitle}>Profilbild</Text>
            <Text style={styles.uploadText}>Beim Upload wird ein Selfie plus KI-Abgleich simuliert. Das Selfie wird danach geloescht.</Text>
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
          <View style={styles.half}><FormField label="Vorname" value={form.firstName} onChangeText={(value) => updateField('firstName', value)} hint="Nicht sichtbar fuer andere Nutzer" placeholder="Vorname" /></View>
          <View style={styles.half}><FormField label="Nachname" value={form.lastName} onChangeText={(value) => updateField('lastName', value)} hint="Nicht sichtbar fuer andere Nutzer" placeholder="Nachname" /></View>
        </View>

        <FormField label="Spitzname" value={form.nickname} onChangeText={(value) => updateField('nickname', value)} hint="Oeffentlich sichtbar im Profil" placeholder="Spitzname" />

        <Text style={styles.sectionLabel}>Geburtsdatum</Text>
        <View style={styles.row}>
          <View style={styles.day}><FormField label="Tag" value={form.birthDay} onChangeText={(value) => updateField('birthDay', value)} placeholder="17" keyboardType="number-pad" /></View>
          <View style={styles.month}><Text style={styles.pickerLabel}>Monat</Text><View style={styles.pickerWrap}><Picker selectedValue={form.birthMonth} onValueChange={(value) => updateField('birthMonth', value)} dropdownIconColor={affairGoTheme.colors.text}>{MONTH_OPTIONS.map((month, index) => <Picker.Item key={month} label={month} value={index} color="#111" />)}</Picker></View></View>
          <View style={styles.year}><Text style={styles.pickerLabel}>Jahr</Text><View style={styles.pickerWrap}><Picker selectedValue={form.birthYear} onValueChange={(value) => updateField('birthYear', value)} dropdownIconColor={affairGoTheme.colors.text}>{yearOptions.map((year) => <Picker.Item key={year} label={String(year)} value={year} color="#111" />)}</Picker></View></View>
        </View>
        <Text style={styles.birthLabel}>{birthLabel}</Text>

        <View style={styles.row}>
          <View style={styles.half}><FormField label="Koerpergroesse" value={form.height} onChangeText={(value) => updateField('height', value)} placeholder="1,75 m" /></View>
          <View style={styles.half}><Text style={styles.pickerLabel}>Figur</Text><View style={styles.pickerWrap}><Picker selectedValue={form.figure} onValueChange={(value) => updateField('figure', value)} dropdownIconColor={affairGoTheme.colors.text}>{FIGURE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
        </View>

        {(form.gender === 'maennlich' || form.gender === 'divers') ? <FormField label="Penisgroesse" value={form.penisSize} onChangeText={(value) => updateField('penisSize', value)} hint="Angabe im erigierten Zustand" placeholder="16 cm" /> : null}
        {(form.gender === 'weiblich' || form.gender === 'divers') ? <FormField label="BH-Groesse" value={form.braSize} onChangeText={(value) => updateField('braSize', value)} placeholder="75B" /> : null}

        <View style={styles.row}>
          <View style={styles.half}><Text style={styles.pickerLabel}>Haarfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={form.hairColor} onValueChange={(value) => updateField('hairColor', value)} dropdownIconColor={affairGoTheme.colors.text}>{HAIR_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
          <View style={styles.half}><Text style={styles.pickerLabel}>Augenfarbe</Text><View style={styles.pickerWrap}><Picker selectedValue={form.eyeColor} onValueChange={(value) => updateField('eyeColor', value)} dropdownIconColor={affairGoTheme.colors.text}>{EYE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
        </View>

        <Text style={styles.pickerLabel}>Hauttyp</Text>
        <View style={styles.pickerWrap}><Picker selectedValue={form.skinType} onValueChange={(value) => updateField('skinType', value)} dropdownIconColor={affairGoTheme.colors.text}>{SKIN_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {registeredEmail ? <Text style={styles.successText}>Registrierung erfolgreich. Eine Verifizierungs-Mail wurde an {registeredEmail} gesendet. Nach der Bestaetigung kannst du dich einloggen.</Text> : null}

        <AccentButton label="Registrieren" onPress={handleRegister} style={styles.buttonGap} />
        <AccentButton label="Zum Login" variant="secondary" onPress={() => navigation.navigate('Login')} />
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
  errorText: {
    color: affairGoTheme.colors.danger,
    marginBottom: 10,
  },
  successText: {
    color: affairGoTheme.colors.success,
    lineHeight: 22,
    marginBottom: 12,
  },
  buttonGap: {
    marginBottom: 10,
  },
});

export default RegisterScreen;