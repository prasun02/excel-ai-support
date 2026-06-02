'use client';

import { useState } from 'react';
import { parseSimpleSupportCsv } from '@/lib/simpleKnowledgeImport';

const KNOWLEDGE_KEY = 'simpleSupportKnowledge';

type PreviewRow = Record<string, string>;

export default function KnowledgeAdminPage() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState('');

  async function handleFile(file?: File) {
    if (!file) return;

    const text = await file.text();
    try {
      const parsedRows = parseSimpleSupportCsv(text);

      setRows(parsedRows);
      setMessage(`Preview ready: ${parsedRows.length} rows loaded.`);
    } catch (error) {
      setRows([]);
      setMessage(error instanceof Error ? error.message : 'Unable to parse CSV.');
    }
  }

  function importRows() {
    window.localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(rows));
    setMessage(`Import complete: ${rows.length} support knowledge rows saved to this browser.`);
  }

  function clearRows() {
    setRows([]);
    window.localStorage.removeItem(KNOWLEDGE_KEY);
    setMessage('Imported support knowledge cleared from this browser.');
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Support Knowledge Management</h1>
          <p className="text-sm text-slate-600">
            Upload the simple support CSV template, preview rows, and save imported knowledge to this browser for prototype testing.
          </p>
          <a className="mt-2 inline-block text-sm font-medium text-blue-600" href="/templates/simple_support_knowledge_template.csv">
            Download simple CSV template
          </a>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 rounded-lg border bg-white p-4">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <button onClick={importRows} disabled={rows.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-400">
            Import Preview
          </button>
          <button onClick={clearRows} className="rounded-lg border px-4 py-2 text-sm font-medium">
            Delete Imported Knowledge
          </button>
        </div>
        {message && <p className="mb-4 rounded-lg border bg-white p-3 text-sm text-slate-700">{message}</p>}

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {Object.keys(rows[0] || {}).map((header) => (
                  <th key={header} className="p-3 font-semibold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.category}-${row.problem}-${index}`} className="border-t">
                  {Object.keys(rows[0] || {}).map((header) => (
                    <td key={header} className="max-w-xs truncate p-3">{row[header]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-4 text-sm text-slate-500">No CSV preview loaded.</p>}
        </div>
      </div>
    </main>
  );
}
