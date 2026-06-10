import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function printViewportPdf() {
  const viewport = document.getElementById('print-viewport');
  if (!viewport) return;

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
  window.open(doc.output('bloburl'), '_blank');
}
