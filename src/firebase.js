import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAd4d-uM7Hq7z4Ju3CdxGA2MzzssNGWJK0",
  authDomain: "sales-gorilla-dee38.firebaseapp.com",
  projectId: "sales-gorilla-dee38",
  storageBucket: "sales-gorilla-dee38.firebasestorage.app",
  messagingSenderId: "1010482457553",
  appId: "1:1010482457553:web:cbdb93ac62a16260eccef0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
