import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  FolderInput,
  FolderOutput,
  Play,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Archive,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  ShieldCheck,
  FolderTree,
  Filter,
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
  // Modo de operação: 'single_folder' (jogar notas na pasta de destino) ou 'separate_folders'
  const [folderMode, setFolderMode] = useState<'single_folder' | 'separate_folders'>('single_folder');

  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceDirName, setSourceDirName] = useState<string>('Nenhuma pasta selecionada');
  const [targetDirName, setTargetDirName] = useState<string>('Mesma pasta (Criação de subpastas na raiz)');
  const [targetDirHandle, setTargetDirHandle] = useState<any>(null);
  const [skippedSubfolderFilesCount, setSkippedSubfolderFilesCount] = useState<number>(0);
  const [removeRootAfterOrganize, setRemoveRootAfterOrganize] = useState<boolean>(false);

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

  // Manipulador de seleção de múltiplos arquivos PDF soltos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const pdfs = Array.from(e.target.files).filter(
        (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );
      setSkippedSubfolderFilesCount(0);
      setSourceFiles(pdfs);
      setSourceDirName(`${pdfs.length} arquivo(s) PDF`);
      prepareItems(pdfs);
    }
  };

  // Manipulador de pasta (HTML input com filtro estrito de raiz)
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files);
      const rootPdfs: File[] = [];
      let skippedInSubfolders = 0;

      for (const file of allFiles) {
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          const relPath = (file as any).webkitRelativePath || '';
          if (relPath) {
            const parts = relPath.split('/');
            // Apenas arquivo filho direto da pasta selecionada (ex: "MinhaPasta/nota.pdf" -> 2 partes)
            if (parts.length === 2) {
              rootPdfs.push(file);
            } else {
              skippedInSubfolders++;
            }
          } else {
            rootPdfs.push(file);
          }
        }
      }

      const firstPath = (allFiles[0] as any).webkitRelativePath || '';
      const folderName = firstPath.split('/')[0] || 'Pasta Selecionada';

      setSkippedSubfolderFilesCount(skippedInSubfolders);
      setSourceFiles(rootPdfs);
      setSourceDirName(`${folderName} (${rootPdfs.length} PDFs na raiz)`);
      if (folderMode === 'single_folder') {
        setTargetDirName(`${folderName} (Criará subpastas na raiz)`);
      }
      prepareItems(rootPdfs);
    }
  };

  // Seleção nativa da pasta via File System Access API (Lê APENAS arquivos da raiz, ignorando subpastas)
  const handlePickDirectoryNative = async (isSingleFolderDestination: boolean) => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });

        const rootPdfs: File[] = [];
        let subfoldersCount = 0;

        // Itera estritamente na raiz do diretório (não entra nas subpastas)
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.pdf')) {
            const file = await entry.getFile();
            rootPdfs.push(file);
          } else if (entry.kind === 'directory') {
            subfoldersCount++;
          }
        }

        setSkippedSubfolderFilesCount(subfoldersCount);
        setSourceFiles(rootPdfs);
        setSourceDirName(`${dirHandle.name} (${rootPdfs.length} PDFs na raiz)`);
        setTargetDirHandle(dirHandle);

        if (isSingleFolderDestination || folderMode === 'single_folder') {
          setTargetDirName(`[Diretório do Disco] ${dirHandle.name}`);
        }

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

  // Seleção nativa de pasta de destino separada
  const handlePickTargetDirectoryNative = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({
          mode: 'readwrite',
        });
        setTargetDirHandle(dirHandle);
        setTargetDirName(`[Diretório do Disco] ${dirHandle.name}`);
      } else {
        setTargetDirName('Download em Pacote ZIP Estruturado');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setTargetDirName('Download em Pacote ZIP Estruturado');
      }
    }
  };

  // Carregar exemplos de notas fiscais reais para teste imediato
  const handleLoadSamples = () => {
    const samples = generateSampleInvoiceFiles();
    setSkippedSubfolderFilesCount(0);
    setSourceFiles(samples);
    setSourceDirName(`Amostras Fiscais de Demonstração (5 PDFs Reais)`);
    if (folderMode === 'single_folder') {
      setTargetDirName('Pacote ZIP / Pasta Selecionada');
    }
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

  // Analisar Notas com extração semântica profunda
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
        // Analisa PDF de forma semântica estruturada
        const extracted = await analyzeInvoicePDF(current.file);

        // Gera nomenclatura segura e caminho de pastas
        const generatedFileName = generateInvoiceFileName(extracted);
        const { folderPath } = generateTargetFolderPath(extracted, settings);

        let status: InvoiceItem['status'] = 'IDENTIFICADO';
        let statusMessage = '';

        if (extracted.needsOcr) {
          status = 'REVISAR';
          statusMessage = 'PDF sem camada de texto (Necessita OCR)';
        } else if (
          extracted.identificationMethod === 'NAO_IDENTIFICADO' ||
          !extracted.selectedClient
        ) {
          status = 'REVISAR';
          statusMessage = 'Cliente não identificado / Ambiguidade';
        } else if (!extracted.selectedClient.isPreRegistered && settings.autoRegisterNewClients) {
          db.addOrUpdateClient({
            cnpj: extracted.selectedClient.cleanCnpj,
            customName: extracted.selectedClient.name,
          });
          status = 'IDENTIFICADO';
          statusMessage = 'Novo cliente cadastrado automaticamente';
        } else if (!extracted.selectedClient.isPreRegistered) {
          status = 'REVISAR';
          statusMessage = 'Nova empresa identificada (Aguardando confirmação)';
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
          statusMessage: err.message || 'Falha na leitura do PDF',
        };
      }

      setAnalyzedCount(i + 1);
      setInvoiceItems([...updatedItems]);
    }

    // Resolve duplicidades em lote com sufixos _01, _02
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

  // Salva revisão manual de um item
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
          diagnosticNotes: 'Confirmado manualmente pelo operador no Modo de Revisão.',
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
          diagnosticNotes: `Cliente "${updatedData.clientName}" verificado e confirmado manualmente.`,
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

  // Executar organização e criação de novas subpastas
  const handleExecuteOrganization = async () => {
    if (invoiceItems.length === 0) return;

    setIsExporting(true);
    setExportSuccessMessage(null);

    const itemsToExport = invoiceItems.filter(
      (it) => it.status === 'IDENTIFICADO' || it.status === 'PROCESSADO'
    );

    if (itemsToExport.length === 0) {
      alert('Nenhuma nota identificada pronta para processamento. Revise os itens pendentes.');
      setIsExporting(false);
      return;
    }

    try {
      if (targetDirHandle) {
        // Gravação direta criando subpastas na pasta selecionada
        const result = await saveOrganizedFilesToDirectoryHandle(
          targetDirHandle,
          itemsToExport.map((it) => ({
            file: it.file,
            targetFolderPath: it.targetFolderPath,
            finalFileName: it.generatedFileName,
            originalFileName: it.originalFileName,
          })),
          undefined,
          { removeRootOriginalAfterOrganize: removeRootAfterOrganize && folderMode === 'single_folder' }
        );

        setExportSuccessMessage(
          `Sucesso! ${result.successCount} notas foram organizadas em novas subpastas criadas dentro de "${targetDirHandle.name}".`
        );
      } else {
        // Empacotamento em ZIP com a hierarquia completa de pastas
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
          `Sucesso! ${itemsToExport.length} notas foram organizadas no pacote ZIP estruturado (MÊS / CLIENTE).`
        );
      }

      // Registra no histórico permanente e atualiza estatísticas de clientes
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

      // Atualiza status local
      setInvoiceItems((prev) =>
        prev.map((item) => {
          if (itemsToExport.some((exp) => exp.id === item.id)) {
            return { ...item, status: 'PROCESSADO', statusMessage: 'Cópia organizada na subpasta' };
          }
          return item;
        })
      );

      onProcessingCompleted();
    } catch (err: any) {
      console.error('Erro na exportação:', err);
      alert('Erro ao gravar arquivos: ' + err.message);
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
  const errorItemsCount = invoiceItems.filter((item) => item.status === 'ERRO').length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <FolderTree className="w-6 h-6 text-blue-600" /> Processamento e Organização de Notas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analisa notas soltas na raiz da pasta e cria automaticamente as subpastas por Ano / Mês / Cliente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="btn-load-sample-invoices"
            onClick={handleLoadSamples}
            className="px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-600" /> Carregar 5 Notas de Exemplo
          </button>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-200/80 rounded-2xl w-fit">
        <button
          onClick={() => setFolderMode('single_folder')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            folderMode === 'single_folder'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderOutput className="w-4 h-4" /> Jogar Notas na Pasta de Destino (Pasta Única)
        </button>
        <button
          onClick={() => setFolderMode('separate_folders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            folderMode === 'separate_folders'
              ? 'bg-white text-blue-600 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FolderInput className="w-4 h-4" /> Pastas Separadas (Origem → Destino)
        </button>
      </div>

      {/* Directory Selector Bar */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-5">
        {/* Info Banner on Root Scanning Rule */}
        <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-xs flex items-start gap-3">
          <Filter className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">Filtro Estrito da Raiz da Pasta:</span>
            <p className="text-blue-800 leading-relaxed">
              O sistema lê <strong>apenas os arquivos PDF que estão soltos na raiz</strong> da pasta selecionada. Arquivos que já se encontram dentro de subpastas existentes (ex: <code className="bg-blue-100 px-1 py-0.5 rounded">2026/09 - SETEMBRO/...</code>) são automaticamente <strong>ignorados</strong> para evitar reprocessamento ou duplicidades.
            </p>
          </div>
        </div>

        {folderMode === 'single_folder' ? (
          /* Modo Pasta Única: onde o usuário joga as notas soltas */
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-blue-600" /> Pasta Principal / Destino das Notas
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Selecione a pasta onde você joga as novas notas fiscais não processadas.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-pick-single-folder"
                  onClick={() => handlePickDirectoryNative(true)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" /> Selecionar Pasta no Computador
                </button>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 truncate">{sourceDirName}</span>
              {sourceFiles.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold shrink-0">
                  {sourceFiles.length} PDFs soltos na raiz
                </span>
              )}
            </div>

            {skippedSubfolderFilesCount > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {skippedSubfolderFilesCount} subpastas/arquivos já organizados foram preservados e ignorados na análise.
                </span>
              </div>
            )}

            {/* Toggle de limpeza opcional da raiz */}
            <div className="pt-2 border-t border-slate-200 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="check-remove-root-file"
                checked={removeRootAfterOrganize}
                onChange={(e) => setRemoveRootAfterOrganize(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="check-remove-root-file" className="text-xs text-slate-600 cursor-pointer">
                <span className="font-bold text-slate-800 block">
                  Mover da raiz para a subpasta (remover o arquivo solto da raiz após criar a cópia organizada)
                </span>
                Mantém a raiz da sua pasta limpa, contendo apenas as subpastas organizadas.
              </label>
            </div>
          </div>
        ) : (
          /* Modo Pastas Separadas */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PASTA DE ORIGEM */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderInput className="w-4 h-4 text-blue-600" /> Pasta de Origem (Lê apenas raiz)
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {sourceFiles.length} PDFs na raiz
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={sourceDirName}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 truncate"
                />
                <button
                  id="btn-pick-source-folder"
                  onClick={() => handlePickDirectoryNative(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Selecionar
                </button>
              </div>
            </div>

            {/* PASTA DE DESTINO */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOutput className="w-4 h-4 text-emerald-600" /> Pasta de Destino (Subpastas)
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {targetDirHandle ? 'Gravação Direta' : 'ZIP Estruturado'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={targetDirName}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 truncate"
                />
                <button
                  id="btn-pick-target-folder"
                  onClick={handlePickTargetDirectoryNative}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Selecionar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hidden inputs for browser file input compatibility */}
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

        {/* Action Trigger Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              id="btn-analyze-invoices"
              disabled={invoiceItems.length === 0 || isAnalyzing}
              onClick={handleAnalyzeNotes}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Analisando PDFs...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" /> ANALISAR NOTAS ({invoiceItems.length})
                </>
              )}
            </button>

            {pendingReviewItems.length > 0 && !isAnalyzing && (
              <button
                id="btn-open-review-modal"
                onClick={() => setReviewModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 transition-all flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" /> Revisar Pendentes ({pendingReviewItems.length})
              </button>
            )}
          </div>

          {processedSuccessCount > 0 && !isAnalyzing && (
            <button
              id="btn-execute-organize"
              disabled={isExporting}
              onClick={handleExecuteOrganization}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition-all flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Organizando e Criando Subpastas...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" /> CRIAR SUBPASTAS & ORGANIZAR ({processedSuccessCount})
                </>
              )}
            </button>
          )}
        </div>

        {/* Progress Bar while analyzing */}
        {isAnalyzing && (
          <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-blue-900">
                Processando... {analyzedCount} de {totalToAnalyze} notas da raiz
              </span>
              <span className="text-blue-700 font-medium truncate max-w-xs">
                {currentProcessingFile}
              </span>
            </div>
            <div className="w-full h-2.5 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{
                  width: `${(analyzedCount / Math.max(1, totalToAnalyze)) * 100}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-blue-800 pt-1">
              <span>Processadas: {processedSuccessCount}</span>
              <span>Pendentes: {pendingReviewItems.length}</span>
              <span>Erros: {errorItemsCount}</span>
            </div>
          </div>
        )}

        {/* Export Success Message */}
        {exportSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Tabela de Notas Analisadas
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Conferência dos dados e da subpasta de destino que será criada dentro da pasta principal
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              Prontas: {processedSuccessCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              Revisão: {pendingReviewItems.length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Arquivo Original / Renomeado</th>
                <th className="py-3.5 px-6">Subpasta a Criar</th>
                <th className="py-3.5 px-6">Cliente Identificado</th>
                <th className="py-3.5 px-6">CNPJ</th>
                <th className="py-3.5 px-6">Número</th>
                <th className="py-3.5 px-6">Data</th>
                <th className="py-3.5 px-6">Valor</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoiceItems.length > 0 ? (
                invoiceItems.map((item) => {
                  const clientName =
                    item.extractedData?.selectedClient?.name || 'Não Identificado';
                  const cnpj = item.extractedData?.selectedClient?.cnpj || '-';
                  const num = item.extractedData?.numeroNota || '-';
                  const data = item.extractedData?.dataEmissao || '-';
                  const valor = item.extractedData?.valorTotalFormatted || 'R$ 0,00';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="max-w-xs truncate">
                          <span className="font-bold text-slate-900 block truncate" title={item.originalFileName}>
                            {item.originalFileName}
                          </span>
                          {item.generatedFileName !== item.originalFileName && (
                            <span className="text-[11px] text-blue-600 font-mono block truncate" title={item.generatedFileName}>
                              Novo: {item.generatedFileName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-mono text-[11px] font-semibold block truncate max-w-[200px]" title={item.targetFolderPath}>
                          {item.targetFolderPath}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{clientName}</span>
                          {item.extractedData?.selectedClient?.isPreRegistered && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Cadastrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-600">{cnpj}</td>
                      <td className="py-3.5 px-6 font-mono font-semibold text-slate-800">{num}</td>
                      <td className="py-3.5 px-6 text-slate-600">{data}</td>
                      <td className="py-3.5 px-6 font-bold text-emerald-700">{valor}</td>
                      <td className="py-3.5 px-6">
                        {item.status === 'PROCESSADO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" /> Processado
                          </span>
                        ) : item.status === 'IDENTIFICADO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                            <CheckCircle2 className="w-3 h-3" /> Identificado
                          </span>
                        ) : item.status === 'REVISAR' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Revisar
                          </span>
                        ) : item.status === 'ERRO' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3" /> Erro
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-view-detail-${item.id}`}
                            onClick={() => setSelectedDetailItem(item)}
                            title="Ver Detalhes e Texto do PDF"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
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
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Nenhum arquivo na fila de processamento.</p>
                    <p className="text-[11px] mt-1">
                      Selecione a pasta onde você jogou as notas fiscais em PDF ou clique em &quot;Carregar 5 Notas de Exemplo&quot;.
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
