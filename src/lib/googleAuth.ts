import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
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

export const firebaseProjectId = rawConfig.projectId || '';
export const firebaseAuthSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;
export const firebaseGeneralSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/settings/general`;
export const googleCloudCredentialsUrl = `https://console.cloud.google.com/apis/credentials?project=${firebaseProjectId}`;

export const OAUTH_CLIENT_ID = rawConfig.oAuthClientId || '';

const CUSTOM_OAUTH_CLIENT_KEY = 'ubyport_custom_oauth_client_id';
const OAUTH_CLIENT_ID_REGEX = /^[0-9]+-[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/;

export const sanitizeOAuthClientId = (raw: string): string => {
  return (raw || '')
    .replace(/[\s"'`<>]/g, '')
    .trim();
};

export const isValidOAuthClientId = (clientId: string): boolean => {
  const cleaned = sanitizeOAuthClientId(clientId);
  return OAUTH_CLIENT_ID_REGEX.test(cleaned);
};

export const isUsingCustomOAuthClientId = (): boolean => {
  try {
    const custom = localStorage.getItem(CUSTOM_OAUTH_CLIENT_KEY);
    return !!(custom && isValidOAuthClientId(custom));
  } catch {
    return false;
  }
};

export const getActiveOAuthClientId = (): string => {
  try {
    const rawCustom = localStorage.getItem(CUSTOM_OAUTH_CLIENT_KEY);
    if (rawCustom && rawCustom.trim()) {
      const cleaned = sanitizeOAuthClientId(rawCustom);
      if (isValidOAuthClientId(cleaned)) {
        return cleaned;
      }
      // Odstranit poškozené / neplatné klientské ID, aby nezpůsobovalo chybu 400 invalid_request
      localStorage.removeItem(CUSTOM_OAUTH_CLIENT_KEY);
    }
  } catch {}
  return sanitizeOAuthClientId(OAUTH_CLIENT_ID);
};

export const setCustomOAuthClientId = (clientId: string): void => {
  const cleaned = sanitizeOAuthClientId(clientId);
  if (!cleaned) {
    try {
      localStorage.removeItem(CUSTOM_OAUTH_CLIENT_KEY);
    } catch {}
    return;
  }

  if (!isValidOAuthClientId(cleaned)) {
    throw new Error(
      'Neplatný formát OAuth Client ID. Musí mít tvar např. 123456789-xxxx.apps.googleusercontent.com.'
    );
  }

  try {
    localStorage.setItem(CUSTOM_OAUTH_CLIENT_KEY, cleaned);
  } catch {}
};

/**
 * Získání Firebase Web API klíče.
 * DŮLEŽITÉ: Nikdy nepřebírat Gemini API klíč, protože ten je omezen pouze na Generative Language API
 * a Identity Toolkit jej odmítne s chybou auth/api-keys-are-not-supported-by-this-api!
 */
export const getFirebaseApiKey = (): string => {
  if (rawConfig.apiKey && rawConfig.apiKey.trim()) {
    return rawConfig.apiKey.trim();
  }
  try {
    const custom = localStorage.getItem('ubyport_firebase_api_key');
    if (custom && custom.trim()) return custom.trim();
  } catch {}
  return '';
};

export const hasFirebaseApiKey = (): boolean => {
  const k = getFirebaseApiKey();
  return !!(k && k.trim());
};

let initializedFirebaseApiKey: string | null = null;

export const resetFirebaseApps = async (): Promise<void> => {
  const existing = getApps();
  if (existing.length > 0) {
    await Promise.all(
      existing.map(app =>
        deleteApp(app).catch(() => {
          // ignore cleanup failure
        })
      )
    );
  }
  initializedFirebaseApiKey = null;
};

export const setFirebaseApiKey = (key: string): void => {
  const trimmed = (key || '').trim();
  try {
    if (!trimmed) {
      localStorage.removeItem('ubyport_firebase_api_key');
    } else {
      localStorage.setItem('ubyport_firebase_api_key', trimmed);
    }
  } catch {}

  if (initializedFirebaseApiKey !== trimmed) {
    void resetFirebaseApps();
  }
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
let isSigningIn = false;
let currentUserInstance: User | null = null;
let authStateListeners: ((user: User | null) => void)[] = [];

// Vyčistit případný starý token z úložišť (přístupový token držíme pouze v paměti)
try {
  sessionStorage.removeItem('ubyport_google_token');
} catch {
  // safe fallback
}

export const clearStoredAccessToken = (): void => {
  cachedAccessToken = null;
};

/**
 * Inicializace Firebase App s aktuálně ověřeným klíčem
 */
export const getFirebaseApp = (): FirebaseApp => {
  const existing = getApps();
  const apiKey = getFirebaseApiKey();

  if (existing.length > 0 && initializedFirebaseApiKey === apiKey) {
    return existing[0];
  }

  const config = {
    ...rawConfig,
    apiKey: apiKey || rawConfig.apiKey || ''
  };
  initializedFirebaseApiKey = config.apiKey;
  return existing.length > 0 ? existing[0] : initializeApp(config);
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
 * Dynamicky zajistí načtení Google Identity Services (GSI) knihovny pro přímé OAuth2
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

    let settled = false;
    const finishOk = () => {
      if (settled) return;
      const oauth2 = (window as any).google?.accounts?.oauth2;
      if (oauth2) {
        settled = true;
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        resolve(oauth2);
      }
    };

    const finishErr = (err: Error) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      reject(err);
    };

    // Krátký polling pro případ, že script z index.html už doběhl před připojením listeneru
    const pollTimer = window.setInterval(finishOk, 50);
    const timeoutTimer = window.setTimeout(() => {
      finishErr(
        new Error('Časový limit pro načtení Google Identity Services vypršel. Zkontrolujte připojení nebo blokátor reklam.')
      );
    }, 10000);

    const existingScript =
      (document.getElementById('gsi-client-script') as HTMLScriptElement | null) ||
      (document.querySelector('script[src*="accounts.google.com/gsi/client"]') as HTMLScriptElement | null);

    if (existingScript) {
      existingScript.addEventListener('load', finishOk);
      existingScript.addEventListener('error', () =>
        finishErr(new Error('Nepodařilo se načíst knihovnu Google Identity Services.'))
      );
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-client-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = finishOk;
    script.onerror = () =>
      finishErr(new Error('Nepodařilo se načíst knihovnu Google Identity Services.'));
    document.head.appendChild(script);
  });
};

/**
 * Přímé Google OAuth2 přihlášení (GIS) – s kontrolou formátu Client ID a kontextu okna
 */
export const signInWithGsi = async (): Promise<{ user: User; accessToken: string }> => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (!origin || origin === 'null' || !/^https?:\/\//i.test(origin)) {
      const err: any = new Error(
        'OAuth2 nelze spustit v omezeném nebo sandboxovaném rámci (neplatný původ okna). Otevřete prosím aplikaci v samostatném okně prohlížeče.'
      );
      err.code = 'invalid_origin_context';
      throw err;
    }
  }

  const clientId = getActiveOAuthClientId();
  if (!isValidOAuthClientId(clientId)) {
    const err: any = new Error(
      'Zadané OAuth Client ID nemá správný formát (*.apps.googleusercontent.com).'
    );
    err.code = 'invalid_client_id';
    throw err;
  }

  const oauth2 = await ensureGsiClient();
  if (!oauth2) {
    throw new Error('Knihovna Google OAuth2 není v prohlížeči dostupná.');
  }

  const scopeString = WORKSPACE_SCOPES.map(s => s.trim()).filter(Boolean).join(' ');

  return new Promise((resolve, reject) => {
    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: scopeString,
        ux_mode: 'popup',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error) {
            console.error('GIS Error callback:', tokenResponse);
            const errCode = String(tokenResponse.error);
            let msg =
              tokenResponse.error_description ||
              tokenResponse.error ||
              'Přihlášení ke Google účtu bylo zrušeno nebo selhalo.';

            if (errCode === 'popup_closed_by_user') {
              const err: any = new Error('Okno pro přihlášení k účtu Google bylo zavřeno.');
              err.code = 'auth/popup-closed-by-user';
              reject(err);
              return;
            }
            if (errCode === 'access_denied') {
              msg = 'Přístup k účtu Google a Google Disku byl uživatelem zamítnut.';
            } else if (
              errCode === 'invalid_request' ||
              errCode === 'redirect_uri_mismatch' ||
              errCode === 'origin_mismatch' ||
              errCode === 'invalid_client' ||
              errCode === 'unauthorized_client'
            ) {
              msg = `Chyba OAuth2 (${errCode}): Tento webový původ nebo Client ID není povolen v Google Cloud Console.`;
            }
            const err: any = new Error(msg);
            err.code = errCode;
            reject(err);
            return;
          }

          if (!tokenResponse?.access_token) {
            reject(new Error('Google nevrátil přístupový token. Zkuste to prosím znovu.'));
            return;
          }

          cachedAccessToken = tokenResponse.access_token;

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
          const errType = err?.type || '';

          if (errType === 'popup_failed_to_open') {
            const blockedErr: any = new Error(
              'Prohlížeč zablokoval vyskakovací okno Google OAuth2. Povolte prosím vyskakovací okna pro tuto stránku.'
            );
            blockedErr.code = 'auth/popup-blocked';
            reject(blockedErr);
            return;
          }

          if (errType === 'popup_closed') {
            const closedErr: any = new Error('Okno pro přihlášení k účtu Google bylo zavřeno.');
            closedErr.code = 'auth/popup-closed-by-user';
            reject(closedErr);
            return;
          }

          const customErr: any = new Error(
            err?.message || 'Chyba OAuth2 při komunikaci s Google Identity Services.'
          );
          customErr.code = 'origin_mismatch';
          reject(customErr);
        }
      });

      client.requestAccessToken({ prompt: 'select_account' });
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
          if (cachedAccessToken) {
            currentUserInstance = fbUser;
            onAuthChange(fbUser);
          } else if (!isSigningIn) {
            cachedAccessToken = null;
            currentUserInstance = null;
            onAuthChange(null);
          }
        } else {
          cachedAccessToken = null;
          currentUserInstance = null;
          onAuthChange(null);
        }
      });
    } catch {
      cachedAccessToken = null;
      onAuthChange(null);
    }
  } else {
    onAuthChange(cachedAccessToken && currentUserInstance ? currentUserInstance : null);
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
    isSigningIn = true;
    try {
      return await signInWithGsi();
    } finally {
      isSigningIn = false;
    }
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    const err: any = new Error('Chybí Firebase Web API klíč. Zadejte prosím Webový klíč API z Firebase Console.');
    err.code = 'auth/missing-api-key';
    throw err;
  }

  try {
    isSigningIn = true;
    // Pokud se mezitím změnil API klíč, zrušíme předchozí cachovanou Firebase instanci
    if (getApps().length > 0 && initializedFirebaseApiKey !== apiKey) {
      await resetFirebaseApps();
    }

    const auth = getFirebaseAuth();
    const provider = getGoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('Firebase Auth nevrátil přístupový OAuth token pro Google Disk a Google Sheets.');
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
      localStorage.setItem('ubyport_google_user', JSON.stringify(user));
    } catch {}

    authStateListeners.forEach(listener => listener(user));
    return { user, accessToken };
  } catch (firebaseErr: any) {
    console.error('Firebase Auth sign-in failed:', firebaseErr);
    const errCode = firebaseErr.code || '';
    const errMsg = firebaseErr.message || '';

    // Uživatel zavřel okno
    if (
      errCode === 'auth/popup-closed-by-user' ||
      errCode === 'auth/cancelled-popup-request' ||
      errMsg.includes('popup-closed-by-user') ||
      errMsg.includes('closed by user')
    ) {
      const err: any = new Error('Přihlašovací okno bylo zavřeno.');
      err.code = 'auth/popup-closed-by-user';
      throw err;
    }

    // Zablokované vyskakovací okno
    if (errCode === 'auth/popup-blocked' || errMsg.includes('popup-blocked')) {
      const err: any = new Error('Prohlížeč zablokoval vyskakovací okno pro přihlášení. Povolte prosím vyskakovací okna.');
      err.code = 'auth/popup-blocked';
      throw err;
    }

    // Doménový nesoulad ve Firebase Authentication
    if (errCode === 'auth/unauthorized-domain' || errMsg.includes('unauthorized-domain') || errMsg.includes('unauthorized domain')) {
      const err: any = new Error(`Doména "${typeof window !== 'undefined' ? window.location.hostname : ''}" není povolena ve Firebase Authentication.`);
      err.code = 'auth/unauthorized-domain';
      throw err;
    }

    // Nepovolený Google provider ve Firebase Console
    if (errCode === 'auth/operation-not-allowed') {
      const err: any = new Error('Přihlášení přes Google není ve Firebase Console -> Authentication -> Sign-in method zapnuto.');
      err.code = 'auth/operation-not-allowed';
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
  } finally {
    isSigningIn = false;
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
