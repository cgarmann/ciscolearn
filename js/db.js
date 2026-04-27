import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const DEFAULT_DATA = {
  settings: { theme: 'dark', lang: 'no' },
  progress: {
    quizScores: [], guidesRead: [], troubleshootingRead: [],
    subnetStreak: 0, subnetBest: 0, subnetTotal: 0,
    ipv6Streak: 0, ipv6Total: 0, lastActive: null
  },
  streak: { current: 0, best: 0, lastDate: null }
};

export async function loadUserData(uid) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return { data: snap.data(), error: null };
    } else {
      await setDoc(ref, { ...DEFAULT_DATA, createdAt: serverTimestamp() });
      return { data: { ...DEFAULT_DATA }, error: null };
    }
  } catch (e) {
    return { data: { ...DEFAULT_DATA }, error: e.message };
  }
}

export async function saveSettings(uid, settings) {
  try {
    await updateDoc(doc(db, 'users', uid), { settings, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

export async function saveProgress(uid, progress) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      progress: { ...progress, lastActive: serverTimestamp() },
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

export async function saveStreak(uid, streak) {
  try {
    await updateDoc(doc(db, 'users', uid), { streak, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

export async function saveTerminal(uid, terminal) {
  try {
    await updateDoc(doc(db, 'users', uid), { terminal, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

export async function loadTerminal(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return { data: snap.data().terminal || null, error: null };
    }
    return { data: null, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

export async function appendQuizScore(uid, entry) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const data = snap.data();
    const scores = data.progress?.quizScores || [];
    scores.unshift(entry);
    const trimmed = scores.slice(0, 50);
    await updateDoc(ref, {
      'progress.quizScores': trimmed,
      'progress.lastActive': serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}
