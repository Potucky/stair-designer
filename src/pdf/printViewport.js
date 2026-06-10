import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function printViewportPdf() {
  const viewport = document.getElementById('print-viewport');
  if (!viewport) return;

  // Open blank window synchronously so popup blockers treat it as user-initiated.
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write('<p style="font-family:sans-serif;padding:2rem">Preparing print PDF…</p>');
  }

  try {
    const canvas = await html2canvas(viewport, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#edf2f7',
      logging: false,
      scale: window.devicePixelRatio || 1,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgW = canvas.width;
    const imgH = canvas.height;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();  // 792 pt
    const pageH = doc.internal.pageSize.getHeight(); // 612 pt
    const margin = 20;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;

    const ratio = Math.min(availW / imgW, availH / imgH);
    const fitW = imgW * ratio;
    const fitH = imgH * ratio;
    const x = margin + (availW - fitW) / 2;
    const y = margin + (availH - fitH) / 2;

    doc.addImage(imgData, 'PNG', x, y, fitW, fitH);
    const blobUrl = doc.output('bloburl');

    if (printWindow && !printWindow.closed) {
      printWindow.location.href = blobUrl;
    } else {
      // Blank window was blocked or closed; try opening with the final URL.
      if (!window.open(blobUrl, '_blank')) {
        doc.save('stair-designer-3d-view.pdf');
      }
    }
  } catch (err) {
    if (printWindow && !printWindow.closed) {
      printWindow.document.body.innerHTML =
        '<p style="font-family:sans-serif;color:red;padding:2rem">Print failed: ' +
        String(err.message || err) + '</p>';
    }
    throw err;
  }
}
