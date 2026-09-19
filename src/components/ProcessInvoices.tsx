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
import { generateSampleInvoiceFiles } from '../utils/samplePdfGenerator';
import { ReviewModal } from './ReviewModal';
import { InvoiceDetailModal } from './InvoiceDetailModal';

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
          if (relPath) {
            const parts = relPath.split('/');
            if (parts.length === 2) {
              rootPdfs.push(file);
            }
          } else {
            rootPdfs.push(file);
          }
        }
      }

      const firstPath = (allFiles[0] as any).webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || 'Pasta Selecionada';

      setSourceFiles(rootPdfs);
      setSourceDirName(folderName);
      prepareItems(rootPdfs);
    }
  };

  // Seleção nativa da pasta via File System Access API
  const handlePickFolder = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });

        const rootPdfs: File[] = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
            const file = await entry.getFile();
            rootPdfs.push(file);
          }
        }

        setSourceFiles(rootPdfs);
        setSourceDirName(dirHandle.name);
        setTargetDirHandle(dirHandle);
        prepareItems(rootPdfs);
      } else {
        folderInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        folderInputRef.current?.click();
      }
    }
  };

  // Drag and Drop de arquivos ou pasta
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const pdfs = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      if (pdfs.length > 0) {
        setSourceFiles(pdfs);
        setSourceDirName(`${pdfs.length} notas soltas`);
        prepareItems(pdfs);
      }
    }
  };

  // Carregar exemplos de notas fiscais reais
  const handleLoadSamples = () => {
    const samples = generateSampleInvoiceFiles();
    setSourceFiles(samples);
    setSourceDirName('Notas de Exemplo (Demonstração)');
    prepareItems(samples);
  };

  const prepareItems = (files: File[]) => {
    const items: InvoiceItem[] = files.map((file, idx) => ({
      id: `item_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
      file,
      originalFileName: file.name,
      originalFileSize: file.size,
      status: 'PENDENTE',
      extractedData: null,
      generatedFileName: file.name,
      targetFolderPath: 'Pendente',
      destinationFilePath: 'Pendente',
    }));
    setInvoiceItems(items);
    setExportSuccessMessage(null);
  };

  // Analisar Notas
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
        const generatedFileName = generateInvoiceFileName(extracted);
        const { folderPath } = generateTargetFolderPath(extracted, settings);

        let status: InvoiceItem['status'] = 'IDENTIFICADO';
        let statusMessage = '';

        if (extracted.needsOcr) {
          status = 'REVISAR';
          statusMessage = 'PDF sem texto (Necessita OCR)';
        } else if (
          extracted.identificationMethod === 'NAO_IDENTIFICADO' ||
          !extracted.selectedClient
        ) {
          status = 'REVISAR';
          statusMessage = 'Cliente não identificado';
        } else if (!extracted.selectedClient.isPreRegistered && settings.autoRegisterNewClients) {
          db.addOrUpdateClient({
            cnpj: extracted.selectedClient.cleanCnpj,
            customName: extracted.selectedClient.name,
          });
          status = 'IDENTIFICADO';
          statusMessage = 'Novo cliente cadastrado';
        } else if (!extracted.selectedClient.isPreRegistered) {
          status = 'REVISAR';
          statusMessage = 'Nova empresa (Aguardando confirmação)';
        }

        updatedItems[i] = {
          ...current,
          extractedData: extracted,
          generatedFileName,
          targetFolderPath: folderPath,
          destinationFilePath: `${folderPath}/${generatedFileName}`,
          status,
          statusMessage,
        };
      } catch (err: any) {
        console.error(`Erro ao analisar nota ${current.originalFileName}:`, err);
        updatedItems[i] = {
          ...current,
          status: 'ERRO',
          statusMessage: err.message || 'Falha na leitura',
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

        setExportSuccessMessage(
          `Pronto! ${result.successCount} notas foram organizadas nas subpastas de "${targetDirHandle.name}".`
        );
      } else {
        const zipBlob = await createOrganizedZipArchive(
          itemsToExport.map((it) => ({
            file: it.file,
            targetFolderPath: it.targetFolderPath,
            finalFileName: it.generatedFileName,
          }))
        );

        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Notas_Organizadas_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setExportSuccessMessage(
          `Pronto! ${itemsToExport.length} notas organizadas e baixadas no arquivo ZIP.`
        );
      }

      for (const item of itemsToExport) {
        if (item.extractedData) {
          db.addHistoryRecord({
            originalFileName: item.originalFileName,
            generatedFileName: item.generatedFileName,
            clientName: item.extractedData.selectedClient?.name || 'Não identificado',
            cnpj: item.extractedData.selectedClient?.cnpj || '-',
            cleanCnpj: item.extractedData.selectedClient?.cleanCnpj || '',
            invoiceNumber: item.extractedData.numeroNota,
            invoiceDate: item.extractedData.dataEmissao,
            invoiceValue: item.extractedData.valorTotal,
            invoiceValueFormatted: item.extractedData.valorTotalFormatted,
            status: 'PROCESSADO',
            identificationMethod: item.extractedData.identificationMethod,
            targetPath: item.destinationFilePath,
            diagnosticSummary: item.extractedData.diagnosticNotes,
            rawTextSnippet: item.extractedData.rawText.substring(0, 500),
          });

          if (item.extractedData.selectedClient?.cleanCnpj) {
            db.incrementClientStats(
              item.extractedData.selectedClient.cleanCnpj,
              item.extractedData.valorTotal
            );
          }
        }
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
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Simplificado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Processar Notas
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Selecione a pasta, analise as notas e crie as subpastas automaticamente.
          </p>
        </div>

        <button
          id="btn-load-sample-invoices"
          onClick={handleLoadSamples}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Testar com Notas de Exemplo
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
              ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
              : sourceFiles.length > 0
              ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/70'
              : 'border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                sourceFiles.length > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {sourceFiles.length > 0 ? <Check className="w-3.5 h-3.5" /> : '1'}
              </span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Selecionar Pasta
              </span>
            </div>
            <FolderOpen className={`w-5 h-5 ${sourceFiles.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
          </div>

          <div>
            {sourceFiles.length > 0 ? (
              <div>
                <p className="font-bold text-slate-900 text-sm truncate">{sourceDirName}</p>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  {sourceFiles.length} notas PDF encontradas na raiz
                </p>
              </div>
            ) : (
              <div>
                <p className="font-bold text-slate-700 text-xs">Clique para escolher a pasta</p>
                <p className="text-[11px] text-slate-400">ou arraste os PDFs para cá</p>
              </div>
            )}
          </div>
        </div>

        {/* Passo 2 */}
        <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
          currentStep === 2 && !isAnalyzing
            ? 'border-blue-300 bg-blue-50/50 shadow-xs'
            : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                invoiceItems.length > 0 && invoiceItems.every((i) => i.extractedData !== null)
                  ? 'bg-emerald-600 text-white'
                  : currentStep === 2
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {invoiceItems.length > 0 && invoiceItems.every((i) => i.extractedData !== null) ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  '2'
                )}
              </span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Analisar Dados
              </span>
            </div>
            <Play className="w-5 h-5 text-blue-600" />
          </div>

          <div>
            <button
              id="btn-analyze-invoices"
              disabled={invoiceItems.length === 0 || isAnalyzing}
              onClick={handleAnalyzeNotes}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
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
            ? 'border-emerald-300 bg-emerald-50/50 shadow-xs'
            : 'border-slate-200 bg-white'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                invoiceItems.some((i) => i.status === 'PROCESSADO')
                  ? 'bg-emerald-600 text-white'
                  : processedSuccessCount > 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}>
                {invoiceItems.some((i) => i.status === 'PROCESSADO') ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  '3'
                )}
              </span>
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Organizar Subpastas
              </span>
            </div>
            <Archive className="w-5 h-5 text-emerald-600" />
          </div>

          <div>
            <button
              id="btn-execute-organize"
              disabled={processedSuccessCount === 0 || isExporting || isAnalyzing}
              onClick={handleExecuteOrganization}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
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
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-blue-900">
              Analisando {analyzedCount} de {totalToAnalyze} notas...
            </span>
            <span className="text-blue-700 font-mono text-[11px] truncate max-w-xs">
              {currentProcessingFile}
            </span>
          </div>
          <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
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
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
          <button
            onClick={() => setExportSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Alerta de Revisão Pendente */}
      {pendingReviewItems.length > 0 && !isAnalyzing && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{pendingReviewItems.length} nota(s)</strong> precisam de confirmação rápida do cliente.
            </span>
          </div>
          <button
            id="btn-open-review-modal"
            onClick={() => setReviewModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-xs"
          >
            Revisar Agora
          </button>
        </div>
      )}

      {/* Tabela de Notas */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Notas Encontradas
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
              {invoiceItems.length}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {processedSuccessCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                {processedSuccessCount} Prontas
              </span>
            )}
            {pendingReviewItems.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                {pendingReviewItems.length} Pendentes
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100">
              {invoiceItems.length > 0 ? (
                invoiceItems.map((item) => {
                  const clientName =
                    item.extractedData?.selectedClient?.name || 'Pendente';
                  const num = item.extractedData?.numeroNota || '-';
                  const data = item.extractedData?.dataEmissao || '-';
                  const valor = item.extractedData?.valorTotalFormatted || '-';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5">
                        <div className="max-w-[180px] truncate">
                          <span className="font-bold text-slate-900 block truncate" title={item.originalFileName}>
                            {item.originalFileName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] block truncate max-w-[180px]" title={item.targetFolderPath}>
                          {item.targetFolderPath}
                        </span>
                      </td>
                      <td className="py-3 px-5 font-semibold text-slate-800">
                        {clientName}
                      </td>
                      <td className="py-3 px-5 font-mono text-slate-700">{num}</td>
                      <td className="py-3 px-5 text-slate-600">{data}</td>
                      <td className="py-3 px-5 font-bold text-emerald-700">{valor}</td>
                      <td className="py-3 px-5">
                        {item.status === 'PROCESSADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Salvo
                          </span>
                        ) : item.status === 'IDENTIFICADO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            <CheckCircle2 className="w-3 h-3" /> Pronto
                          </span>
                        ) : item.status === 'REVISAR' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Revisar
                          </span>
                        ) : item.status === 'ERRO' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3" /> Erro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            <Clock className="w-3 h-3" /> Aguardando
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          id={`btn-view-detail-${item.id}`}
                          onClick={() => setSelectedDetailItem(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Ver detalhes da nota"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold text-xs">Nenhuma nota selecionada.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
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
    </div>
  );
};
