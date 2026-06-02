/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');

function slugToId(text) {
  return String(text || '')
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[\s\-/.]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseBoolean(value, defaultValue = true) {
  const normalized = String(value || '').trim().toLowerCase();

  if (!normalized) return defaultValue;
  return ['true', 'yes', 'y', '1', 'active'].includes(normalized);
}

function parseList(value) {
  return String(value || '')
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function readCsv(relativePath) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) return [];

  const text = fs.readFileSync(fullPath, 'utf8').trim();
  if (!text) return [];

  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines
    .filter((line) => line.trim())
    .map((line, index) => {
      const values = parseCsvLine(line);
      const row = headers.reduce((record, header, valueIndex) => {
        record[header] = values[valueIndex] || '';
        return record;
      }, {});

      return { row, rowNumber: index + 2 };
    });
}

function csvEscape(value) {
  const text = String(value || '');

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function writeCsv(relativePath, headers, rows) {
  const fullPath = path.join(projectRoot, relativePath);
  const content = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ].join('\n');

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${content}\n`, 'utf8');
}

function writeJson(relativePath, data) {
  const fullPath = path.join(projectRoot, relativePath);

  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(relativePath, fallback = []) {
  const fullPath = path.join(projectRoot, relativePath);

  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function timestamp() {
  return new Date()
    .toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '-')
    .replace(/\..+$/, '');
}

function backupSupportKnowledge() {
  const sourceDir = path.join(projectRoot, 'data', 'support-knowledge');
  const backupDir = path.join(projectRoot, 'data', 'support-knowledge-backups', timestamp());

  fs.mkdirSync(backupDir, { recursive: true });

  if (!fs.existsSync(sourceDir)) return backupDir;

  for (const file of fs.readdirSync(sourceDir)) {
    if (file.endsWith('.json')) {
      fs.copyFileSync(path.join(sourceDir, file), path.join(backupDir, file));
    }
  }

  return backupDir;
}

function validateRequired(row, fields, fileName, rowNumber) {
  return fields
    .filter((field) => !String(row[field] || '').trim())
    .map((field) => `ERROR: ${fileName} row ${rowNumber} missing ${field}`);
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function detectCategoryAndDeviceType(itemGroup, itemName = '') {
  const text = normalizeText(`${itemGroup} ${itemName}`);

  if (/(wireless|router|epon|xpon|ftth|omada|onu|mesh|wifi)/.test(text)) {
    return { category: 'Router / Internet', deviceType: /onu/.test(text) ? 'ONU' : 'Router' };
  }

  if (/(ip camera|hd tvi|cctv|nvr|dvr|poe switch|vigi|tapo camera)/.test(text)) {
    return { category: 'CCTV', deviceType: /nvr/.test(text) ? 'NVR' : /dvr/.test(text) ? 'DVR' : 'Camera' };
  }

  if (/printer/.test(text)) {
    return { category: 'Printer', deviceType: 'Printer' };
  }

  if (/(ups|dc ups|adapter|switch adapter|power)/.test(text)) {
    return { category: 'UPS / Power', deviceType: /adapter/.test(text) ? 'Adapter' : 'UPS' };
  }

  if (/(mouse|keyboard|speaker|ssd|storage|smart accessories|accessories)/.test(text)) {
    return { category: 'Accessories', deviceType: 'Accessory' };
  }

  return { category: 'Other Product', deviceType: 'Other' };
}

function generateProductId(row) {
  const brand = row.brand || row.product_brand || '';
  const codeOrName = row.item_code || row.itemCode || row.model || row.item_name || row.itemName || '';

  return slugToId(`${brand} ${codeOrName}`);
}

module.exports = {
  projectRoot,
  slugToId,
  parseBoolean,
  parseList,
  readCsv,
  writeCsv,
  writeJson,
  readJson,
  backupSupportKnowledge,
  validateRequired,
  detectCategoryAndDeviceType,
  generateProductId,
};
