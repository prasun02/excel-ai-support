'use client';

import { useState } from 'react';

const KNOWLEDGE_KEY = 'modelWiseSupportKnowledge';

type PreviewRow = Record<string, string>;

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
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

function parseCsv(csv: string) {
  const [headerLine, ...rows] = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return rows
    .filter(Boolean)
    .map((row) => {
      const values = parseCsvLine(row);

      return headers.reduce<PreviewRow>((record, header, index) => {
        record[header] = values[index] || '';
        return record;
      }, {});
    });
}

export default function KnowledgeAdminPage() {
  const [rows, setRows] = useState<PreviewRow[]>([]);

  async function handleFile(file?: File) {
    if (!file) return;

    const text = await file.text();
    setRows(parseCsv(text));
  }

  function importRows() {
    window.localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(rows));
  }

  function clearRows() {
    setRows([]);
    window.localStorage.removeItem(KNOWLEDGE_KEY);
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Support Knowledge Management</h1>
          <p className="text-sm text-slate-600">
            Upload the model-wise CSV template, preview rows, and save imported knowledge to this browser for prototype testing.
          </p>
          <a className="mt-2 inline-block text-sm font-medium text-blue-600" href="/templates/model_wise_support_knowledge_template.csv">
            Download model-wise CSV template
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
                <tr key={`${row.category}-${row.issueType}-${index}`} className="border-t">
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
