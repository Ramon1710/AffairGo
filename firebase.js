// firebase.js

// Firebase SDK für React Native / Expo
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Deine Firebase-Konfiguration
const firebaseConfig = {
  apiKey: "AIzaSyADdVt7T8OrJ3i3cYtazbbUaarBLcsq6xQ",
  authDomain: "affairgo-54ac0.firebaseapp.com",
  databaseURL: "https://affairgo-54ac0-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "affairgo-54ac0",
  storageBucket: "affairgo-54ac0.appspot.com",
  messagingSenderId: "75576714453",
  appId: "1:75576714453:web:56a0aae427fc301f3d2e5c",
  measurementId: "G-151QJPJZR9"
};

// Initialisieren
const app = initializeApp(firebaseConfig);

// Dienste exportieren
export const auth = getAuth(app);
export const db = getFirestore(app);
