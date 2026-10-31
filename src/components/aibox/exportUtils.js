
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

function safeFilename(name = 'kervyn-export') {
  return String(name)
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'kervyn-export';
}

export async function downloadElementAsPng(element, filename) {
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#17191b',
    useCORS: true,
    logging: false,
    ignoreElements: (node) =>
      node.classList?.contains('ai-export-actions'),
  });

  const link = document.createElement('a');
  link.download = `${safeFilename(filename)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}


export function downloadCsv(columns, rows, filename = 'kervyn-export') {
  if (!Array.isArray(columns) || columns.length === 0) {
    console.error('CSV export failed: no columns provided.');
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('CSV export failed: no rows provided.');
    return;
  }

  const escapeCell = (value) => {
    let text = String(value ?? '');

    // Prevent spreadsheet formula injection for untrusted text.
    if (/^[\s]*[=+\-@]/.test(text)) {
      text = `'${text}`;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = columns.map(escapeCell).join(',');

  const body = rows.map((row) => {
    const values = Array.isArray(row)
      ? columns.map((_, index) => row[index] ?? '')
      : columns.map((column) => {
          if (!row || typeof row !== 'object') return '';

          const key = Object.keys(row).find(
            (candidate) =>
              candidate.trim().toLowerCase() ===
              String(column).trim().toLowerCase()
          );

          return key !== undefined ? row[key] ?? '' : '';
        });

    return values.map(escapeCell).join(',');
  });

  const csv = '\uFEFF' + [header, ...body].join('\r\n');
  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const safeName = String(filename)
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'kervyn-export';

  link.href = url;
  link.download = `${safeName}.csv`;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}


export async function downloadConversationPdf(element) {
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 1.5,
    backgroundColor: '#111111',
    useCORS: true,
    logging: false,
    windowWidth: Math.max(element.scrollWidth, element.clientWidth),
    ignoreElements: (node) =>
      node.classList?.contains('ai-export-actions') ||
      node.classList?.contains('ai-chat-composer'),
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;

  // Convert each PDF page's height into source-canvas pixels.
  const pageSliceHeight = Math.floor(
    (printableHeight / printableWidth) * canvas.width
  );

  let sourceY = 0;
  let pageNumber = 0;

  while (sourceY < canvas.height) {
    const sliceHeight = Math.min(
      pageSliceHeight,
      canvas.height - sourceY
    );

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const context = pageCanvas.getContext('2d');

    if (!context) {
      throw new Error('Could not prepare the PDF page.');
    }

    context.drawImage(
      canvas,
      0, sourceY, canvas.width, sliceHeight,
      0, 0, canvas.width, sliceHeight
    );

    const imageData = pageCanvas.toDataURL('image/jpeg', 0.92);

    if (pageNumber > 0) pdf.addPage();

    const renderedHeight = (sliceHeight / canvas.width) * printableWidth;

    pdf.addImage(
      imageData,
      'JPEG',
      margin,
      margin,
      printableWidth,
      renderedHeight,
      undefined,
      'FAST'
    );

    sourceY += sliceHeight;
    pageNumber += 1;
  }

  pdf.save('Kervyn-AI-Conversation.pdf');
}
