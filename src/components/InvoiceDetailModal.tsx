import React, { useState } from 'react';
import {
  X,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  Hash,
  ShieldCheck,
  AlertCircle,
  FileCode,
  Eye,
  CheckCircle2,
  ExternalLink,
  Cloud,
} from 'lucide-react';
import { InvoiceItem, HistoryRecord } from '../types';
import { PdfViewerModal } from './PdfViewerModal';

interface InvoiceDetailModalProps {
  item: InvoiceItem | HistoryRecord | null;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ item, onClose }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'rawText'>('details');
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  if (!item) return null;

  const isInvoiceItem = 'file' in item;
  const originalFileName = item.originalFileName;
  const generatedFileName = item.generatedFileName;
  
  let clientName = '';
  let cnpj = '';
  let numeroNota = '';
  let dataEmissao = '';
  let valorFormatted = '';
  let status = item.status;
  let method = '';
  let diagnosticNotes = '';
  let prestadorStr = 'Não detectado';
  let tomadorStr = 'Não detectado';
  let rawText = '';

  if (isInvoiceItem) {
    const inv = item as InvoiceItem;
    clientName = inv.extractedData?.selectedClient?.name || 'Não identificado';
    cnpj = inv.extractedData?.selectedClient?.cnpj || '-';
    numeroNota = inv.extractedData?.numeroNota || 'S_N';
    dataEmissao = inv.extractedData?.dataEmissao || '-';
    valorFormatted = inv.extractedData?.valorTotalFormatted || 'R$ 0,00';
    method = inv.extractedData?.identificationMethod || 'NAO_IDENTIFICADO';
    diagnosticNotes = inv.extractedData?.diagnosticNotes || '';
    
    if (inv.extractedData?.prestador) {
      prestadorStr = `${inv.extractedData.prestador.razaoSocial || 'Prestador'} (CNPJ: ${inv.extractedData.prestador.cnpj})`;
    }
    if (inv.extractedData?.tomador) {
      tomadorStr = `${inv.extractedData.tomador.razaoSocial || 'Tomador'} (CNPJ: ${inv.extractedData.tomador.cnpj})`;
    } else if (inv.extractedData?.destinatario) {
      tomadorStr = `${inv.extractedData.destinatario.razaoSocial || 'Destinatário'} (CNPJ: ${inv.extractedData.destinatario.cnpj})`;
    }
    rawText = inv.extractedData?.rawText || '';
  } else {
    const hist = item as HistoryRecord;
    clientName = hist.clientName;
    cnpj = hist.cnpj;
    numeroNota = hist.invoiceNumber;
    dataEmissao = hist.invoiceDate;
    valorFormatted = hist.invoiceValueFormatted;
    method = hist.identificationMethod;
    diagnosticNotes = hist.diagnosticSummary;
    rawText = hist.rawTextSnippet || 'Texto bruto arquivado no histórico de processamento.';
  }

  const getMethodBadge = (m: string) => {
    switch (m) {
      case 'CLIENTE_CADASTRADO_POR_CNPJ':
        return {
          label: 'CLIENTE CADASTRADO POR CNPJ',
          desc: 'Identificado e validado diretamente no banco de clientes permanente.',
          color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        };
      case 'CNPJ_CONTEXTO':
        return {
          label: 'CNPJ + CONTEXTO (TOMADOR/DESTINATÁRIO)',
          desc: 'Identificado através de análise contextual de entidades no texto da nota fiscal.',
          color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
        };
      case 'IDENTIFICACAO_AUTOMATICA':
        return {
          label: 'IDENTIFICAÇÃO AUTOMÁTICA',
          desc: 'Entidade tomadora identificada por regras sintáticas e semânticas.',
          color: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
        };
      case 'CONFIRMACAO_MANUAL':
        return {
          label: 'CONFIRMADO PELO USUÁRIO',
          desc: 'Dados validados ou associados manualmente na etapa de revisão.',
          color: 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800',
        };
      default:
        return {
          label: 'NÃO IDENTIFICADO / PENDENTE',
          desc: 'Nenhum CNPJ ou entidade correspondente foi detectado com precisão suficiente.',
          color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        };
    }
  };

  const badgeInfo = getMethodBadge(method);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate max-w-md">
                {originalFileName}
              </h2>
              <span className="text-xs text-slate-400 font-mono block">
                Detalhes analíticos da nota fiscal
              </span>
            </div>
          </div>
          <button
            id="btn-close-invoice-modal"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900">
          <button
            id="tab-btn-details"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Dados Estruturados & Diagnóstico
          </button>
          <button
            id="tab-btn-raw"
            onClick={() => setActiveTab('rawText')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'rawText'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            Dados Extraídos do PDF (Texto Bruto)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'details' ? (
            <>
              {/* Method & Diagnostic Alert */}
              <div className={`p-4 rounded-xl border ${badgeInfo.color}`}>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider">
                        Método de Identificação:
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/70 dark:bg-slate-900/60">
                        {badgeInfo.label}
                      </span>
                    </div>
                    <p className="text-xs mt-1 font-medium opacity-90">{diagnosticNotes || badgeInfo.desc}</p>
                  </div>
                </div>
              </div>

              {/* Grid of structured data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Cliente & Identificação
                  </h3>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Cliente Identificado</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{clientName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">CNPJ do Cliente</span>
                    <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{cnpj}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Informações Fiscais
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Número da Nota</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">{numeroNota}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Data de Emissão</span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{dataEmissao}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Valor Total</span>
                    <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">{valorFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Prestador & Tomador */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Entidades Envolvidas
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Prestador / Emitente:</span>{' '}
                    <span className="text-slate-800 dark:text-slate-200">{prestadorStr}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600 dark:text-slate-400">Tomador / Destinatário:</span>{' '}
                    <span className="text-slate-800 dark:text-slate-200">{tomadorStr}</span>
                  </div>
                </div>
              </div>

              {/* File details & names */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs">
                <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                  Arquivos & Nomenclatura
                </h3>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Arquivo Original (Intacto):</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-medium break-all">{originalFileName}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Nome Padronizado Gerado:</span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400 break-all">{generatedFileName}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Texto Extraído da Camada de Dados do PDF:</span>
                <span className="text-[11px] text-slate-400 font-mono">{rawText.length} caracteres</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 dark:bg-slate-950 text-slate-200 text-xs font-mono leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap select-text border border-slate-800">
                {rawText || 'Nenhum texto pesquisável foi encontrado neste PDF (possível documento digitalizado/imagem).'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Supabase Storage Privado (notas-fiscais)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="btn-modal-view-original-pdf"
              onClick={() => setShowPdfViewer(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visualizar PDF Original</span>
            </button>

            <button
              id="btn-close-modal-bottom"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Modal Interno de Visualização do PDF Original */}
      {showPdfViewer && (
        <PdfViewerModal
          item={item}
          onClose={() => setShowPdfViewer(false)}
        />
      )}
    </div>
  );
};
