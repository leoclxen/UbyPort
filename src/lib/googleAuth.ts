import rawConfig from '../../firebase-applet-config.json';

export interface User {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

export const OAUTH_CLIENT_ID =
  rawConfig.oAuthClientId ||
  '180459556553-bukbnnghoblqvq577ku007b5los0el4s.apps.googleusercontent.com';

export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

let cachedAccessToken: string | null = null;
let currentUserInstance: User | null = null;
let authStateListeners: ((user: User | null) => void)[] = [];

// Pokus o obnovení uložené relace ze sessionStorage a localStorage
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
 * Dynamicky zajistí načtení Google Identity Services (GSI) knihovny
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
 * Inicializace sledování stavu Google přihlášení
 */
export const initAuth = (
  onAuthChange: (user: User | null) => void
): (() => void) => {
  authStateListeners.push(onAuthChange);

  // Pokud máme z dřívějška platný uživatelský profil a token v session, ihned informujeme
  if (currentUserInstance && cachedAccessToken) {
    onAuthChange(currentUserInstance);
  } else if (currentUserInstance) {
    onAuthChange(currentUserInstance);
  } else {
    onAuthChange(null);
  }

  return () => {
    authStateListeners = authStateListeners.filter(l => l !== onAuthChange);
  };
};

/**
 * Spustí přímé Google OAuth2 přihlášení s vyžádáním přístupu ke Google Disk a Tabulkám
 * Nevyžaduje ŽÁDNÝ Firebase Web API klíč ani Gemini API klíč!
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  const oauth2 = await ensureGsiClient();
  if (!oauth2) {
    throw new Error('Knihovna Google OAuth2 není v prohlížeči dostupná.');
  }

  return new Promise((resolve, reject) => {
    try {
      const client = oauth2.initTokenClient({
        client_id: OAUTH_CLIENT_ID,
        scope: OAUTH_SCOPES,
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error('GIS Error callback:', tokenResponse);
            const errCode = tokenResponse.error;
            let msg = tokenResponse.error_description || tokenResponse.error || 'Přihlášení ke Google účtu bylo zrušeno nebo selhalo.';
            if (errCode === 'popup_closed_by_user') {
              msg = 'Okno pro přihlášení k účtu Google bylo zavřeno.';
            } else if (errCode === 'access_denied') {
              msg = 'Přístup k účtu Google a Google Disku byl zamítnut.';
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

          // Zjištění profilu uživatele přes Google UserInfo API
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

          // Informovat všechny posluchače
          authStateListeners.forEach(listener => listener(user));

          resolve({ user, accessToken: cachedAccessToken! });
        },
        error_callback: (err: any) => {
          console.error('GIS token client error:', err);
          reject(new Error(err?.message || 'Chyba při komunikaci s Google Identity Services.'));
        }
      });

      // Zobrazí Google dialog pro výběr účtu
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      console.error('Chyba při spuštění Google přihlášení:', err);
      reject(err);
    }
  });
};

/**
 * Vrátí aktuální přístupový token Google (pro Sheets / Drive API)
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Odhlášení uživatele a zrušení tokenu
 */
export const googleLogout = async (): Promise<void> => {
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
