import { Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader, ToggleChip } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { EYE_OPTIONS, FIGURE_OPTIONS, HAIR_OPTIONS, SKIN_OPTIONS } from '../data/mockData';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';

const ProfilScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentUser, users, updateCurrentUser, addGalleryItem, logout, preferenceOptions, tabooOptions, getCompatibility, changePassword } = useAffairGo();
  const viewedProfile = useMemo(() => (route.params?.profileId ? users.find((entry) => entry.id === route.params.profileId) : currentUser), [currentUser, route.params?.profileId, users]);
  const isOwnProfile = !route.params?.profileId || route.params.profileId === currentUser.id;
  const [draft, setDraft] = useState(currentUser);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const updateField = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }));
  const toggleListValue = (key, value) => {
    setDraft((previous) => ({
      ...previous,
      [key]: previous[key].includes(value) ? previous[key].filter((entry) => entry !== value) : [...previous[key], value],
    }));
  };
  const save = async () => {
    try {
      await updateCurrentUser(draft);
      Alert.alert('Gespeichert', 'Dein Profil wurde in Firebase aktualisiert.');
    } catch (saveError) {
      Alert.alert('Fehler', saveError.message || 'Profil konnte nicht gespeichert werden.');
    }
  };
  const savePassword = async () => {
    if (!newPassword || newPassword !== repeatPassword) {
      setPasswordError('Die neuen Passwoerter stimmen nicht ueberein.');
      return;
    }

    try {
      await changePassword(newPassword);
      setPasswordModalOpen(false);
      setNewPassword('');
      setRepeatPassword('');
      setPasswordError('');
      Alert.alert('Gespeichert', 'Dein Passwort wurde aktualisiert.');
    } catch (changeError) {
      setPasswordError(changeError.message || 'Passwort konnte nicht geaendert werden.');
    }
  };

  const profile = isOwnProfile ? draft : viewedProfile;

  if (!profile) {
    return null;
  }

  return (
    <AppBackground>
      <ScreenHeader
        title={isOwnProfile ? 'Dein Profil' : profile.nickname}
        subtitle={isOwnProfile ? 'Persoenliche Daten' : `Kompatibilitaet ${getCompatibility(currentUser.preferences, profile.preferences)}%`}
        leftAction={
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.accentSoft} />
          </Pressable>
        }
        rightAction={isOwnProfile ? <Pressable onPress={async () => { await logout(); navigation.reset({ index: 0, routes: [{ name: 'Landing' }] }); }}><Ionicons name="log-out-outline" size={28} color={affairGoTheme.colors.text} /></Pressable> : null}
      />

      <GlassCard strong style={styles.heroCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={76} color={affairGoTheme.colors.text} />
        </View>
        <Text style={styles.nameLine}>{isOwnProfile ? `${profile.firstName} ${profile.lastName}` : profile.nickname}</Text>
        <Text style={styles.metaLine}>{profile.birthLabel || `${profile.birthDay}. ${profile.birthMonth + 1}. ${profile.birthYear} (${profile.age} Jahre)`}</Text>
        <Text style={styles.metaLine}>{profile.gender}</Text>
        <Text style={styles.photoAge}>Profilbild hochgeladen: vor {profile.profilePhotoAgeMonths} Monaten</Text>
        {profile.profilePhotoAgeMonths >= 12 ? <Text style={styles.warnRed}>Rote Warnung: Profilbild aelter als 12 Monate</Text> : null}
        {profile.profilePhotoAgeMonths >= 6 && profile.profilePhotoAgeMonths < 12 ? <Text style={styles.warnSoft}>Hinweis: Profilbild aelter als 6 Monate</Text> : null}
      </GlassCard>

      <GlassCard style={styles.infoCard}>
        {isOwnProfile ? (
          <>
            <FormField label="E-Mail-Adresse" value={profile.email} onChangeText={(value) => updateField('email', value)} hint="Aenderung wird erst nach Bestaetigung aktiv" />
            <FormField label="Spitzname" value={profile.nickname} onChangeText={(value) => updateField('nickname', value)} hint="Oeffentlich sichtbar, nur falls verfuegbar" />
            <View style={styles.row}>
              <View style={styles.half}><FormField label="Koerpergroesse" value={profile.height} onChangeText={(value) => updateField('height', value)} /></View>
              <View style={styles.half}><Text style={styles.pickerLabel}>Figur</Text><View style={styles.pickerWrap}><Picker selectedValue={profile.figure} onValueChange={(value) => updateField('figure', value)}>{FIGURE_OPTIONS.map((item) => <Picker.Item key={item} label={item} value={item} color="#111" />)}</Picker></View></View>
            </View>
            <AccentButton label="Passwort aendern" variant="secondary" onPress={() => setPasswordModalOpen(true)} style={styles.passwordButton} />
            {(profile.gender === 'maennlich' || profile.gender === 'divers') ? <FormField label="Penisgroesse" value={profile.penisSize} onChangeText={(value) => updateField('penisSize', value)} /> : null}
            {(profile.gender === 'weiblich' || profile.gender === 'divers') ? <FormField label="BH-Groesse" value={profile.braSize} onChangeText={(value) => updateField('braSize', value)} /> : null}
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
            <Text style={styles.readonlyLine}>Spitzname: {profile.nickname}</Text>
            <Text style={styles.readonlyLine}>Koerpergroesse: {profile.height}</Text>
            <Text style={styles.readonlyLine}>Figur: {profile.figure}</Text>
            {profile.penisSize ? <Text style={styles.readonlyLine}>Penisgroesse: {profile.penisSize}</Text> : null}
            {profile.braSize ? <Text style={styles.readonlyLine}>BH-Groesse: {profile.braSize}</Text> : null}
          </>
        )}
      </GlassCard>

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
              <Ionicons name="image-outline" size={28} color={affairGoTheme.colors.textMuted} />
              <Text style={styles.galleryLabel}>{item.label}</Text>
              <Text style={styles.galleryAge}>{item.ageLabel}</Text>
            </View>
          ))}
          {isOwnProfile && profile.gallery.length < 10 ? (
            <Pressable style={styles.galleryItem} onPress={addGalleryItem}>
              <Ionicons name="add" size={34} color={affairGoTheme.colors.text} />
              <Text style={styles.galleryLabel}>Foto hinzufuegen</Text>
            </Pressable>
          ) : null}
        </View>
      </GlassCard>

      <Modal transparent visible={passwordModalOpen} animationType="fade" onRequestClose={() => setPasswordModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.groupTitle}>Passwort aendern</Text>
            <FormField label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <FormField label="Neues Passwort wiederholen" value={repeatPassword} onChangeText={setRepeatPassword} secureTextEntry />
            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}
            <AccentButton label="Speichern" onPress={savePassword} style={styles.modalButton} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => setPasswordModalOpen(false)} />
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
});

export default ProfilScreen;