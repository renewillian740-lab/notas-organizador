import React, { useState, useRef } from 'react';
import {
  FolderUp,
  FolderOpen,
  Play,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Sparkles,
  ArrowRight,
  UploadCloud,
  Check,
  Trash2,
  Database,
  Eye,
  Building2,
  History as HistoryIcon,
  ShieldCheck,
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
    setFolderName(folderLabel || `${pdfs.length} arquivos PDF selecionados`);
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

      // Detecta nome da pasta raiz
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
    prepareFiles(sampleFiles, 'Pasta de Exemplo (5 Notas Fiscais Demonstrativas)');
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

      // Atualiza status para analisando
      current.status = 'ANALISANDO';
      setItems([...updatedItems]);

      try {
        // 1. Extração estruturada dos dados da nota fiscal (separando Prestador vs Tomador)
        const extracted = await analyzeInvoicePDF(current.file, current.originalFileName);
        current.extractedData = extracted;

        const isKnown = extracted.selectedClient !== null;
        const clientName = extracted.selectedClient?.name || 'OUTROS';
        const cnpj = extracted.selectedClient?.cnpj || '00.000.000/0000-00';
        const clean = extracted.selectedClient?.cleanCnpj || '00000000000000';
        const val = extracted.valorTotal || 0;

        // Auto-cadastro de nova empresa se selecionado e identificada
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

        // 2. Upload para o Supabase Storage Privado
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
          console.warn('Upload de PDF em fallback local:', storageErr);
        }

        // 3. Geração do nome padronizado
        const generatedFileName = generateInvoiceFileName(extracted, clientName);
        const safeCloudPath = storageViewUrl || generatedFileName;

        const recordStatus: InvoiceStatus = isKnown ? 'PROCESSADO' : 'REVISAR';

        // 4. Gravação direta no Histórico Persistente
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
          diagnosticSummary: extracted.diagnosticNotes || 'Importado via Subir Dados para o Histórico',
        });

        // Atualiza estatísticas do cliente
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

  const getStatusBadge = (status: IngestedItem['status']) => {
    switch (status) {
      case 'SUCESSO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> No Histórico
          </span>
        );
      case 'REVISAR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Pendente Revisão
          </span>
        );
      case 'ANALISANDO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300">
            <RefreshCw className="w-3 h-3 animate-spin" /> Analisando
          </span>
        );
      case 'ERRO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300">
            Falha
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <Clock className="w-3 h-3" /> Aguardando
          </span>
        );
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Inputs Ocultos */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
              <FolderUp className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Subir Dados
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              <Database className="w-3 h-3" /> Importação Direta
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Selecione uma pasta com notas fiscais para analisar o conteúdo e registrar diretamente no histórico do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {items.length > 0 && (
            <button
              id="btn-clear-upload-selection"
              onClick={handleClearSelection}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Limpar Seleção
            </button>
          )}

          <button
            id="btn-upload-load-samples"
            onClick={handleLoadSamples}
            disabled={isProcessing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Testar com Notas de Exemplo
          </button>
        </div>
      </div>

      {/* Dropzone e Seleção de Pasta */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`p-8 rounded-3xl border-2 transition-all ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-4 ring-blue-500/10'
            : selectedFiles.length > 0
            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20'
            : 'border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500'
        }`}
      >
        <div className="flex flex-col items-center text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner">
            {selectedFiles.length > 0 ? (
              <FileCheck className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <div>
            {selectedFiles.length > 0 ? (
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {folderName}
                </h3>
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {selectedFiles.length} notas fiscais em PDF carregadas e prontas para análise
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Arraste uma pasta inteira ou selecione os arquivos PDF
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  O sistema irá escanear todos os documentos, extrair dados fiscais e alimentar o histórico.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              id="btn-select-folder-to-ingest"
              type="button"
              disabled={isProcessing}
              onClick={() => folderInputRef.current?.click()}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <FolderOpen className="w-4 h-4" /> Selecionar Pasta
            </button>

            <button
              id="btn-select-files-to-ingest"
              type="button"
              disabled={isProcessing}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <FileText className="w-4 h-4" /> Selecionar Arquivos PDF
            </button>
          </div>
        </div>
      </div>

      {/* Painel de Controle de Ingestão */}
      {selectedFiles.length > 0 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Opções de Análise e Ingestão
              </h2>
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={autoRegisterClients}
                  onChange={(e) => setAutoRegisterClients(e.target.checked)}
                  disabled={isProcessing}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Cadastrar automaticamente novos clientes identificados nas notas
                </span>
              </label>
            </div>

            <button
              id="btn-start-ingest-to-history"
              type="button"
              onClick={handleStartIngestion}
              disabled={isProcessing || items.length === 0}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analisando e Gravando ({currentIndex}/{items.length})...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Analisar e Subir para o Histórico ({items.length} notas)</span>
                </>
              )}
            </button>
          </div>

          {/* Barra de Progresso durante processamento */}
          {isProcessing && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                <span>Progresso da Ingestão</span>
                <span>{Math.round((currentIndex / items.length) * 100)}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(currentIndex / items.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resumo de Sucesso após conclusão */}
      {completedSummary && (
        <div className="p-6 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-3xl border border-emerald-200 dark:border-emerald-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Ingestão Concluída! {completedSummary.total} notas fiscais processadas.</span>
            </div>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
              • <strong>{completedSummary.success}</strong> notas identificadas e gravadas com sucesso •{' '}
              {completedSummary.pending > 0 && (
                <span><strong>{completedSummary.pending}</strong> requerem atenção no Histórico • </span>
              )}
              <strong>{completedSummary.clientsAdded}</strong> novos clientes cadastrados.
            </p>
          </div>

          <button
            id="btn-go-to-history"
            onClick={() => onNavigateTab('history')}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <HistoryIcon className="w-4 h-4" />
            <span>Ver no Histórico Completo</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista / Tabela de Notas Sendo Ingeridas */}
      {items.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              Lista de Notas Fiscais da Pasta ({items.length})
            </h3>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {items.filter((i) => i.status === 'SUCESSO').length} gravadas no histórico
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3">Arquivo Original</th>
                  <th className="px-5 py-3">Número NF</th>
                  <th className="px-5 py-3">Cliente / Tomador</th>
                  <th className="px-5 py-3">CNPJ</th>
                  <th className="px-5 py-3">Valor Total</th>
                  <th className="px-5 py-3">Status no Histórico</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {items.map((item) => {
                  const ext = item.extractedData;
                  const client = ext?.selectedClient;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="truncate font-medium text-slate-800 dark:text-slate-200" title={item.originalFileName}>
                            {item.originalFileName}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                        {ext?.numeroNota || '-'}
                      </td>

                      <td className="px-5 py-3.5">
                        {client ? (
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span className="truncate max-w-[180px]" title={client.name}>
                              {client.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pendente de análise</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {client?.cnpj || '-'}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-slate-100">
                        {ext?.valorTotalFormatted || '-'}
                      </td>

                      <td className="px-5 py-3.5">{getStatusBadge(item.status)}</td>

                      <td className="px-5 py-3.5 text-right">
                        {item.historyRecord && (
                          <button
                            type="button"
                            onClick={() => setSelectedPdfToView(item.historyRecord)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Visualizar PDF"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

      {/* Modal Visualizador de PDF */}
      {selectedPdfToView && (
        <PdfViewerModal
          item={selectedPdfToView}
          onClose={() => setSelectedPdfToView(null)}
        />
      )}
    </div>
  );
};
