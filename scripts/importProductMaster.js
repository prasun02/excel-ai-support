/* eslint-disable @typescript-eslint/no-require-imports */
const {
  detectCategoryAndDeviceType,
  generateProductId,
  parseBoolean,
  readCsv,
  readJson,
  validateRequired,
  writeJson,
} = require('./knowledge-utils');

const fileName = 'products_raw.csv';
const rows = readCsv('data/product-master/products_raw.csv');
const errors = [];

const products = rows.map(({ row, rowNumber }) => {
  errors.push(...validateRequired(row, ['item_name', 'brand'], fileName, rowNumber));

  const detected = detectCategoryAndDeviceType(row.item_group, row.item_name);

  return {
    productId: generateProductId(row),
    itemName: row.item_name.trim(),
    itemCode: row.item_code.trim(),
    itemGroup: row.item_group.trim(),
    brand: row.brand.trim(),
    category: detected.category,
    deviceType: detected.deviceType,
    model: row.item_name.trim(),
    modelFamily: row.item_group.trim() || detected.deviceType,
    requiresSerial: detected.category !== 'Router / Internet' && detected.category !== 'Accessories',
    active: parseBoolean(row.active),
  };
});

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else if (products.length === 0) {
  console.warn('WARNING: products_raw.csv has no product rows. Existing product JSON was not overwritten.');
} else {
  const existingSupportProducts = readJson('data/support-knowledge/products.json', []);
  const mergedById = new Map();

  for (const product of existingSupportProducts) {
    if (product.productId) mergedById.set(product.productId, product);
  }

  for (const product of products) {
    mergedById.set(product.productId, product);
  }

  writeJson('data/product-master/products_normalized.json', products);
  writeJson('data/support-knowledge/products.json', Array.from(mergedById.values()));

  console.log(`Imported products: ${products.length}`);
  console.log('Generated data/product-master/products_normalized.json');
  console.log('Updated data/support-knowledge/products.json');
}
