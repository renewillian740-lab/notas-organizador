import React, { useState, useRef } from 'react';
import {
  FolderUp,
  FolderOpen,
  Play,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  UploadCloud,
  Trash2,
  Eye,
  History as HistoryIcon,
  FileCheck,
} from 'lucide-react';
import { HistoryRecord, ExtractedInvoiceData, InvoiceStatus } from '../types';
import { analyzeInvoicePDF } from '../services/pdfExtractor';
import { generateInvoiceFileName } from '../services/fileOrganizer';
import { db } from '../services/db';
import { storageService } from '../services/storageService';
import { generateSampleInvoiceFiles } from '../utils/samplePdfGenerator';
import { PdfViewerModal } from './PdfViewerModal';

interface UploadDataPageProps {
  onDataUploaded: () => void;
  onNavigateTab: (tab: 'dashboard' | 'process' | 'upload' | 'clients' | 'history' | 'settings') => void;
}

interface IngestedItem {
  id: string;
  file: File;
  originalFileName: string;
  fileSize: number;
  extractedData: ExtractedInvoiceData | null;
  historyRecord: HistoryRecord | null;
  status: 'PENDENTE' | 'ANALISANDO' | 'SUCESSO' | 'REVISAR' | 'ERRO';
  errorMessage?: string;
}

export const UploadDataPage: React.FC<UploadDataPageProps> = ({
  onDataUploaded,
  onNavigateTab,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState<IngestedItem[]>([]);
  const [autoRegisterClients, setAutoRegisterClients] = useState(true);
  const [selectedPdfToView, setSelectedPdfToView] = useState<HistoryRecord | null>(null);
  const [completedSummary, setCompletedSummary] = useState<{
    total: number;
    success: number;
    pending: number;
    clientsAdded: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const prepareFiles = (files: File[], folderLabel?: string) => {
    const pdfs = files.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    setSelectedFiles(pdfs);
    setFolderName(folderLabel || `${pdfs.length} notas em PDF selecionadas`);
    setCompletedSummary(null);

    const initialItems: IngestedItem[] = pdfs.map((file, idx) => ({
      id: `ingest_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      file,
      originalFileName: file.name,
      fileSize: file.size,
      extractedData: null,
      historyRecord: null,
      status: 'PENDENTE',
    }));

    setItems(initialItems);
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      const pdfs = allFiles.filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );

      const firstRelPath = allFiles[0].webkitRelativePath || '';
      const dirName = firstRelPath ? firstRelPath.split('/')[0] : 'Pasta selecionada';

      prepareFiles(pdfs, dirName);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      prepareFiles(allFiles);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files);
      prepareFiles(allFiles, 'Arquivos soltos / Pasta arrastada');
    }
  };

  const handleLoadSamples = () => {
    const sampleFiles = generateSampleInvoiceFiles();
    prepareFiles(sampleFiles, 'Exemplos Demonstrativos (5 Notas Fiscais)');
  };

  const handleClearSelection = () => {
    setSelectedFiles([]);
    setFolderName('');
    setItems([]);
    setCompletedSummary(null);
    setCurrentIndex(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleStartIngestion = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setCompletedSummary(null);

    let successCount = 0;
    let reviewCount = 0;
    let newClientsCount = 0;

    const updatedItems = [...items];

    for (let i = 0; i < updatedItems.length; i++) {
      setCurrentIndex(i + 1);
      const current = updatedItems[i];

      current.status = 'ANALISANDO';
      setItems([...updatedItems]);

      try {
        const extracted = await analyzeInvoicePDF(current.file, current.originalFileName);
        current.extractedData = extracted;

        const isKnown = extracted.selectedClient !== null;
        const clientName = extracted.selectedClient?.name || 'OUTROS';
        const cnpj = extracted.selectedClient?.cnpj || '00.000.000/0000-00';
        const clean = extracted.selectedClient?.cleanCnpj || '00000000000000';
        const val = extracted.valorTotal || 0;

        if (
          autoRegisterClients &&
          extracted.selectedClient &&
          !extracted.selectedClient.isPreRegistered
        ) {
          const registered = db.addOrUpdateClient({
            cnpj: extracted.selectedClient.cnpj,
            customName: extracted.selectedClient.name,
            razaoSocial: extracted.selectedClient.name,
          });
          if (registered) {
            newClientsCount++;
          }
        }

        let storageBucket = 'notas-fiscais';
        let storagePath = '';
        let storageUrl = '';
        let storageViewUrl = '';
        let storageDownloadUrl = '';

        try {
          const up = await storageService.uploadOriginalPdf(current.file);
          storageBucket = up.bucket || 'notas-fiscais';
          storagePath = up.storagePath || '';
          storageUrl = up.url || '';
          storageViewUrl = up.viewUrl || '';
          storageDownloadUrl = up.downloadUrl || '';
        } catch (storageErr) {
          console.warn('Upload de PDF:', storageErr);
        }

        const generatedFileName = generateInvoiceFileName(extracted, clientName);
        const safeCloudPath = storageViewUrl || generatedFileName;

        const recordStatus: InvoiceStatus = isKnown ? 'PROCESSADO' : 'REVISAR';

        const savedRecord = db.addHistoryRecord({
          originalFileName: current.originalFileName,
          generatedFileName,
          clientName,
          cnpj,
          cleanCnpj: clean,
          invoiceNumber: extracted.numeroNota || 'S_N',
          invoiceDate: extracted.dataEmissao || '-',
          invoiceValue: val,
          invoiceValueFormatted: extracted.valorTotalFormatted || 'R$ 0,00',
          targetPath: safeCloudPath,
          storedFilePath: safeCloudPath,
          fileUrl: storageViewUrl || undefined,
          storageBucket,
          storagePath,
          storageUrl,
          storageViewUrl,
          storageDownloadUrl: storageDownloadUrl || undefined,
          storageProvider: 'supabase',
          blobUrl: storageUrl,
          blobPathname: storagePath,
          blobViewUrl: storageViewUrl,
          blobDownloadUrl: storageDownloadUrl || undefined,
          blobStorageName: storageBucket,
          status: recordStatus,
          identificationMethod: extracted.identificationMethod,
          diagnosticSummary: extracted.diagnosticNotes || 'Importado via Subir Dados',
        });

        if (clean && clean !== '00000000000000') {
          db.incrementClientStats(clean, val);
        }

        current.historyRecord = savedRecord;
        current.status = isKnown ? 'SUCESSO' : 'REVISAR';

        if (isKnown) {
          successCount++;
        } else {
          reviewCount++;
        }
      } catch (err: any) {
        console.error(`Erro ao analisar nota ${current.originalFileName}:`, err);
        current.status = 'ERRO';
        current.errorMessage = err.message || 'Erro no processamento da nota fiscal.';
      }

      setItems([...updatedItems]);
    }

    setIsProcessing(false);
    setCompletedSummary({
      total: updatedItems.length,
      success: successCount,
      pending: reviewCount,
      clientsAdded: newClientsCount,
    });

    onDataUploaded();
  };

  const getStatusText = (status: IngestedItem['status']) => {
    switch (status) {
      case 'SUCESSO':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            No Histórico
          </span>
        );
      case 'REVISAR':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Revisão
          </span>
        );
      case 'ANALISANDO':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
            <RefreshCw className="w-3 h-3 animate-spin text-slate-500" />
            Analisando
          </span>
        );
      case 'ERRO':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Erro
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"></span>
            Aguardando
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        {...({ webkitdirectory: '', directory: '' } as any)}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept=".pdf"
        className="hidden"
      />

      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Subir Dados
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Importação direta de pastas ou lotes de notas fiscais para o histórico do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <button
              id="btn-clear-upload-selection"
              onClick={handleClearSelection}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar seleção</span>
            </button>
          )}

          <button
            id="btn-upload-load-samples"
            onClick={handleLoadSamples}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            <span>Exemplos de teste</span>
          </button>
        </div>
      </div>

      {/* Dropzone Minimalista */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`p-6 rounded-2xl border transition-colors ${
          isDragOver
            ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-900'
            : selectedFiles.length > 0
            ? 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
            : 'border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600'
        }`}
      >
        <div className="flex flex-col items-center text-center max-w-md mx-auto space-y-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center">
            {selectedFiles.length > 0 ? (
              <FileCheck className="w-5 h-5" />
            ) : (
              <UploadCloud className="w-5 h-5" />
            )}
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
              {selectedFiles.length > 0 ? folderName : 'Selecione uma pasta ou arquivos PDF'}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} notas fiscais carregadas e prontas`
                : 'Arraste a pasta para cá ou use os botões abaixo'}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              id="btn-select-folder-to-ingest"
              type="button"
              disabled={isProcessing}
              onClick={() => folderInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40 text-xs font-semibold transition-opacity flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Selecionar pasta</span>
            </button>

            <button
              id="btn-select-files-to-ingest"
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Arquivos soltos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Painel de Ingestão Minimalista */}
      {selectedFiles.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoRegisterClients}
              onChange={(e) => setAutoRegisterClients(e.target.checked)}
              disabled={isProcessing}
              className="w-4 h-4 text-slate-900 rounded border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              Cadastrar automaticamente novos clientes identificados
            </span>
          </label>

          <button
            id="btn-start-ingest-to-history"
            type="button"
            onClick={handleStartIngestion}
            disabled={isProcessing || items.length === 0}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-40 text-xs font-semibold transition-opacity flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Importando ({currentIndex}/{items.length})...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Importar {items.length} notas para o Histórico</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Progresso Minimalista */}
      {isProcessing && (
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>Progresso da importação</span>
            <span className="font-mono">{Math.round((currentIndex / items.length) * 100)}%</span>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 dark:bg-white transition-all duration-200 rounded-full"
              style={{ width: `${(currentIndex / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Resumo Concluído */}
      {completedSummary && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Importação concluída: {completedSummary.total} notas processadas</span>
            </div>
            <p className="text-[11px] text-slate-400">
              {completedSummary.success} salvas · {completedSummary.pending} requerem revisão · {completedSummary.clientsAdded} clientes adicionados
            </p>
          </div>

          <button
            id="btn-go-to-history"
            onClick={() => onNavigateTab('history')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <HistoryIcon className="w-3.5 h-3.5 text-slate-500" />
            <span>Ver no Histórico</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Tabela de Arquivos */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Notas da Pasta ({items.length})
            </span>
            <span className="text-xs text-slate-400">
              {items.filter((i) => i.status === 'SUCESSO').length} gravadas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Arquivo</th>
                  <th className="py-2.5 px-4">Número</th>
                  <th className="py-2.5 px-4">Cliente (Tomador)</th>
                  <th className="py-2.5 px-4">CNPJ</th>
                  <th className="py-2.5 px-4 text-right">Valor</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const ext = item.extractedData;
                  const client = ext?.selectedClient;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-4 max-w-xs">
                        <span className="font-medium text-slate-900 dark:text-slate-100 block truncate" title={item.originalFileName}>
                          {item.originalFileName}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {ext?.numeroNota || '-'}
                      </td>

                      <td className="py-2.5 px-4 max-w-[180px]">
                        {client ? (
                          <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                            {client.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Pendente de análise</span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {client?.cnpj || '-'}
                      </td>

                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {ext?.valorTotalFormatted || '-'}
                      </td>

                      <td className="py-2.5 px-4">{getStatusText(item.status)}</td>

                      <td className="py-2.5 px-4 text-right">
                        {item.historyRecord && (
                          <button
                            type="button"
                            onClick={() => setSelectedPdfToView(item.historyRecord)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Visualizar PDF"
                          >
                            <Eye className="w-3 h-3" /> PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPdfToView && (
        <PdfViewerModal
          item={selectedPdfToView}
          onClose={() => setSelectedPdfToView(null)}
        />
      )}
    </div>
  );
};
