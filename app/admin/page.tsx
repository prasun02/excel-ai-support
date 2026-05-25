'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LocalSupportTicket, LocalTicketStatus } from '@/types/support';

const TICKETS_KEY = 'supportTickets';

const statuses: LocalTicketStatus[] = ['Open', 'In Progress', 'Solved', 'Escalated', 'AI_HANDLED'];

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell || '').replaceAll('"', '""')}"`)
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [tickets, setTickets] = useState<LocalSupportTicket[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTickets = window.localStorage.getItem(TICKETS_KEY);

      setTickets(savedTickets ? JSON.parse(savedTickets) : []);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function saveTickets(nextTickets: LocalSupportTicket[]) {
    setTickets(nextTickets);
    window.localStorage.setItem(TICKETS_KEY, JSON.stringify(nextTickets));
  }

  function updateTicket(ticketId: string, updates: Partial<LocalSupportTicket>) {
    saveTickets(
      tickets.map((ticket) =>
        ticket.ticketId === ticketId
          ? { ...ticket, ...updates, updatedAt: new Date().toISOString() }
          : ticket
      )
    );
  }

  function deleteTicket(ticketId: string) {
    saveTickets(tickets.filter((ticket) => ticket.ticketId !== ticketId));
  }

  function exportTickets() {
    downloadCsv('excel-service-ai-tickets.csv', [
      ['ticketId', 'customerName', 'phone', 'location', 'category', 'issueType', 'productModel', 'serialNumber', 'status', 'createdAt', 'updatedAt'],
      ...tickets.map((ticket) => [
        ticket.ticketId,
        ticket.customerName,
        ticket.customerContact,
        '',
        ticket.selectedCategory || ticket.category,
        ticket.issueType,
        ticket.productModel,
        ticket.serialNumber,
        ticket.status,
        ticket.createdAt,
        ticket.updatedAt,
      ]),
    ]);
  }

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === 'Open' || ticket.status === 'AI_HANDLED').length;
    const solved = tickets.filter((ticket) => ticket.status === 'Solved').length;
    const escalated = tickets.filter((ticket) => ticket.status === 'Escalated').length;
    const categoryCounts = tickets.reduce<Record<string, number>>((counts, ticket) => {
      const category = ticket.selectedCategory || ticket.category || 'General';

      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});

    return { open, solved, escalated, categoryCounts };
  }, [tickets]);

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Excel Service AI Admin</h1>
            <p className="text-sm text-slate-600">Internal Smart Support Prototype</p>
          </div>
          <button onClick={exportTickets} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Export CSV
          </button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Total Tickets</p><p className="text-2xl font-semibold">{tickets.length}</p></div>
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Open Tickets</p><p className="text-2xl font-semibold">{stats.open}</p></div>
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Solved Tickets</p><p className="text-2xl font-semibold">{stats.solved}</p></div>
          <div className="rounded-lg border bg-white p-4"><p className="text-sm text-slate-500">Escalated Tickets</p><p className="text-2xl font-semibold">{stats.escalated}</p></div>
        </div>

        <div className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Category-wise Issue Count</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {Object.entries(stats.categoryCounts).map(([category, count]) => (
              <div key={category} className="rounded-lg border bg-slate-50 p-3 text-sm">
                <span className="font-medium">{category}</span>: {count}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">Ticket</th>
                <th className="p-3">Model/SN</th>
                <th className="p-3">Category</th>
                <th className="p-3">Issue</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assigned Person</th>
                <th className="p-3">Internal Remarks</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.ticketId} className="border-t align-top">
                  <td className="p-3 font-medium">{ticket.ticketId}</td>
                  <td className="p-3">
                    <div>{ticket.productModel || 'No model'}</div>
                    <div className="text-xs text-slate-500">{ticket.serialNumber || 'No SN'}</div>
                  </td>
                  <td className="p-3">{ticket.selectedCategory || ticket.category}</td>
                  <td className="p-3">{ticket.issueType || ticket.issue || 'Support conversation'}</td>
                  <td className="p-3">
                    <select
                      value={ticket.status}
                      onChange={(event) => updateTicket(ticket.ticketId, { status: event.target.value as LocalTicketStatus })}
                      className="rounded-md border px-2 py-1"
                    >
                      {statuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      value={ticket.assignedPerson || ''}
                      onChange={(event) => updateTicket(ticket.ticketId, { assignedPerson: event.target.value })}
                      className="w-40 rounded-md border px-2 py-1"
                      placeholder="Assign"
                    />
                  </td>
                  <td className="p-3">
                    <textarea
                      value={ticket.internalRemarks || ''}
                      onChange={(event) => updateTicket(ticket.ticketId, { internalRemarks: event.target.value })}
                      className="h-16 w-56 rounded-md border px-2 py-1"
                      placeholder="Internal remarks"
                    />
                  </td>
                  <td className="p-3">
                    <button onClick={() => deleteTicket(ticket.ticketId)} className="rounded-md border border-red-200 px-3 py-1 text-red-600">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
