import { readFile, writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const inputPath = new URL('../excel/support_data.xlsx', import.meta.url);
const outputPath = new URL('../data/supportData.json', import.meta.url);

const keywordHeaders = new Set([
  'keyword',
  'keywords',
  'key',
  'keys',
  'tag',
  'tags',
  'issue',
  'issues',
  'কিওয়ার্ড',
  'কিওয়ার্ড',
  'শব্দ',
  'সমস্যা',
  'সমস্যাগুলো',
]);

const replyHeaders = new Set([
  'reply',
  'response',
  'answer',
  'solution',
  'support reply',
  'support_reply',
  'message',
  'উত্তর',
  'রিপ্লাই',
  'সমাধান',
  'বার্তা',
]);

function decodeXml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase();
}

function splitKeywords(value) {
  return String(value || '')
    .split(/[,;،，\n|।]+/)
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

function columnNameToIndex(cellRef) {
  const letters = cellRef.replace(/[0-9]/g, '');
  let index = 0;

  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }

  return index - 1;
}

function readZipEntries(buffer) {
  let eocdOffset = -1;
  const minimumEocdLength = 22;
  const searchStart = Math.max(0, buffer.length - 65536 - minimumEocdLength);

  for (let offset = buffer.length - minimumEocdLength; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('The Excel file is not a valid .xlsx zip archive.');
  }

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error('Invalid .xlsx central directory.');
    }

    const compressionMethod = buffer.readUInt16LE(centralOffset + 10);
    const compressedSize = buffer.readUInt32LE(centralOffset + 20);
    const fileNameLength = buffer.readUInt16LE(centralOffset + 28);
    const extraLength = buffer.readUInt16LE(centralOffset + 30);
    const commentLength = buffer.readUInt16LE(centralOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(centralOffset + 42);
    const fileName = buffer
      .subarray(centralOffset + 46, centralOffset + 46 + fileNameLength)
      .toString('utf8');

    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`Invalid local file header for ${fileName}.`);
    }

    const localFileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
    const data =
      compressionMethod === 0
        ? compressedData
        : inflateRawSync(compressedData);

    entries.set(fileName, data.toString('utf8'));
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readSharedStrings(entries) {
  const sharedStringsXml = entries.get('xl/sharedStrings.xml');

  if (!sharedStringsXml) {
    return [];
  }

  return [...sharedStringsXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)];
    return decodeXml(textParts.map((part) => part[1]).join(''));
  });
}

function getFirstSheetPath(entries) {
  const workbookXml = entries.get('xl/workbook.xml');
  const workbookRelsXml = entries.get('xl/_rels/workbook.xml.rels');

  if (!workbookXml || !workbookRelsXml) {
    throw new Error('Workbook metadata is missing from the .xlsx file.');
  }

  const firstSheetMatch = workbookXml.match(/<sheet\b[^>]*r:id="([^"]+)"/);

  if (!firstSheetMatch) {
    throw new Error('No worksheets found in the .xlsx file.');
  }

  const relationshipId = firstSheetMatch[1];
  const relationshipPattern = new RegExp(
    `<Relationship\\b[^>]*Id="${relationshipId}"[^>]*Target="([^"]+)"`,
    'i'
  );
  const relationshipMatch = workbookRelsXml.match(relationshipPattern);

  if (!relationshipMatch) {
    throw new Error(`Worksheet relationship ${relationshipId} was not found.`);
  }

  const target = relationshipMatch[1].replace(/^\/+/, '');

  return target.startsWith('xl/') ? target : `xl/${target}`;
}

function cellValue(cellXml, sharedStrings) {
  const typeMatch = cellXml.match(/\bt="([^"]+)"/);
  const type = typeMatch?.[1];

  if (type === 'inlineStr') {
    const inlineText = cellXml.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
    return decodeXml(inlineText?.[1] || '');
  }

  const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
  const value = decodeXml(valueMatch?.[1] || '');

  if (type === 's') {
    return sharedStrings[Number(value)] || '';
  }

  return value;
}

function readRows(sheetXml, sharedStrings) {
  return [...sheetXml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row = [];

    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const refMatch = cellMatch[1].match(/\br="([^"]+)"/);
      const index = refMatch ? columnNameToIndex(refMatch[1]) : row.length;
      row[index] = cellValue(cellMatch[0], sharedStrings);
    }

    return row.map((value) => String(value || '').trim());
  });
}

function findColumn(headers, candidates, fallbackIndex) {
  const index = headers.findIndex((header) => candidates.has(normalizeHeader(header)));
  return index === -1 ? fallbackIndex : index;
}

function rowsToSupportData(rows) {
  const nonEmptyRows = rows.filter((row) => row.some(Boolean));

  if (nonEmptyRows.length === 0) {
    return [];
  }

  const firstRow = nonEmptyRows[0].map(normalizeHeader);
  const hasHeader = firstRow.some((header) => keywordHeaders.has(header) || replyHeaders.has(header));
  const headers = hasHeader ? nonEmptyRows[0] : [];
  const bodyRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
  const keywordIndex = hasHeader ? findColumn(headers, keywordHeaders, 0) : 0;
  const replyIndex = hasHeader ? findColumn(headers, replyHeaders, 1) : 1;

  return bodyRows
    .map((row) => ({
      keywords: splitKeywords(row[keywordIndex]),
      reply: String(row[replyIndex] || '').trim(),
    }))
    .filter((item) => item.keywords.length > 0 && item.reply);
}

async function main() {
  const file = await readFile(inputPath);

  if (file.length === 0) {
    throw new Error('excel/support_data.xlsx is empty. Add workbook data before importing.');
  }

  const entries = readZipEntries(file);
  const sharedStrings = readSharedStrings(entries);
  const firstSheetPath = getFirstSheetPath(entries);
  const sheetXml = entries.get(firstSheetPath);

  if (!sheetXml) {
    throw new Error(`Worksheet ${firstSheetPath} was not found in the .xlsx file.`);
  }

  const supportData = rowsToSupportData(readRows(sheetXml, sharedStrings));

  if (supportData.length === 0) {
    throw new Error('No support keyword rows were found. Use columns like "keywords" and "reply".');
  }

  await writeFile(outputPath, `${JSON.stringify(supportData, null, 2)}\n`, 'utf8');

  console.log(`Imported ${supportData.length} support entries into data/supportData.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
