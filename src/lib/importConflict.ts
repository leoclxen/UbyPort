import { Property, Guest } from '../types';
import {
  normalizeCountryCode,
  normalizePurposeCode,
  parseDateToISO
} from './ubyport';

export interface ImportDiffField {
  key: string;
  label: string;
  existingValue: string;
  incomingValue: string;
}

export type ImportConflictItem =
  | {
      kind: 'property';
      existing: Property;
      incoming: Property;
      incomingOriginalId: string;
      matchReasons: string[];
      diffs: ImportDiffField[];
    }
  | {
      kind: 'guest';
      existing: Guest;
      incoming: Guest;
      matchReasons: string[];
      diffs: ImportDiffField[];
    };

export interface ImportPlanResult {
  newProperties: Property[];
  newGuests: Guest[];
  conflicts: ImportConflictItem[];
  skippedIdenticalProperties: number;
  skippedIdenticalGuests: number;
  propertyIdRemap: Record<string, string>;
}

function normStr(val: unknown): string {
  return String(val ?? '').trim();
}

function normUpper(val: unknown): string {
  return normStr(val).toUpperCase();
}

function normAsciiKey(val: unknown): string {
  return normStr(val)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function normDateVal(val: unknown): string {
  const s = normStr(val);
  if (!s) return '';
  return parseDateToISO(s) || s;
}

function isPlaceholderPropId(id: string): boolean {
  return !id || id.startsWith('prop_sheet_') || id.startsWith('prop_csv_');
}

function isPlaceholderGuestId(id: string): boolean {
  return !id || id.startsWith('g_sheet_') || id.startsWith('g_csv_');
}

export function findMatchingProperty(
  incoming: Property,
  existingList: Property[]
): { property: Property; matchReasons: string[] } | null {
  let best: { property: Property; score: number; matchReasons: string[] } | null = null;

  const incId = normStr(incoming.id);
  const incIdub = normUpper(incoming.idub);
  const incCode = normUpper(incoming.facilityCode);
  const incName = normAsciiKey(incoming.name);
  const incAddr = normAsciiKey(incoming.address);

  for (const ex of existingList) {
    const reasons: string[] = [];
    let score = 0;

    if (!isPlaceholderPropId(incId) && normStr(ex.id) === incId) {
      reasons.push('ID zařízení');
      score += 100;
    }

    const exIdub = normUpper(ex.idub);
    if (incIdub && exIdub && incIdub === exIdub) {
      reasons.push(`IDUB (${ex.idub})`);
      score += 80;
    }

    const exName = normAsciiKey(ex.name);
    const exCode = normUpper(ex.facilityCode);
    const exAddr = normAsciiKey(ex.address);

    if (incName && exName && incName === exName) {
      if (incCode && exCode && incCode === exCode) {
        reasons.push('Název a zkratka');
        score += 70;
      } else if (incAddr && exAddr && incAddr === exAddr) {
        reasons.push('Název a adresa');
        score += 65;
      } else if (!incIdub && !exIdub) {
        reasons.push(`Název (${ex.name})`);
        score += 45;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { property: ex, score, matchReasons: reasons };
    }
  }

  return best ? { property: best.property, matchReasons: best.matchReasons } : null;
}

export function computePropertyDiffs(existing: Property, incoming: Property): ImportDiffField[] {
  const fields: {
    key: keyof Property;
    label: string;
    norm?: (v: unknown) => string;
  }[] = [
    { key: 'name', label: 'Název ubytování' },
    { key: 'idub', label: 'IDUB', norm: normUpper },
    { key: 'facilityCode', label: 'Zkratka zařízení', norm: normUpper },
    { key: 'hostName', label: 'Hostitel' },
    { key: 'address', label: 'Adresa' },
    { key: 'districtKey', label: 'Městská část' },
    { key: 'contact', label: 'Kontakt' },
    { key: 'district', label: 'Okres / obvod' },
    { key: 'municipality', label: 'Obec' },
    { key: 'cityPart', label: 'Část obce' },
    { key: 'street', label: 'Ulice' },
    { key: 'houseNumber', label: 'Číslo popisné' },
    { key: 'orientationNumber', label: 'Číslo orientační' },
    { key: 'postalCode', label: 'PSČ' }
  ];

  const diffs: ImportDiffField[] = [];
  for (const f of fields) {
    const normalize = f.norm || normStr;
    const exVal = normalize(existing[f.key]);
    const inVal = normalize(incoming[f.key]);
    if (exVal !== inVal) {
      diffs.push({
        key: String(f.key),
        label: f.label,
        existingValue: normStr(existing[f.key]) || '—',
        incomingValue: normStr(incoming[f.key]) || '—'
      });
    }
  }
  return diffs;
}

export function findMatchingGuest(
  incoming: Guest,
  existingList: Guest[]
): { guest: Guest; matchReasons: string[] } | null {
  let best: { guest: Guest; score: number; matchReasons: string[] } | null = null;

  const incId = normStr(incoming.id);
  const incDoc = normUpper(incoming.idDocumentNumber).replace(/\s+/g, '');
  const incLast = normAsciiKey(incoming.lastName);
  const incFirst = normAsciiKey(incoming.firstName);
  const incBirth = normDateVal(incoming.birthDate);
  const incNat = normalizeCountryCode(incoming.nationality || '');
  const incArr = normDateVal(incoming.dateArrival);

  for (const ex of existingList) {
    const reasons: string[] = [];
    let score = 0;

    if (!isPlaceholderGuestId(incId) && normStr(ex.id) === incId) {
      reasons.push('ID záznamu');
      score += 120;
    }

    const exDoc = normUpper(ex.idDocumentNumber).replace(/\s+/g, '');
    const exLast = normAsciiKey(ex.lastName);
    const exFirst = normAsciiKey(ex.firstName);
    const exBirth = normDateVal(ex.birthDate);
    const exNat = normalizeCountryCode(ex.nationality || '');
    const exArr = normDateVal(ex.dateArrival);

    if (incDoc && exDoc && incDoc === exDoc) {
      if (incLast && exLast && incLast === exLast && incBirth && exBirth && incBirth === exBirth) {
        reasons.push(`Doklad (${ex.idDocumentNumber}), příjmení a narození`);
        score += 100;
      } else if (incLast && exLast && incLast === exLast) {
        reasons.push(`Doklad (${ex.idDocumentNumber}) a příjmení`);
        score += 85;
      } else if (incNat && exNat && incNat === exNat) {
        reasons.push(`Číslo dokladu (${ex.idDocumentNumber}) a občanství`);
        score += 75;
      }
    } else if (incLast && exLast && incLast === exLast && incFirst && exFirst && incFirst === exFirst && incBirth && exBirth && incBirth === exBirth) {
      if (normStr(ex.propertyId) === normStr(incoming.propertyId)) {
        reasons.push('Jméno, příjmení, datum narození a ubytování');
        score += 70;
      } else if (incArr && exArr && incArr === exArr) {
        reasons.push('Jméno, příjmení, datum narození a datum příjezdu');
        score += 65;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { guest: ex, score, matchReasons: reasons };
    }
  }

  return best ? { guest: best.guest, matchReasons: best.matchReasons } : null;
}

export function computeGuestDiffs(
  existing: Guest,
  incoming: Guest,
  propertiesById: Map<string, Property>
): ImportDiffField[] {
  const getPropLabel = (propId: string) => {
    const p = propertiesById.get(propId);
    return p ? p.name : propId || '—';
  };

  const normNat = (v: unknown) => {
    const s = normStr(v);
    return s ? normalizeCountryCode(s) : '';
  };
  const normPurp = (v: unknown) => {
    const s = normStr(v);
    return s ? normalizePurposeCode(s) : '';
  };

  const fields: {
    key: keyof Guest;
    label: string;
    norm?: (v: unknown) => string;
    display?: (v: unknown) => string;
  }[] = [
    {
      key: 'propertyId',
      label: 'Ubytovací zařízení',
      display: v => getPropLabel(normStr(v))
    },
    { key: 'unit', label: 'Pokoj / jednotka' },
    { key: 'airbnbCode', label: 'Kód rezervace', norm: normUpper },
    { key: 'lastName', label: 'Příjmení' },
    { key: 'firstName', label: 'Jméno' },
    { key: 'birthDate', label: 'Datum narození', norm: normDateVal },
    { key: 'nationality', label: 'Státní občanství', norm: normNat },
    { key: 'residenceCountry', label: 'Stát bydliště', norm: normNat },
    { key: 'city', label: 'Obec bydliště' },
    { key: 'street', label: 'Ulice a č.p.' },
    { key: 'idDocumentType', label: 'Druh dokladu', norm: normUpper },
    { key: 'idDocumentNumber', label: 'Číslo dokladu', norm: normUpper },
    { key: 'documentIssuerCountry', label: 'Stát vydání dokladu', norm: normNat },
    { key: 'visaNumber', label: 'Číslo víza' },
    { key: 'purposeOfStay', label: 'Účel pobytu', norm: normPurp },
    { key: 'dateArrival', label: 'Příjezd', norm: normDateVal },
    { key: 'dateDeparture', label: 'Odjezd', norm: normDateVal },
    {
      key: 'nights',
      label: 'Počet nocí',
      norm: v => String(Math.max(1, Number(v) || 1))
    },
    { key: 'note', label: 'Poznámka' }
  ];

  const diffs: ImportDiffField[] = [];
  for (const f of fields) {
    const normalize = f.norm || normStr;
    const exVal = normalize(existing[f.key]);
    const inVal = normalize(incoming[f.key]);
    if (exVal !== inVal) {
      diffs.push({
        key: String(f.key),
        label: f.label,
        existingValue: f.display ? f.display(existing[f.key]) : normStr(existing[f.key]) || '—',
        incomingValue: f.display ? f.display(incoming[f.key]) : normStr(incoming[f.key]) || '—'
      });
    }
  }
  return diffs;
}

/**
 * Naplánuje sloučení importovaných ubytování a hostů proti stávajícímu stavu aplikace.
 * Identické záznamy přeskočí a změněné připraví pro krokové řešení (Nahradit / Ponechat).
 */
export function planTabularImport(params: {
  incomingProperties: Property[];
  incomingGuests: Guest[];
  existingProperties: Property[];
  existingGuests: Guest[];
  activePropertyId: string;
}): ImportPlanResult {
  const {
    incomingProperties,
    incomingGuests,
    existingProperties,
    existingGuests,
    activePropertyId
  } = params;

  const newProperties: Property[] = [];
  const newGuests: Guest[] = [];
  const conflicts: ImportConflictItem[] = [];
  const propertyIdRemap: Record<string, string> = {};
  let skippedIdenticalProperties = 0;
  let skippedIdenticalGuests = 0;

  const workingProperties: Property[] = [...existingProperties];
  const workingGuests: Guest[] = [...existingGuests];

  // 1. Zpracování ubytování
  for (const rawProp of incomingProperties) {
    const originalId = normStr(rawProp.id);
    const match = findMatchingProperty(rawProp, workingProperties);

    if (match) {
      const mergedIncoming: Property = {
        ...rawProp,
        id: match.property.id
      };
      if (originalId && originalId !== match.property.id) {
        propertyIdRemap[originalId] = match.property.id;
      }
      const diffs = computePropertyDiffs(match.property, mergedIncoming);
      if (diffs.length === 0) {
        skippedIdenticalProperties++;
      } else {
        conflicts.push({
          kind: 'property',
          existing: match.property,
          incoming: mergedIncoming,
          incomingOriginalId: originalId,
          matchReasons: match.matchReasons,
          diffs
        });
      }
    } else {
      const assignedId = isPlaceholderPropId(originalId)
        ? `prop_${Date.now()}_${newProperties.length}`
        : originalId;
      if (originalId && originalId !== assignedId) {
        propertyIdRemap[originalId] = assignedId;
      }
      const createdProp: Property = {
        ...rawProp,
        id: assignedId
      };
      newProperties.push(createdProp);
      workingProperties.push(createdProp);
    }
  }

  const propertiesById = new Map<string, Property>();
  for (const p of workingProperties) propertiesById.set(p.id, p);

  const fallbackPropId =
    activePropertyId && propertiesById.has(activePropertyId)
      ? activePropertyId
      : workingProperties[0]?.id || '';

  // 2. Zpracování hostů
  for (const rawGuest of incomingGuests) {
    const rawPropId = normStr(rawGuest.propertyId);
    const remappedPropId = propertyIdRemap[rawPropId] || rawPropId;
    const resolvedPropId = propertiesById.has(remappedPropId)
      ? remappedPropId
      : fallbackPropId;

    const normalizedGuest: Guest = {
      ...rawGuest,
      propertyId: resolvedPropId,
      residenceCountry: normalizeCountryCode(
        rawGuest.residenceCountry || rawGuest.nationality || 'DEU'
      ),
      documentIssuerCountry: normalizeCountryCode(
        rawGuest.documentIssuerCountry || rawGuest.nationality || 'DEU'
      ),
      nationality: normalizeCountryCode(rawGuest.nationality || 'DEU'),
      purposeOfStay: normalizePurposeCode(rawGuest.purposeOfStay || '10')
    };

    const match = findMatchingGuest(normalizedGuest, workingGuests);
    if (match) {
      const mergedIncoming: Guest = {
        ...normalizedGuest,
        id: match.guest.id,
        createdAt: match.guest.createdAt || normalizedGuest.createdAt
      };
      const diffs = computeGuestDiffs(match.guest, mergedIncoming, propertiesById);
      if (diffs.length === 0) {
        skippedIdenticalGuests++;
      } else {
        conflicts.push({
          kind: 'guest',
          existing: match.guest,
          incoming: mergedIncoming,
          matchReasons: match.matchReasons,
          diffs
        });
      }
    } else {
      const assignedId = isPlaceholderGuestId(normStr(normalizedGuest.id))
        ? `g_${Date.now()}_${newGuests.length}_${Math.random().toString(36).slice(2, 6)}`
        : normalizedGuest.id;
      const createdGuest: Guest = {
        ...normalizedGuest,
        id: assignedId
      };
      newGuests.push(createdGuest);
      workingGuests.push(createdGuest);
    }
  }

  return {
    newProperties,
    newGuests,
    conflicts,
    skippedIdenticalProperties,
    skippedIdenticalGuests,
    propertyIdRemap
  };
}
