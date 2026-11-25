import { isValidOAuthClientId, sanitizeOAuthClientId } from './googleAuth';
import { parseGoogleSheetUrl } from './publicSheets';

export type SheetAuthMode = 'pub' | 'oauth' | 'fb';

export interface SecretFreeConfigNote {
  sheetMode: SheetAuthMode;
  sheetUrl: string;
  oauthClientId: string;
  firebaseProjectId: string;
  firebaseSeparateKey: boolean;
  apiAccount: string;
  fbAccount: string;
  model: string;
}

const SECRET_PATTERN_GLOBAL = /AIza[0-9A-Za-z_-]{12,}|ya29\.[0-9A-Za-z._-]{15,}|GOCSPX-[0-9A-Za-z_-]{10,}|sk-[0-9A-Za-z]{16,}/g;

export function stripPotentialSecrets(raw: string): { sanitized: string; stripped: boolean } {
  const input = (raw || '').trim();
  if (!input) return { sanitized: '', stripped: false };
  SECRET_PATTERN_GLOBAL.lastIndex = 0;
  const hasMatch = SECRET_PATTERN_GLOBAL.test(input);
  SECRET_PATTERN_GLOBAL.lastIndex = 0;
  if (!hasMatch) {
    return { sanitized: input, stripped: false };
  }
  const cleaned = input.replace(SECRET_PATTERN_GLOBAL, '').replace(/\s{2,}/g, ' ').trim();
  return { sanitized: cleaned, stripped: true };
}

export function normalizeSheetAuthMode(val?: string | null): SheetAuthMode {
  const clean = (val || '').trim().toLowerCase();
  if (clean === 'oauth' || clean === 'oauth2' || clean === 'gis') return 'oauth';
  if (clean === 'fb' || clean === 'firebase') return 'fb';
  return 'pub';
}

export function buildSecretFreeNote(cfg: SecretFreeConfigNote): string {
  const sheetParsed = parseGoogleSheetUrl(cfg.sheetUrl || '');
  const safeSheetUrl = sheetParsed ? sheetParsed.canonicalUrl : stripPotentialSecrets(cfg.sheetUrl).sanitized;
  const safeOauth = isValidOAuthClientId(cfg.oauthClientId || '')
    ? sanitizeOAuthClientId(cfg.oauthClientId)
    : '';
  const safeFbProject = stripPotentialSecrets(cfg.firebaseProjectId || '')
    .sanitized.replace(/[^a-zA-Z0-9._-]/g, '');
  const safeApiAccount =
    stripPotentialSecrets(cfg.apiAccount || '').sanitized || 'UbyExport Google API';
  const safeFbAccount =
    stripPotentialSecrets(cfg.fbAccount || '').sanitized || 'UbyExport Firebase';
  const safeModel = stripPotentialSecrets(cfg.model || '').sanitized || 'gemini-2.5-flash';

  const lines = [
    '# UbyExport Konfigurace (bez hesel a tajnych klicu)',
    'ubyexport_cfg: v1',
    `sheet_mode: ${normalizeSheetAuthMode(cfg.sheetMode)}`,
    `sheet_url: ${safeSheetUrl}`,
    `oauth_client_id: ${safeOauth}`,
    `firebase_project_id: ${safeFbProject}`,
    `firebase_separate_key: ${cfg.firebaseSeparateKey ? 'true' : 'false'}`,
    `api_account: ${safeApiAccount}`,
    `fb_account: ${safeFbAccount}`,
    `model: ${safeModel}`
  ];

  return lines.join('\n');
}

export interface ParsedConfigNoteResult {
  config: Partial<SecretFreeConfigNote>;
  parsedFieldsCount: number;
  strippedSecretWarning: boolean;
}

export function parseSecretFreeNote(rawText: string): ParsedConfigNoteResult {
  const text = (rawText || '').replace(/\r\n/g, '\n');
  let strippedSecretWarning = false;
  const config: Partial<SecretFreeConfigNote> = {};
  let parsedFieldsCount = 0;

  SECRET_PATTERN_GLOBAL.lastIndex = 0;
  if (SECRET_PATTERN_GLOBAL.test(text)) {
    strippedSecretWarning = true;
  }

  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    // Odstranit případné sekrety ještě před parsováním hodnoty
    const { sanitized: safeLine, stripped } = stripPotentialSecrets(line);
    if (stripped) strippedSecretWarning = true;

    const colonIdx = safeLine.indexOf(':');
    const eqIdx = safeLine.indexOf('=');
    const sepIdx =
      colonIdx > 0 && eqIdx > 0
        ? Math.min(colonIdx, eqIdx)
        : Math.max(colonIdx, eqIdx);

    if (sepIdx <= 0) {
      // Fallback: pokud uživatel vložil jen čistý odkaz na Google Sheet
      const maybeSheet = parseGoogleSheetUrl(safeLine);
      if (maybeSheet && !config.sheetUrl) {
        config.sheetUrl = maybeSheet.canonicalUrl;
        parsedFieldsCount++;
      }
      continue;
    }

    const key = safeLine.slice(0, sepIdx).trim().toLowerCase();
    const rawVal = safeLine.slice(sepIdx + 1).trim();

    if (key === 'ubyexport_cfg') continue;

    // Ignorovat jakýkoliv název klíče připomínající heslo / secret
    if (/pass|secret|api_?key|token|auth_?key/i.test(key)) {
      if (rawVal) strippedSecretWarning = true;
      continue;
    }

    if (key === 'sheet_mode' || key === 'auth_mode' || key === 'mode') {
      if (rawVal) {
        config.sheetMode = normalizeSheetAuthMode(rawVal);
        parsedFieldsCount++;
      }
    } else if (key === 'sheet_url' || key === 'sheet' || key === 'google_sheet_url') {
      if (rawVal) {
        const parsed = parseGoogleSheetUrl(rawVal);
        config.sheetUrl = parsed ? parsed.canonicalUrl : rawVal;
        parsedFieldsCount++;
      } else {
        config.sheetUrl = '';
      }
    } else if (key === 'oauth_client_id' || key === 'client_id') {
      if (rawVal && isValidOAuthClientId(rawVal)) {
        config.oauthClientId = sanitizeOAuthClientId(rawVal);
        parsedFieldsCount++;
      } else if (!rawVal) {
        config.oauthClientId = '';
      }
    } else if (key === 'firebase_project_id' || key === 'project_id') {
      const cleanPid = rawVal.replace(/[^a-zA-Z0-9._-]/g, '');
      config.firebaseProjectId = cleanPid;
      if (cleanPid) parsedFieldsCount++;
    } else if (key === 'firebase_separate_key' || key === 'separate_firebase_key') {
      const lower = rawVal.toLowerCase();
      config.firebaseSeparateKey = lower === 'true' || lower === '1' || lower === 'ano' || lower === 'yes';
      parsedFieldsCount++;
    } else if (key === 'api_account' || key === 'google_account' || key === 'username') {
      if (rawVal) {
        config.apiAccount = rawVal;
        parsedFieldsCount++;
      }
    } else if (key === 'fb_account' || key === 'firebase_account') {
      if (rawVal) {
        config.fbAccount = rawVal;
        parsedFieldsCount++;
      }
    } else if (key === 'model' || key === 'ocr_model') {
      if (rawVal) {
        config.model = rawVal.replace(/^models\//, '');
        parsedFieldsCount++;
      }
    }
  }

  return {
    config,
    parsedFieldsCount,
    strippedSecretWarning
  };
}
