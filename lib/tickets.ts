import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type TicketPriority = 'normal' | 'urgent';

export type SupportTicket = {
  id: string;
  subject: string;
  description: string;
  category: string;
  requesterName: string;
  requesterContact: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: 'chat' | 'manual';
  createdAt: string;
  updatedAt: string;
};

export type CreateTicketInput = {
  subject: string;
  description: string;
  category: string;
  requesterName?: string;
  requesterContact?: string;
  source?: 'chat' | 'manual';
};

const ticketsFilePath = path.join(process.cwd(), 'data', 'tickets.json');
let memoryTickets: SupportTicket[] = [];

async function readTicketFile() {
  try {
    const file = await readFile(ticketsFilePath, 'utf8');
    return JSON.parse(file) as SupportTicket[];
  } catch {
    // Vercel serverless functions may not allow durable writes to project files.
    return memoryTickets;
  }
}

export async function readTickets() {
  const tickets = await readTicketFile();

  return tickets.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createTicket(input: CreateTicketInput) {
  const tickets = await readTickets();
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
  const sequence = String(tickets.length + 1).padStart(4, '0');

  const ticket: SupportTicket = {
    id: `EXL-${datePart}-${sequence}`,
    subject: input.subject,
    description: input.description,
    category: input.category,
    requesterName: input.requesterName?.trim() || 'Customer',
    requesterContact: input.requesterContact?.trim() || 'Not provided',
    status: 'open',
    priority: 'normal',
    source: input.source || 'chat',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  memoryTickets = [ticket, ...tickets];

  try {
    await writeFile(
      ticketsFilePath,
      `${JSON.stringify(memoryTickets, null, 2)}\n`,
      'utf8'
    );
  } catch {
    // Keep the demo route working on Vercel even when file writes are not durable.
  }

  return ticket;
}
