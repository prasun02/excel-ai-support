import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type QuestionLog = {
  id: string;
  ticketId: string;
  category: string;
  question: string;
  language: 'en' | 'bn';
  understood: boolean;
  createdAt: string;
};

export type CreateQuestionLogInput = {
  ticketId?: string;
  category?: string;
  question: string;
  language: 'en' | 'bn';
  understood: boolean;
};

const questionsFilePath = path.join(process.cwd(), 'data', 'questions.json');
let memoryQuestionLogs: QuestionLog[] = [];

async function readQuestionFile() {
  try {
    const file = await readFile(questionsFilePath, 'utf8');
    return JSON.parse(file) as QuestionLog[];
  } catch {
    // Vercel serverless functions may not allow durable writes to project files.
    return memoryQuestionLogs;
  }
}

export async function readQuestionLogs() {
  const logs = await readQuestionFile();

  return logs.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createQuestionLog(input: CreateQuestionLogInput) {
  const logs = await readQuestionLogs();
  const now = new Date().toISOString();
  const log: QuestionLog = {
    id: `Q-${Date.now()}`,
    ticketId: input.ticketId || 'NO-TICKET',
    category: input.category || 'General Support',
    question: input.question,
    language: input.language,
    understood: input.understood,
    createdAt: now,
  };

  memoryQuestionLogs = [log, ...logs];

  try {
    await writeFile(
      questionsFilePath,
      `${JSON.stringify(memoryQuestionLogs, null, 2)}\n`,
      'utf8'
    );
  } catch {
    // Keep the demo working on Vercel even when file writes are not durable.
  }

  return log;
}
