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
  ArrowUpRight,
  Layers,
  Sparkles,
  PieChart,
  BarChart3,
  Calendar,
  Building2,
  Eye,
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
  onNavigateTab: (tab: 'dashboard' | 'process' | 'upload' | 'clients' | 'history' | 'settings' | 'monthly') => void;
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
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 rounded-3xl text-white shadow-xl shadow-blue-900/10 border border-blue-800/40">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2 border border-blue-400/30">
            <CalendarDays className="w-3.5 h-3.5" /> Gestão & Fechamento Mensal
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Organização de Notas Fiscais por Mês
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            Acompanhe o volume mensal de emissões, faturamento consolidado por competência e detalhamento por cliente.
          </p>
        </div>

        {activeGroup && (
          <div className="flex items-center gap-3">
            <button
              id="btn-export-active-month-csv"
              onClick={() => exportMonthlyGroupCSV(activeGroup)}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              title="Baixar planilha CSV com o fechamento do mês selecionado"
            >
              <Download className="w-4 h-4 text-blue-600" /> Exportar Fechamento ({activeGroup.shortLabel})
            </button>
          </div>
        )}
      </div>

      {monthlyGroups.length === 0 ? (
        /* Estado Vazio */
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <CalendarDays className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Nenhuma nota fiscal processada ainda
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Processe notas fiscais na aba &quot;Processar notas&quot; ou carregue dados de teste para visualizar o fechamento mensal, quantidade emitida e faturamento por mês.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('process')}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <FileCheck2 className="w-4 h-4" /> Processar Notas Agora
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Month Selector Pills / Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Selecionar Mês de Competência
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {monthlyGroups.length} {monthlyGroups.length === 1 ? 'mês registrado' : 'meses registrados'}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {monthlyGroups.map((group) => {
                const isSelected = activeGroup?.monthKey === group.monthKey;
                return (
                  <button
                    key={group.monthKey}
                    id={`btn-month-tab-${group.monthKey}`}
                    onClick={() => setSelectedMonthKey(group.monthKey)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2.5 cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/25 scale-[1.02]'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span>{group.label}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {group.totalInvoices} {group.totalInvoices === 1 ? 'nota' : 'notas'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeGroup && (
            <>
              {/* Active Month Headline Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* FATURAMENTO DO MÊS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                      Faturamento do Mês
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {activeGroup.totalValueFormatted}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
                      Competência: {activeGroup.label}
                    </span>
                  </div>
                </div>

                {/* NOTAS EMITIDAS NO MÊS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                      Notas Emitidas
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                        {activeGroup.totalInvoices}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {activeGroup.totalInvoices === 1 ? 'documento' : 'documentos'}
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block mt-1">
                      {activeGroup.processedCount} processadas com sucesso
                    </span>
                  </div>
                </div>

                {/* TICKET MÉDIO */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                      Ticket Médio
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">
                      {activeGroup.averageValueFormatted}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
                      Média por nota emitida no mês
                    </span>
                  </div>
                </div>

                {/* CLIENTES ATENDIDOS NO MÊS */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                      Clientes do Mês
                    </span>
                    <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="text-3xl font-black text-violet-600 dark:text-violet-400 tracking-tight">
                      {activeGroup.topClients.length}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium block mt-1">
                      Tomadores com notas neste período
                    </span>
                  </div>
                </div>
              </div>

              {/* Monthly Visual Comparison & Evolution Bar Chart */}
              {monthlyGroups.length > 1 && (
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        Comparativo Mensal de Faturamento & Emissões
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Evolução mês a mês das notas emitidas e receita total correspondente
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                      Total Acumulado:{' '}
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        {formatBRL(totalLifetimeValue)}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Visual Comparison Bars */}
                  <div className="space-y-3 pt-2">
                    {monthlyGroups.map((group) => {
                      const isCurrentActive = group.monthKey === activeGroup.monthKey;
                      const percentage = Math.max(
                        Math.round((group.totalValue / maxMonthValue) * 100),
                        6
                      );

                      return (
                        <div
                          key={`compare-${group.monthKey}`}
                          onClick={() => setSelectedMonthKey(group.monthKey)}
                          className={`p-3 rounded-2xl cursor-pointer transition-all border ${
                            isCurrentActive
                              ? 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700/60 shadow-xs'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800/70 hover:bg-slate-100/70 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span
                              className={`font-bold flex items-center gap-2 ${
                                isCurrentActive
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {group.label}
                              {isCurrentActive && (
                                <span className="text-[10px] px-2 py-0.2 bg-blue-600 text-white rounded-full font-bold">
                                  Visualizando
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-3 font-mono">
                              <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                                {group.totalInvoices} {group.totalInvoices === 1 ? 'nota' : 'notas'}
                              </span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {group.totalValueFormatted}
                              </span>
                            </div>
                          </div>

                          {/* Progress / Bar track */}
                          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isCurrentActive
                                  ? 'bg-gradient-to-r from-blue-600 to-emerald-500'
                                  : 'bg-slate-400 dark:bg-slate-500'
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

              {/* Top Clients of the Month */}
              {activeGroup.topClients.length > 0 && (
                <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        Tomadores de Serviços em {activeGroup.label}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Distribuição do faturamento por cliente tomador no mês
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeGroup.topClients.map((client, idx) => {
                      const clientPercent =
                        activeGroup.totalValue > 0
                          ? Math.round((client.totalValue / activeGroup.totalValue) * 100)
                          : 0;

                      return (
                        <div
                          key={`client-${idx}-${client.cleanCnpj}`}
                          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span
                                className="font-bold text-xs text-slate-900 dark:text-slate-100 block truncate"
                                title={client.clientName}
                              >
                                {client.clientName}
                              </span>
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block">
                                {client.cnpj || 'Doc não informado'}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 shrink-0">
                              {client.count} {client.count === 1 ? 'nota' : 'notas'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                              {client.totalValueFormatted}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {clientPercent}% do mês
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Table of Invoices in Selected Month */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      Notas Fiscais de {activeGroup.label}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Exibindo {filteredMonthRecords.length} de {activeGroup.totalInvoices} notas deste mês
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <input
                      type="text"
                      placeholder="Buscar nesta competência..."
                      value={searchInMonth}
                      onChange={(e) => setSearchInMonth(e.target.value)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    />

                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">Todos os status</option>
                      <option value="PROCESSADO">Processadas</option>
                      <option value="REVISAR">Revisão</option>
                      <option value="ERRO">Erros</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-3.5 px-6">Arquivo Renomeado / Original</th>
                          <th className="py-3.5 px-6">Cliente (Tomador)</th>
                          <th className="py-3.5 px-6">Número</th>
                          <th className="py-3.5 px-6">Data Emissão</th>
                          <th className="py-3.5 px-6">Valor da Nota</th>
                          <th className="py-3.5 px-6">Status</th>
                          <th className="py-3.5 px-6 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMonthRecords.length > 0 ? (
                          filteredMonthRecords.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="py-3.5 px-6">
                                <div className="max-w-xs truncate">
                                  <span
                                    className="font-bold text-slate-900 dark:text-slate-100 block truncate"
                                    title={item.generatedFileName}
                                  >
                                    {item.generatedFileName}
                                  </span>
                                  <span
                                    className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block truncate"
                                    title={item.originalFileName}
                                  >
                                    Original: {item.originalFileName}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-6">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {item.clientName}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block">
                                  {item.cnpj || '-'}
                                </span>
                              </td>
                              <td className="py-3.5 px-6 font-mono text-slate-800 dark:text-slate-200">
                                {item.invoiceNumber || 'S_N'}
                              </td>
                              <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                                {item.invoiceDate}
                              </td>
                              <td className="py-3.5 px-6 font-extrabold text-emerald-700 dark:text-emerald-400">
                                {item.invoiceValueFormatted}
                              </td>
                              <td className="py-3.5 px-6">{getStatusBadge(item.status)}</td>
                              <td className="py-3.5 px-6 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    id={`btn-month-view-pdf-${item.id}`}
                                    onClick={() => setSelectedPdfToView(item)}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors inline-flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                                    title="Visualizar PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> PDF
                                  </button>
                                  <button
                                    id={`btn-month-view-detail-${item.id}`}
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
                            <td
                              colSpan={7}
                              className="py-10 text-center text-slate-400 dark:text-slate-500"
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
