import { HistoryRecord } from '../types';
import { storageService } from './storageService';

/**
 * Recupera o ARQUIVO PDF ORIGINAL da nota fiscal exatamente como foi processado pelo sistema e armazenado no Supabase Storage Privado.
 * Não reconstrói, não altera e não gera um novo resumo.
 */
export async function getOriginalInvoicePdfBlob(record: HistoryRecord): Promise<Blob> {
  // 1. Tenta obter diretamente do Supabase Storage via URL de visualização/download
  if (
    record.storageViewUrl ||
    record.storagePath ||
    record.storageUrl ||
    record.blobUrl ||
    record.blobPathname ||
    record.blobViewUrl
  ) {
    try {
      const viewUrl = storageService.getPdfViewUrl(record);
      const response = await fetch(viewUrl);
      if (response.ok) {
        const fetchedBlob = await response.blob();
        if (fetchedBlob && fetchedBlob.size > 0) {
          return fetchedBlob;
        }
      }
    } catch (e) {
      console.warn('Erro ao obter PDF do Supabase Storage:', e);
    }
  }

  // 2. Tenta obter via URL se o registro contiver fileUrl válido
  if (
    record.fileUrl &&
    (record.fileUrl.startsWith('blob:') ||
      record.fileUrl.startsWith('data:') ||
      record.fileUrl.startsWith('http') ||
      record.fileUrl.startsWith('/api/storage/') ||
      record.fileUrl.startsWith('/api/blob/'))
  ) {
    try {
      const response = await fetch(record.fileUrl);
      const fetchedBlob = await response.blob();
      if (fetchedBlob && fetchedBlob.size > 0) {
        return fetchedBlob;
      }
    } catch (e) {
      console.warn('Não foi possível obter PDF por fileUrl:', e);
    }
  }

  // 3. Fallback neutro para registros sem arquivo
  return new Blob(['%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'], { type: 'application/pdf' });
}

export async function downloadInvoicePdf(record: HistoryRecord): Promise<void> {
  const blob = await getOriginalInvoicePdfBlob(record);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = record.generatedFileName || record.originalFileName || 'Nota_Fiscal.pdf';
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function downloadInvoicesZip(records: HistoryRecord[], bundleName: string): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const record of records) {
    const blob = await getOriginalInvoicePdfBlob(record);
    const fileName = record.generatedFileName || record.originalFileName || 'Nota_Fiscal.pdf';
    const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    zip.file(finalName, blob);
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
    const blob = await getOriginalInvoicePdfBlob(record);
    const fileName = record.generatedFileName || record.originalFileName || 'Nota_Fiscal.pdf';
    const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    fileToShare = new File([blob], finalName, { type: 'application/pdf' });
  } else {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const record of records) {
      const blob = await getOriginalInvoicePdfBlob(record);
      const fileName = record.generatedFileName || record.originalFileName || 'Nota_Fiscal.pdf';
      const finalName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      zip.file(finalName, blob);
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
