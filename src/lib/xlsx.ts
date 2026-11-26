/**
 * Nulově závislý prohlížečový zapisovač a čtečka formátu Excel (.xlsx / OOXML ZIP).
 * Využívá nativní CompressionStream/DecompressionStream ('deflate-raw') s fallbackem na ZIP STORE.
 */

export interface XlsxSheetData {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

export interface ParsedXlsxSheet {
  name: string;
  rows: string[][];
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8');

function stripInvalidXmlChars(val: string): string {
  // XML 1.0 nepovoluje kontrolní znaky mimo \t, \n, \r
  return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function escapeXml(val: unknown): string {
  return stripInvalidXmlChars(String(val ?? ''))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colIndexToLetter(colIdx: number): string {
  let n = colIdx + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colLetterToIndex(letters: string): number {
  let idx = 0;
  for (let i = 0; i < letters.length; i++) {
    idx = idx * 26 + (letters.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function sanitizeSheetName(name: string, index: number): string {
  const cleaned = (name || `List${index + 1}`)
    .replace(/[\\/?*[\]:]/g, ' ')
    .trim()
    .slice(0, 31);
  return cleaned || `List${index + 1}`;
}

async function compressDeflateRaw(data: Uint8Array): Promise<{ method: number; compressed: Uint8Array }> {
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      writer.write(copy);
      writer.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      return { method: 8, compressed: new Uint8Array(buf) };
    } catch {
      // Fallback na STORE (method 0), pokud prohlížeč nepodporuje deflate-raw
    }
  }
  return { method: 0, compressed: data };
}

async function decompressDeflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Tento prohlížeč nepodporuje dekompresi .xlsx (DecompressionStream).');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  writer.write(copy);
  writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(buf);
}

interface ZipEntryInput {
  path: string;
  data: Uint8Array;
}

async function createZipBlob(entries: ZipEntryInput[], mimeType: string): Promise<Blob> {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.path);
    const uncompressedSize = entry.data.length;
    const crc = crc32(entry.data);
    const { method, compressed } = await compressDeflateRaw(entry.data);
    const compressedSize = compressed.length;

    // Local file header (30 bytes + filename)
    const lfh = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(lfh.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 filename flag
    lv.setUint16(8, method, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x5421, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressedSize, true);
    lv.setUint32(22, uncompressedSize, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    lfh.set(nameBytes, 30);

    localParts.push(lfh, compressed);

    // Central directory header (46 bytes + filename)
    const cdh = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cdh.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x5421, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressedSize, true);
    cv.setUint32(24, uncompressedSize, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cdh.set(nameBytes, 46);

    centralParts.push(cdh);
    offset += lfh.length + compressed.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [...localParts, ...centralParts, eocd].map(u8 => {
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);
    return ab;
  });

  return new Blob(blobParts, { type: mimeType });
}

function buildWorksheetXml(sheet: XlsxSheetData): string {
  const allRows: (string | number)[][] = [sheet.headers, ...sheet.rows];
  const xmlRows = allRows.map((row, rIdx) => {
    const rowNum = rIdx + 1;
    const isHeader = rIdx === 0;
    const cells = row
      .map((val, cIdx) => {
        const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
        const styleAttr = isHeader ? ' s="1"' : '';
        if (typeof val === 'number' && Number.isFinite(val)) {
          return `<c r="${ref}"${styleAttr}><v>${val}</v></c>`;
        }
        const raw = stripInvalidXmlChars(String(val ?? ''));
        const needsPreserve = raw !== raw.trim() || raw.includes('\n');
        const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';
        return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t${spaceAttr}>${escapeXml(raw)}</t></is></c>`;
      })
      .join('');
    return `<row r="${rowNum}">${cells}</row>`;
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetData>
    ${xmlRows.join('\n    ')}
  </sheetData>
</worksheet>`;
}

/**
 * Sestaví standardní více-listový Excel sešit (.xlsx)
 */
export async function buildXlsxBlob(sheets: XlsxSheetData[]): Promise<Blob> {
  const safeSheets = sheets.map((s, idx) => ({
    ...s,
    name: sanitizeSheetName(s.name, idx)
  }));

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${safeSheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${safeSheets
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('\n    ')}
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${safeSheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

  const entries: ZipEntryInput[] = [
    { path: '[Content_Types].xml', data: textEncoder.encode(contentTypesXml) },
    { path: '_rels/.rels', data: textEncoder.encode(rootRelsXml) },
    { path: 'xl/workbook.xml', data: textEncoder.encode(workbookXml) },
    { path: 'xl/_rels/workbook.xml.rels', data: textEncoder.encode(workbookRelsXml) },
    { path: 'xl/styles.xml', data: textEncoder.encode(stylesXml) },
    ...safeSheets.map((s, i) => ({
      path: `xl/worksheets/sheet${i + 1}.xml`,
      data: textEncoder.encode(buildWorksheetXml(s))
    }))
  ];

  return createZipBlob(
    entries,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
}

async function unzipFiles(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // Hledáme End of Central Directory (0x06054b50) od konce souboru
  let eocdOffset = -1;
  const minSearch = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new Error('Soubor není platný Excel (.xlsx) archiv.');
  }

  const entryCount = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const files = new Map<string, Uint8Array>();
  let ptr = cdOffset;

  for (let i = 0; i < entryCount; i++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);
    const entryName = textDecoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;

    if (entryName.endsWith('/')) continue;
    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      continue;
    }

    const lfhNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lfhExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;
    const slice = bytes.subarray(dataStart, dataStart + compressedSize);

    let extracted: Uint8Array;
    if (method === 0) {
      extracted = slice;
    } else if (method === 8) {
      extracted = await decompressDeflateRaw(slice);
    } else {
      throw new Error(`Nepodporovaná komprese v souboru .xlsx (metoda ${method}).`);
    }

    files.set(entryName.replace(/^\/+/, ''), extracted);
  }

  return files;
}

function parseXmlDoc(bytes: Uint8Array): Document {
  const xmlStr = textDecoder.decode(bytes);
  const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
  return doc;
}

function getElementsByLocalName(root: Document | Element, localName: string): Element[] {
  const all = root.getElementsByTagName('*');
  const out: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    if (all[i].localName === localName) out.push(all[i]);
  }
  return out;
}

function extractTextRuns(el: Element): string {
  const tNodes = getElementsByLocalName(el, 't');
  if (tNodes.length === 0) return el.textContent || '';
  return tNodes.map(n => n.textContent || '').join('');
}

function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1000 || serial > 100000) return null;
  // Excel epoch 1899-12-30 (zohledňuje přestupný bug roku 1900)
  const utcMs = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function looksLikeDateHeader(header: string): boolean {
  const norm = (header || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    norm.includes('datum') ||
    norm.includes('narozeni') ||
    norm.includes('prijezd') ||
    norm.includes('odjezd') ||
    norm.includes('birth') ||
    norm.includes('arrival') ||
    norm.includes('departure') ||
    norm.includes('check_in') ||
    norm.includes('check_out')
  );
}

/**
 * Načte všechny listy z binárního Excelu (.xlsx)
 */
export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedXlsxSheet[]> {
  const files = await unzipFiles(buffer);

  // 1. Shared strings (pokud existují)
  const sharedStrings: string[] = [];
  const sstBytes = files.get('xl/sharedStrings.xml');
  if (sstBytes) {
    const sstDoc = parseXmlDoc(sstBytes);
    for (const si of getElementsByLocalName(sstDoc, 'si')) {
      sharedStrings.push(extractTextRuns(si));
    }
  }

  // 2. Relace workbooku -> mapování rId na cestu k listu
  const relMap = new Map<string, string>();
  const wbRelsBytes = files.get('xl/_rels/workbook.xml.rels');
  if (wbRelsBytes) {
    const relDoc = parseXmlDoc(wbRelsBytes);
    for (const rel of getElementsByLocalName(relDoc, 'Relationship')) {
      const id = rel.getAttribute('Id') || '';
      const target = rel.getAttribute('Target') || '';
      if (id && target) {
        const normalized = target.startsWith('/')
          ? target.slice(1)
          : target.startsWith('xl/')
          ? target
          : `xl/${target.replace(/^\.\//, '')}`;
        relMap.set(id, normalized);
      }
    }
  }

  // 3. Seznam listů z workbook.xml
  const wbBytes = files.get('xl/workbook.xml');
  const sheetDescriptors: { name: string; path: string }[] = [];
  if (wbBytes) {
    const wbDoc = parseXmlDoc(wbBytes);
    const sheets = getElementsByLocalName(wbDoc, 'sheet');
    sheets.forEach((s, idx) => {
      const name = s.getAttribute('name') || `List${idx + 1}`;
      const rId =
        s.getAttribute('r:id') ||
        s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ||
        '';
      const path = relMap.get(rId) || `xl/worksheets/sheet${idx + 1}.xml`;
      sheetDescriptors.push({ name, path });
    });
  } else {
    for (const path of Array.from(files.keys()).sort()) {
      if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(path)) {
        sheetDescriptors.push({ name: path.replace(/^.*\//, ''), path });
      }
    }
  }

  // 4. Parsování buněk v každém listu
  const parsedSheets: ParsedXlsxSheet[] = [];
  for (const desc of sheetDescriptors) {
    const sheetBytes = files.get(desc.path);
    if (!sheetBytes) continue;
    const doc = parseXmlDoc(sheetBytes);
    const rowElements = getElementsByLocalName(doc, 'row');
    const rawRows: string[][] = [];

    for (const rowEl of rowElements) {
      const cells = getElementsByLocalName(rowEl, 'c');
      const rowArr: string[] = [];
      let fallbackCol = 0;

      for (const cellEl of cells) {
        const ref = cellEl.getAttribute('r') || '';
        const refMatch = ref.match(/^([A-Z]+)[0-9]+$/i);
        const colIdx = refMatch ? colLetterToIndex(refMatch[1].toUpperCase()) : fallbackCol;
        fallbackCol = colIdx + 1;

        while (rowArr.length <= colIdx) rowArr.push('');

        const cellType = cellEl.getAttribute('t') || '';
        let value = '';

        if (cellType === 'inlineStr') {
          const isEl = getElementsByLocalName(cellEl, 'is')[0];
          value = isEl ? extractTextRuns(isEl) : extractTextRuns(cellEl);
        } else if (cellType === 's') {
          const vEl = getElementsByLocalName(cellEl, 'v')[0];
          const sIdx = parseInt((vEl?.textContent || '').trim(), 10);
          value = Number.isFinite(sIdx) && sIdx >= 0 && sIdx < sharedStrings.length ? sharedStrings[sIdx] : '';
        } else if (cellType === 'b') {
          const vEl = getElementsByLocalName(cellEl, 'v')[0];
          value = (vEl?.textContent || '').trim() === '1' ? 'TRUE' : 'FALSE';
        } else {
          const vEl = getElementsByLocalName(cellEl, 'v')[0];
          value = vEl?.textContent || '';
        }

        rowArr[colIdx] = value.trim();
      }

      if (rowArr.some(c => c.length > 0)) {
        rawRows.push(rowArr);
      }
    }

    // Převod číselných Excel sériových dat v date sloupcích (např. pokud uživatel upravil datum v Excelu)
    if (rawRows.length >= 2) {
      const headers = rawRows[0];
      const dateColFlags = headers.map(looksLikeDateHeader);
      for (let r = 1; r < rawRows.length; r++) {
        for (let c = 0; c < rawRows[r].length; c++) {
          if (dateColFlags[c] && /^\d{4,5}(\.\d+)?$/.test(rawRows[r][c])) {
            const iso = excelSerialToIsoDate(parseFloat(rawRows[r][c]));
            if (iso) rawRows[r][c] = iso;
          }
        }
      }
    }

    if (rawRows.length > 0) {
      parsedSheets.push({ name: desc.name, rows: rawRows });
    }
  }

  return parsedSheets;
}
