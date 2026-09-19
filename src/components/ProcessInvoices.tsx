import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Play,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Archive,
  RefreshCw,
  Clock,
  Sparkles,
  ArrowRight,
  UploadCloud,
  Check,
} from 'lucide-react';
import { InvoiceItem, ExtractedInvoiceData } from '../types';
import { analyzeInvoicePDF } from '../services/pdfExtractor';
import {
  generateInvoiceFileName,
  generateTargetFolderPath,
  resolveDuplicateFileNames,
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

  // Manipulador de múltiplos arquivos PDF soltos
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

  // Manipulador de pasta (HTML input com filtro estrito de raiz)
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

  // Drag & drop
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

  // Preparar os itens no estado inicial e enviar PDFs originais para o Supabase Storage Privado
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
      statusMessage: 'Enviando PDF original ao Supabase Storage Privado...',
      extractedData: null,
    }));
    setInvoiceItems(items);
    setExportSuccessMessage(null);

    // Upload imediato do PDF ORIGINAL para o Supabase Storage
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
                  // Campos legados para compatibilidade
                  blobUrl: uploadRes.url,
                  blobPathname: uploadRes.storagePath,
                  blobViewUrl: uploadRes.viewUrl,
                  blobDownloadUrl: uploadRes.downloadUrl,
                  statusMessage: uploadRes.isRemoteUploaded
                    ? 'PDF salvo no Supabase Storage Privado'
                    : 'PDF retido no buffer seguro',
                }
              : it
          )
        );
      } catch (err) {
        console.warn(`Erro no upload ao Supabase Storage de ${item.originalFileName}:`, err);
      }
    });
  };

  // Iniciar seletor de diretório nativo moderno (File System Access API)
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
          console.warn('Fallback para input de arquivo:', err);
          folderInputRef.current?.click();
        }
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  // Carregar dados de amostra instantâneos
  const handleLoadSamples = async () => {
    setIsAnalyzing(true);
    setCurrentProcessingFile('Gerando 5 notas de teste sintéticas...');
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

  // Executar a análise profunda de cada PDF
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
        const extracted = await analyzeInvoicePDF(current.file);

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
        console.error(`Erro ao analisar ${current.originalFileName}:`, err);
        updatedItems[i] = {
          ...current,
          status: 'ERRO',
          statusMessage: `Falha na extração: ${err.message || 'Erro desconhecido'}`,
        };
      }

      setAnalyzedCount(i + 1);
      setInvoiceItems([...updatedItems]);
    }

    const resolvedNameMap = resolveDuplicateFileNames(
      updatedItems.map((item) => ({
        id: item.id,
        targetFolderPath: item.targetFolderPath,
        generatedFileName: item.generatedFileName,
      }))
    );

    const finalItems = updatedItems.map((item) => {
      const uniqueName = resolvedNameMap.get(item.id) || item.generatedFileName;
      return {
        ...item,
        generatedFileName: uniqueName,
        destinationFilePath: `${item.targetFolderPath}/${uniqueName}`,
      };
    });

    setInvoiceItems(finalItems);
    setIsAnalyzing(false);
    setCurrentProcessingFile('');
  };

  // Salvar revisão manual
  const handleSaveItemReview = (
    itemId: string,
    updatedData: {
      clientName: string;
      cnpj: string;
      registerNewClient: boolean;
      manualNumber?: string;
      manualDate?: string;
      manualValue?: number;
    }
  ) => {
    const settings = db.getSettings();

    setInvoiceItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        if (updatedData.registerNewClient && updatedData.cnpj) {
          db.addOrUpdateClient({
            cnpj: updatedData.cnpj,
            customName: updatedData.clientName,
          });
        }

        const currentExtracted: ExtractedInvoiceData = item.extractedData || {
          numeroNota: updatedData.manualNumber || 'S_N',
          dataEmissao: updatedData.manualDate || '18/09/2026',
          anoEmissao: '2026',
          mesEmissao: '09',
          mesExtenso: '09 - SETEMBRO',
          valorTotal: updatedData.manualValue || null,
          valorTotalFormatted: updatedData.manualValue
            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                updatedData.manualValue
              )
            : 'R$ 0,00',
          prestador: null,
          tomador: null,
          destinatario: null,
          emitente: null,
          allCnpjs: [],
          selectedClient: null,
          identificationMethod: 'CONFIRMACAO_MANUAL',
          diagnosticNotes: 'Confirmado manualmente.',
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

  // Organizar e salvar
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

    // Helper seguro para salvar item com PDF original no Supabase Storage e persistência no banco
    const saveItemToDatabaseAndBlob = async (it: InvoiceItem) => {
      const clientName = it.extractedData?.selectedClient?.name || 'Cliente';
      const cnpj = it.extractedData?.selectedClient?.cnpj || '';
      const clean = it.extractedData?.selectedClient?.cleanCnpj || '';
      const val = it.extractedData?.valorTotal || 0;

      // 1. Garante upload do PDF original para o Supabase Storage Privado
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
          console.warn('Erro ao assegurar upload do original ao Supabase Storage:', storageErr);
        }
      }

      // 2. Caminho seguro de nuvem (NUNCA usa caminhos locais como /Users/.../Downloads/)
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
        // Campos legados para compatibilidade
        blobUrl: storageUrl,
        blobPathname: storagePath,
        blobViewUrl: storageViewUrl,
        blobDownloadUrl: storageDownloadUrl,
        blobStorageName: storageBucket,
        status: 'PROCESSADO',
        identificationMethod: it.extractedData?.identificationMethod || 'IDENTIFICACAO_AUTOMATICA',
        diagnosticSummary: it.extractedData?.diagnosticNotes || 'Organizado e persistido no Supabase',
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
          `Sucesso! ${result.successCount} notas foram salvas e organizadas diretamente nas subpastas e sincronizadas com o Supabase Storage Privado.`
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
          `Download concluído! Arquivo ZIP gerado contendo todas as subpastas estruturadas e sincronizadas com o Supabase Storage Privado.`
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

  const currentStep =
    invoiceItems.length === 0
      ? 1
      : invoiceItems.some((i) => i.extractedData === null)
      ? 2
      : 3;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Top Header Simplificado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Processar Notas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Selecione a pasta, analise as notas e crie as subpastas automaticamente.
          </p>
        </div>

        <button
          id="btn-load-sample-invoices"
          onClick={handleLoadSamples}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Testar com Notas de Exemplo
        </button>
      </div>

      {/* Fluxo Visual em 3 Passos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Passo 1 */}
        <div
          onClick={handlePickFolder}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
            isDragOver
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
              : sourceFiles.length > 0
              ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/30 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/50'
              : 'border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                sourceFiles.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {sourceFiles.length > 0 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Selecionar Pasta
              </span>
            </div>
            <FolderOpen className={`w-5 h-5 ${sourceFiles.length > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
          </div>

          <div>
            {sourceFiles.length > 0 ? (
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{sourceDirName}</p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  {sourceFiles.length} notas PDF encontradas na raiz
                </p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300 text-xs">Clique para escolher a pasta</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">ou arraste os PDFs para cá</p>
              </div>
            )}
          </div>
        </div>

        {/* Passo 2 */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
          currentStep === 2 && !isAnalyzing
            ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                invoiceItems.length > 0 && invoiceItems.every((i) => i.extractedData !== null)
                  ? 'bg-emerald-600 text-white'
                  : currentStep === 2
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {invoiceItems.length > 0 && invoiceItems.every((i) => i.extractedData !== null) ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  '2'
                )}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Analisar Dados
              </span>
            </div>
            <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>

          <div>
            <button
              id="btn-analyze-invoices"
              disabled={invoiceItems.length === 0 || isAnalyzing}
              onClick={handleAnalyzeNotes}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisando ({analyzedCount}/{totalToAnalyze})...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Analisar {invoiceItems.length > 0 ? `(${invoiceItems.length} Notas)` : ''}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Passo 3 */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
          processedSuccessCount > 0
            ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                invoiceItems.some((i) => i.status === 'PROCESSADO')
                  ? 'bg-emerald-600 text-white'
                  : processedSuccessCount > 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}>
                {invoiceItems.some((i) => i.status === 'PROCESSADO') ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  '3'
                )}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Organizar Subpastas
              </span>
            </div>
            <Archive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div>
            <button
              id="btn-execute-organize"
              disabled={processedSuccessCount === 0 || isExporting || isAnalyzing}
              onClick={handleExecuteOrganization}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Criando Pastas...
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5" /> Criar Pastas & Salvar {processedSuccessCount > 0 ? `(${processedSuccessCount})` : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden inputs para compatibilidade de arquivos */}
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
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-blue-900 dark:text-blue-200">
              Analisando {analyzedCount} de {totalToAnalyze} notas...
            </span>
            <span className="text-blue-700 dark:text-blue-300 font-mono text-[11px] truncate max-w-xs">
              {currentProcessingFile}
            </span>
          </div>
          <div className="w-full h-2 bg-blue-200 dark:bg-blue-900/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-200"
              style={{
                width: `${(analyzedCount / Math.max(1, totalToAnalyze)) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Feedback de Sucesso */}
      {exportSuccessMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
          <button
            onClick={() => setExportSuccessMessage(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alerta de Revisão Pendente */}
      {pendingReviewItems.length > 0 && !isAnalyzing && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>{pendingReviewItems.length} nota(s)</strong> precisam de confirmação rápida do cliente.
            </span>
          </div>
          <button
            id="btn-open-review-modal"
            onClick={() => setReviewModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            Revisar Agora
          </button>
        </div>
      )}

      {/* Tabela de Notas */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Notas Encontradas
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
              {invoiceItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {processedSuccessCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                {processedSuccessCount} Prontas
              </span>
            )}
            {pendingReviewItems.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                {pendingReviewItems.length} Pendentes
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-5">Arquivo</th>
                <th className="py-3 px-5">Destino (Subpasta)</th>
                <th className="py-3 px-5">Cliente</th>
                <th className="py-3 px-5">Número</th>
                <th className="py-3 px-5">Data</th>
                <th className="py-3 px-5">Valor</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {invoiceItems.length > 0 ? (
                invoiceItems.map((item) => {
                  const clientName =
                    item.extractedData?.selectedClient?.name || 'Pendente';
                  const num = item.extractedData?.numeroNota || '-';
                  const data = item.extractedData?.dataEmissao || '-';
                  const valor = item.extractedData?.valorTotalFormatted || '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-5">
                        <div className="max-w-[180px] truncate">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block truncate" title={item.originalFileName}>
                            {item.originalFileName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] block truncate max-w-[180px]" title={item.targetFolderPath}>
                          {item.targetFolderPath}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-semibold text-slate-800 dark:text-slate-200">
                        {clientName}
                      </td>
                      <td className="py-3 px-5 font-mono text-slate-700 dark:text-slate-300">{num}</td>
                      <td className="py-3 px-5 text-slate-600 dark:text-slate-400">{data}</td>
                      <td className="py-3 px-5 font-bold text-emerald-700 dark:text-emerald-400">{valor}</td>
                      <td className="py-3 px-5">
                        {item.status === 'PROCESSADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Salvo
                          </span>
                        ) : item.status === 'IDENTIFICADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300">
                            <CheckCircle2 className="w-3 h-3" /> Pronto
                          </span>
                        ) : item.status === 'REVISAR' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="w-3 h-3" /> Revisar
                          </span>
                        ) : item.status === 'ERRO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300">
                            <XCircle className="w-3 h-3" /> Erro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <Clock className="w-3 h-3" /> Aguardando
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-view-pdf-proc-${item.id}`}
                            onClick={() => setSelectedPdfToView(item)}
                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Visualizar PDF original no Vercel Blob"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Visualizar PDF</span>
                          </button>
                          <button
                            id={`btn-view-detail-${item.id}`}
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                            title="Ver detalhes da nota"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 dark:text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-xs">Nenhuma nota selecionada.</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Clique no Passo 1 para selecionar a pasta do seu computador.
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

      {/* Visualizador do PDF Original no Vercel Blob */}
      {selectedPdfToView && (
        <PdfViewerModal
          item={selectedPdfToView}
          onClose={() => setSelectedPdfToView(null)}
        />
      )}
    </div>
  );
};
