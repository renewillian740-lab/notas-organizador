import React, { useState, useMemo, useEffect } from 'react';
import {
  Percent,
  Calendar,
  DollarSign,
  TrendingUp,
  Copy,
  Check,
  Download,
  CalendarDays,
  BookmarkCheck,
  FileText,
  ChevronRight,
  ArrowUpRight,
  Calculator,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { groupHistoryByMonth, formatBRL } from '../utils/monthUtils';
import { db } from '../services/db';

interface TaxEstimationPageProps {
  history: HistoryRecord[];
  onViewInvoiceDetails: (item: HistoryRecord) => void;
  onNavigateTab: (tab: 'dashboard' | 'monthly' | 'process' | 'upload' | 'clients' | 'history' | 'settings' | 'taxes') => void;
}

export const TaxEstimationPage: React.FC<TaxEstimationPageProps> = ({
  history,
  onViewInvoiceDetails,
  onNavigateTab,
}) => {
  const settings = db.getSettings();

  // Alíquota de imposto
  const [taxRate, setTaxRate] = useState<number>(() => {
    return settings.defaultTaxRate !== undefined && !isNaN(settings.defaultTaxRate)
      ? settings.defaultTaxRate
      : 6.0;
  });

  const [inputRateStr, setInputRateStr] = useState<string>(() => String(taxRate));

  // Agrupamentos por mês
  const monthlyGroups = useMemo(() => {
    return groupHistoryByMonth(history);
  }, [history]);

  // Período selecionado: 'ALL' ou 'YYYY-MM'
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    return monthlyGroups.length > 0 ? monthlyGroups[0].monthKey : 'ALL';
  });

  // Aba ativa na tabela: 'invoices' (notas do mês) ou 'monthly' (mês a mês)
  const [viewTab, setViewTab] = useState<'invoices' | 'monthly'>('invoices');

  const [copiedToast, setCopiedToast] = useState(false);
  const [savedDefaultToast, setSavedDefaultToast] = useState(false);

  // Sincroniza input string quando a alíquota muda externamente
  useEffect(() => {
    setInputRateStr(String(taxRate));
  }, [taxRate]);

  // Se carregar dados e o período estiver em 'ALL', prioriza o mês mais recente
  useEffect(() => {
    if (selectedPeriod === 'ALL' && monthlyGroups.length > 0) {
      setSelectedPeriod(monthlyGroups[0].monthKey);
    }
  }, [monthlyGroups]);

  const handleRateChange = (val: string) => {
    setInputRateStr(val);
    const parsed = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setTaxRate(parsed);
    }
  };

  const handleSaveAsDefault = () => {
    const current = db.getSettings();
    db.saveSettings({ ...current, defaultTaxRate: taxRate });
    setSavedDefaultToast(true);
    setTimeout(() => setSavedDefaultToast(false), 2500);
  };

  // Filtragem das notas
  const currentRecords = useMemo(() => {
    return history.filter((item) => {
      if (item.status === 'ERRO') return false;
      if (selectedPeriod !== 'ALL') {
        const itemMonthKey = monthlyGroups.find((g) => g.records.some((r) => r.id === item.id))?.monthKey;
        if (itemMonthKey !== selectedPeriod) return false;
      }
      return true;
    });
  }, [history, selectedPeriod, monthlyGroups]);

  // Métricas do período
  const metrics = useMemo(() => {
    const totalRevenue = currentRecords.reduce((acc, curr) => {
      const val = typeof curr.invoiceValue === 'number' && !isNaN(curr.invoiceValue) ? curr.invoiceValue : 0;
      return acc + val;
    }, 0);

    const totalNotes = currentRecords.length;
    const estimatedTax = totalRevenue * (taxRate / 100);
    const netRevenue = totalRevenue - estimatedTax;

    return {
      totalRevenue,
      totalNotes,
      estimatedTax,
      netRevenue,
    };
  }, [currentRecords, taxRate]);

  // Nome do período selecionado
  const activeMonthGroup = useMemo(() => {
    return monthlyGroups.find((g) => g.monthKey === selectedPeriod);
  }, [monthlyGroups, selectedPeriod]);

  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'ALL') return 'Todas as notas (Geral)';
    return activeMonthGroup ? activeMonthGroup.label : selectedPeriod;
  }, [selectedPeriod, activeMonthGroup]);

  // Vencimento estimado (dia 20 do mês seguinte)
  const estimatedDueDate = useMemo(() => {
    if (selectedPeriod === 'ALL') return 'Dia 20 do mês subsequente';
    const parts = selectedPeriod.split('-');
    if (parts.length === 2) {
      let year = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) + 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      return `20/${String(month).padStart(2, '0')}/${year}`;
    }
    return 'Dia 20 do mês seguinte';
  }, [selectedPeriod]);

  // Copiar resumo limpo
  const handleCopySummary = () => {
    const text = `📊 RESUMO DE IMPOSTOS ESTIMADOS
Competência: ${periodLabel}
Notas Fiscais: ${metrics.totalNotes}
Faturamento Bruto: ${formatBRL(metrics.totalRevenue)}
Alíquota de Imposto: ${taxRate.toFixed(2).replace('.', ',')}%
Imposto Estimado a Pagar: ${formatBRL(metrics.estimatedTax)}
Líquido Estimado: ${formatBRL(metrics.netRevenue)}
Previsão de Vencimento: ${estimatedDueDate}`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  // Exportar CSV
  const handleExportCSV = () => {
    const headers = ['Numero NF', 'Data Emissao', 'Cliente', 'Valor NF', 'Aliquota (%)', 'Imposto Estimado'];
    const rows = currentRecords.map((r) => {
      const val = typeof r.invoiceValue === 'number' && !isNaN(r.invoiceValue) ? r.invoiceValue : 0;
      const noteTax = val * (taxRate / 100);
      return [
        `"${r.invoiceNumber || 'S/N'}"`,
        `"${r.invoiceDate || ''}"`,
        `"${(r.clientName || 'Cliente').replace(/"/g, '""')}"`,
        val.toFixed(2),
        taxRate.toFixed(2),
        noteTax.toFixed(2),
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `impostos_${selectedPeriod}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Previsão de Impostos
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Calcule o valor aproximado do imposto a recolher com base nas notas geradas.
          </p>
        </div>

        {/* Ações Rápidas Discretas */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedToast ? 'Copiado!' : 'Copiar resumo'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={currentRecords.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar</span>
          </button>
        </div>
      </div>

      {/* Barra de Controle Unificada & Clean */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Seletor de Mês */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 shrink-0">Mês:</span>
          <select
            id="select-tax-period-minimal"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-slate-400"
          >
            {monthlyGroups.map((group) => (
              <option key={group.monthKey} value={group.monthKey}>
                {group.label} ({group.totalInvoices} {group.totalInvoices === 1 ? 'nota' : 'notas'})
              </option>
            ))}
            <option value="ALL">Todo o Histórico (Acumulado)</option>
          </select>
        </div>

        {/* Input da Alíquota & Chips Rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 shrink-0">Imposto:</span>

          <div className="relative w-24">
            <input
              id="input-tax-rate-minimal"
              type="text"
              inputMode="decimal"
              value={inputRateStr}
              onChange={(e) => handleRateChange(e.target.value)}
              placeholder="6.0"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-7 py-1.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-slate-400 text-right"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              %
            </span>
          </div>

          {/* Atalhos com cor ativa */}
          <div className="flex items-center gap-1">
            {[4, 6, 9, 13.3, 15.5].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTaxRate(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                  Math.abs(taxRate - preset) < 0.1
                    ? 'bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>

          {/* Salvar padrão */}
          <button
            type="button"
            onClick={handleSaveAsDefault}
            title="Salvar esta alíquota como padrão"
            className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ml-1 p-1 rounded-md transition-colors cursor-pointer"
          >
            {savedDefaultToast ? (
              <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">Salvo!</span>
            ) : (
              <BookmarkCheck className="w-3.5 h-3.5 text-indigo-500" />
            )}
          </button>
        </div>
      </div>

      {/* Cards de Métricas com Cores Vivas e Semânticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Destaque Principal: Imposto Estimado (Âmbar/Laranja) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white dark:to-slate-900 border border-amber-300/80 dark:border-amber-800/70 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
              Imposto a Pagar
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            {formatBRL(metrics.estimatedTax)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-amber-700/80 dark:text-amber-400/80 pt-1 border-t border-amber-200/60 dark:border-amber-800/50">
            <span>Alíquota: <strong>{taxRate.toFixed(1).replace('.', ',')}%</strong></span>
            <span>Vencimento: {estimatedDueDate}</span>
          </div>
        </div>

        {/* 2. Faturamento Bruto (Azul/Índigo) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-white dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/70 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider">
              Faturamento Bruto
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 font-mono tabular-nums">
            {formatBRL(metrics.totalRevenue)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-blue-700/80 dark:text-blue-400/80 pt-1 border-t border-blue-200/60 dark:border-blue-900/50">
            <span>Volume: <strong>{metrics.totalNotes} {metrics.totalNotes === 1 ? 'nota' : 'notas'}</strong></span>
            <span className="truncate max-w-[140px]">{periodLabel}</span>
          </div>
        </div>

        {/* 3. Líquido que sobra no caixa (Esmeralda) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/70 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Sobra Líquida
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {formatBRL(metrics.netRevenue)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-emerald-700/80 dark:text-emerald-400/80 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/50">
            <span>Retenção líquida: <strong>{(100 - taxRate).toFixed(1).replace('.', ',')}%</strong></span>
            <span>No caixa</span>
          </div>
        </div>
      </div>

      {/* Barra de Proporção Visual (Imposto x Líquido) */}
      {metrics.totalRevenue > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-slate-700 dark:text-slate-300">
                Imposto a recolher: <strong className="text-amber-600 dark:text-amber-400 font-mono">{formatBRL(metrics.estimatedTax)}</strong> ({taxRate.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-700 dark:text-slate-300">
                Líquido empresa: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatBRL(metrics.netRevenue)}</strong> ({(100 - taxRate).toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
              style={{ width: `${Math.min(Math.max(taxRate, 2), 98)}%` }}
              title={`Imposto: ${taxRate.toFixed(1)}%`}
            />
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{ width: `${100 - Math.min(Math.max(taxRate, 2), 98)}%` }}
              title={`Líquido: ${(100 - taxRate).toFixed(1)}%`}
            />
          </div>
        </div>
      )}

      {/* Visualização de Dados (Segmented Tabs Minimalistas) */}
      <div className="space-y-3">
        {/* Tab Switcher */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewTab('invoices')}
              className={`pb-2 -mb-2 border-b-2 transition-all cursor-pointer ${
                viewTab === 'invoices'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Notas deste período ({currentRecords.length})
            </button>

            <button
              type="button"
              onClick={() => setViewTab('monthly')}
              className={`pb-2 -mb-2 border-b-2 transition-all cursor-pointer ${
                viewTab === 'monthly'
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Comparativo Mês a Mês ({monthlyGroups.length})
            </button>
          </div>

          <span className="text-[11px] text-slate-400">
            {viewTab === 'invoices' ? `${currentRecords.length} notas listadas` : 'Resumo mensal'}
          </span>
        </div>

        {/* Conteúdo 1: Notas Fiscais do Período */}
        {viewTab === 'invoices' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            {currentRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhuma nota encontrada para {periodLabel}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-semibold uppercase">
                      <th className="px-4 py-3">Número</th>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3 text-right">Valor da NF</th>
                      <th className="px-4 py-3 text-right">Imposto ({taxRate}%)</th>
                      <th className="px-4 py-3 text-right">Líquido</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {currentRecords.map((item) => {
                      const val = typeof item.invoiceValue === 'number' && !isNaN(item.invoiceValue) ? item.invoiceValue : 0;
                      const noteTax = val * (taxRate / 100);
                      const noteNet = val - noteTax;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {item.invoiceNumber || 'S/N'}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {item.invoiceDate || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px] block">
                              {item.clientName || 'Cliente não identificado'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100 font-mono">
                            {formatBRL(val)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {formatBRL(noteTax)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatBRL(noteNet)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => onViewInvoiceDetails(item)}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo 2: Comparativo Mês a Mês */}
        {viewTab === 'monthly' && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            {monthlyGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Nenhum histórico mensal disponível.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-semibold uppercase">
                      <th className="px-4 py-3">Mês</th>
                      <th className="px-4 py-3 text-center">Notas</th>
                      <th className="px-4 py-3 text-right">Faturamento</th>
                      <th className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">Imposto ({taxRate}%)</th>
                      <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">Líquido</th>
                      <th className="px-4 py-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {monthlyGroups.map((group) => {
                      const mTax = group.totalValue * (taxRate / 100);
                      const mNet = group.totalValue - mTax;
                      const isSelected = selectedPeriod === group.monthKey;

                      return (
                        <tr
                          key={group.monthKey}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-blue-50/50 dark:bg-blue-950/20'
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                            {group.label}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500 font-mono">
                            {group.totalInvoices}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100 font-mono">
                            {group.totalValueFormatted}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400 font-mono">
                            {formatBRL(mTax)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {formatBRL(mNet)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPeriod(group.monthKey);
                                setViewTab('invoices');
                              }}
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                            >
                              Filtrar notas
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nota Discreta no Rodapé */}
      <div className="text-center pt-2">
        <p className="text-[11px] text-slate-400">
          Estimativa gerencial simples baseada nas notas fiscais emitidas. A apuração fiscal oficial da DAS/DARF é calculada pelo seu contador.
        </p>
      </div>
    </div>
  );
};
