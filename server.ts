import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as jsyaml from 'js-yaml';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Support JSON payloads up to 35MB for high-res mobile photos
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: true, limit: '35mb' }));

// Allow iframe embedding inside Google Sites
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.removeHeader('X-Frame-Options');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Path to persistent data.yaml on server
const DATA_FILE = path.join(__dirname, 'data.yaml');

export interface Property {
  id: string;
  name: string;
  idub: string;          // IDUB přidělené Policií ČR (např. CZ1234567890)
  facilityCode: string;  // 5místná zkratka zařízení (např. HOTEL)
  hostName: string;
  address: string;
  districtKey?: string;
  variableSymbol?: string;
}

export interface Guest {
  id: string;
  propertyId: string;
  unit: string;
  airbnbCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  nationality: string;
  residenceCountry?: string;
  city?: string;
  street?: string;
  address?: string;
  idDocumentType: string;
  idDocumentNumber: string;
  documentIssuerCountry?: string;
  visaNumber?: string;
  purposeOfStay: string;
  dateArrival: string;
  dateDeparture: string;
  nights: number;
  createdAt: string;
}

interface AppData {
  meta: {
    version: string;
    description: string;
    lastUpdated: string;
    activePropertyId: string;
  };
  properties: Property[];
  guests: Guest[];
}

function getDefaultData(): AppData {
  return {
    meta: {
      version: '3.1',
      description: 'UbyPort 2.0 - Evidence cizinců pro Policii ČR',
      lastUpdated: new Date().toISOString(),
      activePropertyId: ''
    },
    properties: [],
    guests: []
  };
}

function loadData(): AppData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = jsyaml.load(content) as any;
      if (parsed && typeof parsed === 'object') {
        return {
          meta: parsed.meta || {
            version: '3.1',
            description: 'UbyPort 2.0 - Evidence cizinců',
            lastUpdated: new Date().toISOString(),
            activePropertyId: ''
          },
          properties: Array.isArray(parsed.properties) ? parsed.properties : [],
          guests: Array.isArray(parsed.guests) ? parsed.guests : []
        };
      }
    }
  } catch (err) {
    console.error('Error reading data.yaml:', err);
  }
  const initial = getDefaultData();
  saveData(initial);
  return initial;
}

function saveData(data: AppData): void {
  try {
    data.meta.lastUpdated = new Date().toISOString();
    const yamlStr = jsyaml.dump(data, { indent: 2 });
    fs.writeFileSync(DATA_FILE, yamlStr, 'utf-8');
  } catch (err) {
    console.error('Error writing data.yaml:', err);
  }
}

// Ensure data file exists on server startup
loadData();

// ----------------------------------------------------
// API ROUTES FOR MULTI-DEVICE PERSISTENCE
// ----------------------------------------------------

// 1. Get full app state
app.get('/api/data', (_req, res) => {
  const data = loadData();
  res.json({
    properties: data.properties,
    guests: data.guests,
    activePropertyId: data.meta.activePropertyId || (data.properties[0]?.id ?? '')
  });
});

// 2. Add or update property
app.post('/api/properties', (req, res) => {
  const data = loadData();
  const { id, name, idub, facilityCode, hostName, address, districtKey, variableSymbol } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Název ubytování je povinný' });
  }

  const propId = id || `prop_${Date.now()}`;
  const existingIdx = data.properties.findIndex(p => p.id === propId);

  const updatedProp: Property = {
    id: propId,
    name: name.trim(),
    idub: (idub || '').trim().toUpperCase(),
    facilityCode: (facilityCode || '').trim().toUpperCase().substring(0, 5),
    hostName: (hostName || '').trim(),
    address: (address || '').trim(),
    districtKey: districtKey || 'praha8',
    variableSymbol: (variableSymbol || '').trim()
  };

  if (existingIdx >= 0) {
    data.properties[existingIdx] = updatedProp;
  } else {
    data.properties.push(updatedProp);
    if (!data.meta.activePropertyId) {
      data.meta.activePropertyId = propId;
    }
  }

  saveData(data);
  res.json({ success: true, property: updatedProp, properties: data.properties, activePropertyId: data.meta.activePropertyId });
});

// 3. Delete property
app.delete('/api/properties/:id', (req, res) => {
  const data = loadData();
  const propId = req.params.id;

  data.properties = data.properties.filter(p => p.id !== propId);
  data.guests = data.guests.filter(g => g.propertyId !== propId);

  if (data.meta.activePropertyId === propId) {
    data.meta.activePropertyId = data.properties[0]?.id || '';
  }

  saveData(data);
  res.json({ success: true, properties: data.properties, guests: data.guests, activePropertyId: data.meta.activePropertyId });
});

// 4. Set active property
app.post('/api/active-property', (req, res) => {
  const data = loadData();
  const { propertyId } = req.body;
  data.meta.activePropertyId = propertyId || '';
  saveData(data);
  res.json({ success: true, activePropertyId: data.meta.activePropertyId });
});

// 5. Add or update guest
app.post('/api/guests', (req, res) => {
  const data = loadData();
  const g = req.body;

  const id = g.id || `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const nights = Math.max(1, parseInt(g.nights) || 1);

  const guestRecord: Guest = {
    id,
    propertyId: g.propertyId || data.meta.activePropertyId,
    unit: (g.unit || '').trim(),
    airbnbCode: (g.airbnbCode || '').trim().toUpperCase(),
    firstName: (g.firstName || '').trim(),
    lastName: (g.lastName || '').trim(),
    fullName: (g.fullName || `${g.firstName || ''} ${g.lastName || ''}`).trim() || 'Host',
    birthDate: g.birthDate || '',
    nationality: (g.nationality || '').trim().toUpperCase(),
    residenceCountry: (g.residenceCountry || g.nationality || '').trim().toUpperCase(),
    city: (g.city || '').trim(),
    street: (g.street || '').trim(),
    address: (g.address || '').trim(),
    idDocumentType: (g.idDocumentType || 'PAS').trim().toUpperCase(),
    idDocumentNumber: (g.idDocumentNumber || '').trim(),
    documentIssuerCountry: (g.documentIssuerCountry || g.nationality || '').trim().toUpperCase(),
    visaNumber: (g.visaNumber || '').trim(),
    purposeOfStay: (g.purposeOfStay || '1').trim(),
    dateArrival: g.dateArrival || '',
    dateDeparture: g.dateDeparture || '',
    nights,
    createdAt: g.createdAt || new Date().toISOString()
  };

  const existingIdx = data.guests.findIndex(item => item.id === id);
  if (existingIdx >= 0) {
    data.guests[existingIdx] = guestRecord;
  } else {
    data.guests.unshift(guestRecord);
  }

  saveData(data);
  res.json({ success: true, guest: guestRecord, guests: data.guests });
});

// 6. Delete guest
app.delete('/api/guests/:id', (req, res) => {
  const data = loadData();
  data.guests = data.guests.filter(g => g.id !== req.params.id);
  saveData(data);
  res.json({ success: true, guests: data.guests });
});

// 7. Batch add guests (from OCR scan or UNL import)
app.post('/api/batch-guests', (req, res) => {
  const data = loadData();
  const { property, guests: incomingGuests } = req.body;

  let propId = property?.id || data.meta.activePropertyId;

  if (property && property.name) {
    const existingIdx = data.properties.findIndex(
      p => p.id === property.id || (p.name.toLowerCase() === property.name.toLowerCase())
    );
    if (existingIdx >= 0) {
      propId = data.properties[existingIdx].id;
      // Aktualizovat IDUB / Zkratku pokud byla dodána
      if (property.idub && !data.properties[existingIdx].idub) {
        data.properties[existingIdx].idub = property.idub;
      }
      if (property.facilityCode && !data.properties[existingIdx].facilityCode) {
        data.properties[existingIdx].facilityCode = property.facilityCode;
      }
    } else {
      propId = property.id || `prop_${Date.now()}`;
      const newProp: Property = {
        id: propId,
        name: property.name,
        idub: property.idub || '',
        facilityCode: property.facilityCode || '',
        hostName: property.hostName || '',
        address: property.address || '',
        districtKey: property.districtKey || 'praha8',
        variableSymbol: property.variableSymbol || ''
      };
      data.properties.push(newProp);
      if (!data.meta.activePropertyId) {
        data.meta.activePropertyId = propId;
      }
    }
  }

  if (Array.isArray(incomingGuests)) {
    incomingGuests.forEach((g: any) => {
      const nights = Math.max(1, parseInt(g.nights) || 1);
      data.guests.unshift({
        id: g.id || `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        propertyId: propId,
        unit: (g.unit || '').trim(),
        airbnbCode: (g.airbnbCode || '').trim().toUpperCase(),
        firstName: (g.firstName || '').trim(),
        lastName: (g.lastName || '').trim(),
        fullName: (g.fullName || `${g.firstName || ''} ${g.lastName || ''}`).trim() || 'Host',
        birthDate: g.birthDate || '',
        nationality: (g.nationality || '').trim().toUpperCase(),
        residenceCountry: (g.residenceCountry || g.nationality || '').trim().toUpperCase(),
        city: (g.city || '').trim(),
        street: (g.street || '').trim(),
        address: (g.address || '').trim(),
        idDocumentType: (g.idDocumentType || 'PAS').trim().toUpperCase(),
        idDocumentNumber: (g.idDocumentNumber || '').trim(),
        documentIssuerCountry: (g.documentIssuerCountry || g.nationality || '').trim().toUpperCase(),
        visaNumber: (g.visaNumber || '').trim(),
        purposeOfStay: (g.purposeOfStay || '1').trim(),
        dateArrival: g.dateArrival || '',
        dateDeparture: g.dateDeparture || '',
        nights,
        createdAt: new Date().toISOString()
      });
    });
  }

  saveData(data);
  res.json({
    success: true,
    properties: data.properties,
    guests: data.guests,
    activePropertyId: data.meta.activePropertyId
  });
});

// 8. Reset data to pristine zero state
app.post('/api/reset-data', (_req, res) => {
  const fresh = getDefaultData();
  saveData(fresh);
  res.json({ success: true, properties: [], guests: [], activePropertyId: '' });
});

// 9. Export raw data.yaml content
app.get('/api/export/yaml', (_req, res) => {
  const data = loadData();
  const yamlContent = jsyaml.dump(data, { indent: 2 });
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="data.yaml"');
  res.send(yamlContent);
});

// 10. Import data.yaml content
app.post('/api/import/yaml', (req, res) => {
  try {
    const { yamlContent } = req.body;
    if (!yamlContent) {
      return res.status(400).json({ error: 'Nebyl zaslán obsah YAML' });
    }
    const parsed = jsyaml.load(yamlContent) as any;
    if (!parsed || typeof parsed !== 'object') {
      return res.status(400).json({ error: 'Neplatný YAML formát' });
    }

    const newData: AppData = {
      meta: parsed.meta || {
        version: '3.1',
        description: 'UbyPort 2.0 - Evidence cizinců',
        lastUpdated: new Date().toISOString(),
        activePropertyId: ''
      },
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      guests: Array.isArray(parsed.guests) ? parsed.guests : []
    };

    if (!newData.meta.activePropertyId && newData.properties.length > 0) {
      newData.meta.activePropertyId = newData.properties[0].id;
    }

    saveData(newData);
    res.json({
      success: true,
      properties: newData.properties,
      guests: newData.guests,
      activePropertyId: newData.meta.activePropertyId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chyba při importu YAML' });
  }
});

// ----------------------------------------------------
// DYNAMIC OCR ENGINE ROUTE (GEMINI MULTI-MODEL FALLBACK)
// ----------------------------------------------------

const CANDIDATE_FLASH_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.5-pro'
];

app.post('/api/ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', userApiKey, preferredModel } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Chybí obrazová data formuláře (Base64).' });
    }

    const effectiveApiKey = (userApiKey && userApiKey.trim()) || process.env.GEMINI_API_KEY;

    if (!effectiveApiKey) {
      return res.status(401).json({
        error: 'Není nastaven API klíč. Zadejte klíč v nastavení aplikace nebo v prostředí AI Studio.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey: effectiveApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

    const promptInstructions = `
Jsi špičkový OCR model pro digitalizaci ubytovacích lístků ("REGISTRATION FORM") a přípravu dat pro hlášení ubytovaných cizinců cizinecké policii ČR přes UbyPort 2.0.
Formulář může být orientován libovolně: svisle, vodorovně, i otočený o 90°, 180° nebo 270°.

Struktura formuláře:
1. HLAVIČKA POBYTU A ZAŘÍZENÍ:
   - Check-in: převeď na ISO datum YYYY-MM-DD (např. 'OCT 1, 2026' -> '2026-10-01').
   - Check-out: převeď na ISO datum YYYY-MM-DD (např. 'OCT 8, 2026' -> '2026-10-08').
   - Počet nocí (nights): celé číslo z pole 'nights' (např. '7 nights' -> 7).
   - Označení jednotky / pokoje (detectedUnit): např. 'Unit E302' nebo '102'.
   - Název rezidence / ubytování (detectedPropertyName): např. 'Karolina Plazza - Karlín'.
   - Adresa ubytování (detectedAddress): např. 'Sokolovská 694/102, 186 00 Praha 8'.
   - IDUB ubytovacího zařízení (detectedIDUB): pokud je uvedeno (např. CZ1234567890).
   - Zkratka zařízení (detectedFacilityCode): max 5 znaků (např. HOTEL, APART).
   - Ubytovatel / Hostitel (detectedHostName): např. 'Bc. Michaela Heidenreichová'.
   - IČO / Variabilní symbol (detectedVS): např. '17974305'.

2. TABULKA UBYTOVANÝCH OSOB:
   - Zpracuj pouze fyzicky vyplněné řádky osob! Prázdné řádky ignoruj.
   - Všechny osoby sdílejí Check-in, Check-out a počet nocí z hlavičky formuláře.
   - Pro každou zapsanou osobu extrahuj:
     * lastName: Příjmení hosta ze sloupce 'příjmení / Last name'. VELKÝMI PÍSMENY bez diakritiky (např. KINKAID).
     * firstName: Jméno hosta ze sloupce 'jméno / First name'. VELKÝMI PÍSMENY bez diakritiky (např. KENNETH).
     * birthDate: Datum narození ze sloupce 'datum narození / Date of birth' ve formátu ISO YYYY-MM-DD (např. '01.10.1971' -> '1971-10-01').
     * nationality: Státní příslušnost / občanství ze sloupce 'státní občanství / Citizenship'.
       KRITICKÉ: VŽDY převeď na 3místný ISO 3166-1 alpha-3 kód.
       Pokud je napsáno 'USA', 'US' nebo 'United States', MUSÍ BÝT 'USA'! NIKDY nenastavuj 'DEU'!
       Pokud je 'DE' nebo 'Germany', 'DEU'.
       Pokud je 'GB' nebo 'UK', 'GBR'.
       Pokud je 'CZ' nebo 'Česká', 'CZE'.
       Pokud je 'SK' nebo 'Slovensko', 'SVK'.
     * passportNumber: Číslo cestovního pasu nebo OP ze sloupce 'č. cestovního dokladu / Passport No'.
       KRITICKÉ: Pokud je ve sloupci cokoliv napsáno (např. 'A5046 5791', '5791', 'A50465791'), VŽDY tuto hodnotu zapiš bez mezer do 'passportNumber'! Nikdy nenechávej 'passportNumber' prázdné, pokud ve sloupci číslo je.
     * documentType: 'OP' pro občanský průkaz (ID card), 'PAS' pro cestovní pas. Pokud není zřejmé, použij 'PAS'.
     * homeAddress: Celá adresa ze sloupce 'trvalé bydliště v zahraničí / Home Address' (např. '6917 S Queen St, Littleton Co').
     * city: Město trvalého bydliště z adresy (např. 'Littleton').
     * street: Ulice a číslo z adresy bydliště (např. '6917 S Queen St').
     * visaNumber: Číslo víza ze sloupce 'číslo víza / Visa No'. Pokud je 'Same' nebo prázdné, zapiš ''.
     * purposeOfStay: Číslo účelu pobytu dle zaškrtnutého checkboxu (1 = turistika / leisure, 2 = zaměstnání / práce, 3 = studium, 4 = obchod, 5 = léčení, 6 = ostatní).
`;

    const modelQueue: string[] = [];
    if (preferredModel && preferredModel !== 'auto') {
      modelQueue.push(preferredModel);
    }
    CANDIDATE_FLASH_MODELS.forEach(m => {
      if (!modelQueue.includes(m)) modelQueue.push(m);
    });

    let lastError: any = null;
    let extractedData: any = null;
    let usedModel = '';

    for (const candidate of modelQueue) {
      try {
        console.log(`[OCR] Trying model: ${candidate}`);
        const response = await ai.models.generateContent({
          model: candidate,
          contents: [
            {
              role: 'user',
              parts: [
                { text: promptInstructions },
                {
                  inlineData: {
                    mimeType,
                    data: cleanBase64
                  }
                }
              ]
            }
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedPropertyName: { type: Type.STRING },
                detectedAddress: { type: Type.STRING },
                detectedIDUB: { type: Type.STRING },
                detectedFacilityCode: { type: Type.STRING },
                detectedDistrictKey: { type: Type.STRING },
                detectedHostName: { type: Type.STRING },
                detectedVS: { type: Type.STRING },
                detectedUnit: { type: Type.STRING },
                dateArrival: { type: Type.STRING },
                dateDeparture: { type: Type.STRING },
                nights: { type: Type.INTEGER },
                guests: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      lastName: { type: Type.STRING },
                      firstName: { type: Type.STRING },
                      birthDate: { type: Type.STRING },
                      nationality: { type: Type.STRING },
                      residenceCountry: { type: Type.STRING },
                      city: { type: Type.STRING },
                      street: { type: Type.STRING },
                      homeAddress: { type: Type.STRING },
                      documentType: { type: Type.STRING },
                      passportNumber: { type: Type.STRING },
                      documentIssuerCountry: { type: Type.STRING },
                      visaNumber: { type: Type.STRING },
                      purposeOfStay: { type: Type.STRING }
                    },
                    required: ['lastName', 'firstName']
                  }
                }
              },
              required: ['dateArrival', 'dateDeparture', 'nights', 'guests']
            }
          }
        });

        const rawText = response.text;
        if (rawText) {
          extractedData = JSON.parse(rawText);
          usedModel = candidate;
          break;
        }
      } catch (err: any) {
        console.warn(`[OCR] Model ${candidate} failed:`, err.message || err);
        lastError = err;
      }
    }

    if (!extractedData) {
      throw lastError || new Error('Žádný z dostupných modelů Gemini nedokázal zpracovat obrázek.');
    }

    res.json({
      success: true,
      modelUsed: usedModel,
      data: extractedData
    });
  } catch (error: any) {
    console.error('[OCR Error]', error);
    res.status(500).json({
      error: error.message || 'Nepodařilo se zpracovat dokument pomocí Gemini OCR.'
    });
  }
});

// ----------------------------------------------------
// VITE DEV SERVER OR STATIC PRODUCTION SERVING
// ----------------------------------------------------

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT} (isProd: ${isProd})`);
  });
}

startServer();
