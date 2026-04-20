import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, BulletRow, GlassCard, InlineStat, SectionTitle } from '../components/AffairGoUI';
import { affairGoTheme, membershipColors } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { PRICING_PLANS, WEBSITE_SECTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const LandingScreen = () => {
  const navigation = useNavigation();
  const { currentUser, events, visibleProfiles, isAuthenticated, activatePlan, featureIdeas } = useAffairGo();

  return (
    <AppBackground contentContainerStyle={styles.content}>
      <View style={[styles.hero, Platform.OS === 'web' && styles.heroWeb]}>
        <View style={styles.heroCopy}>
          <View style={styles.badge}>
            <Ionicons name="heart" size={18} color={affairGoTheme.colors.accent} />
            <Text style={styles.badgeText}>AffairGo Website + Webapp</Text>
          </View>
          <Text style={styles.domainText}>www.affair-go.com</Text>
          <Text style={styles.heroTitle}>Sicheres Matching, Reiseplanung und Community in einem gemeinsamen System.</Text>
          <Text style={styles.heroText}>
            Die Website erklaert das Produkt, die Webapp nutzt denselben Zustand fuer Login, Profil, Matching Map,
            Events, Reisen, Chat und Premium-Logik.
          </Text>
          <View style={styles.heroActions}>
            <AccentButton
              label={isAuthenticated ? 'Direkt ins Dashboard' : 'Zur Webapp'}
              onPress={() => navigation.navigate(isAuthenticated ? 'Dashboard' : 'Login')}
              style={styles.heroButton}
            />
            <AccentButton
              label="Registrieren"
              variant="secondary"
              onPress={() => navigation.navigate('Register')}
              style={styles.heroButton}
            />
          </View>
          <View style={styles.statRow}>
            <InlineStat label="Demo-Profil" value={currentUser.nickname} accent={membershipColors[currentUser.membership]} />
            <InlineStat label="Sichtbare Matches" value={String(visibleProfiles.length)} />
            <InlineStat label="Events im Radius" value={String(events.length)} />
          </View>
        </View>

        <GlassCard strong style={styles.previewCard}>
          <Text style={styles.previewEyebrow}>Live-Vorschau</Text>
          <Text style={styles.previewTitle}>Direkt verbunden mit der Webapp</Text>
          <BulletRow icon="shield-checkmark-outline" label="18+ und Bildpruefung" detail="Profilfoto-Upload mit KI-Selfie-Check als verifizierter Flow modelliert." />
          <BulletRow icon="navigate-outline" label="Matching Map mit Radius" detail="Aktive Suche, Reise-Modi, Fotoalter-Filter und Radar greifen auf dieselben Mock-Daten zu." />
          <BulletRow icon="chatbubble-ellipses-outline" label="Chat, Spiele und Icebreaker" detail="Nach Match sofort schreiben, als Gold auch vor Match. Punkte werden direkt dem Profil gutgeschrieben." />
        </GlassCard>
      </View>

      <SectionTitle title="Funktionsschema" aside="Website" />
      <View style={[styles.sectionGrid, Platform.OS === 'web' && styles.sectionGridWeb]}>
        {WEBSITE_SECTIONS.map((section) => (
          <GlassCard key={section.title} style={styles.sectionCard}>
            <Text style={styles.cardTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <BulletRow key={item} icon="checkmark-circle-outline" label={item} />
            ))}
          </GlassCard>
        ))}
      </View>

      <SectionTitle title="Preise" aside="3 Wochen Premium gratis" />
      <View style={[styles.pricingRow, Platform.OS === 'web' && styles.pricingRowWeb]}>
        {PRICING_PLANS.map((plan) => (
          <GlassCard key={plan.key} style={styles.priceCard}>
            <Text style={[styles.planName, { color: membershipColors[plan.key] }]}>{plan.title}</Text>
            <Text style={styles.planPrice}>{plan.price}</Text>
            {plan.features.map((feature) => (
              <Text key={feature} style={styles.planFeature}>• {feature}</Text>
            ))}
            <AccentButton
              label={`Demo auf ${plan.title}`}
              variant={plan.key === 'basic' ? 'secondary' : 'primary'}
              onPress={() => activatePlan(plan.key)}
              style={styles.planButton}
            />
          </GlassCard>
        ))}
      </View>

      <SectionTitle title="Sicherheit und Community" aside="direkt verknuepft" />
      <View style={[styles.communityRow, Platform.OS === 'web' && styles.communityRowWeb]}>
        <GlassCard style={styles.communityCard}>
          <Text style={styles.cardTitle}>Sicherheitslogik</Text>
          <BulletRow icon="warning-outline" label="Alte Fotos markieren" detail="6 Monate = Hinweis, 12 Monate = rote Warnung im Profil und auf Karten." />
          <BulletRow icon="eye-off-outline" label="Unsichtbar suchen ist nicht erlaubt" detail="Sichtbarkeit gibt es nur, wenn der Suchmodus aktiv ist." />
          <BulletRow icon="camera-outline" label="Screenshot-Schutz" detail="Im Web als Hinweis modelliert, in nativen Builds fuer Chat und Profil als Plattform-Feature gedacht." />
        </GlassCard>
        <GlassCard style={styles.communityCard}>
          <Text style={styles.cardTitle}>Community-Ideenbox</Text>
          <Text style={styles.ideaLead}>Bisher eingereichte Ideen: {featureIdeas.length}</Text>
          <Text style={styles.ideaText}>Nutzer koennen Features und Spiele vorschlagen. Bei Annahme sind Boosts, Premium-Tage oder Punkte moeglich.</Text>
          <AccentButton label="Jetzt einloggen" onPress={() => navigation.navigate('Login')} />
        </GlassCard>
      </View>
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
  heroButton: {
    marginRight: Platform.OS === 'web' ? 12 : 0,
    marginBottom: Platform.OS === 'web' ? 0 : 12,
    minWidth: 180,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 24,
  },
  previewCard: {
    flex: Platform.OS === 'web' ? 0.8 : undefined,
    marginLeft: Platform.OS === 'web' ? 22 : 0,
    alignSelf: 'stretch',
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