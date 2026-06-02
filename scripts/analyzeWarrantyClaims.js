/* eslint-disable @typescript-eslint/no-require-imports */
const {
  detectCategoryAndDeviceType,
  parseList,
  readCsv,
  validateRequired,
  writeCsv,
} = require('./knowledge-utils');

const fileName = 'warranty_claims_raw.csv';
const rows = readCsv('data/warranty-history/warranty_claims_raw.csv');
const errors = [];
const groups = new Map();

function normalizeProblem(problem) {
  return String(problem || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function safeCauseAndCheck(category, problem) {
  const text = normalizeProblem(problem);

  if (category === 'Router / Internet') {
    return {
      causes: 'Power adapter issue;ISP line issue;WiFi interference',
      checks: 'Check power adapter;Restart router and ONU;Check WAN/Internet light',
    };
  }

  if (category === 'Printer') {
    return {
      causes: 'Connection issue;Driver issue;Consumable or hardware issue',
      checks: 'Check power and connection;Check error message;Confirm driver status',
    };
  }

  if (category === 'CCTV') {
    return {
      causes: 'Power issue;Cable issue;Storage or device setting issue',
      checks: 'Check power;Check cable;Check DVR/NVR status',
    };
  }

  if (/battery|backup|power|charge/.test(text) || category === 'UPS / Power') {
    return {
      causes: 'Battery issue;Load issue;Charging issue',
      checks: 'Check load;Check charging indicator;Test with safe load',
    };
  }

  return {
    causes: 'Needs manual review by Excel support team',
    checks: 'Collect model serial and problem details',
  };
}

for (const { row, rowNumber } of rows) {
  errors.push(...validateRequired(row, ['item_name', 'problem'], fileName, rowNumber));

  const detected = detectCategoryAndDeviceType('', `${row.item_name} ${row.item_code} ${row.product_brand}`);
  const key = [
    row.product_brand,
    row.item_code,
    row.item_name,
    normalizeProblem(row.problem),
  ].join('::');
  const current = groups.get(key) || {
    brand: row.product_brand.trim(),
    itemCode: row.item_code.trim(),
    itemName: row.item_name.trim(),
    detectedCategory: detected.category,
    problemName: row.problem.trim(),
    claimCount: 0,
    statuses: new Map(),
  };

  current.claimCount += 1;
  current.statuses.set(row.warranty_status, (current.statuses.get(row.warranty_status) || 0) + 1);
  groups.set(key, current);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  const suggestions = Array.from(groups.values())
    .sort((left, right) => right.claimCount - left.claimCount)
    .map((group) => {
      const safe = safeCauseAndCheck(group.detectedCategory, group.problemName);

      return {
        priority: group.claimCount >= 10 ? 'High' : group.claimCount >= 3 ? 'Medium' : 'Low',
        brand: group.brand,
        itemCode: group.itemCode,
        itemName: group.itemName,
        detectedCategory: group.detectedCategory,
        problemName: group.problemName,
        problemKeywords: parseList(group.problemName.replace(/\s+/g, ';')).join(';'),
        claimCount: String(group.claimCount),
        warrantyStatusMix: Array.from(group.statuses.entries()).map(([status, count]) => `${status || 'blank'}:${count}`).join(';'),
        suggestedPossibleCauses: safe.causes,
        suggestedBasicChecks: safe.checks,
        needsManualSolution: 'TRUE',
        sourceType: 'warranty_history',
        approvedByExcel: 'FALSE',
        active: 'FALSE',
      };
    });

  writeCsv(
    'data/support-knowledge-import/warranty_problem_suggestions.csv',
    [
      'priority',
      'brand',
      'itemCode',
      'itemName',
      'detectedCategory',
      'problemName',
      'problemKeywords',
      'claimCount',
      'warrantyStatusMix',
      'suggestedPossibleCauses',
      'suggestedBasicChecks',
      'needsManualSolution',
      'sourceType',
      'approvedByExcel',
      'active',
    ],
    suggestions
  );

  console.log(`Warranty suggestions generated: ${suggestions.length}`);
  console.log('Generated data/support-knowledge-import/warranty_problem_suggestions.csv');
}
