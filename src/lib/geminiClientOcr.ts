import { normalizeCountryCode, parseAddressParts, cleanAsciiUpper } from './ubyport';

export const CANDIDATE_FLASH_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.5-pro'
];

export const OCR_PROMPT = `
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
       KRITICKÉ: Pokud je ve sloupci cokoliv zapsáno (např. 'A5046 5791', '5791', 'A50465791'), VŽDY tuto hodnotu zapiš bez mezer do 'passportNumber'! Nikdy nenechávej 'passportNumber' prázdné, pokud ve sloupci číslo je.
     * documentType: 'OP' pro občanský průkaz (ID card), 'PAS' pro cestovní pas. Pokud není zřejmé, použij 'PAS'.
     * homeAddress: Celá adresa ze sloupce 'trvalé bydliště v zahraničí / Home Address' (např. '6917 S Queen St, Littleton Co').
     * city: Město trvalého bydliště z adresy (např. 'Littleton').
     * street: Ulice a číslo z adresy bydliště (např. '6917 S Queen St').
     * visaNumber: Číslo víza ze sloupce 'číslo víza / Visa No'. Pokud je 'Same' nebo prázdné, zapiš ''.
     * purposeOfStay: Číslo účelu pobytu dle zaškrtnutého checkboxu (1 = turistika / leisure, 2 = zaměstnání / práce, 3 = studium, 4 = obchod, 5 = léčení, 6 = ostatní).
`;

export async function runClientGeminiOcr(
  imageBase64: string,
  apiKey: string,
  preferredModel?: string,
  mimeType: string = 'image/jpeg',
  signal?: AbortSignal
): Promise<{ data: any; modelUsed: string }> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    throw new Error('Chybí Gemini API klíč. Zadejte klíč v Nastavení nebo se připojte ke svému Google Sešitu.');
  }

  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  // Sestavení prioritní fronty modelů
  const modelQueue: string[] = [];
  if (preferredModel && preferredModel !== 'auto') {
    modelQueue.push(preferredModel);
  }
  CANDIDATE_FLASH_MODELS.forEach(m => {
    if (!modelQueue.includes(m)) modelQueue.push(m);
  });

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: OCR_PROMPT },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          detectedPropertyName: { type: 'STRING' },
          detectedAddress: { type: 'STRING' },
          detectedIDUB: { type: 'STRING' },
          detectedFacilityCode: { type: 'STRING' },
          detectedDistrictKey: { type: 'STRING' },
          detectedHostName: { type: 'STRING' },
          detectedVS: { type: 'STRING' },
          detectedUnit: { type: 'STRING' },
          dateArrival: { type: 'STRING' },
          dateDeparture: { type: 'STRING' },
          nights: { type: 'INTEGER' },
          guests: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                lastName: { type: 'STRING' },
                firstName: { type: 'STRING' },
                birthDate: { type: 'STRING' },
                nationality: { type: 'STRING' },
                residenceCountry: { type: 'STRING' },
                passportNumber: { type: 'STRING' },
                documentType: { type: 'STRING' },
                documentIssuerCountry: { type: 'STRING' },
                homeAddress: { type: 'STRING' },
                city: { type: 'STRING' },
                street: { type: 'STRING' },
                visaNumber: { type: 'STRING' },
                purposeOfStay: { type: 'STRING' }
              },
              required: ['lastName', 'firstName']
            }
          }
        },
        required: ['dateArrival', 'dateDeparture', 'nights', 'guests']
      }
    }
  };

  let lastError: any = null;
  let extractedData: any = null;
  let usedModel = '';

  for (const candidate of modelQueue) {
    if (signal?.aborted) {
      throw new Error('Skenování bylo zrušeno uživatelem.');
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    // Per-request timeout 18 sekund
    const timeoutController = new AbortController();
    const timerId = setTimeout(() => timeoutController.abort(), 18000);

    const onCallerAbort = () => {
      timeoutController.abort();
    };
    if (signal) {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: timeoutController.signal
      });

      clearTimeout(timerId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }

      if (response.ok) {
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          extractedData = JSON.parse(jsonText);
          usedModel = candidate;
          try {
            localStorage.setItem('ubyport_working_model', candidate);
            localStorage.setItem('airtax_working_model', candidate);
          } catch {
            // safe storage
          }
          break;
        }
      }

      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status}`;

      // Pokud model není dostupný (404), zkusíme plynule další
      if (response.status === 404 || errMsg.includes('not found') || errMsg.includes('not supported')) {
        console.warn(`Model ${candidate} není pro váš klíč dostupný, zkouším další...`);
        lastError = new Error(errMsg);
        continue;
      }

      // Neplatný klíč
      if (response.status === 400 || response.status === 403) {
        throw new Error(`Neplatný API klíč: ${errMsg}`);
      }

      lastError = new Error(`Chyba modelu ${candidate}: ${errMsg}`);
    } catch (callErr: any) {
      clearTimeout(timerId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
      if (signal?.aborted) {
        throw new Error('Skenování bylo zrušeno uživatelem.');
      }
      console.warn(`Model ${candidate} selhal:`, callErr.message || callErr);
      lastError = callErr;
    }
  }

  if (!extractedData) {
    throw lastError || new Error('Žádný z modelů Gemini nedokázal zpracovat obrázek.');
  }

  // Normalizace dat hostů
  if (Array.isArray(extractedData.guests)) {
    extractedData.guests = extractedData.guests.map((g: any) => {
      // 1. Občanství: priorita USA a přesná detekce
      const rawNat = String(g.nationality || '').trim();
      let nat = normalizeCountryCode(rawNat);
      if (/USA|AMERICA|UNITED STATES|^US$/i.test(rawNat)) {
        nat = 'USA';
      }

      // 2. Stát trvalého bydliště a vydání dokladu: defaultně stát občanství (žádné 'DEU'!)
      const resC = normalizeCountryCode(g.residenceCountry) || nat;
      const issC = normalizeCountryCode(g.documentIssuerCountry) || nat;

      // 3. Adresa
      let city = g.city || '';
      let street = g.street || '';
      if ((!city || !street) && g.homeAddress) {
        const parsed = parseAddressParts(g.homeAddress);
        if (!city) city = parsed.city;
        if (!street) street = parsed.street;
      }

      // 4. Číslo pasu / dokladu
      const passNum = String(g.passportNumber || g.idDocumentNumber || '').replace(/\s/g, '');

      return {
        ...g,
        lastName: cleanAsciiUpper(g.lastName),
        firstName: cleanAsciiUpper(g.firstName),
        nationality: nat,
        residenceCountry: resC,
        documentIssuerCountry: issC,
        passportNumber: passNum,
        idDocumentNumber: passNum,
        city: cleanAsciiUpper(city),
        street: cleanAsciiUpper(street),
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
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    description: 'Osvědčený lehký model s dlouhým kontextem.',
    isRecommended: false
  },
  {
    name: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    description: 'Maximální analytická přesnost pro obtížně čitelné a ručně psané lístky.',
    isRecommended: false
  }
];

export async function fetchAvailableGeminiModels(apiKey: string): Promise<GeminiModelInfo[]> {
  const cleanKey = (apiKey || '').trim();
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
