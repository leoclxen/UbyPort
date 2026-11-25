/**
 * UbyPort (Ředitelství služby cizinecké policie ČR)
 * Oficiální specifikace dle Přílohy č. 3 Provozního řádu IA Ubyport (aktualizace 22.02.2018)
 *
 * - Záznam typu A (hlavička ubytovacího zařízení): 1. řádek, 16 polí oddělených '|'
 * - Záznam typu U (ubytovaný cizinec): následující řádky, 16 polí oddělených '|'
 * - Kódování souboru: CP1250 (Windows-1250), konce řádků CRLF (\r\n)
 * - Bez koncového svislítka '|' za 16. polem
 */

import { Guest, Property, PRAGUE_DISTRICTS } from '../types';

// Oficiální dvouciferný číselník účelu pobytu (bod 3 Provozního řádu IA Ubyport)
export const UBYPORT_PURPOSES: { code: string; label: string; description: string }[] = [
  { code: '10', label: '10 – Turistika', description: 'Rekreace, poznávací cesty, dovolená (Airbnb / Booking)' },
  { code: '01', label: '01 – Obchodní', description: 'Obchodní jednání, pracovní / služební cesta' },
  { code: '27', label: '27 – Zaměstnání', description: 'Zaměstnání, brigáda, vyslání k výkonu práce' },
  { code: '11', label: '11 – Studium / stáž', description: 'Škola, univerzita, výměnný pobyt, školení' },
  { code: '00', label: '00 – Zdravotní', description: 'Léčení, lázně, lékařský zákrok' },
  { code: '02', label: '02 – Kulturní', description: 'Kulturní akce, festival, umělecká činnost' },
  { code: '03', label: '03 – Návštěva rodiny / přátel', description: 'Soukromá návštěva rodiny nebo známých' },
  { code: '04', label: '04 – Pozvání', description: 'Pobyt na základě úředního pozvání' },
  { code: '05', label: '05 – Oficiální / politický', description: 'Diplomatická či oficiální delegace' },
  { code: '06', label: '06 – Podnikání', description: 'Podnikatelská činnost / OSVČ' },
  { code: '07', label: '07 – Sportovní', description: 'Sportovní utkání, soustředění, turnaj' },
  { code: '12', label: '12 – Tranzit', description: 'Průjezd územím ČR' },
  { code: '13', label: '13 – Letištní tranzit', description: 'Průjezd přes mezinárodní letiště' },
  { code: '93', label: '93 – ADS vízum', description: 'Organizovaná turistika ADS' },
  { code: '99', label: '99 – Ostatní', description: 'Jiný neuvedený účel pobytu' }
];

const VALID_PURPOSE_CODES = new Set(UBYPORT_PURPOSES.map(p => p.code));

const LEGACY_PURPOSE_MAP: Record<string, string> = {
  '1': '10',
  '2': '27',
  '3': '11',
  '4': '01',
  '5': '00',
  '6': '99'
};

/**
 * Normalizuje účel pobytu na oficiální 2ciferný kód (včetně migrace starých kódů 1–6)
 */
export function normalizePurposeCode(raw?: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '10';

  const twoDigitMatch = trimmed.match(/^(\d{2})\b/);
  if (twoDigitMatch && VALID_PURPOSE_CODES.has(twoDigitMatch[1])) {
    return twoDigitMatch[1];
  }

  const singleDigitMatch = trimmed.match(/^(\d)$/);
  if (singleDigitMatch && LEGACY_PURPOSE_MAP[singleDigitMatch[1]]) {
    return LEGACY_PURPOSE_MAP[singleDigitMatch[1]];
  }

  if (/^\d{2}$/.test(trimmed) && VALID_PURPOSE_CODES.has(trimmed)) {
    return trimmed;
  }

  // Fallback podle textu
  if (/zamest|work|employ|prace/i.test(trimmed)) return '27';
  if (/stud|school|educat/i.test(trimmed)) return '11';
  if (/obchod|busin|sluzeb/i.test(trimmed)) return '01';
  if (/zdrav|lec|medic|spa/i.test(trimmed)) return '00';
  if (/sport/i.test(trimmed)) return '07';
  if (/kultur/i.test(trimmed)) return '02';
  if (/navstev|visit|family/i.test(trimmed)) return '03';
  if (/tranzit|transit/i.test(trimmed)) return '12';
  if (/ostat|other|jin/i.test(trimmed)) return '99';

  return '10';
}

// Mapování 2místných kódů na 3místné ISO 3166-1 alpha-3 / ICAO kódy
export const ISO2_TO_ISO3: Record<string, string> = {
  CZ: 'CZE', DE: 'DEU', SK: 'SVK', US: 'USA', GB: 'GBR', UK: 'GBR',
  PL: 'POL', AT: 'AUT', IT: 'ITA', FR: 'FRA', ES: 'ESP', UA: 'UKR',
  NL: 'NLD', BE: 'BEL', CH: 'CHE', HU: 'HUN', RO: 'ROU', BG: 'BGR',
  HR: 'HRV', SI: 'SVN', GR: 'GRC', PT: 'PRT', IE: 'IRL', SE: 'SWE',
  NO: 'NOR', DK: 'DNK', FI: 'FIN', IS: 'ISL', EE: 'EST', LV: 'LVA',
  LT: 'LTU', CA: 'CAN', AU: 'AUS', NZ: 'NZL', JP: 'JPN', KR: 'KOR',
  CN: 'CHN', IN: 'IND', IL: 'ISR', TR: 'TUR', RU: 'RUS', BY: 'BLR',
  MD: 'MDA', RS: 'SRB', BA: 'BIH', ME: 'MNE', MK: 'MKD', AL: 'ALB',
  BR: 'BRA', MX: 'MEX', AR: 'ARG', ZA: 'ZAF', AE: 'ARE', SG: 'SGP',
  TH: 'THA', VN: 'VNM', TW: 'TWN'
};

export const COUNTRY_NAMES_CS: Record<string, string> = {
  DEU: 'Německo',
  SVK: 'Slovensko',
  USA: 'Spojené státy americké',
  GBR: 'Spojené království',
  POL: 'Polsko',
  AUT: 'Rakousko',
  ITA: 'Itálie',
  FRA: 'Francie',
  ESP: 'Španělsko',
  UKR: 'Ukrajina',
  NLD: 'Nizozemsko',
  BEL: 'Belgie',
  CHE: 'Švýcarsko',
  HUN: 'Maďarsko',
  ROU: 'Rumunsko',
  BGR: 'Bulharsko',
  HRV: 'Chorvatsko',
  SVN: 'Slovinsko',
  GRC: 'Řecko',
  PRT: 'Portugalsko',
  IRL: 'Irsko',
  SWE: 'Švédsko',
  NOR: 'Norsko',
  DNK: 'Dánsko',
  FIN: 'Finsko',
  ISL: 'Island',
  EST: 'Estonsko',
  LVA: 'Lotyšsko',
  LTU: 'Litva',
  CAN: 'Kanada',
  AUS: 'Austrálie',
  NZL: 'Nový Zéland',
  JPN: 'Japonsko',
  KOR: 'Korejská republika',
  CHN: 'Čína',
  IND: 'Indie',
  ISR: 'Izrael',
  TUR: 'Turecko',
  RUS: 'Rusko',
  BLR: 'Bělorusko',
  MDA: 'Moldavsko',
  SRB: 'Srbsko',
  BIH: 'Bosna a Hercegovina',
  MNE: 'Černá Hora',
  MKD: 'Severní Makedonie',
  ALB: 'Albánie',
  BRA: 'Brazílie',
  MEX: 'Mexiko',
  ARG: 'Argentina',
  ZAF: 'Jihoafrická republika',
  ARE: 'Spojené arabské emiráty',
  SGP: 'Singapur',
  THA: 'Thajsko',
  VNM: 'Vietnam',
  TWN: 'Tchaj-wan',
  CZE: 'Česká republika'
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

// Kompletní tabulka CP1250 (Windows-1250) pro bajty 0x80–0xFF
const CP1250_HIGH_CHARS: string[] = [
  '\u20AC', '\uFFFD', '\u201A', '\uFFFD', '\u201E', '\u2026', '\u2020', '\u2021', // 80-87
  '\uFFFD', '\u2030', '\u0160', '\u2039', '\u015A', '\u0164', '\u017D', '\u0179', // 88-8F
  '\uFFFD', '\u2018', '\u2019', '\u201C', '\u201D', '\u2022', '\u2013', '\u2014', // 90-97
  '\uFFFD', '\u2122', '\u0161', '\u203A', '\u015B', '\u0165', '\u017E', '\u017A', // 98-9F
  '\u00A0', '\u02C7', '\u02D8', '\u0141', '\u00A4', '\u0104', '\u00A6', '\u00A7', // A0-A7
  '\u00A8', '\u00A9', '\u015E', '\u00AB', '\u00AC', '\u00AD', '\u00AE', '\u017B', // A8-AF
  '\u00B0', '\u00B1', '\u02DB', '\u0142', '\u00B4', '\u00B5', '\u00B6', '\u00B7', // B0-B7
  '\u00B8', '\u0105', '\u015F', '\u00BB', '\u013D', '\u02DD', '\u013E', '\u017C', // B8-BF
  '\u0154', '\u00C1', '\u00C2', '\u0102', '\u00C4', '\u0139', '\u0106', '\u00C7', // C0-C7
  '\u010C', '\u00C9', '\u0118', '\u00CB', '\u011A', '\u00CD', '\u00CE', '\u010E', // C8-CF
  '\u0110', '\u0143', '\u0147', '\u00D3', '\u00D4', '\u0150', '\u00D6', '\u00D7', // D0-D7
  '\u0158', '\u016E', '\u00DA', '\u0170', '\u00DC', '\u00DD', '\u0162', '\u00DF', // D8-DF
  '\u0155', '\u00E1', '\u00E2', '\u0103', '\u00E4', '\u013A', '\u0107', '\u00E7', // E0-E7
  '\u010D', '\u00E9', '\u0119', '\u00EB', '\u011B', '\u00ED', '\u00EE', '\u010F', // E8-EF
  '\u0111', '\u0144', '\u0148', '\u00F3', '\u00F4', '\u0151', '\u00F6', '\u00F7', // F0-F7
  '\u0159', '\u016F', '\u00FA', '\u0171', '\u00FC', '\u00FD', '\u0163', '\u02D9'  // F8-FF
];

const UNICODE_TO_CP1250 = new Map<number, number>();
for (let i = 0; i < CP1250_HIGH_CHARS.length; i++) {
  const ch = CP1250_HIGH_CHARS[i];
  if (ch !== '\uFFFD') {
    UNICODE_TO_CP1250.set(ch.charCodeAt(0), 0x80 + i);
  }
}

// Povolené znaky dle kap. 2.4.1 Přílohy č. 3 (Name a Bydliště)
const PERMITTED_NAME_LETTERS =
  'a-zA-ZĄŁĽŚŠŞŤŹŽŻąłľśšşťźžżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖŘŮÚŰÜÝŢŕáâăäĺćçčéęëěíîďđńňóôőöřůúűüýţß';

const NAME_ALLOWED_CHAR_REGEX = new RegExp(`[^${PERMITTED_NAME_LETTERS} '\\-]`, 'g');
const BYDLISTE_ALLOWED_CHAR_REGEX = new RegExp(`[^${PERMITTED_NAME_LETTERS}0-9 '\\-\\/\\.,;:()&#@]`, 'g');

/**
 * Odstranění diakritiky a převod na velká ASCII písmena (pro IDUB, zkratky, čísla dokladů, ISO kódy)
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
 * Převede znaky mimo CP1250 do bezpečné CP1250 / ASCII podoby a ošetří CR, LF a '|' (kap. 2.1 a 3.1)
 */
export function sanitizeCp1250Field(input?: string, isNote: boolean = false): string {
  if (!input) return '';
  // Odstranit CR, nahradit LF za ", ", ošetřit '|'
  let s = String(input)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/\n/g, ', ');

  if (isNote) {
    s = s.replace(/\|/g, '\\');
  } else {
    s = s.replace(/\|/g, '');
  }

  let out = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if ((code >= 0x20 && code <= 0x7e) || UNICODE_TO_CP1250.has(code)) {
      out += ch;
    } else if (ch === '–' || ch === '—') {
      out += '-';
    } else {
      const stripped = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      for (const sch of stripped) {
        const sc = sch.charCodeAt(0);
        if ((sc >= 0x20 && sc <= 0x7e) || UNICODE_TO_CP1250.has(sc)) {
          out += sch;
        }
      }
    }
  }
  return out.trim();
}

/**
 * Normalizace jména/příjmení dle Specifické - Name (kap. 2.4.1 a 2.7):
 * - zachová povolenou českou a evropskou diakritiku CP1250
 * - úvodní a koncové mezery se ignorují, 2+ mezer -> 1 mezera
 * - malá písmena převedena na velká (ß -> SS)
 * - povolena písmena A až Ž (CP1250 sada), spojovník (-) a apostrof (')
 */
export function cleanCp1250Name(input?: string): string {
  if (!input) return '';
  const base = sanitizeCp1250Field(input, false)
    .replace(/ß/g, 'SS')
    .replace(NAME_ALLOWED_CHAR_REGEX, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return base.toLocaleUpperCase('cs-CZ');
}

/**
 * Normalizace složky bydliště dle Specifické - Bydliště (kap. 2.4.1 a 2.7)
 */
export function cleanCp1250Bydliste(input?: string): string {
  if (!input) return '';
  return sanitizeCp1250Field(input, false)
    .replace(/ß/g, 'ss')
    .replace(BYDLISTE_ALLOWED_CHAR_REGEX, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Zakóduje UTF-16 JS řetězec do skutečného bajtového pole CP1250 (Windows-1250)
 */
export function encodeWin1250(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const code = ch.charCodeAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }
    const mapped = UNICODE_TO_CP1250.get(code);
    if (mapped !== undefined) {
      bytes.push(mapped);
      continue;
    }
    // Záložní transliterace znaku mimo CP1250
    const stripped = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let pushed = false;
    for (const sch of stripped) {
      const sc = sch.charCodeAt(0);
      if (sc <= 0x7f) {
        bytes.push(sc);
        pushed = true;
      } else {
        const m = UNICODE_TO_CP1250.get(sc);
        if (m !== undefined) {
          bytes.push(m);
          pushed = true;
        }
      }
    }
    if (!pushed) {
      bytes.push(0x3f); // '?'
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Dekóduje nahraný .unl soubor z binárního bufferu (podporuje CP1250 i UTF-8)
 */
export function decodeUnlBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // 1. UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  // 2. Zkusit striktní UTF-8 pouze pokud existují vícebajtové sekvence platné v UTF-8
  let hasHighByte = false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80) {
      hasHighByte = true;
      break;
    }
  }

  if (hasHighByte) {
    try {
      const utf8Text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      // Další pojistka: v CP1250 málokdy vznikne validní UTF-8, pokud nevznikly řídicí znaky
      if (!/[\u0080-\u009F]/.test(utf8Text)) {
        return utf8Text;
      }
    } catch {
      // Není validní UTF-8 -> dekódovat jako CP1250
    }
  }

  // 3. CP1250 dekódování
  try {
    return new TextDecoder('windows-1250').decode(bytes);
  } catch {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b < 0x80) {
        result += String.fromCharCode(b);
      } else {
        const mapped = CP1250_HIGH_CHARS[b - 0x80];
        result += mapped === '\uFFFD' ? '' : mapped;
      }
    }
    return result;
  }
}

/**
 * Normalizace kódu státu na přesně 3 písmena ISO 3166-1 alpha-3
 */
export function normalizeCountryCode(code?: string): string {
  if (!code) return '';
  const trimmed = String(code).trim();
  if (/^US$|^USA$|UNITED STATES|AMERICA|AMERIK|SPOJENE STATY/i.test(trimmed)) return 'USA';
  if (/^DE$|^DEU$|GERMAN|DEUTSCH|NEMEC/i.test(trimmed)) return 'DEU';
  if (/^GB$|^GBR$|^UK$|UNITED KINGDOM|BRITAIN|ENGLAND|VELKA BRITANIE|SPOJENE KRALOVSTVI/i.test(trimmed)) return 'GBR';
  if (/^CZ$|^CZE$|CZECH|CESK/i.test(trimmed)) return 'CZE';
  if (/^SK$|^SVK$|SLOVAK|SLOVENSK/i.test(trimmed)) return 'SVK';
  if (/^AT$|^AUT$|AUSTRI|RAKOUS/i.test(trimmed)) return 'AUT';
  if (/^PL$|^POL$|POLAND|POLSK/i.test(trimmed)) return 'POL';
  if (/^IT$|^ITA$|ITAL/i.test(trimmed)) return 'ITA';
  if (/^FR$|^FRA$|FRANC/i.test(trimmed)) return 'FRA';
  if (/^ES$|^ESP$|SPAIN|SPANEL|ESPANA/i.test(trimmed)) return 'ESP';
  if (/^UA$|^UKR$|UKRAIN|UKRAJIN/i.test(trimmed)) return 'UKR';
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
 * Získá popis státu ve formátu PDF kap. 2.7: "ZKRATKA - název státu"
 */
export function formatCountryForResidence(countryCode?: string): string {
  const code = normalizeCountryCode(countryCode);
  if (!code) return '';
  const name = COUNTRY_NAMES_CS[code];
  return name ? `${code} - ${name}` : code;
}

/**
 * Parsování data narození / pobytu dle pravidel v PDF kap. 2.7:
 * Podporuje YYYY-MM-DD, DD.MM.YYYY, dD. mM. rrRR, DDMMRRRR i speciální neznámé 00.00.0000
 */
export function parseDateToISO(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';

  // Neznámé datum narození dle PDF (00.00.0000 nebo částečné 0.)
  if (/^0{1,2}\.0{1,2}\.\d{4}$/.test(clean) || /^0{1,2}\.\d{1,2}\.\d{4}$/.test(clean)) {
    return clean;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // dD. mM. rrRR nebo dD.mM.rrRR
  const matchDots = clean.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})$/);
  if (matchDots) {
    const dNum = parseInt(matchDots[1], 10);
    const mNum = parseInt(matchDots[2], 10);
    let yStr = matchDots[3];
    if (yStr.length === 2) {
      const yr = parseInt(yStr, 10);
      const curr2 = new Date().getFullYear() % 100;
      yStr = (yr <= curr2 + 5 ? 2000 + yr : 1900 + yr).toString();
    }
    if (dNum === 0 || mNum === 0) {
      return `${matchDots[1].padStart(2, '0')}.${matchDots[2].padStart(2, '0')}.${yStr}`;
    }
    return `${yStr}-${String(mNum).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
  }

  // DDMMRRRR bez oddělovače
  const matchCompact = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (matchCompact) {
    const d = matchCompact[1];
    const m = matchCompact[2];
    const y = matchCompact[3];
    if (d === '00' || m === '00') {
      return `${d}.${m}.${y}`;
    }
    return `${y}-${m}-${d}`;
  }

  return clean;
}

/**
 * Převede datum z formátu YYYY-MM-DD nebo DD.MM.YYYY do DD.MM.YYYY (10 znaků)
 */
export function formatDateDDMMYYYY(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  if (!clean) return '';

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    return clean;
  }

  const matchIso = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchIso) {
    return `${matchIso[3].padStart(2, '0')}.${matchIso[2].padStart(2, '0')}.${matchIso[1]}`;
  }

  const matchDots = clean.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})$/);
  if (matchDots) {
    let y = matchDots[3];
    if (y.length === 2) {
      y = `20${y}`;
    }
    return `${matchDots[1].padStart(2, '0')}.${matchDots[2].padStart(2, '0')}.${y}`;
  }

  const matchCompact = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (matchCompact) {
    return `${matchCompact[1]}.${matchCompact[2]}.${matchCompact[3]}`;
  }

  return clean;
}

/**
 * Ověří, zda jde o platné kalendářní datum (včetně podpory neznámého dne/měsíce pro narození)
 */
function parseStrictDate(
  dateStr?: string,
  allowZeroBirthParts: boolean = false
): { valid: boolean; date?: Date; isUnknownPartial?: boolean; ddmmyyyy: string } {
  const formatted = formatDateDDMMYYYY(dateStr);
  if (!formatted) return { valid: false, ddmmyyyy: '' };

  const m = formatted.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return { valid: false, ddmmyyyy: formatted };

  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);

  if (allowZeroBirthParts && (formatted === '00.00.0000' || ((day === 0 || month === 0) && year >= 1899))) {
    if (month > 12 || day > 31) return { valid: false, ddmmyyyy: formatted };
    return { valid: true, isUnknownPartial: true, ddmmyyyy: formatted };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1800) {
    return { valid: false, ddmmyyyy: formatted };
  }

  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return { valid: false, ddmmyyyy: formatted };
  }

  return { valid: true, date: d, ddmmyyyy: formatted };
}

/**
 * Formátuje čas exportu do formátu PDF §3.2 pole 14: "yyyy.mm.dd hh:mm:ss" (19 znaků)
 */
export function formatExportTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${min}:${ss}`;
}

/**
 * Zkontroluje, zda je host občanem ČR (CZE / CZ).
 * Dle pravidel UbyPort se občané ČR cizinecké policii NEHLÁSÍ!
 */
export function isCzechCitizen(nationality?: string): boolean {
  if (!nationality) return false;
  const norm = normalizeCountryCode(nationality);
  return norm === 'CZE' || norm === 'CZ';
}

/**
 * Pokusí se rozdělit volný text zahraniční adresy na město a ulici s číslem
 */
export function parseAddressParts(rawAddress?: string): { city: string; street: string } {
  if (!rawAddress) return { city: '', street: '' };
  const clean = rawAddress.trim();

  const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const street = parts[0];
    const city = parts.slice(1).join(' ');
    return { city, street };
  }

  return {
    city: clean,
    street: ''
  };
}

/**
 * Rozparsuje českou jednolinkovou adresu ubytování do strukturovaných polí záznamu typu A
 * např. "Sokolovská 694/102, 186 00 Praha 8" -> ulice, č.p., č.o., PSČ, obec, okres
 */
export function parseCzechAddress(
  rawAddress?: string,
  districtKey?: string
): {
  district: string;
  municipality: string;
  cityPart: string;
  street: string;
  houseNumber: string;
  orientationNumber: string;
  postalCode: string;
} {
  let district = '';
  if (districtKey && PRAGUE_DISTRICTS[districtKey]) {
    const m = PRAGUE_DISTRICTS[districtKey].name.match(/(Praha\s+\d+)/i);
    if (m) district = m[1];
  }

  if (!rawAddress || !rawAddress.trim()) {
    return {
      district,
      municipality: district ? 'Praha' : '',
      cityPart: '',
      street: '',
      houseNumber: '',
      orientationNumber: '',
      postalCode: ''
    };
  }

  const clean = rawAddress.trim();
  const segments = clean.split(',').map(s => s.trim()).filter(Boolean);

  let street = '';
  let houseNumber = '';
  let orientationNumber = '';
  let postalCode = '';
  let municipality = '';
  let cityPart = '';

  const parseStreetSegment = (seg: string) => {
    // např. "Sokolovská 694/102" nebo "Náměstí Míru 12E/3a" nebo "Hlavní 42"
    const match = seg.match(/^(.*?)\s+(\d{1,4}E?)(?:\/(\d{1,3}[A-Za-z]?))?$/i);
    if (match) {
      street = match[1].trim();
      houseNumber = (match[2] || '').toUpperCase();
      orientationNumber = (match[3] || '').toUpperCase();
    } else {
      street = seg.trim();
    }
  };

  const parseCitySegment = (seg: string) => {
    let rest = seg.trim();
    const pscMatch = rest.match(/\b(\d{3})\s?(\d{2})\b/);
    if (pscMatch) {
      postalCode = `${pscMatch[1]}${pscMatch[2]}`;
      rest = rest.replace(pscMatch[0], '').trim();
    }

    // Zkontrolovat "Praha 8 - Karlín" nebo "Praha 8"
    const pragueMatch = rest.match(/^(Praha)\s*(\d{1,2})?(?:\s*[-–]\s*(.+))?$/i);
    if (pragueMatch) {
      municipality = 'Praha';
      if (pragueMatch[2]) {
        district = `Praha ${pragueMatch[2]}`;
      }
      if (pragueMatch[3]) {
        cityPart = pragueMatch[3].trim();
      }
    } else {
      municipality = rest.trim();
    }
  };

  if (segments.length >= 2) {
    parseStreetSegment(segments[0]);
    parseCitySegment(segments.slice(1).join(', '));
  } else {
    // Jen jeden řetězec: obsahuje PSČ nebo číslo popisné?
    if (/\b\d{3}\s?\d{2}\b/.test(clean) || /^Praha/i.test(clean)) {
      parseCitySegment(clean);
    } else if (/\d/.test(clean)) {
      parseStreetSegment(clean);
    } else {
      municipality = clean;
    }
  }

  return {
    district,
    municipality,
    cityPart,
    street,
    houseNumber,
    orientationNumber,
    postalCode
  };
}

/**
 * Vrátí sjednocená pole záznamu A pro dané ubytování (se záložním rozparsováním ze stávající adresy)
 */
export function resolvePropertyTypeAFields(property: Property) {
  const hasExplicitStructured = Boolean(
    property.municipality ||
      property.street ||
      property.houseNumber ||
      property.postalCode ||
      property.district
  );
  const parsed = parseCzechAddress(property.address, property.districtKey);

  const idub = cleanAsciiUpper(property.idub || '').replace(/\s/g, '');
  const facilityCode = cleanAsciiUpper(property.facilityCode || '').replace(/\s/g, '');
  const ubytovatel = sanitizeCp1250Field(property.name || '', false);
  const kontakt = sanitizeCp1250Field(property.contact ?? property.hostName ?? '', false);
  const okres = sanitizeCp1250Field(
    hasExplicitStructured ? property.district || '' : parsed.district,
    false
  );
  const obec = sanitizeCp1250Field(
    hasExplicitStructured ? property.municipality || '' : parsed.municipality,
    false
  );
  const castObce = sanitizeCp1250Field(
    hasExplicitStructured ? property.cityPart || '' : parsed.cityPart,
    false
  );
  const ulice = sanitizeCp1250Field(
    hasExplicitStructured ? property.street || '' : parsed.street,
    false
  );
  const cisloDomovni = cleanAsciiUpper(
    hasExplicitStructured ? property.houseNumber || '' : parsed.houseNumber
  ).replace(/\s/g, '');
  const cisloOrientacni = cleanAsciiUpper(
    hasExplicitStructured ? property.orientationNumber || '' : parsed.orientationNumber
  ).replace(/\s/g, '');
  const psc = (
    hasExplicitStructured ? property.postalCode || '' : parsed.postalCode
  ).replace(/\s/g, '');

  return {
    idub,
    facilityCode,
    ubytovatel,
    kontakt,
    okres,
    obec,
    castObce,
    ulice,
    cisloDomovni,
    cisloOrientacni,
    psc
  };
}

export interface PropertyValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validuje údaje ubytovacího zařízení pro hlavičku UNL (Záznam typu A, kap. 3.2 Přílohy č. 3)
 */
export function validatePropertyForUnl(property?: Property): PropertyValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!property) {
    errors.push('Není vybráno žádné ubytovací zařízení pro záznam typu A.');
    return { isValid: false, errors, warnings };
  }

  const f = resolvePropertyTypeAFields(property);

  // Pole 3: IDUB (12-14 alfanum)
  if (!f.idub) {
    errors.push('Chybí IDUB ubytovacího zařízení (12–14 alfanumerických znaků).');
  } else if (!/^[A-Z0-9]{12,14}$/.test(f.idub)) {
    errors.push(`IDUB „${f.idub}“ musí mít 12–14 alfanumerických znaků bez diakritiky (nyní ${f.idub.length}).`);
  }

  // Pole 4: zkratka (přesně 5 alfanum)
  if (!f.facilityCode) {
    errors.push('Chybí 5místná zkratka zařízení přidělená SCP.');
  } else if (!/^[A-Z0-9]{5}$/.test(f.facilityCode)) {
    errors.push(`Zkratka zařízení „${f.facilityCode}“ musí mít přesně 5 alfanumerických znaků (nyní ${f.facilityCode.length}).`);
  }

  // Pole 5: ubytovatel (1-35 alfanum)
  if (!f.ubytovatel) {
    errors.push('Chybí název ubytovatele / ubytovacího zařízení (pole 5 záznamu A).');
  } else if (f.ubytovatel.length > 35) {
    errors.push(`Název ubytovatele (${f.ubytovatel.length} znaků) překračuje limit PDF max. 35 znaků.`);
  }

  // Pole 6: kontakt (0-50)
  if (f.kontakt.length > 50) {
    errors.push(`Kontakt (${f.kontakt.length} znaků) překračuje limit PDF max. 50 znaků.`);
  }

  // Pole 7: okres (0-32)
  if (f.okres.length > 32) {
    errors.push(`Okres / obvod (${f.okres.length} znaků) překračuje limit PDF max. 32 znaků.`);
  }

  // Pole 8: obec (0-48)
  if (f.obec.length > 48) {
    errors.push(`Obec (${f.obec.length} znaků) překračuje limit PDF max. 48 znaků.`);
  } else if (!f.obec) {
    warnings.push('Doporučeno vyplnit Obec v hlavičce typu A.');
  }

  // Pole 9: část obce (0-48)
  if (f.castObce.length > 48) {
    errors.push(`Část obce (${f.castObce.length} znaků) překračuje limit PDF max. 48 znaků.`);
  }

  // Pole 10: ulice (0-48)
  if (f.ulice.length > 48) {
    errors.push(`Ulice ubytování (${f.ulice.length} znaků) překračuje limit PDF max. 48 znaků.`);
  }

  // Pole 11: číslo domovní (0-5, max 4 číslice nebo max 4 číslice + E)
  if (f.cisloDomovni) {
    if (f.cisloDomovni.length > 5 || !/^\d{1,4}E?$/i.test(f.cisloDomovni)) {
      errors.push(`Číslo domovní „${f.cisloDomovni}“ musí mít max. 4 číslice (nebo max. 4 číslice a „E“ pro evidenční).`);
    }
  }

  // Pole 12: číslo orientační (0-4, max 3 číslice případně doplněné 1 písmenem)
  if (f.cisloOrientacni) {
    if (f.cisloOrientacni.length > 4 || !/^\d{1,3}[A-Z]?$/i.test(f.cisloOrientacni)) {
      errors.push(`Číslo orientační „${f.cisloOrientacni}“ musí mít max. 3 číslice případně doplněné jedním písmenem.`);
    }
  }

  // Pole 13: PSČ (0-5, 5 číslic)
  if (f.psc) {
    if (!/^\d{5}$/.test(f.psc)) {
      errors.push(`PSČ „${f.psc}“ musí mít přesně 5 číslic (např. 18600).`);
    }
  } else {
    warnings.push('Doporučeno vyplnit 5místné PSČ v hlavičce typu A.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sestaví pole 11 záznamu typu U (bydliště v zahraničí) dle PDF kap. 2.7 a 3.3:
 * Složky jsou odděleny čárkou a mezerou (", "): ulice, město, ZKRATKA - název státu
 */
export function formatGuestResidenceField(guest: Guest): string {
  let city = cleanCp1250Bydliste(guest.city || '');
  let street = cleanCp1250Bydliste(guest.street || '');

  if (!city && guest.address) {
    const parsed = parseAddressParts(guest.address);
    city = cleanCp1250Bydliste(parsed.city);
    if (!street) street = cleanCp1250Bydliste(parsed.street);
  }

  const countryCode = normalizeCountryCode(guest.residenceCountry || guest.nationality);
  const countryLabel = formatCountryForResidence(countryCode);

  const parts: string[] = [];
  if (street) parts.push(street);
  if (city) parts.push(city);
  if (countryLabel) parts.push(countryLabel);

  return parts.join(', ');
}

export interface UnlValidationResult {
  isValid: boolean;
  isCzech: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Striktně validuje hosta (Záznam typu U) a volitelně ubytování (Záznam typu A) dle Přílohy č. 3
 */
export function validateGuestForUnl(
  guest: Guest,
  property?: Property,
  skipPropertyCheck: boolean = false
): UnlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const nationality = normalizeCountryCode(guest.nationality);
  const isCzech = nationality === 'CZE' || nationality === 'CZ';

  if (isCzech) {
    warnings.push('Občan ČR (CZE) – dle zákona se přes UbyPort nehlásí cizinecké policii.');
    return { isValid: false, isCzech: true, errors, warnings };
  }

  if (!skipPropertyCheck && property) {
    const propVal = validatePropertyForUnl(property);
    errors.push(...propVal.errors);
  }

  // Pole 2 & 3: Datum od / do (dd.mm.yyyy, 10 znaků, datum do > datum od)
  const arrParsed = parseStrictDate(guest.dateArrival, false);
  const depParsed = parseStrictDate(guest.dateDeparture, false);

  if (!guest.dateArrival?.trim()) {
    errors.push('Chybí datum počátku ubytování (datum od).');
  } else if (!arrParsed.valid || !arrParsed.date) {
    errors.push(`Neplatné datum příjezdu „${guest.dateArrival}“ (očekává se DD.MM.RRRR).`);
  }

  if (!guest.dateDeparture?.trim()) {
    errors.push('Chybí datum konce ubytování (datum do).');
  } else if (!depParsed.valid || !depParsed.date) {
    errors.push(`Neplatné datum odjezdu „${guest.dateDeparture}“ (očekává se DD.MM.RRRR).`);
  }

  if (arrParsed.valid && arrParsed.date && depParsed.valid && depParsed.date) {
    if (depParsed.date <= arrParsed.date) {
      errors.push('Datum konce pobytu (datum do) musí být vyšší než datum příjezdu (min. 1 noc).');
    }
  }

  // Pole 4: Příjmení (1-50, Specifické - Name)
  const cleanLastName = cleanCp1250Name(guest.lastName);
  if (!cleanLastName) {
    errors.push('Chybí příjmení hosta (min. 1 znak).');
  } else if (cleanLastName.length > 50) {
    errors.push(`Příjmení (${cleanLastName.length} znaků) překračuje limit PDF max. 50 znaků.`);
  }

  // Pole 5: Jméno (0-24, Specifické - Name)
  const cleanFirstName = cleanCp1250Name(guest.firstName);
  if (cleanFirstName.length > 24) {
    errors.push(`Jméno (${cleanFirstName.length} znaků) překračuje limit PDF max. 24 znaků.`);
  }

  // Pole 7: Datum narození (31.12.1899 .. datum od, nebo 00.00.0000 / 0. měsíc/den)
  const birthParsed = parseStrictDate(guest.birthDate, true);
  if (!guest.birthDate?.trim()) {
    errors.push('Chybí datum narození.');
  } else if (!birthParsed.valid) {
    errors.push(`Neplatné datum narození „${guest.birthDate}“ (rozsah od 31.12.1899 nebo 00.00.0000).`);
  } else if (birthParsed.date) {
    const minBirth = new Date(Date.UTC(1899, 11, 31));
    if (birthParsed.date < minBirth) {
      errors.push('Datum narození nesmí být starší než 31.12.1899.');
    }
    if (arrParsed.date && birthParsed.date > arrParsed.date) {
      errors.push('Datum narození nesmí být po datu zahájení pobytu.');
    }
  }

  // Pole 10: Státní příslušnost (3písmenný ISO kód)
  if (!nationality || !/^[A-Z]{3}$/.test(nationality)) {
    errors.push(`Státní příslušnost musí být přesně 3písmenný ISO kód (zadáno: ${guest.nationality || 'prázdné'}).`);
  }

  // Pole 11: Bydliště v zahraničí (0-255, složky max 42 znaků, ne pouze číslice, návaznost)
  let city = cleanCp1250Bydliste(guest.city || '');
  let street = cleanCp1250Bydliste(guest.street || '');
  if (!city && guest.address) {
    const parsed = parseAddressParts(guest.address);
    city = cleanCp1250Bydliste(parsed.city);
    if (!street) street = cleanCp1250Bydliste(parsed.street);
  }
  const resCountry = normalizeCountryCode(guest.residenceCountry || guest.nationality);

  if (street) {
    if (street.length > 42) {
      errors.push(`Ulice bydliště (${street.length} znaků) překračuje limit PDF max. 42 znaků.`);
    }
    if (/^\d+$/.test(street)) {
      errors.push('Ulice bydliště nesmí obsahovat pouze číslice.');
    }
    if (!city) {
      errors.push('Pokud je uvedena ulice bydliště, musí být uvedeno i město.');
    }
    if (!resCountry || !/^[A-Z]{3}$/.test(resCountry)) {
      errors.push('Pokud je uvedena ulice bydliště, musí být uveden 3místný stát bydliště.');
    }
  }

  if (city) {
    if (city.length > 42) {
      errors.push(`Město bydliště (${city.length} znaků) překračuje limit PDF max. 42 znaků.`);
    }
    if (/^\d+$/.test(city)) {
      errors.push('Město bydliště nesmí obsahovat pouze číslice.');
    }
    if (!resCountry || !/^[A-Z]{3}$/.test(resCountry)) {
      errors.push('Pokud je uvedeno město bydliště, musí být uveden 3místný stát bydliště.');
    }
  } else if (!guest.address?.trim()) {
    errors.push('Chybí město (obec) trvalého bydliště v zahraničí.');
  }

  const fullResidence = formatGuestResidenceField(guest);
  if (fullResidence.length > 255) {
    errors.push(`Celková délka pole bydliště (${fullResidence.length} znaků) překračuje limit 255 znaků.`);
  }

  // Pole 12: Číslo cestovního dokladu (6-30, pouze A-Z a 0-9 bez mezer)
  const rawDocStripped = String(guest.idDocumentNumber || '').replace(/\s+/g, '');
  const cleanDoc = cleanAsciiUpper(rawDocStripped).replace(/[^A-Z0-9]/g, '');
  if (!rawDocStripped) {
    errors.push('Chybí číslo cestovního dokladu.');
  } else if (cleanDoc.length < 6 || cleanDoc.length > 30) {
    errors.push(`Číslo dokladu „${rawDocStripped}“ musí mít po odstranění mezer 6–30 alfanumerických znaků (nyní ${cleanDoc.length}).`);
  }

  // Pole 13: Číslo víza (0-15 alfanum bez diakritiky [a-zA-Z0-9])
  const rawVisa = String(guest.visaNumber || '').trim();
  if (rawVisa) {
    if (!/^[a-zA-Z0-9]{1,15}$/.test(rawVisa)) {
      errors.push('Číslo víza může obsahovat maximálně 15 alfanumerických znaků bez diakritiky a mezer.');
    }
  }

  // Pole 14: Účel pobytu (2 znaky z číselníku)
  const normPurpose = normalizePurposeCode(guest.purposeOfStay);
  if (!/^\d{2}$/.test(normPurpose) || !VALID_PURPOSE_CODES.has(normPurpose)) {
    errors.push(`Neplatný 2ciferný kód účelu pobytu „${guest.purposeOfStay || ''}“.`);
  }

  // Pole 16: Poznámka (0-255 znaků)
  const cleanNote = sanitizeCp1250Field(guest.note || '', true);
  if (cleanNote.length > 255) {
    errors.push(`Poznámka (${cleanNote.length} znaků) překračuje limit PDF max. 255 znaků.`);
  }

  return {
    isValid: errors.length === 0,
    isCzech: false,
    errors,
    warnings
  };
}

/**
 * Sestaví úvodní řádek typu A (ubytovací zařízení, přesně 16 polí dle Přílohy č. 3 kap. 3.2)
 * A|2|IDUB|zkratka|ubytovatel|kontakt|okres|obec|castObce|ulice|cisloDomovni|cisloOrientacni|PSC|yyyy.mm.dd hh:mm:ss||
 */
export function formatTypeARecord(property: Property, exportDate: Date = new Date()): string {
  const f = resolvePropertyTypeAFields(property);
  const timestamp = formatExportTimestamp(exportDate);

  const fields = [
    'A',                                   // 1. typ záznamu
    '2',                                   // 2. formát (2 – od UbyPrototype_7)
    f.idub,                                // 3. IDUB (12-14)
    f.facilityCode.substring(0, 5),        // 4. zkratka (5)
    f.ubytovatel.substring(0, 35),         // 5. ubytovatel (1-35)
    f.kontakt.substring(0, 50),            // 6. kontakt (0-50)
    f.okres.substring(0, 32),              // 7. okres (0-32)
    f.obec.substring(0, 48),               // 8. obec (0-48)
    f.castObce.substring(0, 48),           // 9. část obce (0-48)
    f.ulice.substring(0, 48),              // 10. ulice (0-48)
    f.cisloDomovni.substring(0, 5),        // 11. číslo domovní (0-5)
    f.cisloOrientacni.substring(0, 4),     // 12. číslo orientační (0-4)
    f.psc.substring(0, 5),                 // 13. PSČ (0-5)
    timestamp,                             // 14. datum a čas exportu (19)
    '',                                    // 15. rezerva 1 (prázdný řetězec)
    ''                                     // 16. rezerva 2 (prázdný řetězec)
  ];

  return fields.join('|') + '\r\n';
}

/**
 * Sestaví řádek typu U (ubytovaný cizinec, přesně 16 polí dle Přílohy č. 3 kap. 3.3)
 * U|datum_od|datum_do|prijmeni|jmeno||datum_narozeni|||stat|bydliste|doklad|viza|ucel||poznamka
 */
export function formatTypeURecord(guest: Guest): string {
  const arrival = formatDateDDMMYYYY(guest.dateArrival);
  const departure = formatDateDDMMYYYY(guest.dateDeparture);
  const lastName = cleanCp1250Name(guest.lastName).substring(0, 50);
  const firstName = cleanCp1250Name(guest.firstName).substring(0, 24);
  const birthDate = formatDateDDMMYYYY(guest.birthDate);
  const nationality = normalizeCountryCode(guest.nationality).substring(0, 3);
  const residence = formatGuestResidenceField(guest).substring(0, 255);
  const docNumber = cleanAsciiUpper(guest.idDocumentNumber || '').replace(/[^A-Z0-9]/g, '').substring(0, 30);
  const visaNumber = sanitizeCp1250Field(guest.visaNumber || '', false).replace(/[^a-zA-Z0-9]/g, '').substring(0, 15);
  const purpose = normalizePurposeCode(guest.purposeOfStay);
  const note = sanitizeCp1250Field(guest.note || '', true).substring(0, 255);

  const fields = [
    'U',           // 1. typ záznamu
    arrival,       // 2. datum od (10)
    departure,     // 3. datum do (10)
    lastName,      // 4. příjmení (1-50)
    firstName,     // 5. jméno (0-24)
    '',            // 6. rezerva 1
    birthDate,     // 7. datum narození (8/10)
    '',            // 8. rezerva 2
    '',            // 9. rezerva 3
    nationality,   // 10. státní příslušnost (3)
    residence,     // 11. bydliště (0-255)
    docNumber,     // 12. číslo dokladu (6-30)
    visaNumber,    // 13. číslo víza (0-15)
    purpose,       // 14. účel pobytu (2)
    '',            // 15. rezerva 7
    note           // 16. poznámka (0-255)
  ];

  return fields.join('|') + '\r\n';
}

/**
 * Zpětně kompatibilní alias generující oficiální 16polový řádek typu U
 */
export function generateUnlRow(guest: Guest, _property?: Property): string {
  return formatTypeURecord(guest);
}

export interface BuildUnlFileResult {
  content: string;
  headerLine: string;
  guestLines: string[];
  includedCount: number;
  excludedCzechCount: number;
  invalidCount: number;
  propertyValidation: PropertyValidationResult;
  guestIssues: { guest: Guest; errors: string[]; warnings: string[] }[];
  canDownload: boolean;
}

/**
 * Vygeneruje kompletní obsah UNL souboru pro JEDNO vybrané ubytování (řádek A) a výhradně jeho hosty (řádky U)
 */
export function buildUnlFile(
  guests: Guest[],
  property: Property,
  exportDate: Date = new Date()
): BuildUnlFileResult {
  const propertyValidation = validatePropertyForUnl(property);
  const headerLine = formatTypeARecord(property, exportDate);

  // Bezpečnostní filtr: do UNL patří pouze hosté náležející vybranému ubytování
  const scopedGuests = guests.filter(g => !g.propertyId || g.propertyId === property.id);

  const guestLines: string[] = [];
  const guestIssues: { guest: Guest; errors: string[]; warnings: string[] }[] = [];
  let includedCount = 0;
  let excludedCzechCount = 0;
  let invalidCount = 0;

  for (const guest of scopedGuests) {
    const val = validateGuestForUnl(guest, property, true);
    if (val.isCzech) {
      excludedCzechCount++;
      continue;
    }
    if (!val.isValid) {
      invalidCount++;
      guestIssues.push({
        guest,
        errors: val.errors,
        warnings: val.warnings
      });
    }
    guestLines.push(formatTypeURecord(guest));
    includedCount++;
  }

  const content = includedCount > 0 ? headerLine + guestLines.join('') : '';
  const canDownload =
    propertyValidation.isValid && invalidCount === 0 && includedCount > 0 && content.length > 0;

  return {
    content,
    headerLine,
    guestLines,
    includedCount,
    excludedCzechCount,
    invalidCount,
    propertyValidation,
    guestIssues,
    canDownload
  };
}

/**
 * Rozdělí řetězec bydliště (pole 11) zpět na ulici, město a stát
 */
function parseResidenceField(rawResidence: string, fallbackNationality: string): {
  street: string;
  city: string;
  residenceCountry: string;
} {
  const clean = (rawResidence || '').trim();
  if (!clean) {
    return { street: '', city: '', residenceCountry: fallbackNationality };
  }

  const parts = clean.split(',').map(p => p.trim()).filter(Boolean);
  let residenceCountry = fallbackNationality;
  let city = '';
  let street = '';

  if (parts.length > 0) {
    const last = parts[parts.length - 1];
    const codePrefix = last.match(/^([A-Z]{2,3})\b(?:\s*-\s*.+)?$/i);
    if (codePrefix) {
      residenceCountry = normalizeCountryCode(codePrefix[1]);
      parts.pop();
    } else if (parts.length >= 3) {
      residenceCountry = normalizeCountryCode(last) || fallbackNationality;
      parts.pop();
    }
  }

  if (parts.length === 1) {
    city = parts[0];
  } else if (parts.length >= 2) {
    street = parts[0];
    city = parts.slice(1).join(', ');
  }

  return { street, city, residenceCountry };
}

/**
 * Parser pro import souboru UNL (oficiální formát A + U po 16 polích)
 */
export function parseUnlContent(
  rawContent: string,
  targetPropertyId?: string
): {
  importedGuests: Guest[];
  detectedFacility?: { idub: string; facilityCode: string };
  detectedProperty?: Partial<Property>;
  errors: string[];
} {
  const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const importedGuests: Guest[] = [];
  const errors: string[] = [];
  let detectedFacility: { idub: string; facilityCode: string } | undefined;
  let detectedProperty: Partial<Property> | undefined;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const parts = line.split('|');
    const recordType = (parts[0] || '').trim().toUpperCase();

    if (recordType === 'A') {
      if (parts.length < 14) {
        errors.push(`Řádek ${idx + 1} (typ A): Neplatný počet polí (${parts.length} nalezeno, očekává se 16).`);
        continue;
      }

      const idub = cleanAsciiUpper(parts[2] || '').replace(/\s/g, '');
      const facilityCode = cleanAsciiUpper(parts[3] || '').replace(/\s/g, '').substring(0, 5);
      const name = (parts[4] || '').trim();
      const contact = (parts[5] || '').trim();
      const district = (parts[6] || '').trim();
      const municipality = (parts[7] || '').trim();
      const cityPart = (parts[8] || '').trim();
      const street = (parts[9] || '').trim();
      const houseNumber = (parts[10] || '').trim().toUpperCase();
      const orientationNumber = (parts[11] || '').trim().toUpperCase();
      const postalCode = (parts[12] || '').replace(/\s/g, '');

      detectedFacility = { idub, facilityCode };

      const houseCombined = houseNumber
        ? orientationNumber
          ? `${houseNumber}/${orientationNumber}`
          : houseNumber
        : '';
      const streetPart = [street, houseCombined].filter(Boolean).join(' ');
      const cityCombined = [postalCode, municipality || district].filter(Boolean).join(' ');
      const formattedAddress = [streetPart, cityCombined].filter(Boolean).join(', ');

      let districtKey = 'praha8';
      const pragueDistMatch = district.match(/Praha\s+(\d{1,2})/i);
      if (pragueDistMatch) {
        const candKey = `praha${pragueDistMatch[1]}`;
        if (PRAGUE_DISTRICTS[candKey]) {
          districtKey = candKey;
        }
      }

      detectedProperty = {
        name: name || `Ubytování ${facilityCode}`,
        idub,
        facilityCode,
        hostName: contact,
        contact,
        district,
        municipality,
        cityPart,
        street,
        houseNumber,
        orientationNumber,
        postalCode,
        address: formattedAddress || municipality || 'Praha',
        districtKey
      };
      continue;
    }

    if (recordType === 'U') {
      if (parts.length < 14) {
        errors.push(`Řádek ${idx + 1} (typ U): Neplatný počet polí (${parts.length} nalezeno, očekává se 16).`);
        continue;
      }

      const arrival = parts[1] || '';
      const departure = parts[2] || '';
      const lastName = parts[3] || '';
      const firstName = parts[4] || '';
      const birthDate = parts[6] || '';
      const nationality = normalizeCountryCode(parts[9] || '');
      const rawResidence = parts[10] || '';
      const docNumber = parts[11] || '';
      const visaNumber = parts[12] || '';
      const purpose = normalizePurposeCode(parts[13] || '10');
      const note = parts[15] || '';

      const isoBirth = parseDateToISO(birthDate);
      const isoArr = parseDateToISO(arrival);
      const isoDep = parseDateToISO(departure);

      let nights = 1;
      if (isoArr && isoDep) {
        const a = new Date(isoArr).getTime();
        const d = new Date(isoDep).getTime();
        if (!isNaN(a) && !isNaN(d) && d > a) {
          nights = Math.max(1, Math.round((d - a) / (1000 * 60 * 60 * 24)));
        }
      }

      const cleanLastName = cleanCp1250Name(lastName);
      const cleanFirstName = cleanCp1250Name(firstName);
      const parsedRes = parseResidenceField(rawResidence, nationality);

      const guest: Guest = {
        id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        propertyId: targetPropertyId || '',
        unit: '',
        airbnbCode: '',
        lastName: cleanLastName,
        firstName: cleanFirstName,
        fullName: `${cleanFirstName} ${cleanLastName}`.trim(),
        birthDate: isoBirth,
        nationality,
        residenceCountry: parsedRes.residenceCountry || nationality,
        city: cleanCp1250Bydliste(parsedRes.city),
        street: cleanCp1250Bydliste(parsedRes.street),
        address: cleanCp1250Bydliste([parsedRes.street, parsedRes.city].filter(Boolean).join(', ')),
        idDocumentType: 'PAS',
        idDocumentNumber: cleanAsciiUpper(docNumber).replace(/[^A-Z0-9]/g, ''),
        documentIssuerCountry: nationality,
        visaNumber: sanitizeCp1250Field(visaNumber, false).replace(/[^a-zA-Z0-9]/g, ''),
        purposeOfStay: purpose,
        note: sanitizeCp1250Field(note, true),
        dateArrival: isoArr,
        dateDeparture: isoDep,
        nights,
        createdAt: new Date().toISOString()
      };

      importedGuests.push(guest);
      continue;
    }

    errors.push(`Řádek ${idx + 1}: Neznámý typ záznamu „${recordType || 'prázdný'}“ (očekává se úvodní záznam A a záznamy U po 16 polích).`);
  }

  return {
    importedGuests,
    detectedFacility,
    detectedProperty,
    errors
  };
}

/**
 * Spustí stažení .unl souboru v prohlížeči se skutečným bajtovým kódováním CP1250 (Windows-1250).
 * Používá MIME typ application/octet-stream, aby iOS Safari ani prohlížeče nepřidávaly příponu .txt.
 */
export function downloadUnlFile(content: string, filename: string = 'ubyport_export.unl'): void {
  const safeFilename = filename.toLowerCase().endsWith('.unl') ? filename : `${filename}.unl`;
  const bytes = encodeWin1250(content);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  link.setAttribute('download', safeFilename);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
