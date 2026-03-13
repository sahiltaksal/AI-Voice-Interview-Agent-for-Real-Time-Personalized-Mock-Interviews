// Import the functions you need from the SDKs you need
import { getApp, getApps, initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD4bQ8Ai5-ReVz0G3oQp-iJ5b2Fvwr_Miw",
  authDomain: "ai-mock-860dc.firebaseapp.com",
  databaseURL: "https://ai-mock-860dc-default-rtdb.firebaseio.com/",
  projectId: "ai-mock-860dc",
  storageBucket: "ai-mock-860dc.firebasestorage.app",
  messagingSenderId: "13795224629",
  appId:"1:13795224629:web:a8217ceb6ebef6c447557c",
  measurementId:"G-4VWQT493WZ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);