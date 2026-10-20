import React, { useState, useMemo } from 'react';
import {
  FileText,
  FileCheck2,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Building2,
  Eye,
  CheckCircle2,
  FolderOpen,
  FolderUp,
  FileSpreadsheet,
  CalendarDays,
  DollarSign,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { PdfViewerModal } from './PdfViewerModal';
import { groupHistoryByMonth, formatBRL } from '../utils/monthUtils';

interface DashboardProps {
  totalNotesLifetime: number;
  processedNotesLifetime: number;
  pendingNotesCount: number;
  clientsCount: number;
  recentHistory: HistoryRecord[];
  onNavigateTab: (tab: 'dashboard' | 'monthly' | 'taxes' | 'process' | 'upload' | 'clients' | 'history' | 'settings') => void;
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

  // Agrupamento por mês para organização e fechamento mensal
  const monthlyGroups = useMemo(() => {
    return groupHistoryByMonth(recentHistory);
  }, [recentHistory]);

  const totalRevenueLifetime = useMemo(() => {
    return recentHistory.reduce((sum, h) => sum + (h.invoiceValue || 0), 0);
  }, [recentHistory]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PROCESSADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Processado
          </span>
        );
      case 'REVISAR':
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Revisão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Erro
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
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Visão consolidada de notas fiscais, faturamento acumulado e fechamento mensal.
          </p>
        </div>

        {/* Ações Rápidas Discretas */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-dash-load-samples"
            onClick={onLoadSamples}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            title="Carregar notas de exemplo para teste rápido"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>Exemplos</span>
          </button>

          <button
            id="btn-dash-upload-data"
            onClick={() => onNavigateTab('upload')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <FolderUp className="w-3.5 h-3.5 text-slate-500" />
            <span>Subir dados</span>
          </button>

          <button
            id="btn-dash-start-process"
            onClick={() => onNavigateTab('process')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Processar notas</span>
          </button>
        </div>
      </div>

      {/* Hero Card com Métricas e Ícones Coloridos */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Faturamento Total (Verde / Esmeralda) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Faturamento acumulado
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {formatBRL(totalRevenueLifetime)}
            </div>
            <div className="text-[11px] text-slate-400">
              Volume total de notas emitidas
            </div>
          </div>

          {/* Total de Notas (Azul) */}
          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Total de notas
              </span>
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 font-mono tabular-nums">
              {totalNotesLifetime}
            </div>
            <div className="text-[11px] text-slate-400">
              {processedNotesLifetime} processadas com sucesso
            </div>
          </div>

          {/* Notas para Revisão (Âmbar) */}
          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Pendentes / Revisão
              </span>
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-extrabold font-mono tabular-nums ${pendingNotesCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {pendingNotesCount}
            </div>
            <div className="text-[11px] text-slate-400">
              {pendingNotesCount > 0 ? 'Requerem verificação' : 'Nenhuma pendência'}
            </div>
          </div>

          {/* Clientes Cadastrados (Roxo / Violeta) */}
          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                Clientes ativos
              </span>
              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300 font-mono tabular-nums">
              {clientsCount}
            </div>
            <div className="text-[11px] text-slate-400">
              CNPJs vinculados no sistema
            </div>
          </div>
        </div>
      </div>

      {/* Seção Fechamento Mensal */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Fechamento Mensal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Faturamento e volume emitido por competência
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-dash-open-taxes-tab"
              onClick={() => onNavigateTab('taxes')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Calcular impostos</span>
            </button>

            <button
              id="btn-dash-open-monthly-tab"
              onClick={() => onNavigateTab('monthly')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Ver todos</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {monthlyGroups.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthlyGroups.slice(0, 3).map((group, idx) => (
              <div
                key={group.monthKey}
                onClick={() => onNavigateTab('monthly')}
                className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                  idx === 0
                    ? 'bg-gradient-to-br from-blue-50/50 to-white dark:from-slate-900 dark:to-slate-900/90 border-blue-200 dark:border-blue-900/60 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                    {group.label}
                  </span>
                  {idx === 0 && (
                    <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                      Mais recente
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Faturamento</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                      {group.totalValueFormatted}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">Notas</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                      {group.totalInvoices}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <span>Ticket médio: <strong className="font-mono text-slate-600 dark:text-slate-400 font-medium">{group.averageValueFormatted}</strong></span>
                  <span className="group-hover:translate-x-0.5 transition-transform text-slate-500">
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center text-slate-400 text-xs">
            Nenhuma competência mensal identificada. Processe notas para visualizar o fechamento automático.
          </div>
        )}
      </div>

      {/* Tabela de Últimos Arquivos Processados */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Últimos Arquivos Processados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Notas fiscais recentemente registradas no sistema
            </p>
          </div>

          {recentHistory.length > 0 && (
            <button
              onClick={() => onNavigateTab('history')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Ver todas ({recentHistory.length})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Arquivo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4">Emissão</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentHistory.length > 0 ? (
                  recentHistory.slice(0, 6).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-medium text-slate-900 dark:text-slate-100 block truncate" title={item.generatedFileName}>
                          {item.generatedFileName}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate" title={item.originalFileName}>
                          {item.originalFileName}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[200px]">
                          {item.clientName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block">{item.cnpj}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {item.invoiceValueFormatted}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 tabular-nums font-mono text-[11px]">
                        {item.invoiceDate}
                      </td>
                      <td className="py-3 px-4">
                        {getStatusText(item.status)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-dash-view-pdf-${item.id}`}
                            onClick={() => setSelectedPdfToView(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Visualizar PDF"
                          >
                            <FileText className="w-3 h-3 text-rose-500" /> PDF
                          </button>
                          <button
                            id={`btn-dash-view-detail-${item.id}`}
                            onClick={() => onViewInvoiceDetails(item)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-blue-500" /> Detalhes
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <FileText className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="font-medium text-xs">Nenhum arquivo processado ainda.</p>
                      <p className="text-[11px] mt-0.5">
                        Utilize a aba &quot;Processar notas&quot; ou clique em &quot;Exemplos&quot; para testar.
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
