import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

const callFunction = async (name, payload) => {
  const callable = httpsCallable(functions, name);
  const result = await callable(payload);
  return result.data;
};

export const checkNicknameAvailability = async ({ nickname }) => callFunction('checkNicknameAvailability', {
  nickname,
});