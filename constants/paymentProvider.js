export const hasConfiguredPaymentBackend = () => false;

export const getPaymentProviderLabel = () => 'Kostenfrei freigeschaltet';

export const getPaymentSetupInstructions = () => {
  return 'Zahlungen sind derzeit deaktiviert. Night-Whisper bleibt bis Anfang 2027 kostenfrei nutzbar.';
};

export const startPurchaseFlow = async () => ({
  status: 'disabled',
  checkoutUrl: '',
  purchaseId: '',
  provider: 'payments-disabled',
  mode: 'disabled',
});