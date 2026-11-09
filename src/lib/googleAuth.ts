import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut, Auth } from 'firebase/auth';
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

let appInstance: any = null;
let authInstance: Auth | null = null;

export const getSafeApp = (keyOverride?: string) => {
  const key = resolveFirebaseApiKey(keyOverride);
  // Bez zadaného klíče neprovádíme inicializaci s prázdným řetězcem (ta by způsobila pád)
  if (!key) return null;

  try {
    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp({ ...rawConfig, apiKey: key });
    } else if (appInstance.options?.apiKey !== key) {
      appInstance = initializeApp({ ...rawConfig, apiKey: key }, 'authApp_' + Date.now());
      authInstance = null;
    }
    return appInstance;
  } catch (err) {
    console.warn('Firebase initializeApp warning:', err);
    return null;
  }
};

export const getSafeAuth = (keyOverride?: string): Auth | null => {
  if (authInstance && (!keyOverride || appInstance?.options?.apiKey === keyOverride)) {
    return authInstance;
  }
  const app = getSafeApp(keyOverride);
  if (!app) return null;
  try {
    authInstance = getAuth(app);
    return authInstance;
  } catch (err) {
    console.warn('Firebase getAuth warning:', err);
    return null;
  }
};

const provider = new GoogleAuthProvider();
// Required Google Workspace Scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
): (() => void) => {
  const currentAuth = getSafeAuth();
  if (!currentAuth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  try {
    return onAuthStateChanged(currentAuth, async (user: User | null) => {
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
  } catch (e) {
    console.warn('onAuthStateChanged error:', e);
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
};

export const googleSignIn = async (userKey?: string): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const effectiveKey = resolveFirebaseApiKey(userKey);
    if (!effectiveKey) {
      throw new Error('Pro přihlášení ke Google účtu zadejte svůj Google API klíč.');
    }
    const auth = getSafeAuth(effectiveKey);
    if (!auth) {
      throw new Error('Nepodařilo se inicializovat Google autentizaci. Zkontrolujte prosím svůj Google API klíč.');
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
  const auth = getSafeAuth();
  if (auth) {
    try {
      await signOut(auth);
    } catch {}
  }
  cachedAccessToken = null;
};

export const firebaseProjectId = rawConfig.projectId;
export const firebaseConsoleAuthorizedDomainsUrl = `https://console.firebase.google.com/project/${rawConfig.projectId}/authentication/settings`;

