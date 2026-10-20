import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  DollarSign,
  FileText,
  TrendingUp,
  Download,
  Users,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Building2,
  Eye,
  Calculator,
  Search,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import {
  groupHistoryByMonth,
  MonthlyGroup,
  exportMonthlyGroupCSV,
  formatBRL,
} from '../utils/monthUtils';
import { PdfViewerModal } from './PdfViewerModal';

interface MonthlyOverviewPageProps {
  history: HistoryRecord[];
  onViewInvoiceDetails: (record: HistoryRecord) => void;
  onNavigateTab: (tab: 'dashboard' | 'process' | 'upload' | 'clients' | 'history' | 'settings' | 'monthly' | 'taxes') => void;
}

export const MonthlyOverviewPage: React.FC<MonthlyOverviewPageProps> = ({
  history,
  onViewInvoiceDetails,
  onNavigateTab,
}) => {
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('LATEST');
  const [searchInMonth, setSearchInMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPdfToView, setSelectedPdfToView] = useState<HistoryRecord | null>(null);

  // Agrupa todo o histórico por mês
  const monthlyGroups = useMemo(() => {
    return groupHistoryByMonth(history);
  }, [history]);

  // Determina o mês selecionado
  const activeGroup = useMemo<MonthlyGroup | null>(() => {
    if (monthlyGroups.length === 0) return null;
    if (selectedMonthKey === 'LATEST') {
      return monthlyGroups[0];
    }
    return monthlyGroups.find((g) => g.monthKey === selectedMonthKey) || monthlyGroups[0];
  }, [monthlyGroups, selectedMonthKey]);

  // Estatísticas globais consolidadas
  const totalLifetimeValue = useMemo(() => {
    return history.reduce((sum, h) => sum + (h.invoiceValue || 0), 0);
  }, [history]);

  // Determina o valor máximo de mês para dimensionar as barras de comparação
  const maxMonthValue = useMemo(() => {
    if (monthlyGroups.length === 0) return 1;
    return Math.max(...monthlyGroups.map((g) => g.totalValue), 1);
  }, [monthlyGroups]);

  // Filtra as notas dentro do mês ativo
  const filteredMonthRecords = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.records.filter((rec) => {
      const matchesSearch =
        searchInMonth === '' ||
        rec.clientName.toLowerCase().includes(searchInMonth.toLowerCase()) ||
        rec.originalFileName.toLowerCase().includes(searchInMonth.toLowerCase()) ||
        rec.generatedFileName.toLowerCase().includes(searchInMonth.toLowerCase()) ||
        (rec.invoiceNumber && rec.invoiceNumber.includes(searchInMonth)) ||
        (rec.cnpj && rec.cnpj.includes(searchInMonth));

      const matchesStatus = statusFilter === 'ALL' || rec.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [activeGroup, searchInMonth, statusFilter]);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PROCESSADO':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Processado
          </span>
        );
      case 'REVISAR':
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Revisão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
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
            Visão Mensal
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organização de faturamento e volume de notas fiscais emitidas por mês de competência.
          </p>
        </div>

        {activeGroup && (
          <div className="flex items-center gap-2">
            <button
              id="btn-calc-taxes-from-monthly"
              onClick={() => onNavigateTab('taxes')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-slate-500" />
              <span>Calcular impostos</span>
            </button>

            <button
              id="btn-export-active-month-csv"
              onClick={() => exportMonthlyGroupCSV(activeGroup)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar ({activeGroup.shortLabel})</span>
            </button>
          </div>
        )}
      </div>

      {monthlyGroups.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
          <FileText className="w-8 h-8 mx-auto text-slate-400 opacity-40" />
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Nenhuma nota fiscal processada
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Processe notas fiscais na aba &quot;Processar notas&quot; ou carregue exemplos para visualizar o fechamento mensal.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('process')}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Processar notas agora
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Barra de Seleção de Mês Unificada */}
          <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 overflow-x-auto scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-slate-500 px-1">Competência:</span>
              {monthlyGroups.map((group) => {
                const isSelected = activeGroup?.monthKey === group.monthKey;
                return (
                  <button
                    key={group.monthKey}
                    id={`btn-month-tab-${group.monthKey}`}
                    onClick={() => setSelectedMonthKey(group.monthKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{group.label}</span>
                    <span className="ml-1.5 opacity-60 font-mono text-[11px]">
                      ({group.totalInvoices})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-slate-400 shrink-0 font-medium hidden md:block">
              {monthlyGroups.length} {monthlyGroups.length === 1 ? 'mês cadastrado' : 'meses cadastrados'}
            </div>
          </div>

          {activeGroup && (
            <>
              {/* Hero Card Minimalista com os Valores do Mês */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
                  {/* Faturamento */}
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Faturamento de {activeGroup.shortLabel}
                    </span>
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">
                      {activeGroup.totalValueFormatted}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {activeGroup.label}
                    </div>
                  </div>

                  {/* Notas Emitidas */}
                  <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Notas emitidas
                    </span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                      {activeGroup.totalInvoices}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {activeGroup.processedCount} processadas com sucesso
                    </div>
                  </div>

                  {/* Ticket Médio */}
                  <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Ticket médio
                    </span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                      {activeGroup.averageValueFormatted}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Média por nota emitida
                    </div>
                  </div>

                  {/* Tomadores / Clientes */}
                  <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Clientes atendidos
                    </span>
                    <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                      {activeGroup.topClients.length}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Empresas com notas no período
                    </div>
                  </div>
                </div>
              </div>

              {/* Comparativo Mês a Mês */}
              {monthlyGroups.length > 1 && (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Comparativo Mês a Mês
                      </h3>
                      <p className="text-xs text-slate-400">
                        Distribuição do faturamento entre as competências
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      Total:{' '}
                      <strong className="text-slate-900 dark:text-white font-mono tabular-nums">
                        {formatBRL(totalLifetimeValue)}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    {monthlyGroups.map((group) => {
                      const isCurrentActive = group.monthKey === activeGroup.monthKey;
                      const percentage = Math.max(
                        Math.round((group.totalValue / maxMonthValue) * 100),
                        4
                      );

                      return (
                        <div
                          key={`compare-${group.monthKey}`}
                          onClick={() => setSelectedMonthKey(group.monthKey)}
                          className={`p-2.5 rounded-xl cursor-pointer transition-colors ${
                            isCurrentActive
                              ? 'bg-slate-100/90 dark:bg-slate-800/80'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className={`font-medium ${isCurrentActive ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 dark:text-slate-400'}`}>
                              {group.label}
                            </span>
                            <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                              <span className="text-slate-400 text-[11px]">
                                {group.totalInvoices} {group.totalInvoices === 1 ? 'nota' : 'notas'}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {group.totalValueFormatted}
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCurrentActive ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-slate-700'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tabela de Notas Fiscais do Mês */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Notas Fiscais de {activeGroup.label}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {filteredMonthRecords.length} de {activeGroup.totalInvoices} notas deste período
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar nota ou cliente..."
                        value={searchInMonth}
                        onChange={(e) => setSearchInMonth(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-slate-400"
                      />
                    </div>

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-slate-400"
                    >
                      <option value="ALL">Todos os status</option>
                      <option value="PROCESSADO">Processadas</option>
                      <option value="REVISAR">Revisão</option>
                      <option value="ERRO">Erros</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Arquivo</th>
                          <th className="py-3 px-4">Cliente (Tomador)</th>
                          <th className="py-3 px-4">Número</th>
                          <th className="py-3 px-4">Emissão</th>
                          <th className="py-3 px-4 text-right">Valor da Nota</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMonthRecords.length > 0 ? (
                          filteredMonthRecords.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              <td className="py-3 px-4 max-w-xs">
                                <span
                                  className="font-medium text-slate-900 dark:text-slate-100 block truncate"
                                  title={item.generatedFileName}
                                >
                                  {item.generatedFileName}
                                </span>
                                <span
                                  className="text-[11px] text-slate-400 font-mono block truncate"
                                  title={item.originalFileName}
                                >
                                  Original: {item.originalFileName}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[200px]">
                                  {item.clientName}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono block">
                                  {item.cnpj || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                                {item.invoiceNumber || 'S_N'}
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                                {item.invoiceDate}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                                {item.invoiceValueFormatted}
                              </td>
                              <td className="py-3 px-4">
                                {getStatusText(item.status)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    id={`btn-month-view-pdf-${item.id}`}
                                    onClick={() => setSelectedPdfToView(item)}
                                    className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                    title="Visualizar PDF"
                                  >
                                    <FileText className="w-3 h-3" /> PDF
                                  </button>
                                  <button
                                    id={`btn-month-view-detail-${item.id}`}
                                    onClick={() => onViewInvoiceDetails(item)}
                                    className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> Detalhes
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-10 text-center text-slate-400 text-xs"
                            >
                              Nenhuma nota encontrada com os filtros selecionados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Modal de PDF */}
      {selectedPdfToView && (
        <PdfViewerModal
          item={selectedPdfToView}
          onClose={() => setSelectedPdfToView(null)}
        />
      )}
    </div>
  );
};
