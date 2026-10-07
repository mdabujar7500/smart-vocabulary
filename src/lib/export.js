const STATUS_LABEL = { new: 'নতুন', learned: 'শেখা', learn_later: 'পরে শিখব' };

function toRows(items) {
  return items.map((r, i) => ({
    '#': i + 1,
    Word: r.words.word,
    'Part of Speech': r.words.part_of_speech || '',
    'বাংলা অর্থ': r.words.bangla_meaning || '',
    Definition: r.words.definition || '',
    Synonyms: (r.words.synonyms || []).join(', '),
    Antonyms: (r.words.antonyms || []).join(', '),
    Status: STATUS_LABEL[r.status] || r.status,
  }));
}

export async function downloadExcel(items, fileName) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(toRows(items));
  ws['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 55 },
    { wch: 32 },
    { wch: 32 },
    { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vocabulary');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function downloadPdf(items, title, fileName) {
  const w = window.open('', '_blank');
  if (!w) {
    throw new Error('পপ-আপ ব্লক হয়েছে। ঠিকানার পাশে পপ-আপ অনুমতি দিন এবং আবার চেষ্টা করুন।');
  }

  const rows = toRows(items)
    .map(
      (r) => `<tr>
        <td>${r['#']}</td>
        <td><b>${esc(r.Word)}</b><br><small>${esc(r['Part of Speech'])}</small></td>
        <td class="bn">${esc(r['বাংলা অর্থ'])}</td>
        <td>${esc(r.Definition)}</td>
        <td>${esc(r.Synonyms) || '-'}</td>
        <td>${esc(r.Antonyms) || '-'}</td>
        <td>${esc(r.Status)}</td>
      </tr>`
    )
    .join('');

  const date = new Date().toLocaleDateString('en-GB');

  w.document.write(`<!doctype html>
<html lang="bn"><head><meta charset="utf-8">
<title>${esc(fileName)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Nirmala UI", "Hind Siliguri", "Noto Sans Bengali", Arial, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; color: #4338ca; }
  p.meta { margin: 0 0 12px; color: #64748b; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #e0e7ff; text-align: left; padding: 6px 8px; border: 1px solid #c7d2fe; }
  td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  td.bn { color: #4338ca; font-weight: 600; }
  small { color: #64748b; font-style: italic; }
</style></head>
<body>
  <h1>Smart Vocabulary • ${esc(title)}</h1>
  <p class="meta">মোট শব্দ: ${items.length} &nbsp;|&nbsp; তারিখ: ${date}</p>
  <table>
    <thead><tr>
      <th>#</th><th>Word</th><th>বাংলা অর্থ</th><th>Definition</th><th>Synonyms</th><th>Antonyms</th><th>Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 600);
}