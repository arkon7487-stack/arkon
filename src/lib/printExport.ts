/**
 * Shared utilities for printing and CSV export.
 *
 * Printing uses a hidden iframe approach instead of window.open() to avoid
 * popup blockers. The iframe is created synchronously within the user gesture,
 * populated with HTML, and printed — no new window/tab needed.
 *
 * CSV export prepends a UTF-8 BOM so Microsoft Excel correctly decodes Arabic
 * and other non-ASCII text instead of showing mojibake.
 */

/**
 * Print arbitrary HTML content using a hidden iframe.
 *
 * Works within the current page — no popup window, no popup blocker risk.
 * The iframe is created synchronously in the user's click handler.
 */
export function printHtml(title: string, htmlBody: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif;
    background: #fff;
    color: #0f172a;
    padding: 40px;
    text-align: right;
  }
  @page { margin: 15mm; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`);
  doc.close();

  // Wait for images to load before printing
  const images = doc.images;
  let pending = images.length;

  const doPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Fallback — some browsers throw if printing too quickly
    }
    // Remove iframe after print dialog
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  };

  if (pending === 0) {
    doPrint();
  } else {
    let loaded = 0;
    const onImgDone = () => {
      loaded++;
      if (loaded >= pending) doPrint();
    };
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.complete) {
        onImgDone();
      } else {
        img.onload = onImgDone;
        img.onerror = onImgDone;
      }
    }
    // Safety timeout — don't block print forever if an image hangs
    setTimeout(() => { if (loaded < pending) doPrint(); }, 5000);
  }
}

/**
 * Escape HTML special characters to prevent injection in print HTML.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a single CSV cell value.
 * Wraps in quotes if it contains comma, quote, newline, or carriage return.
 * Doubles internal quotes per RFC 4180.
 */
function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV string from headers and rows.
 * Prepends a UTF-8 BOM (\uFEFF) so Microsoft Excel decodes Arabic correctly.
 */
export function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return '\uFEFF' + [headerLine, ...dataLines].join('\n');
}

/**
 * Download a Blob as a file with the given filename.
 * Uses URL.createObjectURL + a temporary anchor element.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay to ensure download started
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Download a CSV string as a .csv file with proper UTF-8 encoding.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}
