import { Linking, Platform } from 'react-native';

const PAYMENT_PROVIDER = (process.env.EXPO_PUBLIC_PAYMENT_PROVIDER || 'demo').trim();
const PAYMENT_BASE_URL = (process.env.EXPO_PUBLIC_PAYMENT_BASE_URL || '/api/billing').trim().replace(/\/$/, '');
const PAYMENT_PUBLIC_TOKEN = (process.env.EXPO_PUBLIC_PAYMENT_PUBLIC_TOKEN || '').trim();
const STRIPE_CHECKOUT_URL = (process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL || '').trim();
const APPLE_STORE_URL = (process.env.EXPO_PUBLIC_APPLE_STORE_URL || '').trim();
const GOOGLE_PLAY_URL = (process.env.EXPO_PUBLIC_GOOGLE_PLAY_URL || '').trim();

const looksLikePlaceholder = (value) => !value || /your_|paste_|placeholder/i.test(value);

const openExternalUrl = async (url) => {
  if (!url) {
    throw new Error('Für diesen Zahlungsweg ist noch keine Ziel-URL konfiguriert.');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    throw new Error('Die Zahlungsseite konnte auf diesem Gerät nicht geöffnet werden.');
  }

  await Linking.openURL(url);
  return true;
};

export const hasConfiguredPaymentBackend = () => !looksLikePlaceholder(PAYMENT_BASE_URL);

export const getPaymentProviderLabel = () => {
  if (PAYMENT_PROVIDER === 'custom') {
    return 'Custom Billing Backend';
  }

  return PAYMENT_PROVIDER || 'demo';
};

export const getPaymentSetupInstructions = () => {
  return 'Setze EXPO_PUBLIC_PAYMENT_BASE_URL für deinen Billing-Backend-Endpunkt oder hinterlege Stripe-/Store-URLs für den Hosted-Checkout.';
};

export const startPurchaseFlow = async ({ plan, paymentMethod, customer }) => {
  const normalizedMethod = String(paymentMethod || '').trim();

  if (!normalizedMethod) {
    throw new Error('Bitte wähle einen Zahlungsweg.');
  }

  if (hasConfiguredPaymentBackend()) {
    const response = await fetch(`${PAYMENT_BASE_URL}/purchase-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PAYMENT_PUBLIC_TOKEN ? { 'x-public-token': PAYMENT_PUBLIC_TOKEN } : {}),
      },
      body: JSON.stringify({
        plan,
        paymentMethod: normalizedMethod,
        customer,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message || 'Der Checkout konnte nicht gestartet werden.');
    }

    if (payload.checkoutUrl) {
      await openExternalUrl(payload.checkoutUrl);
    }

    return {
      status: payload.status || 'pending',
      checkoutUrl: payload.checkoutUrl || '',
      purchaseId: payload.purchaseId || payload.sessionId || '',
      provider: payload.provider || getPaymentProviderLabel(),
      mode: payload.checkoutUrl ? 'hosted-checkout' : 'backend',
    };
  }

  if (/stripe/i.test(normalizedMethod) && !looksLikePlaceholder(STRIPE_CHECKOUT_URL)) {
    await openExternalUrl(STRIPE_CHECKOUT_URL);
    return {
      status: 'pending',
      checkoutUrl: STRIPE_CHECKOUT_URL,
      purchaseId: '',
      provider: 'stripe-hosted-link',
      mode: 'hosted-checkout',
    };
  }

  if (/apple/i.test(normalizedMethod) && !looksLikePlaceholder(APPLE_STORE_URL)) {
    await openExternalUrl(APPLE_STORE_URL);
    return {
      status: 'pending',
      checkoutUrl: APPLE_STORE_URL,
      purchaseId: '',
      provider: 'apple-store-link',
      mode: 'store-link',
    };
  }

  if (/google/i.test(normalizedMethod) && !looksLikePlaceholder(GOOGLE_PLAY_URL)) {
    await openExternalUrl(GOOGLE_PLAY_URL);
    return {
      status: 'pending',
      checkoutUrl: GOOGLE_PLAY_URL,
      purchaseId: '',
      provider: 'google-play-link',
      mode: 'store-link',
    };
  }

  return {
    status: 'demo_activated',
    checkoutUrl: '',
    purchaseId: '',
    provider: 'demo-fallback',
    mode: 'demo',
  };
};