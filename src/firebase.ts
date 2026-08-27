import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAC8GGpbgJVTNjHp_c11q8_2XJ7nIwRqQk",
  authDomain: "posting-art.firebaseapp.com",
  projectId: "posting-art",
  storageBucket: "posting-art.firebasestorage.app",
  messagingSenderId: "957232414429",
  appId: "1:957232414429:web:024a7786cae4348643e534",
};

export const firebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && !value.startsWith("REPLACE_WITH_"),
);

const app = firebaseConfigured
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
