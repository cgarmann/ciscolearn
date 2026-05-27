import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// True when running inside a native Capacitor app (Android/iOS)
const isNative = () => !!(window.Capacitor?.isNativePlatform?.());

export function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

export async function signInGoogle() {
  if (isNative()) {
    // Native Android/iOS: use Capacitor Google Auth plugin (no browser popup)
    try {
      const googleUser = await window.Capacitor.Plugins.GoogleAuth.signIn();
      const idToken = googleUser.authentication.idToken;
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(auth, credential);
      return { user: result.user, error: null };
    } catch (e) {
      const msg = e.message || '';
      const code = e.code || e.errorCode || '';
      // DEBUG — fjernes etter testing
      return { user: null, error: `[DEBUG] code=${code} msg=${msg}` };
    }
  } else {
    // Web: standard Firebase popup flow
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return { user: result.user, error: null };
    } catch (e) {
      if (
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request'
      ) {
        return { user: null, error: null };
      }
      return { user: null, error: friendlyError(e.code) || e.message };
    }
  }
}

export async function signInEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) };
  }
}

export async function registerEmail(email, password, displayName) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) };
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (e) {
    return { error: friendlyError(e.code) };
  }
}

export async function logout() {
  await signOut(auth);
}

function friendlyError(code) {
  const map = {
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential': 'Incorrect email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
