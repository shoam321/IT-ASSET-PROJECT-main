function csvEscape(value) {
  if (value === null || value === undefined) return '';

  let text;
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  // Normalize newlines for CSV
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Quote if needed
  if (/[\n",]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows, columns) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const normalizedColumns = (Array.isArray(columns) ? columns : []).map((col) => {
    if (typeof col === 'string') return { key: col, header: col };
    return {
      key: col?.key,
      header: col?.header ?? col?.key,
      format: col?.format,
    };
  }).filter((c) => c.key);

  const inferredKeys = safeRows.length > 0
    ? Object.keys(safeRows[0] || {})
    : [];

  const finalColumns = normalizedColumns.length > 0
    ? normalizedColumns
    : inferredKeys.map((k) => ({ key: k, header: k }));

  const headerLine = finalColumns.map((c) => csvEscape(c.header)).join(',');
  const lines = [headerLine];

  for (const row of safeRows) {
    const line = finalColumns.map((c) => {
      const raw = row?.[c.key];
      const value = typeof c.format === 'function' ? c.format(raw, row) : raw;
      return csvEscape(value);
    }).join(',');
    lines.push(line);
  }

  return lines.join('\n');
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Give the browser a moment to start the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
