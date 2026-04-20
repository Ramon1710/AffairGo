import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const LoginScreen = () => {
  const navigation = useNavigation();
  const { login, requestPasswordReset } = useAffairGo();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const passwordIcon = useMemo(() => (showPassword ? 'eye-off-outline' : 'eye-outline'), [showPassword]);

  const handleLogin = async () => {
    try {
      setError('');
      setInfo('');
      const result = await login({ identifier, password });
      navigation.reset({ index: 0, routes: [{ name: result.needsOnboarding ? 'Onboarding' : 'Dashboard' }] });
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  const handleReset = async () => {
    try {
      setError('');
      setInfo('');
      await requestPasswordReset(identifier);
      setResetOpen(false);
      setInfo('Eine Passwort-Reset-Mail wurde versendet. Bitte pruefe dein Postfach.');
    } catch (resetError) {
      setError(resetError.message || 'Zu diesem Spitznamen oder dieser E-Mail wurde kein Konto gefunden.');
      setResetOpen(false);
    }
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
          label="E-Mail"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="name@mail.de"
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
        {info ? <Text style={styles.infoText}>{info}</Text> : null}

        <AccentButton label="Log In" onPress={handleLogin} style={styles.cta} />
        <AccentButton label="Registrieren" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </GlassCard>

      <Modal transparent animationType="fade" visible={resetOpen} onRequestClose={() => setResetOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.modalTitle}>Passwort vergessen</Text>
            <Text style={styles.modalText}>
              Firebase verschickt einen Reset-Link an die hinterlegte E-Mail-Adresse.
            </Text>
            <AccentButton label="Mail senden" onPress={handleReset} style={styles.modalButton} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => setResetOpen(false)} />
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
  infoText: {
    color: affairGoTheme.colors.success,
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