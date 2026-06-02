import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type CsvRow = Record<string, string>;

type ProductRow = CsvRow & {
  category: string;
  brand: string;
  model: string;
  hardwareVersion: string;
  firmwareVersion: string;
  modelFamily: string;
  deviceType: string;
  active: string;
};

type ProblemRow = CsvRow & {
  category: string;
  modelFamily: string;
  problemName: string;
  symptomsKeywords: string;
  defaultFirstStepGroupCode: string;
  active: string;
};

type DiagnosticQuestionRow = CsvRow & {
  problemName: string;
  questionOrder: string;
  questionText: string;
  answerType: string;
  answerOptions: string;
  yesNextQuestionOrder: string;
  noNextQuestionOrder: string;
  yesStepGroupCode: string;
  noStepGroupCode: string;
  notSureStepGroupCode: string;
  active: string;
};

type SolutionGroupRow = CsvRow & {
  problemName: string;
  stepGroupCode: string;
  title: string;
  whenToUse: string;
  askSolvedAfter: string;
  notSolvedNextGroupCode: string;
  active: string;
};

type SolutionStepRow = CsvRow & {
  problemName: string;
  stepGroupCode: string;
  stepOrder: string;
  customerStepText: string;
  expectedResult: string;
  procedureCode: string;
  imageUrl: string;
  videoUrl: string;
  active: string;
};

type ProcedureRow = CsvRow & {
  procedureCode: string;
  procedureName: string;
  category: string;
  brand: string;
  model: string;
  hardwareVersion: string;
  procedureType: string;
  shortAnswer: string;
  warning: string;
  imageUrl: string;
  videoUrl: string;
  active: string;
};

type ProcedureStepRow = CsvRow & {
  procedureCode: string;
  stepOrder: string;
  instruction: string;
  expectedResult: string;
  troubleshootingIfNotShowing: string;
  active: string;
};

type FollowUpQuestionRow = CsvRow & {
  parentType: string;
  parentCode: string;
  questionKeywords: string;
  answer: string;
  procedureCode: string;
  maxRepeatBeforeEscalation: string;
  language: string;
  active: string;
};

type EscalationRuleRow = CsvRow & {
  category: string;
  condition: string;
  escalationMessage: string;
  askLocationFirst: string;
  active: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const inputDir = path.join(projectRoot, 'data', 'support-knowledge-import');
const outputDir = path.join(projectRoot, 'data', 'support-knowledge');
const backupRoot = path.join(projectRoot, 'data', 'support-knowledge-backups');

const inputFiles = {
  products: 'products_input.csv',
  problems: 'problems_input.csv',
  diagnosticQuestions: 'diagnostic_questions_input.csv',
  solutionGroups: 'solution_groups_input.csv',
  solutionSteps: 'solution_steps_input.csv',
  procedures: 'procedures_input.csv',
  procedureSteps: 'procedure_steps_input.csv',
  followUpQuestions: 'follow_up_questions_input.csv',
  escalationRules: 'escalation_rules_input.csv',
};

export function slugToId(text: string) {
  return text
    .normalize('NFKD')
    .toUpperCase()
    .replace(/[\s\-/.]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function generateProductId(row: ProductRow) {
  return slugToId([row.brand, row.model, row.hardwareVersion].filter(Boolean).join(' '));
}

export function generateProblemId(row: Pick<ProblemRow, 'category' | 'problemName'>) {
  return `${slugToId(row.category)}_${slugToId(row.problemName)}_COMMON`;
}

export function generateStepGroupId(problemId: string, stepGroupCode: string) {
  return `${problemId}_${slugToId(stepGroupCode)}`;
}

export function generateProcedureId(procedureCode: string) {
  return slugToId(procedureCode);
}

function generateSolutionId(product: ProductRow, problemName: string, index: number) {
  const base = slugToId([product.model, product.hardwareVersion, problemName].filter(Boolean).join(' '));

  return `${base}_${String(index).padStart(3, '0')}`;
}

export function parseBoolean(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) return true;
  return ['true', 'yes', 'y', '1', 'active'].includes(normalized);
}

export function parseList(value: string) {
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function validateRequired(
  row: CsvRow,
  fields: string[],
  fileName: string,
  rowNumber: number
) {
  const missingFields = fields.filter((field) => !row[field]?.trim());

  return missingFields.map((field) => `ERROR: ${fileName} row ${rowNumber} missing ${field}`);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
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

async function readCsv(fileName: string) {
  const filePath = path.join(inputDir, fileName);
  const text = await readFile(filePath, 'utf8');
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines
    .filter((line) => line.trim())
    .map((line, index) => {
      const values = parseCsvLine(line);
      const row = headers.reduce<CsvRow>((record, header, valueIndex) => {
        record[header] = values[valueIndex] || '';
        return record;
      }, {});

      return { row, rowNumber: index + 2 };
    });
}

async function backupExistingJson() {
  const timestamp = new Date()
    .toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '-')
    .replace(/\..+$/, '');
  const backupDir = path.join(backupRoot, timestamp);

  await mkdir(backupDir, { recursive: true });

  const files = await readdir(outputDir).catch(() => []);
  const jsonFiles = files.filter((file) => file.endsWith('.json'));

  for (const file of jsonFiles) {
    await copyFile(path.join(outputDir, file), path.join(backupDir, file));
  }

  return backupDir;
}

async function writeJson(fileName: string, data: unknown) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, fileName),
    `${JSON.stringify(data, null, 2)}\n`,
    'utf8'
  );
}

function problemKey(problemName: string) {
  return slugToId(problemName);
}

function buildGeneratedKnowledge(data: {
  products: ProductRow[];
  problems: ProblemRow[];
  diagnosticQuestions: DiagnosticQuestionRow[];
  solutionGroups: SolutionGroupRow[];
  solutionSteps: SolutionStepRow[];
  procedures: ProcedureRow[];
  procedureSteps: ProcedureStepRow[];
  followUpQuestions: FollowUpQuestionRow[];
  escalationRules: EscalationRuleRow[];
}) {
  const problemIdByName = new Map<string, string>();
  const procedureIdByCode = new Map<string, string>();

  const products = data.products.map((row) => ({
    productId: generateProductId(row),
    category: row.category.trim(),
    brand: row.brand.trim(),
    model: row.model.trim(),
    hardwareVersion: row.hardwareVersion.trim(),
    firmwareVersion: row.firmwareVersion.trim(),
    modelFamily: row.modelFamily.trim(),
    deviceType: row.deviceType.trim(),
    active: parseBoolean(row.active),
  }));

  const commonProblems = data.problems.map((row) => {
    const problemId = generateProblemId(row);
    problemIdByName.set(problemKey(row.problemName), problemId);

    const defaultSteps = data.solutionSteps
      .filter(
        (step) =>
          problemKey(step.problemName) === problemKey(row.problemName) &&
          slugToId(step.stepGroupCode) === slugToId(row.defaultFirstStepGroupCode) &&
          parseBoolean(step.active)
      )
      .sort((left, right) => Number(left.stepOrder || 0) - Number(right.stepOrder || 0))
      .map((step) => step.customerStepText.trim());

    return {
      problemId,
      category: row.category.trim(),
      modelFamily: row.modelFamily.trim() || 'General',
      problemName: row.problemName.trim(),
      symptoms: parseList(row.symptomsKeywords),
      solutionSteps: defaultSteps,
      nextIfNotSolved: 'Please check the steps above and tell me if the issue is solved.',
      defaultFirstStepGroupCode: row.defaultFirstStepGroupCode.trim(),
      active: parseBoolean(row.active),
    };
  });

  const diagnosticQuestions = data.diagnosticQuestions.map((row) => ({
    problemId: problemIdByName.get(problemKey(row.problemName)) || '',
    problemName: row.problemName.trim(),
    questionOrder: Number(row.questionOrder || 0),
    questionText: row.questionText.trim(),
    answerType: row.answerType.trim(),
    answerOptions: parseList(row.answerOptions),
    yesNextQuestionOrder: row.yesNextQuestionOrder.trim(),
    noNextQuestionOrder: row.noNextQuestionOrder.trim(),
    yesStepGroupCode: row.yesStepGroupCode.trim(),
    noStepGroupCode: row.noStepGroupCode.trim(),
    notSureStepGroupCode: row.notSureStepGroupCode.trim(),
    active: parseBoolean(row.active),
  }));

  const solutionGroups = data.solutionGroups.map((row) => {
    const problemId = problemIdByName.get(problemKey(row.problemName)) || '';

    return {
      stepGroupId: generateStepGroupId(problemId, row.stepGroupCode),
      problemId,
      problemName: row.problemName.trim(),
      stepGroupCode: row.stepGroupCode.trim(),
      title: row.title.trim(),
      whenToUse: row.whenToUse.trim(),
      askSolvedAfter: parseBoolean(row.askSolvedAfter),
      notSolvedNextGroupCode: row.notSolvedNextGroupCode.trim(),
      active: parseBoolean(row.active),
    };
  });

  const solutionSteps = data.solutionSteps.map((row) => {
    const problemId = problemIdByName.get(problemKey(row.problemName)) || '';

    return {
      stepId: `${generateStepGroupId(problemId, row.stepGroupCode)}_${String(Number(row.stepOrder || 0)).padStart(2, '0')}`,
      stepGroupId: generateStepGroupId(problemId, row.stepGroupCode),
      problemId,
      problemName: row.problemName.trim(),
      stepGroupCode: row.stepGroupCode.trim(),
      stepOrder: Number(row.stepOrder || 0),
      customerStepText: row.customerStepText.trim(),
      expectedResult: row.expectedResult.trim(),
      procedureCode: row.procedureCode.trim(),
      imageUrl: row.imageUrl.trim(),
      videoUrl: row.videoUrl.trim(),
      active: parseBoolean(row.active),
    };
  });

  const procedures = data.procedures.map((row) => {
    const procedureId = generateProcedureId(row.procedureCode);
    procedureIdByCode.set(slugToId(row.procedureCode), procedureId);

    return {
      procedureId,
      procedureCode: row.procedureCode.trim(),
      procedureName: row.procedureName.trim(),
      category: row.category.trim(),
      brand: row.brand.trim(),
      model: row.model.trim(),
      hardwareVersion: row.hardwareVersion.trim(),
      procedureType: row.procedureType.trim(),
      shortAnswer: row.shortAnswer.trim(),
      warning: row.warning.trim(),
      imageUrl: row.imageUrl.trim(),
      videoUrl: row.videoUrl.trim(),
      active: parseBoolean(row.active),
    };
  });

  const procedureSteps = data.procedureSteps.map((row) => ({
    procedureId: procedureIdByCode.get(slugToId(row.procedureCode)) || generateProcedureId(row.procedureCode),
    procedureCode: row.procedureCode.trim(),
    stepOrder: Number(row.stepOrder || 0),
    instruction: row.instruction.trim(),
    expectedResult: row.expectedResult.trim(),
    troubleshootingIfNotShowing: row.troubleshootingIfNotShowing.trim(),
    active: parseBoolean(row.active),
  }));

  const followUpQuestions = data.followUpQuestions.map((row) => {
    const parentCode = row.parentCode.trim();
    const parentType = row.parentType.trim();
    const parentSolutionId =
      parentType === 'problem'
        ? problemIdByName.get(problemKey(parentCode)) || parentCode
        : parentType === 'procedure'
          ? procedureIdByCode.get(slugToId(parentCode)) || generateProcedureId(parentCode)
          : parentCode;

    return {
      parentSolutionId,
      parentType,
      parentCode,
      questionKeywords: parseList(row.questionKeywords),
      answer: row.answer.trim(),
      procedureCode: row.procedureCode.trim(),
      maxRepeatBeforeEscalation: Number(row.maxRepeatBeforeEscalation || 0),
      language: row.language.trim() || 'en',
      active: parseBoolean(row.active),
    };
  });

  const escalationRules = data.escalationRules.map((row) => ({
    category: row.category.trim(),
    condition: row.condition.trim(),
    escalationMessage: row.escalationMessage.trim(),
    askLocationFirst: parseBoolean(row.askLocationFirst),
    active: parseBoolean(row.active),
  }));

  const modelSpecificSolutions = data.solutionSteps
    .filter((step) => step.procedureCode.trim() && parseBoolean(step.active))
    .flatMap((step) => {
      const procedure = data.procedures.find(
        (item) => slugToId(item.procedureCode) === slugToId(step.procedureCode)
      );
      const problem = data.problems.find(
        (item) => problemKey(item.problemName) === problemKey(step.problemName)
      );
      const product = data.products.find(
        (item) =>
          procedure &&
          slugToId(item.brand) === slugToId(procedure.brand) &&
          slugToId(item.model) === slugToId(procedure.model) &&
          slugToId(item.hardwareVersion) === slugToId(procedure.hardwareVersion)
      );

      if (!procedure || !problem || !product) return [];

      return [{
        solutionId: generateSolutionId(product, problem.problemName, 1),
        productId: generateProductId(product),
        model: product.model.trim(),
        problemName: problem.problemName.trim(),
        symptoms: parseList(problem.symptomsKeywords),
        solutionSteps: [step.customerStepText.trim(), procedure.shortAnswer.trim()].filter(Boolean),
        nextIfNotSolved: 'If the issue is still not solved, I can forward this to human support.',
        imageUrl: procedure.imageUrl.trim() || step.imageUrl.trim(),
        videoUrl: procedure.videoUrl.trim() || step.videoUrl.trim(),
        active: parseBoolean(step.active) && parseBoolean(procedure.active),
      }];
    });

  return {
    products,
    commonProblems,
    modelSpecificSolutions,
    followUpQuestions,
    escalationRules,
    diagnosticQuestions,
    solutionGroups,
    solutionSteps,
    procedures,
    procedureSteps,
  };
}

async function loadRows<T extends CsvRow>(fileName: string, requiredFields: string[]) {
  const rows = await readCsv(fileName);
  const errors: string[] = [];

  const typedRows = rows.map(({ row, rowNumber }) => {
    errors.push(...validateRequired(row, requiredFields, fileName, rowNumber));
    return row as T;
  });

  return { rows: typedRows, errors };
}

function validateCrossFileRules(data: {
  products: ProductRow[];
  problems: ProblemRow[];
  procedures: ProcedureRow[];
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const problemNames = new Set(data.problems.map((row) => problemKey(row.problemName)));

  for (const problem of data.problems) {
    if (!problemNames.has(problemKey(problem.problemName))) {
      errors.push(`ERROR: problem ${problem.problemName} could not be indexed`);
    }
  }

  for (const procedure of data.procedures) {
    if (slugToId(procedure.procedureType) === 'FIRMWARE_UPDATE') {
      if (!procedure.model.trim()) {
        errors.push(`ERROR: procedure ${procedure.procedureCode} has firmware_update type but model is empty`);
      }
      if (!procedure.hardwareVersion.trim()) {
        errors.push(`ERROR: procedure ${procedure.procedureCode} has firmware_update type but hardwareVersion is empty`);
      }
      if (!procedure.warning.trim()) {
        errors.push(`ERROR: procedure ${procedure.procedureCode} has firmware_update type but warning is empty`);
      }
      if (!procedure.videoUrl.trim()) {
        warnings.push(`WARNING: videoUrl empty for firmware procedure ${procedure.procedureCode}`);
      }
    }
  }

  return { errors, warnings };
}

async function main() {
  const products = await loadRows<ProductRow>(inputFiles.products, ['category', 'brand', 'model', 'modelFamily', 'deviceType']);
  const problems = await loadRows<ProblemRow>(inputFiles.problems, ['category', 'problemName', 'symptomsKeywords']);
  const diagnosticQuestions = await loadRows<DiagnosticQuestionRow>(inputFiles.diagnosticQuestions, ['problemName', 'questionOrder', 'questionText']);
  const solutionGroups = await loadRows<SolutionGroupRow>(inputFiles.solutionGroups, ['problemName', 'stepGroupCode', 'title']);
  const solutionSteps = await loadRows<SolutionStepRow>(inputFiles.solutionSteps, ['problemName', 'stepGroupCode', 'stepOrder', 'customerStepText']);
  const procedures = await loadRows<ProcedureRow>(inputFiles.procedures, ['procedureCode', 'procedureName', 'category', 'procedureType']);
  const procedureSteps = await loadRows<ProcedureStepRow>(inputFiles.procedureSteps, ['procedureCode', 'stepOrder', 'instruction']);
  const followUpQuestions = await loadRows<FollowUpQuestionRow>(inputFiles.followUpQuestions, ['parentType', 'parentCode', 'questionKeywords', 'answer']);
  const escalationRules = await loadRows<EscalationRuleRow>(inputFiles.escalationRules, ['category', 'condition', 'escalationMessage']);

  const allErrors = [
    ...products.errors,
    ...problems.errors,
    ...diagnosticQuestions.errors,
    ...solutionGroups.errors,
    ...solutionSteps.errors,
    ...procedures.errors,
    ...procedureSteps.errors,
    ...followUpQuestions.errors,
    ...escalationRules.errors,
  ];
  const crossFile = validateCrossFileRules({
    products: products.rows,
    problems: problems.rows,
    procedures: procedures.rows,
  });

  allErrors.push(...crossFile.errors);

  if (allErrors.length > 0) {
    console.error(allErrors.join('\n'));
    process.exitCode = 1;
    return;
  }

  for (const warning of crossFile.warnings) {
    console.warn(warning);
  }

  const backupDir = await backupExistingJson();
  const generated = buildGeneratedKnowledge({
    products: products.rows,
    problems: problems.rows,
    diagnosticQuestions: diagnosticQuestions.rows,
    solutionGroups: solutionGroups.rows,
    solutionSteps: solutionSteps.rows,
    procedures: procedures.rows,
    procedureSteps: procedureSteps.rows,
    followUpQuestions: followUpQuestions.rows,
    escalationRules: escalationRules.rows,
  });

  await writeJson('products.json', generated.products);
  await writeJson('commonProblems.json', generated.commonProblems);
  await writeJson('modelSpecificSolutions.json', generated.modelSpecificSolutions);
  await writeJson('followUpQuestions.json', generated.followUpQuestions);
  await writeJson('escalationRules.json', generated.escalationRules);
  await writeJson('diagnosticQuestions.json', generated.diagnosticQuestions);
  await writeJson('solutionGroups.json', generated.solutionGroups);
  await writeJson('solutionSteps.json', generated.solutionSteps);
  await writeJson('procedures.json', generated.procedures);
  await writeJson('procedureSteps.json', generated.procedureSteps);

  console.log(`Backup created: ${backupDir}`);
  console.log('Knowledge JSON generated successfully.');
  console.log(`Products: ${generated.products.length}`);
  console.log(`Common problems: ${generated.commonProblems.length}`);
  console.log(`Model-specific solutions: ${generated.modelSpecificSolutions.length}`);
  console.log(`Follow-up questions: ${generated.followUpQuestions.length}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
