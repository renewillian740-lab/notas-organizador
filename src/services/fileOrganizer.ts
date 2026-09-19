import { ExtractedInvoiceData, AppSettings } from '../types';

/**
 * Remove caracteres inválidos para nomes de arquivos e pastas no Windows, macOS e Linux.
 */
export function sanitizeFileSystemName(name: string): string {
  if (!name) return 'INDEFINIDO';

  let sanitized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos para compatibilidade máxima
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // caracteres proibidos
    .replace(/\s+/g, '_') // substitui múltiplos espaços por underscore
    .replace(/_{2,}/g, '_') // remove underscores duplicados
    .trim();

  // Limita tamanho
  if (sanitized.length > 80) {
    sanitized = sanitized.substring(0, 80);
  }

  return sanitized.replace(/^_+|_+$/g, '') || 'INDEFINIDO';
}

/**
 * Gera o nome de arquivo padronizado:
 * NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf
 */
export function generateInvoiceFileName(
  data: ExtractedInvoiceData,
  clientOverrideName?: string
): string {
  const numero = sanitizeFileSystemName(data.numeroNota || 'S_N');
  
  const rawClientName = clientOverrideName || data.selectedClient?.name || 'CLIENTE_NAO_IDENTIFICADO';
  const cliente = sanitizeFileSystemName(rawClientName);
  
  const valorStr = data.valorTotal !== null && data.valorTotal !== undefined
    ? `R$${data.valorTotal.toFixed(2).replace('.', ',')}`
    : 'R$0,00';
  const valor = sanitizeFileSystemName(valorStr);
  
  // Data formatada para nome de arquivo: DD-MM-AAAA
  const dataFormatada = (data.dataEmissao || '01-01-2026').replace(/\//g, '-');
  const dataClean = sanitizeFileSystemName(dataFormatada);

  return `NF_${numero}_${cliente}_${valor}_${dataClean}.pdf`;
}

/**
 * Gera a estrutura de pastas de destino:
 * ANO / MM - MÊS / CLIENTE
 */
export function generateTargetFolderPath(
  data: ExtractedInvoiceData,
  settings: AppSettings,
  clientOverrideName?: string
): { folderPath: string; clientFolder: string } {
  const ano = sanitizeFileSystemName(data.anoEmissao || '2026');
  const mesExtenso = sanitizeFileSystemName(data.mesExtenso || '01_-_JANEIRO');
  
  const rawClientName = clientOverrideName || data.selectedClient?.name || 'CLIENTES_REVISAO';
  const cliente = sanitizeFileSystemName(rawClientName);

  let folderPath = '';
  switch (settings.folderStructure) {
    case 'MES_CLIENTE':
      folderPath = `${mesExtenso}/${cliente}`;
      break;
    case 'CLIENTE_MES':
      folderPath = `${cliente}/${mesExtenso}`;
      break;
    case 'CLIENTE_DIRETO':
      folderPath = `${cliente}`;
      break;
    case 'ANO_MES_CLIENTE':
      folderPath = `${ano}/${mesExtenso}/${cliente}`;
      break;
    case 'CLIENTE_ANO_MES':
      folderPath = `${cliente}/${ano}/${mesExtenso}`;
      break;
    case 'ANO_CLIENTE':
      folderPath = `${ano}/${cliente}`;
      break;
    default:
      folderPath = `${mesExtenso}/${cliente}`;
  }

  return { folderPath, clientFolder: cliente };
}

/**
 * Garante unicidade dos nomes em um conjunto de arquivos, adicionando _01, _02 se duplicados
 */
export function resolveDuplicateFileNames(
  items: Array<{ id: string; targetFolderPath: string; generatedFileName: string }>
): Map<string, string> {
  const resolvedMap = new Map<string, string>();
  const pathUsageCount = new Map<string, number>();

  for (const item of items) {
    const fullRelativePath = `${item.targetFolderPath}/${item.generatedFileName}`;
    const count = pathUsageCount.get(fullRelativePath) || 0;

    if (count === 0) {
      resolvedMap.set(item.id, item.generatedFileName);
      pathUsageCount.set(fullRelativePath, 1);
    } else {
      // Já existe, incrementa sufixo _01, _02
      pathUsageCount.set(fullRelativePath, count + 1);
      const extIndex = item.generatedFileName.lastIndexOf('.');
      const baseName = extIndex !== -1 ? item.generatedFileName.substring(0, extIndex) : item.generatedFileName;
      const extension = extIndex !== -1 ? item.generatedFileName.substring(extIndex) : '.pdf';
      
      const suffix = String(count).padStart(2, '0');
      const uniqueFileName = `${baseName}_${suffix}${extension}`;
      resolvedMap.set(item.id, uniqueFileName);
    }
  }

  return resolvedMap;
}

/**
 * Cria um arquivo ZIP contendo toda a árvore de diretórios organizada.
 * Preserva os originais intactos e empacota cópias organizadas.
 */
export async function createOrganizedZipArchive(
  items: Array<{
    file: File;
    targetFolderPath: string;
    finalFileName: string;
  }>
): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  for (const item of items) {
    const fileArrayBuffer = await item.file.arrayBuffer();
    const cleanFolderPath = item.targetFolderPath.replace(/^\/+|\/+$/g, '');
    const zipPath = `${cleanFolderPath}/${item.finalFileName}`;
    
    zip.file(zipPath, fileArrayBuffer);
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Gravação direta no disco via File System Access API nativa do navegador (Chromium/Edge/Mac/Linux/Windows).
 * Não altera os arquivos de origem, apenas cria cópias organizadas no diretório de destino.
 */
export async function saveOrganizedFilesToDirectoryHandle(
  targetDirHandle: any,
  items: Array<{
    file: File;
    targetFolderPath: string;
    finalFileName: string;
    originalFileName?: string;
  }>,
  onProgress?: (current: number, total: number, currentFileName: string) => void,
  options?: { removeRootOriginalAfterOrganize?: boolean }
): Promise<{ successCount: number; errorCount: number }> {
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (onProgress) {
      onProgress(i + 1, items.length, item.finalFileName);
    }

    try {
      const folderSegments = item.targetFolderPath.split('/').filter(Boolean);
      let currentDir = targetDirHandle;

      // Cria ou navega subdiretórios recursivamente
      for (const segment of folderSegments) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
      }

      // Cria o novo arquivo cópia renomeado na subpasta
      const fileHandle = await currentDir.getFileHandle(item.finalFileName, { create: true });
      const writable = await fileHandle.createWritable();
      const arrayBuffer = await item.file.arrayBuffer();
      await writable.write(arrayBuffer);
      await writable.close();

      // Se solicitado limpar da raiz da pasta após organizar na subpasta
      if (options?.removeRootOriginalAfterOrganize && item.originalFileName) {
        try {
          await targetDirHandle.removeEntry(item.originalFileName);
        } catch (removeErr) {
          console.warn(`Não foi possível remover da raiz: ${item.originalFileName}`, removeErr);
        }
      }

      successCount++;
    } catch (err) {
      console.error(`Erro ao gravar cópia de ${item.finalFileName}:`, err);
      errorCount++;
    }
  }

  return { successCount, errorCount };
}
