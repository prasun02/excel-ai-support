/* eslint-disable @typescript-eslint/no-require-imports */
const {
  backupSupportKnowledge,
  parseBoolean,
  parseList,
  readCsv,
  slugToId,
  validateRequired,
  writeJson,
} = require('./knowledge-utils');

const fileName = 'simple_support_input.csv';
const rows = readCsv('data/support-knowledge-import/simple_support_input.csv');
const errors = [];
const warnings = [];

function problemId(row) {
  return `${slugToId(row.category)}_${slugToId(row.problemName)}_COMMON`;
}

function solutionStepGroupId(row) {
  return `${problemId(row)}_${slugToId(row.solutionCode || 'DEFAULT')}`;
}

function procedureId(row) {
  return slugToId(row.procedureCode);
}

function isRiskyProcedure(row) {
  const text = `${row.procedureCode} ${row.procedureName} ${row.procedureSteps}`.toLowerCase();

  return /(firmware|reset|configuration|repair|rma|bios|flash|upgrade)/.test(text);
}

function parseFollowUpAnswers(value) {
  return String(value || '')
    .split('||')
    .map((item) => item.trim())
    .filter(Boolean);
}

const approvedRows = rows
  .map(({ row, rowNumber }) => {
    const rowErrors = validateRequired(
      row,
      ['category', 'problemName', 'symptomsKeywords', 'solutionCode', 'solutionSteps'],
      fileName,
      rowNumber
    );

    if (parseBoolean(row.approvedByExcel, false) && parseBoolean(row.active)) {
      errors.push(...rowErrors);
    }

    if (parseBoolean(row.approvedByExcel, false) && isRiskyProcedure(row) && !row.hardwareVersion.trim()) {
      warnings.push(`WARNING: ${fileName} row ${rowNumber} has risky procedure but hardwareVersion is empty`);
    }

    if (parseBoolean(row.approvedByExcel, false) && row.procedureSteps.trim() && !row.procedureCode.trim()) {
      warnings.push(`WARNING: ${fileName} row ${rowNumber} has procedureSteps but procedureCode is empty`);
    }

    return row;
  })
  .filter((row) => parseBoolean(row.approvedByExcel, false) && parseBoolean(row.active));

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else if (approvedRows.length === 0) {
  console.warn('WARNING: No approved active rows found in simple_support_input.csv. Existing support knowledge was not overwritten.');
} else {
  for (const warning of warnings) {
    console.warn(warning);
  }

  const backupDir = backupSupportKnowledge();
  const commonProblems = [];
  const diagnosticQuestions = [];
  const solutionStepGroupsById = new Map();
  const solutionSteps = [];
  const proceduresById = new Map();
  const procedureSteps = [];
  const followUpQuestions = [];
  const escalationRulesByKey = new Map();

  for (const row of approvedRows) {
    const currentProblemId = problemId(row);
    const groupId = solutionStepGroupId(row);
    const steps = parseList(row.solutionSteps);
    const procedureStepsList = parseList(row.procedureSteps);
    const followUps = parseList(row.followUpQuestions);
    const followUpAnswers = parseFollowUpAnswers(row.followUpAnswers);

    commonProblems.push({
      problemId: currentProblemId,
      category: row.category.trim(),
      modelFamily: row.modelFamily.trim() || 'General',
      problemName: row.problemName.trim(),
      symptoms: parseList(row.symptomsKeywords),
      possibleCauses: parseList(row.possibleCauses),
      customerExplanation: row.customerExplanation.trim(),
      solutionSteps: steps,
      nextIfNotSolved: row.escalationMessage.trim(),
      active: true,
    });

    diagnosticQuestions.push({
      problemId: currentProblemId,
      problemName: row.problemName.trim(),
      questionOrder: 1,
      questionText: 'I can guide you step by step. Do you want to start troubleshooting?',
      answerType: 'choice',
      answerOptions: ['Yes', 'No'],
      yesStepGroupCode: row.solutionCode.trim(),
      noStepGroupCode: '',
      active: true,
    });

    if (!solutionStepGroupsById.has(groupId)) {
      solutionStepGroupsById.set(groupId, {
        stepGroupId: groupId,
        problemId: currentProblemId,
        problemName: row.problemName.trim(),
        stepGroupCode: row.solutionCode.trim(),
        title: row.solutionCode.trim(),
        whenToUse: row.customerExplanation.trim(),
        askSolvedAfter: true,
        notSolvedNextGroupCode: '',
        active: true,
      });
    }

    steps.forEach((step, index) => {
      solutionSteps.push({
        stepId: `${groupId}_${String(index + 1).padStart(2, '0')}`,
        stepGroupId: groupId,
        problemId: currentProblemId,
        problemName: row.problemName.trim(),
        stepGroupCode: row.solutionCode.trim(),
        stepOrder: index + 1,
        customerStepText: step,
        expectedResult: '',
        procedureCode: row.procedureCode.trim(),
        imageUrl: row.imageUrl.trim(),
        videoUrl: row.videoUrl.trim(),
        active: true,
      });
    });

    if (row.procedureCode.trim()) {
      const currentProcedureId = procedureId(row);

      if (!proceduresById.has(currentProcedureId)) {
        proceduresById.set(currentProcedureId, {
          procedureId: currentProcedureId,
          procedureCode: row.procedureCode.trim(),
          procedureName: row.procedureName.trim(),
          category: row.category.trim(),
          brand: row.brand.trim(),
          model: row.model.trim(),
          hardwareVersion: row.hardwareVersion.trim(),
          procedureType: isRiskyProcedure(row) ? 'risky_manual_procedure' : 'manual_procedure',
          shortAnswer: row.customerExplanation.trim(),
          warning: isRiskyProcedure(row) ? 'Use only Excel-approved or official instructions. Escalate if unsure.' : '',
          imageUrl: row.imageUrl.trim(),
          videoUrl: row.videoUrl.trim(),
          active: true,
        });
      }

      procedureStepsList.forEach((step, index) => {
        procedureSteps.push({
          procedureId: currentProcedureId,
          procedureCode: row.procedureCode.trim(),
          stepOrder: index + 1,
          instruction: step,
          expectedResult: '',
          troubleshootingIfNotShowing: 'If this step is unclear, contact Excel support.',
          active: true,
        });
      });
    }

    followUps.forEach((question, index) => {
      followUpQuestions.push({
        parentSolutionId: row.procedureCode.trim() ? procedureId(row) : groupId,
        parentType: row.procedureCode.trim() ? 'procedure' : 'stepGroup',
        parentCode: row.procedureCode.trim() || row.solutionCode.trim(),
        questionKeywords: parseList(question),
        answer: followUpAnswers[index] || followUpAnswers[0] || '',
        procedureCode: row.procedureCode.trim(),
        maxRepeatBeforeEscalation: 2,
        language: 'en',
        active: true,
      });
    });

    const escalationKey = `${row.category.trim()}::not_solved`;
    if (!escalationRulesByKey.has(escalationKey)) {
      escalationRulesByKey.set(escalationKey, {
        category: row.category.trim(),
        condition: 'not_solved',
        escalationMessage: row.escalationMessage.trim() || 'I do not have an Excel-approved exact solution for this issue yet. I can forward this to human support.',
        askLocationFirst: true,
        active: true,
      });
    }
  }

  writeJson('data/support-knowledge/commonProblems.json', commonProblems);
  writeJson('data/support-knowledge/diagnosticQuestions.json', diagnosticQuestions);
  writeJson('data/support-knowledge/solutionStepGroups.json', Array.from(solutionStepGroupsById.values()));
  writeJson('data/support-knowledge/solutionGroups.json', Array.from(solutionStepGroupsById.values()));
  writeJson('data/support-knowledge/solutionSteps.json', solutionSteps);
  writeJson('data/support-knowledge/procedures.json', Array.from(proceduresById.values()));
  writeJson('data/support-knowledge/procedureSteps.json', procedureSteps);
  writeJson('data/support-knowledge/followUpQuestions.json', followUpQuestions);
  writeJson('data/support-knowledge/escalationRules.json', Array.from(escalationRulesByKey.values()));

  console.log(`Backup created: ${backupDir}`);
  console.log(`Approved simple support rows generated: ${approvedRows.length}`);
}
