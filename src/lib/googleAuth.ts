import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import rawConfig from '../../firebase-applet-config.json';

// Dynamic API key resolution: reads from runtime env or local storage vault
export const resolveFirebaseApiKey = (customKey?: string): string => {
  if (customKey && customKey.trim().length > 0) {
    return customKey.trim();
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY) {
    return import.meta.env.VITE_FIREBASE_API_KEY;
  }
  try {
    const userKey = localStorage.getItem('ubyport_user_api_key') || localStorage.getItem('airtax_secure_key_blob');
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim();
    }
  } catch {
    // safe fallback
  }
  return rawConfig.apiKey || '';
};

const getEffectiveConfig = (keyOverride?: string) => ({
  ...rawConfig,
  apiKey: resolveFirebaseApiKey(keyOverride)
});

let app = getApps().length > 0 ? getApp() : initializeApp(getEffectiveConfig());
let auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Required Google Workspace Scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token must be in memory; if user is restored without token, prompt user interaction
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (userKey?: string): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const effectiveKey = resolveFirebaseApiKey(userKey);
    if (!effectiveKey) {
      throw new Error('Pro přihlášení ke Google účtu zadejte svůj Google API klíč.');
    }
    // Reconfigure app with effective API key if different
    if (app.options.apiKey !== effectiveKey) {
      try {
        app = initializeApp({ ...rawConfig, apiKey: effectiveKey }, 'authApp_' + Date.now());
        auth = getAuth(app);
      } catch {
        // fallback to default instance
      }
    }
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Nepodařilo se získat přístupový token Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Chyba při přihlašování přes Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const googleLogout = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const firebaseProjectId = rawConfig.projectId;
export const firebaseConsoleAuthorizedDomainsUrl = `https://console.firebase.google.com/project/${rawConfig.projectId}/authentication/settings`;

