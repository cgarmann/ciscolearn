import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
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
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const AUTH_TIMEOUT_MS = 15000;

const isNative = () => !!(window.Capacitor?.isNativePlatform?.());

export function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

export async function signInGoogle() {
  if (isNative()) {
    try {
      const googleAuth = window.Capacitor?.Plugins?.GoogleAuth;
      if (!googleAuth?.signIn) {
        return { user: null, error: 'Google sign-in is not available in this build.' };
      }
      const googleUser = await googleAuth.signIn();
      const authentication = googleUser.authentication || {};
      const idToken = authentication.idToken || googleUser.idToken || null;
      const accessToken = authentication.accessToken || googleUser.accessToken || null;
      if (!idToken && !accessToken) {
        return { user: null, error: 'Google sign-in did not return an identity token.' };
      }
      const credential = GoogleAuthProvider.credential(idToken, accessToken);
      const result = await withTimeout(signInWithCredential(auth, credential));
      return { user: result.user, error: null };
    } catch (e) {
      const msg = e.message || '';
      const code = e.code || e.errorCode || '';
      if (code === '12501' || msg.toLowerCase().includes('cancel')) {
        return { user: null, error: null };
      }
      return { user: null, error: friendlyError(code) || msg || 'Google sign-in failed.' };
    }
  }

  try {
    const result = await withTimeout(signInWithPopup(auth, googleProvider));
    return { user: result.user, error: null };
  } catch (e) {
    if (
      e.code === 'auth/popup-closed-by-user' ||
      e.code === 'auth/cancelled-popup-request' ||
      e.code === 'auth/popup-blocked'
    ) {
      return { user: null, error: null };
    }
    return { user: null, error: friendlyError(e.code) || e.message };
  }
}

export async function signInEmail(email, password) {
  try {
    const result = await withTimeout(signInWithEmailAndPassword(auth, email, password));
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) || e.message };
  }
}

export async function registerEmail(email, password, displayName) {
  try {
    const result = await withTimeout(createUserWithEmailAndPassword(auth, email, password));
    if (displayName) {
      await withTimeout(updateProfile(result.user, { displayName }));
    }
    return { user: result.user, error: null };
  } catch (e) {
    return { user: null, error: friendlyError(e.code) || e.message };
  }
}

export async function resetPassword(email) {
  try {
    await withTimeout(sendPasswordResetEmail(auth, email));
    return { error: null };
  } catch (e) {
    return { error: friendlyError(e.code) || e.message };
  }
}

export async function logout() {
  await signOut(auth);
}

function withTimeout(promise, message = 'Login timed out. Check your connection and try again.') {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(message);
      err.code = 'auth/network-request-failed';
      reject(err);
    }, AUTH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
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
    'auth/popup-already-open': 'A sign-in window is already open.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
