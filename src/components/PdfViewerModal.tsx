import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Database,
} from 'lucide-react';
import { storageService } from '../services/storageService';

interface PdfViewerModalProps {
  item: {
    originalFileName: string;
    generatedFileName?: string;
    storageBucket?: string;
    storagePath?: string;
    storageUrl?: string;
    storageViewUrl?: string;
    storageDownloadUrl?: string;
    blobUrl?: string;
    blobPathname?: string;
    blobViewUrl?: string;
    fileUrl?: string;
    file?: File;
  };
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ item, onClose }) => {
  const [pdfSourceUrl, setPdfSourceUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<'supabase' | 'memory'>('supabase');

  useEffect(() => {
    let objectUrlToRevoke: string | null = null;

    async function resolvePdfUrl() {
      setLoading(true);
      setError(null);

      try {
        // 1. Prioridade absoluta: Supabase Storage Privado via URL segura/assinada
        if (
          item.storageViewUrl ||
          item.storagePath ||
          item.storageUrl ||
          item.blobUrl ||
          item.blobPathname ||
          item.blobViewUrl
        ) {
          const viewUrl = storageService.getPdfViewUrl(item);
          setPdfSourceUrl(viewUrl);
          setStorageType('supabase');
          setLoading(false);
          return;
        }

        // 2. Se tiver o objeto File original em memória (durante o processamento)
        if (item.file) {
          objectUrlToRevoke = URL.createObjectURL(item.file);
          setPdfSourceUrl(objectUrlToRevoke);
          setStorageType('memory');
          setLoading(false);
          return;
        }

        // 3. Se tiver URL gravada em fileUrl (sem caminho de disco local)
        if (item.fileUrl && !item.fileUrl.startsWith('/Users/')) {
          setPdfSourceUrl(item.fileUrl);
          setStorageType('supabase');
          setLoading(false);
          return;
        }

        // 4. Fallback pelo nome do arquivo original diretamente no Supabase Storage
        const fallbackUrl = `/api/storage/view?filename=${encodeURIComponent(item.originalFileName)}`;
        setPdfSourceUrl(fallbackUrl);
        setStorageType('supabase');
        setLoading(false);
      } catch (err: any) {
        console.error('Erro ao resolver visualização do PDF no Supabase:', err);
        setError('Não foi possível carregar a visualização do arquivo PDF original do Supabase Storage.');
        setLoading(false);
      }
    }

    resolvePdfUrl();

    return () => {
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [item]);

  const handleDownload = () => {
    if (item.storagePath || item.storageUrl || item.blobUrl || item.blobPathname) {
      const downloadUrl = storageService.getPdfDownloadUrl(item);
      window.open(downloadUrl, '_blank');
    } else if (pdfSourceUrl) {
      const a = document.createElement('a');
      a.href = pdfSourceUrl;
      a.download = item.originalFileName || 'nota_fiscal_original.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenNewTab = () => {
    if (pdfSourceUrl) {
      window.open(pdfSourceUrl, '_blank');
    }
  };

  const displayPath = item.storagePath || item.blobPathname || '';
  const bucketName = item.storageBucket || 'notas-fiscais';

  return (
    <div
      id="pdf-viewer-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="pdf-viewer-modal-container"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold truncate">
                  {item.originalFileName}
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="w-3 h-3" />
                  PDF Original Íntegro
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Database className="w-3 h-3 text-emerald-500" />
                  Supabase Storage: <strong className="text-slate-700 dark:text-slate-200">{bucketName}</strong> (Privado)
                </span>
                {item.generatedFileName && (
                  <>
                    <span>•</span>
                    <span className="truncate">Organizado: {item.generatedFileName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-pdf-new-tab"
              onClick={handleOpenNewTab}
              title="Abrir em Nova Aba"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Aba</span>
            </button>

            <button
              id="btn-pdf-download"
              onClick={handleDownload}
              title="Baixar PDF Original"
              className="p-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Baixar Original</span>
            </button>

            <button
              id="btn-pdf-close"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Security & Integrity Banner */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 px-6 py-2 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Este é o <strong>arquivo PDF original exato</strong> armazenado no Supabase Storage Privado. Não foi gerado resumo, nem alterada a camada de assinatura fiscal.
            </span>
          </div>
          <span className="text-[11px] font-mono opacity-80 hidden md:inline">
            Status: {storageType === 'supabase' ? 'Supabase Storage Cloud' : 'Buffer Local / Cache'}
          </span>
        </div>

        {/* Body / PDF Container */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 sm:p-4 relative flex flex-col items-center justify-center overflow-hidden">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-xs font-semibold">Carregando PDF original do Supabase Storage...</p>
            </div>
          )}

          {error && (
            <div className="max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Falha ao abrir documento</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
                >
                  Tentar Baixar Diretamente
                </button>
              </div>
            </div>
          )}

          {!loading && !error && pdfSourceUrl && (
            <iframe
              src={pdfSourceUrl}
              className="w-full h-full rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-inner"
              title="Visualizador do PDF Original"
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
          <span className="truncate text-[11px]">
            {displayPath ? `Caminho no Supabase: ${displayPath}` : 'Armazenado no bucket privado do Supabase com integridade total.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
