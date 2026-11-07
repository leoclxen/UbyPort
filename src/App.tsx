import React, { useState, useEffect, useRef } from 'react';
import * as jsyaml from 'js-yaml';
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
  Globe
} from 'lucide-react';
import { Property, Guest, PRAGUE_DISTRICTS } from './types';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  firebaseProjectId,
  firebaseConsoleAuthorizedDomainsUrl
} from './lib/googleAuth';
import {
  findOrCreateAirTaxSpreadsheet,
  loadAllDataFromGoogleSheet,
  syncAllToGoogleSheet,
  saveApiKeyToSheet,
  saveSettingsToSheet,
  saveModelToSheet,
  SpreadsheetInfo
} from './lib/googleSheets';
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
  cleanAsciiUpper,
  formatDateDDMMYYYY,
  parseDateToISO,
  isCzechCitizen,
  parseAddressParts,
  validateGuestForUnl,
  buildUnlFile,
  parseUnlContent,
  downloadUnlFile
} from './lib/ubyport';

export const APP_VERSION = '2.0.0';

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

export default function App() {
  // App State - Zero hardcoded data
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'scan' | 'ledger' | 'export' | 'info'>('scan');
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'foreigners' | 'czech'>('all');

  // OCR & Model State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanStatus, setScanStatus] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeModelName, setActiveModelName] = useState<string>(
    safeStorage.getItem('ubyport_model_pref') || 'gemini-flash-latest'
  );
  const [userApiKey, setUserApiKey] = useState<string>(
    safeStorage.getItem('ubyport_user_api_key') || ''
  );

  // Google Workspace & Sheets State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);
  const [connectedSheet, setConnectedSheet] = useState<SpreadsheetInfo | null>(null);
  const [customSheetId, setCustomSheetId] = useState<string>(
    safeStorage.getItem('ubyport_sheet_id') || ''
  );
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);

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

  // UNL Import Modal State
  const [isUnlImportModalOpen, setIsUnlImportModalOpen] = useState<boolean>(false);
  const [unlImportRawText, setUnlImportRawText] = useState<string>('');
  const [unlImportParsedGuests, setUnlImportParsedGuests] = useState<Guest[]>([]);
  const [unlImportDetectedFacility, setUnlImportDetectedFacility] = useState<{ idub: string; facilityCode: string } | null>(null);

  // Scan Verification / Accommodation Match Modal State
  const [isScanConfirmModalOpen, setIsScanConfirmModalOpen] = useState<boolean>(false);
  const [pendingScanData, setPendingScanData] = useState<{
    detected: any;
    guests: any[];
  } | null>(null);
  const [scanTargetChoice, setScanTargetChoice] = useState<'existing' | 'new'>('existing');
  const [selectedScanPropId, setSelectedScanPropId] = useState<string>('');
  const [scanNewPropForm, setScanNewPropForm] = useState({
    name: '',
    idub: '',
    facilityCode: '',
    hostName: '',
    address: '',
    districtKey: 'praha8',
    variableSymbol: ''
  });

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  // Refs for hidden inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const unlFileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamCanvasRef = useRef<HTMLCanvasElement>(null);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);

  // Property form state
  const [propForm, setPropForm] = useState({
    name: '',
    idub: '',
    facilityCode: '',
    hostName: '',
    address: '',
    districtKey: 'praha8',
    variableSymbol: ''
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
    purposeOfStay: '1',
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
          version: '3.1',
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
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const data = await res.json();
          setProperties(data.properties || []);
          setGuests(data.guests || []);
          setActivePropertyId(data.activePropertyId || (data.properties?.[0]?.id ?? ''));
          loadedFromServer = true;
        }
      } catch {
        // Expected when hosted statically without Node backend
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

  // 2. Initialize Firebase Auth
  useEffect(() => {
    fetchCloudData();
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
    return () => unsubscribe();
  }, []);

  // Connect or load Google Sheet
  const connectOrLoadGoogleSpreadsheet = async (token: string, explicitId?: string) => {
    try {
      setIsGoogleLoading(true);
      const sheetInfo = await findOrCreateAirTaxSpreadsheet(token, explicitId || customSheetId);
      setConnectedSheet(sheetInfo);
      safeStorage.setItem('ubyport_sheet_id', sheetInfo.id);

      const sheetData = await loadAllDataFromGoogleSheet(token, sheetInfo.id);

      if (sheetData.apiKey && sheetData.apiKey.trim().length > 0) {
        setUserApiKey(sheetData.apiKey);
        safeStorage.setItem('ubyport_user_api_key', sheetData.apiKey);
      }
      if (sheetData.preferredModel) {
        setActiveModelName(sheetData.preferredModel);
        safeStorage.setItem('ubyport_model_pref', sheetData.preferredModel);
      }

      if (sheetData.properties && sheetData.properties.length > 0) {
        setProperties(sheetData.properties);
        setGuests(sheetData.guests || []);
        setActivePropertyId(sheetData.properties[0].id);
        persistLocalState(sheetData.properties, sheetData.guests || [], sheetData.properties[0].id);

        try {
          await fetch('/api/import/yaml', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              yamlContent: jsyaml.dump({
                meta: {
                  version: '3.1',
                  lastUpdated: new Date().toISOString(),
                  activePropertyId: sheetData.properties[0].id
                },
                properties: sheetData.properties,
                guests: sheetData.guests || []
              })
            })
          });
        } catch {
          // ignore backend sync error
        }

        const keyMsg = sheetData.apiKey ? ' (včetně Gemini API klíče)' : '';
        showToast(`Načteno z Google Sheetu: ${sheetData.properties.length} ubytování, ${sheetData.guests.length} hostů${keyMsg}!`, 'success');
      } else if (properties.length > 0 || guests.length > 0) {
        await syncAllToGoogleSheet(token, sheetInfo.id, {
          properties,
          guests,
          apiKey: userApiKey,
          preferredModel: activeModelName
        });
        showToast('Data byla úspěšně nahrána do nového Google Sheetu!', 'success');
      }
    } catch (err: any) {
      console.error('Google Sheet connect error:', err);
      showToast(`Chyba připojení k Google Sheetu: ${err.message}`, 'warning');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Google Login / Logout
  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      const res = await googleSignIn();
      if (!res) return;
      setCurrentUser(res.user);
      setGoogleToken(res.accessToken);
      await connectOrLoadGoogleSpreadsheet(res.accessToken);
      showToast('Přihlášeno k účtu Google!', 'success');
    } catch (err: any) {
      console.error('Google Sign-in failed', err);
      if (err.message && (err.message.includes('auth/unauthorized-domain') || err.message.includes('authorized domain'))) {
        setIsDomainModalOpen(true);
      } else {
        showToast(`Přihlášení selhalo: ${err.message}`, 'warning');
      }
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

  // Sync to Sheet helper
  const triggerSheetSync = async (propsToSync?: Property[], guestsToSync?: Guest[]) => {
    if (!googleToken || !connectedSheet) return;
    try {
      setIsSyncingSheet(true);
      await syncAllToGoogleSheet(googleToken, connectedSheet.id, {
        properties: propsToSync || properties,
        guests: guestsToSync || guests,
        apiKey: userApiKey,
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

  // UNL calculation for active property
  const activeUnlResult = activeProperty
    ? buildUnlFile(activeGuests, activeProperty)
    : { content: '', includedCount: 0, excludedCzechCount: 0, invalidCount: 0 };

  // PROPERTY CRUD
  const openNewPropertyModal = () => {
    setPropForm({
      name: '',
      idub: '',
      facilityCode: '',
      hostName: '',
      address: '',
      districtKey: 'praha8',
      variableSymbol: ''
    });
    setEditingPropId(null);
    setPropModalMode('form');
    setIsPropModalOpen(true);
  };

  const openEditPropertyModal = (prop: Property) => {
    setPropForm({
      name: prop.name,
      idub: prop.idub || '',
      facilityCode: prop.facilityCode || '',
      hostName: prop.hostName || '',
      address: prop.address || '',
      districtKey: prop.districtKey || 'praha8',
      variableSymbol: prop.variableSymbol || ''
    });
    setEditingPropId(prop.id);
    setPropModalMode('form');
    setIsPropModalOpen(true);
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propForm.name.trim()) {
      showToast('Vyplňte prosím název ubytování.', 'warning');
      return;
    }

    const cleanIdub = cleanAsciiUpper(propForm.idub).replace(/\s/g, '');
    const cleanFacilityCode = cleanAsciiUpper(propForm.facilityCode).replace(/\s/g, '').substring(0, 5);

    const propId = editingPropId || `prop_${Date.now()}`;
    const newProp: Property = {
      id: propId,
      name: propForm.name.trim(),
      idub: cleanIdub,
      facilityCode: cleanFacilityCode,
      hostName: propForm.hostName.trim(),
      address: propForm.address.trim(),
      districtKey: propForm.districtKey || 'praha8',
      variableSymbol: propForm.variableSymbol.trim()
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

    try {
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProp)
      });
    } catch {
      // server sync error
    }

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

    try {
      await fetch(`/api/properties/${propId}`, { method: 'DELETE' });
    } catch {
      // server delete error
    }

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
      purposeOfStay: '1',
      dateArrival: today,
      dateDeparture: tomorrow,
      nights: 1
    });
    setEditingGuest(null);
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
      purposeOfStay: g.purposeOfStay || '1',
      dateArrival: parseDateToISO(g.dateArrival),
      dateDeparture: parseDateToISO(g.dateDeparture),
      nights: g.nights || 1
    });
    setEditingGuest(g);
    setIsGuestModalOpen(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty) return;

    if (!guestForm.lastName.trim() || !guestForm.firstName.trim()) {
      showToast('Vyplňte prosím jméno a příjmení hosta.', 'warning');
      return;
    }

    const nat = normalizeCountryCode(guestForm.nationality);
    const resC = normalizeCountryCode(guestForm.residenceCountry || nat);
    const issC = normalizeCountryCode(guestForm.documentIssuerCountry || nat);

    const guestId = editingGuest ? editingGuest.id : `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nights = Math.max(1, parseInt(String(guestForm.nights)) || 1);

    const guestRecord: Guest = {
      id: guestId,
      propertyId: activeProperty.id,
      unit: guestForm.unit.trim(),
      airbnbCode: guestForm.airbnbCode.trim().toUpperCase(),
      firstName: cleanAsciiUpper(guestForm.firstName),
      lastName: cleanAsciiUpper(guestForm.lastName),
      fullName: `${cleanAsciiUpper(guestForm.firstName)} ${cleanAsciiUpper(guestForm.lastName)}`.trim(),
      birthDate: guestForm.birthDate,
      nationality: nat,
      residenceCountry: resC,
      city: cleanAsciiUpper(guestForm.city),
      street: cleanAsciiUpper(guestForm.street),
      address: `${cleanAsciiUpper(guestForm.street)} ${cleanAsciiUpper(guestForm.city)}`.trim(),
      idDocumentType: cleanAsciiUpper(guestForm.idDocumentType) === 'OP' ? 'OP' : 'PAS',
      idDocumentNumber: cleanAsciiUpper(guestForm.idDocumentNumber).replace(/\s/g, ''),
      documentIssuerCountry: issC,
      visaNumber: cleanAsciiUpper(guestForm.visaNumber).replace(/\s/g, ''),
      purposeOfStay: guestForm.purposeOfStay || '1',
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

    try {
      await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guestRecord)
      });
    } catch {
      // server save error
    }

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

    try {
      await fetch(`/api/guests/${guestId}`, { method: 'DELETE' });
    } catch {
      // server delete error
    }

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
      const content = event.target?.result as string;
      if (content) {
        processImportedUnlText(content);
      }
    };
    reader.readAsText(file);
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
    setIsUnlImportModalOpen(true);
  };

  const handleConfirmUnlImport = async () => {
    if (unlImportParsedGuests.length === 0) {
      setIsUnlImportModalOpen(false);
      return;
    }

    let targetProp = activeProperty;
    let updatedProps = [...properties];

    // Pokud nemáme ubytování a UNL obsahuje IDUB a zkratku, vytvoříme ho nebo aktualizujeme
    if (unlImportDetectedFacility) {
      if (!targetProp) {
        targetProp = {
          id: `prop_${Date.now()}`,
          name: `Ubytování ${unlImportDetectedFacility.facilityCode}`,
          idub: unlImportDetectedFacility.idub,
          facilityCode: unlImportDetectedFacility.facilityCode,
          hostName: '',
          address: 'Praha'
        };
        updatedProps.push(targetProp);
        setProperties(updatedProps);
        setActivePropertyId(targetProp.id);
      } else if (!targetProp.idub || !targetProp.facilityCode) {
        targetProp = {
          ...targetProp,
          idub: targetProp.idub || unlImportDetectedFacility.idub,
          facilityCode: targetProp.facilityCode || unlImportDetectedFacility.facilityCode
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

    try {
      await fetch('/api/batch-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: targetProp,
          guests: finalGuests
        })
      });
    } catch {
      // server batch error
    }

    triggerSheetSync(updatedProps, mergedGuests);
    setIsUnlImportModalOpen(false);
    showToast(`Úspěšně importováno ${finalGuests.length} hostů z UNL souboru!`, 'success');
    setActiveTab('ledger');
  };

  // UNL EXPORT HANDLERS
  const handleDownloadUnl = () => {
    if (!activeProperty) {
      showToast('Vyberte ubytovací zařízení pro export UNL.', 'warning');
      return;
    }
    const result = buildUnlFile(activeGuests, activeProperty);
    if (!result.content || result.includedCount === 0) {
      showToast('V knize nejsou žádní způsobilí cizinci k exportu.', 'warning');
      return;
    }

    const safeCode = activeProperty.facilityCode || 'UBYPORT';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `${safeCode}_${dateStr}.unl`;

    downloadUnlFile(result.content, filename);
    showToast(`Soubor ${filename} byl stažen (${result.includedCount} cizinců).`, 'success');
  };

  const handleCopyUnlToClipboard = () => {
    if (!activeProperty) return;
    const result = buildUnlFile(activeGuests, activeProperty);
    if (!result.content) {
      showToast('Žádná data k exportu.', 'warning');
      return;
    }
    navigator.clipboard.writeText(result.content);
    showToast(`UNL zkopírován do schránky (${result.includedCount} řádků).`, 'success');
  };

  // OCR SCAN ENGINE
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Pokud uživatel nahrál .unl soubor
    if (file.name.toLowerCase().endsWith('.unl')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) processImportedUnlText(text);
      };
      reader.readAsText(file);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setImagePreview(b64);
      e.target.value = '';
      await processImageWithOcr(b64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
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
        resolve(canvas.toDataURL('image/jpeg', 0.95));
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
    const hasClientKey = Boolean(userApiKey && userApiKey.trim().length > 0);
    const isStaticHost = typeof window !== 'undefined' && (
      window.location.hostname.includes('github.io') ||
      window.location.protocol === 'file:' ||
      (window.location.hostname !== 'localhost' && !window.location.port)
    );

    // Na GitHub Pages (statický hosting) bez zadaného API klíče ihned otevřeme zadání klíče
    if (!hasClientKey && isStaticHost) {
      setIsMissingKeyModalOpen(true);
      showToast('Na GitHub Pages zadejte svůj Gemini API klíč v okně níže.', 'info');
      return;
    }

    setIsScanning(true);
    setScanStatus(`Čtení ubytovacího lístku modelem ${activeModelName}...`);

    try {
      let resultData: any = null;
      let lastClientError: any = null;

      // 1. Zkusíme přímé klientské volání přes Google GenAI SDK
      if (hasClientKey) {
        try {
          const clientRes = await runClientGeminiOcr(
            base64Data,
            userApiKey.trim(),
            activeModelName,
            mimeType
          );
          resultData = clientRes.data;
          setScanStatus(`Úspěšně zpracováno modelem ${clientRes.modelUsed}!`);
        } catch (clientErr: any) {
          console.warn('Klientské volání OCR selhalo:', clientErr);
          lastClientError = clientErr;
        }
      }

      // 2. Fallback na serverové proxy API (pouze pokud nejsme na čistě statickém hostingu jako GitHub Pages)
      if (!resultData && !isStaticHost) {
        try {
          const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64Data,
              mimeType,
              userApiKey: userApiKey || undefined,
              preferredModel: activeModelName
            })
          });

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (!response.ok) {
              if (response.status === 401 || data.error?.includes('API klíč')) {
                setIsMissingKeyModalOpen(true);
                throw new Error(data.error || 'Není zadán Gemini API klíč.');
              }
              throw new Error(data.error || `Chyba OCR serveru (${response.status})`);
            }
            resultData = data.data;
            setScanStatus(`Zpracováno modelem ${data.modelUsed || activeModelName}!`);
          } else {
            // Server vrátil ne-JSON (např. 404 HTML)
            if (response.status === 404) {
              throw new Error('Serverové OCR API není na této doméně dostupné. Zadejte prosím Gemini API klíč v Nastavení pro přímé čtení v prohlížeči.');
            }
            const errText = await response.text();
            throw new Error(`Chyba serveru (${response.status}): ${errText.slice(0, 80)}`);
          }
        } catch (serverErr: any) {
          if (lastClientError) {
            throw lastClientError;
          }
          throw serverErr;
        }
      } else if (!resultData && lastClientError) {
        throw lastClientError;
      }

      if (!resultData) {
        if (!hasClientKey) {
          setIsMissingKeyModalOpen(true);
          throw new Error('Na tomto hostingu je pro OCR skenování vyžadován Gemini API klíč. Zadejte jej prosím v nastavení.');
        }
        throw new Error('Nepodařilo se zpracovat obrázek ubytovacího lístku.');
      }

      if (resultData && Array.isArray(resultData.guests) && resultData.guests.length > 0) {
        setPendingScanData({
          detected: resultData,
          guests: resultData.guests
        });

        const detectedName = resultData.detectedPropertyName || '';
        const detectedAddress = resultData.detectedAddress || '';
        const detectedIdub = resultData.detectedIDUB || '';
        const detectedFacilityCode = resultData.detectedFacilityCode || '';
        const detectedHost = resultData.detectedHostName || '';

        const existingMatch = properties.find(p =>
          detectedName && p.name.toLowerCase().includes(detectedName.toLowerCase())
        );

        if (existingMatch) {
          setSelectedScanPropId(existingMatch.id);
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

        setIsScanConfirmModalOpen(true);
        showToast(`Rozpoznáno ${resultData.guests.length} hostů! Zkontrolujte údaje.`, 'success');
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

  const handleConfirmScanGuests = async () => {
    if (!pendingScanData) return;

    let targetPropId = selectedScanPropId;
    let updatedProps = [...properties];

    if (scanTargetChoice === 'new') {
      const newProp: Property = {
        id: `prop_${Date.now()}`,
        name: scanNewPropForm.name.trim() || 'Nové ubytování',
        idub: cleanAsciiUpper(scanNewPropForm.idub).replace(/\s/g, ''),
        facilityCode: cleanAsciiUpper(scanNewPropForm.facilityCode).replace(/\s/g, '').substring(0, 5),
        hostName: scanNewPropForm.hostName.trim(),
        address: scanNewPropForm.address.trim(),
        districtKey: scanNewPropForm.districtKey || 'praha8',
        variableSymbol: scanNewPropForm.variableSymbol.trim()
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

      return {
        id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        propertyId: targetPropId,
        unit: (unit || g.unit || '1').trim(),
        airbnbCode: '',
        firstName: cleanAsciiUpper(g.firstName),
        lastName: cleanAsciiUpper(g.lastName),
        fullName: `${cleanAsciiUpper(g.firstName)} ${cleanAsciiUpper(g.lastName)}`.trim(),
        birthDate: g.birthDate || '',
        nationality: nat,
        residenceCountry: resC,
        city: cleanAsciiUpper(city),
        street: cleanAsciiUpper(street),
        address: `${cleanAsciiUpper(street)} ${cleanAsciiUpper(city)}`.trim(),
        idDocumentType: cleanAsciiUpper(g.documentType) === 'OP' ? 'OP' : 'PAS',
        idDocumentNumber: cleanAsciiUpper(g.passportNumber || g.idDocumentNumber || '').replace(/\s/g, ''),
        documentIssuerCountry: issC,
        visaNumber: cleanAsciiUpper(g.visaNumber || '').replace(/\s/g, ''),
        purposeOfStay: String(g.purposeOfStay || '1').match(/^\d/)?.[0] || '1',
        dateArrival,
        dateDeparture,
        nights,
        createdAt: new Date().toISOString()
      };
    });

    const updatedGuests = [...newGuests, ...guests];
    setGuests(updatedGuests);
    persistLocalState(updatedProps, updatedGuests, targetPropId);

    try {
      await fetch('/api/batch-guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: parentProp,
          guests: newGuests
        })
      });
    } catch {
      // server batch error
    }

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

  const captureWebcamPhoto = () => {
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
      setImagePreview(b64);
      processImageWithOcr(b64, 'image/jpeg');
    }
  };

  // MODEL SELECTION
  const openModelSelector = async () => {
    setIsModelSelectorOpen(true);
    setModelsError(null);
    if (userApiKey && userApiKey.trim().length > 0) {
      setIsLoadingModels(true);
      try {
        const fetched = await fetchAvailableGeminiModels(userApiKey);
        setAvailableModels(fetched);
      } catch (err: any) {
        setModelsError(err.message || 'Nepodařilo se načíst seznam modelů.');
      } finally {
        setIsLoadingModels(false);
      }
    }
  };

  const selectModel = async (modelName: string) => {
    setActiveModelName(modelName);
    safeStorage.setItem('ubyport_model_pref', modelName);
    setIsModelSelectorOpen(false);
    showToast(`Aktivní model OCR nastaven na: ${modelName}`, 'success');

    if (googleToken && connectedSheet) {
      try {
        await saveModelToSheet(googleToken, connectedSheet.id, modelName);
      } catch {
        // silent sheet save error
      }
    }
  };

  // SAVE SETTINGS MODAL
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    safeStorage.setItem('ubyport_user_api_key', userApiKey.trim());
    safeStorage.setItem('ubyport_model_pref', activeModelName);

    if (googleToken && connectedSheet) {
      try {
        await saveSettingsToSheet(googleToken, connectedSheet.id, userApiKey.trim(), activeModelName);
        await syncAllToGoogleSheet(googleToken, connectedSheet.id, {
          properties,
          guests,
          apiKey: userApiKey.trim(),
          preferredModel: activeModelName
        });
        showToast('Nastavení a Gemini API klíč byly uloženy do Google Sheetu!', 'success');
      } catch (err: any) {
        showToast(`Uloženo lokálně, ale zápis do Sheetu selhal: ${err.message}`, 'warning');
      }
    } else {
      showToast('Nastavení bylo uloženo lokálně.', 'success');
    }

    setIsSettingsModalOpen(false);
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
    <div className="flex flex-col h-screen bg-[#0A0E17] text-slate-100 font-sans select-none overflow-hidden">
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
      <header className="header-sharp bg-[#0D131F]/90 border-b border-slate-800/80 px-4 pb-3 flex items-center justify-between z-30 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-rose-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-extrabold tracking-tight text-white">UbyPort 2.0</h1>
              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Policie ČR
              </span>
            </div>
            <button
              onClick={openModelSelector}
              className="text-[11px] text-slate-400 hover:text-blue-300 font-mono flex items-center gap-1 tap-active mt-0.5 cursor-pointer"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{activeModelName}</span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* PROPERTY PICKER & HEADER CONTROLS */}
        <div className="flex items-center gap-2">
          {/* Ubytování selector */}
          <div className="relative">
            <button
              onClick={() => {
                setPropModalMode('list');
                setIsPropModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white tap-active cursor-pointer max-w-[155px]"
            >
              <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">
                {activeProperty ? activeProperty.name : 'Přidat ubytování'}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          </div>

          {/* Google Sheets button */}
          {currentUser ? (
            <button
              onClick={() => {
                if (connectedSheet) {
                  window.open(connectedSheet.url, '_blank');
                } else {
                  handleGoogleLogin();
                }
              }}
              title={connectedSheet ? `Otevřít: ${connectedSheet.title}` : 'Připojit Google Sheet'}
              className="p-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900 tap-active cursor-pointer relative"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {isSyncingSheet && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              )}
            </button>
          ) : (
            <button
              onClick={handleGoogleLogin}
              title="Přihlásit se k účtu Google pro synchronizaci sešitu"
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white tap-active cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Nastavení tlačítko */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white tap-active cursor-pointer"
            title="Nastavení aplikace a API klíč"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pt-3 pb-24 max-w-2xl mx-auto w-full">

        {/* TAB 1: SCANNER & OCR */}
        {activeTab === 'scan' && (
          <div className="space-y-4">
            {/* Top Property Info Banner with IDUB & Facility code */}
            {activeProperty ? (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-sm">{activeProperty.name}</span>
                    <span className="text-[10px] text-slate-400">({activeProperty.address || 'Praha'})</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className={activeProperty.idub ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
                      IDUB: {activeProperty.idub || 'Chybí IDUB!'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className={activeProperty.facilityCode ? 'text-blue-400' : 'text-amber-400 font-bold'}>
                      Kód: {activeProperty.facilityCode || 'Chybí kód!'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => openEditPropertyModal(activeProperty)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-semibold tap-active"
                >
                  Upravit
                </button>
              </div>
            ) : (
              <div className="bg-amber-950/40 border border-amber-600/40 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Není nastaveno žádné ubytovací zařízení pro UbyPort.</span>
                </div>
                <button
                  onClick={openNewPropertyModal}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold tap-active"
                >
                  Přidat
                </button>
              </div>
            )}

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
                  const reader = new FileReader();
                  reader.onload = () => {
                    const b64 = reader.result as string;
                    setImagePreview(b64);
                    processImageWithOcr(b64, file.type || 'image/jpeg');
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="relative overflow-hidden rounded-3xl border-2 border-dashed border-slate-750 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 flex flex-col items-center justify-center text-center shadow-xl"
            >
              {isScanning && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center p-4">
                  <div className="w-16 h-16 relative flex items-center justify-center mb-3">
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                    <Scan className="w-7 h-7 text-blue-400" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">Zpracovávám formulář...</p>
                  <p className="text-xs text-blue-300 font-mono text-center max-w-xs">{scanStatus}</p>
                </div>
              )}

              {imagePreview && !isScanning ? (
                <div className="space-y-3 w-full max-w-md">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950/90 p-2 min-h-[200px] max-h-[380px] flex items-center justify-center">
                    <img
                      src={imagePreview}
                      alt="Náhled ubytovacího lístku"
                      className="max-h-[360px] max-w-full w-auto h-auto object-contain rounded-xl shadow-lg"
                    />
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
                        onClick={() => setImagePreview(null)}
                        title="Zavřít náhled"
                        className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white tap-active border border-slate-700/80 shadow-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleRotateImage}
                      className="py-2.5 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold tap-active flex items-center justify-center gap-1.5"
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
                      <span>Spustit skenování</span>
                    </button>
                  </div>
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
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Cizinci v knize</span>
                <p className="text-xl font-black text-white mt-0.5">{activeGuests.length}</p>
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

        {/* TAB 3: EXPORT UNL (REPLACES ODVOD QR) */}
        {activeTab === 'export' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-slate-800 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                    UbyPort 2.0 • Policie ČR
                  </span>
                  <h2 className="text-base font-bold text-white">Export UNL souboru</h2>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">K hlášení</span>
                  <p className="text-xl font-black text-emerald-400">{activeUnlResult.includedCount} cizinců</p>
                </div>
              </div>

              {/* Status ubytovacího zařízení */}
              {activeProperty ? (
                <div className="bg-slate-950/60 rounded-2xl p-3.5 border border-slate-800 text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Ubytovací zařízení:</span>
                      <p className="font-bold text-white text-sm">{activeProperty.name}</p>
                    </div>
                    <button
                      onClick={() => openEditPropertyModal(activeProperty)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-blue-400 rounded-lg text-[11px] font-semibold tap-active"
                    >
                      Upravit kódy
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono">
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">IDUB (Policie ČR):</span>
                      <p className={`text-xs font-bold tracking-wider mt-0.5 ${activeProperty.idub ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {activeProperty.idub || 'CHYBÍ IDUB!'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Zkratka zařízení:</span>
                      <p className={`text-xs font-bold tracking-wider mt-0.5 ${activeProperty.facilityCode ? 'text-blue-400' : 'text-amber-400'}`}>
                        {activeProperty.facilityCode || 'CHYBÍ KÓD!'}
                      </p>
                    </div>
                  </div>

                  {(!activeProperty.idub || !activeProperty.facilityCode) && (
                    <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-[11px] flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Pro úspěšný import do UbyPortu musíte zadat IDUB a 5místnou zkratku zařízení.</span>
                    </div>
                  )}

                  {activeUnlResult.excludedCzechCount > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px] flex items-center justify-between">
                      <span>Vyloučeno občanů ČR (nehlásí se):</span>
                      <span className="font-bold text-amber-400">{activeUnlResult.excludedCzechCount}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  Přidejte nebo vyberte ubytovací zařízení pro generování UNL.
                </p>
              )}

              {/* UNL FILE PREVIEW CONTAINER */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    Náhled UNL souboru (formát UbyPort 2.0)
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ASCII / CRLF / Pipe |</span>
                </div>

                <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 font-mono text-[11px] text-slate-300 leading-relaxed overflow-x-auto max-h-48 no-scrollbar whitespace-pre select-all">
                  {activeUnlResult.content ? (
                    activeUnlResult.content
                  ) : (
                    <span className="text-slate-600 italic">Žádná data pro export. Přidejte hosty se zahraniční státní příslušností.</span>
                  )}
                </div>
              </div>

              {/* ACTION BUTTONS: STÁHNOUT UNL, KOPÍROVAT, IMPORT UNL */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadUnl}
                  disabled={!activeUnlResult.content || activeUnlResult.includedCount === 0}
                  className="py-3 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 tap-active shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Stáhnout .UNL</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyUnlToClipboard}
                  disabled={!activeUnlResult.content || activeUnlResult.includedCount === 0}
                  className="py-3 px-3 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 tap-active cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-blue-400" />
                  <span>Kopírovat do schránky</span>
                </button>
              </div>

              {/* UBYPORT PORTAL LINK */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-400">Oficiální web UbyPort Policie ČR:</span>
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
          </div>
        )}

        {/* TAB 4: LAW & HELP (UBYPORT 2.0 PŘEDPISY) */}
        {activeTab === 'info' && (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-blue-400">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="text-base font-bold text-white">UbyPort 2.0 • Pravidla cizinecké policie</h2>
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
                Specifikace formátu UNL
              </h3>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
                <li>Plain-text soubor s příponou <code>.unl</code></li>
                <li>Oddělovač polí: svislítko <code>|</code> (pipe)</li>
                <li>Konec řádku: <code>\r\n</code> (CRLF), každý řádek končí znakem <code>|</code></li>
                <li>Kódování: ASCII / Windows-1250, texty <strong>VELKÝMI PÍSMENY BEZ DIAKRITIKY</strong></li>
                <li>Kódy států: Vždy přesně 3písmenný ISO 3166-1 alpha-3 kód (např. DEU, SVK, USA, GBR)</li>
              </ul>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Kódy ubytovacího zařízení (IDUB & Zkratka)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Při registraci u Policie ČR obdržíte <strong>IDUB</strong> (identifikační číslo ubytovatele) a <strong>5místnou zkratku zařízení</strong> (např. <code>HOTEL</code> nebo <code>APART</code>). Tyto údaje nastavíte v profilu ubytování v aplikaci a budou automaticky vkládány do každého řádku UNL.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Gemini OCR skener lístků
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Formuláře vyfocené mobilním telefonem jsou bleskově vytěženy multimodálním modelem Gemini Flash. Systém automaticky převede data do velkých písmen, odstraní diakritiku a namapuje 3místné ISO kódy států.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* BOTTOM NAVIGATION TAB BAR */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#0D131F] border-t border-slate-800 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-40 shadow-lg select-none">
        <div className="max-w-2xl mx-auto grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex flex-col items-center justify-center py-1 tap-active cursor-pointer ${
              activeTab === 'scan' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <Scan className="w-5 h-5" />
            <span className="text-[10px] mt-1">Skener</span>
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex flex-col items-center justify-center py-1 tap-active cursor-pointer relative ${
              activeTab === 'ledger' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-1">Kniha</span>
            {activeGuests.length > 0 && (
              <span className="absolute top-0 right-5 w-4 h-4 rounded-full bg-blue-500 text-[9px] font-bold text-white flex items-center justify-center">
                {activeGuests.length}
              </span>
            )}
          </button>

          {/* REPLACED TAB: EXPORT UNL */}
          <button
            onClick={() => setActiveTab('export')}
            className={`flex flex-col items-center justify-center py-1 tap-active cursor-pointer ${
              activeTab === 'export' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <FileDown className="w-5 h-5" />
            <span className="text-[10px] mt-1">Export UNL</span>
          </button>

          <button
            onClick={() => setActiveTab('info')}
            className={`flex flex-col items-center justify-center py-1 tap-active cursor-pointer ${
              activeTab === 'info' ? 'text-blue-500 font-bold' : 'text-slate-400'
            }`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px] mt-1">Nápověda</span>
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
                    Název ubytování *
                  </label>
                  <input
                    type="text"
                    required
                    value={propForm.name}
                    onChange={e => setPropForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="např. Karolina Plazza - Karlín"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">
                      IDUB (kód Policie ČR) *
                    </label>
                    <input
                      type="text"
                      value={propForm.idub}
                      onChange={e => setPropForm(prev => ({ ...prev, idub: e.target.value }))}
                      placeholder="např. CZ1234567890"
                      className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
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
                      placeholder="např. HOTEL"
                      className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Ubytovatel / Hostitel (Jméno / Firma)
                  </label>
                  <input
                    type="text"
                    value={propForm.hostName}
                    onChange={e => setPropForm(prev => ({ ...prev, hostName: e.target.value }))}
                    placeholder="např. Michaela Nováková"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Adresa v ČR
                  </label>
                  <input
                    type="text"
                    value={propForm.address}
                    onChange={e => setPropForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="např. Sokolovská 694/102, 186 00 Praha 8"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPropModalMode('list')}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active"
                  >
                    Zpět
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active"
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
                  {editingGuest ? 'Upravit cizince' : 'Nový host pro UbyPort 2.0'}
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

              {/* Jméno a Příjmení */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Příjmení *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestForm.lastName}
                    onChange={e => setGuestForm(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="např. MUELLER"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">
                    Jméno *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestForm.firstName}
                    onChange={e => setGuestForm(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="např. HANS"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
              </div>

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

              {/* Bydliště: Stát, Obec, Ulice */}
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
                    onChange={e => setGuestForm(prev => ({ ...prev, residenceCountry: normalizeCountryCode(e.target.value) }))}
                    placeholder="např. DEU"
                    className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
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
                    onChange={e => setGuestForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="např. BERLIN"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
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
                    onChange={e => setGuestForm(prev => ({ ...prev, street: e.target.value }))}
                    placeholder="např. HAUPTSTRASSE 12"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none uppercase"
                  />
                </div>
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

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active"
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
            <div className="space-y-2">
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

              {scanTargetChoice === 'existing' && properties.length > 0 ? (
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
              ) : (
                <div className="space-y-2 bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Název zařízení:</label>
                    <input
                      type="text"
                      value={scanNewPropForm.name}
                      onChange={e => setScanNewPropForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-semibold">IDUB (Policie ČR):</label>
                      <input
                        type="text"
                        value={scanNewPropForm.idub}
                        onChange={e => setScanNewPropForm(prev => ({ ...prev, idub: e.target.value }))}
                        placeholder="CZ1234567890"
                        className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1 uppercase"
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
                        className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-lg px-2.5 py-1.5 text-xs outline-none mt-1 uppercase"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* List of scanned guests */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">Rozpoznaní hosté:</label>
              <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
                {pendingScanData.guests.map((g: any, idx: number) => {
                  const nat = normalizeCountryCode(g.nationality);
                  const isCzech = isCzechCitizen(nat);

                  return (
                    <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">
                          {g.lastName} {g.firstName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-blue-300">
                          {nat}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 grid grid-cols-2 gap-1 font-mono">
                        <span>Narozen: {g.birthDate || 'neuvedeno'}</span>
                        <span>Doklad: {g.documentType || 'PAS'} {g.passportNumber || 'neuveden'}</span>
                      </div>
                      {isCzech && (
                        <p className="text-[10px] text-amber-400">
                          Občan ČR – nebude exportován do UNL cizinecké policie.
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

            {unlImportDetectedFacility && (
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Detekované zařízení v souboru:</span>
                <p className="font-mono text-white font-bold">
                  IDUB: {unlImportDetectedFacility.idub} • Zkratka: {unlImportDetectedFacility.facilityCode}
                </p>
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

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Google Gemini API klíč pro OCR
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={userApiKey}
                    onChange={e => setUserApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Klíč se synchronizuje do Google Sheetu na list <code>Nastaveni</code>, takže jej nemusíte zadávat znovu na jiných zařízeních.
                </p>
              </div>

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
                    className="px-2.5 py-1 bg-slate-700 hover:bg-slate-650 text-white rounded-lg text-[11px] font-semibold"
                  >
                    Změnit model
                  </button>
                </div>
              </div>

              {/* Google Workspace Info */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Google Sheets synchronizace
                  </span>
                  {currentUser ? (
                    <span className="text-[10px] text-emerald-400 font-bold">Připojeno</span>
                  ) : (
                    <span className="text-[10px] text-slate-500">Nepřipojeno</span>
                  )}
                </div>

                {currentUser ? (
                  <div className="space-y-1.5 text-[11px]">
                    <p className="text-slate-300 truncate">Účet: {currentUser.email}</p>
                    {connectedSheet && (
                      <a
                        href={connectedSheet.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-mono truncate"
                      >
                        <span>{connectedSheet.title}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={handleGoogleLogout}
                      className="text-rose-400 hover:underline text-[10px] font-semibold block pt-1"
                    >
                      Odhlásit Google účet
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold tap-active cursor-pointer"
                  >
                    Přihlásit se k účtu Google
                  </button>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-semibold tap-active"
                >
                  Zavřít
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold tap-active"
                >
                  Uložit nastavení
                </button>
              </div>
            </form>
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
                <p className="text-[11px] text-slate-400">Vyberte model pro rozpoznávání ubytovacích formulářů</p>
              </div>
              <button onClick={() => setIsModelSelectorOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {availableModels.map(m => (
                <div
                  key={m.name}
                  onClick={() => selectModel(m.name)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    m.name === activeModelName
                      ? 'bg-blue-950/50 border-blue-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{m.displayName || m.name}</span>
                      {m.isRecommended && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/20 text-emerald-400">
                          Doporučeno
                        </span>
                      )}
                    </div>
                    {m.description && <p className="text-[11px] text-slate-400 leading-snug">{m.description}</p>}
                  </div>
                  {m.name === activeModelName && <Check className="w-5 h-5 text-blue-400 shrink-0 ml-2" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: MISSING API KEY ALERT */}
      {isMissingKeyModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Zadejte Gemini API klíč</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Na statickém hostingu GitHub Pages probíhá rozpoznávání lístků přímo ve vašem prohlížeči pomocí Google Gemini API. Zadejte svůj bezplatný klíč:
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[11px] text-slate-300 font-semibold block">Váš Google Gemini API klíč:</label>
              <input
                type="password"
                value={userApiKey}
                onChange={e => setUserApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-800 border border-slate-700 text-white font-mono rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <p className="text-[10px] text-slate-500">
                Bezplatný klíč získáte na{' '}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 underline font-semibold"
                >
                  aistudio.google.com/apikey
                </a>
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsMissingKeyModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold tap-active"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!userApiKey.trim()) {
                    showToast('Zadejte prosím API klíč.', 'warning');
                    return;
                  }
                  safeStorage.setItem('ubyport_user_api_key', userApiKey.trim());
                  setIsMissingKeyModalOpen(false);
                  showToast('API klíč byl uložen!', 'success');
                  if (imagePreview) {
                    processImageWithOcr(imagePreview);
                  }
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold tap-active cursor-pointer shadow-lg shadow-blue-600/30"
              >
                Uložit a skenovat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 9: FIREBASE AUTHORIZED DOMAIN WARNING */}
      {isDomainModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Autorizace domény ve Firebase
              </h3>
              <button onClick={() => setIsDomainModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Tato doména (<code>{window.location.hostname}</code>) zatím není přidána mezi povolené domény ve Firebase Authentication konzoli projektu <code>{firebaseProjectId}</code>.
            </p>
            <div className="pt-2 flex gap-2">
              <button
                onClick={() => setIsDomainModalOpen(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold tap-active"
              >
                Rozumím
              </button>
              {firebaseConsoleAuthorizedDomainsUrl && (
                <a
                  href={firebaseConsoleAuthorizedDomainsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 tap-active"
                >
                  <span>Přejít do konzole</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
