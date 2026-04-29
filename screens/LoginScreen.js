import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, FormField, GlassCard, ScreenHeader } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { useNavigation, useRoute } from '../naviagtion/SimpleNavigation';

const LoginScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { login, requestPasswordReset, resendVerificationEmail, changePassword } = useAffairGo();
  const [identifier, setIdentifier] = useState(route.params?.prefillEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(route.params?.infoMessage || '');
  const [resetOpen, setResetOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(Boolean(route.params?.showSuccessModal));
  const [forcePasswordChangeOpen, setForcePasswordChangeOpen] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [pendingNextRoute, setPendingNextRoute] = useState('Dashboard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const passwordIcon = useMemo(() => (showPassword ? 'eye-off-outline' : 'eye-outline'), [showPassword]);

  useEffect(() => {
    if (route.params?.prefillEmail) {
      setIdentifier(route.params.prefillEmail);
    }
    if (route.params?.infoMessage) {
      setInfo(route.params.infoMessage);
    }
    setSuccessOpen(Boolean(route.params?.showSuccessModal));
  }, [route.params]);

  const handleLogin = async () => {
    try {
      setError('');
      setInfo('');
      setIsSubmitting(true);
      const result = await login({ identifier, password });
      if (result.requiresPasswordChange) {
        setPendingNextRoute(result.needsOnboarding ? 'Onboarding' : 'Dashboard');
        setForcePasswordChangeOpen(true);
        setInfo('Bitte ändere jetzt dein Passwort, bevor du die App weiter nutzt.');
        return;
      }
      navigation.reset({ index: 0, routes: [{ name: result.needsOnboarding ? 'Onboarding' : 'Dashboard' }] });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    try {
      setError('');
      setInfo('');
      setIsResetSubmitting(true);
      await requestPasswordReset(identifier);
      setResetOpen(false);
      setInfo('Eine Passwort-Reset-Mail wurde versendet. Bitte prüfe dein Postfach. Nach dem nächsten Login musst du dein Passwort einmal neu setzen.');
    } catch (resetError) {
      setError(resetError.message || 'Zu diesem Spitznamen oder dieser E-Mail wurde kein Konto gefunden.');
      setResetOpen(false);
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setError('');
      setIsResendingVerification(true);
      const result = await resendVerificationEmail({ email: identifier, password });
      if (result.alreadyVerified) {
        setInfo('Deine E-Mail-Adresse ist bereits bestätigt. Du kannst dich jetzt normal einloggen.');
        return;
      }
      setInfo('Die Verifizierungs-Mail wurde erneut gesendet. Bitte prüfe dein Postfach und den Spam-Ordner.');
    } catch (resendError) {
      setError(resendError.message);
    } finally {
      setIsResendingVerification(false);
    }
  };

  const showResendVerification =
    Boolean(error && /verifizierungs-mail|e-mail-adresse/i.test(error)) ||
    Boolean(info && /verifizierungs-mail/i.test(info));

  const handleForcedPasswordChange = async () => {
    try {
      setPasswordChangeError('');
      setIsChangingPassword(true);

      if (!newPassword || newPassword !== repeatPassword) {
        setPasswordChangeError('Die neuen Passwörter stimmen nicht überein.');
        return;
      }

      await changePassword({ newPassword, skipCurrentPasswordCheck: true });
      setForcePasswordChangeOpen(false);
      setNewPassword('');
      setRepeatPassword('');
      navigation.reset({ index: 0, routes: [{ name: pendingNextRoute }] });
    } catch (changeError) {
      setPasswordChangeError(changeError.message || 'Das Passwort konnte nicht geändert werden.');
    } finally {
      setIsChangingPassword(false);
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
          label="Spitzname / E-Mail"
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Spitzname oder name@mail.de"
          autoCapitalize="none"
        />
        <Text style={styles.helperText}>Login, Passwort-Reset und Verifizierungs-Mails funktionieren mit Spitzname oder E-Mail.</Text>
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

        <AccentButton label={isSubmitting ? 'Login läuft...' : 'Log In'} onPress={handleLogin} disabled={isSubmitting || isResetSubmitting || isResendingVerification} style={styles.cta} />
        {showResendVerification ? <AccentButton label={isResendingVerification ? 'Mail wird gesendet...' : 'Verifizierungs-Mail erneut senden'} variant="secondary" onPress={handleResendVerification} disabled={isSubmitting || isResetSubmitting || isResendingVerification} style={styles.cta} /> : null}
        <AccentButton label="Registrieren" variant="secondary" onPress={() => navigation.navigate('Register')} disabled={isSubmitting || isResetSubmitting || isResendingVerification} />
      </GlassCard>

      {resetOpen ? (
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.modalTitle}>Passwort vergessen</Text>
            <Text style={styles.modalText}>
              Firebase verschickt einen Reset-Link an die hinterlegte E-Mail-Adresse.
            </Text>
            <AccentButton label={isResetSubmitting ? 'Mail wird gesendet...' : 'Mail senden'} onPress={handleReset} disabled={isResetSubmitting} style={styles.modalButton} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => setResetOpen(false)} disabled={isResetSubmitting} />
          </GlassCard>
        </View>
      ) : null}

      {successOpen ? (
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.modalTitle}>Registrierung erfolgreich</Text>
            <Text style={styles.modalText}>{info}</Text>
            <AccentButton label="Weiter zum Login" onPress={() => setSuccessOpen(false)} style={styles.modalButton} />
          </GlassCard>
        </View>
      ) : null}

      {forcePasswordChangeOpen ? (
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.modalTitle}>Passwort ändern</Text>
            <Text style={styles.modalText}>Aus Sicherheitsgründen musst du nach dem Passwort-Reset jetzt ein neues Passwort setzen.</Text>
            <FormField label="Neues Passwort" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <FormField label="Neues Passwort wiederholen" value={repeatPassword} onChangeText={setRepeatPassword} secureTextEntry />
            {passwordChangeError ? <Text style={styles.errorText}>{passwordChangeError}</Text> : null}
            <AccentButton label={isChangingPassword ? 'Passwort wird gespeichert...' : 'Passwort speichern'} onPress={handleForcedPasswordChange} disabled={isChangingPassword} style={styles.modalButton} />
          </GlassCard>
        </View>
      ) : null}
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
  helperText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 20,
    marginTop: -4,
    marginBottom: 12,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 20,
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