import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const callDateFunction = async (name, payload) => {
  const callable = httpsCallable(functions, name);
  const result = await callable(payload);
  return result.data;
};

export const createDate = async (payload) => callDateFunction('createDate', payload);
export const listDates = async (payload = {}) => callDateFunction('listDates', payload);
export const updateDate = async (payload) => callDateFunction('updateDate', payload);
export const cancelDate = async (payload) => callDateFunction('cancelDate', payload);
export const toggleDateInterest = async (payload) => callDateFunction('toggleDateInterest', payload);
export const moderateDate = async (payload) => callDateFunction('moderateDate', payload);