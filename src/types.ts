export interface Property {
  id: string;
  name: string;
  idub: string;          // Identifikační kód ubytovacího zařízení přidělený Policií ČR (např. CZ1234567890)
  facilityCode: string;  // 5místná zkratka zařízení přidělená Policií ČR (např. HOTEL, APART)
  hostName: string;
  address: string;
  districtKey?: string;
  variableSymbol?: string;
}

export interface Guest {
  id: string;
  propertyId: string;
  unit: string;                    // Číslo pokoje / jednotky (např. 102)
  airbnbCode: string;              // Kód rezervace
  firstName: string;               // Jméno (velkými písmeny, bez diakritiky v exportu)
  lastName: string;                // Příjmení (velkými písmeny, bez diakritiky v exportu)
  fullName: string;
  birthDate: string;               // Datum narození (YYYY-MM-DD)
  nationality: string;             // Státní příslušnost (3místný ISO kód, např. DEU, SVK, USA)
  residenceCountry?: string;       // Stát trvalého bydliště (3místný ISO kód)
  city?: string;                   // Obec trvalého bydliště
  street?: string;                 // Ulice a číslo domu bydliště
  address?: string;                // Kompletní adresa
  idDocumentType: 'PAS' | 'OP' | string; // Druh dokladu (PAS nebo OP)
  idDocumentNumber: string;        // Číslo cestovního dokladu
  documentIssuerCountry?: string;  // Stát vydání dokladu (3místný ISO kód)
  visaNumber?: string;             // Číslo víza (volitelné)
  purposeOfStay: string;           // Kód účelu pobytu dle číselníku (1=turistika, 2=zaměstnání, ...)
  dateArrival: string;             // Počátek ubytování (YYYY-MM-DD)
  dateDeparture: string;           // Konec ubytování (YYYY-MM-DD)
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
