import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDKECXgO6viL1Br9TJLjZicP-RdRNENczs",
  authDomain: "eventmint-560e0.firebaseapp.com",
  projectId: "eventmint-560e0",
  storageBucket: "eventmint-560e0.firebasestorage.app",
  messagingSenderId: "1004091237817",
  appId: "1:1004091237817:web:3db01a17c14509fc85c268",
  measurementId: "G-C9W312MWKJ",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
