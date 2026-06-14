// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBFCNOlDnmAG5KOZkq8yPypFRj9qlIa3SQ",
  authDomain: "cipher-socket-io.firebaseapp.com",
  projectId: "cipher-socket-io",
  storageBucket: "cipher-socket-io.firebasestorage.app",
  messagingSenderId: "896863925492",
  appId: "1:896863925492:web:ff8ba06e5668674685daa1",
  measurementId: "G-2KK9JWY6L4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const analytics = getAnalytics(app);

export const auth = getAuth(app);

export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signInWithRedirect, getRedirectResult };
