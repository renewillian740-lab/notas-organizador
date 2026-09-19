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
} from 'lucide-react';
import { InvoiceItem, HistoryRecord } from '../types';

interface InvoiceDetailModalProps {
  item: InvoiceItem | HistoryRecord | null;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ item, onClose }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'rawText'>('details');

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
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'CNPJ_CONTEXTO':
        return {
          label: 'CNPJ + CONTEXTO (TOMADOR/DESTINATÁRIO)',
          desc: 'Identificado através de análise contextual de entidades no texto da nota fiscal.',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'IDENTIFICACAO_AUTOMATICA':
        return {
          label: 'IDENTIFICAÇÃO AUTOMÁTICA',
          desc: 'Identificado pelo CNPJ único presente no documento.',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
        };
      case 'CONFIRMACAO_MANUAL':
        return {
          label: 'CONFIRMAÇÃO MANUAL',
          desc: 'Definido ou confirmado manualmente pelo operador.',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
        };
      default:
        return {
          label: 'NÃO IDENTIFICADO / AMBÍGUO',
          desc: 'Documento necessita de revisão ou OCR.',
          color: 'bg-amber-100 text-amber-800 border-amber-300',
        };
    }
  };

  const badgeInfo = getMethodBadge(method);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div
        id="modal-invoice-details"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Detalhes da Nota Fiscal</h2>
              <p className="text-xs text-slate-500 font-mono truncate max-w-md">{originalFileName}</p>
            </div>
          </div>
          <button
            id="btn-close-invoice-modal"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            id="tab-btn-details"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Dados Estruturados & Diagnóstico
          </button>
          <button
            id="tab-btn-raw"
            onClick={() => setActiveTab('rawText')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'rawText'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
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
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/70">
                        {badgeInfo.label}
                      </span>
                    </div>
                    <p className="text-xs mt-1 font-medium opacity-90">{diagnosticNotes || badgeInfo.desc}</p>
                  </div>
                </div>
              </div>

              {/* Grid of structured data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Cliente & Identificação
                  </h3>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Cliente Identificado</span>
                    <span className="text-sm font-bold text-slate-900">{clientName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">CNPJ do Cliente</span>
                    <span className="text-xs font-mono font-semibold text-slate-700">{cnpj}</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" /> Informações Fiscais
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Número da Nota</span>
                      <span className="text-sm font-bold text-slate-900 font-mono">{numeroNota}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Data de Emissão</span>
                      <span className="text-sm font-semibold text-slate-900">{dataEmissao}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Valor Total</span>
                    <span className="text-base font-extrabold text-emerald-700">{valorFormatted}</span>
                  </div>
                </div>
              </div>

              {/* Prestador & Tomador */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Entidades Envolvidas
                </h3>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-600">Prestador / Emitente:</span>{' '}
                    <span className="text-slate-800">{prestadorStr}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Tomador / Destinatário:</span>{' '}
                    <span className="text-slate-800">{tomadorStr}</span>
                  </div>
                </div>
              </div>

              {/* File details & names */}
              <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                  Arquivos & Nomenclatura
                </h3>
                <div>
                  <span className="text-slate-500 block text-[11px]">Arquivo Original (Intacto):</span>
                  <span className="font-mono text-slate-800 font-medium break-all">{originalFileName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Nome Padronizado Gerado:</span>
                  <span className="font-mono font-bold text-blue-700 break-all">{generatedFileName}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Texto Extraído da Camada de Dados do PDF:</span>
                <span className="text-[11px] text-slate-400 font-mono">{rawText.length} caracteres</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono leading-relaxed overflow-x-auto max-h-96 whitespace-pre-wrap select-text">
                {rawText || 'Nenhum texto pesquisável foi encontrado neste PDF (possível documento digitalizado/imagem).'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            id="btn-close-modal-bottom"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 text-slate-800 hover:bg-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
