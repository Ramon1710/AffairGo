import { useState } from 'react';
import { Alert, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { AccentButton, AppBackground, BulletRow, GlassCard, InfoBanner, InlineStat, SectionTitle, StatusPill } from '../components/AffairGoUI';
import { Ionicons } from '../components/SimpleIcons';
import { affairGoTheme, membershipColors, membershipLabels } from '../constants/affairGoTheme';
import { useAffairGo } from '../context/AffairGoContext';
import { PRICING_PLANS, WEBSITE_SECTIONS } from '../data/mockData';
import { useNavigation } from '../naviagtion/SimpleNavigation';

const LandingScreen = () => {
  const navigation = useNavigation();
  const { currentUser, events, visibleProfiles, isAuthenticated, activatePlan, purchasePlan, featureIdeas, membershipStatusLabel, paymentBackendConfigured, paymentProviderLabel, paymentSetupInstructions } = useAffairGo();
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const openPurchaseModal = (plan) => {
    if (plan.key === 'basic') {
      activatePlan(plan.activation || plan.key);
      return;
    }

    setSelectedPlan(plan);
    setPurchaseModalOpen(true);
  };

  const handlePurchase = async (paymentMethod) => {
    if (!selectedPlan) {
      return;
    }

    try {
      setIsPurchasing(true);
      const result = await purchasePlan({ plan: selectedPlan.activation, paymentMethod });
      setPurchaseModalOpen(false);
      setSelectedPlan(null);

      if (result.checkoutResult?.mode === 'demo') {
        Alert.alert('Demo-Kauf aktiviert', `${selectedPlan.title} wurde lokal aktiviert. Für echte Käufe hinterlege jetzt dein Billing-Backend oder eine Hosted-Checkout-URL.`);
        return;
      }

      Alert.alert('Checkout gestartet', `${selectedPlan.title} wurde über ${result.checkoutResult?.provider || paymentProviderLabel} gestartet.${result.checkoutResult?.checkoutUrl ? ' Das Checkout-Fenster wurde geöffnet.' : ''}`);
    } catch (error) {
      Alert.alert('Kauf konnte nicht gestartet werden', error.message || 'Bitte prüfe die Zahlungs-Konfiguration.');
    } finally {
      setIsPurchasing(false);
    }
  };

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
            Die Website erklärt das Produkt, die Webapp nutzt denselben Zustand für Login, Profil, Matching Map,
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
          <View style={styles.statusRow}>
            <StatusPill label={membershipLabels[currentUser.membership]} tone={currentUser.membership === 'gold' ? 'warning' : currentUser.membership === 'premium' ? 'info' : 'default'} />
            <StatusPill label={isAuthenticated ? 'Angemeldet' : 'Gastmodus'} tone={isAuthenticated ? 'success' : 'default'} style={styles.statusPill} />
          </View>
          <Text style={styles.membershipStatus}>{membershipStatusLabel}</Text>
        </View>

        <GlassCard strong style={styles.previewCard}>
          <Text style={styles.previewEyebrow}>Live-Vorschau</Text>
          <Text style={styles.previewTitle}>Direkt verbunden mit der Webapp</Text>
          <BulletRow icon="shield-checkmark-outline" label="18+ und Bildprüfung" detail="Profilfoto-Upload mit KI-Selfie-Check als verifizierter Flow modelliert." />
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
            {plan.promoLabel ? <Text style={styles.planPromo}>{plan.promoLabel}</Text> : null}
            {plan.detailPrice ? <Text style={styles.planDetail}>{plan.detailPrice}</Text> : null}
            {plan.features.map((feature) => (
              <Text key={feature} style={styles.planFeature}>• {feature}</Text>
            ))}
            <AccentButton
              label={plan.buttonLabel || `Demo auf ${plan.title}`}
              variant={plan.key === 'basic' ? 'secondary' : 'primary'}
              onPress={() => openPurchaseModal(plan)}
              style={styles.planButton}
            />
          </GlassCard>
        ))}
      </View>

      <Modal transparent visible={purchaseModalOpen} animationType="fade" onRequestClose={() => setPurchaseModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <GlassCard strong style={styles.modalCard}>
            <Text style={styles.cardTitle}>AffairGo Checkout</Text>
            <Text style={styles.modalText}>
              {paymentBackendConfigured
                ? `${selectedPlan?.title} wird über ${paymentProviderLabel} gestartet. Wähle jetzt deinen Zahlungsweg.`
                : `${selectedPlan?.title} nutzt aktuell den Demo-Fallback. Hinterlege für produktive Käufe dein Billing-Backend oder Hosted-Checkout-Links.`}
            </Text>
            {!paymentBackendConfigured ? <Text style={styles.setupHint}>{paymentSetupInstructions}</Text> : null}
            <AccentButton label={isPurchasing ? 'Apple wird vorbereitet...' : 'Mit Apple kaufen'} onPress={() => handlePurchase('Apple In-App Purchase')} style={styles.planButton} disabled={isPurchasing} />
            <AccentButton label={isPurchasing ? 'Google wird vorbereitet...' : 'Mit Google kaufen'} onPress={() => handlePurchase('Google Play Billing')} variant="secondary" style={styles.planButton} disabled={isPurchasing} />
            <AccentButton label={isPurchasing ? 'Stripe wird vorbereitet...' : 'Mit Stripe kaufen'} onPress={() => handlePurchase('Stripe Checkout')} variant="secondary" style={styles.planButton} disabled={isPurchasing} />
            <AccentButton label="Abbrechen" variant="ghost" onPress={() => { setPurchaseModalOpen(false); setSelectedPlan(null); }} disabled={isPurchasing} />
          </GlassCard>
        </View>
      </Modal>

      <SectionTitle title="Sicherheit und Community" aside="direkt verknüpft" />
      <View style={[styles.communityRow, Platform.OS === 'web' && styles.communityRowWeb]}>
        <GlassCard style={styles.communityCard}>
          <Text style={styles.cardTitle}>Sicherheitslogik</Text>
          <BulletRow icon="warning-outline" label="Alte Fotos markieren" detail="6 Monate = Hinweis, 12 Monate = rote Warnung im Profil und auf Karten." />
          <BulletRow icon="sparkles-outline" label="Gold priorisiert Treffer" detail="Gold schaltet Vorab-Chats, Explore und priorisierte Trefferflächen frei, ohne versteckte Suchmodi." />
          <BulletRow icon="camera-outline" label="Screenshot-Schutz" detail="Im Web werden Druck, Copy/Cut, Kontextmenü und Sichtwechsel zusätzlich gehärtet; nativ bleibt der Plattformschutz vorbereitet." />
        </GlassCard>
        <GlassCard style={styles.communityCard}>
          <Text style={styles.cardTitle}>Community-Ideenbox</Text>
          <Text style={styles.ideaLead}>Bisher eingereichte Ideen: {featureIdeas.length}</Text>
          <Text style={styles.ideaText}>Nutzer können Features und Spiele vorschlagen. Bei Annahme sind Boosts, Premium-Tage oder Punkte möglich.</Text>
          <AccentButton label="Jetzt einloggen" onPress={() => navigation.navigate('Login')} />
        </GlassCard>
      </View>

      <InfoBanner
        title="Demo-Hinweis"
        detail="Website, Webapp und App-Flows greifen bewusst auf gemeinsame Mockdaten und denselben Produktzustand zu. So lassen sich Features konsistent testen, bevor Backend-Details vollständig produktiv angebunden werden."
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