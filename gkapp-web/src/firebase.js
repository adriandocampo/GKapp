import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only initialize when credentials are present (web mode)
let app = null;
let auth = null;
let firestore = null;

if (firebaseConfig.apiKey) {
  app       = initializeApp(firebaseConfig);
  auth      = getAuth(app);
  firestore = getFirestore(app);
}

export { app, auth, firestore };

/** True when the app is running inside Electron */
export const isElectron = Boolean(window.electronAPI);

/** True when Firebase is configured (web deployment) */
export const isFirebaseEnabled = Boolean(firebaseConfig.apiKey);
