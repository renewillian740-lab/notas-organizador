import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Play,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Archive,
  RefreshCw,
  Sparkles,
  Check,
  Trash2,
} from 'lucide-react';
import { InvoiceItem, ExtractedInvoiceData } from '../types';
import { analyzeInvoicePDF } from '../services/pdfExtractor';
import {
  generateInvoiceFileName,
  generateTargetFolderPath,
  createOrganizedZipArchive,
  saveOrganizedFilesToDirectoryHandle,
} from '../services/fileOrganizer';
import { db } from '../services/db';
import { storageService } from '../services/storageService';
import { generateSampleInvoiceFiles } from '../utils/samplePdfGenerator';
import { ReviewModal } from './ReviewModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { PdfViewerModal } from './PdfViewerModal';

interface ProcessInvoicesProps {
  onProcessingCompleted: () => void;
}

export const ProcessInvoices: React.FC<ProcessInvoicesProps> = ({
  onProcessingCompleted,
}) => {
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceDirName, setSourceDirName] = useState<string>('');
  const [targetDirHandle, setTargetDirHandle] = useState<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [totalToAnalyze, setTotalToAnalyze] = useState(0);
  const [currentProcessingFile, setCurrentProcessingFile] = useState('');

  // Modais
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<InvoiceItem | null>(null);
  const [selectedPdfToView, setSelectedPdfToView] = useState<InvoiceItem | null>(null);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pdfs = Array.from(e.target.files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      setSourceFiles(pdfs);
      setSourceDirName(`${pdfs.length} arquivos selecionados`);
      prepareItems(pdfs);
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      const rootPdfs: File[] = [];

      for (const file of allFiles) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const relPath = (file as any).webkitRelativePath || '';
          const parts = relPath.split('/');
          if (parts.length <= 2) {
            rootPdfs.push(file);
          }
        }
      }

      if (rootPdfs.length > 0) {
        setSourceFiles(rootPdfs);
        const folderName = (allFiles[0] as any).webkitRelativePath?.split('/')[0] || 'Pasta Selecionada';
        setSourceDirName(folderName);
        prepareItems(rootPdfs);
      } else {
        alert('Nenhum arquivo PDF encontrado na raiz desta pasta.');
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pdfs = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      if (pdfs.length > 0) {
        setSourceFiles(pdfs);
        setSourceDirName(`${pdfs.length} arquivos arrastados`);
        prepareItems(pdfs);
      }
    }
  };

  const prepareItems = (files: File[]) => {
    const items: InvoiceItem[] = files.map((file, idx) => ({
      id: `inv-${Date.now()}-${idx}-${file.name.replace(/\W/g, '_')}`,
      file,
      originalFileName: file.name,
      originalFileSize: file.size,
      generatedFileName: file.name,
      targetFolderPath: 'Aguardando processamento',
      destinationFilePath: file.name,
      status: 'PENDENTE',
      statusMessage: 'Aguardando análise...',
      extractedData: null,
    }));
    setInvoiceItems(items);
    setExportSuccessMessage(null);

    // Upload seguro para armazenamento em nuvem
    items.forEach(async (item) => {
      try {
        const uploadRes = await storageService.uploadOriginalPdf(item.file);
        setInvoiceItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  storageBucket: uploadRes.bucket,
                  storagePath: uploadRes.storagePath,
                  storageUrl: uploadRes.url,
                  storageViewUrl: uploadRes.viewUrl,
                  storageDownloadUrl: uploadRes.downloadUrl,
                  isRemoteUploaded: uploadRes.isRemoteUploaded,
                  blobUrl: uploadRes.url,
                  blobPathname: uploadRes.storagePath,
                  blobViewUrl: uploadRes.viewUrl,
                  blobDownloadUrl: uploadRes.downloadUrl,
                }
              : it
          )
        );
      } catch (err) {
        console.warn(`Erro no upload de ${item.originalFileName}:`, err);
      }
    });
  };

  const handlePickFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
        setTargetDirHandle(dirHandle);
        setSourceDirName(dirHandle.name);

        const pdfFiles: File[] = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
            const file = await entry.getFile();
            pdfFiles.push(file);
          }
        }

        if (pdfFiles.length === 0) {
          alert(`Nenhum arquivo PDF encontrado na pasta "${dirHandle.name}".`);
          return;
        }

        setSourceFiles(pdfFiles);
        prepareItems(pdfFiles);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          folderInputRef.current?.click();
        }
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  const handleLoadSamples = async () => {
    setIsAnalyzing(true);
    setCurrentProcessingFile('Gerando notas sintéticas de teste...');
    try {
      const sampleFiles = await generateSampleInvoiceFiles();
      setSourceFiles(sampleFiles);
      setSourceDirName('Exemplos de Demonstração');
      prepareItems(sampleFiles);
    } catch (e: any) {
      console.error(e);
      alert('Erro ao carregar exemplos: ' + e.message);
    } finally {
      setIsAnalyzing(false);
      setCurrentProcessingFile('');
    }
  };

  const handleAnalyzeNotes = async () => {
    if (invoiceItems.length === 0) return;

    setIsAnalyzing(true);
    setAnalyzedCount(0);
    setTotalToAnalyze(invoiceItems.length);
    setExportSuccessMessage(null);

    const settings = db.getSettings();
    const updatedItems: InvoiceItem[] = [...invoiceItems];

    for (let i = 0; i < updatedItems.length; i++) {
      const current = updatedItems[i];
      setCurrentProcessingFile(current.originalFileName);

      try {
        const extracted = await analyzeInvoicePDF(current.file, current.originalFileName);

        let chosenClientName = 'CLIENTE_DESCONHECIDO';
        let status: 'IDENTIFICADO' | 'REVISAR' | 'ERRO' = 'IDENTIFICADO';
        let statusMessage = 'Identificado com sucesso';

        if (extracted.selectedClient) {
          chosenClientName = extracted.selectedClient.name;
          if (extracted.selectedClient.isPreRegistered) {
            status = 'IDENTIFICADO';
            statusMessage = `Cliente cadastrado: ${chosenClientName}`;
          } else {
            status = 'IDENTIFICADO';
            statusMessage = `Identificado no documento: ${chosenClientName}`;
          }
        } else if (extracted.candidateClients.length > 0) {
          chosenClientName = extracted.candidateClients[0].name;
          status = 'REVISAR';
          statusMessage = 'Múltiplos clientes potenciais encontrados';
        } else {
          status = 'REVISAR';
          statusMessage = 'Nenhum CNPJ conhecido localizado';
        }

        if (extracted.needsOcr) {
          status = 'REVISAR';
          statusMessage = 'Documento digitalizado / sem texto pesquisável';
        }

        const generatedFileName = generateInvoiceFileName(extracted, chosenClientName);
        const { folderPath } = generateTargetFolderPath(extracted, settings, chosenClientName);

        updatedItems[i] = {
          ...current,
          status,
          statusMessage,
          extractedData: extracted,
          generatedFileName,
          targetFolderPath: folderPath,
          destinationFilePath: `${folderPath}/${generatedFileName}`,
        };
      } catch (err: any) {
        console.error('Erro na análise:', err);
        updatedItems[i] = {
          ...current,
          status: 'ERRO',
          statusMessage: 'Falha ao ler o PDF: ' + (err.message || 'Erro desconhecido'),
        };
      }

      setAnalyzedCount(i + 1);
      setInvoiceItems([...updatedItems]);
    }

    setIsAnalyzing(false);
    setCurrentProcessingFile('');
  };

  const handleSaveItemReview = (itemId: string, updatedData: any) => {
    const settings = db.getSettings();

    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const currentExtracted: ExtractedInvoiceData = item.extractedData || {
          numeroNota: 'S_N',
          dataEmissao: '-',
          anoEmissao: new Date().getFullYear().toString(),
          mesEmissao: String(new Date().getMonth() + 1).padStart(2, '0'),
          mesExtenso: `${String(new Date().getMonth() + 1).padStart(2, '0')} - COMPETÊNCIA`,
          valorTotal: 0,
          valorTotalFormatted: 'R$ 0,00',
          prestador: null,
          tomador: null,
          destinatario: null,
          emitente: null,
          allCnpjs: [],
          selectedClient: null,
          identificationMethod: 'CONFIRMACAO_MANUAL',
          diagnosticNotes: 'Criado via revisão manual',
          candidateClients: [],
          hasText: true,
          needsOcr: false,
          pageCount: 1,
          rawText: '',
          confidenceScore: 100,
        };

        const newExtracted: ExtractedInvoiceData = {
          ...currentExtracted,
          numeroNota: updatedData.manualNumber || currentExtracted.numeroNota,
          dataEmissao: updatedData.manualDate || currentExtracted.dataEmissao,
          valorTotal: updatedData.manualValue !== undefined ? updatedData.manualValue : currentExtracted.valorTotal,
          valorTotalFormatted:
            updatedData.manualValue !== undefined
              ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  updatedData.manualValue
                )
              : currentExtracted.valorTotalFormatted,
          selectedClient: {
            cnpj: updatedData.cnpj || '00.000.000/0000-00',
            cleanCnpj: updatedData.cnpj.replace(/\D/g, ''),
            name: updatedData.clientName,
            isPreRegistered: true,
          },
          identificationMethod: 'CONFIRMACAO_MANUAL',
          diagnosticNotes: `Cliente "${updatedData.clientName}" confirmado.`,
          needsOcr: false,
        };

        const generatedFileName = generateInvoiceFileName(newExtracted, updatedData.clientName);
        const { folderPath } = generateTargetFolderPath(newExtracted, settings, updatedData.clientName);

        return {
          ...item,
          status: 'IDENTIFICADO',
          statusMessage: 'Revisado e confirmado',
          extractedData: newExtracted,
          generatedFileName,
          targetFolderPath: folderPath,
          destinationFilePath: `${folderPath}/${generatedFileName}`,
        };
      })
    );
  };

  const handleExecuteOrganization = async () => {
    if (invoiceItems.length === 0) return;

    setIsExporting(true);
    setExportSuccessMessage(null);

    const itemsToExport = invoiceItems.filter(
      (it) => it.status === 'IDENTIFICADO' || it.status === 'PROCESSADO'
    );

    if (itemsToExport.length === 0) {
      alert('Nenhuma nota pronta para organização. Revise os itens pendentes.');
      setIsExporting(false);
      return;
    }

    const saveItemToDatabaseAndBlob = async (it: InvoiceItem) => {
      const clientName = it.extractedData?.selectedClient?.name || 'Cliente';
      const cnpj = it.extractedData?.selectedClient?.cnpj || '';
      const clean = it.extractedData?.selectedClient?.cleanCnpj || '';
      const val = it.extractedData?.valorTotal || 0;

      let storageBucket = it.storageBucket || 'notas-fiscais';
      let storagePath = it.storagePath || it.blobPathname;
      let storageUrl = it.storageUrl || it.blobUrl;
      let storageViewUrl = it.storageViewUrl || it.blobViewUrl;
      let storageDownloadUrl = it.storageDownloadUrl || it.blobDownloadUrl;

      if (!storagePath && !storageViewUrl) {
        try {
          const up = await storageService.uploadOriginalPdf(it.file);
          storageBucket = up.bucket;
          storagePath = up.storagePath;
          storageUrl = up.url;
          storageViewUrl = up.viewUrl;
          storageDownloadUrl = up.downloadUrl;
        } catch (storageErr) {
          console.warn('Erro ao assegurar upload:', storageErr);
        }
      }

      const safeCloudPath = storageViewUrl || it.destinationFilePath;

      db.addHistoryRecord({
        originalFileName: it.originalFileName,
        generatedFileName: it.generatedFileName,
        clientName,
        cnpj,
        cleanCnpj: clean,
        invoiceNumber: it.extractedData?.numeroNota || 'S_N',
        invoiceDate: it.extractedData?.dataEmissao || '-',
        invoiceValue: val,
        invoiceValueFormatted: it.extractedData?.valorTotalFormatted || 'R$ 0,00',
        targetPath: safeCloudPath,
        storedFilePath: safeCloudPath,
        fileUrl: storageViewUrl,
        storageBucket,
        storagePath,
        storageUrl,
        storageViewUrl,
        storageDownloadUrl,
        storageProvider: 'supabase',
        blobUrl: storageUrl,
        blobPathname: storagePath,
        blobViewUrl: storageViewUrl,
        blobDownloadUrl: storageDownloadUrl,
        blobStorageName: storageBucket,
        status: 'PROCESSADO',
        identificationMethod: it.extractedData?.identificationMethod || 'IDENTIFICACAO_AUTOMATICA',
        diagnosticSummary: it.extractedData?.diagnosticNotes || 'Organizado no sistema',
        rawTextSnippet: it.extractedData?.rawText?.slice(0, 500),
      });

      if (clean) {
        db.incrementClientStats(clean, val);
      }
    };

    try {
      if (targetDirHandle) {
        const result = await saveOrganizedFilesToDirectoryHandle(
          targetDirHandle,
          itemsToExport.map((it) => ({
            file: it.file,
            targetFolderPath: it.targetFolderPath,
            finalFileName: it.generatedFileName,
            originalFileName: it.originalFileName,
          }))
        );

        for (const it of itemsToExport) {
          await saveItemToDatabaseAndBlob(it);
        }

        setExportSuccessMessage(
          `Sucesso! ${result.successCount} notas organizadas nas subpastas.`
        );
      } else {
        await createOrganizedZipArchive(
          itemsToExport.map((it) => ({
            file: it.file,
            targetFolderPath: it.targetFolderPath,
            finalFileName: it.generatedFileName,
            originalFileName: it.originalFileName,
          }))
        );

        for (const it of itemsToExport) {
          await saveItemToDatabaseAndBlob(it);
        }

        setExportSuccessMessage(
          `Download concluído! Arquivo ZIP gerado contendo todas as subpastas estruturadas.`
        );
      }

      setInvoiceItems((prev) =>
        prev.map((item) => {
          if (itemsToExport.some((exp) => exp.id === item.id)) {
            return { ...item, status: 'PROCESSADO', statusMessage: 'Organizado na subpasta' };
          }
          return item;
        })
      );

      onProcessingCompleted();
    } catch (err: any) {
      console.error('Erro na exportação:', err);
      alert('Erro ao organizar arquivos: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const pendingReviewItems = invoiceItems.filter(
    (item) => item.status === 'REVISAR' || item.status === 'PENDENTE'
  );
  const processedSuccessCount = invoiceItems.filter(
    (item) => item.status === 'PROCESSADO' || item.status === 'IDENTIFICADO'
  ).length;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PROCESSADO':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Salvo
          </span>
        );
      case 'IDENTIFICADO':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Pronto
          </span>
        );
      case 'REVISAR':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Revisar
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
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Processar Notas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Identifique tomadores, renomeie os arquivos e organize em pastas por competência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {invoiceItems.length > 0 && (
            <button
              id="btn-clear-staging-invoices"
              onClick={() => {
                setSourceFiles([]);
                setInvoiceItems([]);
                setSourceDirName('');
                setAnalyzedCount(0);
                setTotalToAnalyze(0);
                setCurrentProcessingFile('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar</span>
            </button>
          )}

          <button
            id="btn-load-sample-invoices"
            onClick={handleLoadSamples}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            <span>Exemplos de teste</span>
          </button>
        </div>
      </div>

      {/* Fluxo de 3 Passos Minimalista */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Passo 1: Selecionar */}
        <div
          onClick={handlePickFolder}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`p-4 rounded-2xl border transition-colors cursor-pointer flex flex-col justify-between ${
            isDragOver
              ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-900'
              : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Passo 1
            </span>
            <FolderOpen className="w-4 h-4 text-slate-400" />
          </div>

          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block">
              {sourceFiles.length > 0 ? sourceDirName : 'Selecionar pasta de notas'}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5 block">
              {sourceFiles.length > 0
                ? `${sourceFiles.length} notas em PDF carregadas`
                : 'Clique ou arraste arquivos aqui'}
            </span>
          </div>
        </div>

        {/* Passo 2: Analisar */}
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Passo 2
            </span>
            <Play className="w-4 h-4 text-slate-400" />
          </div>

          <div>
            <button
              id="btn-analyze-invoices"
              disabled={invoiceItems.length === 0 || isAnalyzing}
              onClick={handleAnalyzeNotes}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-30 text-xs font-semibold transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analisando ({analyzedCount}/{totalToAnalyze})</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Analisar {invoiceItems.length > 0 ? `(${invoiceItems.length})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Passo 3: Organizar */}
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Passo 3
            </span>
            <Archive className="w-4 h-4 text-slate-400" />
          </div>

          <div>
            <button
              id="btn-execute-organize"
              disabled={processedSuccessCount === 0 || isExporting || isAnalyzing}
              onClick={handleExecuteOrganization}
              className="w-full py-2 px-3 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-30 text-xs font-semibold transition-opacity flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Criando pastas...</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" />
                  <span>Organizar {processedSuccessCount > 0 ? `(${processedSuccessCount})` : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <input
        type="file"
        ref={folderInputRef}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        onChange={handleFolderSelect}
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Barra de Progresso Durante Análise */}
      {isAnalyzing && (
        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Analisando {analyzedCount} de {totalToAnalyze} notas...
            </span>
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-xs">
              {currentProcessingFile}
            </span>
          </div>
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-900 dark:bg-white transition-all duration-200"
              style={{
                width: `${(analyzedCount / Math.max(1, totalToAnalyze)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Sucesso Discreto */}
      {exportSuccessMessage && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
          <button
            onClick={() => setExportSuccessMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alerta de Revisão Pendente */}
      {pendingReviewItems.length > 0 && !isAnalyzing && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>{pendingReviewItems.length} nota(s)</strong> requerem confirmação do tomador.
            </span>
          </div>
          <button
            id="btn-open-review-modal"
            onClick={() => setReviewModalOpen(true)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Revisar
          </button>
        </div>
      )}

      {/* Tabela de Notas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              Arquivos Carregados
            </span>
            <span className="text-xs text-slate-400">
              ({invoiceItems.length})
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            {processedSuccessCount > 0 && (
              <span>{processedSuccessCount} prontas</span>
            )}
            {pendingReviewItems.length > 0 && (
              <span>{pendingReviewItems.length} pendentes</span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Arquivo</th>
                <th className="py-2.5 px-4">Destino Previsto</th>
                <th className="py-2.5 px-4">Cliente</th>
                <th className="py-2.5 px-4">Número</th>
                <th className="py-2.5 px-4">Emissão</th>
                <th className="py-2.5 px-4 text-right">Valor</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoiceItems.length > 0 ? (
                invoiceItems.map((item) => {
                  const clientName =
                    item.extractedData?.selectedClient?.name || 'Aguardando análise';
                  const num = item.extractedData?.numeroNota || '-';
                  const data = item.extractedData?.dataEmissao || '-';
                  const valor = item.extractedData?.valorTotalFormatted || '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4 max-w-[180px]">
                        <span className="font-medium text-slate-900 dark:text-slate-100 block truncate" title={item.originalFileName}>
                          {item.originalFileName}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 max-w-[180px]">
                        <span className="text-[11px] font-mono text-slate-500 block truncate" title={item.targetFolderPath}>
                          {item.targetFolderPath}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 max-w-[160px]">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                          {clientName}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">{num}</td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">{data}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">{valor}</td>
                      <td className="py-2.5 px-4">
                        {getStatusText(item.status)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`btn-view-pdf-proc-${item.id}`}
                            onClick={() => setSelectedPdfToView(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Visualizar PDF"
                          >
                            <FileText className="w-3 h-3" /> PDF
                          </button>
                          <button
                            id={`btn-view-detail-${item.id}`}
                            onClick={() => setSelectedDetailItem(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileText className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-xs">Nenhuma nota selecionada.</p>
                    <p className="text-[11px] mt-0.5">
                      Selecione a pasta no Passo 1 ou teste com notas de exemplo.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {reviewModalOpen && (
        <ReviewModal
          pendingItems={pendingReviewItems}
          onClose={() => setReviewModalOpen(false)}
          onSaveItemReview={handleSaveItemReview}
        />
      )}

      {/* Details Modal */}
      {selectedDetailItem && (
        <InvoiceDetailModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
        />
      )}

      {/* Visualizador do PDF */}
      {selectedPdfToView && (
        <PdfViewerModal
          item={selectedPdfToView}
          onClose={() => setSelectedPdfToView(null)}
        />
      )}
    </div>
  );
};
