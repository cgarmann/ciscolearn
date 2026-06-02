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
  OAuthProvider,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const AUTH_TIMEOUT_MS = 15000;

// True when running inside a native Capacitor app (Android/iOS)
const isNative = () => !!(window.Capacitor?.isNativePlatform?.());

export function onAuth(callback) {
  onAuthStateChanged(auth, callback);
}

export async function signInGoogle() {
  if (isNative()) {
    // Native Android/iOS: use Capacitor Google Auth plugin (no browser popup)
    try {
      const googleAuth = window.Capacitor?.Plugins?.GoogleAuth;
      if (!googleAuth?.signIn) {
        return { user: null, error: 'Google sign-in is not available in this build.' };
      }
      const googleUser = await googleAuth.signIn();
      const idToken = googleUser.authentication.idToken;
      const credential = GoogleAuthProvider.credential(idToken);
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
  } else {
    // Web: standard Firebase popup flow
    try {
      const result = await withTimeout(signInWithPopup(auth, googleProvider));
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
    return { error: friendlyError(e.code) };
  }
}

export async function signInApple() {
  try {
    const { raw, hashed } = await generateNonce();
    const appleProvider = getSignInWithApplePlugin();
    if (!appleProvider?.authorize) {
      return { user: null, error: 'Sign in with Apple is not available in this build.' };
    }
    const result = await withTimeout(appleProvider.authorize({
      scopes: 'email name',
      nonce: hashed,
    }), 'Sign in with Apple timed out. Please try again.');
    const response = result?.response || {};
    if (!response.identityToken) {
      return { user: null, error: 'Sign in with Apple did not return an identity token.' };
    }
    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: response.identityToken,
      rawNonce: raw,
    });
    const fbResult = await withTimeout(signInWithCredential(auth, credential));
    const fullName = response.givenName || response.familyName
      ? [response.givenName, response.familyName].filter(Boolean).join(' ')
      : null;
    if (fullName && !fbResult.user.displayName) {
      await withTimeout(updateProfile(fbResult.user, { displayName: fullName }));
    }
    return { user: fbResult.user, error: null };
  } catch (e) {
    const msg = e.message || '';
    if (e.code === '1001' || msg.includes('1001') || msg.toLowerCase().includes('cancel')) {
      return { user: null, error: null };
    }
    return { user: null, error: msg || 'Sign in with Apple failed.' };
  }
}

function getSignInWithApplePlugin() {
  const cap = window.Capacitor;
  if (!cap) return null;
  if (cap.Plugins?.SignInWithApple) return cap.Plugins.SignInWithApple;
  if (typeof cap.registerPlugin === 'function') {
    return cap.registerPlugin('SignInWithApple');
  }
  if (typeof cap.nativePromise === 'function') {
    return {
      authorize: options => cap.nativePromise('SignInWithApple', 'authorize', options)
    };
  }
  return null;
}

async function generateNonce() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, b => chars[b % chars.length]).join('');
  const data = new TextEncoder().encode(raw);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  const hashed = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
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
