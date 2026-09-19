import { HistoryRecord } from '../types';

function createPdfBlobFromRecord(record: HistoryRecord): Blob {
  const lines = [
    'REPÚBLICA FEDERATIVA DO BRASIL - NOTA FISCAL DE SERVIÇOS',
    `NÚMERO DA NOTA: ${record.invoiceNumber || 'S/N'}`,
    `DATA DE EMISSÃO: ${record.invoiceDate || 'N/A'}`,
    '------------------------------------------------------------',
    'DADOS DO CLIENTE / TOMADOR:',
    `Razao Social / Nome: ${record.clientName}`,
    `CNPJ / CPF: ${record.cnpj}`,
    '------------------------------------------------------------',
    'VALOR DA OPERACAO:',
    `Valor Total da Nota: ${record.invoiceValueFormatted || 'R$ 0,00'}`,
    '------------------------------------------------------------',
    'DETALHES DO PROCESSAMENTO:',
    `Arquivo Gerado: ${record.generatedFileName}`,
    `Caminho de Destino: ${record.targetPath}`,
    `Processado em: ${new Date(record.processedAt).toLocaleString('pt-BR')}`,
    '------------------------------------------------------------',
    'DOCUMENTO FISCAL GERADO / ORGANIZADO AUTOMATICAMENTE',
  ];

  const streamLines = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    '15 TL',
  ];

  for (const line of lines) {
    const escaped = line
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
    streamLines.push(`(${escaped}) '`);
  }
  streamLines.push('ET');

  const streamContent = streamLines.join('\n');
  const streamLength = streamContent.length;

  const pdfBody = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  return new Blob([pdfBody], { type: 'application/pdf' });
}

export function downloadInvoicePdf(record: HistoryRecord): void {
  const blob = createPdfBlobFromRecord(record);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = record.generatedFileName.endsWith('.pdf')
    ? record.generatedFileName
    : `${record.generatedFileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadInvoicesZip(records: HistoryRecord[], bundleName: string): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const record of records) {
    const blob = createPdfBlobFromRecord(record);
    const filename = record.generatedFileName.endsWith('.pdf')
      ? record.generatedFileName
      : `${record.generatedFileName}.pdf`;
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Notas_${bundleName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareInvoicePdfOrZip(
  records: HistoryRecord[],
  bundleName: string,
  messageText: string
): Promise<boolean> {
  if (records.length === 0) return false;

  let fileToShare: File;

  if (records.length === 1) {
    const record = records[0];
    const blob = createPdfBlobFromRecord(record);
    const filename = record.generatedFileName.endsWith('.pdf')
      ? record.generatedFileName
      : `${record.generatedFileName}.pdf`;
    fileToShare = new File([blob], filename, { type: 'application/pdf' });
  } else {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const record of records) {
      const blob = createPdfBlobFromRecord(record);
      const filename = record.generatedFileName.endsWith('.pdf')
        ? record.generatedFileName
        : `${record.generatedFileName}.pdf`;
      zip.file(filename, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipName = `Notas_${bundleName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    fileToShare = new File([zipBlob], zipName, { type: 'application/zip' });
  }

  if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
    try {
      await navigator.share({
        title: `Notas Fiscais - ${bundleName}`,
        text: messageText,
        files: [fileToShare],
      });
      return true;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share error:', err);
      }
      return false;
    }
  }

  return false;
}
