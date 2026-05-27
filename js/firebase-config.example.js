// Template — copy to firebase-config.js and fill in project values.
// The web API key is public by design (identifies the Firebase project)
// but MUST be restricted in Google Cloud Console:
//   - Android app restriction: package name + SHA-1 of signing cert
//   - HTTP referrer restriction: your production domain + localhost
// Firestore security (see firestore.rules) is what prevents abuse.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxx",
  measurementId: "G-XXXXXXXXXX"
};
