import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

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

  // Connect to local emulators in development
  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR) {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFirestoreEmulator(firestore, 'localhost', 8080);
    console.log('[firebase] Connected to local emulators');
  }
}

export { app, auth, firestore };

/** True when the app is running inside Electron */
export const isElectron = Boolean(window.electronAPI);

/** True when Firebase is configured (web deployment) */
export const isFirebaseEnabled = Boolean(firebaseConfig.apiKey);

/** Hardcoded admin emails */
export const ADMIN_EMAILS = ['adriandocampo@gmail.com'];

/** Check if a Firebase user has admin privileges */
export function isAdmin(user) {
  return Boolean(user?.email && ADMIN_EMAILS.includes(user.email));
}
