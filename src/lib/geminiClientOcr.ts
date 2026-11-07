import { GoogleGenAI, Type } from '@google/genai';
import { normalizeCountryCode, parseAddressParts } from './ubyport';

const CANDIDATE_FLASH_MODELS = [
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite'
];

const OCR_PROMPT = `
Jsi špičkový OCR model pro digitalizaci ubytovacích lístků ("REGISTRATION FORM") a přípravu dat pro hlášení ubytovaných cizinců cizinecké policii ČR přes UbyPort 2.0.

Struktura formuláře (může být orientován svisle nebo vodorovně):
1. HLAVIČKA A IDENTIFIKACE ZAŘÍZENÍ:
   - Check-in (Příjezd) - např. Oct 1, 2026 -> převeď na ISO YYYY-MM-DD (2026-10-01).
   - Check-out (Odjezd) - např. Oct 8, 2026 -> převeď na ISO YYYY-MM-DD (2026-10-08).
   - Počet nocí (nights) - např. 7 nights -> číslo 7.
   - Označení jednotky / pokoje (unit) - např. Unit E302 nebo 102.
   - Název rezidence / ubytování (např. Karolina Plazza - Karlín).
   - Adresa ubytování (např. Sokolovská 694/102, 186 00 Praha 8).
   - IDUB ubytovacího zařízení (např. CZ1234567890, pokud je uvedeno).
   - Zkratka zařízení (např. HOTEL, APART, max 5 znaků, pokud je uvedeno).
   - Ubytovatel / Hostitel (např. Bc. Michaela Heidenreichová).

2. TABULKA UBYTOVANÝCH OSOB:
   - Zpracuj pouze skutečně fyzicky vyplněné řádky! Prázdné řádky ignoruj.
   - Do hodnot polí vkládej POUZE čistá data bez vysvětlivek.
   - Pro každou zapsanou osobu extrahuj:
     * Příjmení (Last name) - např. Kinkaid
     * Jméno (First name) - např. Kenneth
     * Datum narození (Date of birth) - ve formátu ISO YYYY-MM-DD (např. 01.10.1971 -> 1971-10-01)
     * Státní občanství / státní příslušnost (Citizenship) - 3místný ISO kód (např. USA, DEU, GBR, SVK, POL, ITA, FRA)
     * Stát trvalého bydliště - 3místný ISO kód (obvykle shodný s občanstvím, pokud není uveden jiný stát)
     * Obec trvalého bydliště (City) - např. Littleton
     * Ulice a číslo domu bydliště (Street and house number) - např. 6917 S Queen St
     * Celá adresa bydliště (Home Address)
     * Druh dokladu - PAS (cestovní pas) nebo OP (občanský průkaz / ID card)
     * Číslo cestovního dokladu (Passport / ID No) - např. A50465791
     * Stát vydání dokladu - 3místný ISO kód (obvykle stát občanství)
     * Číslo víza (Visa No) - pokud je uvedeno, jinak ""
     * Účel pobytu - číselný kód dle číselníku cizinecké policie:
       1 = turistika / rekreace (např. leisure, holiday, tourism)
       2 = zaměstnání / práce
       3 = studium
       4 = obchod / služební cesta (business)
       5 = léčení
       6 = ostatní

DŮLEŽITÉ: Každou osobu zahrň do pole 'guests' pouze JEDNOU. Všechny osoby na jednom lístku sdílejí Check-in, Check-out a počet nocí z hlavičky lístku.
`;

export async function runClientGeminiOcr(
  imageBase64: string,
  apiKey: string,
  preferredModel?: string,
  mimeType: string = 'image/jpeg'
): Promise<{ data: any; modelUsed: string }> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Chybí Gemini API klíč. Zadejte klíč v Nastavení nebo se připojte ke svému Google Sešitu.');
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

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
      const response = await ai.models.generateContent({
        model: candidate,
        contents: [
          {
            role: 'user',
            parts: [
              { text: OCR_PROMPT },
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
      console.warn(`Client OCR model ${candidate} failed:`, err);
      lastError = err;
    }
  }

  if (!extractedData) {
    throw lastError || new Error('Žádný z modelů Gemini nedokázal zpracovat obrázek.');
  }

  // Normalizace dat hostů
  if (Array.isArray(extractedData.guests)) {
    extractedData.guests = extractedData.guests.map((g: any) => {
      const nat = normalizeCountryCode(g.nationality);
      const resC = normalizeCountryCode(g.residenceCountry || g.nationality);
      const issC = normalizeCountryCode(g.documentIssuerCountry || g.nationality);
      let { city = '', street = '' } = g;
      if (!city && g.homeAddress) {
        const parsed = parseAddressParts(g.homeAddress);
        city = parsed.city;
        street = parsed.street;
      }
      return {
        ...g,
        nationality: nat,
        residenceCountry: resC,
        documentIssuerCountry: issC,
        city: city || g.city || '',
        street: street || g.street || '',
        documentType: /ID|OP|CARD/i.test(g.documentType || '') ? 'OP' : 'PAS'
      };
    });
  }

  return {
    data: extractedData,
    modelUsed: usedModel
  };
}

export interface GeminiModelInfo {
  name: string;
  displayName: string;
  description?: string;
  isRecommended?: boolean;
}

export const CURATED_OCR_MODELS: GeminiModelInfo[] = [
  {
    name: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    description: 'Nejnovější model s bleskovou rychlostí a vysokou přesností čtení.',
    isRecommended: true
  },
  {
    name: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    description: 'Rychlý multimodální model pro standardní dokumenty a formuláře.',
    isRecommended: true
  },
  {
    name: 'gemini-flash-latest',
    displayName: 'Gemini Flash Latest',
    description: 'Dynamický alias vždy směřující na nejnovější stabilní verzi Flash.',
    isRecommended: true
  },
  {
    name: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Maximální analytická přesnost pro obtížně čitelné a ručně psané lístky.',
    isRecommended: false
  },
  {
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Osvědčený lehký model s dlouhým kontextem.',
    isRecommended: false
  },
  {
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    description: 'Pokročilý multimodální model pro komplexní úlohy.',
    isRecommended: false
  }
];

export async function fetchAvailableGeminiModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Chybí Gemini API klíč. Zadejte jej prosím v nastavení nebo připojte Google Sheet.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
  );

  if (!response.ok) {
    let errMsg = `Chyba při komunikaci s Gemini API (kód ${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  const rawModels: any[] = Array.isArray(data.models) ? data.models : [];

  const validModels = rawModels.filter((m: any) => {
    const methods: string[] = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
    const name: string = m.name || '';
    const hasGenContent = methods.includes('generateContent');
    const isGemini = /gemini/i.test(name);
    const isNotUnsupported = !/embedding|aqa|imagen|learnlm|robotics/i.test(name);
    return hasGenContent && isGemini && isNotUnsupported;
  });

  if (validModels.length === 0) {
    return CURATED_OCR_MODELS;
  }

  const parsedList: GeminiModelInfo[] = validModels.map((m: any) => {
    const cleanId = String(m.name || '').replace(/^models\//, '');
    const isRecommended = /2\.5-flash|2\.0-flash|flash-latest/i.test(cleanId);
    return {
      name: cleanId,
      displayName: m.displayName || cleanId,
      description: m.description || '',
      isRecommended
    };
  });

  parsedList.sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return a.name.localeCompare(b.name);
  });

  return parsedList;
}
