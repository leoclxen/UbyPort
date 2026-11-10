import { initializeApp, getApps } from 'firebase/app';
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

export const firebaseProjectId = rawConfig.projectId || 'gen-lang-client-0432990418';
export const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;
export const firebaseGeneralSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/settings/general`;
export const googleCloudCredentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${firebaseProjectId}`;

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

/**
 * Získání Firebase Web API klíče.
 * DŮLEŽITÉ: Nikdy nepřebírat Gemini API klíč, protože ten je omezen pouze na Generative Language API
 * a Identity Toolkit jej odmítne s chybou auth/api-keys-are-not-supported-by-this-api!
 */
export const getFirebaseApiKey = (): string => {
  try {
    const custom = localStorage.getItem('ubyport_firebase_api_key');
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return rawConfig.apiKey || '';
};

export const hasFirebaseApiKey = (): boolean => {
  const k = getFirebaseApiKey();
  return !!(k && k.trim());
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
 * Inicializace Firebase App s ověřeným klíčem
 */
export const getFirebaseApp = () => {
  const existing = getApps();
  const apiKey = getFirebaseApiKey();
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const config = {
    ...rawConfig,
    apiKey: apiKey || rawConfig.apiKey || ''
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
 * Dynamicky zajistí načtení Google Identity Services (GSI) knihovny pro alternativní přímé OAuth
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
 * Přímé Google OAuth2 přihlášení (GIS) – pro případ, že uživatel preferuje přímé OAuth před Firebase
 */
export const signInWithGsi = async (): Promise<{ user: User; accessToken: string }> => {
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
              const err: any = new Error('Okno pro přihlášení k účtu Google bylo zavřeno.');
              err.code = 'auth/popup-closed-by-user';
              reject(err);
              return;
            } else if (errCode === 'access_denied') {
              msg = 'Přístup k účtu Google a Google Docs byl zamítnut.';
            }
            const err: any = new Error(msg);
            err.code = errCode;
            reject(err);
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
          const customErr: any = new Error(err?.message || 'Chyba při komunikaci s Google Identity Services.');
          customErr.code = 'origin_mismatch';
          reject(customErr);
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
 * Inicializace sledování stavu Google přihlášení (přes Firebase Auth a uloženou relaci)
 */
export const initAuth = (
  onAuthChange: (user: User | null) => void
): (() => void) => {
  authStateListeners.push(onAuthChange);

  let unsubscribeFirebase: (() => void) | null = null;
  if (hasFirebaseApiKey()) {
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
    } catch {}
  } else {
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
 * Spustí autorizaci a přihlášení ke Google Docs a Workspace primárně přes Firebase Authentication
 */
export const googleSignIn = async (method: 'firebase' | 'gis' = 'firebase'): Promise<{ user: User; accessToken: string }> => {
  if (method === 'gis') {
    return await signInWithGsi();
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    const err: any = new Error('Chybí Firebase Web API klíč. Zadejte prosím Webový klíč API z Firebase Console.');
    err.code = 'auth/missing-api-key';
    throw err;
  }

  try {
    const auth = getFirebaseAuth();
    const provider = getGoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Firebase Auth nevrátil přístupový OAuth token pro Google Docs a Google Disk.');
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
    console.error('Firebase Auth sign-in failed:', firebaseErr);
    const errCode = firebaseErr.code || '';
    const errMsg = firebaseErr.message || '';

    // Uživatel zavřel okno
    if (errCode === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed-by-user') || errMsg.includes('closed by user')) {
      const err: any = new Error('Přihlašovací okno bylo zavřeno.');
      err.code = 'auth/popup-closed-by-user';
      throw err;
    }

    // Doménový nesoulad ve Firebase Authentication
    if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain') || errMsg.includes('unauthorized domain')) {
      const err: any = new Error(`Doména "${typeof window !== 'undefined' ? window.location.hostname : ''}" není povolena ve Firebase Authentication.`);
      err.code = 'auth/unauthorized-domain';
      throw err;
    }

    // Neplatný klíč nebo klíč bez oprávnění pro Identity Toolkit
    if (
      errCode === 'auth/invalid-api-key' ||
      errMsg.includes('invalid-api-key') ||
      errMsg.includes('api-keys-are-not-supported-by-this-api')
    ) {
      const err: any = new Error('Zadaný API klíč není platný pro Firebase Authentication (Identity Toolkit). Ujistěte se, že používáte Webový klíč API z Firebase Console.');
      err.code = 'auth/invalid-api-key';
      throw err;
    }

    throw firebaseErr;
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
  if (hasFirebaseApiKey()) {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
    } catch {}
  }

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
