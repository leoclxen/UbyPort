import { Property, Guest } from '../types';
import { normalizeCountryCode, isCzechCitizen, parseDateToISO } from './ubyport';

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

const HEADERS = {
  Ubytovani: ['ID', 'Nazev_ubytovani', 'IDUB', 'Zkratka_zarizeni', 'Hostitel', 'Adresa', 'Mestska_cast'],
  Hoste: [
    'ID', 'Ubytovani_ID', 'Pokoj_jednotka', 'Airbnb_kod', 'Prijmeni', 'Jmeno', 'Datum_narozeni',
    'Statni_obcanstvi', 'Stat_bydliste', 'Obec_bydliste', 'Ulice_a_cp', 'Druh_dokladu',
    'Cislo_dokladu', 'Stat_vydani_dokladu', 'Cislo_viza', 'Ucel_pobytu', 'Prijezd', 'Odjezd',
    'Pocet_noci', 'Vytvoreno'
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

/**
 * RFC-4180 CSV parser podporující uvozovky, čárky i zalomení řádků uvnitř buněk
 */
export function parseCsv(text: string): string[][] {
  const clean = (text || '').replace(/^\uFEFF/, '');
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
      } else if (ch === ',') {
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

function parsePropertiesFromRows(rows: string[][]): Property[] {
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
  const iDist = idx(['mestska_cast', 'district', 'district_key'], 6);

  return rows
    .slice(1)
    .map((r, rowIdx) => ({
      id: (r[iId] || '').trim() || `prop_sheet_${rowIdx + 1}`,
      name: (r[iName] || '').trim(),
      idub: (r[iIdub] || '').trim().toUpperCase(),
      facilityCode: (r[iFac] || '').trim().toUpperCase().substring(0, 5),
      hostName: (r[iHost] || '').trim(),
      address: (r[iAddr] || '').trim(),
      districtKey: (r[iDist] || '').trim() || 'praha8'
    }))
    .filter(p => p.name.length > 0);
}

function parseGuestsFromRows(rows: string[][], fallbackPropertyId = ''): Guest[] {
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
  const iUnit = findCol(['pokoj_jednotka', 'pokoj', 'unit', 'apartman'], isExactUbyportLayout ? 2 : -1);
  const iAirbnb = findCol(['airbnb_kod', 'airbnb_code', 'kod_rezervace'], isExactUbyportLayout ? 3 : -1);
  const iLast = findCol(['prijmeni', 'last_name', 'lastname', 'surname'], isExactUbyportLayout ? 4 : -1);
  const iFirst = findCol(['jmeno', 'first_name', 'firstname', 'given_name'], isExactUbyportLayout ? 5 : -1);
  const iBirth = findCol(['datum_narozeni', 'narozeni', 'birth_date', 'birthdate', 'date_of_birth'], isExactUbyportLayout ? 6 : -1);
  const iNat = findCol(['statni_obcanstvi', 'obcanstvi', 'nationality', 'citizenship'], isExactUbyportLayout ? 7 : -1);
  const iRes = findCol(['stat_bydliste', 'residence_country', 'bydliste_stat'], isExactUbyportLayout ? 8 : -1);
  const iCity = findCol(['obec_bydliste', 'mesto', 'obec', 'city'], isExactUbyportLayout ? 9 : -1);
  const iStreet = findCol(['ulice_a_cp', 'ulice', 'street', 'adresa', 'home_address'], isExactUbyportLayout ? 10 : -1);
  const iDocType = findCol(['druh_dokladu', 'typ_dokladu', 'document_type'], isExactUbyportLayout ? 11 : -1);
  const iDocNum = findCol(['cislo_dokladu', 'doklad', 'pas', 'passport', 'passport_no'], isExactUbyportLayout ? 12 : -1);
  const iDocCountry = findCol(['stat_vydani_dokladu', 'issuer_country'], isExactUbyportLayout ? 13 : -1);
  const iVisa = findCol(['cislo_viza', 'viza', 'visa', 'visa_no'], isExactUbyportLayout ? 14 : -1);
  const iPurpose = findCol(['ucel_pobytu', 'ucel', 'purpose', 'purpose_of_stay'], isExactUbyportLayout ? 15 : -1);
  const iArr = findCol(['prijezd', 'check_in', 'checkin', 'date_arrival', 'arrival'], isExactUbyportLayout ? 16 : -1);
  const iDep = findCol(['odjezd', 'check_out', 'checkout', 'date_departure', 'departure'], isExactUbyportLayout ? 17 : -1);
  const iNights = findCol(['pocet_noci', 'noci', 'nights'], isExactUbyportLayout ? 18 : -1);
  const iCreated = findCol(['vytvoreno', 'created_at', 'createdat'], isExactUbyportLayout ? 19 : -1);

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
      const issCountry = normalizeCountryCode(getVal(r, iDocCountry) || nat);
      const city = getVal(r, iCity);
      const street = getVal(r, iStreet);
      const arrIso = parseDateToISO(getVal(r, iArr)) || getVal(r, iArr);
      const depIso = parseDateToISO(getVal(r, iDep)) || getVal(r, iDep);
      const birthIso = parseDateToISO(getVal(r, iBirth)) || getVal(r, iBirth);
      const nights = Math.max(1, parseInt(getVal(r, iNights), 10) || 1);

      return {
        id: getVal(r, iId) || `g_sheet_${Date.now()}_${rowIdx}`,
        propertyId: getVal(r, iPropId) || fallbackPropertyId,
        unit: getVal(r, iUnit),
        airbnbCode: getVal(r, iAirbnb).toUpperCase(),
        lastName,
        firstName,
        fullName: `${firstName} ${lastName}`.trim() || 'Host',
        birthDate: birthIso,
        nationality: nat,
        residenceCountry: resCountry,
        city,
        street,
        address: `${street} ${city}`.trim(),
        idDocumentType: (getVal(r, iDocType) || 'PAS').toUpperCase() === 'OP' ? 'OP' : 'PAS',
        idDocumentNumber: docNum,
        documentIssuerCountry: issCountry,
        visaNumber: getVal(r, iVisa),
        purposeOfStay: getVal(r, iPurpose) || '1',
        dateArrival: arrIso,
        dateDeparture: depIso,
        nights,
        createdAt: getVal(r, iCreated) || new Date().toISOString()
      } as Guest;
    })
    .filter((g): g is Guest => g !== null);
}

function classifyRows(rows: string[][]): 'ubytovani' | 'hoste' | 'nastaveni' | 'unknown' {
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

  // Pokud má sešit hosty, ale neměl list Ubytovani, přiřadíme výchozí propertyId
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

function escapeXml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildGuestTableRows(guests: Guest[]): (string | number)[][] {
  return guests.map(g => [
    g.id,
    g.propertyId || '',
    g.unit || '',
    g.airbnbCode || '',
    g.lastName || '',
    g.firstName || '',
    g.birthDate || '',
    normalizeCountryCode(g.nationality || 'DEU'),
    normalizeCountryCode(g.residenceCountry || g.nationality || 'DEU'),
    g.city || '',
    g.street || '',
    g.idDocumentType || 'PAS',
    g.idDocumentNumber || '',
    normalizeCountryCode(g.documentIssuerCountry || g.nationality || 'DEU'),
    g.visaNumber || '',
    g.purposeOfStay || '1',
    g.dateArrival || '',
    g.dateDeparture || '',
    g.nights || 1,
    g.createdAt || new Date().toISOString()
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
    p.districtKey || 'praha8'
  ]);
}

function buildOverviewTableRows(properties: Property[], guests: Guest[]): (string | number)[][] {
  return properties.map(p => {
    const pGuests = guests.filter(g => g.propertyId === p.id);
    const foreignGuests = pGuests.filter(g => !isCzechCitizen(g.nationality));
    const czechGuests = pGuests.filter(g => isCzechCitizen(g.nationality));
    const totalNights = foreignGuests.reduce((s, g) => s + g.nights, 0);
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
 * Stáhne více-listový Excel sešit (.xls XML Spreadsheet 2003) kompatibilní s Excelem i Google Sheets (Soubor -> Importovat)
 */
export function downloadExcelWorkbook(properties: Property[], guests: Guest[]): void {
  const sheets: { name: string; headers: string[]; rows: (string | number)[][] }[] = [
    { name: 'Hoste', headers: HEADERS.Hoste, rows: buildGuestTableRows(guests) },
    { name: 'Ubytovani', headers: HEADERS.Ubytovani, rows: buildPropertyTableRows(properties) },
    { name: 'Prehled_hlaseni', headers: HEADERS.Prehled_hlaseni, rows: buildOverviewTableRows(properties, guests) }
  ];

  const renderWorksheet = (sheet: { name: string; headers: string[]; rows: (string | number)[][] }) => {
    const headerCells = sheet.headers
      .map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
      .join('');
    const bodyRows = sheet.rows
      .map(row => {
        const cells = row
          .map(val => {
            const isNum = typeof val === 'number' && !isNaN(val);
            return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(val)}</Data></Cell>`;
          })
          .join('');
        return `<Row>${cells}</Row>`;
      })
      .join('\n');

    return `  <Worksheet ss:Name="${escapeXml(sheet.name)}">
    <Table>
      <Row>${headerCells}</Row>
${bodyRows}
    </Table>
  </Worksheet>`;
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
    </Style>
  </Styles>
${sheets.map(renderWorksheet).join('\n')}
</Workbook>`;

  const dateStr = new Date().toISOString().split('T')[0];
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  triggerFileDownload(blob, `ubyport-evidence-${dateStr}.xls`);
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
