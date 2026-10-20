import React, { useState, useMemo, useEffect } from 'react';
import {
  Calculator,
  Percent,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Copy,
  Check,
  Download,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  BookmarkCheck,
  Sliders,
  ShieldCheck,
  ChevronRight,
  Building2,
  CalendarDays,
  FileCheck2,
  Sparkles,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { groupHistoryByMonth, formatBRL } from '../utils/monthUtils';
import { db } from '../services/db';

interface TaxEstimationPageProps {
  history: HistoryRecord[];
  onViewInvoiceDetails: (item: HistoryRecord) => void;
  onNavigateTab: (tab: 'dashboard' | 'monthly' | 'process' | 'upload' | 'clients' | 'history' | 'settings' | 'taxes') => void;
}

interface TaxPreset {
  name: string;
  rate: number;
  description: string;
  tag: string;
}

const COMMON_TAX_PRESETS: TaxPreset[] = [
  {
    name: 'Simples - Comércio',
    rate: 4.0,
    description: 'Anexo I - Venda de mercadorias (1ª faixa)',
    tag: 'Anexo I',
  },
  {
    name: 'Simples - Serviços',
    rate: 6.0,
    description: 'Anexo III - Serviços em geral (1ª faixa)',
    tag: 'Anexo III (Recomendado)',
  },
  {
    name: 'Simples - Intermediário',
    rate: 9.0,
    description: 'Faixa 2/3 com faturamento acumulado maior',
    tag: 'Faixa 2',
  },
  {
    name: 'Simples - TI / Eng.',
    rate: 15.5,
    description: 'Anexo V - Serviços técnicos sem Fator R',
    tag: 'Anexo V',
  },
  {
    name: 'Lucro Presumido',
    rate: 13.33,
    description: 'IRPJ + CSLL + PIS/COFINS + ISS (média serviços)',
    tag: 'Presumido',
  },
  {
    name: 'MEI',
    rate: 0.0,
    description: 'Microempreendedor Individual (DAS fixo)',
    tag: 'DAS Fixo',
  },
];

export const TaxEstimationPage: React.FC<TaxEstimationPageProps> = ({
  history,
  onViewInvoiceDetails,
  onNavigateTab,
}) => {
  const settings = db.getSettings();

  // Alíquota de imposto (padrão configurado ou 6%)
  const [taxRate, setTaxRate] = useState<number>(() => {
    return settings.defaultTaxRate !== undefined && !isNaN(settings.defaultTaxRate)
      ? settings.defaultTaxRate
      : 6.0;
  });

  const [inputRateStr, setInputRateStr] = useState<string>(() => {
    return String(taxRate);
  });

  // Agrupamentos por mês
  const monthlyGroups = useMemo(() => {
    return groupHistoryByMonth(history);
  }, [history]);

  // Período selecionado: 'ALL' ou 'YYYY-MM'
  const [selectedPeriod, setSelectedPeriod] = useState<string>(() => {
    if (monthlyGroups.length > 0) {
      return monthlyGroups[0].monthKey;
    }
    return 'ALL';
  });

  // Filtro de status: 'ALL' (todas exceto erro) ou 'PROCESSADO'
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PROCESSADO'>('ALL');

  // Estados de feedback de cópia e salvamento de preferência
  const [copiedToast, setCopiedToast] = useState(false);
  const [savedDefaultToast, setSavedDefaultToast] = useState(false);

  // Sincroniza o input string quando taxRate muda programaticamente
  useEffect(() => {
    setInputRateStr(String(taxRate));
  }, [taxRate]);

  // Se monthlyGroups carregar e selectedPeriod estiver vazio, seleciona o mês mais recente
  useEffect(() => {
    if (selectedPeriod === 'ALL' && monthlyGroups.length > 0) {
      setSelectedPeriod(monthlyGroups[0].monthKey);
    }
  }, [monthlyGroups]);

  // Salvar alíquota como padrão nas configurações do sistema
  const handleSaveAsDefault = () => {
    const current = db.getSettings();
    db.saveSettings({
      ...current,
      defaultTaxRate: taxRate,
    });
    setSavedDefaultToast(true);
    setTimeout(() => setSavedDefaultToast(false), 3000);
  };

  // Alteração da alíquota pelo campo de input
  const handleRateInputChange = (val: string) => {
    setInputRateStr(val);
    const parsed = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setTaxRate(parsed);
    }
  };

  // Filtragem das notas que entram no cálculo
  const currentRecords = useMemo(() => {
    return history.filter((item) => {
      // Ignorar erros fatais
      if (item.status === 'ERRO') return false;

      // Filtro de status
      if (statusFilter === 'PROCESSADO' && item.status !== 'PROCESSADO') {
        return false;
      }

      // Filtro de período
      if (selectedPeriod !== 'ALL') {
        const itemMonthKey = monthlyGroups.find((g) => g.records.some((r) => r.id === item.id))?.monthKey;
        if (itemMonthKey !== selectedPeriod) {
          return false;
        }
      }

      return true;
    });
  }, [history, selectedPeriod, statusFilter, monthlyGroups]);

  // Cálculos consolidados para o período selecionado
  const metrics = useMemo(() => {
    const totalRevenue = currentRecords.reduce((acc, curr) => {
      const val = typeof curr.invoiceValue === 'number' && !isNaN(curr.invoiceValue) ? curr.invoiceValue : 0;
      return acc + val;
    }, 0);

    const totalNotes = currentRecords.length;
    const estimatedTax = totalRevenue * (taxRate / 100);
    const netRevenue = totalRevenue - estimatedTax;
    const averageTicket = totalNotes > 0 ? totalRevenue / totalNotes : 0;
    const averageTaxPerNote = totalNotes > 0 ? estimatedTax / totalNotes : 0;

    return {
      totalRevenue,
      totalNotes,
      estimatedTax,
      netRevenue,
      averageTicket,
      averageTaxPerNote,
    };
  }, [currentRecords, taxRate]);

  // Obter o label do período selecionado
  const periodLabel = useMemo(() => {
    if (selectedPeriod === 'ALL') return 'Todo o Histórico (Acumulado)';
    const g = monthlyGroups.find((item) => item.monthKey === selectedPeriod);
    return g ? g.label : selectedPeriod;
  }, [selectedPeriod, monthlyGroups]);

  // Vencimento estimado da guia (Dia 20 do mês seguinte à emissão)
  const estimatedDueDate = useMemo(() => {
    if (selectedPeriod === 'ALL') {
      return 'Dia 20 do mês subsequente a cada emissão';
    }
    const parts = selectedPeriod.split('-');
    if (parts.length === 2) {
      let year = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10); // 1-12

      // Mês seguinte
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      return `20/${String(month).padStart(2, '0')}/${year}`;
    }
    return 'Dia 20 do mês seguinte';
  }, [selectedPeriod]);

  // Copiar resumo formatado para o contador ou WhatsApp
  const handleCopySummary = () => {
    const issuerInfo = settings.issuerName
      ? `\nEmpresa: ${settings.issuerName}${settings.issuerCnpj ? ` (CNPJ: ${settings.issuerCnpj})` : ''}`
      : '';

    const text = `📊 RESUMO DE NOTAS FISCAIS E IMPOSTO ESTIMADO${issuerInfo}
📅 Período: ${periodLabel}
--------------------------------------------------
📄 Quantidade de Notas Fiscais: ${metrics.totalNotes}
💰 Faturamento Bruto (Base): ${formatBRL(metrics.totalRevenue)}
📈 Alíquota de Imposto: ${taxRate.toFixed(2).replace('.', ',')}%
💵 Imposto Estimado a Pagar: ${formatBRL(metrics.estimatedTax)}
✨ Faturamento Líquido Estimado: ${formatBRL(metrics.netRevenue)}
📅 Vencimento Estimado da Guia (DAS/DARF): ${estimatedDueDate}
--------------------------------------------------
*Cálculo gerencial gerado automaticamente via Organizador de Notas Fiscais.`;

    navigator.clipboard.writeText(text);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  // Exportar dados da tabela de imposto em CSV
  const handleExportCSV = () => {
    const headers = [
      'Numero da Nota',
      'Data Emissao',
      'Cliente / Tomador',
      'CNPJ',
      'Valor da Nota (R$)',
      'Aliquota (%)',
      'Imposto Estimado (R$)',
      'Valor Liquido (R$)',
      'Status',
    ];

    const rows = currentRecords.map((r) => {
      const val = typeof r.invoiceValue === 'number' && !isNaN(r.invoiceValue) ? r.invoiceValue : 0;
      const noteTax = val * (taxRate / 100);
      const noteNet = val - noteTax;

      return [
        `"${r.invoiceNumber || 'S/N'}"`,
        `"${r.invoiceDate || ''}"`,
        `"${(r.clientName || 'Não identificado').replace(/"/g, '""')}"`,
        `"${r.cnpj || ''}"`,
        val.toFixed(2),
        taxRate.toFixed(2),
        noteTax.toFixed(2),
        noteNet.toFixed(2),
        `"${r.status}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `relatorio_impostos_${selectedPeriod}_${taxRate}pct.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shadow-xs">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Cálculo de Imposto Estimado
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800">
                  Previsão Fiscal
                </span>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Defina sua porcentagem de imposto e descubra o valor a recolher com base nas notas fiscais emitidas.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopySummary}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs ${
              copiedToast
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {copiedToast ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copiedToast ? 'Copiado para o Contador!' : 'Copiar p/ Contador'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={currentRecords.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Main Configuration Card: Tax Rate & Period */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna 1: Input da Alíquota de Imposto */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <label
                htmlFor="input-tax-rate"
                className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Percent className="w-4 h-4 text-amber-500" />
                Quanto você paga de imposto? (%)
              </label>

              {/* Botão salvar como padrão */}
              <button
                type="button"
                onClick={handleSaveAsDefault}
                title="Salvar esta alíquota como padrão do sistema"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 transition-colors"
              >
                {savedDefaultToast ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Salvo!
                  </span>
                ) : (
                  <>
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Salvar como padrão</span>
                  </>
                )}
              </button>
            </div>

            {/* Input Gigante com Estilização Amigável */}
            <div className="relative flex items-center">
              <div className="relative flex-1">
                <input
                  id="input-tax-rate"
                  type="text"
                  inputMode="decimal"
                  value={inputRateStr}
                  onChange={(e) => handleRateInputChange(e.target.value)}
                  placeholder="Ex: 6.0"
                  className="w-full text-2xl font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-2xl pl-4 pr-12 py-3 focus:outline-hidden focus:border-amber-500 dark:focus:border-amber-500 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">
                  %
                </span>
              </div>

              {/* Quick Stepper Buttons */}
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={() => setTaxRate((prev) => Math.max(0, parseFloat((prev - 0.5).toFixed(2))))}
                  className="px-2.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors"
                  title="Diminuir 0.5%"
                >
                  -0.5%
                </button>
                <button
                  type="button"
                  onClick={() => setTaxRate((prev) => Math.min(100, parseFloat((prev + 0.5).toFixed(2))))}
                  className="px-2.5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors"
                  title="Aumentar 0.5%"
                >
                  +0.5%
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Digite a porcentagem exata que sua empresa recolhe (ex: <strong>6%</strong> no Simples Nacional de serviços, <strong>4%</strong> no comércio, etc).
            </p>
          </div>

          {/* Coluna 2: Seletor de Período e Filtros */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Seletor de Mês de Apuração */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-tax-period"
                className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
              >
                <Calendar className="w-4 h-4 text-blue-500" />
                Mês de Apuração (Período)
              </label>

              <select
                id="select-tax-period"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
              >
                {monthlyGroups.map((group) => (
                  <option key={group.monthKey} value={group.monthKey}>
                    {group.label} ({group.totalInvoices} {group.totalInvoices === 1 ? 'nota' : 'notas'} - {group.totalValueFormatted})
                  </option>
                ))}
                <option value="ALL">Todo o Histórico (Acumulado)</option>
              </select>

              <p className="text-[11px] text-slate-400">
                Geralmente os tributos (como o DAS) são apurados por mês calendário.
              </p>
            </div>

            {/* Filtro de Status das Notas */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-tax-status-filter"
                className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Quais notas considerar?
              </label>

              <select
                id="select-tax-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PROCESSADO')}
                className="w-full h-12 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-blue-500"
              >
                <option value="ALL">Todas as Notas Emitidas (Processadas + Em Revisão)</option>
                <option value="PROCESSADO">Apenas Notas com Status Processado</option>
              </select>

              <p className="text-[11px] text-slate-400">
                Ignora notas com erro de leitura de PDF.
              </p>
            </div>
          </div>
        </div>

        {/* Presets Rápidos de Alíquotas Brasileiras */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Atalhos rápidos para regimes e alíquotas comuns no Brasil:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {COMMON_TAX_PRESETS.map((preset) => {
              const isSelected = Math.abs(taxRate - preset.rate) < 0.01;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setTaxRate(preset.rate)}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-300 font-bold shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{preset.rate}%</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {preset.tag}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-200 mt-1 line-clamp-1">
                    {preset.name}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* KPI Cards: Resultados do Cálculo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: Faturamento Bruto (Base de Cálculo) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Faturamento Bruto
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-2">
            {formatBRL(metrics.totalRevenue)}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-2">
            <FileText className="w-3.5 h-3.5 text-blue-500" />
            <span>
              {metrics.totalNotes} {metrics.totalNotes === 1 ? 'nota fiscal emitida' : 'notas fiscais emitidas'}
            </span>
          </div>
        </div>

        {/* CARD 2: Imposto Estimado a Pagar (DESTAQUE) */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-slate-900 dark:to-slate-900 border-2 border-amber-500/30 dark:border-amber-500/40 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-amber-600" />
              Imposto Estimado ({taxRate.toFixed(1)}%)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 mt-2">
            {formatBRL(metrics.estimatedTax)}
          </p>
          <div className="flex items-center gap-1 text-xs text-amber-800 dark:text-amber-300/90 mt-2 font-medium">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Vencimento aprox: {estimatedDueDate}</span>
          </div>
        </div>

        {/* CARD 3: Faturamento Líquido (O que sobra) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Líquido Estimado
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 mt-2">
            {formatBRL(metrics.netRevenue)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {metrics.totalRevenue > 0
              ? `${((metrics.netRevenue / metrics.totalRevenue) * 100).toFixed(1)}% do faturamento bruto`
              : 'Sem receita no período'}
          </p>
        </div>

        {/* CARD 4: Média por Nota Fiscal */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Médias do Período
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Ticket médio:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatBRL(metrics.averageTicket)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Imposto médio/NF:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {formatBRL(metrics.averageTaxPerNote)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 truncate">
            {periodLabel}
          </p>
        </div>
      </div>

      {/* Tabela de Simulação de Outras Alíquotas para Comparação */}
      {metrics.totalRevenue > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-500" />
                Comparador Dinâmico de Alíquotas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Veja quanto você pagaria se sua alíquota mudasse de faixa para o mesmo faturamento de {formatBRL(metrics.totalRevenue)}:
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase font-bold border-y border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Alíquota</th>
                  <th className="px-4 py-3">Regime Típico</th>
                  <th className="px-4 py-3 text-right">Imposto Estimado</th>
                  <th className="px-4 py-3 text-right">Sobra Líquida</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[4.0, 6.0, 8.5, 10.0, 13.33, 15.5].map((rate) => {
                  const simTax = metrics.totalRevenue * (rate / 100);
                  const simNet = metrics.totalRevenue - simTax;
                  const isCurrent = Math.abs(taxRate - rate) < 0.05;

                  return (
                    <tr
                      key={rate}
                      className={`transition-colors ${
                        isCurrent
                          ? 'bg-amber-50/70 dark:bg-amber-950/20 font-semibold'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        <span className="flex items-center gap-1.5">
                          {rate.toFixed(1)}%
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-white font-bold">
                              Atual
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {rate === 4.0 && 'Simples Nacional - Comércio (Anexo I)'}
                        {rate === 6.0 && 'Simples Nacional - Serviços (Anexo III 1ª Faixa)'}
                        {rate === 8.5 && 'Simples Nacional - Serviços (Faixa 2)'}
                        {rate === 10.0 && 'Simples Nacional - Serviços (Faixa 3)'}
                        {rate === 13.33 && 'Lucro Presumido - Prestador de Serviços'}
                        {rate === 15.5 && 'Simples Nacional - TI / Intelectuais (Anexo V)'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                        {formatBRL(simTax)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(simNet)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isCurrent ? (
                          <span className="text-xs text-amber-600 font-bold">Selecionada</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setTaxRate(rate)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors"
                          >
                            Aplicar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico Mês a Mês de Imposto Previsto */}
      {monthlyGroups.length > 0 && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-500" />
                Histórico Mensal de Faturamento e Impostos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Acompanhamento mês a mês calculando o imposto estimado com a alíquota atual ({taxRate.toFixed(2)}%).
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('monthly')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Abrir Visão Mensal Completa</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase font-bold border-y border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Mês / Ano</th>
                  <th className="px-4 py-3 text-center">Qtd Notas</th>
                  <th className="px-4 py-3 text-right">Faturamento Bruto</th>
                  <th className="px-4 py-3 text-right">Imposto Estimado ({taxRate}%)</th>
                  <th className="px-4 py-3 text-right">Faturamento Líquido</th>
                  <th className="px-4 py-3 text-center">Vencimento Estimado</th>
                  <th className="px-4 py-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {monthlyGroups.map((group) => {
                  const mTax = group.totalValue * (taxRate / 100);
                  const mNet = group.totalValue - mTax;
                  const isSelected = selectedPeriod === group.monthKey;

                  // Calcular data de vencimento do mês
                  let nextMonth = group.month + 1;
                  let nextYear = group.year;
                  if (nextMonth > 12) {
                    nextMonth = 1;
                    nextYear += 1;
                  }
                  const dueDate = `20/${String(nextMonth).padStart(2, '0')}/${nextYear}`;

                  return (
                    <tr
                      key={group.monthKey}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{group.label}</span>
                          {isSelected && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-semibold">
                              Filtrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {group.totalInvoices}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                        {group.totalValueFormatted}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-amber-600 dark:text-amber-400">
                        {formatBRL(mTax)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(mNet)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-slate-600 dark:text-slate-400">
                        {dueDate}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPeriod(group.monthKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {isSelected ? 'Em foco' : 'Ver notas'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalhamento das Notas Fiscais do Período */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Notas Fiscais Incluídas no Cálculo ({currentRecords.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Parcela de imposto calculada individualmente para cada nota em {periodLabel}.
            </p>
          </div>

          <div className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl">
            Total do período: <span className="text-slate-900 dark:text-white font-bold">{formatBRL(metrics.totalRevenue)}</span> | Imposto: <span className="text-amber-600 dark:text-amber-400 font-bold">{formatBRL(metrics.estimatedTax)}</span>
          </div>
        </div>

        {currentRecords.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <Calculator className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Nenhuma nota fiscal encontrada para o período selecionado
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Altere o mês de apuração ou processe novos arquivos de notas fiscais.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-slate-500 uppercase font-bold border-y border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Número NF</th>
                  <th className="px-4 py-3">Data Emissão</th>
                  <th className="px-4 py-3">Cliente / Tomador</th>
                  <th className="px-4 py-3 text-right">Valor da NF</th>
                  <th className="px-4 py-3 text-right">Imposto Desta NF ({taxRate}%)</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentRecords.map((item) => {
                  const val = typeof item.invoiceValue === 'number' && !isNaN(item.invoiceValue) ? item.invoiceValue : 0;
                  const noteTax = val * (taxRate / 100);
                  const noteNet = val - noteTax;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-bold text-blue-600 dark:text-blue-400">
                        {item.invoiceNumber || 'S/N'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.invoiceDate || 'Data N/D'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">
                          {item.clientName || 'Cliente não identificado'}
                        </div>
                        {item.cnpj && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {item.cnpj}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatBRL(val)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-amber-600 dark:text-amber-400">
                        {formatBRL(noteTax)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatBRL(noteNet)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            item.status === 'PROCESSADO'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onViewInvoiceDetails(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] transition-colors"
                        >
                          Detalhes
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

      {/* Informações Tributárias Didáticas (Aviso Amigável) */}
      <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 dark:bg-amber-950/20 dark:border-amber-900/40 flex items-start gap-3.5">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            Nota de orientação sobre o cálculo estimado:
          </p>
          <p>
            Este simulador realiza uma estimativa gerencial baseada na soma das notas fiscais geradas e na alíquota percentual que você configurou. No Brasil, o valor final a recolher no <strong>DAS (Simples Nacional)</strong> ou <strong>DARF (Lucro Presumido)</strong> pode variar de acordo com:
          </p>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11px] text-slate-500 dark:text-slate-400">
            <li>Faixa progressiva da tabela do Simples Nacional baseada no faturamento dos últimos 12 meses (RBT12).</li>
            <li>Eventuais retenções na fonte de impostos (como ISS, IRRF, PIS, COFINS, CSLL) pagas pelo tomador do serviço.</li>
            <li>Fator R para empresas de tecnologia e consultoria (folha de pagamento vs faturamento).</li>
          </ul>
          <p className="pt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Dica: Utilize o botão <strong>"Copiar p/ Contador"</strong> no topo para enviar facilmente o faturamento consolidado e a lista de notas para o seu profissional contábil!
          </p>
        </div>
      </div>
    </div>
  );
};
