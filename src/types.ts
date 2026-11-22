export interface Property {
  id: string;
  name: string;
  idub: string;          // Identifikační kód ubytovacího zařízení přidělený Policií ČR (12–14 znaků, např. CZ1234567890)
  facilityCode: string;  // 5místná zkratka zařízení přidělená Policií ČR (5 znaků, např. HOTEL, APART)
  hostName: string;      // Jméno / firma hostitele
  address: string;       // Jednolinková adresa pro přehledy
  districtKey?: string;
  variableSymbol?: string;
  // Strukturovaná pole pro hlavičku UNL (Záznam typu A, 16 polí dle Přílohy č. 3)
  contact?: string;           // Pole 6: kontakt (0–50 znaků)
  district?: string;          // Pole 7: okres / v Praze obvod (0–32 znaků)
  municipality?: string;      // Pole 8: obec (0–48 znaků)
  cityPart?: string;          // Pole 9: část obce (0–48 znaků)
  street?: string;            // Pole 10: ulice / veřejné prostranství (0–48 znaků)
  houseNumber?: string;       // Pole 11: číslo domovní (0–5 znaků, max 4 číslice nebo max 4 číslice + E)
  orientationNumber?: string; // Pole 12: číslo orientační (0–4 znaky, max 3 číslice + volitelně 1 písmeno)
  postalCode?: string;        // Pole 13: PSČ (5 číslic)
}

export interface Guest {
  id: string;
  propertyId: string;
  unit: string;                    // Číslo pokoje / jednotky (interní evidence)
  airbnbCode: string;              // Kód rezervace
  firstName: string;               // Jméno (0–24 znaků, Specifické Name v CP1250)
  lastName: string;                // Příjmení (1–50 znaků, Specifické Name v CP1250)
  fullName: string;
  birthDate: string;               // Datum narození (YYYY-MM-DD nebo 00.00.0000)
  nationality: string;             // Státní příslušnost (3místný ISO 3166 / ICAO kód, např. DEU, SVK, USA)
  residenceCountry?: string;       // Stát trvalého bydliště (3místný ISO kód)
  city?: string;                   // Město / obec trvalého bydliště (1–42 znaků)
  street?: string;                 // Ulice a číslo domu bydliště (1–42 znaků)
  address?: string;                // Kompletní adresa
  idDocumentType: 'PAS' | 'OP' | string; // Druh dokladu (PAS nebo OP)
  idDocumentNumber: string;        // Číslo cestovního dokladu (6–30 alfanum znaků bez mezer)
  documentIssuerCountry?: string;  // Stát vydání dokladu (3místný ISO kód)
  visaNumber?: string;             // Číslo víza (0–15 alfanum znaků bez diakritiky)
  purposeOfStay: string;           // 2ciferný kód účelu pobytu dle číselníku (např. 10=turistika, 27=zaměstnání)
  note?: string;                   // Pole 16 záznamu U: Poznámka (0–255 znaků, '|' -> '\')
  dateArrival: string;             // Počátek ubytování (YYYY-MM-DD)
  dateDeparture: string;           // Konec ubytování (YYYY-MM-DD, musí být > dateArrival)
  nights: number;
  createdAt: string;
}

export interface PragueDistrict {
  code: string;
  name: string;
  cadastres: string;
}

export const PRAGUE_DISTRICTS: Record<string, PragueDistrict> = {
  praha1: { code: 'praha1', name: 'Městská část Praha 1', cadastres: 'Staré Město, Malá Strana, Josefov' },
  praha2: { code: 'praha2', name: 'Městská část Praha 2', cadastres: 'Vinohrady, Vyšehrad, Nové Město' },
  praha3: { code: 'praha3', name: 'Městská část Praha 3', cadastres: 'Žižkov, Vinohrady (P3)' },
  praha4: { code: 'praha4', name: 'Městská část Praha 4', cadastres: 'Nusle, Michle, Podolí, Braník' },
  praha5: { code: 'praha5', name: 'Městská část Praha 5', cadastres: 'Smíchov, Košíře, Motol' },
  praha6: { code: 'praha6', name: 'Městská část Praha 6', cadastres: 'Dejvice, Bubeneč, Břevnov' },
  praha7: { code: 'praha7', name: 'Městská část Praha 7', cadastres: 'Holešovice, Bubeneč (P7), Troja' },
  praha8: { code: 'praha8', name: 'Městská část Praha 8', cadastres: 'Karlín, Libeň, Kobylisy, Bohnice' },
  praha9: { code: 'praha9', name: 'Městská část Praha 9', cadastres: 'Vysočany, Prosek, Hloubětín' },
  praha10: { code: 'praha10', name: 'Městská část Praha 10', cadastres: 'Vršovice, Strašnice, Malešice' }
};
