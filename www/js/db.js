import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const DB_TIMEOUT_MS = 12000;

// ── Default user data structure ───────────────────────────────────────────────
const DEFAULT_DATA = {
  settings: {
    theme: 'light',
    lang: 'no'
  },
  progress: {
    quizScores: [],          // [{cat, score, pct, date}]
    guidesRead: [],          // [guideTitle]
    troubleshootingRead: [], // [scenarioTitle]
    subnetStreak: 0,
    subnetBest: 0,
    subnetTotal: 0,
    ipv6Streak: 0,
    ipv6Total: 0,
    lastActive: null
  },
  streak: {
    current: 0,
    best: 0,
    lastDate: null
  }
};

// ── Load user data from Firestore ─────────────────────────────────────────────
export async function loadUserData(uid) {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await withTimeout(getDoc(ref), 'Cloud profile timed out.');
    if (snap.exists()) {
      return { data: snap.data(), error: null };
    } else {
      // First login — create document with defaults
      await withTimeout(setDoc(ref, { ...DEFAULT_DATA, createdAt: serverTimestamp() }), 'Cloud profile setup timed out.');
      return { data: { ...DEFAULT_DATA }, error: null };
    }
  } catch (e) {
    // Don't log the full error (may contain auth tokens / UIDs in stack)
    console.error('loadUserData failed:', e.code || 'unknown');
    return { data: { ...DEFAULT_DATA }, error: e.message };
  }
}

// ── Save settings ─────────────────────────────────────────────────────────────
export async function saveSettings(uid, settings) {
  try {
    await updateDoc(doc(db, 'users', uid), { settings, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Save progress ─────────────────────────────────────────────────────────────
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

// ── Save streak ───────────────────────────────────────────────────────────────
export async function saveStreak(uid, streak) {
  try {
    await updateDoc(doc(db, 'users', uid), { streak, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Save terminal state (history + scenario) ─────────────────────────────────
export async function saveTerminal(uid, terminal) {
  // terminal: { history: string[], scenario: string }
  try {
    await updateDoc(doc(db, 'users', uid), {
      terminal,
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Load terminal state ───────────────────────────────────────────────────────
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

// ── Save quiz result ──────────────────────────────────────────────────────────
export async function appendQuizScore(uid, entry) {
  // entry: {cat, score, total, pct, date}
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    const data = snap.data();
    const scores = data.progress?.quizScores || [];
    scores.unshift(entry); // newest first
    const trimmed = scores.slice(0, 50); // keep last 50
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

// ── Custom Lab save slots (stored in users/{uid}.labs map) ───────────────────
export async function saveLabSlot(uid, slotId, data) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      [`labs.${slotId}`]: {
        name: data.name,
        devices: data.devices,
        links: data.links,
        deviceCount: data.devices.length,
        savedAt: serverTimestamp()
      },
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

export async function loadLabSlots(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return { slots: [], error: null };
    const labs = snap.data().labs || {};
    const slots = Object.entries(labs).map(([id, d]) => ({ id, ...d }));
    slots.sort((a, b) => (a.savedAt?.seconds || 0) - (b.savedAt?.seconds || 0));
    return { slots, error: null };
  } catch (e) {
    return { slots: [], error: e.message };
  }
}

export async function deleteLabSlot(uid, slotId) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      [`labs.${slotId}`]: deleteField(),
      updatedAt: serverTimestamp()
    });
    return { error: null };
  } catch (e) {
    return { error: e.message };
  }
}

function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), DB_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
