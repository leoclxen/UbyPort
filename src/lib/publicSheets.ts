import { Property, Guest } from '../types';
import {
  normalizeCountryCode,
  isCzechCitizen,
  parseDateToISO,
  normalizePurposeCode,
  parseCzechAddress,
  calculateStayNights
} from './ubyport';
import { buildXlsxBlob, parseXlsxBuffer } from './xlsx';

export interface ParsedSheetUrl {
  spreadsheetId: string;
  gid?: string;
  canonicalUrl: string;
}

export interface PublicSheetLoadResult {
  properties: Property[];
  guests: Guest[];
  preferredModel?: string;
  canonicalUrl: string;
  spreadsheetId: string;
  detectedTabs: string[];
}

export interface TabularImportParseResult {
  properties: Property[];
  guests: Guest[];
}

const HEADERS = {
  Ubytovani: [
    'ID', 'Nazev_ubytovani', 'IDUB', 'Zkratka_zarizeni', 'Hostitel', 'Adresa', 'Mestska_cast',
    'Kontakt', 'Okres', 'Obec', 'Cast_obce', 'Ulice', 'Cislo_domovni', 'Cislo_orientacni', 'PSC'
  ],
  Hoste: [
    'ID', 'Ubytovani_ID', 'Prijmeni', 'Jmeno', 'Datum_narozeni',
    'Statni_obcanstvi', 'Stat_bydliste', 'Obec_bydliste', 'Ulice_a_cp',
    'Cislo_dokladu', 'Cislo_viza', 'Ucel_pobytu', 'Prijezd', 'Odjezd',
    'Vytvoreno', 'Poznamka'
  ],
  Prehled_hlaseni: [
    'Nazev_ubytovani', 'IDUB', 'Zkratka_zarizeni', 'Celkem_cizincu_k_hlaseni', 'Celkem_noci',
    'Cesi_vylouceni', 'Posledni_synchronizace'
  ]
};

/**
 * Extrahuje ID Google Sheetu a volitelné gid z libovolného odkazu nebo zadaného ID
 */
export function parseGoogleSheetUrl(input: string): ParsedSheetUrl | null {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);

  let spreadsheetId = '';
  if (urlMatch) {
    spreadsheetId = urlMatch[1];
  } else if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    spreadsheetId = trimmed;
  }

  if (!spreadsheetId) return null;

  const gid = gidMatch ? gidMatch[1] : undefined;
  const canonicalUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${gid ? `#gid=${gid}` : ''}`;
  return { spreadsheetId, gid, canonicalUrl };
}

function detectCsvDelimiter(cleanText: string): ',' | ';' {
  const firstLineEnd = cleanText.search(/[\r\n]/);
  const firstLine = firstLineEnd >= 0 ? cleanText.slice(0, firstLineEnd) : cleanText;
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') commas++;
      else if (ch === ';') semicolons++;
    }
  }
  return semicolons > commas ? ';' : ',';
}

/**
 * RFC-4180 CSV parser podporující uvozovky, čárky i středníky (český Excel) a zalomení řádků uvnitř buněk
 */
export function parseCsv(text: string): string[][] {
  const clean = (text || '').replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(clean);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (ch === '\r' && next === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows.filter(r => r.some(cell => cell.length > 0));
}

async function fetchPublicCsvTab(
  spreadsheetId: string,
  options: { sheetName?: string; gid?: string }
): Promise<string[][] | null> {
  const params = new URLSearchParams({ tqx: 'out:csv' });
  if (options.sheetName) {
    params.set('sheet', options.sheetName);
  } else if (options.gid) {
    params.set('gid', options.gid);
  }

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { mode: 'cors' });
  } catch {
    const err: any = new Error(
      'Nepodařilo se spojit s Google Sheets. Zkontrolujte připojení k internetu a zda má sešit zapnuté sdílení „Kdokoliv s odkazem (Čtenář)“.'
    );
    err.code = 'SHEET_PRIVATE_OR_NETWORK';
    throw err;
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      const err: any = new Error(
        'Sešit není přístupný. V Google Sheets nastavte Sdílet → Obecný přístup → Kdokoliv s odkazem (Čtenář).'
      );
      err.code = 'SHEET_PRIVATE';
      throw err;
    }
    throw new Error(`Chyba při čtení Google Sheetu (HTTP ${res.status}).`);
  }

  const text = await res.text();
  const trimmed = text.trimStart().toLowerCase();
  if (
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('accounts.google.com/servicelogin')
  ) {
    const err: any = new Error(
      'Tento Google Sheet je soukromý. Nastavte prosím vpravo nahoře Sdílet → Obecný přístup → Kdokoliv s odkazem (Čtenář).'
    );
    err.code = 'SHEET_PRIVATE';
    throw err;
  }

  const rows = parseCsv(text);
  return rows.length > 0 ? rows : null;
}

function normalizeHeaderKey(h: string): string {
  return (h || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function parsePropertiesFromRows(rows: string[][]): Property[] {
  if (rows.length < 2) return [];
  const headerKeys = rows[0].map(normalizeHeaderKey);
  const idx = (names: string[], fallbackIdx: number) => {
    for (const n of names) {
      const found = headerKeys.indexOf(n);
      if (found >= 0) return found;
    }
    return fallbackIdx;
  };

  const iId = idx(['id'], 0);
  const iName = idx(['nazev_ubytovani', 'nazev', 'ubytovani', 'name', 'property'], 1);
  const iIdub = idx(['idub'], 2);
  const iFac = idx(['zkratka_zarizeni', 'zkratka', 'facility_code', 'facilitycode'], 3);
  const iHost = idx(['hostitel', 'host', 'host_name', 'ubytovatel'], 4);
  const iAddr = idx(['adresa', 'address'], 5);
  const iDist = idx(['mestska_cast', 'district_key'], 6);
  const iContact = idx(['kontakt', 'contact'], -1);
  const iOkres = idx(['okres', 'obvod', 'district'], -1);
  const iObec = idx(['obec', 'mesto', 'municipality'], -1);
  const iCast = idx(['cast_obce', 'city_part'], -1);
  const iUlice = idx(['ulice', 'street'], -1);
  const iCp = idx(['cislo_domovni', 'cp', 'cislo_popisne', 'house_number'], -1);
  const iCo = idx(['cislo_orientacni', 'co', 'orientation_number'], -1);
  const iPsc = idx(['psc', 'postal_code', 'zip'], -1);

  const cell = (r: string[], i: number) => (i >= 0 && i < r.length ? (r[i] || '').trim() : '');

  return rows
    .slice(1)
    .map((r, rowIdx) => {
      const address = cell(r, iAddr);
      const districtKey = cell(r, iDist) || 'praha8';
      const parsed = parseCzechAddress(address, districtKey);
      const hostName = cell(r, iHost);

      return {
        id: cell(r, iId) || `prop_sheet_${rowIdx + 1}`,
        name: cell(r, iName),
        idub: cell(r, iIdub).toUpperCase(),
        facilityCode: cell(r, iFac).toUpperCase().substring(0, 5),
        hostName,
        address,
        districtKey,
        contact: iContact >= 0 ? cell(r, iContact) : hostName,
        district: iOkres >= 0 ? cell(r, iOkres) : parsed.district,
        municipality: iObec >= 0 ? cell(r, iObec) : parsed.municipality,
        cityPart: iCast >= 0 ? cell(r, iCast) : parsed.cityPart,
        street: iUlice >= 0 ? cell(r, iUlice) : parsed.street,
        houseNumber: iCp >= 0 ? cell(r, iCp) : parsed.houseNumber,
        orientationNumber: iCo >= 0 ? cell(r, iCo) : parsed.orientationNumber,
        postalCode: iPsc >= 0 ? cell(r, iPsc) : parsed.postalCode
      };
    })
    .filter(p => p.name.length > 0);
}

export function parseGuestsFromRows(rows: string[][], fallbackPropertyId = ''): Guest[] {
  if (rows.length < 2) return [];
  const headerKeys = rows[0].map(normalizeHeaderKey);

  const findCol = (candidates: string[], defaultIdx = -1): number => {
    for (const c of candidates) {
      const i = headerKeys.indexOf(c);
      if (i >= 0) return i;
    }
    return defaultIdx;
  };

  const isExactUbyportLayout =
    headerKeys.includes('prijmeni') &&
    headerKeys.includes('statni_obcanstvi') &&
    headerKeys.includes('cislo_dokladu');

  const iId = findCol(['id'], isExactUbyportLayout ? 0 : -1);
  const iPropId = findCol(['ubytovani_id', 'property_id', 'propertyid'], isExactUbyportLayout ? 1 : -1);
  const iLast = findCol(['prijmeni', 'last_name', 'lastname', 'surname'], isExactUbyportLayout ? 2 : -1);
  const iFirst = findCol(['jmeno', 'first_name', 'firstname', 'given_name'], isExactUbyportLayout ? 3 : -1);
  const iBirth = findCol(['datum_narozeni', 'narozeni', 'birth_date', 'birthdate', 'date_of_birth'], isExactUbyportLayout ? 4 : -1);
  const iNat = findCol(['statni_obcanstvi', 'obcanstvi', 'nationality', 'citizenship'], isExactUbyportLayout ? 5 : -1);
  const iRes = findCol(['stat_bydliste', 'residence_country', 'bydliste_stat'], isExactUbyportLayout ? 6 : -1);
  const iCity = findCol(['obec_bydliste', 'mesto', 'obec', 'city'], isExactUbyportLayout ? 7 : -1);
  const iStreet = findCol(['ulice_a_cp', 'ulice', 'street', 'adresa', 'home_address'], isExactUbyportLayout ? 8 : -1);
  const iDocNum = findCol(['cislo_dokladu', 'doklad', 'pas', 'passport', 'passport_no'], isExactUbyportLayout ? 9 : -1);
  const iVisa = findCol(['cislo_viza', 'viza', 'visa', 'visa_no'], isExactUbyportLayout ? 10 : -1);
  const iPurpose = findCol(['ucel_pobytu', 'ucel', 'purpose', 'purpose_of_stay'], isExactUbyportLayout ? 11 : -1);
  const iArr = findCol(['prijezd', 'check_in', 'checkin', 'date_arrival', 'arrival'], isExactUbyportLayout ? 12 : -1);
  const iDep = findCol(['odjezd', 'check_out', 'checkout', 'date_departure', 'departure'], isExactUbyportLayout ? 13 : -1);
  const iCreated = findCol(['vytvoreno', 'created_at', 'createdat'], isExactUbyportLayout ? 14 : -1);
  const iNote = findCol(['poznamka', 'note'], isExactUbyportLayout ? 15 : -1);

  const getVal = (r: string[], col: number) => (col >= 0 && col < r.length ? (r[col] || '').trim() : '');

  return rows
    .slice(1)
    .map((r, rowIdx) => {
      const lastName = getVal(r, iLast);
      const firstName = getVal(r, iFirst);
      const docNum = getVal(r, iDocNum);
      if (!lastName && !firstName && !docNum) return null;

      const nat = normalizeCountryCode(getVal(r, iNat) || 'DEU');
      const resCountry = normalizeCountryCode(getVal(r, iRes) || nat);
      const city = getVal(r, iCity);
      const street = getVal(r, iStreet);
      const arrIso = parseDateToISO(getVal(r, iArr)) || getVal(r, iArr);
      const depIso = parseDateToISO(getVal(r, iDep)) || getVal(r, iDep);
      const birthIso = parseDateToISO(getVal(r, iBirth)) || getVal(r, iBirth);

      return {
        id: getVal(r, iId) || `g_sheet_${Date.now()}_${rowIdx}`,
        propertyId: getVal(r, iPropId) || fallbackPropertyId,
        lastName,
        firstName,
        birthDate: birthIso,
        nationality: nat,
        residenceCountry: resCountry,
        city,
        street,
        address: `${street} ${city}`.trim(),
        idDocumentNumber: docNum,
        visaNumber: getVal(r, iVisa),
        purposeOfStay: normalizePurposeCode(getVal(r, iPurpose) || '10'),
        note: getVal(r, iNote),
        dateArrival: arrIso,
        dateDeparture: depIso,
        createdAt: getVal(r, iCreated) || new Date().toISOString()
      } as Guest;
    })
    .filter((g): g is Guest => g !== null);
}

export function classifyRows(rows: string[][]): 'ubytovani' | 'hoste' | 'nastaveni' | 'unknown' {
  if (!rows || rows.length === 0) return 'unknown';
  const h = rows[0].map(normalizeHeaderKey);
  if (h.includes('nazev_ubytovani') || (h.includes('idub') && h.includes('zkratka_zarizeni'))) {
    return 'ubytovani';
  }
  if (
    h.includes('prijmeni') ||
    h.includes('last_name') ||
    h.includes('cislo_dokladu') ||
    h.includes('statni_obcanstvi')
  ) {
    return 'hoste';
  }
  if (h.includes('klic_parametr') || h.includes('hodnota')) {
    return 'nastaveni';
  }
  return 'unknown';
}

/**
 * Načte data z veřejně sdíleného Google Sheetu (Kdokoliv s odkazem -> Čtenář)
 * bez použití Google Cloud Console, Firebase nebo Apps Scriptu.
 */
export async function loadFromPublicGoogleSheet(
  sheetUrlOrId: string,
  fallbackPropertyId = ''
): Promise<PublicSheetLoadResult> {
  const parsed = parseGoogleSheetUrl(sheetUrlOrId);
  if (!parsed) {
    throw new Error('Neplatný odkaz na Google Sheet. Zkopírujte prosím celou adresu z adresního řádku.');
  }

  const detectedTabs: string[] = [];
  let properties: Property[] = [];
  let guests: Guest[] = [];
  let preferredModel = '';

  const [ubytRows, hostRows, nastRows, gidRows] = await Promise.all([
    fetchPublicCsvTab(parsed.spreadsheetId, { sheetName: 'Ubytovani' }),
    fetchPublicCsvTab(parsed.spreadsheetId, { sheetName: 'Hoste' }),
    fetchPublicCsvTab(parsed.spreadsheetId, { sheetName: 'Nastaveni' }),
    parsed.gid ? fetchPublicCsvTab(parsed.spreadsheetId, { gid: parsed.gid }) : Promise.resolve(null)
  ]);

  const candidates: { name: string; rows: string[][] | null }[] = [
    { name: 'Ubytovani', rows: ubytRows },
    { name: 'Hoste', rows: hostRows },
    { name: 'Nastaveni', rows: nastRows },
    ...(gidRows ? [{ name: `gid=${parsed.gid}`, rows: gidRows }] : [])
  ];

  for (const cand of candidates) {
    if (!cand.rows) continue;
    const kind = classifyRows(cand.rows);
    if (kind === 'ubytovani' && properties.length === 0) {
      properties = parsePropertiesFromRows(cand.rows);
      detectedTabs.push('Ubytovani');
    } else if (kind === 'hoste' && guests.length === 0) {
      guests = parseGuestsFromRows(cand.rows, fallbackPropertyId);
      detectedTabs.push('Hoste');
    } else if (kind === 'nastaveni' && !detectedTabs.includes('Nastaveni')) {
      for (const row of cand.rows.slice(1)) {
        const k = (row[0] || '').trim();
        const v = (row[1] || '').trim();
        if (k === 'PREFEROVANY_MODEL' && v) preferredModel = v;
      }
      detectedTabs.push('Nastaveni');
    }
  }

  const resolvedFallbackPropId = properties[0]?.id || fallbackPropertyId;
  if (resolvedFallbackPropId) {
    guests = guests.map(g => ({
      ...g,
      propertyId: g.propertyId || resolvedFallbackPropId
    }));
  }

  return {
    properties,
    guests,
    preferredModel: preferredModel || undefined,
    canonicalUrl: parsed.canonicalUrl,
    spreadsheetId: parsed.spreadsheetId,
    detectedTabs
  };
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildGuestTableRows(guests: Guest[]): (string | number)[][] {
  return guests.map(g => [
    g.id,
    g.propertyId || '',
    g.lastName || '',
    g.firstName || '',
    g.birthDate || '',
    normalizeCountryCode(g.nationality || 'DEU'),
    normalizeCountryCode(g.residenceCountry || g.nationality || 'DEU'),
    g.city || '',
    g.street || '',
    g.idDocumentNumber || '',
    g.visaNumber || '',
    normalizePurposeCode(g.purposeOfStay || '10'),
    g.dateArrival || '',
    g.dateDeparture || '',
    g.createdAt || new Date().toISOString(),
    g.note || ''
  ]);
}

function buildPropertyTableRows(properties: Property[]): (string | number)[][] {
  return properties.map(p => [
    p.id,
    p.name,
    p.idub || '',
    p.facilityCode || '',
    p.hostName || '',
    p.address || '',
    p.districtKey || 'praha8',
    p.contact || '',
    p.district || '',
    p.municipality || '',
    p.cityPart || '',
    p.street || '',
    p.houseNumber || '',
    p.orientationNumber || '',
    p.postalCode || ''
  ]);
}

function buildOverviewTableRows(properties: Property[], guests: Guest[]): (string | number)[][] {
  return properties.map(p => {
    const pGuests = guests.filter(g => g.propertyId === p.id);
    const foreignGuests = pGuests.filter(g => !isCzechCitizen(g.nationality));
    const czechGuests = pGuests.filter(g => isCzechCitizen(g.nationality));
    const totalNights = foreignGuests.reduce(
      (s, g) => s + calculateStayNights(g.dateArrival, g.dateDeparture),
      0
    );
    return [
      p.name,
      p.idub || '',
      p.facilityCode || '',
      foreignGuests.length,
      totalNights,
      czechGuests.length,
      new Date().toLocaleString('cs-CZ')
    ];
  });
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Stáhne nativní více-listový Excel sešit (.xlsx) se 3 listy (Hoste, Ubytovani, Prehled_hlaseni)
 */
export async function downloadExcelWorkbook(properties: Property[], guests: Guest[]): Promise<void> {
  const blob = await buildXlsxBlob([
    { name: 'Hoste', headers: HEADERS.Hoste, rows: buildGuestTableRows(guests) },
    { name: 'Ubytovani', headers: HEADERS.Ubytovani, rows: buildPropertyTableRows(properties) },
    { name: 'Prehled_hlaseni', headers: HEADERS.Prehled_hlaseni, rows: buildOverviewTableRows(properties, guests) }
  ]);
  const dateStr = new Date().toISOString().split('T')[0];
  triggerFileDownload(blob, `ubyport-evidence-${dateStr}.xlsx`);
}

/**
 * Načte data z vybraného Excel souboru (.xlsx)
 */
export async function importExcelWorkbookFile(
  file: File,
  fallbackPropertyId = ''
): Promise<TabularImportParseResult> {
  const buffer = await file.arrayBuffer();
  const sheets = await parseXlsxBuffer(buffer);
  if (sheets.length === 0) {
    throw new Error('Soubor Excel (.xlsx) neobsahuje žádné čitelné listy.');
  }

  let properties: Property[] = [];
  let guests: Guest[] = [];

  for (const sheet of sheets) {
    const kind = classifyRows(sheet.rows);
    const normName = sheet.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (kind === 'ubytovani' || (kind === 'unknown' && normName.includes('ubyt'))) {
      properties = [...properties, ...parsePropertiesFromRows(sheet.rows)];
    } else if (kind === 'hoste' || (kind === 'unknown' && normName.includes('host'))) {
      guests = [...guests, ...parseGuestsFromRows(sheet.rows, fallbackPropertyId)];
    }
  }

  if (properties.length === 0 && guests.length === 0) {
    throw new Error('V souboru .xlsx nebyly nalezeny žádné platné záznamy hostů ani ubytování.');
  }

  return { properties, guests };
}

async function decodeCsvFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  if (!utf8.includes('\uFFFD')) return utf8;
  try {
    return new TextDecoder('windows-1250').decode(buf);
  } catch {
    return utf8;
  }
}

/**
 * Načte a ověří lokální CSV soubor pro Hosty nebo Ubytování
 */
export async function importCsvFile(
  file: File,
  expectedTarget: 'guests' | 'properties',
  fallbackPropertyId = ''
): Promise<TabularImportParseResult> {
  const text = await decodeCsvFileText(file);
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('Vybraný CSV soubor je prázdný nebo neobsahuje datové řádky.');
  }

  const kind = classifyRows(rows);
  if (expectedTarget === 'guests') {
    if (kind === 'ubytovani') {
      throw new Error('Vybraný CSV soubor obsahuje seznam ubytování, nikoliv hosty. Použijte řádek „CSV Ubytování“.');
    }
    const parsedGuests = parseGuestsFromRows(rows, fallbackPropertyId);
    if (parsedGuests.length === 0) {
      throw new Error('V CSV souboru nebyl nalezen žádný platný záznam hosta.');
    }
    return { properties: [], guests: parsedGuests };
  }

  if (kind === 'hoste') {
    throw new Error('Vybraný CSV soubor obsahuje seznam hostů, nikoliv ubytování. Použijte řádek „CSV Hosté“.');
  }
  const parsedProperties = parsePropertiesFromRows(rows);
  if (parsedProperties.length === 0) {
    throw new Error('V CSV souboru nebylo nalezeno žádný platný záznam ubytování.');
  }
  return { properties: parsedProperties, guests: [] };
}

/**
 * Stáhne CSV (UTF-8 s BOM pro bezproblémovou češtinu v Excelu a Google Sheets)
 */
export function downloadCsvExport(
  target: 'guests' | 'properties',
  properties: Property[],
  guests: Guest[]
): void {
  const headers = target === 'guests' ? HEADERS.Hoste : HEADERS.Ubytovani;
  const rows = target === 'guests' ? buildGuestTableRows(guests) : buildPropertyTableRows(properties);
  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(r => r.map(escapeCsvCell).join(','))
  ];
  const dateStr = new Date().toISOString().split('T')[0];
  const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerFileDownload(blob, `ubyport-${target === 'guests' ? 'hoste' : 'ubytovani'}-${dateStr}.csv`);
}

/**
 * Vytvoří TSV řetězec pro okamžité vložení (Ctrl+V) přímo do Google Sheets od buňky A1
 */
export function buildGoogleSheetsTsv(
  target: 'guests' | 'properties',
  properties: Property[],
  guests: Guest[]
): string {
  const headers = target === 'guests' ? HEADERS.Hoste : HEADERS.Ubytovani;
  const rows = target === 'guests' ? buildGuestTableRows(guests) : buildPropertyTableRows(properties);
  const sanitizeTsv = (v: unknown) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');
  return [
    headers.map(sanitizeTsv).join('\t'),
    ...rows.map(r => r.map(sanitizeTsv).join('\t'))
  ].join('\n');
}
