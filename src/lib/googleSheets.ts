import { Property, Guest } from '../types';
import { normalizeCountryCode, isCzechCitizen } from './ubyport';

export interface SpreadsheetInfo {
  id: string;
  url: string;
  title: string;
  isNew: boolean;
}

export interface SheetDataPayload {
  properties: Property[];
  guests: Guest[];
  apiKey?: string;
  preferredModel?: string;
}

const DEFAULT_TITLE = 'UbyPort 2.0 - Evidence cizinců';

// Záhlaví 4 listů v Google Sešitu
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
  ],
  Nastaveni: ['Klic_parametr', 'Hodnota', 'Popis']
};

/**
 * Hledá na Google Disku uživatele existující UbyPort sešit nebo vytvoří nový
 */
export async function findOrCreateAirTaxSpreadsheet(
  accessToken: string,
  customSpreadsheetId?: string
): Promise<SpreadsheetInfo> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1. Zda uživatel zadal explicitní Spreadsheet ID / URL
  if (customSpreadsheetId && customSpreadsheetId.trim()) {
    const cleanId = extractSpreadsheetId(customSpreadsheetId.trim());
    const verifyRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}`, {
      headers
    });
    if (verifyRes.ok) {
      const meta = await verifyRes.json();
      await ensureRequiredSheetsExist(accessToken, cleanId, meta.sheets || []);
      return {
        id: cleanId,
        url: `https://docs.google.com/spreadsheets/d/${cleanId}/edit`,
        title: meta.properties?.title || DEFAULT_TITLE,
        isNew: false
      };
    }
  }

  // 2. Hledání na Disku existujícího souboru s názvem DEFAULT_TITLE nebo starým názvem
  try {
    const driveQuery = encodeURIComponent(
      `name='${DEFAULT_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    );
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${driveQuery}&fields=files(id,name,webViewLink)`,
      { headers }
    );
    if (driveRes.ok) {
      const driveData = await driveRes.json();
      if (Array.isArray(driveData.files) && driveData.files.length > 0) {
        const existing = driveData.files[0];
        const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${existing.id}`, { headers });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          await ensureRequiredSheetsExist(accessToken, existing.id, meta.sheets || []);
        }
        return {
          id: existing.id,
          url: existing.webViewLink || `https://docs.google.com/spreadsheets/d/${existing.id}/edit`,
          title: existing.name,
          isNew: false
        };
      }
    }
  } catch (err) {
    console.warn('Drive search failed, falling back to create', err);
  }

  // 3. Vytvoření nového Google sešitu se 4 listy
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      properties: { title: DEFAULT_TITLE },
      sheets: [
        { properties: { title: 'Ubytovani', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Hoste', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Prehled_hlaseni', gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: 'Nastaveni', gridProperties: { frozenRowCount: 1 } } }
      ]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Nepodařilo se vytvořit Google Sheet: ${errText}`);
  }

  const created = await createRes.json();
  const newId = created.spreadsheetId;

  await initializeHeadersAndInitialData(accessToken, newId);

  return {
    id: newId,
    url: created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${newId}/edit`,
    title: DEFAULT_TITLE,
    isNew: true
  };
}

/**
 * Zajistí přítomnost všech požadovaných listů
 */
async function ensureRequiredSheetsExist(accessToken: string, spreadsheetId: string, currentSheets: any[]) {
  const existingTitles = currentSheets.map(s => s.properties?.title);
  const required = ['Ubytovani', 'Hoste', 'Prehled_hlaseni', 'Nastaveni'];
  const missing = required.filter(title => !existingTitles.includes(title));

  if (missing.length === 0) return;

  const requests = missing.map(title => ({
    addSheet: {
      properties: {
        title,
        gridProperties: { frozenRowCount: 1 }
      }
    }
  }));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests })
  });

  const updateData: any[] = [];
  missing.forEach(sheetName => {
    if (sheetName === 'Nastaveni') {
      updateData.push({
        range: `'Nastaveni'!A1:C4`,
        values: [
          HEADERS.Nastaveni,
          ['GEMINI_API_KEY', '', 'Váš Google Gemini API klíč pro automatické OCR rozpoznávání'],
          ['PREFEROVANY_MODEL', 'gemini-flash-latest', 'Aktivní model Gemini (gemini-flash-latest / 3.8-flash / 3.1-flash-lite)'],
          ['POSLEDNI_AKTUALIZACE', new Date().toISOString(), 'Čas vytvoření listu']
        ]
      });
    } else {
      const h = (HEADERS as any)[sheetName];
      if (h) {
        updateData.push({
          range: `'${sheetName}'!A1:${getColumnLetter(h.length)}1`,
          values: [h]
        });
      }
    }
  });

  if (updateData.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updateData
      })
    });
  }
}

async function initializeHeadersAndInitialData(accessToken: string, spreadsheetId: string) {
  const data = [
    { range: 'Ubytovani!A1:G1', values: [HEADERS.Ubytovani] },
    { range: 'Hoste!A1:T1', values: [HEADERS.Hoste] },
    { range: 'Prehled_hlaseni!A1:G1', values: [HEADERS.Prehled_hlaseni] },
    {
      range: 'Nastaveni!A1:C4',
      values: [
        HEADERS.Nastaveni,
        ['GEMINI_API_KEY', '', 'Váš Google Gemini API klíč pro automatické OCR rozpoznávání'],
        ['PREFEROVANY_MODEL', 'gemini-flash-latest', 'Aktivní model Gemini (gemini-flash-latest / 3.8-flash / 3.1-flash-lite)'],
        ['POSLEDNI_AKTUALIZACE', new Date().toISOString(), 'Čas vytvoření listu']
      ]
    }
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data
    })
  });
}

/**
 * Načte všechna data z Google Sešitu do stavu aplikace
 */
export async function loadAllDataFromGoogleSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<{
  properties: Property[];
  guests: Guest[];
  apiKey: string;
  preferredModel: string;
}> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  let sheetTitles: string[] = [];
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      { headers }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      sheetTitles = (meta.sheets || []).map((s: any) => s.properties?.title || '');
    }
  } catch (e) {
    console.warn('Failed to query sheet metadata, fallback to defaults', e);
  }

  if (sheetTitles.length > 0) {
    const required = ['Ubytovani', 'Hoste', 'Prehled_hlaseni', 'Nastaveni'];
    const missing = required.filter(t => !sheetTitles.includes(t));
    if (missing.length > 0) {
      try {
        await ensureRequiredSheetsExist(accessToken, spreadsheetId, sheetTitles.map(t => ({ properties: { title: t } })));
      } catch (e) {
        console.warn('Could not auto-add missing sheet', e);
      }
    }
  }

  const ranges = [
    'Ubytovani!A2:G1000',
    'Hoste!A2:T5000',
    'Nastaveni!A1:C10'
  ];
  const query = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${query}`,
    { headers }
  );

  if (!res.ok) {
    throw new Error('Chyba při čtení dat z Google Sheetu.');
  }

  const result = await res.json();
  const valueRanges = result.valueRanges || [];

  // Parse Nastaveni
  const configRows = valueRanges[2]?.values || [];
  let apiKey = '';
  let preferredModel = 'gemini-flash-latest';

  for (const row of configRows) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const key = String(row[0] || '').trim();
    const val = String(row[1] || '').trim();

    if (key === 'GEMINI_API_KEY') {
      apiKey = val;
    } else if (key === 'PREFEROVANY_MODEL' && val) {
      preferredModel = val;
    }
  }

  // Parse Ubytovani (7 columns: ID, Nazev, IDUB, Zkratka_zarizeni, Hostitel, Adresa, Mestska_cast)
  const propRows = valueRanges[0]?.values || [];
  const properties: Property[] = propRows.map((r: any[]) => {
    return {
      id: r[0] || `prop_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: r[1] || '',
      idub: r[2] || '',
      facilityCode: r[3] || '',
      hostName: r[4] || '',
      address: r[5] || '',
      districtKey: r[6] || 'praha8'
    };
  }).filter((p: Property) => p.name.trim().length > 0);

  // Parse Hoste (20 columns)
  const guestRows = valueRanges[1]?.values || [];
  const guests: Guest[] = guestRows.map((r: any[]) => {
    const propId = r[1] || '';
    const nights = Math.max(1, parseInt(r[18]) || 1);
    const lastName = r[4] || '';
    const firstName = r[5] || '';
    const nat = normalizeCountryCode(r[7] || 'DEU');
    const resCountry = normalizeCountryCode(r[8] || nat);
    const issCountry = normalizeCountryCode(r[13] || nat);

    return {
      id: r[0] || `g_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      propertyId: propId,
      unit: r[2] || '',
      airbnbCode: r[3] || '',
      lastName,
      firstName,
      fullName: `${firstName} ${lastName}`.trim() || 'Host',
      birthDate: r[6] || '',
      nationality: nat,
      residenceCountry: resCountry,
      city: r[9] || '',
      street: r[10] || '',
      address: `${r[10] || ''} ${r[9] || ''}`.trim(),
      idDocumentType: (r[11] || 'PAS').toUpperCase(),
      idDocumentNumber: r[12] || '',
      documentIssuerCountry: issCountry,
      visaNumber: r[14] || '',
      purposeOfStay: r[15] || '1',
      dateArrival: r[16] || '',
      dateDeparture: r[17] || '',
      nights,
      createdAt: r[19] || new Date().toISOString()
    };
  }).filter((g: Guest) => (g.lastName || g.firstName || g.idDocumentNumber));

  return { properties, guests, apiKey, preferredModel };
}

/**
 * Uloží nemovitosti, hosty a přehled do Google Sešitu (bez poplatků)
 */
export async function syncAllToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  payload: SheetDataPayload
): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

  // 1. Ubytovani rows: ID, Nazev, IDUB, Zkratka_zarizeni, Hostitel, Adresa, Mestska_cast
  const propRows = payload.properties.map(p => [
    p.id,
    p.name,
    p.idub || '',
    p.facilityCode || '',
    p.hostName || '',
    p.address || '',
    p.districtKey || 'praha8'
  ]);

  // 2. Hoste rows (20 sloupců)
  const guestRows = payload.guests.map(g => [
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

  // 3. Prehled_hlaseni rows: Nazev, IDUB, Zkratka, Celkem_cizincu_k_hlaseni, Celkem_noci, Cesi_vylouceni, Posledni_sync
  const overviewRows = payload.properties.map(p => {
    const pGuests = payload.guests.filter(g => g.propertyId === p.id);
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

  // Vyčistíme stará data pod záhlavím
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ranges: ['Ubytovani!A2:G500', 'Hoste!A2:T10000', 'Prehled_hlaseni!A2:G500']
    })
  });

  const data: any[] = [];

  // Update Nastaveni tab
  if (payload.apiKey && payload.apiKey.trim().length > 0) {
    const configRows = [
      ['GEMINI_API_KEY', payload.apiKey.trim(), 'Váš Google Gemini API klíč pro automatické OCR rozpoznávání'],
      ['PREFEROVANY_MODEL', payload.preferredModel || 'gemini-flash-latest', 'Aktivní model Gemini'],
      ['POSLEDNI_AKTUALIZACE', new Date().toISOString(), 'Čas poslední synchronizace']
    ];
    data.push({ range: 'Nastaveni!A2:C4', values: configRows });
  } else {
    data.push({
      range: 'Nastaveni!A3:C4',
      values: [
        ['PREFEROVANY_MODEL', payload.preferredModel || 'gemini-flash-latest', 'Aktivní model Gemini'],
        ['POSLEDNI_AKTUALIZACE', new Date().toISOString(), 'Čas poslední synchronizace']
      ]
    });
  }

  if (propRows.length > 0) {
    data.push({ range: `Ubytovani!A2:G${propRows.length + 1}`, values: propRows });
  }
  if (guestRows.length > 0) {
    data.push({ range: `Hoste!A2:T${guestRows.length + 1}`, values: guestRows });
  }
  if (overviewRows.length > 0) {
    data.push({ range: `Prehled_hlaseni!A2:G${overviewRows.length + 1}`, values: overviewRows });
  }

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data
      })
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.text();
    throw new Error(`Zápis do Google Sheetu selhal: ${err}`);
  }
}

/**
 * Uloží API klíč a preferovaný model do Nastaveni sešitu
 */
export async function saveSettingsToSheet(
  accessToken: string,
  spreadsheetId: string,
  apiKey: string,
  preferredModel: string
): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const rows = [
    ['GEMINI_API_KEY', apiKey || '', 'Váš Google Gemini API klíč pro automatické OCR rozpoznávání'],
    ['PREFEROVANY_MODEL', preferredModel || 'gemini-flash-latest', 'Aktivní model Gemini'],
    ['POSLEDNI_AKTUALIZACE', new Date().toISOString(), 'Čas poslední synchronizace']
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Nastaveni!A2:C4?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ values: rows })
  });
}

export async function saveModelToSheet(
  accessToken: string,
  spreadsheetId: string,
  preferredModel: string
): Promise<void> {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Nastaveni!B3?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({ values: [[preferredModel]] })
    }
  );
}

export const saveApiKeyToSheet = saveSettingsToSheet;

function extractSpreadsheetId(input: string): string {
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return input;
}

function getColumnLetter(colIndex: number): string {
  let letter = '';
  while (colIndex > 0) {
    const rem = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colIndex = Math.floor((colIndex - 1) / 26);
  }
  return letter;
}
