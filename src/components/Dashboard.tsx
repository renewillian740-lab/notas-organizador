import React, { useState } from 'react';
import {
  FileText,
  FileCheck2,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
  Sparkles,
  ShieldCheck,
  Eye,
  CheckCircle2,
  FolderOpen,
  FolderUp,
  FileSpreadsheet,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { PdfViewerModal } from './PdfViewerModal';

interface DashboardProps {
  totalNotesLifetime: number;
  processedNotesLifetime: number;
  pendingNotesCount: number;
  clientsCount: number;
  recentHistory: HistoryRecord[];
  onNavigateTab: (tab: 'dashboard' | 'process' | 'upload' | 'clients' | 'history' | 'settings') => void;
  onViewInvoiceDetails: (record: HistoryRecord) => void;
  onLoadSamples: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  totalNotesLifetime,
  processedNotesLifetime,
  pendingNotesCount,
  clientsCount,
  recentHistory,
  onNavigateTab,
  onViewInvoiceDetails,
  onLoadSamples,
}) => {
  const [selectedPdfToView, setSelectedPdfToView] = useState<HistoryRecord | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROCESSADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Processado
          </span>
        );
      case 'REVISAR':
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Revisão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300">
            Erro
          </span>
        );
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Top Banner & Quick Trigger */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-900 dark:to-slate-950 p-6 rounded-3xl text-white shadow-xl shadow-slate-900/10 border border-slate-700/60">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" /> Motor Semântico de Notas Fiscais
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Organizador Automático de NF-e & NFS-e</h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Extração estruturada de dados, identificação por CNPJ + contexto, e organização inteligente em pastas por Ano / Mês / Cliente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            id="btn-dash-load-samples"
            onClick={onLoadSamples}
            className="px-4 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-blue-400" /> Testar com Exemplos
          </button>
          <button
            id="btn-dash-upload-data"
            onClick={() => onNavigateTab('upload')}
            className="px-4 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FolderUp className="w-4 h-4 text-emerald-400" /> Subir Dados
          </button>
          <button
            id="btn-dash-start-process"
            onClick={() => onNavigateTab('process')}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Processar Notas <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* TOTAL DE NOTAS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Total de Notas
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {totalNotesLifetime}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium block mt-1">
              Documentos analisados no sistema
            </span>
          </div>
        </div>

        {/* NOTAS PROCESSADAS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Notas Processadas
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {processedNotesLifetime}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium block mt-1">
              Cópias renomeadas e organizadas
            </span>
          </div>
        </div>

        {/* PENDENTES / REVISÃO */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Pendentes / Revisão
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
              {pendingNotesCount}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium block mt-1">
              Documentos que requerem atenção
            </span>
          </div>
        </div>

        {/* CLIENTES CADASTRADOS */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
              Clientes Cadastrados
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
              {clientsCount}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium block mt-1">
              CNPJs vinculados a nomes personalizados
            </span>
          </div>
        </div>
      </div>

      {/* "Últimos arquivos processados" Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Últimos Arquivos Processados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Histórico das notas fiscais mais recentes organizadas pelo sistema
            </p>
          </div>
          {recentHistory.length > 0 && (
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 cursor-pointer"
            >
              Ver todos ({recentHistory.length}) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Nome do Arquivo</th>
                  <th className="py-3.5 px-6">Cliente</th>
                  <th className="py-3.5 px-6">Valor</th>
                  <th className="py-3.5 px-6">Data Emissão</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentHistory.length > 0 ? (
                  recentHistory.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="max-w-xs truncate">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block truncate" title={item.generatedFileName}>
                            {item.generatedFileName}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block truncate" title={item.originalFileName}>
                            Original: {item.originalFileName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.clientName}</span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block">{item.cnpj}</span>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-emerald-700 dark:text-emerald-400">
                        {item.invoiceValueFormatted}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{item.invoiceDate}</td>
                      <td className="py-3.5 px-6">{getStatusBadge(item.status)}</td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-dash-view-pdf-${item.id}`}
                            onClick={() => setSelectedPdfToView(item)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors inline-flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                            title="Visualizar PDF original no Vercel Blob"
                          >
                            <FileText className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button
                            id={`btn-dash-view-detail-${item.id}`}
                            onClick={() => onViewInvoiceDetails(item)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors inline-flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">Nenhum arquivo processado ainda.</p>
                      <p className="text-[11px] mt-1">
                        Selecione uma pasta com notas fiscais na aba &quot;Processar notas&quot; ou clique no botão de exemplos acima.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Visualização do PDF Original */}
      {selectedPdfToView && (
        <PdfViewerModal
          item={selectedPdfToView}
          onClose={() => setSelectedPdfToView(null)}
        />
      )}
    </div>
  );
};
