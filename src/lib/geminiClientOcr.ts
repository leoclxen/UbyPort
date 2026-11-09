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
Jsi špičkový multimodální OCR model pro digitalizaci ubytovacích lístků ("REGISTRATION FORM") a přípravu dat pro hlášení ubytovaných cizinců cizinecké policii ČR přes systém UbyPort 2.0.

KRITICKÁ PRAVIDLA PRO ORIENTACI OBRÁZKU A ČTENÍ:
- Tento formulář ("REGISTRATION FORM") může být vyfotografován pod libovolným úhlem: svisle, vodorovně, otočený o 90° doleva/doprava, o 180° vzhůru nohama nebo zešikma.
- Před jakýmkoliv čtením textu nejprve vizuálně detekuj orientaci tiskopisu (podle záhlaví 'REGISTRATION FORM', bloků 'Check-in', 'Check-out' nebo sloupců 'Last name', 'First name', 'Date of birth', 'Citizenship', 'Passport No').
- Otoč si formulář v paměti do správné orientace a čti texty ve správném směru čtení (shora dolů a zleva doprava).
- Vytěž VŠECHNA pole bez ohledu na to, pod jakým úhlem byl snímek pořízen!

Struktura formuláře:
1. HLAVIČKA POBYTU A ZAŘÍZENÍ:
   - Check-in: převeď na ISO datum YYYY-MM-DD (např. 'OCT 1, 2026' -> '2026-10-01').
   - Check-out: převeď na ISO datum YYYY-MM-DD (např. 'OCT 8, 2026' -> '2026-10-08').
   - Počet nocí (nights): celé číslo z pole 'nights' (např. '7 nights' -> 7).
   - Označení jednotky / pokoje (detectedUnit): např. 'Unit E302' nebo '102'.
   - Název rezidence / ubytování (detectedPropertyName): např. 'Karolina Plazza - Karlín'.
   - Adresa ubytování (detectedAddress): např. 'Sokolovská 694/102, 186 00 Praha 8' nebo 'Květinková 2570/17, 130 00 Praha 3'.
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

Vrať čistý JSON s touto strukturou:
{
  "detectedPropertyName": "string",
  "detectedAddress": "string",
  "detectedIDUB": "string",
  "detectedFacilityCode": "string",
  "detectedDistrictKey": "string",
  "detectedHostName": "string",
  "detectedVS": "string",
  "detectedUnit": "string",
  "dateArrival": "YYYY-MM-DD",
  "dateDeparture": "YYYY-MM-DD",
  "nights": 7,
  "guests": [
    {
      "lastName": "KINKAID",
      "firstName": "KENNETH",
      "birthDate": "1971-10-01",
      "nationality": "USA",
      "residenceCountry": "USA",
      "passportNumber": "A50465791",
      "documentType": "PAS",
      "documentIssuerCountry": "USA",
      "homeAddress": "6917 S Queen St, Littleton Co",
      "city": "Littleton",
      "street": "6917 S Queen St",
      "visaNumber": "",
      "purposeOfStay": "1"
    }
  ]
}
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
    throw new Error('Chybí Google API klíč. Klikněte na ikonu v záhlaví a zadejte svůj API klíč.');
  }

  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

  // Sestavení fronty modelů:
  // Pokud uživatel výslovně vybral model, použijeme POUZE tento model (bez tajného přepínání na gemini-2.5-pro!).
  const targetModel = (preferredModel || '').replace(/^models\//, '').trim();
  const isAuto = !targetModel || targetModel === 'auto';
  const modelQueue: string[] = isAuto
    ? ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-pro']
    : [targetModel];

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
      responseMimeType: 'application/json'
    }
  };

  let lastError: any = null;
  let extractedData: any = null;
  let usedModel = '';

  for (const candidate of modelQueue) {
    if (signal?.aborted) {
      throw new Error('Skenování bylo zrušeno uživatelem.');
    }

    const cleanCandidate = candidate.replace(/^models\//, '').trim();
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cleanCandidate)}:generateContent?key=${encodeURIComponent(cleanKey)}`;

    // Velkorysý timeout 45 sekund pro detailní multimodální OCR rozbor
    const timeoutController = new AbortController();
    const timerId = setTimeout(() => timeoutController.abort(), 45000);

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

      const contentType = response.headers.get('content-type') || '';

      if (response.ok && contentType.includes('application/json')) {
        const result = await response.json();
        const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          let clean = jsonText.trim();
          if (clean.startsWith('```')) {
            clean = clean.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
          }
          extractedData = JSON.parse(clean);
          usedModel = cleanCandidate;
          break;
        }
      }

      // Bezpečné načtení chybové hlášky bez neošetřeného JSON parse pádu
      const rawErrText = await response.text().catch(() => '');
      let errMsg = `HTTP ${response.status}`;
      try {
        const errJson = JSON.parse(rawErrText);
        if (errJson?.error?.message) {
          errMsg = errJson.error.message;
        }
      } catch {
        if (rawErrText && !rawErrText.includes('<html')) {
          errMsg = rawErrText.slice(0, 120);
        }
      }

      if (response.status === 400 || response.status === 403) {
        if (/API_KEY|key.*invalid|permission/i.test(errMsg)) {
          throw new Error(`Neplatný Google API klíč: ${errMsg}`);
        }
      }

      // Pokud byl model vybrán uživatelem a selhal, neschovávej chybu za jiný model
      if (!isAuto) {
        throw new Error(`Model ${cleanCandidate} vrátil chybu: ${errMsg}`);
      }

      lastError = new Error(`Chyba modelu ${cleanCandidate}: ${errMsg}`);
    } catch (callErr: any) {
      clearTimeout(timerId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
      if (signal?.aborted) {
        throw new Error('Skenování bylo zrušeno uživatelem.');
      }
      if (!isAuto) {
        // Uživatel si výslovně zvolil tento model – zobrazíme přesnou chybu jeho volby
        throw callErr;
      }
      console.warn(`Model ${candidate} selhal:`, callErr.message || callErr);
      lastError = callErr;
    }
  }

  if (!extractedData) {
    throw lastError || new Error(`Model ${targetModel || 'Gemini'} nedokázal zpracovat obrázek.`);
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
    throw new Error('Chybí Google API klíč. Zadejte jej prosím v nastavení nebo připojte Google Sheet.');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`
  );

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok || !contentType.includes('application/json')) {
    const rawText = await response.text().catch(() => '');
    let errMsg = `Chyba při komunikaci s Google API (${response.status})`;
    try {
      const errJson = JSON.parse(rawText);
      if (errJson?.error?.message) {
        errMsg = errJson.error.message;
      }
    } catch {
      if (rawText && !rawText.includes('<html')) {
        errMsg = `${errMsg}: ${rawText.slice(0, 100)}`;
      }
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
