import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AccentButton, AppBackground, BulletRow, GlassCard, InfoBanner, InlineStat, SectionTitle, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { accessColors, accessLabels, affairGoTheme } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { WEBSITE_SECTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const LandingScreen = () => {
  const { width } = useWindowDimensions();
  const navigation = useNavigation();
  const { currentUser, events, visibleProfiles, isAuthenticated, featureIdeas, accessStatusLabel } = useAffairGo();
  const isCompactWeb = Platform.OS === 'web' && width < 900;

  return (
    <AppBackground contentContainerStyle={styles.content}>
      <View style={[styles.hero, Platform.OS === 'web' && !isCompactWeb && styles.heroWeb]}>
        <View style={styles.heroCopy}>
          <View style={styles.badge}>
            <Ionicons name="heart" size={18} color={affairGoTheme.colors.accent} />
            <Text style={styles.badgeText}>Night-Whisper</Text>
          </View>
          <Text style={styles.domainText}>night-whisper.com</Text>
          <Text style={styles.heroTitle}>Night-Whisper verbindet diskret, stilvoll und direkt in deiner Stadt.</Text>
          <Text style={styles.heroText}>
            Erstelle dein Profil, entdecke passende Kontakte, nutze die Matching Map und starte Gespräche direkt in der Webapp.
          </Text>
          <View style={[styles.heroActions, isCompactWeb && styles.heroActionsCompact]}>
            <AccentButton
              label={isAuthenticated ? 'Direkt ins Dashboard' : 'Zur Webapp'}
              onPress={() => navigation.navigate(isAuthenticated ? 'Dashboard' : 'Login')}
              style={[styles.heroButton, isCompactWeb && styles.heroButtonCompact]}
            />
            <AccentButton
              label="Registrieren"
              variant="secondary"
              onPress={() => navigation.navigate('Register')}
              style={[styles.heroButton, isCompactWeb && styles.heroButtonCompact]}
            />
          </View>
          <View style={styles.statRow}>
            <InlineStat label="Aktives Profil" value={currentUser.nickname} accent={accessColors[currentUser.membership] || affairGoTheme.colors.accent} />
            <InlineStat label="Sichtbare Matches" value={String(visibleProfiles.length)} />
            <InlineStat label="Events im Radius" value={String(events.length)} />
          </View>
          <View style={styles.statusRow}>
            <StatusPill label={accessLabels[currentUser.membership] || 'Kostenfrei'} tone="success" />
            <StatusPill label={isAuthenticated ? 'Angemeldet' : 'Gastmodus'} tone={isAuthenticated ? 'success' : 'default'} style={styles.statusPill} />
          </View>
          <Text style={styles.membershipStatus}>{accessStatusLabel}</Text>
        </View>

        <GlassCard strong style={[styles.previewCard, isCompactWeb && styles.previewCardCompact]}>
          <Text style={styles.previewEyebrow}>Live-Vorschau</Text>
          <Text style={styles.previewTitle}>Direkt verbunden mit der Webapp</Text>
          <BulletRow icon="shield-checkmark-outline" label="18+ und Bildprüfung" detail="Sicherheitsprüfungen und Profilfreigaben sorgen für mehr Vertrauen beim Kennenlernen." />
          <BulletRow icon="navigate-outline" label="Matching Map mit Radius" detail="Finde Kontakte in deiner Nähe, filtere nach Radius und behalte die Übersicht unterwegs." />
          <BulletRow icon="chatbubble-ellipses-outline" label="Chat, Spiele und Icebreaker" detail="Starte Gespräche direkt, lockere Matches auf und bleibe unkompliziert in Kontakt." />
        </GlassCard>
      </View>

      <SectionTitle title="Funktionen" aside="Night-Whisper" />
      <View style={[styles.sectionGrid, Platform.OS === 'web' && !isCompactWeb && styles.sectionGridWeb]}>
        {WEBSITE_SECTIONS.map((section) => (
          <GlassCard key={section.title} style={[styles.sectionCard, isCompactWeb && styles.sectionCardCompact]}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <BulletRow key={item} icon="checkmark-circle-outline" label={item} />
            ))}
          </GlassCard>
        ))}
      </View>

      <SectionTitle title="Mitgliedschaft" aside="kostenlos bis Anfang 2027" />
      <GlassCard strong style={styles.freeAccessCard}>
        <Text style={styles.cardTitle}>Kostenlos beitreten und direkt loslegen</Text>
        <Text style={styles.modalText}>Bis Anfang 2027 bleiben Registrierung, Login und die aktuellen Webapp-Funktionen ohne Bezahlschranke verfügbar.</Text>
        <Text style={styles.setupHint}>So kannst du Night-Whisper ohne Hürden kennenlernen, Kontakte aufbauen und die Plattform sofort nutzen.</Text>
        <AccentButton label={isAuthenticated ? 'Direkt in die Webapp' : 'Jetzt kostenlos starten'} onPress={() => navigation.navigate(isAuthenticated ? 'Dashboard' : 'Register')} style={styles.planButton} />
      </GlassCard>

      <SectionTitle title="Sicherheit und Community" aside="direkt verknüpft" />
      <View style={[styles.communityRow, Platform.OS === 'web' && !isCompactWeb && styles.communityRowWeb]}>
        <GlassCard style={[styles.communityCard, isCompactWeb && styles.communityCardCompact]}>
          <Text style={styles.cardTitle}>Sicherheitslogik</Text>
          <BulletRow icon="warning-outline" label="Alte Fotos markieren" detail="6 Monate = Hinweis, 12 Monate = rote Warnung im Profil und auf Karten." />
          <BulletRow icon="sparkles-outline" label="Alle Kernfunktionen freigeschaltet" detail="Direktnachrichten, Explore, Matching Map und priorisierte Ansichten stehen dir ohne Zusatzschritte offen." />
          <BulletRow icon="camera-outline" label="Screenshot-Schutz" detail="Sensible Bereiche werden zusätzlich geschützt, damit private Inhalte nicht unbemerkt gesichert werden." />
        </GlassCard>
        <GlassCard style={[styles.communityCard, isCompactWeb && styles.communityCardCompact]}>
          <Text style={styles.cardTitle}>Community-Ideenbox</Text>
          <Text style={styles.ideaLead}>Bisher eingereichte Ideen: {featureIdeas.length}</Text>
          <Text style={styles.ideaText}>Frühe Nutzer helfen beim Aufbau der Community, schlagen Features vor und prägen so die Richtung von Night-Whisper aktiv mit.</Text>
          <AccentButton label="Jetzt starten" onPress={() => navigation.navigate(isAuthenticated ? 'Dashboard' : 'Login')} />
        </GlassCard>
      </View>

      <InfoBanner
        title="Diskret und klar"
        detail="Night-Whisper kombiniert ein reduziertes Design mit klaren Profilen, Matching Map, Chat und Sicherheitsfunktionen für einen ruhigen, direkten Einstieg."
        style={styles.demoBanner}
      />
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingBottom: 48,
  },
  hero: {
    marginBottom: 26,
  },
  heroWeb: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1,
    marginBottom: 18,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: affairGoTheme.colors.line,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: affairGoTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  badgeText: {
    color: affairGoTheme.colors.text,
    marginLeft: 8,
    fontWeight: '600',
  },
  domainText: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: affairGoTheme.colors.text,
    fontSize: Platform.OS === 'web' ? 52 : 36,
    fontWeight: '800',
    lineHeight: Platform.OS === 'web' ? 58 : 42,
    maxWidth: 760,
  },
  heroText: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 18,
    lineHeight: 28,
    marginTop: 14,
    maxWidth: 720,
  },
  heroActions: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    marginTop: 22,
  },
  heroActionsCompact: {
    flexDirection: 'column',
  },
  heroButton: {
    marginRight: Platform.OS === 'web' ? 12 : 0,
    marginBottom: Platform.OS === 'web' ? 0 : 12,
    minWidth: 180,
  },
  heroButtonCompact: {
    marginRight: 0,
    marginBottom: 12,
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 24,
  },
  membershipStatus: {
    color: affairGoTheme.colors.textMuted,
    marginTop: 12,
    lineHeight: 22,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  statusPill: {
    marginLeft: 0,
  },
  previewCard: {
    flex: Platform.OS === 'web' ? 0.8 : undefined,
    marginLeft: Platform.OS === 'web' ? 22 : 0,
    alignSelf: 'stretch',
  },
  previewCardCompact: {
    flex: undefined,
    marginLeft: 0,
    marginTop: 6,
  },
  previewEyebrow: {
    color: affairGoTheme.colors.accentSoft,
    fontSize: 14,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  previewTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
  },
  sectionGrid: {
    marginBottom: 12,
  },
  sectionGridWeb: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sectionCard: {
    marginBottom: 14,
    width: Platform.OS === 'web' ? '32%' : '100%',
  },
  sectionCardCompact: {
    width: '100%',
  },
  cardTitle: {
    color: affairGoTheme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  pricingRow: {
    marginBottom: 16,
  },
  pricingRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceCard: {
    marginBottom: 14,
    width: Platform.OS === 'web' ? '32%' : '100%',
  },
  planName: {
    fontSize: 26,
    fontWeight: '800',
  },
  planPrice: {
    color: affairGoTheme.colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 14,
  },
  planPromo: {
    color: affairGoTheme.colors.success,
    fontWeight: '700',
    marginBottom: 6,
  },
  planDetail: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  planFeature: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
  },
  planButton: {
    marginTop: 18,
  },
  communityRow: {
    marginBottom: 12,
  },
  communityRowWeb: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  communityCard: {
    width: Platform.OS === 'web' ? '49%' : '100%',
    marginBottom: 14,
  },
  communityCardCompact: {
    width: '100%',
  },
  demoBanner: {
    marginTop: 4,
    marginBottom: 20,
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
  modalText: {
    color: affairGoTheme.colors.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  setupHint: {
    color: affairGoTheme.colors.accentSoft,
    lineHeight: 20,
    marginBottom: 14,
  },
  ideaLead: {
    color: affairGoTheme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  ideaText: {
    color: affairGoTheme.colors.textMuted,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
});

export default LandingScreen;