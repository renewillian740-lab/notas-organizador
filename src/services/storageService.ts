import { SupabaseStatusResult } from '../types';

export interface StorageUploadResult {
  success: boolean;
  provider: 'supabase' | 'local';
  store: string;
  bucket: string;
  isPrivate: boolean;
  storagePath: string;
  url: string;
  pathname: string;
  signedUrl?: string;
  viewUrl: string;
  downloadUrl?: string;
  size: number;
  originalFileName: string;
  isRemoteUploaded: boolean;
  warning?: string;
}

export const storageService = {
  /**
   * Faz upload do arquivo PDF ORIGINAL para o Supabase Storage Privado.
   * Não altera o PDF, não recompila nem gera resumo.
   */
  async uploadOriginalPdf(file: File): Promise<StorageUploadResult> {
    try {
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'x-file-name': encodeURIComponent(file.name),
        },
        body: file,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha no upload para o Supabase Storage (${response.status}): ${errorText}`);
      }

      const data: StorageUploadResult = await response.json();
      return data;
    } catch (err: any) {
      console.error('Erro no upload para o Supabase Storage:', err);
      return {
        success: false,
        provider: 'local',
        store: 'notas-fiscais',
        bucket: 'notas-fiscais',
        isPrivate: true,
        storagePath: `nfs/fallback/${Date.now()}_${file.name}`,
        url: '',
        pathname: `nfs/fallback/${Date.now()}_${file.name}`,
        viewUrl: `/api/storage/view?filename=${encodeURIComponent(file.name)}`,
        downloadUrl: `/api/storage/download?filename=${encodeURIComponent(file.name)}`,
        size: file.size,
        originalFileName: file.name,
        isRemoteUploaded: false,
        warning: err.message,
      };
    }
  },

  /**
   * Obtém a URL para visualização segura do PDF armazenado no Supabase Storage.
   */
  getPdfViewUrl(item: {
    storageViewUrl?: string;
    storageUrl?: string;
    storagePath?: string;
    blobViewUrl?: string;
    blobUrl?: string;
    blobPathname?: string;
    originalFileName?: string;
  }): string {
    if (item.storageViewUrl) return item.storageViewUrl;
    if (item.blobViewUrl) return item.blobViewUrl;

    const filename = item.originalFileName || 'nota_fiscal.pdf';
    const path = item.storagePath || item.blobPathname;

    if (path) {
      return `/api/storage/view?path=${encodeURIComponent(path)}&filename=${encodeURIComponent(filename)}`;
    }

    const rawUrl = item.storageUrl || item.blobUrl;
    if (rawUrl) {
      return `/api/storage/view?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}`;
    }

    return `/api/storage/view?filename=${encodeURIComponent(filename)}`;
  },

  /**
   * Obtém a URL para download direto do PDF armazenado no Supabase Storage.
   */
  getPdfDownloadUrl(item: {
    storagePath?: string;
    storageUrl?: string;
    storageDownloadUrl?: string;
    blobUrl?: string;
    blobPathname?: string;
    originalFileName?: string;
  }): string {
    if (item.storageDownloadUrl) return item.storageDownloadUrl;

    const filename = item.originalFileName || 'nota_fiscal.pdf';
    const path = item.storagePath || item.blobPathname;

    if (path) {
      return `/api/storage/download?path=${encodeURIComponent(path)}&filename=${encodeURIComponent(filename)}`;
    }

    const rawUrl = item.storageUrl || item.blobUrl;
    if (rawUrl) {
      return `/api/storage/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(filename)}`;
    }

    return `/api/storage/download?filename=${encodeURIComponent(filename)}`;
  },

  /**
   * Consulta o status de conexão com o Supabase Storage e Banco de Dados.
   */
  async getStatus(): Promise<SupabaseStatusResult> {
    try {
      const res = await fetch('/api/storage/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Não foi possível consultar status do Supabase:', e);
    }
    return {
      connected: false,
      hasUrl: false,
      hasKey: false,
      keyType: 'none',
      bucket: 'notas-fiscais',
      bucketExists: false,
      tablesStatus: { invoices: false, clients: false },
      message: 'Servidor local ou Supabase desconectado.',
    };
  },

  /**
   * Retorna o script SQL para configuração do banco no Supabase
   */
  async getSqlSchema(): Promise<{ sql: string; bucketName: string }> {
    try {
      const res = await fetch('/api/supabase/sql-schema');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Erro ao obter schema SQL:', e);
    }
    return {
      sql: '',
      bucketName: 'notas-fiscais',
    };
  },
};

// Aliases para compatibilidade retroativa
export const blobService = storageService;
