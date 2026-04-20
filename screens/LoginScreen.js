import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader } from '../components/AffairGoUI';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login, requestPasswordReset, changePassword } = useAffairGo();
  const [identifier, setIdentifier] = useState('demo@affairgo.app');
  const [password, setPassword] = useState('AffairGo123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');

  const passwordIcon = useMemo(() => (showPassword ? 'eye-off-outline' : 'eye-outline'), [showPassword]);

  const handleLogin = () => {
    try {
      setError('');
      const result = login({ identifier, password });
      if (result.requiresPasswordChange) {
        setMustChangePassword(true);
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: result.needsOnboarding ? 'Onboarding' : 'Dashboard' }] });
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  const handleReset = () => {
    const success = requestPasswordReset(identifier);
    setResetOpen(false);
    if (!success) {
      setError('Zu diesem Spitznamen oder dieser E-Mail wurde kein Konto gefunden.');
      return;
    }
    setMustChangePassword(true);
  };

  const handlePasswordChange = () => {
    if (!newPassword || newPassword !== repeatPassword) {
      setError('Die neuen Passwoerter stimmen nicht ueberein.');
      return;
    }
    changePassword(newPassword);
    setPassword(newPassword);
    setNewPassword('');
    setRepeatPassword('');
    setMustChangePassword(false);
    navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
  };

  return (
    <AppBackground contentContainerStyle={styles.content}>
      <ScreenHeader
        title="Log In To AffairGo"
        subtitle="www.affair-go.com"
        leftAction={
          <Pressable onPress={() => navigation.navigate('Landing')}>
            <Ionicons name="arrow-back" size={28} color={affairGoTheme.colors.accent} />
          </Pressable>
        }
        rightAction={
          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Sign Up</Text>
          </Pressable>
        }
      />

      <View style={styles.logoWrap}>
        <Ionicons name="heart" size={88} color={affairGoTheme.colors.accent} />
      </View>

      <GlassCard strong style={styles.card}>
        <FormField
          label="Spitzname oder E-Mail"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="nightpulse oder name@mail.de"
          autoCapitalize="none"
        />
        <FormField
          label="Passwort"
          value={password}
          onChangeText={setPassword}
          placeholder="Passwort"
          secureTextEntry={!showPassword}
          right={
            <Pressable onPress={() => setShowPassword((value) => !value)}>
              <Ionicons name={passwordIcon} size={20} color={affairGoTheme.colors.textMuted} />
            </Pressable>
          }
        />

        <Pressable onPress={() => setResetOpen(true)} style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>Passwort vergessen?</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <AccentButton label="Log In" onPress={handleLogin} style={styles.cta} />
        <AccentButton label="Registrieren" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </GlassCard>

      <Modal transparent animationType="fade" visible={resetOpen || mustChangePassword} onRequestClose={() => setResetOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            {resetOpen ? (
              <>
                <Text style={styles.modalTitle}>Passwort vergessen</Text>
                <Text style={styles.modalText}>
                  Es wird ein neues Passwort an die hinterlegte Mailadresse geschickt. Danach muss es beim naechsten Login geaendert werden.
                </Text>
                <AccentButton label="Mail senden" onPress={handleReset} style={styles.modalButton} />
                <AccentButton label="Abbrechen" variant="ghost" onPress={() => setResetOpen(false)} />
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Passwort aendern</Text>
                <Text style={styles.modalText}>Nach dem Zuruecksetzen ist eine direkte Passwortaenderung erforderlich.</Text>
                <FormField label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Neues Passwort" />
                <FormField label="Neues Passwort wiederholen" value={repeatPassword} onChangeText={setRepeatPassword} secureTextEntry placeholder="Passwort wiederholen" />
                <AccentButton label="Passwort speichern" onPress={handlePasswordChange} style={styles.modalButton} />
              </>
            )}
          </GlassCard>
        </View>
      </Modal>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  card: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  linkText: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 18,
  },
  inlineAction: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  inlineActionText: {
    color: affairGoTheme.colors.text,
    textDecorationLine: 'underline',
    fontSize: 16,
  },
  errorText: {
    color: affairGoTheme.colors.danger,
    marginBottom: 12,
  },
  cta: {
    marginBottom: 12,
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
  modalTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 10,
  },
  modalText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalButton: {
    marginBottom: 10,
  },
});

export default LoginScreen;