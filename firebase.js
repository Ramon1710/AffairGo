// firebase.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyADdVt7T8OrJ3i3cYtazbbUaarBLcsq6xQ',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'affairgo-54ac0.firebaseapp.com',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://affairgo-54ac0-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'affairgo-54ac0',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'affairgo-54ac0.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '75576714453',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:75576714453:web:56a0aae427fc301f3d2e5c',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-151QJPJZR9',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
