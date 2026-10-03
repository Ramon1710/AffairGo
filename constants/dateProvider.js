import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase.js';

const isDevEnvironment = typeof __DEV__ !== 'undefined' && __DEV__ === true;

export const mapDateErrorMessage = (error, action = 'Dates laden') => {
  const rawCode = typeof error?.code === 'string' ? error.code : '';
  const normalizedCode = rawCode.replace(/^functions\//, '');
  const rawMessage = typeof error?.message === 'string' ? error.message.trim() : '';

  if (normalizedCode === 'unauthenticated') {
    return 'Bitte melde dich erneut an, um Dates zu nutzen.';
  }

  if (normalizedCode === 'permission-denied' || normalizedCode === 'failed-precondition' || normalizedCode === 'invalid-argument') {
    return rawMessage || `${action} ist gerade nicht möglich.`;
  }

  if (normalizedCode === 'internal' || normalizedCode === 'not-found' || normalizedCode === 'unavailable') {
    return 'Das Dates-Backend ist derzeit nicht erreichbar. Bitte versuche es später erneut.';
  }

  return rawMessage || `${action} ist gerade nicht möglich.`;
};

const callDateFunction = async (name, payload) => {
  try {
    const callable = httpsCallable(functions, name);
    const result = await callable(payload);
    return result.data;
  } catch (error) {
    if (isDevEnvironment) {
      console.warn('[Dates]', {
        scope: name,
        errorCode: typeof error?.code === 'string' ? error.code : null,
        errorMessage: typeof error?.message === 'string' ? error.message : null,
        details: error?.details ?? null,
      });
    }

    const mappedError = new Error(mapDateErrorMessage(error, name));
    mappedError.code = error?.code || '';
    mappedError.details = error?.details;
    mappedError.originalMessage = error?.message || '';
    throw mappedError;
  }
};

export const createDate = async (payload) => callDateFunction('createDate', payload);
export const listDates = async (payload = {}) => callDateFunction('listDates', payload);
export const updateDate = async (payload) => callDateFunction('updateDate', payload);
export const cancelDate = async (payload) => callDateFunction('cancelDate', payload);
export const toggleDateInterest = async (payload) => callDateFunction('toggleDateInterest', payload);
export const moderateDate = async (payload) => callDateFunction('moderateDate', payload);