/* eslint-disable @typescript-eslint/no-require-imports */
const {
  backupSupportKnowledge,
  parseBoolean,
  parseList,
  projectRoot,
  readCsv,
  readJson,
  slugToId,
  writeJson,
} = require('./knowledge-utils');

const path = require('node:path');

const INPUT_FILE = 'data/support-knowledge-import/support_case_input.csv';
const OUTPUT_DIR = 'data/support-knowledge';
const FIRMWARE_WARNING =
  'Firmware update must match exact model and hardware version. Wrong firmware or power loss during update may damage router. If you are unsure, please visit Excel CSP.';

function unique(items) {
  return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];
}

function bool(row, key, defaultValue = false) {
  return parseBoolean(row[key], defaultValue);
}

function cleanModel(model) {
  return String(model || '').replace(/\s+/g, ' ').trim();
}

function caseBaseId(row) {
  return slugToId([
    row.category,
    row.brand,
    row.caseTitle,
    row.procedureName,
  ].filter(Boolean).join(' '));
}

function productId(row, model) {
  return slugToId([row.brand, model || row.productFamily || row.deviceType].filter(Boolean).join(' '));
}

function safeCode(row) {
  return `${caseBaseId(row)}_SAFE_CHECKS`;
}

function procedureId(row) {
  return slugToId([row.brand, row.procedureName || row.caseTitle].filter(Boolean).join(' '));
}

function splitFollowUpAnswers(value) {
  return String(value || '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeByKey(existing, generated, key) {
  const getKey = typeof key === 'function' ? key : (item) => item[key];
  const generatedKeys = new Set(generated.map(getKey));
  return [
    ...existing.filter((item) => !generatedKeys.has(getKey(item))),
    ...generated,
  ];
}

function readExisting(fileName) {
  return readJson(path.join(OUTPUT_DIR, fileName), []);
}

function buildKnowledgeFromCase(row) {
  const baseId = caseBaseId(row);
  const models = unique(parseList(row.models)).map(cleanModel);
  const hardwareVersions = unique(parseList(row.hardwareVersions));
  const englishKeywords = parseList(row.customerProblemWords);
  const banglaBanglishKeywords = parseList(row.banglaBanglishWords);
  const symptoms = unique([...englishKeywords, ...banglaBanglishKeywords, row.caseTitle]);
  const possibleCauses = parseList(row.possibleCauses);
  const safeCustomerChecks = parseList(row.safeCustomerChecks);
  const internalTechnicianSteps = parseList(row.internalTechnicianSteps);
  const customerVisibleSteps = parseList(row.customerVisibleSteps);
  const procedureSteps = parseList(row.procedureSteps);
  const followUpQuestions = parseList(row.followUpQuestions);
  const followUpAnswers = splitFollowUpAnswers(row.followUpAnswers);
  const escalationConditions = parseList(row.cspEscalationWhen);
  const problemId = `${baseId}_COMMON`;
  const procedureCode = row.procedureName ? procedureId(row) : '';
  const stepGroupId = `${problemId}_${safeCode(row)}`;
  const riskLevel = row.riskLevel || 'Medium';

  const commonProblem = {
    problemId,
    category: row.category,
    brand: row.brand,
    modelFamily: row.productFamily || 'General',
    problemName: row.caseTitle,
    symptoms,
    possibleCauses,
    customerExplanation: `This looks like ${row.caseTitle}. I can share possible causes and safe checks first.`,
    solutionSteps: customerVisibleSteps,
    safeCustomerChecks,
    supportStory: row.supportStory,
    casePriority: row.casePriority || 'Medium',
    riskLevel,
    requiresModel: bool(row, 'requiresModel'),
    requiresHardwareVersion: bool(row, 'requiresHardwareVersion'),
    requiresSerial: bool(row, 'requiresSerial'),
    requiresStickerPhoto: bool(row, 'requiresStickerPhoto'),
    firmwareRequired: bool(row, 'firmwareRequired'),
    configurationRequired: bool(row, 'configurationRequired'),
    warrantyRelated: bool(row, 'warrantyRelated'),
    routerFreeSupport: bool(row, 'routerFreeSupport'),
    cspEscalationWhen: escalationConditions,
    nextIfNotSolved: row.escalationMessage || 'Please contact your nearest Excel CSP for further support.',
    sourceType: row.sourceType || 'manual_case',
    active: true,
  };

  const products = (models.length ? models : ['']).map((model) => ({
    productId: productId(row, model),
    itemName: [row.brand, model || row.productFamily].filter(Boolean).join(' '),
    itemCode: model,
    itemGroup: row.productFamily,
    category: row.category,
    brand: row.brand,
    model,
    modelFamily: row.productFamily || 'General',
    deviceType: row.deviceType,
    hardwareVersions,
    requiresSerial: bool(row, 'requiresSerial'),
    requiresModel: bool(row, 'requiresModel'),
    requiresHardwareVersion: bool(row, 'requiresHardwareVersion'),
    active: true,
  }));

  const modelSolutions = (models.length ? models : ['']).map((model) => ({
    solutionId: `${baseId}_${slugToId(model || row.productFamily || 'GENERAL')}`,
    productId: productId(row, model),
    model,
    hardwareVersions,
    problemName: row.caseTitle,
    symptoms,
    possibleCauses,
    safeCustomerChecks,
    solutionSteps: customerVisibleSteps,
    internalTechnicianSteps,
    procedureId: procedureCode,
    riskLevel,
    requiresModel: bool(row, 'requiresModel'),
    requiresHardwareVersion: bool(row, 'requiresHardwareVersion'),
    requiresSerial: bool(row, 'requiresSerial'),
    requiresStickerPhoto: bool(row, 'requiresStickerPhoto'),
    firmwareRequired: bool(row, 'firmwareRequired'),
    firmwareWarning: bool(row, 'firmwareRequired') ? FIRMWARE_WARNING : '',
    configurationRequired: bool(row, 'configurationRequired'),
    warrantyRelated: bool(row, 'warrantyRelated'),
    routerFreeSupport: bool(row, 'routerFreeSupport'),
    nextIfNotSolved: row.escalationMessage || 'If the issue continues, please contact Excel CSP.',
    imageUrl: row.imageUrl || '',
    videoUrl: row.videoUrl || '',
    sourceType: row.sourceType || 'manual_case',
    active: true,
  }));

  const diagnosticQuestions = [
    bool(row, 'requiresModel') || bool(row, 'requiresHardwareVersion') || bool(row, 'requiresStickerPhoto')
      ? 'Please share your router model or upload a clear photo of the backside sticker. You can also write the model manually, for example: TL-WR845N Ver 4.'
      : '',
    bool(row, 'requiresSerial')
      ? 'If this becomes a warranty or CSP claim, please keep the serial number/SN ready.'
      : '',
    ...followUpQuestions.slice(0, 2),
  ].filter(Boolean).map((questionText, index) => ({
    problemId,
    problemName: row.caseTitle,
    questionOrder: index + 1,
    questionText,
    answerType: 'text',
    answerOptions: [],
    yesNextQuestionOrder: '',
    noNextQuestionOrder: '',
    yesStepGroupCode: safeCode(row),
    noStepGroupCode: '',
    notSureStepGroupCode: riskLevel.toLowerCase() === 'high' ? 'ESCALATE_CSP' : safeCode(row),
    active: true,
  }));

  const solutionStepGroup = {
    stepGroupId,
    problemId,
    problemName: row.caseTitle,
    stepGroupCode: safeCode(row),
    stepGroupName: `${row.caseTitle} safe customer checks`,
    sourceType: row.sourceType || 'manual_case',
    riskLevel,
    active: true,
  };

  const solutionSteps = safeCustomerChecks.map((step, index) => ({
    stepId: `${stepGroupId}_${String(index + 1).padStart(2, '0')}`,
    stepGroupId,
    problemId,
    problemName: row.caseTitle,
    stepGroupCode: safeCode(row),
    stepOrder: index + 1,
    customerStepText: step,
    expectedResult: 'The customer can confirm whether the issue improves.',
    procedureCode: '',
    imageUrl: row.imageUrl || '',
    videoUrl: row.videoUrl || '',
    active: true,
  }));

  const procedure = procedureCode
    ? {
        procedureId: procedureCode,
        procedureCode,
        procedureName: row.procedureName,
        category: row.category,
        brand: row.brand,
        model: models[0] || '',
        hardwareVersion: hardwareVersions[0] || '',
        procedureType: bool(row, 'firmwareRequired') ? 'firmware_update' : 'configuration',
        shortAnswer: row.procedureName,
        warning: bool(row, 'firmwareRequired') ? FIRMWARE_WARNING : 'Follow this procedure only if you are confident. Otherwise contact Excel CSP.',
        imageUrl: row.imageUrl || '',
        videoUrl: row.videoUrl || '',
        active: true,
      }
    : null;

  const procedureStepRows = procedureCode
    ? procedureSteps.map((instruction, index) => ({
        procedureId: procedureCode,
        procedureCode,
        stepOrder: index + 1,
        instruction,
        expectedResult: index === procedureSteps.length - 1 ? 'Issue should be tested after completing the procedure.' : 'Step completed safely.',
        troubleshootingIfNotShowing: riskLevel.toLowerCase() === 'high' ? 'If unsure, stop and contact Excel CSP.' : 'Check the previous step and try again.',
        active: true,
      }))
    : [];

  const followUps = followUpQuestions.map((question, index) => ({
    parentSolutionId: modelSolutions[0]?.solutionId || problemId,
    questionKeywords: unique([question, ...question.split(' ').filter((word) => word.length > 3)]),
    answer: followUpAnswers[index] || row.escalationMessage || 'Please contact Excel CSP for this follow-up.',
    language: /[\u0980-\u09FF]/.test(question) ? 'bn' : 'en',
    procedureCode: /firmware|update|how|configure|pppoe|dynamic|ip/i.test(question) ? procedureCode : '',
    active: true,
  }));

  const escalationRule = {
    category: row.category,
    condition: 'not solved',
    escalationMessage: row.escalationMessage || 'Please contact your nearest Excel Customer Support Point for further support.',
    cspEscalationWhen: escalationConditions,
    riskLevel,
    active: true,
  };

  return {
    products,
    commonProblems: [commonProblem],
    modelSpecificSolutions: modelSolutions,
    diagnosticQuestions,
    solutionStepGroups: [solutionStepGroup],
    solutionSteps,
    procedures: procedure ? [procedure] : [],
    procedureSteps: procedureStepRows,
    followUpQuestions: followUps,
    escalationRules: [escalationRule],
  };
}

function flatten(collections, key) {
  return collections.flatMap((collection) => collection[key] || []);
}

function writeMerged(fileName, key, generated) {
  const existing = readExisting(fileName);
  writeJson(path.join(OUTPUT_DIR, fileName), mergeByKey(existing, generated, key));
}

function escalationKey(item) {
  return `${item.category || ''}::${item.condition || ''}`;
}

function main() {
  const rows = readCsv(INPUT_FILE);
  const approvedRows = rows
    .map(({ row, rowNumber }) => ({ ...row, rowNumber }))
    .filter((row) => parseBoolean(row.approvedByExcel, false) && parseBoolean(row.active, false));

  if (approvedRows.length === 0) {
    console.log('No approved active support cases found. Nothing changed.');
    return;
  }

  const backupDir = backupSupportKnowledge();
  const collections = approvedRows.map(buildKnowledgeFromCase);

  writeMerged('products.json', 'productId', flatten(collections, 'products'));
  writeMerged('commonProblems.json', 'problemId', flatten(collections, 'commonProblems'));
  writeMerged('modelSpecificSolutions.json', 'solutionId', flatten(collections, 'modelSpecificSolutions'));
  writeMerged('diagnosticQuestions.json', 'problemId', flatten(collections, 'diagnosticQuestions'));
  writeMerged('solutionStepGroups.json', 'stepGroupId', flatten(collections, 'solutionStepGroups'));
  writeMerged('solutionSteps.json', 'stepId', flatten(collections, 'solutionSteps'));
  writeMerged('procedures.json', 'procedureId', flatten(collections, 'procedures'));
  writeMerged('procedureSteps.json', 'procedureCode', flatten(collections, 'procedureSteps'));
  writeMerged('followUpQuestions.json', 'parentSolutionId', flatten(collections, 'followUpQuestions'));
  writeMerged('escalationRules.json', escalationKey, flatten(collections, 'escalationRules'));

  console.log(`Generated knowledge from ${approvedRows.length} approved support case(s).`);
  console.log(`Backup created at ${path.relative(projectRoot, backupDir)}`);
}

main();
