declare const __APP_VERSION__: string | undefined;

export interface AppVersionInfo {
  full: string;
  short: string;
}

export function parseAppVersion(rawVersion?: string): AppVersionInfo {
  const cleaned = String(rawVersion || '').trim().replace(/^v/i, '');
  const parts = cleaned
    .split('.')
    .map((p) => p.replace(/[^0-9]/g, ''))
    .filter(Boolean);
  const major = parts[0] || '2';
  const minor = parts[1] || '0';
  const patch = parts[2] || '0';
  return {
    full: `${major}.${minor}.${patch}`,
    short: `${major}.${minor}`,
  };
}

const rawInjectedVersion =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.7.0';

const parsedVersion = parseAppVersion(rawInjectedVersion);

/** 3ciferná verze (např. 2.6.1) zobrazovaná v nápovědě a metadatech */
export const APP_VERSION_FULL = parsedVersion.full;

/** 2ciferná verze (např. 2.6) zobrazovaná na hlavní stránce a v titulku */
export const APP_VERSION_SHORT = parsedVersion.short;
