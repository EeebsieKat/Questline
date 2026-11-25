// ─────────────────────────────────────────────────────────────
// Baked-in Firebase configuration (set once for your deployment).
//
// Paste the `firebaseConfig` object from Firebase console →
// Project settings → Your apps → Web app → SDK setup and
// configuration, commit, and push. Every visitor then gets cloud
// sync + Google sign-in automatically — nobody pastes anything.
// They click "Sign in with Google" in the top bar, and the owner
// invites their email from the Share dialog.
//
// Firebase web configs are public identifiers by design (every
// Firebase-powered site ships them in its JS bundle). Access
// control lives in the Firestore rules + the invite list, not in
// these values.
//
// Leave as `null` to keep the paste-the-config-in-Settings flow.
// A config pasted in Settings always overrides this file.
// ─────────────────────────────────────────────────────────────
export const FIREBASE_CONFIG: Record<string, string> | null = null;

// Example — replace with your real values and delete the `null`
// export above:
//
// export const FIREBASE_CONFIG = {
//   apiKey: "AIza…",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   storageBucket: "your-project.firebasestorage.app",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef",
// };
