import React, { useState, useEffect, useRef } from 'react';
import * as jsyaml from 'js-yaml';

declare const __APP_BUILD_TIME__: string;
import {
  Camera,
  Image as ImageIcon,
  Edit3,
  Building,
  ShieldCheck,
  Download,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  BookOpen,
  HelpCircle,
  Scan,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ChevronDown,
  RotateCcw,
  Sliders,
  Check,
  Zap,
  RefreshCw,
  ExternalLink,
  Laptop,
  LogOut,
  User as UserIcon,
  KeyRound,
  FileDown,
  FileUp,
  AlertCircle,
  Globe,
  Loader2,
  Search,
  Link2,
  Eye,
  EyeOff,
  MapPin
} from 'lucide-react';
import { Property, Guest, PRAGUE_DISTRICTS } from './types';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  getActiveOAuthClientId,
  setCustomOAuthClientId,
  isValidOAuthClientId,
  isUsingCustomOAuthClientId,
  clearStoredAccessToken,
  getFirebaseApiKey,
  getFirebaseProjectId,
  setManualFirebaseConfig,
  clearManualFirebaseConfig,
  hasFirebaseApiKey,
  User,
  getFirebaseAuthSettingsUrl,
  getFirebaseGeneralSettingsUrl,
  getGoogleCloudCredentialsUrl
} from './lib/googleAuth';
import {
  findOrCreateAirTaxSpreadsheet,
  loadAllDataFromGoogleSheet,
  syncAllToGoogleSheet,
  saveSettingsToSheet,
  saveModelToSheet,
  SpreadsheetInfo
} from './lib/googleSheets';
import {
  parseGoogleSheetUrl,
  loadFromPublicGoogleSheet,
  downloadExcelWorkbook,
  downloadCsvExport,
  buildGoogleSheetsTsv,
  importExcelWorkbookFile,
  importCsvFile
} from './lib/publicSheets';
import {
  ImportConflictItem,
  planTabularImport
} from './lib/importConflict';
import { ImportConflictModal } from './components/ImportConflictModal';
import {
  runClientGeminiOcr,
  GeminiModelInfo,
  CURATED_OCR_MODELS,
  fetchAvailableGeminiModels
} from './lib/geminiClientOcr';
import {
  UBYPORT_PURPOSES,
  POPULAR_COUNTRIES,
  normalizeCountryCode,
  normalizePurposeCode,
  cleanAsciiUpper,
  cleanCp1250Name,
  cleanCp1250Bydliste,
  sanitizeCp1250Field,
  formatDateDDMMYYYY,
  parseDateToISO,
  isCzechCitizen,
  parseAddressParts,
  parseCzechAddress,
  resolvePropertyTypeAFields,
  validatePropertyForUnl,
  validateGuestForUnl,
  buildUnlFile,
  parseUnlContent,
  downloadUnlFile,
  decodeUnlBuffer
} from './lib/ubyport';
import {
  verifyGuestNameOcr,
  verifyGuestAddressOsm,
  verifyCzechPropertyAddressOsm,
  AddressVerificationResult
} from './lib/ocrVerification';
import {
  GeminiKeyCredentialForm
} from './components/GeminiKeyCredentialForm';
import { SheetAndNoteConfigSection } from './components/SheetAndNoteConfigSection';
import {
  SecretFreeConfigNote,
  SheetAuthMode
} from './lib/configNote';
import {
  APP_VERSION_FULL,
  APP_VERSION_SHORT
} from './lib/version';

export const APP_VERSION = APP_VERSION_FULL;

/**
 * Detailní ikona naskenovaného ubytovacího lístku / formuláře
 * s ohnutým rohem, laserovým paprskem skeneru, zaměřovači a efektním nápisem Uby
 */
export const ScannedFormUbyIcon: React.FC<{ size?: number; className?: string }> = ({ size = 40, className = '' }) => (
  <div
    className={`relative shrink-0 flex items-center justify-center select-none ${className}`}
    style={{ width: size, height: size }}
  >
    {/* Jemná neónová scanner aura */}
    <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-blue-600/30 via-cyan-400/25 to-indigo-600/30 blur-sm pointer-events-none" />

    {/* SVG ikona formuláře se skenem */}
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative drop-shadow-[0_2px_6px_rgba(14,165,233,0.3)]"
    >
      <defs>
        {/* Pozadí formulářového papíru */}
        <linearGradient id="docGrad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="65%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#090E17" />
        </linearGradient>

        {/* Laserový paprsek skeneru */}
        <linearGradient id="laserBeamGrad" x1="6" y1="22" x2="42" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
          <stop offset="25%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#F0F9FF" stopOpacity="1" />
          <stop offset="75%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
        </linearGradient>

        {/* Přechod textu Uby */}
        <linearGradient id="ubyBadgeText" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="35%" stopColor="#E0F2FE" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        {/* Ohnutý pravý horní roh */}
        <linearGradient id="foldedCornerGrad" x1="32" y1="4" x2="42" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
      </defs>

      {/* Tělo listu papíru se seříznutým horním rohem */}
      <path
        d="M 10 5 C 7.8 5 6 6.8 6 9 L 6 39 C 6 41.2 7.8 43 10 43 L 38 43 C 40.2 43 42 41.2 42 39 L 42 14 L 33 5 Z"
        fill="url(#docGrad)"
        stroke="#38BDF8"
        strokeWidth="1.2"
        strokeOpacity="0.75"
      />

      {/* Ohnutý psí ouško (dog-ear fold) */}
      <path
        d="M 33 5 L 33 13 C 33 13.8 33.6 14.4 34.4 14.4 L 42 14 Z"
        fill="url(#foldedCornerGrad)"
        stroke="#38BDF8"
        strokeWidth="1"
        strokeOpacity="0.8"
      />

      {/* Miniaturní foto pasu / hosta na formuláři */}
      <rect x="9.5" y="9" width="7.5" height="8.5" rx="1.5" fill="#1E293B" stroke="#60A5FA" strokeWidth="0.7" strokeOpacity="0.5" />
      <circle cx="13.25" cy="12" r="1.8" fill="#93C5FD" fillOpacity="0.8" />
      <path d="M 10.5 16 C 11 14.7 15.5 14.7 16 16" stroke="#93C5FD" strokeWidth="0.7" strokeOpacity="0.8" fill="none" />

      {/* Řádky ubytovacího formuláře (Jméno, Příjmení, Pobyt) */}
      <line x1="19.5" y1="9.5" x2="29.5" y2="9.5" stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.7" />
      <line x1="19.5" y1="13" x2="28" y2="13" stroke="#64748B" strokeWidth="0.9" strokeLinecap="round" strokeOpacity="0.6" />
      <line x1="19.5" y1="16.5" x2="30.5" y2="16.5" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.5" />

      {/* Spodní řádky formuláře (Číslo pasu, Stát) */}
      <line x1="9.5" y1="36" x2="24" y2="36" stroke="#64748B" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.6" />
      <line x1="9.5" y1="39" x2="33" y2="39" stroke="#475569" strokeWidth="0.8" strokeLinecap="round" strokeOpacity="0.5" />

      {/* Středový scanner odznak s nápisem Uby */}
      <rect
        x="9"
        y="21"
        width="30"
        height="12"
        rx="3"
        fill="#070C15"
        fillOpacity="0.9"
        stroke="#0284C7"
        strokeWidth="0.9"
      />

      {/* Efektní nápis Uby uvnitř ikony */}
      <text
        x="24"
        y="30.2"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="9.8"
        letterSpacing="0.4px"
        fill="url(#ubyBadgeText)"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.85))' }}
      >
        Uby
      </text>

      {/* Laserový scanner paprsek s jasným ohniskem */}
      <line x1="7" y1="21" x2="41" y2="21" stroke="url(#laserBeamGrad)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="21" r="1.3" fill="#FFFFFF" />

      {/* Optické rohy skeneru (viewfinder brackets) */}
      <path d="M 4 11 L 4 4 L 11 4" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 44 37 L 44 44 L 37 44" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

// Safe localStorage wrapper for Google Sites iframe sandboxes
const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return (window as any).__fallbackStorage?.[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {}
    if (!(window as any).__fallbackStorage) (window as any).__fallbackStorage = {};
    (window as any).__fallbackStorage[key] = value;
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
    if ((window as any).__fallbackStorage) delete (window as any).__fallbackStorage[key];
  }
};

const syncServerApi = async (url: string, options: RequestInit) => {
  if (typeof window === 'undefined') return;
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalDev) return;
  try {
    await fetch(url, options);
  } catch {
    // non-blocking for local dev
  }
};

/**
 * Rychlá klientská optimalizace a komprese obrázku na canvasu před odesláním do Gemini OCR.
 * Zmenší 15-35MB fotky z mobilního foťáku na max 1800px a cca 350KB JPEG.
 * Tím zabrání pádům paměti, timeoutům a zasekávání na GitHub Pages a zrychlí OCR z 30s na 2s.
 */
export function optimizeImageForOcr(
  fileOrDataUrl: File | string,
  maxDimension: number = 1800,
  quality: number = 0.88
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const processImageElement = (img: HTMLImageElement) => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        if (typeof fileOrDataUrl === 'string') {
          resolve({ dataUrl: fileOrDataUrl, mimeType: 'image/jpeg' });
        } else {
          reject(new Error('Neplatný nebo prázdný obrázek'));
        }
        return;
      }

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (typeof fileOrDataUrl === 'string') {
          resolve({ dataUrl: fileOrDataUrl, mimeType: 'image/jpeg' });
        } else {
          reject(new Error('Canvas kontext není dostupný'));
        }
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const optimizedUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({ dataUrl: optimizedUrl, mimeType: 'image/jpeg' });
    };

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => processImageElement(img);
    img.onerror = (e) => {
      if (typeof fileOrDataUrl === 'string') {
        resolve({ dataUrl: fileOrDataUrl, mimeType: 'image/jpeg' });
      } else {
        reject(e);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

export default function App() {
  // App State - Zero hardcoded data
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'scan' | 'ledger' | 'properties' | 'export' | 'info'>('scan');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'foreigners' | 'czech'>('all');
  const [propSearchQuery, setPropSearchQuery] = useState<string>('');

  // OCR & Model State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeModelName, setActiveModelName] = useState<string>(
    safeStorage.getItem('ubyport_model_pref') || 'gemini-2.5-flash'
  );
  // Gemini API klíč držíme výhradně v operační paměti (RAM), nikdy v localStorage/sessionStorage
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [keychainAccountName, setKeychainAccountName] = useState<string>(
    safeStorage.getItem('ubyport_keychain_account') || 'UbyExport Google API'
  );
  const [fbKeychainAccountName, setFbKeychainAccountName] = useState<string>(
    safeStorage.getItem('ubyport_fb_keychain_account') || 'UbyExport Firebase'
  );
  const [activeSheetMode, setActiveSheetMode] = useState<SheetAuthMode>(() => {
    const saved = safeStorage.getItem('ubyport_sheet_auth_mode');
    if (saved === 'pub' || saved === 'oauth' || saved === 'fb') return saved;
    return 'pub';
  });
  const [firebaseSeparateKey, setFirebaseSeparateKey] = useState<boolean>(
    safeStorage.getItem('ubyport_firebase_separate_key') === 'true'
  );
  const [isUnlockExtraExpanded, setIsUnlockExtraExpanded] = useState<boolean>(
    safeStorage.getItem('ubyport_sheet_auth_mode') === 'fb' &&
      safeStorage.getItem('ubyport_firebase_separate_key') === 'true'
  );
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const settingsCredFormRef = useRef<HTMLFormElement | null>(null);
  const closeSettingsAfterSubmitRef = useRef<boolean>(false);
  const lastUnlockedKeyRef = useRef<string>('');
  const ocrAbortControllerRef = useRef<AbortController | null>(null);

  // Google Workspace & Sheets State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [connectedSheet, setConnectedSheet] = useState<SpreadsheetInfo | null>(null);
  const [customSheetId, setCustomSheetId] = useState<string>(
    safeStorage.getItem('ubyport_sheet_id') || ''
  );
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);

  // Zero-Cloud Google Sheet Link & Export State
  const [publicSheetUrl, setPublicSheetUrl] = useState<string>(
    safeStorage.getItem('ubyport_public_sheet_url') || ''
  );
  const [publicSheetInput, setPublicSheetInput] = useState<string>(
    safeStorage.getItem('ubyport_public_sheet_url') || ''
  );
  const [publicSheetLastSync, setPublicSheetLastSync] = useState<string>(
    safeStorage.getItem('ubyport_public_sheet_last_sync') || ''
  );
  const [isLoadingPublicSheet, setIsLoadingPublicSheet] = useState<boolean>(false);
  const [publicSheetError, setPublicSheetError] = useState<string | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [sheetsModalTab, setSheetsModalTab] = useState<'link' | 'oauth'>('link');

  // Modals State
  const [isPropModalOpen, setIsPropModalOpen] = useState<boolean>(false);
  const [propModalMode, setPropModalMode] = useState<'list' | 'form'>('list');
  const [editingPropId, setEditingPropId] = useState<string | null>(null);

  const [isGuestModalOpen, setIsGuestModalOpen] = useState<boolean>(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isMissingKeyModalOpen, setIsMissingKeyModalOpen] = useState<boolean>(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<GeminiModelInfo[]>(CURATED_OCR_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState<string>('');
  const [isDataModalOpen, setIsDataModalOpen] = useState<boolean>(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState<boolean>(false);
  const [isDesktopCameraPromptOpen, setIsDesktopCameraPromptOpen] = useState<boolean>(false);
  const [isDomainModalOpen, setIsDomainModalOpen] = useState<boolean>(false);
  const [domainModalType, setDomainModalType] = useState<'firebase' | 'gis'>('firebase');
  const [isFirebaseKeyModalOpen, setIsFirebaseKeyModalOpen] = useState<boolean>(false);
  const [firebaseProjectIdInput, setFirebaseProjectIdInput] = useState<string>(
    () => safeStorage.getItem('ubyport_firebase_project_id') || getFirebaseProjectId()
  );
  const [firebaseApiKeyInput, setFirebaseApiKeyInput] = useState<string>(() => getFirebaseApiKey());
  const [authMethodChoice, setAuthMethodChoice] = useState<'firebase' | 'gis'>(() =>
    safeStorage.getItem('ubyport_sheet_auth_mode') === 'fb' ? 'firebase' : 'gis'
  );
  const [customOAuthClientId, setCustomOAuthClientIdState] = useState<string>(
    () => safeStorage.getItem('ubyport_oauth_client_id') || ''
  );

  // UNL Import Modal State
  const [isUnlImportModalOpen, setIsUnlImportModalOpen] = useState<boolean>(false);
  const [unlImportRawText, setUnlImportRawText] = useState<string>('');
  const [unlImportParsedGuests, setUnlImportParsedGuests] = useState<Guest[]>([]);
  const [unlImportDetectedFacility, setUnlImportDetectedFacility] = useState<{ idub: string; facilityCode: string } | null>(null);
  const [unlImportDetectedProperty, setUnlImportDetectedProperty] = useState<Partial<Property> | null>(null);

  // Scan Verification / Accommodation Match Modal State
  const [isScanConfirmModalOpen, setIsScanConfirmModalOpen] = useState<boolean>(false);
  const [pendingScanData, setPendingScanData] = useState<{
    detected: any;
    guests: any[];
  } | null>(null);
  const [scanTargetChoice, setScanTargetChoice] = useState<'existing' | 'new'>('existing');
  const [selectedScanPropId, setSelectedScanPropId] = useState<string>('');
  const [detectedPropMatch, setDetectedPropMatch] = useState<{ property: Property; matchReasons: string[] } | null>(null);
  const [scanNewPropForm, setScanNewPropForm] = useState({
    name: '',
    idub: '',
    facilityCode: '',
    hostName: '',
    address: '',
    districtKey: 'praha8',
    variableSymbol: ''
  });
  const [scanGuestAddressChecks, setScanGuestAddressChecks] = useState<Record<number, AddressVerificationResult>>({});
  const [scanPropAddressCheck, setScanPropAddressCheck] = useState<AddressVerificationResult | null>(null);
  const [propAddressCheck, setPropAddressCheck] = useState<AddressVerificationResult | null>(null);
  const [guestAddressCheck, setGuestAddressCheck] = useState<AddressVerificationResult | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Refs for hidden inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const unlFileInputRef = useRef<HTMLInputElement>(null);
  const excelImportInputRef = useRef<HTMLInputElement>(null);
  const csvGuestsImportInputRef = useRef<HTMLInputElement>(null);
  const csvPropsImportInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Tabular Import Conflict Stepping State (.xlsx / .csv)
  const [pendingImportSession, setPendingImportSession] = useState<{
    sourceLabel: string;
    newProperties: Property[];
    newGuests: Guest[];
    conflicts: ImportConflictItem[];
    currentIndex: number;
    currentChoice: 'replace' | 'keep';
    replacedProperties: Property[];
    replacedGuests: Guest[];
    replacedCount: number;
    keptCount: number;
    skippedIdenticalCount: number;
  } | null>(null);

  // Property form state
  const [propForm, setPropForm] = useState({
    name: '',
    idub: '',
    facilityCode: '',
    hostName: '',
    address: '',
    districtKey: 'praha8',
    variableSymbol: '',
    contact: '',
    district: '',
    municipality: '',
    cityPart: '',
    street: '',
    houseNumber: '',
    orientationNumber: '',
    postalCode: ''
  });

  // Guest form state
  const [guestForm, setGuestForm] = useState({
    unit: '',
    airbnbCode: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    nationality: 'DEU',
    residenceCountry: 'DEU',
    city: '',
    street: '',
    address: '',
    idDocumentType: 'PAS',
    idDocumentNumber: '',
    documentIssuerCountry: 'DEU',
    visaNumber: '',
    purposeOfStay: '10',
    note: '',
    dateArrival: '',
    dateDeparture: '',
    nights: 1
  });

  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Local persistence helper (works on static hosts and inside iframes)
  const persistLocalState = (props: Property[], gst: Guest[], activeId?: string) => {
    try {
      safeStorage.setItem('ubyport_local_yaml', jsyaml.dump({
        meta: {
          version: APP_VERSION,
          lastUpdated: new Date().toISOString(),
          activePropertyId: activeId || activePropertyId || props[0]?.id || ''
        },
        properties: props,
        guests: gst
      }));
    } catch (e) {
      console.warn('Failed to persist to local storage', e);
    }
  };

  // 1. Fetch initial data from server on mount with static fallback
  const fetchCloudData = async () => {
    try {
      setIsLoading(true);
      let loadedFromServer = false;
      const isLocalDev = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
      );

      if (isLocalDev) {
        try {
          const res = await fetch('/api/data');
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            setProperties(data.properties || []);
            setGuests(data.guests || []);
            setActivePropertyId(data.meta?.activePropertyId || data.activePropertyId || (data.properties?.[0]?.id ?? ''));
            loadedFromServer = true;
          }
        } catch {
          // Expected when hosted statically without Node backend
        }
      }

      if (!loadedFromServer) {
        // Fallback to local storage
        const localYaml = safeStorage.getItem('ubyport_local_yaml') || safeStorage.getItem('airtax_local_yaml');
        if (localYaml) {
          try {
            const parsed = jsyaml.load(localYaml) as any;
            if (parsed && typeof parsed === 'object') {
              setProperties(parsed.properties || []);
              setGuests(parsed.guests || []);
              setActivePropertyId(parsed.meta?.activePropertyId || parsed.properties?.[0]?.id || '');
            }
          } catch (e) {
            console.error('Error parsing local yaml storage', e);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load initial data', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Purge legacy persisted secrets & Initialize optional Firebase Auth
  useEffect(() => {
    const legacySecretKeys = [
      'ubyport_user_api_key',
      'airtax_secure_key_blob',
      'airtax_gemini_key',
      'gemini_api_key',
      'ubyport_firebase_api_key',
      'ubyport_custom_oauth_client_id',
      'ubyport_google_token',
      'ubyport_google_user'
    ];
    for (const k of legacySecretKeys) {
      safeStorage.removeItem(k);
      try {
        sessionStorage.removeItem(k);
      } catch {}
    }

    // Obnovit ne-tajné identifikátory pro OAuth Client ID a Firebase Project ID do paměti auth modulu
    const savedOAuthId = safeStorage.getItem('ubyport_oauth_client_id') || '';
    if (savedOAuthId && isValidOAuthClientId(savedOAuthId)) {
      try {
        setCustomOAuthClientId(savedOAuthId);
      } catch {}
    }
    const savedFbProjectId = safeStorage.getItem('ubyport_firebase_project_id') || '';
    if (savedFbProjectId) {
      setManualFirebaseConfig(savedFbProjectId, getFirebaseApiKey());
    }

    fetchCloudData();
    if (userApiKey && userApiKey.trim()) {
      refreshModelsList(userApiKey.trim());
    }
    const unsubscribe = initAuth((user) => {
      setCurrentUser(user);
      if (user) {
        getAccessToken().then(tok => {
          if (tok) {
            setGoogleToken(tok);
            connectOrLoadGoogleSpreadsheet(tok);
          }
        });
      } else {
        setGoogleToken(null);
        setConnectedSheet(null);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Connect or load Google Sheet
  const connectOrLoadGoogleSpreadsheet = async (token: string, explicitId?: string) => {
    try {
      setIsGoogleLoading(true);
      const sheetInfo = await findOrCreateAirTaxSpreadsheet(token, explicitId || customSheetId);
      setConnectedSheet(sheetInfo);
      safeStorage.setItem('ubyport_sheet_id', sheetInfo.id);

      const sheetData = await loadAllDataFromGoogleSheet(token, sheetInfo.id);

      if (sheetData.preferredModel) {
        setActiveModelName(sheetData.preferredModel);
        safeStorage.setItem('ubyport_model_pref', sheetData.preferredModel);
      }

      if (sheetData.properties && sheetData.properties.length > 0) {
        setProperties(sheetData.properties);
        setGuests(sheetData.guests || []);
        setActivePropertyId(sheetData.properties[0].id);
        persistLocalState(sheetData.properties, sheetData.guests || [], sheetData.properties[0].id);

        await syncServerApi('/api/import/yaml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yamlContent: jsyaml.dump({
              meta: {
                version: APP_VERSION,
                lastUpdated: new Date().toISOString(),
                activePropertyId: sheetData.properties[0].id
              },
              properties: sheetData.properties,
              guests: sheetData.guests || []
            })
          })
        });

        showToast(`Načteno z Google Sheetu: ${sheetData.properties.length} ubytování, ${sheetData.guests.length} hostů!`, 'success');
      } else if (properties.length > 0 || guests.length > 0) {
        await syncAllToGoogleSheet(token, sheetInfo.id, {
          properties,
          guests,
          preferredModel: activeModelName
        });
        showToast('Data byla úspěšně nahrána do nového Google Sheetu!', 'success');
      }
    } catch (err: any) {
      console.error('Google Sheet connect error:', err);
      const errMsg = err?.message || '';
      if (errMsg.includes('401') || errMsg.includes('UNAUTHENTICATED') || errMsg.includes('Invalid Credentials')) {
        clearStoredAccessToken();
        setGoogleToken(null);
        setConnectedSheet(null);
        showToast('Platnost Google relace vypršela. Přihlaste se prosím znovu.', 'warning');
      } else {
        showToast(`Chyba připojení k Google Sheetu: ${errMsg}`, 'warning');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Login / Logout
  const handleGoogleLogin = async (methodOverride?: 'firebase' | 'gis' | React.MouseEvent<any> | any) => {
    const method: 'firebase' | 'gis' = (methodOverride === 'firebase' || methodOverride === 'gis') ? methodOverride : authMethodChoice;

    // Pokud uživatel používá Firebase a nemá zadaný API klíč projektu
    if (method === 'firebase' && !hasFirebaseApiKey()) {
      setIsFirebaseKeyModalOpen(true);
      return;
    }

    try {
      setIsGoogleLoading(true);
      const res = await googleSignIn(method);
      if (!res) return;
      setCurrentUser(res.user);
      setGoogleToken(res.accessToken);
      await connectOrLoadGoogleSpreadsheet(res.accessToken);
      showToast('Přihlášeno k účtu Google a Google Disk propojen!', 'success');
    } catch (err: any) {
      console.error('Google Sign-in failed', err);
      const errCode = err?.code || '';
      const msg = err?.message || '';

      // Uživatel zavřel popup
      if (errCode === 'auth/popup-closed-by-user' || msg.includes('zavřeno') || msg.includes('closed')) {
        const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (method === 'gis' && !isLocal && !isUsingCustomOAuthClientId()) {
          showToast('Přihlášení OAuth2 bylo zavřeno. Pokud Google zobrazil chybu 400, zadejte vlastní OAuth Client ID v Nastavení.', 'info');
        } else {
          showToast('Přihlášení bylo zrušeno.', 'info');
        }
        return;
      }

      // Zablokované vyskakovací okno
      if (errCode === 'auth/popup-blocked') {
        showToast('Prohlížeč zablokoval vyskakovací okno pro přihlášení. Povolte prosím vyskakovací okna pro tento web.', 'warning');
        return;
      }

      // Omezený / sandboxovaný iframe bez platného původu (null origin)
      if (errCode === 'invalid_origin_context') {
        showToast(msg, 'warning');
        return;
      }

      // Chybějící nebo neplatný Firebase API klíč
      if (errCode === 'auth/missing-api-key' || errCode === 'auth/invalid-api-key') {
        setIsFirebaseKeyModalOpen(true);
        showToast(msg, 'warning');
        return;
      }

      // Doména nepovolená ve Firebase Authentication
      if (errCode === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain') || msg.includes('unauthorized domain')) {
        setDomainModalType('firebase');
        setIsDomainModalOpen(true);
        showToast('Doména není povolena ve Firebase Authentication.', 'warning');
        return;
      }

      // Chyba OAuth2 požadavku / origin_mismatch / neplatné Client ID (Chyba 400)
      if (
        errCode === 'origin_mismatch' ||
        errCode === 'redirect_uri_mismatch' ||
        errCode === 'invalid_request' ||
        errCode === 'invalid_client' ||
        errCode === 'invalid_client_id' ||
        errCode === 'unauthorized_client' ||
        msg.includes('origin_mismatch') ||
        msg.includes('invalid_request') ||
        msg.includes('400')
      ) {
        setDomainModalType('gis');
        setIsDomainModalOpen(true);
        showToast('Chyba OAuth2 (400): Původ webu nebo OAuth Client ID vyžaduje nastavení v Google Cloud Console.', 'warning');
        return;
      }

      showToast(`Google přihlášení: ${msg}`, 'warning');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await googleLogout();
      setCurrentUser(null);
      setGoogleToken(null);
      setConnectedSheet(null);
      showToast('Byl jste odhlášen.', 'info');
    } catch (err: any) {
      showToast(`Chyba při odhlášení: ${err.message}`, 'warning');
    }
  };

  // Zero-Cloud Google Sheet Link Loader & Instant Exports
  const handleLoadFromPublicSheet = async (urlOverride?: string) => {
    const rawInput = (typeof urlOverride === 'string' ? urlOverride : publicSheetInput).trim();
    if (!rawInput) {
      setPublicSheetError('Vložte prosím odkaz na váš Google Sheet.');
      showToast('Vložte prosím odkaz na Google Sheet.', 'warning');
      return;
    }

    const parsed = parseGoogleSheetUrl(rawInput);
    if (!parsed) {
      const msg = 'Neplatný odkaz na Google Sheet. Zkopírujte celou URL z adresního řádku.';
      setPublicSheetError(msg);
      showToast(msg, 'warning');
      return;
    }

    try {
      setIsLoadingPublicSheet(true);
      setPublicSheetError(null);
      const result = await loadFromPublicGoogleSheet(rawInput, activePropertyId);

      const nextProps = result.properties.length > 0 ? result.properties : properties;
      const nextGuests = result.guests.length > 0 ? result.guests : guests;
      const nextActiveId = nextProps.find(p => p.id === activePropertyId)?.id || nextProps[0]?.id || '';

      if (result.properties.length > 0) setProperties(result.properties);
      if (result.guests.length > 0) setGuests(result.guests);
      if (nextActiveId) setActivePropertyId(nextActiveId);

      if (result.preferredModel) {
        setActiveModelName(result.preferredModel);
        safeStorage.setItem('ubyport_model_pref', result.preferredModel);
      }

      if (result.properties.length > 0 || result.guests.length > 0) {
        persistLocalState(nextProps, nextGuests, nextActiveId);
        await syncServerApi('/api/import/yaml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            yamlContent: jsyaml.dump({
              meta: {
                version: APP_VERSION,
                lastUpdated: new Date().toISOString(),
                activePropertyId: nextActiveId
              },
              properties: nextProps,
              guests: nextGuests
            })
          })
        });
      }

      const nowIso = new Date().toISOString();
      setPublicSheetUrl(result.canonicalUrl);
      setPublicSheetInput(result.canonicalUrl);
      setPublicSheetLastSync(nowIso);
      safeStorage.setItem('ubyport_public_sheet_url', result.canonicalUrl);
      safeStorage.setItem('ubyport_public_sheet_last_sync', nowIso);

      if (result.properties.length === 0 && result.guests.length === 0) {
        showToast('Sešit propojen, ale nebyly v něm nalezeny žádné řádky hostů ani ubytování.', 'info');
      } else {
        showToast(
          `Načteno z odkazu: ${result.properties.length} ubytování, ${result.guests.length} hostů.`,
          'success'
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Nepodařilo se načíst Google Sheet.';
      setPublicSheetError(msg);
      showToast(msg, 'warning');
    } finally {
      setIsLoadingPublicSheet(false);
    }
  };

  const handleDisconnectPublicSheet = () => {
    setPublicSheetUrl('');
    setPublicSheetInput('');
    setPublicSheetLastSync('');
    setPublicSheetError(null);
    safeStorage.removeItem('ubyport_public_sheet_url');
    safeStorage.removeItem('ubyport_public_sheet_last_sync');
    showToast('Odkaz na Google Sheet byl odpojen (lokální data zůstala zachována).', 'info');
  };

  const handleDownloadExcelWorkbook = async () => {
    try {
      await downloadExcelWorkbook(properties, guests);
      showToast('Excel sešit (.xlsx se 3 listy) byl stažen.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Nepodařilo se vytvořit soubor .xlsx.', 'warning');
    }
  };

  const handleDownloadCsv = (target: 'guests' | 'properties') => {
    downloadCsvExport(target, properties, guests);
    showToast(
      target === 'guests' ? 'CSV seznam hostů byl stažen.' : 'CSV seznam ubytování byl stažen.',
      'success'
    );
  };

  const finalizeTabularImport = async (params: {
    sourceLabel: string;
    newProperties: Property[];
    newGuests: Guest[];
    replacedProperties: Property[];
    replacedGuests: Guest[];
    replacedCount: number;
    keptCount: number;
    skippedIdenticalCount: number;
  }) => {
    const {
      sourceLabel,
      newProperties,
      newGuests,
      replacedProperties,
      replacedGuests,
      replacedCount,
      keptCount,
      skippedIdenticalCount
    } = params;

    const replacedPropMap = new Map(replacedProperties.map(p => [p.id, p]));
    const mergedProperties = [
      ...properties.map(p => replacedPropMap.get(p.id) || p),
      ...newProperties
    ];

    const replacedGuestMap = new Map(replacedGuests.map(g => [g.id, g]));
    const mergedGuests = [
      ...newGuests,
      ...guests.map(g => replacedGuestMap.get(g.id) || g)
    ];

    const nextActiveId =
      mergedProperties.find(p => p.id === activePropertyId)?.id ||
      mergedProperties[0]?.id ||
      '';

    setProperties(mergedProperties);
    setGuests(mergedGuests);
    if (nextActiveId && nextActiveId !== activePropertyId) {
      setActivePropertyId(nextActiveId);
    }

    persistLocalState(mergedProperties, mergedGuests, nextActiveId);
    await syncServerApi('/api/import/yaml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yamlContent: jsyaml.dump({
          meta: {
            version: APP_VERSION,
            lastUpdated: new Date().toISOString(),
            activePropertyId: nextActiveId
          },
          properties: mergedProperties,
          guests: mergedGuests
        })
      })
    });
    triggerSheetSync(mergedProperties, mergedGuests);

    const addedTotal = newProperties.length + newGuests.length;
    const summaryParts: string[] = [];
    if (addedTotal > 0) summaryParts.push(`+${addedTotal} nových`);
    if (replacedCount > 0) summaryParts.push(`${replacedCount} nahrazeno`);
    if (keptCount > 0) summaryParts.push(`${keptCount} ponecháno`);
    if (skippedIdenticalCount > 0) summaryParts.push(`${skippedIdenticalCount} shodných přeskočeno`);

    showToast(
      summaryParts.length > 0
        ? `Import ${sourceLabel}: ${summaryParts.join(', ')}.`
        : `Import ${sourceLabel}: beze změn.`,
      addedTotal > 0 || replacedCount > 0 ? 'success' : 'info'
    );
  };

  const handleTabularFileSelected = async (
    kind: 'xlsx' | 'csv_guests' | 'csv_properties',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const sourceLabel =
      kind === 'xlsx'
        ? 'Excel (.xlsx)'
        : kind === 'csv_guests'
        ? 'CSV Hosté'
        : 'CSV Ubytování';

    try {
      const parsed =
        kind === 'xlsx'
          ? await importExcelWorkbookFile(file, activeProperty?.id || '')
          : await importCsvFile(
              file,
              kind === 'csv_guests' ? 'guests' : 'properties',
              activeProperty?.id || ''
            );

      const plan = planTabularImport({
        incomingProperties: parsed.properties,
        incomingGuests: parsed.guests,
        existingProperties: properties,
        existingGuests: guests,
        activePropertyId: activeProperty?.id || ''
      });

      const skippedTotal = plan.skippedIdenticalProperties + plan.skippedIdenticalGuests;

      if (plan.conflicts.length === 0) {
        if (plan.newProperties.length === 0 && plan.newGuests.length === 0) {
          showToast(
            `Import ${sourceLabel}: všech ${skippedTotal} záznamů je naprosto shodných (přeskočeno).`,
            'info'
          );
          return;
        }
        await finalizeTabularImport({
          sourceLabel,
          newProperties: plan.newProperties,
          newGuests: plan.newGuests,
          replacedProperties: [],
          replacedGuests: [],
          replacedCount: 0,
          keptCount: 0,
          skippedIdenticalCount: skippedTotal
        });
        return;
      }

      setPendingImportSession({
        sourceLabel,
        newProperties: plan.newProperties,
        newGuests: plan.newGuests,
        conflicts: plan.conflicts,
        currentIndex: 0,
        currentChoice: 'replace',
        replacedProperties: [],
        replacedGuests: [],
        replacedCount: 0,
        keptCount: 0,
        skippedIdenticalCount: skippedTotal
      });
    } catch (err: any) {
      showToast(err?.message || `Nepodařilo se načíst soubor ${sourceLabel}.`, 'warning');
    }
  };

  const handleConfirmImportConflictStep = async () => {
    if (!pendingImportSession) return;
    const conflict = pendingImportSession.conflicts[pendingImportSession.currentIndex];
    const isReplace = pendingImportSession.currentChoice === 'replace';

    const nextReplacedProperties =
      isReplace && conflict.kind === 'property'
        ? [...pendingImportSession.replacedProperties, conflict.incoming]
        : pendingImportSession.replacedProperties;

    const nextReplacedGuests =
      isReplace && conflict.kind === 'guest'
        ? [...pendingImportSession.replacedGuests, conflict.incoming]
        : pendingImportSession.replacedGuests;

    const nextReplacedCount = pendingImportSession.replacedCount + (isReplace ? 1 : 0);
    const nextKeptCount = pendingImportSession.keptCount + (isReplace ? 0 : 1);
    const nextIndex = pendingImportSession.currentIndex + 1;

    if (nextIndex < pendingImportSession.conflicts.length) {
      setPendingImportSession({
        ...pendingImportSession,
        currentIndex: nextIndex,
        currentChoice: 'replace',
        replacedProperties: nextReplacedProperties,
        replacedGuests: nextReplacedGuests,
        replacedCount: nextReplacedCount,
        keptCount: nextKeptCount
      });
      return;
    }

    const finished = pendingImportSession;
    setPendingImportSession(null);
    await finalizeTabularImport({
      sourceLabel: finished.sourceLabel,
      newProperties: finished.newProperties,
      newGuests: finished.newGuests,
      replacedProperties: nextReplacedProperties,
      replacedGuests: nextReplacedGuests,
      replacedCount: nextReplacedCount,
      keptCount: nextKeptCount,
      skippedIdenticalCount: finished.skippedIdenticalCount
    });
  };

  const handleCopySheetsTsv = async (target: 'guests' | 'properties') => {
    try {
      const tsv = buildGoogleSheetsTsv(target, properties, guests);
      await navigator.clipboard.writeText(tsv);
      showToast(
        'Zkopírováno! Otevřete Google Sheet, klikněte na buňku A1 a vložte (Ctrl+V).',
        'success'
      );
    } catch {
      showToast('Nepodařilo se zkopírovat do schránky.', 'warning');
    }
  };

  // Sync to Sheet helper
  const triggerSheetSync = async (propsToSync?: Property[], guestsToSync?: Guest[]) => {
    if (!googleToken || !connectedSheet) return;
    try {
      setIsSyncingSheet(true);
      await syncAllToGoogleSheet(googleToken, connectedSheet.id, {
        properties: propsToSync || properties,
        guests: guestsToSync || guests,
        preferredModel: activeModelName
      });
    } catch (e: any) {
      console.warn('Silent Google Sheet sync error', e);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Active property & guests
  const activeProperty = properties.find(p => p.id === activePropertyId) || properties[0];
  const activeGuests = guests.filter(g => g.propertyId === (activeProperty?.id || ''));

  const handleSwitchActiveProperty = (propId: string) => {
    setActivePropertyId(propId);
    persistLocalState(properties, guests, propId);
    syncServerApi('/api/active-property', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: propId })
    });
  };

  // UNL calculation for active property
  const activeUnlResult = activeProperty
    ? buildUnlFile(activeGuests, activeProperty)
    : {
        content: '',
        headerLine: '',
        guestLines: [],
        includedCount: 0,
        excludedCzechCount: 0,
        invalidCount: 0,
        propertyValidation: validatePropertyForUnl(undefined),
        guestIssues: [],
        canDownload: false
      };

  // PROPERTY CRUD
  const openNewPropertyModal = () => {
    setPropForm({
      name: '',
      idub: '',
      facilityCode: '',
      hostName: '',
      address: '',
      districtKey: 'praha8',
      variableSymbol: '',
      contact: '',
      district: '',
      municipality: '',
      cityPart: '',
      street: '',
      houseNumber: '',
      orientationNumber: '',
      postalCode: ''
    });
    setEditingPropId(null);
    setPropAddressCheck(null);
    setPropModalMode('form');
    setIsPropModalOpen(true);
  };

  const openEditPropertyModal = (prop: Property) => {
    const resolved = resolvePropertyTypeAFields(prop);
    setPropForm({
      name: prop.name,
      idub: prop.idub || '',
      facilityCode: prop.facilityCode || '',
      hostName: prop.hostName || '',
      address: prop.address || '',
      districtKey: prop.districtKey || 'praha8',
      variableSymbol: prop.variableSymbol || '',
      contact: prop.contact ?? resolved.kontakt,
      district: prop.district ?? resolved.okres,
      municipality: prop.municipality ?? resolved.obec,
      cityPart: prop.cityPart ?? resolved.castObce,
      street: prop.street ?? resolved.ulice,
      houseNumber: prop.houseNumber ?? resolved.cisloDomovni,
      orientationNumber: prop.orientationNumber ?? resolved.cisloOrientacni,
      postalCode: prop.postalCode ?? resolved.psc
    });
    setEditingPropId(prop.id);
    setPropAddressCheck(null);
    setPropModalMode('form');
    setIsPropModalOpen(true);
  };

  const handleSplitPropertyAddress = () => {
    const parsed = parseCzechAddress(propForm.address, propForm.districtKey);
    setPropForm(prev => ({
      ...prev,
      district: parsed.district || prev.district,
      municipality: parsed.municipality || prev.municipality,
      cityPart: parsed.cityPart || prev.cityPart,
      street: parsed.street || prev.street,
      houseNumber: parsed.houseNumber || prev.houseNumber,
      orientationNumber: parsed.orientationNumber || prev.orientationNumber,
      postalCode: parsed.postalCode || prev.postalCode
    }));
    showToast('Adresa byla rozdělena do polí záznamu typu A.', 'info');
  };

  const handleVerifyPropertyAddressOsm = async () => {
    const composed = [
      [propForm.street, [propForm.houseNumber, propForm.orientationNumber].filter(Boolean).join('/')].filter(Boolean).join(' '),
      [propForm.postalCode, propForm.municipality || propForm.district].filter(Boolean).join(' ')
    ]
      .filter(Boolean)
      .join(', ');
    const query = propForm.address.trim() || composed;
    if (!query) {
      showToast('Nejprve vyplňte adresu v ČR pro ověření.', 'warning');
      return;
    }
    setPropAddressCheck({ status: 'checking', message: 'Ověřuji adresu v OpenStreetMap...' });
    const res = await verifyCzechPropertyAddressOsm(query, propForm.districtKey);
    setPropAddressCheck(res);
  };

  const handleApplyOsmToProperty = () => {
    if (!propAddressCheck) return;
    const parsed = parseCzechAddress(propForm.address, propForm.districtKey);
    setPropForm(prev => ({
      ...prev,
      district: propAddressCheck.normalizedDistrict || prev.district || parsed.district,
      municipality: propAddressCheck.normalizedMunicipality || prev.municipality || parsed.municipality,
      cityPart: propAddressCheck.normalizedCityPart || prev.cityPart || parsed.cityPart,
      street: propAddressCheck.normalizedStreet || prev.street || parsed.street,
      postalCode: propAddressCheck.normalizedPostalCode || prev.postalCode || parsed.postalCode
    }));
    showToast('Ověřené údaje z OSM byly doplněny do polí typu A.', 'success');
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propForm.name.trim()) {
      showToast('Vyplňte prosím název ubytování.', 'warning');
      return;
    }

    const cleanIdub = cleanAsciiUpper(propForm.idub).replace(/\s/g, '');
    const cleanFacilityCode = cleanAsciiUpper(propForm.facilityCode).replace(/\s/g, '').substring(0, 5);
    const cleanHouse = cleanAsciiUpper(propForm.houseNumber).replace(/\s/g, '');
    const cleanOrient = cleanAsciiUpper(propForm.orientationNumber).replace(/\s/g, '');
    const cleanPsc = (propForm.postalCode || '').replace(/\s/g, '');

    const composedHouse = cleanHouse ? (cleanOrient ? `${cleanHouse}/${cleanOrient}` : cleanHouse) : '';
    const composedStreet = [propForm.street.trim(), composedHouse].filter(Boolean).join(' ');
    const composedCity = [cleanPsc, propForm.municipality.trim() || propForm.district.trim()].filter(Boolean).join(' ');
    const fallbackAddress = [composedStreet, composedCity].filter(Boolean).join(', ');

    const propId = editingPropId || `prop_${Date.now()}`;
    const newProp: Property = {
      id: propId,
      name: sanitizeCp1250Field(propForm.name, false),
      idub: cleanIdub,
      facilityCode: cleanFacilityCode,
      hostName: propForm.hostName.trim(),
      address: propForm.address.trim() || fallbackAddress,
      districtKey: propForm.districtKey || 'praha8',
      variableSymbol: propForm.variableSymbol.trim(),
      contact: sanitizeCp1250Field(propForm.contact || propForm.hostName, false),
      district: sanitizeCp1250Field(propForm.district, false),
      municipality: sanitizeCp1250Field(propForm.municipality, false),
      cityPart: sanitizeCp1250Field(propForm.cityPart, false),
      street: sanitizeCp1250Field(propForm.street, false),
      houseNumber: cleanHouse,
      orientationNumber: cleanOrient,
      postalCode: cleanPsc
    };

    let updatedProps: Property[];
    if (editingPropId) {
      updatedProps = properties.map(p => p.id === editingPropId ? newProp : p);
    } else {
      updatedProps = [...properties, newProp];
    }

    setProperties(updatedProps);
    if (!activePropertyId || !editingPropId) {
      setActivePropertyId(propId);
    }

    persistLocalState(updatedProps, guests, activePropertyId || propId);

    await syncServerApi('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProp)
    });

    triggerSheetSync(updatedProps, guests);

    setIsPropModalOpen(false);
    showToast(editingPropId ? 'Ubytování upraveno.' : 'Nové ubytovací zařízení přidáno.', 'success');
  };

  const handleDeleteProperty = async (propId: string) => {
    if (!confirm('Opravdu chcete smazat toto ubytování a všechny jeho hosty?')) return;

    const updatedProps = properties.filter(p => p.id !== propId);
    const updatedGuests = guests.filter(g => g.propertyId !== propId);
    const nextActiveId = activePropertyId === propId ? (updatedProps[0]?.id || '') : activePropertyId;

    setProperties(updatedProps);
    setGuests(updatedGuests);
    setActivePropertyId(nextActiveId);

    persistLocalState(updatedProps, updatedGuests, nextActiveId);

    await syncServerApi(`/api/properties/${propId}`, { method: 'DELETE' });

    triggerSheetSync(updatedProps, updatedGuests);
    showToast('Ubytování bylo smazáno.', 'info');
  };

  // GUEST CRUD
  const openNewGuestModal = () => {
    if (!activeProperty) {
      showToast('Nejprve přidejte nebo vyberte ubytovací zařízení.', 'warning');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    setGuestForm({
      unit: '',
      airbnbCode: '',
      firstName: '',
      lastName: '',
      birthDate: '',
      nationality: 'DEU',
      residenceCountry: 'DEU',
      city: '',
      street: '',
      address: '',
      idDocumentType: 'PAS',
      idDocumentNumber: '',
      documentIssuerCountry: 'DEU',
      visaNumber: '',
      purposeOfStay: '10',
      note: '',
      dateArrival: today,
      dateDeparture: tomorrow,
      nights: 1
    });
    setEditingGuest(null);
    setGuestAddressCheck(null);
    setIsGuestModalOpen(true);
  };

  const openEditGuestModal = (g: Guest) => {
    setGuestForm({
      unit: g.unit || '',
      airbnbCode: g.airbnbCode || '',
      firstName: g.firstName || '',
      lastName: g.lastName || '',
      birthDate: parseDateToISO(g.birthDate),
      nationality: normalizeCountryCode(g.nationality || 'DEU'),
      residenceCountry: normalizeCountryCode(g.residenceCountry || g.nationality || 'DEU'),
      city: g.city || '',
      street: g.street || '',
      address: g.address || '',
      idDocumentType: g.idDocumentType || 'PAS',
      idDocumentNumber: g.idDocumentNumber || '',
      documentIssuerCountry: normalizeCountryCode(g.documentIssuerCountry || g.nationality || 'DEU'),
      visaNumber: g.visaNumber || '',
      purposeOfStay: normalizePurposeCode(g.purposeOfStay || '10'),
      note: g.note || '',
      dateArrival: parseDateToISO(g.dateArrival),
      dateDeparture: parseDateToISO(g.dateDeparture),
      nights: g.nights || 1
    });
    setEditingGuest(g);
    setGuestAddressCheck(null);
    setIsGuestModalOpen(true);
  };

  const handleVerifyGuestAddressOsm = async () => {
    setGuestAddressCheck({ status: 'checking', message: 'Ověřuji bydliště v OpenStreetMap...' });
    const res = await verifyGuestAddressOsm({
      street: guestForm.street,
      city: guestForm.city,
      residenceCountry: guestForm.residenceCountry,
      nationality: guestForm.nationality
    });
    setGuestAddressCheck(res);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty) return;

    if (!guestForm.lastName.trim()) {
      showToast('Vyplňte prosím příjmení hosta.', 'warning');
      return;
    }

    const nat = normalizeCountryCode(guestForm.nationality);
    const resC = normalizeCountryCode(guestForm.residenceCountry || nat);
    const issC = normalizeCountryCode(guestForm.documentIssuerCountry || nat);

    const guestId = editingGuest ? editingGuest.id : `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nights = Math.max(1, parseInt(String(guestForm.nights)) || 1);

    const cleanFirst = cleanCp1250Name(guestForm.firstName);
    const cleanLast = cleanCp1250Name(guestForm.lastName);
    const cleanCity = cleanCp1250Bydliste(guestForm.city);
    const cleanStreet = cleanCp1250Bydliste(guestForm.street);

    const guestRecord: Guest = {
      id: guestId,
      propertyId: activeProperty.id,
      unit: guestForm.unit.trim(),
      airbnbCode: guestForm.airbnbCode.trim().toUpperCase(),
      firstName: cleanFirst,
      lastName: cleanLast,
      fullName: `${cleanFirst} ${cleanLast}`.trim(),
      birthDate: guestForm.birthDate,
      nationality: nat,
      residenceCountry: resC,
      city: cleanCity,
      street: cleanStreet,
      address: `${cleanStreet}${cleanStreet && cleanCity ? ', ' : ''}${cleanCity}`.trim(),
      idDocumentType: cleanAsciiUpper(guestForm.idDocumentType) === 'OP' ? 'OP' : 'PAS',
      idDocumentNumber: cleanAsciiUpper(guestForm.idDocumentNumber).replace(/[^A-Z0-9]/g, ''),
      documentIssuerCountry: issC,
      visaNumber: sanitizeCp1250Field(guestForm.visaNumber, false).replace(/[^a-zA-Z0-9]/g, ''),
      purposeOfStay: normalizePurposeCode(guestForm.purposeOfStay || '10'),
      note: sanitizeCp1250Field(guestForm.note, true),
      dateArrival: guestForm.dateArrival,
      dateDeparture: guestForm.dateDeparture,
      nights,
      createdAt: editingGuest?.createdAt || new Date().toISOString()
    };

    let updatedGuests: Guest[];
    if (editingGuest) {
      updatedGuests = guests.map(g => g.id === guestId ? guestRecord : g);
    } else {
      updatedGuests = [guestRecord, ...guests];
    }

    setGuests(updatedGuests);
    persistLocalState(properties, updatedGuests);

    await syncServerApi('/api/guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guestRecord)
    });

    triggerSheetSync(properties, updatedGuests);
    setIsGuestModalOpen(false);

    if (isCzechCitizen(nat)) {
      showToast('Host uložen. Upozornění: Občan ČR (CZE) se policii přes UbyPort nehlásí.', 'warning');
    } else {
      showToast(editingGuest ? 'Údaje hosta upraveny.' : 'Nový cizinec přidán do knihy.', 'success');
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (!confirm('Opravdu chcete smazat tohoto hosta?')) return;
    const updatedGuests = guests.filter(g => g.id !== guestId);
    setGuests(updatedGuests);
    persistLocalState(properties, updatedGuests);

    await syncServerApi(`/api/guests/${guestId}`, { method: 'DELETE' });

    triggerSheetSync(properties, updatedGuests);
    showToast('Host byl odstraněn.', 'info');
  };

  // UNL IMPORT HANDLERS
  const handleOpenUnlFileDialog = () => {
    unlFileInputRef.current?.click();
  };

  const handleUnlFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buf = event.target?.result;
      if (buf instanceof ArrayBuffer) {
        processImportedUnlText(decodeUnlBuffer(buf));
      } else if (typeof buf === 'string' && buf) {
        processImportedUnlText(buf);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const processImportedUnlText = (rawText: string) => {
    const parsed = parseUnlContent(rawText, activeProperty?.id);
    if (parsed.errors.length > 0 && parsed.importedGuests.length === 0) {
      showToast(`Chyba importu UNL: ${parsed.errors[0]}`, 'warning');
      return;
    }

    setUnlImportRawText(rawText);
    setUnlImportParsedGuests(parsed.importedGuests);
    setUnlImportDetectedFacility(parsed.detectedFacility || null);
    setUnlImportDetectedProperty(parsed.detectedProperty || null);
    setIsUnlImportModalOpen(true);
  };

  const handleConfirmUnlImport = async () => {
    if (unlImportParsedGuests.length === 0) {
      setIsUnlImportModalOpen(false);
      return;
    }

    let targetProp = activeProperty;
    let updatedProps = [...properties];

    // Pokud UNL obsahuje záznam A (nebo IDUB+zkratku), najdeme shodu nebo vytvoříme / doplníme ubytování
    if (unlImportDetectedProperty || unlImportDetectedFacility) {
      const detIdub = unlImportDetectedProperty?.idub || unlImportDetectedFacility?.idub || '';
      const detCode = unlImportDetectedProperty?.facilityCode || unlImportDetectedFacility?.facilityCode || '';

      const matched = updatedProps.find(
        p =>
          (detIdub && cleanAsciiUpper(p.idub) === detIdub) ||
          (detCode && cleanAsciiUpper(p.facilityCode) === detCode)
      );

      if (matched) {
        targetProp = {
          ...matched,
          idub: matched.idub || detIdub,
          facilityCode: matched.facilityCode || detCode,
          contact: matched.contact || unlImportDetectedProperty?.contact || '',
          district: matched.district || unlImportDetectedProperty?.district || '',
          municipality: matched.municipality || unlImportDetectedProperty?.municipality || '',
          cityPart: matched.cityPart || unlImportDetectedProperty?.cityPart || '',
          street: matched.street || unlImportDetectedProperty?.street || '',
          houseNumber: matched.houseNumber || unlImportDetectedProperty?.houseNumber || '',
          orientationNumber: matched.orientationNumber || unlImportDetectedProperty?.orientationNumber || '',
          postalCode: matched.postalCode || unlImportDetectedProperty?.postalCode || ''
        };
        updatedProps = updatedProps.map(p => p.id === targetProp!.id ? targetProp! : p);
        setProperties(updatedProps);
        setActivePropertyId(targetProp.id);
      } else if (!targetProp || unlImportDetectedProperty?.name) {
        targetProp = {
          id: `prop_${Date.now()}`,
          name: unlImportDetectedProperty?.name || `Ubytování ${detCode}`,
          idub: detIdub,
          facilityCode: detCode,
          hostName: unlImportDetectedProperty?.hostName || '',
          address: unlImportDetectedProperty?.address || 'Praha',
          districtKey: unlImportDetectedProperty?.districtKey || 'praha8',
          contact: unlImportDetectedProperty?.contact || '',
          district: unlImportDetectedProperty?.district || '',
          municipality: unlImportDetectedProperty?.municipality || '',
          cityPart: unlImportDetectedProperty?.cityPart || '',
          street: unlImportDetectedProperty?.street || '',
          houseNumber: unlImportDetectedProperty?.houseNumber || '',
          orientationNumber: unlImportDetectedProperty?.orientationNumber || '',
          postalCode: unlImportDetectedProperty?.postalCode || ''
        };
        updatedProps.push(targetProp);
        setProperties(updatedProps);
        setActivePropertyId(targetProp.id);
      } else if (!targetProp.idub || !targetProp.facilityCode) {
        targetProp = {
          ...targetProp,
          idub: targetProp.idub || detIdub,
          facilityCode: targetProp.facilityCode || detCode
        };
        updatedProps = updatedProps.map(p => p.id === targetProp!.id ? targetProp! : p);
        setProperties(updatedProps);
      }
    }

    // Přiřadíme hostům ID vybraného ubytování
    const finalGuests = unlImportParsedGuests.map(g => ({
      ...g,
      propertyId: targetProp?.id || g.propertyId
    }));

    const mergedGuests = [...finalGuests, ...guests];
    setGuests(mergedGuests);
    persistLocalState(updatedProps, mergedGuests, targetProp?.id);

    await syncServerApi('/api/batch-guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property: targetProp,
        guests: finalGuests
      })
    });

    triggerSheetSync(updatedProps, mergedGuests);
    setIsUnlImportModalOpen(false);
    showToast(`Úspěšně importováno ${finalGuests.length} hostů z UNL souboru!`, 'success');
    setActiveTab('ledger');
  };

  // UNL EXPORT HANDLERS (striktní brána kvality dle PDF)
  const handleDownloadUnl = () => {
    if (!activeProperty) {
      showToast('Vyberte ubytovací zařízení pro export UNL.', 'warning');
      return;
    }
    const result = buildUnlFile(activeGuests, activeProperty);
    if (result.includedCount === 0) {
      showToast('V tomto ubytování nejsou žádní způsobilí cizinci k exportu.', 'warning');
      return;
    }
    if (!result.canDownload) {
      showToast(
        'Stažení UNL je zablokováno: nejprve opravte všechny chyby v záznamu A a záznamech U.',
        'warning'
      );
      return;
    }

    const safeCode = activeProperty.facilityCode || 'UBYPORT';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${safeCode}_${dateStr}.unl`;

    downloadUnlFile(result.content, filename);
    showToast(`Soubor ${filename} byl stažen v CP1250 (záznam A + ${result.includedCount}× U).`, 'success');
  };

  const handleCopyUnlToClipboard = () => {
    if (!activeProperty) return;
    const result = buildUnlFile(activeGuests, activeProperty);
    if (!result.canDownload) {
      showToast(
        'Kopírování je zablokováno: opravte prosím chyby validace nebo přidejte cizince.',
        'warning'
      );
      return;
    }
    navigator.clipboard.writeText(result.content);
    showToast(`UNL zkopírován do schránky (záznam A + ${result.includedCount} řádků U).`, 'success');
  };

  // Cancel scanning in progress
  const handleCancelScan = () => {
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
      ocrAbortControllerRef.current = null;
    }
    setIsScanning(false);
    setScanStatus('');
    showToast('Skenování bylo zrušeno.', 'info');
  };

  // OCR SCAN ENGINE
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Pokud uživatel nahrál .unl soubor (dekódování CP1250 / UTF-8)
    if (file.name.toLowerCase().endsWith('.unl')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const buf = event.target?.result;
        if (buf instanceof ArrayBuffer) {
          processImportedUnlText(decodeUnlBuffer(buf));
        } else if (typeof buf === 'string' && buf) {
          processImportedUnlText(buf);
        }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
      return;
    }

    try {
      setIsScanning(true);
      setScanStatus('Optimalizuji snímek pro rozpoznání...');
      const optimized = await optimizeImageForOcr(file, 1800, 0.88);
      setImagePreview(optimized.dataUrl);
      e.target.value = '';
      await processImageWithOcr(optimized.dataUrl, optimized.mimeType);
    } catch (err: any) {
      console.error('File load error:', err);
      setIsScanning(false);
      setScanStatus('');
      showToast(err.message || 'Nepodařilo se načíst soubor.', 'warning');
    }
  };

  // Helper for rotating photo by 90 degrees in browser
  const rotateImageBase64 = (base64: string, degrees: number = 90): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64);
          return;
        }
        if (degrees === 90 || degrees === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((degrees * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  };

  const handleRotateImage = async () => {
    if (!imagePreview) return;
    try {
      const rotated = await rotateImageBase64(imagePreview, 90);
      setImagePreview(rotated);
      showToast('Obrázek otočen o 90°', 'info');
    } catch (e) {
      console.warn('Chyba při otáčení obrázku', e);
    }
  };

  const processImageWithOcr = async (base64Data: string, mimeType: string = 'image/jpeg') => {
    if (ocrAbortControllerRef.current) {
      ocrAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    ocrAbortControllerRef.current = abortController;

    const hasClientKey = Boolean(userApiKey && userApiKey.trim().length > 0);
    const isLocalDev = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );

    // Na statickém hostingu bez zadaného API klíče ihned otevřeme zadání klíče
    if (!hasClientKey && !isLocalDev) {
      setIsScanning(false);
      setIsMissingKeyModalOpen(true);
      showToast('Zadejte svůj Gemini API klíč v okně níže pro spuštění skenování.', 'info');
      return;
    }

    setIsScanning(true);
    setScanStatus(`Analyzuji formulář pomocí Gemini (${activeModelName})...`);

    try {
      let resultData: any = null;
      // 1. Zkusíme přímé klientské volání přes Google GenAI / Gemini REST API s klíčem uživatele
      if (hasClientKey) {
        const clientRes = await runClientGeminiOcr(
          base64Data,
          userApiKey.trim(),
          activeModelName,
          mimeType,
          abortController.signal
        );
        resultData = clientRes.data;
        setScanStatus(`Úspěšně zpracováno modelem ${clientRes.modelUsed}!`);
      } else if (isLocalDev && !abortController.signal.aborted) {
        // 2. Serverové proxy API (POUZE na lokálním vývoji, pokud není zadán klientský klíč)
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64Data,
            mimeType,
            preferredModel: activeModelName
          }),
          signal: abortController.signal
        });

        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.includes('application/json')) {
          const rawText = await response.text().catch(() => '');
          let errMsg = `Chyba OCR serveru (${response.status})`;
          try {
            const errJson = JSON.parse(rawText);
            if (errJson?.error) errMsg = errJson.error;
          } catch {
            if (rawText && !rawText.includes('<html')) {
              errMsg = `${errMsg}: ${rawText.slice(0, 100)}`;
            }
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        resultData = data.data;
        setScanStatus(`Zpracováno modelem ${data.modelUsed || activeModelName}!`);
      }

      if (abortController.signal.aborted) {
        return;
      }

      if (!resultData) {
        if (!hasClientKey) {
          setIsMissingKeyModalOpen(true);
          throw new Error('Pro OCR skenování je vyžadován Gemini API klíč. Zadejte jej prosím v nastavení.');
        }
        throw new Error('Nepodařilo se zpracovat obrázek ubytovacího lístku.');
      }

      if (resultData && Array.isArray(resultData.guests) && resultData.guests.length > 0) {
        setPendingScanData({
          detected: resultData,
          guests: resultData.guests
        });

        const detectedName = (resultData.detectedPropertyName || '').trim();
        const detectedAddress = (resultData.detectedAddress || '').trim();
        const detectedIdub = cleanAsciiUpper(resultData.detectedIDUB || '').replace(/\s/g, '');
        const detectedFacilityCode = cleanAsciiUpper(resultData.detectedFacilityCode || '').replace(/\s/g, '').substring(0, 5);
        const detectedHost = (resultData.detectedHostName || '').trim();

        // Nalezení shody s existujícími ubytovacími zařízeními
        let bestMatch: { property: Property; matchReasons: string[] } | null = null;
        let maxMatchScore = 0;

        for (const p of properties) {
          const reasons: string[] = [];
          let score = 0;

          const pIdub = cleanAsciiUpper(p.idub || '').replace(/\s/g, '');
          if (detectedIdub && pIdub && detectedIdub === pIdub) {
            reasons.push(`IDUB (${p.idub})`);
            score += 10;
          }

          const pCode = cleanAsciiUpper(p.facilityCode || '').replace(/\s/g, '');
          if (detectedFacilityCode && pCode && detectedFacilityCode === pCode) {
            reasons.push(`Zkratka zařízení (${p.facilityCode})`);
            score += 8;
          }

          const pNameLower = p.name.trim().toLowerCase();
          const dNameLower = detectedName.toLowerCase();
          if (dNameLower && pNameLower && (pNameLower.includes(dNameLower) || dNameLower.includes(pNameLower))) {
            reasons.push(`Název (${p.name})`);
            score += 6;
          }

          const pAddrLower = (p.address || '').toLowerCase();
          const dAddrLower = detectedAddress.toLowerCase();
          if (dAddrLower && pAddrLower && (pAddrLower.includes(dAddrLower) || dAddrLower.includes(pAddrLower))) {
            reasons.push(`Adresa (${p.address})`);
            score += 4;
          }

          if (score > maxMatchScore) {
            maxMatchScore = score;
            bestMatch = { property: p, matchReasons: reasons };
          }
        }

        setDetectedPropMatch(bestMatch);

        if (bestMatch) {
          setSelectedScanPropId(bestMatch.property.id);
          setScanTargetChoice('existing');
        } else if (properties.length > 0) {
          setSelectedScanPropId(activePropertyId || properties[0].id);
          setScanTargetChoice('existing');
        } else {
          setScanTargetChoice('new');
        }

        setScanNewPropForm({
          name: detectedName || 'Moje Ubytování',
          idub: detectedIdub || '',
          facilityCode: detectedFacilityCode || '',
          hostName: detectedHost || '',
          address: detectedAddress || 'Praha',
          districtKey: resultData.detectedDistrictKey || 'praha8',
          variableSymbol: resultData.detectedVS || ''
        });
        setScanGuestAddressChecks({});
        setScanPropAddressCheck(null);

        setIsScanConfirmModalOpen(true);
        showToast(`Rozpoznáno ${resultData.guests.length} hostů! Probíhá kontrola jmen a adres.`, 'success');
      } else {
        throw new Error('Na obrázku nebyl rozpoznán žádný vyplněný řádek hosta.');
      }
    } catch (err: any) {
      console.error('OCR Process error:', err);
      showToast(`Chyba OCR: ${err.message}`, 'warning');
      setScanStatus('');
    } finally {
      setIsScanning(false);
    }
  };

  // Automatické ověření adres z OCR v OpenStreetMap po otevření kontrolního okna
  useEffect(() => {
    if (!isScanConfirmModalOpen || !pendingScanData) return;

    const controller = new AbortController();
    const runChecks = async () => {
      if (scanNewPropForm.address && scanNewPropForm.address.trim().length > 5 && scanNewPropForm.address.trim() !== 'Praha') {
        setScanPropAddressCheck({ status: 'checking', message: 'Ověřuji adresu ubytování v OpenStreetMap...' });
        const propRes = await verifyCzechPropertyAddressOsm(
          scanNewPropForm.address,
          scanNewPropForm.districtKey,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setScanPropAddressCheck(propRes);
        }
      }

      for (let i = 0; i < pendingScanData.guests.length; i++) {
        if (controller.signal.aborted) break;
        const g = pendingScanData.guests[i];
        setScanGuestAddressChecks(prev => ({
          ...prev,
          [i]: { status: 'checking', message: 'Ověřuji adresu bydliště v OpenStreetMap...' }
        }));
        const res = await verifyGuestAddressOsm(
          {
            street: g.street,
            city: g.city,
            residenceCountry: g.residenceCountry,
            nationality: g.nationality
          },
          controller.signal
        );
        if (!controller.signal.aborted && res.status !== 'idle') {
          setScanGuestAddressChecks(prev => ({ ...prev, [i]: res }));
        }
      }
    };

    runChecks();
    return () => controller.abort();
  }, [isScanConfirmModalOpen]);

  const updatePendingScanGuest = (idx: number, patch: Record<string, any>) => {
    setPendingScanData(prev => {
      if (!prev) return prev;
      const nextGuests = prev.guests.map((item: any, i: number) => {
        if (i !== idx) return item;
        const nextItem: any = { ...item, ...patch };
        if (!patch.nameCheck && item.nameCheck && (patch.firstName !== undefined || patch.lastName !== undefined)) {
          const nextNameCheck = { ...item.nameCheck };
          if (patch.firstName !== undefined) {
            delete nextNameCheck.suggestedFirstName;
            delete nextNameCheck.firstNameValid;
            delete nextNameCheck.reason;
          }
          if (patch.lastName !== undefined) {
            delete nextNameCheck.suggestedLastName;
            delete nextNameCheck.lastNameValid;
            delete nextNameCheck.reason;
          }
          nextItem.nameCheck = nextNameCheck;
        }
        return nextItem;
      });
      return { ...prev, guests: nextGuests };
    });
  };

  const reverifyPendingGuestAddress = async (idx: number, overrideGuest?: any) => {
    const g = overrideGuest || pendingScanData?.guests?.[idx];
    if (!g) return;
    setScanGuestAddressChecks(prev => ({
      ...prev,
      [idx]: { status: 'checking', message: 'Ověřuji adresu v OpenStreetMap...' }
    }));
    const res = await verifyGuestAddressOsm({
      street: g.street,
      city: g.city,
      residenceCountry: g.residenceCountry,
      nationality: g.nationality
    });
    setScanGuestAddressChecks(prev => ({ ...prev, [idx]: res }));
  };

  const handleConfirmScanGuests = async () => {
    if (!pendingScanData) return;

    let targetPropId = selectedScanPropId;
    let updatedProps = [...properties];

    if (scanTargetChoice === 'new') {
      const parsedAddr = parseCzechAddress(scanNewPropForm.address, scanNewPropForm.districtKey);
      const osmAddr = scanPropAddressCheck && (scanPropAddressCheck.status === 'verified' || scanPropAddressCheck.status === 'partial')
        ? scanPropAddressCheck
        : null;
      const newProp: Property = {
        id: `prop_${Date.now()}`,
        name: sanitizeCp1250Field(scanNewPropForm.name || 'Nové ubytování', false),
        idub: cleanAsciiUpper(scanNewPropForm.idub).replace(/\s/g, ''),
        facilityCode: cleanAsciiUpper(scanNewPropForm.facilityCode).replace(/\s/g, '').substring(0, 5),
        hostName: scanNewPropForm.hostName.trim(),
        address: scanNewPropForm.address.trim(),
        districtKey: scanNewPropForm.districtKey || 'praha8',
        variableSymbol: scanNewPropForm.variableSymbol.trim(),
        contact: sanitizeCp1250Field(scanNewPropForm.hostName, false),
        district: osmAddr?.normalizedDistrict || parsedAddr.district,
        municipality: osmAddr?.normalizedMunicipality || parsedAddr.municipality,
        cityPart: osmAddr?.normalizedCityPart || parsedAddr.cityPart,
        street: osmAddr?.normalizedStreet || parsedAddr.street,
        houseNumber: parsedAddr.houseNumber,
        orientationNumber: parsedAddr.orientationNumber,
        postalCode: osmAddr?.normalizedPostalCode || parsedAddr.postalCode
      };
      updatedProps.push(newProp);
      targetPropId = newProp.id;
      setProperties(updatedProps);
      setActivePropertyId(targetPropId);
    }

    const parentProp = updatedProps.find(p => p.id === targetPropId);
    const dateArrival = pendingScanData.detected.dateArrival || new Date().toISOString().split('T')[0];
    const dateDeparture = pendingScanData.detected.dateDeparture || new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nights = Math.max(1, parseInt(pendingScanData.detected.nights) || 1);
    const unit = pendingScanData.detected.detectedUnit || '';

    const newGuests: Guest[] = pendingScanData.guests.map((g: any) => {
      const nat = normalizeCountryCode(g.nationality);
      const resC = normalizeCountryCode(g.residenceCountry || nat);
      const issC = normalizeCountryCode(g.documentIssuerCountry || nat);
      let { city = '', street = '' } = g;
      if (!city && g.homeAddress) {
        const parsed = parseAddressParts(g.homeAddress);
        city = parsed.city;
        street = parsed.street;
      }

      const cleanFirst = cleanCp1250Name(g.firstName);
      const cleanLast = cleanCp1250Name(g.lastName);
      const cleanCity = cleanCp1250Bydliste(city);
      const cleanStreet = cleanCp1250Bydliste(street);

      return {
        id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        propertyId: targetPropId,
        unit: (unit || g.unit || '1').trim(),
        airbnbCode: '',
        firstName: cleanFirst,
        lastName: cleanLast,
        fullName: `${cleanFirst} ${cleanLast}`.trim(),
        birthDate: g.birthDate || '',
        nationality: nat,
        residenceCountry: resC,
        city: cleanCity,
        street: cleanStreet,
        address: `${cleanStreet}${cleanStreet && cleanCity ? ', ' : ''}${cleanCity}`.trim(),
        idDocumentType: cleanAsciiUpper(g.documentType) === 'OP' ? 'OP' : 'PAS',
        idDocumentNumber: cleanAsciiUpper(g.passportNumber || g.idDocumentNumber || '').replace(/[^A-Z0-9]/g, ''),
        documentIssuerCountry: issC,
        visaNumber: sanitizeCp1250Field(g.visaNumber || '', false).replace(/[^a-zA-Z0-9]/g, ''),
        purposeOfStay: normalizePurposeCode(g.purposeOfStay || '10'),
        note: '',
        dateArrival,
        dateDeparture,
        nights,
        createdAt: new Date().toISOString()
      };
    });

    const updatedGuests = [...newGuests, ...guests];
    setGuests(updatedGuests);
    persistLocalState(updatedProps, updatedGuests, targetPropId);

    await syncServerApi('/api/batch-guests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property: parentProp,
        guests: newGuests
      })
    });

    triggerSheetSync(updatedProps, updatedGuests);

    setIsScanConfirmModalOpen(false);
    setPendingScanData(null);
    setImagePreview(null);
    setScanStatus('');
    showToast(`Do knihy bylo přidáno ${newGuests.length} hostů!`, 'success');
    setActiveTab('ledger');
  };

  // WEBCAM CAMERA MODAL HANDLERS
  const openWebcam = async () => {
    setIsWebcamOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      setWebcamStream(stream);
      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        webcamVideoRef.current.play();
      }
    } catch (err) {
      console.error('Failed to open webcam', err);
      showToast('Kameru se nepodařilo otevřít nebo chybí oprávnění.', 'warning');
      setIsWebcamOpen(false);
    }
  };

  const closeWebcam = () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach(track => track.stop());
      setWebcamStream(null);
    }
    setIsWebcamOpen(false);
  };

  const captureWebcamPhoto = async () => {
    if (!webcamVideoRef.current || !webcamCanvasRef.current) return;
    const video = webcamVideoRef.current;
    const canvas = webcamCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const b64 = canvas.toDataURL('image/jpeg', 0.95);
      closeWebcam();
      try {
        setIsScanning(true);
        setScanStatus('Optimalizuji snímek z kamery...');
        const optimized = await optimizeImageForOcr(b64, 1800, 0.88);
        setImagePreview(optimized.dataUrl);
        await processImageWithOcr(optimized.dataUrl, optimized.mimeType);
      } catch {
        setImagePreview(b64);
        processImageWithOcr(b64, 'image/jpeg');
      }
    }
  };

  // MODEL SELECTION
  const refreshModelsList = async (keyToUse?: string) => {
    const key = (keyToUse || userApiKey || '').trim();
    if (!key) return;
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const fetched = await fetchAvailableGeminiModels(key);
      if (fetched && fetched.length > 0) {
        setAvailableModels(fetched);
      }
    } catch (err: any) {
      console.warn('Nepodařilo se načíst modely z Google API:', err);
      setModelsError(err.message || 'Nepodařilo se načíst seznam modelů.');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const openModelSelector = async () => {
    if (!userApiKey || !userApiKey.trim()) {
      setIsMissingKeyModalOpen(true);
      return;
    }
    setIsModelSelectorOpen(true);
    refreshModelsList(userApiKey.trim());
  };

  const selectModel = async (modelName: string) => {
    const clean = modelName.replace(/^models\//, '').trim();
    setActiveModelName(clean);
    safeStorage.setItem('ubyport_model_pref', clean);
    setIsModelSelectorOpen(false);
    showToast(`Aktivní model OCR nastaven na: ${clean}`, 'success');

    if (googleToken && connectedSheet) {
      try {
        await saveModelToSheet(googleToken, connectedSheet.id, modelName);
      } catch {
        // silent sheet save error
      }
    }
  };

  // CLEAR API KEY FROM RAM
  const handleClearApiKeyFromRam = () => {
    setUserApiKey('');
    setShowApiKey(false);
    lastUnlockedKeyRef.current = '';
    if (!firebaseSeparateKey) {
      setFirebaseApiKeyInput('');
      setManualFirebaseConfig(firebaseProjectIdInput.trim(), '');
    }
    safeStorage.removeItem('ubyport_user_api_key');
    safeStorage.removeItem('airtax_secure_key_blob');
    safeStorage.removeItem('airtax_gemini_key');
    safeStorage.removeItem('gemini_api_key');
    showToast('API klíč byl vymazán z operační paměti (RAM).', 'info');
  };

  const handleClearFirebaseKeyFromRam = () => {
    setFirebaseApiKeyInput('');
    setManualFirebaseConfig(firebaseProjectIdInput.trim(), '');
    showToast('Firebase Web API klíč byl vymazán z RAM.', 'info');
  };

  // UNLOCK / SAVE API KEY VIA KEYCHAIN / KEEPASS FORM (RAM-ONLY)
  const applyUnlockedGeminiKey = (
    trimmedKey: string,
    trimmedAccount: string,
    closeUnlockModal: boolean
  ) => {
    setUserApiKey(trimmedKey);
    setKeychainAccountName(trimmedAccount);
    setShowApiKey(false);
    lastUnlockedKeyRef.current = trimmedKey;
    safeStorage.setItem('ubyport_keychain_account', trimmedAccount || 'UbyExport Google API');
    safeStorage.removeItem('ubyport_user_api_key');
    safeStorage.removeItem('airtax_secure_key_blob');
    safeStorage.removeItem('airtax_gemini_key');
    safeStorage.removeItem('gemini_api_key');

    // Pokud Firebase sdílí stejný Google API klíč (1 záznam), automaticky synchronizovat do Firebase RAM
    if (!firebaseSeparateKey) {
      setFirebaseApiKeyInput(trimmedKey);
      if (firebaseProjectIdInput.trim()) {
        setManualFirebaseConfig(firebaseProjectIdInput.trim(), trimmedKey);
      }
    }

    refreshModelsList(trimmedKey);

    if (closeUnlockModal) {
      setIsMissingKeyModalOpen(false);
      showToast('Klíč odemčen pouze v RAM (na disk prohlížeče se neukládá).', 'success');
      if (imagePreview) {
        processImageWithOcr(imagePreview);
      }
    } else {
      showToast('Google API klíč odemčen pouze v RAM.', 'success');
    }
  };

  const applyUnlockedFirebaseKey = (trimmedKey: string, trimmedAccount: string) => {
    const cleanAccount = trimmedAccount || 'UbyExport Firebase';
    setFbKeychainAccountName(cleanAccount);
    safeStorage.setItem('ubyport_fb_keychain_account', cleanAccount);
    setFirebaseApiKeyInput(trimmedKey);
    setFirebaseSeparateKey(true);
    safeStorage.setItem('ubyport_firebase_separate_key', 'true');
    setManualFirebaseConfig(firebaseProjectIdInput.trim(), trimmedKey);
    showToast('Firebase Web API klíč odemčen pouze v RAM (2. záznam).', 'success');
  };

  const handleSheetModeChange = (mode: SheetAuthMode) => {
    setActiveSheetMode(mode);
    safeStorage.setItem('ubyport_sheet_auth_mode', mode);
    if (mode === 'oauth') {
      setAuthMethodChoice('gis');
    } else if (mode === 'fb') {
      setAuthMethodChoice('firebase');
      if (firebaseSeparateKey) {
        setIsUnlockExtraExpanded(true);
      }
    }
  };

  const handleSheetUrlConfigChange = (val: string) => {
    setPublicSheetInput(val);
    setPublicSheetUrl(val.trim());
    if (val.trim()) {
      safeStorage.setItem('ubyport_public_sheet_url', val.trim());
      const parsed = parseGoogleSheetUrl(val);
      if (parsed) {
        setCustomSheetId(parsed.spreadsheetId);
        safeStorage.setItem('ubyport_sheet_id', parsed.spreadsheetId);
      }
    } else {
      safeStorage.removeItem('ubyport_public_sheet_url');
    }
  };

  const handleOAuthClientIdConfigChange = (val: string) => {
    setCustomOAuthClientIdState(val);
    const cleaned = val.trim();
    if (!cleaned) {
      safeStorage.removeItem('ubyport_oauth_client_id');
      try {
        setCustomOAuthClientId('');
      } catch {}
      return;
    }
    if (isValidOAuthClientId(cleaned)) {
      try {
        setCustomOAuthClientId(cleaned);
        safeStorage.setItem('ubyport_oauth_client_id', cleaned);
      } catch {}
    }
  };

  const handleFirebaseProjectIdConfigChange = (val: string) => {
    setFirebaseProjectIdInput(val);
    const cleanPid = val.trim();
    if (cleanPid) {
      safeStorage.setItem('ubyport_firebase_project_id', cleanPid);
    } else {
      safeStorage.removeItem('ubyport_firebase_project_id');
    }
    const effectiveFbKey = firebaseSeparateKey ? firebaseApiKeyInput.trim() : userApiKey.trim();
    setManualFirebaseConfig(cleanPid, effectiveFbKey);
  };

  const handleFirebaseSeparateKeyChange = (separate: boolean) => {
    setFirebaseSeparateKey(separate);
    safeStorage.setItem('ubyport_firebase_separate_key', separate ? 'true' : 'false');
    if (!separate) {
      const shared = userApiKey.trim();
      setFirebaseApiKeyInput(shared);
      setManualFirebaseConfig(firebaseProjectIdInput.trim(), shared);
    } else if (firebaseApiKeyInput.trim() && firebaseApiKeyInput.trim() === userApiKey.trim()) {
      setFirebaseApiKeyInput('');
      setManualFirebaseConfig(firebaseProjectIdInput.trim(), '');
    }
  };

  const handleApplyParsedNote = (parsed: Partial<SecretFreeConfigNote>) => {
    if (parsed.sheetMode) {
      handleSheetModeChange(parsed.sheetMode);
    }
    if (typeof parsed.sheetUrl === 'string') {
      handleSheetUrlConfigChange(parsed.sheetUrl);
    }
    if (typeof parsed.oauthClientId === 'string') {
      handleOAuthClientIdConfigChange(parsed.oauthClientId);
    }
    if (typeof parsed.firebaseProjectId === 'string') {
      handleFirebaseProjectIdConfigChange(parsed.firebaseProjectId);
    }
    if (typeof parsed.firebaseSeparateKey === 'boolean') {
      handleFirebaseSeparateKeyChange(parsed.firebaseSeparateKey);
    }
    if (parsed.apiAccount) {
      setKeychainAccountName(parsed.apiAccount);
      safeStorage.setItem('ubyport_keychain_account', parsed.apiAccount);
    }
    if (parsed.fbAccount) {
      setFbKeychainAccountName(parsed.fbAccount);
      safeStorage.setItem('ubyport_fb_keychain_account', parsed.fbAccount);
    }
    if (parsed.model) {
      setActiveModelName(parsed.model);
      safeStorage.setItem('ubyport_model_pref', parsed.model);
    }
  };

  // SAVE NON-SECRET SETTINGS PREFS (MODEL + GOOGLE SHEETS + IDENTIFIERS)
  const saveNonSecretSettingsPrefs = async () => {
    safeStorage.setItem('ubyport_keychain_account', keychainAccountName.trim() || 'UbyExport Google API');
    safeStorage.setItem('ubyport_fb_keychain_account', fbKeychainAccountName.trim() || 'UbyExport Firebase');
    safeStorage.setItem('ubyport_sheet_auth_mode', activeSheetMode);
    safeStorage.setItem('ubyport_firebase_separate_key', firebaseSeparateKey ? 'true' : 'false');
    safeStorage.setItem('ubyport_model_pref', activeModelName);
    if (customOAuthClientId.trim() && isValidOAuthClientId(customOAuthClientId)) {
      safeStorage.setItem('ubyport_oauth_client_id', customOAuthClientId.trim());
    }
    if (firebaseProjectIdInput.trim()) {
      safeStorage.setItem('ubyport_firebase_project_id', firebaseProjectIdInput.trim());
    }

    // Pro jistotu odstraníme případné starší záznamy klíče z úložiště
    safeStorage.removeItem('ubyport_user_api_key');
    safeStorage.removeItem('airtax_secure_key_blob');

    if (googleToken && connectedSheet) {
      try {
        await saveSettingsToSheet(googleToken, connectedSheet.id, activeModelName);
        await syncAllToGoogleSheet(googleToken, connectedSheet.id, {
          properties,
          guests,
          preferredModel: activeModelName
        });
        showToast('Předvolby uloženy do Google Sheetu. API klíče zůstávají bezpečně jen v RAM.', 'success');
      } catch (err: any) {
        showToast(`Nastavení uloženo v prohlížeči, zápis modelu do Sheetu selhal: ${err.message}`, 'warning');
      }
    } else {
      showToast(
        userApiKey.trim()
          ? 'Nastavení uloženo. API klíč je aktivní pouze v operační paměti (RAM).'
          : 'Nastavení předvoleb uloženo.',
        'success'
      );
    }

    setIsSettingsModalOpen(false);
  };

  const handleSaveSettingsPrefsClick = async () => {
    const trimmedKey = userApiKey.trim();
    if (trimmedKey && trimmedKey !== lastUnlockedKeyRef.current && settingsCredFormRef.current) {
      closeSettingsAfterSubmitRef.current = true;
      settingsCredFormRef.current.requestSubmit();
      return;
    }
    await saveNonSecretSettingsPrefs();
  };

  // DATE INPUT HELPER
  const handleArrivalDateChange = (val: string) => {
    setGuestForm(prev => {
      let dep = prev.dateDeparture;
      let nights = prev.nights;
      if (val && dep) {
        const a = new Date(val).getTime();
        const d = new Date(dep).getTime();
        if (!isNaN(a) && !isNaN(d) && d > a) {
          nights = Math.max(1, Math.round((d - a) / (1000 * 60 * 60 * 24)));
        } else {
          dep = new Date(new Date(val).getTime() + 86400000).toISOString().split('T')[0];
          nights = 1;
        }
      }
      return { ...prev, dateArrival: val, dateDeparture: dep, nights };
    });
  };

  const handleDepartureDateChange = (val: string) => {
    setGuestForm(prev => {
      let nights = prev.nights;
      if (prev.dateArrival && val) {
        const a = new Date(prev.dateArrival).getTime();
        const d = new Date(val).getTime();
        if (!isNaN(a) && !isNaN(d) && d > a) {
          nights = Math.max(1, Math.round((d - a) / (1000 * 60 * 60 * 24)));
        }
      }
      return { ...prev, dateDeparture: val, nights };
    });
  };

  return (
    <div className="flex flex-col app-shell-height bg-[#0A0E17] text-slate-100 font-sans select-none overflow-hidden">
      {/* HIDDEN FILE INPUTS */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.unl"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={unlFileInputRef}
        type="file"
        accept=".unl,text/plain"
        className="hidden"
        onChange={handleUnlFileSelected}
      />
      <input
        ref={excelImportInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={e => handleTabularFileSelected('xlsx', e)}
      />
      <input
        ref={csvGuestsImportInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={e => handleTabularFileSelected('csv_guests', e)}
      />
      <input
        ref={csvPropsImportInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={e => handleTabularFileSelected('csv_properties', e)}
      />

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed top-4 inset-x-4 max-w-md mx-auto z-50 p-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100'
              : toast.type === 'warning'
              ? 'bg-amber-950/95 border-amber-500/50 text-amber-100'
              : 'bg-slate-900/95 border-slate-700 text-slate-100'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <span className="text-xs font-semibold leading-snug flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white tap-active p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="header-sharp bg-[#0D131F]/95 border-b border-slate-800/80 px-3.5 sm:px-5 py-2 z-30 shrink-0 backdrop-blur-md">
        {/* ROW 1: Název aplikace UbyExport (umístěný nad levou ikonou) + Google Disk & Nastavení */}
        <div className="flex items-center justify-between gap-2 pb-1.5">
          {/* Vlevo nahoře: Název aplikace UbyExport */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white flex items-center gap-1">
              <span className="bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent">
                UbyExport {APP_VERSION_SHORT}
              </span>
            </h1>
          </div>

          {/* Vpravo nahoře: Stav připojení Google Disk & Tlačítko Nastavení */}
          <div className="flex items-center gap-1.5 shrink-0">
            {currentUser ? (
              <button
                onClick={() => {
                  setSheetsModalTab('oauth');
                  setIsSheetsModalOpen(true);
                }}
                title={connectedSheet ? `Připojen sešit: ${connectedSheet.title}` : 'Google Disk připojen přes účet'}
                className="flex items-center gap-1 px-2.5 min-h-[36px] rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900 tap-active cursor-pointer text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-medium">Disk</span>
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                {isSyncingSheet && (
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping shrink-0" />
                )}
              </button>
            ) : publicSheetUrl ? (
              <button
                onClick={() => {
                  setSheetsModalTab('link');
                  setIsSheetsModalOpen(true);
                }}
                title="Propojeno přes odkaz Google Sheet (bez přihlášení)"
                className="flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg bg-sky-950/80 border border-sky-500/40 text-sky-300 hover:bg-sky-900 tap-active cursor-pointer text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px] font-semibold">Sheets: Odkaz</span>
                {isLoadingPublicSheet && (
                  <Loader2 className="w-3 h-3 animate-spin text-sky-400 shrink-0" />
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  setSheetsModalTab('link');
                  setIsSheetsModalOpen(true);
                }}
                title="Propojit Google Sheets přes odkaz nebo exportovat Excel/CSV (bez Google Cloud a Firebase)"
                className="flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 tap-active cursor-pointer text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-amber-300">Sheets / Excel</span>
              </button>
            )}

            {/* Tlačítko Nastavení */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white tap-active cursor-pointer shrink-0"
              title="Nastavení aplikace a API klíč"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ROW 2: Levá ikona naskenovaného formuláře s Uby uvnitř (přímo pod názvem) + Výběr modelu/klíče | Vpravo: Výběr ubytování */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40">
          {/* Vlevo: Ikona naskenovaného formuláře s efektním Uby a indikátor/výběr modelu */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Detailní ikona formuláře s efektním nápisem Uby */}
            <ScannedFormUbyIcon size={36} />

            {/* Model Gemini nebo tlačítko pro odemčení API klíče z Klíčenky / KeePassu */}
            <div className="min-w-0 flex flex-col justify-center">
              {!userApiKey || !userApiKey.trim() ? (
                <button
                  onClick={() => setIsMissingKeyModalOpen(true)}
                  className="text-[11px] text-amber-300 hover:text-amber-200 bg-amber-500/15 border border-amber-500/40 px-2.5 min-h-[36px] rounded-lg font-semibold flex items-center gap-1.5 tap-active cursor-pointer whitespace-nowrap"
                  title="Odemknout Gemini API klíč z Klíčenky (Face ID) nebo KeePassu do RAM"
                >
                  <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Klíč (Klíčenka / RAM)</span>
                </button>
              ) : (
                <button
                  onClick={openModelSelector}
                  className="text-[11px] text-slate-300 hover:text-sky-300 bg-slate-900/80 border border-slate-700/80 px-2.5 min-h-[36px] rounded-lg font-mono flex items-center gap-1.5 tap-active cursor-pointer truncate max-w-[155px] sm:max-w-[205px]"
                  title="Klíč aktivní v RAM • Klikněte pro změnu Gemini modelu"
                >
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{activeModelName}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Vpravo: Rozevírací seznam výběru ubytovacího zařízení */}
          <div className="shrink-0 max-w-[50%] sm:max-w-[210px]">
            <button
              onClick={() => {
                setPropModalMode('list');
                setIsPropModalOpen(true);
              }}
              className="w-full flex items-center justify-between gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs font-semibold text-white tap-active cursor-pointer shadow-sm"
              title="Vybrat ubytovací zařízení"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Building className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="truncate">
                  {activeProperty ? activeProperty.name : 'Přidat ubytování'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar px-4 pt-3 pb-6 max-w-2xl mx-auto w-full">

        {/* TAB 1: SCANNER & OCR */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            {/* Scanning Card / Drag and Drop Area */}
            <div
              ref={dropZoneRef}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  if (file.name.toLowerCase().endsWith('.unl')) {
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const t = ev.target?.result as string;
                      if (t) processImportedUnlText(t);
                    };
                    reader.readAsText(file);
                    return;
                  }
                  try {
                    setIsScanning(true);
                    setScanStatus('Optimalizuji snímek pro rozpoznání...');
                    optimizeImageForOcr(file, 1800, 0.88).then(opt => {
                      setImagePreview(opt.dataUrl);
                      processImageWithOcr(opt.dataUrl, opt.mimeType);
                    }).catch(err => {
                      console.error('Drop error:', err);
                      setIsScanning(false);
                      setScanStatus('');
                      showToast('Nepodařilo se zpracovat obrázek.', 'warning');
                    });
                  } catch (err: any) {
                    setIsScanning(false);
                    setScanStatus('');
                    showToast(err.message || 'Chyba při nahrání.', 'warning');
                  }
                }
              }}
              className="relative overflow-hidden rounded-3xl border-2 border-dashed border-slate-750 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 flex flex-col items-center justify-center text-center shadow-xl"
            >
              {imagePreview ? (
                <div className="space-y-3 w-full max-w-md">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950/90 p-2 min-h-[200px] max-h-[420px] flex items-center justify-center shadow-xl">
                    <img
                      src={imagePreview}
                      alt="Náhled ubytovacího lístku"
                      className="max-h-[390px] max-w-full w-auto h-auto object-contain rounded-xl"
                    />

                    {/* PŘI SKENOVÁNÍ: ANIMACE LASERU, STAVOVÝ PRUH A TLAČÍTKO ZRUŠIT */}
                    {isScanning && (
                      <>
                        {/* Animovaný laserový paprsek přejíždějící přes náhled lístku */}
                        <div className="animate-laser absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_#3b82f6] z-20 pointer-events-none" />

                        {/* Jemný skenovací světelný filtr */}
                        <div className="absolute inset-0 bg-blue-950/20 pointer-events-none z-10" />

                        {/* Horní stavový pruh s ikonou a zrušením */}
                        <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-3.5 py-2 rounded-xl shadow-xl">
                          <span className="text-xs font-semibold text-white flex items-center gap-2 truncate">
                            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                            <span className="truncate">{scanStatus || `Analyzuji formulář (${activeModelName})...`}</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelScan}
                            className="text-xs font-bold text-rose-400 hover:text-rose-300 tap-active px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/50 shrink-0 ml-2"
                          >
                            Zrušit
                          </button>
                        </div>

                        {/* Spodní informační štítek */}
                        <div className="absolute bottom-3 inset-x-4 z-30 pointer-events-none text-center">
                          <span className="text-[11px] text-blue-200/90 bg-slate-950/85 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-blue-500/25 shadow">
                            Gemini rozpoznává jména, pas, občanství a termín pobytu...
                          </span>
                        </div>
                      </>
                    )}

                    {/* TLAČÍTKA V PRAVÉM HORNÍM ROHU KDYŽ SE NESKENUJE */}
                    {!isScanning && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                        <button
                          type="button"
                          onClick={handleRotateImage}
                          title="Otočit obrázek o 90°"
                          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white tap-active border border-slate-700/80 shadow-md flex items-center gap-1"
                        >
                          <RotateCcw className="w-4 h-4 text-blue-400" />
                          <span className="text-[10px] font-semibold pr-1">Otočit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(null);
                            setScanStatus('');
                          }}
                          title="Zavřít náhled"
                          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white tap-active border border-slate-700/80 shadow-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* OVLÁDACÍ TLAČÍTKA POD NÁHLEDEM KDYŽ SE NESKENUJE */}
                  {!isScanning && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleRotateImage}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tap-active flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
                        <span>Otočit o 90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => processImageWithOcr(imagePreview)}
                        className="py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold tap-active cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Znovu rozpoznat přes Gemini</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : isScanning ? (
                <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 relative flex items-center justify-center mb-1">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                    <Scan className="w-7 h-7 text-blue-400" />
                  </div>
                  <p className="text-sm font-bold text-white">Připravuji snímek...</p>
                  <p className="text-xs text-blue-300 font-mono">{scanStatus}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                    <Scan className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Naskenovat ubytovací lístek</h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                      Vyfoťte registrační formulář hostů nebo přetáhněte fotku či hotový <strong>.UNL soubor</strong>.
                    </p>
                  </div>

                  {/* ACTION BUTTONS: FOTOAPARÁT, GALERIE, IMPORT UNL */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2 max-w-xs mx-auto">
                    <button
                      type="button"
                      onClick={() => {
                        // Desktop fallback to webcam modal if no direct camera capture
                        if (!/Android|iPhone|iPad/i.test(navigator.userAgent)) {
                          openWebcam();
                        } else {
                          cameraInputRef.current?.click();
                        }
                      }}
                      className="py-3 px-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 tap-active shadow-lg shadow-blue-600/30 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Vyfotit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 tap-active cursor-pointer"
                    >
                      <ImageIcon className="w-4 h-4 text-blue-400" />
                      <span>Galerie</span>
                    </button>
                  </div>

                  {/* UNL Import & Manual Add Buttons */}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleOpenUnlFileDialog}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-semibold flex items-center gap-1.5 tap-active cursor-pointer"
                    >
                      <FileUp className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Importovat .UNL</span>
                    </button>

                    <button
                      type="button"
                      onClick={openNewGuestModal}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-300 text-xs font-semibold flex items-center gap-1.5 tap-active cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" />
                      <span>Zadat ručně</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick overview counter */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Kniha hostů</span>
                <p className="text-xl font-black text-white mt-0.5 tabular-nums">{activeGuests.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">K hlášení UNL</span>
                <p className="text-xl font-black text-emerald-400 mt-0.5">{activeUnlResult.includedCount}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Vyloučeno (ČR)</span>
                <p className="text-xl font-black text-amber-400 mt-0.5">{activeUnlResult.excludedCzechCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GUEST LEDGER (KNIHA HOSTŮ) */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            {/* Header with Search / Filters and Add Guest */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Kniha hostů</h2>
                <p className="text-xs text-slate-400">
                  {activeProperty ? activeProperty.name : 'Všechna zařízení'} • Celkem {activeGuests.length} hostů
                </p>
              </div>
              <button
                onClick={openNewGuestModal}
                className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 tap-active cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Přidat</span>
              </button>
            </div>

            {/* FILTERS */}
            <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setLedgerFilter('all')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all tap-active ${
                  ledgerFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Všichni ({activeGuests.length})
              </button>
              <button
                onClick={() => setLedgerFilter('foreigners')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all tap-active ${
                  ledgerFilter === 'foreigners' ? 'bg-emerald-600/30 text-emerald-300 shadow-sm border border-emerald-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                Cizinci ({activeGuests.filter(g => !isCzechCitizen(g.nationality)).length})
              </button>
              <button
                onClick={() => setLedgerFilter('czech')}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all tap-active ${
                  ledgerFilter === 'czech' ? 'bg-amber-600/30 text-amber-300 shadow-sm border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                Češi ({activeGuests.filter(g => isCzechCitizen(g.nationality)).length})
              </button>
            </div>

            {/* GUESTS LIST */}
            {activeGuests.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 text-center space-y-3">
                <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">V knize zatím nejsou žádní hosté</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Naskenujte ubytovací lístek přes záložku Skener, importujte soubor .UNL nebo přidejte hosta ručně.
                </p>
                <button
                  onClick={openNewGuestModal}
                  className="mt-2 py-2 px-4 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-semibold tap-active"
                >
                  Přidat prvního hosta
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeGuests
                  .filter(g => {
                    const czech = isCzechCitizen(g.nationality);
                    if (ledgerFilter === 'foreigners') return !czech;
                    if (ledgerFilter === 'czech') return czech;
                    return true;
                  })
                  .map(guest => {
                    const isCzech = isCzechCitizen(guest.nationality);
                    const validation = validateGuestForUnl(guest, activeProperty);

                    return (
                      <div
                        key={guest.id}
                        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 hover:border-slate-700 transition-colors shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-sm tracking-wide">
                                {guest.lastName} {guest.firstName}
                              </h3>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {guest.nationality || 'DEU'}
                              </span>
                              {guest.unit && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Pokoj {guest.unit}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 space-x-2">
                              <span>{formatDateDDMMYYYY(guest.dateArrival)} – {formatDateDDMMYYYY(guest.dateDeparture)}</span>
                              <span>•</span>
                              <span>{guest.nights} {guest.nights === 1 ? 'noc' : guest.nights < 5 ? 'noci' : 'nocí'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditGuestModal(guest)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 tap-active"
                              title="Upravit hosta"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGuest(guest.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 tap-active"
                              title="Smazat hosta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Guest details row */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60 font-mono text-slate-300">
                          <div>
                            <span className="text-slate-500">Doklad: </span>
                            <span>{guest.idDocumentType || 'PAS'} {guest.idDocumentNumber || 'Neuvedeno'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Bydliště: </span>
                            <span className="truncate">{guest.city || guest.address || 'Neuvedeno'}</span>
                          </div>
                        </div>

                        {/* Status badge: CZECH EXCLUDED vs VALID vs ERRORS */}
                        <div className="pt-1">
                          {isCzech ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-1 rounded-lg">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>Občan ČR (CZE) – nehlásí se cizinecké policii, vyloučen z UNL.</span>
                            </div>
                          ) : validation.isValid ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-lg">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Připraven k exportu do UNL</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] text-rose-400 bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 rounded-lg">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Chybí: {validation.errors[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB: PROPERTIES (UBYTOVACÍ ZAŘÍZENÍ) */}
        {activeTab === 'properties' && (
          <div className="space-y-4">
            {/* Header with Search and Add Property */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Ubytovací zařízení</h2>
                <p className="text-xs text-slate-400">
                  Celkem {properties.length} ubytovacích míst • Aktivní:{' '}
                  <span className="text-blue-400 font-semibold">{activeProperty ? activeProperty.name : 'Žádné'}</span>
                </p>
              </div>
              <button
                onClick={openNewPropertyModal}
                className="py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 tap-active cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Přidat zařízení</span>
              </button>
            </div>

            {/* SEARCH BAR */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={propSearchQuery}
                onChange={e => setPropSearchQuery(e.target.value)}
                placeholder="Hledat ubytování podle názvu, IDUB, zkratky, adresy..."
                className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-9 pr-8 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none placeholder:text-slate-500"
              />
              {propSearchQuery && (
                <button
                  onClick={() => setPropSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* STATS */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Zařízení</span>
                <p className="text-xl font-black text-white mt-0.5">{properties.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 truncate">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Aktivní výběr</span>
                <p className="text-xs font-bold text-blue-400 mt-1 truncate">
                  {activeProperty ? activeProperty.name : 'Nevybráno'}
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Hostů celkem</span>
                <p className="text-xl font-black text-emerald-400 mt-0.5">{guests.length}</p>
              </div>
            </div>

            {/* PROPERTIES LIST */}
            {properties.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 text-center space-y-3">
                <Building className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">Zatím nemáte vytvořené žádné ubytovací zařízení</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Přidejte své první ubytovací zařízení s kódem IDUB a 5místnou zkratkou pro generování UNL souborů.
                </p>
                <button
                  onClick={openNewPropertyModal}
                  className="mt-2 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold tap-active"
                >
                  Přidat první ubytování
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {properties
                  .filter(p => {
                    if (!propSearchQuery.trim()) return true;
                    const q = propSearchQuery.toLowerCase();
                    return (
                      p.name.toLowerCase().includes(q) ||
                      (p.idub || '').toLowerCase().includes(q) ||
                      (p.facilityCode || '').toLowerCase().includes(q) ||
                      (p.address || '').toLowerCase().includes(q) ||
                      (p.hostName || '').toLowerCase().includes(q)
                    );
                  })
                  .map(prop => {
                    const isActive = prop.id === activePropertyId;
                    const propGuests = guests.filter(g => g.propertyId === prop.id);

                    return (
                      <div
                        key={prop.id}
                        className={`rounded-2xl p-4 space-y-3 transition-all border ${
                          isActive
                            ? 'bg-slate-900/95 border-blue-500/60 ring-1 ring-blue-500/20 shadow-md shadow-blue-500/10'
                            : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-white text-sm tracking-wide truncate">
                                {prop.name}
                              </h3>
                              {isActive ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-lg shrink-0">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Výchozí
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setActivePropertyId(prop.id);
                                    persistLocalState(properties, guests, prop.id);
                                    showToast(`Aktivní zařízení nastaveno na: ${prop.name}`, 'info');
                                  }}
                                  className="text-[10px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 px-2 py-0.5 rounded-lg tap-active shrink-0 cursor-pointer"
                                >
                                  Aktivovat
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {prop.address || 'Praha'}
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEditPropertyModal(prop)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 tap-active"
                              title="Upravit ubytování"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteProperty(prop.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 tap-active"
                              title="Smazat ubytování"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Codes & Details */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                            <span className="text-[9px] text-slate-400 uppercase block font-sans">Kód IDUB:</span>
                            <span className={`font-bold tracking-wider mt-0.5 block truncate ${prop.idub ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {prop.idub || 'Chybí IDUB!'}
                            </span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                            <span className="text-[9px] text-slate-400 uppercase block font-sans">Zkratka (5 znaků):</span>
                            <span className={`font-bold tracking-wider mt-0.5 block truncate ${prop.facilityCode ? 'text-blue-400' : 'text-amber-400'}`}>
                              {prop.facilityCode || 'Chybí kód!'}
                            </span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                            <span className="text-[9px] text-slate-400 uppercase block font-sans">Hostitel:</span>
                            <span className="text-slate-300 block truncate font-sans">
                              {prop.hostName || 'Neuveden'}
                            </span>
                          </div>
                          <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                            <span className="text-[9px] text-slate-400 uppercase block font-sans">Přiřazeno hostů:</span>
                            <span className="text-emerald-400 font-bold block">
                              {propGuests.length} hostů
                            </span>
                          </div>
                        </div>

                        {/* Bottom Action: Zobrazit v knize */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                          <span className="text-[11px] text-slate-500 font-mono">
                            VS: {prop.variableSymbol || '–'}
                          </span>
                          <button
                            onClick={() => {
                              setActivePropertyId(prop.id);
                              persistLocalState(properties, guests, prop.id);
                              setActiveTab('ledger');
                            }}
                            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold tap-active"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Zobrazit knihu hostů</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EXPORT UNL (1 UBYTOVÁNÍ = ZÁZNAM A + JEHO HOSTÉ = ZÁZNAMY U) */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-xl">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                  UbyPort • Příloha č. 3 (A + U)
                </span>
                <h2 className="text-base font-bold text-white">Export UNL souboru</h2>
              </div>

              {/* Úsporný a čitelný textový přehled exportu pro aktivní ubytování z horní lišty */}
              {activeProperty ? (
                <div className="bg-slate-950/75 rounded-2xl px-4 py-3 border border-slate-800 flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-300 leading-snug">
                    Export pro{' '}
                    <strong className="text-white font-bold">„{activeProperty.name}“</strong>
                    <span className="text-slate-500 mx-1.5">—</span>
                    <span className="text-emerald-400 font-extrabold tabular-nums">
                      {activeUnlResult.includedCount} cizinců
                    </span>
                  </p>
                </div>
              ) : (
                <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 text-center space-y-2.5">
                  <p className="text-xs text-slate-400">
                    Zatím nemáte žádné ubytovací zařízení pro generování záznamu typu A.
                  </p>
                  <button
                    type="button"
                    onClick={openNewPropertyModal}
                    className="min-h-[44px] px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold tap-active cursor-pointer"
                  >
                    Přidat ubytovací zařízení
                  </button>
                </div>
              )}

              {/* Případné chyby / varování validace záznamu A a U */}
              {activeProperty &&
                (!activeUnlResult.propertyValidation.isValid ||
                  activeUnlResult.propertyValidation.warnings.length > 0 ||
                  activeUnlResult.guestIssues.length > 0) && (
                  <div className="space-y-2.5">
                    {!activeUnlResult.propertyValidation.isValid && (
                      <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between gap-2 font-bold text-rose-300">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                            Chyby v hlavičce ubytování (záznam A):
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditPropertyModal(activeProperty)}
                            className="text-sky-300 hover:underline whitespace-nowrap cursor-pointer"
                          >
                            Opravit
                          </button>
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-rose-200/90">
                          {activeUnlResult.propertyValidation.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeUnlResult.propertyValidation.isValid &&
                      activeUnlResult.propertyValidation.warnings.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-[11px] flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          <span>{activeUnlResult.propertyValidation.warnings.join(' ')}</span>
                        </div>
                      )}

                    {activeUnlResult.guestIssues.length > 0 && (
                      <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-[11px] space-y-2">
                        <div className="flex items-center gap-1.5 font-bold text-rose-300">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>Chyby u hlášených hostů (záznam U – {activeUnlResult.guestIssues.length}):</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                          {activeUnlResult.guestIssues.map(({ guest, errors }) => (
                            <div
                              key={guest.id}
                              className="bg-slate-950/70 border border-rose-500/30 rounded-xl p-2.5 flex items-start justify-between gap-2"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <p className="font-bold text-white truncate">
                                  {guest.lastName || 'BEZ PŘÍJMENÍ'} {guest.firstName} ({guest.nationality || '?'})
                                </p>
                                <p className="text-rose-200/90 leading-snug">{errors.join(' • ')}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => openEditGuestModal(guest)}
                                className="min-h-[36px] px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-sky-300 rounded-lg font-semibold shrink-0 whitespace-nowrap cursor-pointer"
                              >
                                Opravit hosta
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* UNL FILE PREVIEW CONTAINER */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Náhled UNL souboru (1× A + {activeUnlResult.includedCount}× U)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">CP1250 / CRLF / 16 polí</span>
                </div>

                <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto max-h-48 no-scrollbar whitespace-pre select-all">
                  {activeUnlResult.content ? (
                    activeUnlResult.content
                  ) : (
                    <span className="text-slate-600 italic">Žádná data pro export. Vyberte ubytování v horní liště a přidejte hosty se zahraniční státní příslušností.</span>
                  )}
                </div>
              </div>

              {/* STRIKTNÍ VALIDACE: ZPRÁVA KDYŽ JE EXPORT BLOKOVÁN */}
              {activeProperty && !activeUnlResult.canDownload && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    {activeUnlResult.includedCount === 0
                      ? 'Export vyžaduje alespoň 1 cizince (občané ČR se nehlásí).'
                      : 'Stažení .UNL je zablokováno, dokud nejsou všechny řádky A a U 100% validní podle PDF.'}
                  </span>
                </div>
              )}

              {activeUnlResult.canDownload && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Záznam A i všechny záznamy U (16 polí) jsou platné. Soubor se stáhne v bajtovém kódování CP1250.</span>
                </div>
              )}

              {/* ACTION BUTTONS: STÁHNOUT UNL, KOPÍROVAT */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadUnl}
                  disabled={!activeUnlResult.canDownload}
                  className="min-h-[44px] py-3 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 tap-active shadow-lg shadow-blue-600/30 cursor-pointer whitespace-nowrap"
                >
                  <FileDown className="w-4 h-4" />
                  <span>Stáhnout .UNL</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyUnlToClipboard}
                  disabled={!activeUnlResult.canDownload}
                  className="min-h-[44px] py-3 px-3 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 tap-active cursor-pointer whitespace-nowrap"
                >
                  <Copy className="w-4 h-4 text-blue-400" />
                  <span>Kopírovat UNL</span>
                </button>
              </div>

              {/* UBYPORT PORTAL LINK */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Oficiální portál UbyPort:</span>
                <a
                  href="https://ubyport.policie.cz/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 tap-active"
                >
                  <span>ubyport.policie.cz</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* SJEDNOCENÁ KARTA DAT: IMPORT (VLEVO) & EXPORT (VPRAVO) PRO EXCEL (.xlsx) A CSV */}
            <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 space-y-3.5 shadow-xl">
              <div className="border-b border-slate-800 pb-3">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                  Bez Google Cloud a Firebase
                </span>
                <h2 className="text-base font-bold text-white">Import a export dat (Excel &amp; CSV)</h2>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Načtěte nebo stáhněte data v Excelu (<code>.xlsx</code>) či CSV. Při importu se naprosto shodné záznamy automaticky přeskočí a u změn si zvolíte, zda nahradit nebo ponechat.
              </p>

              <div className="space-y-2">
                {/* Řádek 1: Excel (.xlsx) */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => excelImportInputRef.current?.click()}
                    className="min-h-[44px] py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap"
                  >
                    <FileUp className="w-4 h-4 shrink-0" />
                    <span className="truncate">Import Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExcelWorkbook}
                    className="min-h-[44px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    <span className="truncate">Export Excel (.xlsx)</span>
                  </button>
                </div>

                {/* Řádek 2: CSV Hosté */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => csvGuestsImportInputRef.current?.click()}
                    className="min-h-[44px] py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap"
                  >
                    <FileUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">Import CSV Hosté</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv('guests')}
                    className="min-h-[44px] py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">Export CSV Hosté ({guests.length})</span>
                  </button>
                </div>

                {/* Řádek 3: CSV Ubytování */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => csvPropsImportInputRef.current?.click()}
                    className="min-h-[44px] py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap"
                  >
                    <FileUp className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="truncate">Import CSV Ubytování</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv('properties')}
                    className="min-h-[44px] py-2.5 px-3 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    <FileDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">Export CSV Ubytování ({properties.length})</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopySheetsTsv('guests')}
                className="w-full min-h-[44px] py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 tap-active cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>Kopírovat hosty pro Sheets</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: LAW & HELP (UBYPORT PŘEDPISY A DOKUMENTACE UBYEXPORT) */}
        {activeTab === 'info' && (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">UbyExport {APP_VERSION_FULL} • Pravidla UbyPort a UNL</h2>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Kdo se hlásí a zákonná lhůta
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dle <strong>§ 102 zákona č. 326/1999 Sb.</strong> o pobytu cizinců na území ČR je ubytovatel povinen oznámit ubytování cizince do <strong>3 pracovních dnů</strong> po jeho ubytování. Hlásí se <strong>všichni cizinci bez českého občanství</strong> (včetně občanů EU, dětí a kojenců).
              </p>
              <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
                <strong>Občané ČR se přes UbyPort NEHLÁSÍ!</strong> Aplikace občany ČR (CZE) automaticky filtruje a nezařazuje do UNL souboru.
              </div>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Oficiální specifikace formátu UNL (Příloha č. 3)
              </h3>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
                <li>1. řádek: povinný záznam typu <code>A</code> (1 ubytování – 16 polí vč. formátu <code>2</code>, IDUB, zkratky a adresy)</li>
                <li>Další řádky: záznamy typu <code>U</code> (ubytovaní cizinci pro toto 1 ubytování – 16 polí vč. 2ciferného účelu pobytu a poznámky)</li>
                <li>Oddělovač polí: svislítko <code>|</code> (bez koncového <code>|</code>), konce řádků <code>CRLF</code> (<code>\r\n</code>)</li>
                <li>Kódování: skutečné bajty <strong>CP1250 (Windows-1250)</strong> včetně povolené české a evropské diakritiky; přípona exportu je vždy <code>.unl</code></li>
                <li>Doklad: <code>6–30</code> znaků <code>[A-Z0-9]</code> bez mezer; odjezd musí být po příjezdu (<code>datum do &gt; datum od</code>)</li>
              </ul>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Kódy ubytovacího zařízení (IDUB &amp; Zkratka)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Při registraci ubytovatele obdržíte <strong>IDUB</strong> (identifikační číslo ubytovatele) a <strong>5místnou zkratku zařízení</strong> (např. <code>HOTEL</code> nebo <code>APART</code>). Tyto údaje nastavíte v profilu ubytování v aplikaci a budou automaticky vkládány do každého řádku UNL.
              </p>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Gemini OCR skener lístků &amp; ověření jmen a adres
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Formuláře vyfocené mobilním telefonem jsou bleskově vytěženy multimodálním modelem Gemini Flash. Systém automaticky převede jména do velkých písmen, zachová povolenou českou a evropskou diakritiku CP1250, namapuje 3místné ISO kódy států a po rozpoznání ověří existenci jména, příjmení i zahraniční či české adresy bydliště (vč. RÚIAN / OpenStreetMap) pro včasné odhalení překlepů z rukopisu.
              </p>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Klíčenka (Face ID / KeePass), Sheet a Poznámka bez hesel
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                V kódu aplikace nejsou žádné API klíče a neukládají se do <code>localStorage</code> ani do Google Sheetu – zůstávají výhradně v operační paměti (RAM). Pro prohlížečovou Klíčenku (Apple Hesla / Face ID / KeePass) slouží jeden čistý účet (<code>UbyExport Google API</code>, volitelně druhý záznam <code>UbyExport Firebase</code> při odděleném Firebase klíči). Ostatní nešifrovaná nastavení (aktivní režim Google Sheetu – Veřejný odkaz / OAuth 2.0 / Firebase, URL Sheetu, Client/Project ID, model) lze jedním klikem zkopírovat či obnovit přes <strong>Poznámku bez hesel</strong>.
              </p>
            </div>

            <div className="pt-1 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
                <span>Verze: UbyExport {APP_VERSION_FULL} (UNL A+U · CP1250)</span>
                <span>Sestaveno: {typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : 'dev'}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Starší verze kódu a přehled změn jsou na GitHubu archivovány automaticky pod tagy (<code>v{APP_VERSION_FULL}</code>) a v sekci Releases / CHANGELOG.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION TAB BAR */}
      <nav className="shrink-0 relative bg-[#0D131F] border-t border-slate-800 px-2 sm:px-3 pt-1.5 nav-bottom-compact z-40 shadow-lg select-none">
        <div className="max-w-2xl mx-auto grid grid-cols-5 gap-1">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-0.5 tap-active cursor-pointer ${
              activeTab === 'scan' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <Scan className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Skener</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-0.5 tap-active cursor-pointer relative ${
              activeTab === 'ledger' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Kniha</span>
            {activeGuests.length > 0 && (
              <span className="absolute top-0 right-3 sm:right-5 w-4 h-4 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">
                {activeGuests.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-0.5 tap-active cursor-pointer relative ${
              activeTab === 'properties' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <Building className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Ubytování</span>
            {properties.length > 0 && (
              <span className="absolute top-0 right-3 sm:right-5 w-4 h-4 rounded-full bg-slate-700 text-[9px] font-bold text-slate-200 flex items-center justify-center">
                {properties.length}
              </span>
            )}
          </button>

          {/* REPLACED TAB: DATA+UNL */}
          <button
            onClick={() => setActiveTab('export')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-0.5 tap-active cursor-pointer ${
              activeTab === 'export' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <FileDown className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Data+UNL</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`flex flex-col items-center justify-center min-h-[44px] py-0.5 tap-active cursor-pointer ${
              activeTab === 'info' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Nápověda</span>
          </button>
        </div>
      </nav>

      {/* MODAL 1: PROPERTY (UBYTOVÁNÍ) FORM / LIST */}
      {isPropModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">
                {propModalMode === 'form'
                  ? (editingPropId ? 'Upravit ubytovací zařízení' : 'Nové ubytovací zařízení')
                  : 'Správa ubytovacích zařízení'}
              </h3>
              <button onClick={() => setIsPropModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {propModalMode === 'list' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {properties.map(p => (
                    <div
                      key={p.id}
                      onClick={() => {
                        setActivePropertyId(p.id);
                        persistLocalState(properties, guests, p.id);
                        setIsPropModalOpen(false);
                      }}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        p.id === activePropertyId
                          ? 'bg-blue-950/40 border-blue-500 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{p.name}</span>
                          {p.id === activePropertyId && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 text-blue-400">
                              Aktivní
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                          IDUB: {p.idub || 'neuvedeno'} • Kód: {p.facilityCode || 'neuvedeno'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEditPropertyModal(p)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProperty(p.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={openNewPropertyModal}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 tap-active cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Přidat další zařízení</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProperty} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Název ubytování / ubytovatele (max 35 znaků pro typ A) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={35}
                    value={propForm.name}
                    onChange={e => setPropForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="např. Karolina Plazza - Karlín"
                    className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      IDUB (12–14 znaků) *
                    </label>
                    <input
                      type="text"
                      maxLength={14}
                      value={propForm.idub}
                      onChange={e => setPropForm(prev => ({ ...prev, idub: e.target.value }))}
                      placeholder="např. CZ1234567890"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Zkratka zařízení (5 znaků) *
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={propForm.facilityCode}
                      onChange={e => setPropForm(prev => ({ ...prev, facilityCode: e.target.value }))}
                      placeholder="např. APART"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Hostitel (interní evidence)
                    </label>
                    <input
                      type="text"
                      value={propForm.hostName}
                      onChange={e => setPropForm(prev => ({ ...prev, hostName: e.target.value }))}
                      placeholder="např. Michaela Nováková"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Kontakt v UNL (pole 6, max 50)
                    </label>
                    <input
                      type="text"
                      maxLength={50}
                      value={propForm.contact}
                      onChange={e => setPropForm(prev => ({ ...prev, contact: e.target.value }))}
                      placeholder="Tel / e-mail / jméno"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <label className="block text-slate-400 font-semibold">
                      Adresa v ČR (jednolinkový přehled)
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleVerifyPropertyAddressOsm}
                        className="text-[11px] text-emerald-400 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Ověřit v OSM</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSplitPropertyAddress}
                        className="text-[11px] text-blue-400 hover:underline font-semibold cursor-pointer"
                      >
                        Rozdělit do polí A ↓
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={propForm.address}
                    onChange={e => {
                      setPropForm(prev => ({ ...prev, address: e.target.value }));
                      setPropAddressCheck(null);
                    }}
                    placeholder="např. Sokolovská 694/102, 186 00 Praha 8"
                    className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                  {propAddressCheck && propAddressCheck.status !== 'idle' && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                        propAddressCheck.status === 'verified'
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                          : propAddressCheck.status === 'checking'
                            ? 'bg-slate-950 border-slate-800 text-slate-300'
                            : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {propAddressCheck.status === 'checking' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-400" />
                        ) : propAddressCheck.status === 'verified' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                        )}
                        <span className="leading-snug">{propAddressCheck.message}</span>
                      </span>
                      {(propAddressCheck.status === 'verified' || propAddressCheck.status === 'partial') && (
                        <button
                          type="button"
                          onClick={handleApplyOsmToProperty}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-200 rounded-lg font-semibold whitespace-nowrap cursor-pointer"
                        >
                          Použít do polí A ↓
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Strukturovaná adresa pro záznam A */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 block">
                    Strukturovaná adresa pro hlavičku UNL (záznam A)
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Okres / obvod v Praze</label>
                      <input
                        type="text"
                        maxLength={32}
                        value={propForm.district}
                        onChange={e => setPropForm(prev => ({ ...prev, district: e.target.value }))}
                        placeholder="např. Praha 8"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">PSČ (5 číslic)</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={propForm.postalCode}
                        onChange={e => setPropForm(prev => ({ ...prev, postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) }))}
                        placeholder="18600"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Obec</label>
                      <input
                        type="text"
                        maxLength={48}
                        value={propForm.municipality}
                        onChange={e => setPropForm(prev => ({ ...prev, municipality: e.target.value }))}
                        placeholder="např. Praha"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Část obce</label>
                      <input
                        type="text"
                        maxLength={48}
                        value={propForm.cityPart}
                        onChange={e => setPropForm(prev => ({ ...prev, cityPart: e.target.value }))}
                        placeholder="např. Karlín"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-2">
                      <label className="block text-slate-400 font-semibold mb-1">Ulice</label>
                      <input
                        type="text"
                        maxLength={48}
                        value={propForm.street}
                        onChange={e => setPropForm(prev => ({ ...prev, street: e.target.value }))}
                        placeholder="např. Sokolovská"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Č. dom.</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={propForm.houseNumber}
                        onChange={e => setPropForm(prev => ({ ...prev, houseNumber: e.target.value }))}
                        placeholder="694"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Č. or.</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={propForm.orientationNumber}
                        onChange={e => setPropForm(prev => ({ ...prev, orientationNumber: e.target.value }))}
                        placeholder="102"
                        className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-2.5 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPropModalMode('list')}
                    className="flex-1 min-h-[44px] py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active cursor-pointer"
                  >
                    Zpět
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active cursor-pointer"
                  >
                    Uložit ubytování
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: GUEST FORM */}
      {isGuestModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">
                  {editingGuest ? 'Upravit cizince' : 'Nový host pro UbyPort'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Ubytování: {activeProperty?.name} (IDUB: {activeProperty?.idub || 'neuveden'})
                </p>
              </div>
              <button onClick={() => setIsGuestModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGuest} className="space-y-3 text-xs">
              {/* Pokoj / Unit & Airbnb code */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Číslo pokoje / jednotky *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestForm.unit}
                    onChange={e => setGuestForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="např. 102 nebo E302"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Rezervační kód (Airbnb)
                  </label>
                  <input
                    type="text"
                    value={guestForm.airbnbCode}
                    onChange={e => setGuestForm(prev => ({ ...prev, airbnbCode: e.target.value }))}
                    placeholder="např. HMAXYZ123"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              {/* Jméno a Příjmení + kontrola existence a OCR překlepů */}
              {(() => {
                const nameCheck = verifyGuestNameOcr(guestForm.firstName, guestForm.lastName);
                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">
                          Příjmení (1–50, bez titulů) *
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={50}
                          value={guestForm.lastName}
                          onChange={e => setGuestForm(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="např. MÜLLER / NOVÁK"
                          className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">
                          Jméno (0–24, bez titulů)
                        </label>
                        <input
                          type="text"
                          maxLength={24}
                          value={guestForm.firstName}
                          onChange={e => setGuestForm(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="např. TOMÁŠ"
                          className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                        />
                      </div>
                    </div>

                    {(guestForm.lastName.trim() || guestForm.firstName.trim()) && (
                      <div className="space-y-1.5">
                        {nameCheck.lastName.status === 'suspect' && (
                          <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-[11px] flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{nameCheck.lastName.message}</span>
                            </span>
                            {nameCheck.lastName.suggestion && (
                              <button
                                type="button"
                                onClick={() => setGuestForm(prev => ({ ...prev, lastName: nameCheck.lastName.suggestion! }))}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                              >
                                Opravit na {nameCheck.lastName.suggestion}
                              </button>
                            )}
                          </div>
                        )}
                        {nameCheck.firstName.status === 'suspect' && (
                          <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-[11px] flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>{nameCheck.firstName.message}</span>
                            </span>
                            {nameCheck.firstName.suggestion && (
                              <button
                                type="button"
                                onClick={() => setGuestForm(prev => ({ ...prev, firstName: nameCheck.firstName.suggestion! }))}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                              >
                                Opravit na {nameCheck.firstName.suggestion}
                              </button>
                            )}
                          </div>
                        )}
                        {nameCheck.lastName.status !== 'suspect' && nameCheck.firstName.status !== 'suspect' && (
                          <p className={`text-[11px] flex items-center gap-1.5 ${
                            !nameCheck.hasWarning ? 'text-emerald-400' : 'text-slate-400'
                          }`}>
                            {!nameCheck.hasWarning ? (
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Info className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            )}
                            <span>
                              {!nameCheck.hasWarning
                                ? 'Jméno i příjmení ověřeno ve slovníku.'
                                : `${nameCheck.lastName.status === 'unverified' ? nameCheck.lastName.message : nameCheck.firstName.message}`}
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Datum narození & Státní občanství */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Datum narození *
                  </label>
                  <input
                    type="date"
                    required
                    value={guestForm.birthDate}
                    onChange={e => setGuestForm(prev => ({ ...prev, birthDate: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Státní občanství (3místný ISO kód) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={guestForm.nationality}
                    onChange={e => {
                      const val = normalizeCountryCode(e.target.value);
                      setGuestForm(prev => ({
                        ...prev,
                        nationality: val,
                        residenceCountry: prev.residenceCountry || val,
                        documentIssuerCountry: prev.documentIssuerCountry || val
                      }));
                    }}
                    placeholder="např. DEU, USA, SVK"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              {/* CZECH WARNING IF CZE */}
              {isCzechCitizen(guestForm.nationality) && (
                <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Upozornění:</strong> Občané ČR se přes UbyPort cizinecké policii nehlásí. Tento host nebude zahrnut do exportu UNL.
                  </span>
                </div>
              )}

              {/* Bydliště: Stát, Obec, Ulice + OSM ověření */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Stát bydliště *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={3}
                      value={guestForm.residenceCountry}
                      onChange={e => {
                        setGuestForm(prev => ({ ...prev, residenceCountry: normalizeCountryCode(e.target.value) }));
                        setGuestAddressCheck(null);
                      }}
                      placeholder="např. DEU"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Město / Obec *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestForm.city}
                      onChange={e => {
                        setGuestForm(prev => ({ ...prev, city: e.target.value }));
                        setGuestAddressCheck(null);
                      }}
                      placeholder="např. BERLIN"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      Ulice a č.p. *
                    </label>
                    <input
                      type="text"
                      required
                      value={guestForm.street}
                      onChange={e => {
                        setGuestForm(prev => ({ ...prev, street: e.target.value }));
                        setGuestAddressCheck(null);
                      }}
                      placeholder="např. HAUPTSTRASSE 12"
                      className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyGuestAddressOsm}
                    disabled={guestAddressCheck?.status === 'checking'}
                    className="min-h-[36px] px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-sky-300 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer tap-active"
                  >
                    {guestAddressCheck?.status === 'checking' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    )}
                    <span>Ověřit zahraniční adresu v OSM</span>
                  </button>
                  {guestAddressCheck && guestAddressCheck.status !== 'idle' && (
                    <span className={`text-[11px] flex items-center gap-1 ${
                      guestAddressCheck.status === 'verified'
                        ? 'text-emerald-400'
                        : guestAddressCheck.status === 'checking'
                          ? 'text-slate-400'
                          : 'text-amber-300'
                    }`}>
                      {guestAddressCheck.status === 'verified' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : guestAddressCheck.status !== 'checking' ? (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      ) : null}
                      <span>{guestAddressCheck.message}</span>
                    </span>
                  )}
                </div>

                {guestAddressCheck &&
                  (guestAddressCheck.status === 'verified' || guestAddressCheck.status === 'partial') &&
                  (guestAddressCheck.normalizedCity || guestAddressCheck.normalizedStreet) && (
                    <div className="p-2 rounded-xl bg-emerald-950/35 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200">
                      <span>
                        Návrh OSM: <strong>{[guestAddressCheck.normalizedStreet, guestAddressCheck.normalizedCity].filter(Boolean).join(', ')}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setGuestForm(prev => ({
                            ...prev,
                            street: guestAddressCheck.normalizedStreet || prev.street,
                            city: guestAddressCheck.normalizedCity || prev.city
                          }));
                          showToast('Adresa byla zpřesněna podle OpenStreetMap.', 'success');
                        }}
                        className="px-2.5 py-1 bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-100 rounded-lg font-semibold cursor-pointer"
                      >
                        Použít ověřenou adresu
                      </button>
                    </div>
                  )}
              </div>

              {/* Doklad: Druh, Číslo, Stát vydání, Vízo */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Doklad *
                  </label>
                  <select
                    value={guestForm.idDocumentType}
                    onChange={e => setGuestForm(prev => ({ ...prev, idDocumentType: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-2 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    <option value="PAS">PAS (Pas)</option>
                    <option value="OP">OP (Občanka)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-400 font-semibold mb-1">
                    Číslo dokladu *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestForm.idDocumentNumber}
                    onChange={e => setGuestForm(prev => ({ ...prev, idDocumentNumber: e.target.value }))}
                    placeholder="např. C12345678"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Stát vydání *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={guestForm.documentIssuerCountry}
                    onChange={e => setGuestForm(prev => ({ ...prev, documentIssuerCountry: normalizeCountryCode(e.target.value) }))}
                    placeholder="DEU"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

              {/* Číslo víza (volitelné) a Účel pobytu */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Číslo víza (volitelné)
                  </label>
                  <input
                    type="text"
                    value={guestForm.visaNumber}
                    onChange={e => setGuestForm(prev => ({ ...prev, visaNumber: e.target.value }))}
                    placeholder="Prázdné u bezvízových"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Účel pobytu *
                  </label>
                  <select
                    value={guestForm.purposeOfStay}
                    onChange={e => setGuestForm(prev => ({ ...prev, purposeOfStay: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {UBYPORT_PURPOSES.map(p => (
                      <option key={p.code} value={p.code}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data pobytu & Počet nocí */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Příjezd *
                  </label>
                  <input
                    type="date"
                    required
                    value={guestForm.dateArrival}
                    onChange={e => handleArrivalDateChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Odjezd *
                  </label>
                  <input
                    type="date"
                    required
                    value={guestForm.dateDeparture}
                    onChange={e => handleDepartureDateChange(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Počet nocí
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={guestForm.nights}
                    onChange={e => setGuestForm(prev => ({ ...prev, nights: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Poznámka (pole 16 záznamu U) */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  Poznámka pro UbyPort (pole 16, max 255 znaků)
                </label>
                <input
                  type="text"
                  maxLength={255}
                  value={guestForm.note}
                  onChange={e => setGuestForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Volitelná poznámka (např. pokoj / poznámka k pobytu)"
                  className="w-full min-h-[44px] bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active cursor-pointer"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active cursor-pointer"
                >
                  Uložit hosta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SCAN CONFIRMATION / ACCOMMODATION MATCH */}
      {isScanConfirmModalOpen && pendingScanData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Kontrola vytěženého lístku</h3>
                <p className="text-xs text-blue-400">Rozpoznáno {pendingScanData.guests.length} hostů</p>
              </div>
              <button
                onClick={() => {
                  setIsScanConfirmModalOpen(false);
                  setPendingScanData(null);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Accommodation assignment choice */}
            <div className="space-y-3">
              {detectedPropMatch ? (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-950/70 to-slate-900 border border-blue-500/40 space-y-2.5">
                  <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Nalezena shoda s existujícím ubytováním!</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Vytěžený lístek se shoduje v polích:{' '}
                    <span className="font-semibold text-blue-300">
                      {detectedPropMatch.matchReasons.join(', ')}
                    </span>
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setScanTargetChoice('existing');
                        setSelectedScanPropId(detectedPropMatch.property.id);
                      }}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        scanTargetChoice === 'existing' && selectedScanPropId === detectedPropMatch.property.id
                          ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-white text-xs">
                        <span>Přiřadit k existujícímu</span>
                        {scanTargetChoice === 'existing' && selectedScanPropId === detectedPropMatch.property.id && (
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                      </div>
                      <div className="font-bold text-blue-300 mt-1 truncate">
                        {detectedPropMatch.property.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                        IDUB: {detectedPropMatch.property.idub || 'neuveden'} • {detectedPropMatch.property.facilityCode || ''}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setScanTargetChoice('new')}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        scanTargetChoice === 'new'
                          ? 'bg-blue-600/30 border-blue-400 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                          : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-white text-xs">
                        <span>Založit nové zařízení</span>
                        {scanTargetChoice === 'new' && (
                          <Check className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                      </div>
                      <div className="font-bold text-slate-200 mt-1 truncate">
                        {scanNewPropForm.name || 'Z vytěžených dat'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Vytvoří nový profil ubytování
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-bold text-slate-300">Přiřadit k ubytovacímu zařízení:</label>
                  {properties.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setScanTargetChoice('existing')}
                        className={`py-2 px-3 rounded-xl border text-left font-semibold ${
                          scanTargetChoice === 'existing'
                            ? 'bg-blue-950/60 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Existující zařízení
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanTargetChoice('new')}
                        className={`py-2 px-3 rounded-xl border text-left font-semibold ${
                          scanTargetChoice === 'new'
                            ? 'bg-blue-950/60 border-blue-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        Vytvořit nové z lístku
                      </button>
                    </div>
                  )}
                </>
              )}

              {scanTargetChoice === 'existing' && properties.length > 0 ? (
                <div className="space-y-1">
                  {detectedPropMatch && (
                    <label className="text-[10px] text-slate-400 font-semibold block">
                      Vybrané cílové ubytovací zařízení:
                    </label>
                  )}
                  <select
                    value={selectedScanPropId}
                    onChange={e => setSelectedScanPropId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                    {properties.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (IDUB: {p.idub || 'neuveden'}, Kód: {p.facilityCode || 'neuveden'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Název zařízení:</label>
                    <input
                      type="text"
                      value={scanNewPropForm.name}
                      onChange={e => setScanNewPropForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full min-h-[40px] bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[10px] text-slate-400 uppercase font-semibold">Adresa v ČR:</label>
                      <button
                        type="button"
                        onClick={async () => {
                          setScanPropAddressCheck({ status: 'checking', message: 'Ověřuji adresu v OpenStreetMap...' });
                          const r = await verifyCzechPropertyAddressOsm(scanNewPropForm.address, scanNewPropForm.districtKey);
                          setScanPropAddressCheck(r);
                        }}
                        className="text-[11px] text-sky-400 hover:underline font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>Ověřit v OSM</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={scanNewPropForm.address}
                      onChange={e => {
                        setScanNewPropForm(prev => ({ ...prev, address: e.target.value }));
                        setScanPropAddressCheck(null);
                      }}
                      className="w-full min-h-[40px] bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1"
                    />
                    {scanPropAddressCheck && scanPropAddressCheck.status !== 'idle' && (
                      <div
                        className={`mt-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                          scanPropAddressCheck.status === 'verified'
                            ? 'text-emerald-400'
                            : scanPropAddressCheck.status === 'checking'
                              ? 'text-slate-400'
                              : 'text-amber-300'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          {scanPropAddressCheck.status === 'checking' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          ) : scanPropAddressCheck.status === 'verified' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{scanPropAddressCheck.message}</span>
                        </span>
                        {(scanPropAddressCheck.status === 'verified' || scanPropAddressCheck.status === 'partial') &&
                          scanPropAddressCheck.normalizedMunicipality && (
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = parseCzechAddress(scanNewPropForm.address, scanNewPropForm.districtKey);
                                const nums = [parsed.houseNumber, parsed.orientationNumber].filter(Boolean).join('/');
                                const streetPart = [scanPropAddressCheck.normalizedStreet || parsed.street, nums].filter(Boolean).join(' ');
                                const cityPart = [scanPropAddressCheck.normalizedPostalCode || parsed.postalCode, scanPropAddressCheck.normalizedMunicipality].filter(Boolean).join(' ');
                                const nextAddr = [streetPart, cityPart].filter(Boolean).join(', ');
                                if (nextAddr) {
                                  setScanNewPropForm(prev => ({ ...prev, address: nextAddr }));
                                  showToast('Adresa ubytování doplněna podle OpenStreetMap.', 'success');
                                }
                              }}
                              className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-100 rounded-lg font-semibold cursor-pointer whitespace-nowrap"
                            >
                              Použít z OSM
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-semibold">IDUB ubytovacího zařízení:</label>
                      <input
                        type="text"
                        value={scanNewPropForm.idub}
                        onChange={e => setScanNewPropForm(prev => ({ ...prev, idub: e.target.value }))}
                        placeholder="CZ1234567890"
                        className="w-full min-h-[40px] bg-slate-800 border border-slate-700 text-white font-mono rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1 uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-semibold">Zkratka (5 znaků):</label>
                      <input
                        type="text"
                        maxLength={5}
                        value={scanNewPropForm.facilityCode}
                        onChange={e => setScanNewPropForm(prev => ({ ...prev, facilityCode: e.target.value }))}
                        placeholder="HOTEL"
                        className="w-full min-h-[40px] bg-slate-800 border border-slate-700 text-white font-mono rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1 uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* List of scanned guests with live Name Existence & OSM Address verification */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-slate-300">
                  Rozpoznaní hosté a kontrola OCR:
                </label>
                <span className="text-[10px] text-slate-400">
                  Jména + OpenStreetMap adresy
                </span>
              </div>
              <div className="space-y-2.5 max-h-80 overflow-y-auto no-scrollbar">
                {pendingScanData.guests.map((g: any, idx: number) => {
                  const nat = normalizeCountryCode(g.nationality);
                  const isCzech = isCzechCitizen(nat);
                  const nameVer = verifyGuestNameOcr(g.firstName || '', g.lastName || '', g.nameCheck);
                  const addrVer = scanGuestAddressChecks[idx];

                  return (
                    <div key={idx} className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-2">
                      {/* Editovatelné jméno a příjmení */}
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-5">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Příjmení</label>
                          <input
                            type="text"
                            value={g.lastName || ''}
                            onChange={e => updatePendingScanGuest(idx, { lastName: e.target.value })}
                            className="w-full min-h-[38px] bg-slate-900 border border-slate-700 text-white font-bold rounded-lg px-2.5 py-1 text-xs uppercase outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Jméno</label>
                          <input
                            type="text"
                            value={g.firstName || ''}
                            onChange={e => updatePendingScanGuest(idx, { firstName: e.target.value })}
                            className="w-full min-h-[38px] bg-slate-900 border border-slate-700 text-white font-bold rounded-lg px-2.5 py-1 text-xs uppercase outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2 text-right pb-2 font-mono font-bold text-blue-300">
                          {nat || '?'}
                        </div>
                      </div>

                      {/* Výsledek kontroly existence jména & příjmení */}
                      {(nameVer.lastName.status !== 'verified' || nameVer.firstName.status !== 'verified') ? (
                        <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/35 text-amber-200 text-[11px] space-y-1.5">
                          {nameVer.lastName.status !== 'verified' && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{nameVer.lastName.message}</span>
                              </span>
                              {nameVer.lastName.suggestion && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePendingScanGuest(idx, {
                                      lastName: nameVer.lastName.suggestion,
                                      nameCheck: {
                                        ...(g.nameCheck || {}),
                                        lastNameValid: true,
                                        suggestedLastName: undefined,
                                        reason: undefined
                                      }
                                    })
                                  }
                                  className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-100 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                                >
                                  Použít {nameVer.lastName.suggestion}
                                </button>
                              )}
                            </div>
                          )}
                          {nameVer.firstName.status !== 'verified' && (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span>{nameVer.firstName.message}</span>
                              </span>
                              {nameVer.firstName.suggestion && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePendingScanGuest(idx, {
                                      firstName: nameVer.firstName.suggestion,
                                      nameCheck: {
                                        ...(g.nameCheck || {}),
                                        firstNameValid: true,
                                        suggestedFirstName: undefined,
                                        reason: undefined
                                      }
                                    })
                                  }
                                  className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-100 rounded-lg font-bold cursor-pointer whitespace-nowrap"
                                >
                                  Použít {nameVer.firstName.suggestion}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Jméno i příjmení ověřeno (existující tvar).</span>
                        </div>
                      )}

                      {/* Editovatelné bydliště + kontrola v OpenStreetMap */}
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-5">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Ulice bydliště</label>
                          <input
                            type="text"
                            value={g.street || ''}
                            onChange={e => updatePendingScanGuest(idx, { street: e.target.value })}
                            className="w-full min-h-[36px] bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-5">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Město bydliště</label>
                          <input
                            type="text"
                            value={g.city || ''}
                            onChange={e => updatePendingScanGuest(idx, { city: e.target.value })}
                            className="w-full min-h-[36px] bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Stát</label>
                          <input
                            type="text"
                            maxLength={3}
                            value={g.residenceCountry || nat}
                            onChange={e => updatePendingScanGuest(idx, { residenceCountry: normalizeCountryCode(e.target.value) })}
                            className="w-full min-h-[36px] bg-slate-900 border border-slate-700 text-slate-100 font-mono rounded-lg px-2 py-1 text-[11px] uppercase outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {addrVer && addrVer.status !== 'idle' && (
                        <div
                          className={`p-2 rounded-xl border text-[11px] space-y-1.5 ${
                            addrVer.status === 'verified'
                              ? 'bg-emerald-950/35 border-emerald-500/30 text-emerald-200'
                              : addrVer.status === 'checking'
                                ? 'bg-slate-900 border-slate-800 text-slate-400'
                                : 'bg-amber-950/40 border-amber-500/35 text-amber-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {addrVer.status === 'checking' ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-blue-400" />
                              ) : addrVer.status === 'verified' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                              ) : (
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              )}
                              <span className="leading-snug">{addrVer.message}</span>
                            </span>
                            {addrVer.status !== 'checking' && (
                              <button
                                type="button"
                                onClick={() => reverifyPendingGuestAddress(idx)}
                                className="text-sky-300 hover:underline font-semibold whitespace-nowrap cursor-pointer"
                              >
                                Ověřit znovu
                              </button>
                            )}
                          </div>
                          {(addrVer.status === 'verified' || addrVer.status === 'partial') &&
                            (addrVer.normalizedStreet || addrVer.normalizedCity) &&
                            (addrVer.normalizedStreet !== g.street || addrVer.normalizedCity !== g.city) && (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                <span className="text-[10px] text-emerald-300/90">
                                  OSM návrh: {[addrVer.normalizedStreet, addrVer.normalizedCity].filter(Boolean).join(', ')}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updatePendingScanGuest(idx, {
                                      street: addrVer.normalizedStreet || g.street,
                                      city: addrVer.normalizedCity || g.city
                                    });
                                    showToast('Adresa zpřesněna podle OpenStreetMap.', 'success');
                                  }}
                                  className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-100 rounded-lg font-semibold cursor-pointer whitespace-nowrap"
                                >
                                  Použít z OSM
                                </button>
                              </div>
                            )}
                        </div>
                      )}

                      <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-1 font-mono pt-0.5">
                        <span>Narozen: {g.birthDate || 'neuvedeno'}</span>
                        <span>Doklad: {g.documentType || 'PAS'} {g.passportNumber || 'neuveden'}</span>
                      </div>
                      {isCzech && (
                        <p className="text-[10px] text-amber-400">
                          Občan ČR – nepodléhá hlášení do UNL.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsScanConfirmModalOpen(false);
                  setPendingScanData(null);
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmScanGuests}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active"
              >
                Potvrdit a uložit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: UNL IMPORT CONFIRMATION */}
      {isUnlImportModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Importovat hosty z UNL souboru</h3>
                <p className="text-xs text-emerald-400">Nalezeno {unlImportParsedGuests.length} záznamů</p>
              </div>
              <button onClick={() => setIsUnlImportModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {(unlImportDetectedProperty || unlImportDetectedFacility) && (
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Detekovaný záznam A v souboru:</span>
                {unlImportDetectedProperty?.name && (
                  <p className="font-bold text-white">{unlImportDetectedProperty.name}</p>
                )}
                <p className="font-mono text-emerald-400 font-bold">
                  IDUB: {unlImportDetectedProperty?.idub || unlImportDetectedFacility?.idub || '–'} • Zkratka: {unlImportDetectedProperty?.facilityCode || unlImportDetectedFacility?.facilityCode || '–'}
                </p>
                {unlImportDetectedProperty?.address && (
                  <p className="text-[11px] text-slate-400">{unlImportDetectedProperty.address}</p>
                )}
              </div>
            )}

            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {unlImportParsedGuests.map((g, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{g.lastName} {g.firstName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {g.nationality} • Pokoj {g.unit} • {formatDateDDMMYYYY(g.dateArrival)}–{formatDateDDMMYYYY(g.dateDeparture)}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{g.idDocumentType} {g.idDocumentNumber}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlImportModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlImport}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold tap-active"
              >
                Importovat {unlImportParsedGuests.length} hostů
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: WEBCAM CAMERA MODAL */}
      {isWebcamOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-between p-4">
          <div className="w-full flex items-center justify-between max-w-lg z-10">
            <span className="text-sm font-bold text-white">Fotoaparát</span>
            <button onClick={closeWebcam} className="text-white p-2 rounded-full bg-slate-800">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="relative w-full max-w-lg aspect-[3/4] bg-black rounded-3xl overflow-hidden border border-slate-800 flex items-center justify-center">
            <video ref={webcamVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={webcamCanvasRef} className="hidden" />
          </div>

          <div className="w-full max-w-lg flex items-center justify-center py-4 z-10">
            <button
              onClick={captureWebcamPhoto}
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center bg-blue-600 tap-active shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-white" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 6: SETTINGS MODAL */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base">Nastavení aplikace</h3>
              </div>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* ZÁZNAM 1: GOOGLE / GEMINI API KLÍČ */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
                <GeminiKeyCredentialForm
                  idPrefix="settings-keychain"
                  formRef={settingsCredFormRef}
                  accountName={keychainAccountName}
                  onAccountNameChange={setKeychainAccountName}
                  apiKey={userApiKey}
                  onApiKeyChange={setUserApiKey}
                  showApiKey={showApiKey}
                  onToggleShowApiKey={() => setShowApiKey(prev => !prev)}
                  onHideApiKey={() => setShowApiKey(false)}
                  onClearFromRam={handleClearApiKeyFromRam}
                  showStatusHeader={true}
                  showHelpLink={true}
                  headerTitle="Google / Gemini API klíč (1. záznam)"
                  accountLabel="Účet v Klíčence / KeePassu (1 údaj):"
                  accountPlaceholder="UbyExport Google API"
                  defaultAccountFallback="UbyExport Google API"
                  isUnlocked={Boolean(userApiKey.trim())}
                  otherKnownAccountName={fbKeychainAccountName}
                  onCredentialRoutedToOther={(otherAcc, secret) => {
                    applyUnlockedFirebaseKey(secret, otherAcc);
                    handleSheetModeChange('fb');
                  }}
                  submitLabel="Uložit do Klíčenky / RAM"
                  onToast={showToast}
                  onSubmitKey={async (trimmedKey, trimmedAccount) => {
                    applyUnlockedGeminiKey(trimmedKey, trimmedAccount, false);
                    if (closeSettingsAfterSubmitRef.current) {
                      closeSettingsAfterSubmitRef.current = false;
                      await saveNonSecretSettingsPrefs();
                    }
                  }}
                />

                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  V poli účtu je jen 1 čistý název. Klíče se <strong className="text-slate-200">neukládají do prohlížeče ani Sheetu</strong> – ostatní nešifrovaná nastavení si zkopírujte přes Poznámku níže.
                </p>
              </div>

              {/* SJEDNOCENÉ NAPOJENÍ GOOGLE SHEETU (1 TYP) + POZNÁMKA BEZ HESEL */}
              <SheetAndNoteConfigSection
                idPrefix="settings-sheet"
                sheetMode={activeSheetMode}
                onSheetModeChange={handleSheetModeChange}
                sheetUrlInput={publicSheetInput}
                onSheetUrlInputChange={handleSheetUrlConfigChange}
                oauthClientIdInput={customOAuthClientId}
                onOAuthClientIdInputChange={handleOAuthClientIdConfigChange}
                firebaseProjectIdInput={firebaseProjectIdInput}
                onFirebaseProjectIdInputChange={handleFirebaseProjectIdConfigChange}
                firebaseSeparateKey={firebaseSeparateKey}
                onFirebaseSeparateKeyChange={handleFirebaseSeparateKeyChange}
                apiAccountName={keychainAccountName}
                fbAccountName={fbKeychainAccountName}
                onFbAccountNameChange={setFbKeychainAccountName}
                firebaseApiKeyInput={firebaseApiKeyInput}
                onFirebaseApiKeyInputChange={setFirebaseApiKeyInput}
                geminiApiKeyInRam={userApiKey}
                onUnlockFirebaseKey={applyUnlockedFirebaseKey}
                onClearFirebaseKey={handleClearFirebaseKeyFromRam}
                onRouteToGeminiKey={(acc, secret) => {
                  applyUnlockedGeminiKey(secret, acc, false);
                }}
                activeModelName={activeModelName}
                onApplyParsedNote={handleApplyParsedNote}
                onLoadPublicSheet={() => handleLoadFromPublicSheet()}
                isLoadingPublicSheet={isLoadingPublicSheet}
                onLoginOAuth={() => handleGoogleLogin('gis')}
                onLoginFirebase={() => handleGoogleLogin('firebase')}
                onOpenSheetsModal={() => {
                  setIsSettingsModalOpen(false);
                  setSheetsModalTab(activeSheetMode === 'pub' ? 'link' : 'oauth');
                  setIsSheetsModalOpen(true);
                }}
                isSignedIn={Boolean(currentUser)}
                signedInEmail={currentUser?.email}
                connectedSheetTitle={connectedSheet?.title}
                onToast={showToast}
              />

              {/* AKTIVNÍ MODEL OCR */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Aktivní model OCR
                </label>
                <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-xl p-2.5">
                  <span className="font-mono text-blue-400 font-bold">{activeModelName}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsModalOpen(false);
                      openModelSelector();
                    }}
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-650 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                  >
                    Změnit model
                  </button>
                </div>
              </div>

              {/* POKROČILÁ NÁPOVĚDA K DOMÉNÁM */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-1">
                <button
                  type="button"
                  onClick={() => {
                    setDomainModalType('gis');
                    setIsSettingsModalOpen(false);
                    setIsDomainModalOpen(true);
                  }}
                  className="text-blue-400 hover:underline font-semibold cursor-pointer"
                >
                  Nápověda k OAuth2 původu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDomainModalType('firebase');
                    setIsSettingsModalOpen(false);
                    setIsDomainModalOpen(true);
                  }}
                  className="text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Autorizované domény Firebase
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1 min-h-[44px] py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active cursor-pointer"
                >
                  Zavřít
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettingsPrefsClick}
                  className="flex-1 min-h-[44px] py-2.5 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold tap-active cursor-pointer whitespace-nowrap"
                >
                  Uložit předvolby
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: MODEL SELECTOR */}
      {isModelSelectorOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto no-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Výběr modelu Gemini OCR</h3>
                <p className="text-[11px] text-slate-400">Seznam dostupných modelů vrácených z Google API</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => refreshModelsList()}
                  disabled={isLoadingModels}
                  className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 tap-active disabled:opacity-50"
                  title="Znovu načíst modely z Google API"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin text-blue-400' : ''}`} />
                </button>
                <button onClick={() => setIsModelSelectorOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* SEARCH MODELS */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={modelSearchQuery}
                onChange={e => setModelSearchQuery(e.target.value)}
                placeholder="Filtrovat modely (např. flash, pro)..."
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* LOADING / ERROR STATES */}
            {isLoadingModels && (
              <div className="py-6 text-center space-y-2">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin mx-auto" />
                <p className="text-xs text-slate-400">Dotazuji Google API na dostupné modely...</p>
              </div>
            )}

            {modelsError && !isLoadingModels && (
              <div className="p-3 rounded-2xl bg-amber-950/40 border border-amber-600/40 text-amber-200 text-xs flex items-center justify-between">
                <span>{modelsError}</span>
                <button
                  onClick={() => refreshModelsList()}
                  className="px-2 py-1 bg-amber-600 text-white rounded-lg font-bold tap-active text-[11px] shrink-0 ml-2"
                >
                  Zkusit znovu
                </button>
              </div>
            )}

            {/* MODELS LIST */}
            {!isLoadingModels && (
              <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
                {availableModels
                  .filter(m => {
                    if (!modelSearchQuery.trim()) return true;
                    const q = modelSearchQuery.toLowerCase();
                    return (
                      m.name.toLowerCase().includes(q) ||
                      (m.displayName || '').toLowerCase().includes(q) ||
                      (m.description || '').toLowerCase().includes(q)
                    );
                  })
                  .map(m => (
                    <div
                      key={m.name}
                      onClick={() => selectModel(m.name)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        m.name === activeModelName
                          ? 'bg-blue-950/50 border-blue-500 text-white ring-1 ring-blue-500/30'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">{m.displayName || m.name}</span>
                          {m.isRecommended && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-400 shrink-0">
                              Doporučeno
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{m.name}</p>
                        {m.description && <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{m.description}</p>}
                      </div>
                      {m.name === activeModelName && <Check className="w-5 h-5 text-blue-400 shrink-0" />}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 8: KEYCHAIN / KEEPASS API KEY & CONFIG UNLOCK (RAM-ONLY) */}
      {isMissingKeyModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-white text-base">Odemknout klíče &amp; konfiguraci</h3>
                  <p className="text-[11px] text-slate-400">
                    Pouze v RAM · iOS Klíčenka (Face ID) / KeePass
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMissingKeyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              V repozitáři nejsou uloženy žádné klíče. Odemkněte svůj klíč z <strong className="text-white">Klíčenky přes Face ID</strong> (iPhone / Mac) nebo z <strong className="text-white">KeePassu</strong> na PC. Po zavření stránky se klíč z paměti vymaže.
            </p>

            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
              <GeminiKeyCredentialForm
                idPrefix="unlock-keychain"
                accountName={keychainAccountName}
                onAccountNameChange={setKeychainAccountName}
                apiKey={userApiKey}
                onApiKeyChange={setUserApiKey}
                showApiKey={showApiKey}
                onToggleShowApiKey={() => setShowApiKey(prev => !prev)}
                onHideApiKey={() => setShowApiKey(false)}
                onClearFromRam={handleClearApiKeyFromRam}
                showStatusHeader={true}
                showHelpLink={true}
                headerTitle="Google / Gemini API klíč (1. záznam)"
                accountLabel="Účet v Klíčence / KeePassu (1 údaj):"
                accountPlaceholder="UbyExport Google API"
                defaultAccountFallback="UbyExport Google API"
                isUnlocked={Boolean(userApiKey.trim())}
                otherKnownAccountName={fbKeychainAccountName}
                onCredentialRoutedToOther={(otherAcc, secret) => {
                  applyUnlockedFirebaseKey(secret, otherAcc);
                  handleSheetModeChange('fb');
                }}
                submitLabel="Odemknout do RAM"
                cancelLabel="Zrušit"
                onCancel={() => setIsMissingKeyModalOpen(false)}
                onToast={showToast}
                onSubmitKey={(trimmedKey, trimmedAccount) => {
                  applyUnlockedGeminiKey(trimmedKey, trimmedAccount, true);
                }}
              />
            </div>

            {/* Rozbalovací sekce: Napojení Google Sheetu (1 typ) + Firebase 2. záznam + Poznámka bez hesel */}
            <div className="border-t border-slate-800 pt-3 space-y-3">
              <button
                type="button"
                onClick={() => setIsUnlockExtraExpanded(prev => !prev)}
                className="w-full min-h-[42px] px-3 py-2 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-semibold text-slate-200 flex items-center justify-between gap-2 cursor-pointer"
              >
                <span className="truncate">
                  {isUnlockExtraExpanded
                    ? 'Skrýt nastavení Google Sheetu a poznámku'
                    : `Google Sheet (${activeSheetMode === 'pub' ? 'Veřejný odkaz' : activeSheetMode === 'oauth' ? 'OAuth2' : 'Firebase'}) & Poznámka`}
                </span>
                <span className="text-[11px] text-sky-400 shrink-0">
                  {isUnlockExtraExpanded ? 'Sbalit ▲' : 'Rozbalit ▼'}
                </span>
              </button>

              {isUnlockExtraExpanded && (
                <SheetAndNoteConfigSection
                  idPrefix="unlock-sheet"
                  sheetMode={activeSheetMode}
                  onSheetModeChange={handleSheetModeChange}
                  sheetUrlInput={publicSheetInput}
                  onSheetUrlInputChange={handleSheetUrlConfigChange}
                  oauthClientIdInput={customOAuthClientId}
                  onOAuthClientIdInputChange={handleOAuthClientIdConfigChange}
                  firebaseProjectIdInput={firebaseProjectIdInput}
                  onFirebaseProjectIdInputChange={handleFirebaseProjectIdConfigChange}
                  firebaseSeparateKey={firebaseSeparateKey}
                  onFirebaseSeparateKeyChange={handleFirebaseSeparateKeyChange}
                  apiAccountName={keychainAccountName}
                  fbAccountName={fbKeychainAccountName}
                  onFbAccountNameChange={setFbKeychainAccountName}
                  firebaseApiKeyInput={firebaseApiKeyInput}
                  onFirebaseApiKeyInputChange={setFirebaseApiKeyInput}
                  geminiApiKeyInRam={userApiKey}
                  onUnlockFirebaseKey={applyUnlockedFirebaseKey}
                  onClearFirebaseKey={handleClearFirebaseKeyFromRam}
                  onRouteToGeminiKey={(acc, secret) => {
                    applyUnlockedGeminiKey(secret, acc, false);
                  }}
                  activeModelName={activeModelName}
                  onApplyParsedNote={handleApplyParsedNote}
                  onLoadPublicSheet={() => handleLoadFromPublicSheet()}
                  isLoadingPublicSheet={isLoadingPublicSheet}
                  onLoginOAuth={() => handleGoogleLogin('gis')}
                  onLoginFirebase={() => handleGoogleLogin('firebase')}
                  onOpenSheetsModal={() => {
                    setIsMissingKeyModalOpen(false);
                    setSheetsModalTab(activeSheetMode === 'pub' ? 'link' : 'oauth');
                    setIsSheetsModalOpen(true);
                  }}
                  isSignedIn={Boolean(currentUser)}
                  signedInEmail={currentUser?.email}
                  connectedSheetTitle={connectedSheet?.title}
                  onToast={showToast}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: DOMAIN AUTHORIZATION MODAL (FIREBASE AUTH & GOOGLE OAUTH) */}
      {isDomainModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 text-xs shadow-2xl my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base">
                    {domainModalType === 'firebase'
                      ? 'Povolení domény ve Firebase Authentication'
                      : 'Autorizace Google OAuth (Chyba 400: origin_mismatch)'}
                  </h3>
                  <p className="text-[11px] text-amber-300/90 font-mono">
                    {domainModalType === 'firebase'
                      ? 'auth/unauthorized-domain'
                      : 'Nepovolený zdroj JavaScriptu v Google Cloud'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDomainModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 tap-active shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanation & Copy Box */}
            {domainModalType === 'firebase' ? (
              <div className="space-y-3">
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Firebase Authentication vyžaduje, aby každá webová doména, ze které se uživatelé přihlašují, byla zapsána v seznamu <strong className="text-white">Autorizovaných domén</strong> vašeho Firebase projektu{getFirebaseProjectId() ? <> (<code className="text-sky-300 font-mono font-bold">{getFirebaseProjectId()}</code>)</> : null}.
                </p>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Vaše doména pro vložení do Firebase Console:
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-2 font-mono text-xs text-sky-300 break-all select-all">
                    <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="flex-1 font-bold">
                      {typeof window !== 'undefined' ? window.location.hostname : 'leoclxen.github.io'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const h = typeof window !== 'undefined' ? window.location.hostname : 'leoclxen.github.io';
                        navigator.clipboard.writeText(h);
                        showToast('Doména zkopírována do schránky!', 'success');
                      }}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold shrink-0 tap-active flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Kopírovat</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <p className="font-bold text-white text-xs">Postup povolení (zabere 1 minutu):</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-400">
                    <li>Klikněte níže na tlačítko <strong className="text-amber-400">Přejít do Firebase Console</strong>.</li>
                    <li>V záložce <strong className="text-white">Nastavení (Settings)</strong> sjeďte dolů k <strong className="text-white">Autorizované domény</strong>.</li>
                    <li>Klikněte na <em>Přidat doménu</em> a vložte zkopírovanou doménu <code className="text-sky-300">{typeof window !== 'undefined' ? window.location.hostname : 'leoclxen.github.io'}</code>.</li>
                    <li>Klikněte na <strong>Přidat</strong>. Změna se projeví okamžitě.</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Google OAuth 2.0 (GIS) vyžaduje vlastní <strong className="text-white">Web OAuth Client ID</strong> (z bezpečnostních důvodů není žádné ID v kódu) a povolený původ webu (<strong className="text-white">Origin</strong>) v Google Cloud Console v sekci <strong className="text-white">Autorizované zdroje JavaScriptu</strong>.
                </p>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    Původ webu (Origin) pro vložení do Google Cloud (bez lomítka na konci):
                  </label>
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-2 font-mono text-xs text-sky-300 break-all select-all">
                    <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="flex-1 font-bold">
                      {typeof window !== 'undefined' ? window.location.origin : 'https://leoclxen.github.io'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://leoclxen.github.io';
                        navigator.clipboard.writeText(origin);
                        showToast('Původ zkopírován do schránky!', 'success');
                      }}
                      className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[10px] font-bold shrink-0 tap-active flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Kopírovat</span>
                    </button>
                  </div>
                </div>

                {/* Vlastní OAuth Client ID editor (pouze RAM) */}
                <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">
                      Vlastní Web OAuth 2.0 Client ID (pouze v RAM)
                    </label>
                    {isUsingCustomOAuthClientId() && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomOAuthClientId('');
                          setCustomOAuthClientIdState('');
                          showToast('OAuth Client ID vymazáno z RAM.', 'info');
                        }}
                        className="text-[10px] text-amber-400 hover:underline font-semibold cursor-pointer"
                      >
                        Vymazat
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customOAuthClientId}
                      onChange={(e) => setCustomOAuthClientIdState(e.target.value)}
                      placeholder="123456789-xxxx.apps.googleusercontent.com"
                      className="flex-1 min-h-[40px] bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-xl px-2.5 py-1.5 text-[11px] text-white font-mono placeholder:text-slate-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = customOAuthClientId.trim();
                        if (val && !isValidOAuthClientId(val)) {
                          showToast('Neplatný formát Client ID. Musí končit na .apps.googleusercontent.com', 'warning');
                          return;
                        }
                        try {
                          setCustomOAuthClientId(val);
                          setCustomOAuthClientIdState(val);
                          showToast(val ? 'OAuth Client ID nastaveno v RAM!' : 'OAuth Client ID vymazáno.', 'success');
                        } catch (err: any) {
                          showToast(err.message, 'warning');
                        }
                      }}
                      className="min-h-[40px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold tap-active shrink-0 cursor-pointer"
                    >
                      Použít v RAM
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-snug">
                    Aktivní ID:{' '}
                    <code className="text-sky-300 font-mono break-all">
                      {getActiveOAuthClientId() || 'nezadáno'}
                    </code>
                  </p>
                </div>

                <div className="space-y-1.5 text-[11px] text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <p className="font-bold text-white text-xs">Postup povolení v Google Cloud Console:</p>
                  <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-400">
                    <li>Vytvořte nebo rozklikněte klienta typu <strong className="text-white">Webová aplikace</strong> v <strong className="text-white">Identifikátory klientů OAuth 2.0</strong>.</li>
                    <li>Do sekce <strong className="text-white">Autorizované zdroje JavaScriptu</strong> přidejte zkopírovanou adresu výše (bez lomítka na konci).</li>
                    <li>Pokud je aplikace v režimu <em>Testování</em>, přidejte svůj e-mail v sekci <strong>Obrazovka souhlasu OAuth &rarr; Testovací uživatelé</strong>.</li>
                    <li>Uložte změny a vložte Client ID výše (Google změnu propíše během 1–3 minut).</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Offline note */}
            <div className="p-2.5 rounded-xl bg-blue-950/30 border border-blue-500/20 text-blue-300 text-[11px] flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p>
                <strong>Tip:</strong> Nejjednodušší práce s Google Sheets bez jakéhokoliv nastavení Google Cloud či Firebase je přes <strong>Veřejný odkaz &amp; Excel/CSV export</strong> v menu <em>Sheets / Excel</em>.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setIsDomainModalOpen(false)}
                className="min-h-[44px] py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active text-xs cursor-pointer"
              >
                Zavřít
              </button>
              {domainModalType === 'firebase' ? (
                <a
                  href={getFirebaseAuthSettingsUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-h-[44px] py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 tap-active text-xs cursor-pointer shadow-lg shadow-amber-600/30"
                >
                  <span>Přejít do Firebase Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <>
                  <a
                    href={getGoogleCloudCredentialsUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-h-[44px] py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 tap-active text-xs cursor-pointer"
                  >
                    <span>Google Cloud Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDomainModalOpen(false);
                      handleGoogleLogin('gis');
                    }}
                    className="flex-1 min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active text-xs cursor-pointer shadow-lg shadow-blue-600/30"
                  >
                    Zkusit OAuth2 znovu
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 10: MANUAL FIREBASE CONFIGURATION (RAM-ONLY FALLBACK) */}
      {isFirebaseKeyModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-4 sm:p-5 space-y-4 text-xs shadow-2xl my-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base">
                    Volitelné Firebase přihlášení (pouze RAM)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Z repozitáře byly všechny klíče odstraněny
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFirebaseKeyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 tap-active shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-slate-300 leading-relaxed text-[11px]">
              <p>
                Chcete-li použít volitelný záložní režim přes <strong className="text-white">Firebase Authentication</strong>, zadejte svůj <strong>Project ID</strong> a <strong>Web API klíč</strong>. Údaje zůstávají jen v RAM (pro uložení použijte Klíčenku nebo KeePass).
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 font-semibold block">Kde údaje naleznete:</span>
                <p className="text-slate-300">
                  Ve Firebase Console v <em>Nastavení projektu</em> &rarr; záložka <em>Obecné</em> &rarr; <strong>ID projektu</strong> a <strong>Webový klíč rozhraní API</strong>.
                </p>
                <a
                  href={getFirebaseGeneralSettingsUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-400 hover:underline flex items-center gap-1 font-semibold pt-1"
                >
                  <span>Otevřít Nastavení projektu ve Firebase Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="fb-modal-project-id" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Firebase Project ID (ne-tajné ID projektu):
                </label>
                <input
                  id="fb-modal-project-id"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={firebaseProjectIdInput}
                  onChange={(e) => handleFirebaseProjectIdConfigChange(e.target.value)}
                  placeholder="např. muj-ubyport-projekt"
                  className="w-full min-h-[44px] bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-base sm:text-xs text-white font-mono placeholder:text-slate-600 outline-none"
                />
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
                <GeminiKeyCredentialForm
                  idPrefix="fb-modal-keychain"
                  accountName={fbKeychainAccountName}
                  onAccountNameChange={setFbKeychainAccountName}
                  apiKey={firebaseApiKeyInput}
                  onApiKeyChange={setFirebaseApiKeyInput}
                  showApiKey={showApiKey}
                  onToggleShowApiKey={() => setShowApiKey(prev => !prev)}
                  onHideApiKey={() => setShowApiKey(false)}
                  onClearFromRam={handleClearFirebaseKeyFromRam}
                  showStatusHeader={true}
                  showHelpLink={false}
                  headerTitle="Firebase Web API klíč (2. záznam)"
                  accountLabel="Účet Firebase v Klíčence / KeePassu (1 údaj):"
                  accountPlaceholder="UbyExport Firebase"
                  defaultAccountFallback="UbyExport Firebase"
                  fieldLabel="Firebase Web API klíč (heslo / secret):"
                  secretPlaceholder="AIzaSy..."
                  iconAccentClass="text-amber-400"
                  isUnlocked={Boolean(firebaseApiKeyInput.trim())}
                  otherKnownAccountName={keychainAccountName}
                  onCredentialRoutedToOther={(acc, secret) => {
                    applyUnlockedGeminiKey(secret, acc, false);
                  }}
                  submitLabel="Použít v RAM a přihlásit Firebase"
                  cancelLabel="Zrušit"
                  onCancel={() => setIsFirebaseKeyModalOpen(false)}
                  onToast={showToast}
                  onSubmitKey={(trimmedKey, trimmedAccount) => {
                    if (!firebaseProjectIdInput.trim()) {
                      showToast('Zadejte prosím také Firebase Project ID.', 'warning');
                      return;
                    }
                    applyUnlockedFirebaseKey(trimmedKey, trimmedAccount);
                    setIsFirebaseKeyModalOpen(false);
                    handleGoogleLogin('firebase');
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsFirebaseKeyModalOpen(false);
                    setDomainModalType('gis');
                    setIsDomainModalOpen(true);
                  }}
                  className="py-2 px-2.5 text-sky-400 hover:underline text-[11px] font-semibold cursor-pointer"
                >
                  OAuth Client ID
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFirebaseKeyModalOpen(false);
                    setAuthMethodChoice('gis');
                    handleGoogleLogin('gis');
                  }}
                  className="min-h-[40px] py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold tap-active cursor-pointer"
                >
                  Přímé OAuth2 (GIS)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 11: UNIFIED GOOGLE SHEETS LINK & EXPORT MODAL (+ OPTIONAL OAUTH FALLBACK) */}
      {isSheetsModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-4 sm:p-5 space-y-4 text-xs shadow-2xl my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base">
                    Google Sheets &amp; Excel
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Načítání přes odkaz a okamžitý export bez Google Cloud či Firebase
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 tap-active shrink-0 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSheetsModalTab('link')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  sheetsModalTab === 'link'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Odkaz &amp; Export (Bez cloudu)
              </button>
              <button
                type="button"
                onClick={() => setSheetsModalTab('oauth')}
                className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  sheetsModalTab === 'oauth'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Firebase / OAuth2 (Záloha)
              </button>
            </div>

            {sheetsModalTab === 'link' ? (
              <div className="space-y-4">
                {/* 1. Load from Public Google Sheet Link */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-white">
                      1. Načíst data z odkazu na Google Sheet
                    </label>
                    {publicSheetUrl && (
                      <a
                        href={publicSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-semibold whitespace-nowrap shrink-0"
                      >
                        <span>Otevřít sešit</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    V Google Sheets klikněte na <strong className="text-slate-200">Sdílet → Kdokoliv s odkazem (Čtenář)</strong> a vložte odkaz níže. Aplikace načte listy <code>Ubytovani</code> a <code>Hoste</code> bez přihlašování (API klíče se v sešitu nikdy neukládají).
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={publicSheetInput}
                      onChange={e => {
                        setPublicSheetInput(e.target.value);
                        if (publicSheetError) setPublicSheetError(null);
                      }}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="flex-1 min-h-[44px] bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder:text-slate-600 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleLoadFromPublicSheet()}
                      disabled={isLoadingPublicSheet}
                      className="min-h-[44px] px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 tap-active cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {isLoadingPublicSheet ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>{publicSheetUrl ? 'Obnovit / Načíst' : 'Načíst ze Sheetu'}</span>
                    </button>
                  </div>

                  {publicSheetError && (
                    <div className="p-3 rounded-2xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span>{publicSheetError}</span>
                    </div>
                  )}

                  {publicSheetUrl && (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 pt-0.5">
                      <span>
                        Naposledy načteno:{' '}
                        <strong className="text-slate-200 tabular-nums">
                          {publicSheetLastSync
                            ? new Date(publicSheetLastSync).toLocaleString('cs-CZ')
                            : 'uloženo'}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleDisconnectPublicSheet}
                        className="text-rose-400 hover:underline font-semibold cursor-pointer"
                      >
                        Odpojit odkaz
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-3.5 space-y-2.5">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      2. Uložit data do Excelu nebo Google Sheets (1 kliknutím)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Stáhněte kompletní sešit nebo zkopírujte tabulku a vložte ji přímo do buňky <code>A1</code> v Google Sheets.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadExcelWorkbook}
                      className="min-h-[44px] px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 tap-active cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Stáhnout Excel (.xlsx · 3 listy)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopySheetsTsv('guests')}
                      className="min-h-[44px] px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 tap-active cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Kopírovat hosty pro Sheets</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadCsv('guests')}
                      className="min-h-[44px] px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tap-active cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>CSV Hosté ({guests.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCsv('properties')}
                      className="min-h-[44px] px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 tap-active cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>CSV Ubytování ({properties.length})</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Tab 2: Optional Firebase / OAuth2 Fallback */
              <div className="space-y-3">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Volitelná přímá synchronizace přes Google účet pro automatický obousměrný zápis (vyžaduje konfiguraci Firebase nebo OAuth2 Client ID).
                </p>

                {currentUser ? (
                  <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-white text-xs">{currentUser.displayName || 'Přihlášený účet'}</p>
                        <p className="text-[11px] text-slate-400">{currentUser.email}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleGoogleLogout}
                        className="min-h-[40px] px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold tap-active cursor-pointer"
                      >
                        Odhlásit
                      </button>
                    </div>
                    {connectedSheet && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href={connectedSheet.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 tap-active"
                        >
                          <span>Otevřít {connectedSheet.title}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => triggerSheetSync()}
                          disabled={isSyncingSheet}
                          className="min-h-[44px] px-3 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 tap-active cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                          <span>Synchronizovat</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSheetsModalOpen(false);
                        handleGoogleLogin('firebase');
                      }}
                      className="min-h-[44px] py-2.5 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold tap-active cursor-pointer"
                    >
                      Přihlásit přes Firebase
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSheetsModalOpen(false);
                        handleGoogleLogin('gis');
                      }}
                      className="min-h-[44px] py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tap-active cursor-pointer"
                    >
                      Přímé OAuth2 (GIS)
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetsModalOpen(false);
                      setIsFirebaseKeyModalOpen(true);
                    }}
                    className="text-sky-400 hover:underline font-semibold cursor-pointer py-1"
                  >
                    Firebase Web API klíč
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetsModalOpen(false);
                      setDomainModalType('gis');
                      setIsDomainModalOpen(true);
                    }}
                    className="text-blue-400 hover:underline font-semibold cursor-pointer py-1"
                  >
                    OAuth2 Client ID &amp; Původ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSheetsModalOpen(false);
                      setDomainModalType('firebase');
                      setIsDomainModalOpen(true);
                    }}
                    className="text-amber-400 hover:underline font-semibold cursor-pointer py-1"
                  >
                    Autorizované domény
                  </button>
                </div>
              </div>
            )}

            <div className="pt-1 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsSheetsModalOpen(false)}
                className="min-h-[44px] px-5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active text-xs cursor-pointer"
              >
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 12: SEQUENTIAL IMPORT CONFLICT RESOLUTION (.xlsx / .csv) */}
      {pendingImportSession &&
        pendingImportSession.conflicts[pendingImportSession.currentIndex] && (
          <ImportConflictModal
            conflict={pendingImportSession.conflicts[pendingImportSession.currentIndex]}
            currentIndex={pendingImportSession.currentIndex}
            totalCount={pendingImportSession.conflicts.length}
            selectedChoice={pendingImportSession.currentChoice}
            onSelectChoice={choice =>
              setPendingImportSession(prev => (prev ? { ...prev, currentChoice: choice } : null))
            }
            onConfirmStep={handleConfirmImportConflictStep}
            onCancel={() => {
              setPendingImportSession(null);
              showToast('Import byl zrušen bez změny dat.', 'info');
            }}
          />
        )}
    </div>
  );
}
