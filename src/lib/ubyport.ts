/**
 * UbyPort 2.0 (Cizinecká policie ČR) specifikace a pomocné utility
 * Formát souboru: .unl (plain-text, oddělovač pipe |, řádky zakončeny pipe a CRLF)
 * Kódování: ASCII / Windows-1250 (všechna textová pole VELKÝMI PÍSMENY BEZ DIAKRITIKY)
 */

import { Guest, Property } from '../types';

// Číselník účelů pobytu pro UbyPort 2.0
export const UBYPORT_PURPOSES: { code: string; label: string; description: string }[] = [
  { code: '1', label: '1 – Turistika / Leisure', description: 'Rekreace, poznávací cesty, dovolená' },
  { code: '2', label: '2 – Zaměstnání', description: 'Pracovní pobyt, brigáda, vyslání' },
  { code: '3', label: '3 – Studium', description: 'Škola, výměnný pobyt, stáž' },
  { code: '4', label: '4 – Obchod', description: 'Obchodní jednání, služební cesta' },
  { code: '5', label: '5 – Léčení', description: 'Lázně, lékařský zákrok, rekonvalescence' },
  { code: '6', label: '6 – Ostatní', description: 'Jiný účel pobytu' }
];

// Mapování 2místných kódů na 3místné ISO 3166-1 alpha-3 kódy
export const ISO2_TO_ISO3: Record<string, string> = {
  CZ: 'CZE',
  DE: 'DEU',
  SK: 'SVK',
  US: 'USA',
  GB: 'GBR',
  UK: 'GBR',
  PL: 'POL',
  AT: 'AUT',
  IT: 'ITA',
  FR: 'FRA',
  ES: 'ESP',
  UA: 'UKR',
  NL: 'NLD',
  BE: 'BEL',
  CH: 'CHE',
  HU: 'HUN',
  RO: 'ROU',
  BG: 'BGR',
  HR: 'HRV',
  SI: 'SVN',
  GR: 'GRC',
  PT: 'PRT',
  IE: 'IRL',
  SE: 'SWE',
  NO: 'NOR',
  DK: 'DNK',
  FI: 'FIN',
  IS: 'ISL',
  EE: 'EST',
  LV: 'LVA',
  LT: 'LTU',
  CA: 'CAN',
  AU: 'AUS',
  NZ: 'NZL',
  JP: 'JPN',
  KR: 'KOR',
  CN: 'CHN',
  IN: 'IND',
  IL: 'ISR',
  TR: 'TUR',
  RU: 'RUS',
  BY: 'BLR',
  MD: 'MDA',
  RS: 'SRB',
  BA: 'BIH',
  ME: 'MNE',
  MK: 'MKD',
  AL: 'ALB',
  BR: 'BRA',
  MX: 'MEX',
  AR: 'ARG',
  ZA: 'ZAF',
  AE: 'ARE',
  SG: 'SGP',
  TH: 'THA',
  VN: 'VNM',
  TW: 'TWN'
};

// Seznam nejčastějších států pro rychlý výběr
export const POPULAR_COUNTRIES: { code: string; name: string }[] = [
  { code: 'DEU', name: 'Německo (DEU)' },
  { code: 'SVK', name: 'Slovensko (SVK)' },
  { code: 'USA', name: 'Spojené státy (USA)' },
  { code: 'GBR', name: 'Velká Británie (GBR)' },
  { code: 'POL', name: 'Polsko (POL)' },
  { code: 'AUT', name: 'Rakousko (AUT)' },
  { code: 'ITA', name: 'Itálie (ITA)' },
  { code: 'FRA', name: 'Francie (FRA)' },
  { code: 'ESP', name: 'Španělsko (ESP)' },
  { code: 'UKR', name: 'Ukrajina (UKR)' },
  { code: 'NLD', name: 'Nizozemsko (NLD)' },
  { code: 'CHE', name: 'Švýcarsko (CHE)' },
  { code: 'CAN', name: 'Kanada (CAN)' },
  { code: 'AUS', name: 'Austrálie (AUS)' },
  { code: 'ISR', name: 'Izrael (ISR)' },
  { code: 'CZE', name: 'Česká republika (CZE - NEHLÁSÍ SE)' }
];

/**
 * Odstranění české a mezinárodní diakritiky, převod na velká písmena
 */
export function cleanAsciiUpper(input?: string): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Normalizace kódu státu na přesně 3 písmena ISO 3166-1 alpha-3
 */
export function normalizeCountryCode(code?: string): string {
  if (!code) return '';
  const trimmed = String(code).trim();
  if (/^US$|^USA$|UNITED STATES|AMERICA|AMERIK/i.test(trimmed)) return 'USA';
  if (/^DE$|^DEU$|GERMAN|DEUTSCH/i.test(trimmed)) return 'DEU';
  if (/^GB$|^GBR$|^UK$|UNITED KINGDOM|BRITAIN|ENGLAND/i.test(trimmed)) return 'GBR';
  if (/^CZ$|^CZE$|CZECH|CESK/i.test(trimmed)) return 'CZE';
  if (/^SK$|^SVK$|SLOVAK/i.test(trimmed)) return 'SVK';
  if (/^AT$|^AUT$|AUSTRI|RAKOUS/i.test(trimmed)) return 'AUT';
  if (/^PL$|^POL$|POLAND|POLSK/i.test(trimmed)) return 'POL';
  if (/^IT$|^ITA$|ITAL/i.test(trimmed)) return 'ITA';
  if (/^FR$|^FRA$|FRANC/i.test(trimmed)) return 'FRA';
  if (/^ES$|^ESP$|SPAIN|SPANEL|ESPANA/i.test(trimmed)) return 'ESP';
  if (/^UA$|^UKR$|UKRAIN/i.test(trimmed)) return 'UKR';
  if (/^NL$|^NLD$|NETHERLAND|HOLLAND|NIZOZEM/i.test(trimmed)) return 'NLD';
  if (/^CH$|^CHE$|SWISS|SWITZERLAND|SVYCAR/i.test(trimmed)) return 'CHE';
  if (/^CA$|^CAN$|CANADA|KANAD/i.test(trimmed)) return 'CAN';
  if (/^AU$|^AUS$|AUSTRAL/i.test(trimmed)) return 'AUS';

  const clean = cleanAsciiUpper(code).replace(/[^A-Z]/g, '');
  if (clean.length === 2 && ISO2_TO_ISO3[clean]) {
    return ISO2_TO_ISO3[clean];
  }
  if (clean.length === 3) {
    return clean;
  }
  return clean.substring(0, 3);
}

/**
 * Převede datum z formátu YYYY-MM-DD nebo DD.MM.YYYY do DD.MM.YYYY
 */
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  // Již ve formátu DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    return clean;
  }
  // ISO formát YYYY-MM-DD
  const matchIso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchIso) {
    const y = matchIso[1];
    const m = matchIso[2].padStart(2, '0');
    const d = matchIso[3].padStart(2, '0');
    return `${d}.${m}.${y}`;
  }
  // Případně formát D.M.YYYY
  const matchDots = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (matchDots) {
    const d = matchDots[1].padStart(2, '0');
    const m = matchDots[2].padStart(2, '0');
    const y = matchDots[3];
    return `${d}.${m}.${y}`;
  }
  return clean;
}

/**
 * Převede datum do ISO YYYY-MM-DD pro input type="date"
 */
export function parseDateToISO(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  const matchDots = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (matchDots) {
    const d = matchDots[1].padStart(2, '0');
    const m = matchDots[2].padStart(2, '0');
    const y = matchDots[3];
    return `${y}-${m}-${d}`;
  }
  return clean;
}

/**
 * Zkontroluje, zda je host občanem ČR (CZE / CZ).
 * Dle pravidel UbyPort 2.0 se občané ČR cizinecké policii NEHLÁSÍ!
 */
export function isCzechCitizen(nationality?: string): boolean {
  if (!nationality) return false;
  const norm = normalizeCountryCode(nationality);
  return norm === 'CZE' || norm === 'CZ';
}

/**
 * Pokusí se rozdělit volný text adresy na obec (město) a ulici s číslem
 */
export function parseAddressParts(rawAddress?: string): { city: string; street: string } {
  if (!rawAddress) return { city: '', street: '' };
  const clean = rawAddress.trim();

  // Často je adresa oddělena čárkou, např: "Hauptstrasse 12, Berlin" nebo "6917 S Queen St, Littleton, CO"
  const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const street = parts[0];
    const city = parts.slice(1).join(' ');
    return { city, street };
  }

  // Případně pokud je na jednom řádku, zkusíme najít první slovo / konec
  return {
    city: clean,
    street: ''
  };
}

export interface UnlValidationResult {
  isValid: boolean;
  isCzech: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validuje data hosta a ubytování před zařazením do UNL souboru
 */
export function validateGuestForUnl(guest: Guest, property?: Property): UnlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nationality = normalizeCountryCode(guest.nationality);
  const isCzech = nationality === 'CZE' || nationality === 'CZ';

  if (isCzech) {
    warnings.push('Občan ČR (CZE) – dle zákona se přes UbyPort nehlásí cizinecké policii.');
    return { isValid: false, isCzech: true, errors, warnings };
  }

  const idub = property?.idub || '';
  const facilityCode = property?.facilityCode || '';

  if (!idub.trim()) {
    errors.push('Chybí IDUB ubytovacího zařízení (přiděleno Policií ČR, např. CZ1234567890).');
  }
  if (!facilityCode.trim()) {
    errors.push('Chybí 5místná zkratka zařízení (přidělena Policií ČR, např. HOTEL).');
  } else if (facilityCode.trim().length > 5) {
    warnings.push('Zkratka zařízení by měla mít max 5 znaků.');
  }

  if (!guest.unit?.trim()) {
    errors.push('Chybí číslo pokoje / jednotky.');
  }

  if (!guest.lastName?.trim()) {
    errors.push('Chybí příjmení hosta.');
  }

  if (!guest.firstName?.trim()) {
    errors.push('Chybí jméno hosta.');
  }

  if (!guest.birthDate?.trim()) {
    errors.push('Chybí datum narození.');
  }

  if (!nationality || nationality.length !== 3) {
    errors.push(`Státní příslušnost musí být přesně 3písmenný ISO kód (zadáno: ${guest.nationality || 'prázdné'}).`);
  }

  const resCountry = normalizeCountryCode(guest.residenceCountry || guest.nationality);
  if (!resCountry || resCountry.length !== 3) {
    errors.push(`Stát trvalého bydliště musí být 3písmenný ISO kód.`);
  }

  if (!guest.city?.trim() && !guest.address?.trim()) {
    errors.push('Chybí obec (město) trvalého bydliště.');
  }

  if (!guest.idDocumentNumber?.trim()) {
    errors.push('Chybí číslo cestovního dokladu.');
  }

  const docType = cleanAsciiUpper(guest.idDocumentType || 'PAS');
  if (docType !== 'PAS' && docType !== 'OP') {
    warnings.push('Druh dokladu by měl být PAS (cestovní pas) nebo OP (občanský průkaz).');
  }

  const issuerCountry = normalizeCountryCode(guest.documentIssuerCountry || guest.nationality);
  if (!issuerCountry || issuerCountry.length !== 3) {
    errors.push('Stát vydání dokladu musí být 3písmenný ISO kód.');
  }

  if (!guest.dateArrival?.trim()) {
    errors.push('Chybí datum počátku ubytování.');
  }

  if (!guest.dateDeparture?.trim()) {
    errors.push('Chybí datum konce ubytování.');
  }

  // Kontrola data odjezdu >= příjezd
  if (guest.dateArrival && guest.dateDeparture) {
    const arr = new Date(parseDateToISO(guest.dateArrival));
    const dep = new Date(parseDateToISO(guest.dateDeparture));
    if (!isNaN(arr.getTime()) && !isNaN(dep.getTime()) && dep < arr) {
      errors.push('Datum konce ubytování nesmí předcházet datu příjezdu.');
    }
  }

  return {
    isValid: errors.length === 0,
    isCzech: false,
    errors,
    warnings
  };
}

/**
 * Generuje jeden řádek UNL souboru pro jednoho ubytovaného cizince
 *
 * 1. IDUB
 * 2. Zkratka zařízení (5 znaků)
 * 3. Číslo pokoje / jednotky
 * 4. Příjmení (VELKÝMI PÍSMENY, bez diakritiky)
 * 5. Jméno (VELKÝMI PÍSMENY, bez diakritiky)
 * 6. Datum narození (DD.MM.YYYY)
 * 7. Státní příslušnost (3znakový ISO)
 * 8. Stát trvalého bydliště (3znakový ISO)
 * 9. Obec trvalého bydliště (bez diakritiky)
 * 10. Ulice a číslo domu bydliště (bez diakritiky)
 * 11. Druh cestovního dokladu (OP / PAS)
 * 12. Číslo cestovního dokladu (alfanumerické bez mezer)
 * 13. Stát vydání dokladu (3znakový ISO)
 * 14. Číslo víza (volitelné)
 * 15. Účel pobytu (kód dle číselníku, např. 1)
 * 16. Počátek ubytování (DD.MM.YYYY)
 * 17. Konec ubytování (DD.MM.YYYY)
 * Každý řádek končí znakem | a \r\n (CRLF).
 */
export function generateUnlRow(guest: Guest, property: Property): string {
  const idub = cleanAsciiUpper(property.idub || '').replace(/\s/g, '');
  const facilityCode = cleanAsciiUpper(property.facilityCode || '').substring(0, 5).replace(/\s/g, '');
  const unit = cleanAsciiUpper(guest.unit || '1');
  const lastName = cleanAsciiUpper(guest.lastName || '');
  const firstName = cleanAsciiUpper(guest.firstName || '');
  const birthDate = formatDateDDMMYYYY(guest.birthDate);
  const nationality = normalizeCountryCode(guest.nationality) || '';
  const residenceCountry = normalizeCountryCode(guest.residenceCountry || guest.nationality || nationality);

  // Zpracování adresy
  let city = cleanAsciiUpper(guest.city || '');
  let street = cleanAsciiUpper(guest.street || '');
  if (!city && guest.address) {
    const parsed = parseAddressParts(guest.address);
    city = cleanAsciiUpper(parsed.city);
    street = cleanAsciiUpper(parsed.street);
  }
  if (!city) city = 'NEUVEDENO';

  let docType = cleanAsciiUpper(guest.idDocumentType || 'PAS');
  if (docType !== 'OP') docType = 'PAS';

  const docNumber = cleanAsciiUpper(guest.idDocumentNumber || '').replace(/\s/g, '');
  const issuerCountry = normalizeCountryCode(guest.documentIssuerCountry || guest.nationality || nationality);
  const visaNumber = cleanAsciiUpper(guest.visaNumber || '').replace(/\s/g, '');

  let purpose = String(guest.purposeOfStay || '1').trim();
  // Pokud je v purpose např. "10 turistika" nebo "1 turistika", vezmeme první číslici
  const purposeMatch = purpose.match(/^(\d)/);
  if (purposeMatch) {
    purpose = purposeMatch[1];
  } else {
    purpose = '1';
  }

  const arrival = formatDateDDMMYYYY(guest.dateArrival);
  const departure = formatDateDDMMYYYY(guest.dateDeparture);

  const fields = [
    idub,
    facilityCode,
    unit,
    lastName,
    firstName,
    birthDate,
    nationality,
    residenceCountry,
    city,
    street,
    docType,
    docNumber,
    issuerCountry,
    visaNumber,
    purpose,
    arrival,
    departure
  ];

  // Každý řádek končí znakem | a \r\n
  return fields.join('|') + '|\r\n';
}

/**
 * Vygeneruje kompletní obsah UNL souboru pro zadané hosty a nemovitost
 */
export function buildUnlFile(guests: Guest[], property: Property): {
  content: string;
  includedCount: number;
  excludedCzechCount: number;
  invalidCount: number;
} {
  let content = '';
  let includedCount = 0;
  let excludedCzechCount = 0;
  let invalidCount = 0;

  for (const guest of guests) {
    const val = validateGuestForUnl(guest, property);
    if (val.isCzech) {
      excludedCzechCount++;
      continue;
    }
    if (!val.isValid) {
      invalidCount++;
    }
    content += generateUnlRow(guest, property);
    includedCount++;
  }

  return {
    content,
    includedCount,
    excludedCzechCount,
    invalidCount
  };
}

/**
 * Parser pro import souboru UNL
 * Dokáže načíst řádky, rozparsovat 17 polí a vytvořit hosty i detekovat IDUB a zkratku
 */
export function parseUnlContent(
  rawContent: string,
  targetPropertyId?: string
): {
  importedGuests: Guest[];
  detectedFacility?: { idub: string; facilityCode: string };
  errors: string[];
} {
  const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const importedGuests: Guest[] = [];
  const errors: string[] = [];
  let detectedFacility: { idub: string; facilityCode: string } | undefined;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const parts = line.split('|');

    // Podle specifikace je 17 polí a řádek končí |, takže parts.length je minimálně 18
    if (parts.length < 17) {
      errors.push(`Řádek ${idx + 1}: Neplatný počet polí (${parts.length - 1} nalezeno, očekává se 17).`);
      continue;
    }

    const [
      idub,
      facilityCode,
      unit,
      lastName,
      firstName,
      birthDate,
      nationality,
      residenceCountry,
      city,
      street,
      docType,
      docNumber,
      issuerCountry,
      visaNumber,
      purpose,
      arrival,
      departure
    ] = parts;

    if (!detectedFacility && idub && facilityCode) {
      detectedFacility = {
        idub: idub.trim(),
        facilityCode: facilityCode.trim()
      };
    }

    // Převedeme data na ISO formát
    const isoBirth = parseDateToISO(birthDate);
    const isoArr = parseDateToISO(arrival);
    const isoDep = parseDateToISO(departure);

    // Spočítáme počet nocí
    let nights = 1;
    if (isoArr && isoDep) {
      const a = new Date(isoArr).getTime();
      const d = new Date(isoDep).getTime();
      if (!isNaN(a) && !isNaN(d) && d > a) {
        nights = Math.max(1, Math.round((d - a) / (1000 * 60 * 60 * 24)));
      }
    }

    const cleanLastName = cleanAsciiUpper(lastName);
    const cleanFirstName = cleanAsciiUpper(firstName);

    const guest: Guest = {
      id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      propertyId: targetPropertyId || '',
      unit: unit.trim(),
      airbnbCode: '',
      lastName: cleanLastName,
      firstName: cleanFirstName,
      fullName: `${cleanFirstName} ${cleanLastName}`.trim(),
      birthDate: isoBirth,
      nationality: normalizeCountryCode(nationality),
      residenceCountry: normalizeCountryCode(residenceCountry || nationality),
      city: cleanAsciiUpper(city),
      street: cleanAsciiUpper(street),
      address: `${cleanAsciiUpper(street)} ${cleanAsciiUpper(city)}`.trim(),
      idDocumentType: cleanAsciiUpper(docType) === 'OP' ? 'OP' : 'PAS',
      idDocumentNumber: cleanAsciiUpper(docNumber),
      documentIssuerCountry: normalizeCountryCode(issuerCountry || nationality),
      visaNumber: cleanAsciiUpper(visaNumber),
      purposeOfStay: purpose.trim() || '1',
      dateArrival: isoArr,
      dateDeparture: isoDep,
      nights,
      createdAt: new Date().toISOString()
    };

    importedGuests.push(guest);
  }

  return {
    importedGuests,
    detectedFacility,
    errors
  };
}

/**
 * Spustí stažení .unl souboru v prohlížeči
 */
export function downloadUnlFile(content: string, filename: string = 'ubyport_export.unl'): void {
  // UNL soubor je standardně ASCII/CP1250, v moderním webu text/plain s CRLF
  const blob = new Blob([content], { type: 'text/plain;charset=windows-1250' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
