import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import rawConfig from '../../firebase-applet-config.json';

export type User = FirebaseUser | {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
};

export const OAUTH_CLIENT_ID =
  rawConfig.oAuthClientId ||
  '180459556553-bukbnnghoblqvq577ku007b5los0el4s.apps.googleusercontent.com';

export const getActiveOAuthClientId = (): string => {
  try {
    const custom = localStorage.getItem('ubyport_custom_oauth_client_id');
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return OAUTH_CLIENT_ID;
};

export const setCustomOAuthClientId = (clientId: string): void => {
  try {
    if (!clientId || !clientId.trim()) {
      localStorage.removeItem('ubyport_custom_oauth_client_id');
    } else {
      localStorage.setItem('ubyport_custom_oauth_client_id', clientId.trim());
    }
  } catch {}
};

export const getFirebaseApiKey = (): string => {
  try {
    const custom = localStorage.getItem('ubyport_firebase_api_key');
    if (custom && custom.trim()) return custom.trim();
    const userGemini = localStorage.getItem('ubyport_user_api_key');
    if (userGemini && userGemini.trim()) return userGemini.trim();
  } catch {}
  return rawConfig.apiKey || '';
};

export const setFirebaseApiKey = (key: string): void => {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem('ubyport_firebase_api_key');
    } else {
      localStorage.setItem('ubyport_firebase_api_key', key.trim());
    }
  } catch {}
};

/**
 * Scopes pro Google Docs, Google Drive, Google Sheets a profil uživatele
 */
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
];

export const OAUTH_SCOPES = WORKSPACE_SCOPES.join(' ');

let cachedAccessToken: string | null = null;
let currentUserInstance: User | null = null;
let authStateListeners: ((user: User | null) => void)[] = [];

// Obnovení uložené relace ze sessionStorage a localStorage
try {
  const savedUser = localStorage.getItem('ubyport_google_user');
  if (savedUser) {
    currentUserInstance = JSON.parse(savedUser);
  }
  const savedToken = sessionStorage.getItem('ubyport_google_token');
  if (savedToken) {
    cachedAccessToken = savedToken;
  }
} catch {
  // safe fallback
}

/**
 * Inicializace Firebase App
 */
export const getFirebaseApp = () => {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }
  const apiKey = getFirebaseApiKey();
  const config = {
    ...rawConfig,
    apiKey: apiKey || rawConfig.apiKey || 'AIzaSyPlaceholderForAuthInit'
  };
  return initializeApp(config);
};

export const getFirebaseAuth = () => {
  const app = getFirebaseApp();
  return getAuth(app);
};

export const getGoogleAuthProvider = () => {
  const provider = new GoogleAuthProvider();
  WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

/**
 * Dynamicky zajistí načtení Google Identity Services (GSI) knihovny jako spolehlivé zálohy
 */
export const ensureGsiClient = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve((window as any).google.accounts.oauth2);
      return;
    }
    if (typeof document === 'undefined') {
      reject(new Error('Dokument není dostupný'));
      return;
    }

    const existingScript = document.getElementById('gsi-client-script') as HTMLScriptElement;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).google?.accounts?.oauth2));
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve((window as any).google?.accounts?.oauth2);
    script.onerror = () => reject(new Error('Nepodařilo se načíst knihovnu Google Identity Services.'));
    document.head.appendChild(script);
  });
};

/**
 * Záložní přímé Google OAuth2 přihlášení (GIS) pro Google Docs / Drive
 */
const signInWithGsi = async (): Promise<{ user: User; accessToken: string }> => {
  const oauth2 = await ensureGsiClient();
  if (!oauth2) {
    throw new Error('Knihovna Google OAuth2 není v prohlížeči dostupná.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = oauth2.initTokenClient({
        client_id: getActiveOAuthClientId(),
        scope: OAUTH_SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('GIS Error callback:', tokenResponse);
            const errCode = tokenResponse.error;
            let msg = tokenResponse.error_description || tokenResponse.error || 'Přihlášení ke Google účtu bylo zrušeno nebo selhalo.';
            if (errCode === 'popup_closed_by_user') {
              msg = 'Okno pro přihlášení k účtu Google bylo zavřeno.';
            } else if (errCode === 'access_denied') {
              msg = 'Přístup k účtu Google a Google Docs byl zamítnut.';
            }
            reject(new Error(msg));
            return;
          }

          if (!tokenResponse.access_token) {
            reject(new Error('Google nevrátil přístupový token. Zkuste to prosím znovu.'));
            return;
          }

          cachedAccessToken = tokenResponse.access_token;
          try {
            sessionStorage.setItem('ubyport_google_token', cachedAccessToken!);
          } catch {}

          let user: User = {
            uid: `user_${Date.now()}`,
            displayName: 'Google Uživatel'
          };

          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${cachedAccessToken}` }
            });
            if (userRes.ok) {
              const uData = await userRes.json();
              user = {
                uid: uData.sub || `user_${Date.now()}`,
                displayName: uData.name || uData.email || 'Google Uživatel',
                email: uData.email,
                photoURL: uData.picture
              };
            }
          } catch (e) {
            console.warn('Nepodařilo se stáhnout profilová data uživatele:', e);
          }

          currentUserInstance = user;
          try {
            localStorage.setItem('ubyport_google_user', JSON.stringify(user));
          } catch {}

          authStateListeners.forEach(listener => listener(user));
          resolve({ user, accessToken: cachedAccessToken! });
        },
        error_callback: (err: any) => {
          console.error('GIS token client error:', err);
          reject(new Error(err?.message || 'Chyba při komunikaci s Google Identity Services.'));
        }
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error('Chyba při spuštění Google přihlášení:', err);
      reject(err);
    }
  });
};

/**
 * Inicializace sledování stavu Google přihlášení (přes Firebase Auth a relaci)
 */
export const initAuth = (
  onAuthChange: (user: User | null) => void
): (() => void) => {
  authStateListeners.push(onAuthChange);

  let unsubscribeFirebase: (() => void) | null = null;
  try {
    const auth = getFirebaseAuth();
    unsubscribeFirebase = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        currentUserInstance = fbUser;
        onAuthChange(fbUser);
      } else if (!cachedAccessToken) {
        currentUserInstance = null;
        onAuthChange(null);
      }
    });
  } catch {
    if (currentUserInstance) {
      onAuthChange(currentUserInstance);
    } else {
      onAuthChange(null);
    }
  }

  return () => {
    authStateListeners = authStateListeners.filter(l => l !== onAuthChange);
    if (unsubscribeFirebase) unsubscribeFirebase();
  };
};

/**
 * Spustí autorizaci a přihlášení ke Google Docs a Workspace primárně přes Firebase Auth
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    const auth = getFirebaseAuth();
    const provider = getGoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Firebase Auth nevrátil přístupový OAuth token pro Google Docs.');
    }

    const user: User = {
      uid: result.user.uid,
      displayName: result.user.displayName || result.user.email || 'Google Uživatel',
      email: result.user.email,
      photoURL: result.user.photoURL
    };

    cachedAccessToken = accessToken;
    currentUserInstance = user;

    try {
      sessionStorage.setItem('ubyport_google_token', accessToken);
      localStorage.setItem('ubyport_google_user', JSON.stringify(user));
    } catch {}

    authStateListeners.forEach(listener => listener(user));
    return { user, accessToken };
  } catch (firebaseErr: any) {
    console.warn('Firebase Auth sign-in failed, analyzing error:', firebaseErr);
    const errCode = firebaseErr.code || '';
    const errMsg = firebaseErr.message || '';

    // Doménový nesoulad ve Firebase
    if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain')) {
      throw firebaseErr;
    }

    // Pokud uživatel zavřel popup
    if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed-by-user')) {
      throw new Error('Přihlašovací okno bylo zavřeno.');
    }

    // Pokud chybí API klíč Firebase nebo selže s invalid-api-key, zkusíme záložní přímý GIS token klient pro Google Docs
    try {
      console.log('Zkouším autorizaci Google Docs přes Google Identity Services fallback...');
      return await signInWithGsi();
    } catch (gsiErr: any) {
      throw new Error(firebaseErr.message || gsiErr.message);
    }
  }
};

/**
 * Vrátí aktuální přístupový token Google (pro Docs / Sheets / Drive API)
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Odhlášení uživatele a zrušení tokenu přes Firebase Auth
 */
export const googleLogout = async (): Promise<void> => {
  try {
    const auth = getFirebaseAuth();
    await signOut(auth);
  } catch {}

  if (cachedAccessToken && typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2?.revoke) {
    try {
      (window as any).google.accounts.oauth2.revoke(cachedAccessToken, () => {});
    } catch {}
  }

  cachedAccessToken = null;
  currentUserInstance = null;

  try {
    sessionStorage.removeItem('ubyport_google_token');
    localStorage.removeItem('ubyport_google_user');
  } catch {}

  authStateListeners.forEach(listener => listener(null));
};

export const firebaseProjectId = rawConfig.projectId || 'gen-lang-client-0432990418';
export const firebaseConsoleAuthorizedDomainsUrl = `https://console.cloud.google.com/apis/credentials?project=${firebaseProjectId}`;
