import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  FileText,
  Calendar,
  CalendarDays,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  Sparkles,
  Edit2,
  X,
  Check,
  Layers,
  List,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { db } from '../services/db';
import { PdfViewerModal } from './PdfViewerModal';
import { formatCNPJ, cleanCNPJ } from '../utils/cnpjValidator';
import {
  groupHistoryByMonth,
  parseYearMonthFromRecord,
  formatBRL,
} from '../utils/monthUtils';

interface HistoryPageProps {
  onViewInvoiceDetails: (record: HistoryRecord) => void;
  onOpenResetModal?: () => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  onViewInvoiceDetails,
  onOpenResetModal,
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [groupByMonth, setGroupByMonth] = useState<boolean>(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [selectedPdfToView, setSelectedPdfToView] = useState<HistoryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);

  // Modal de edição manual de registro
  const [editingItem, setEditingItem] = useState<HistoryRecord | null>(null);
  const [editClientName, setEditClientName] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editInvoiceValue, setEditInvoiceValue] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    const records = await db.fetchRemoteHistory();
    setHistory(records);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const issuerCnpj = cleanCNPJ(db.getSettings().issuerCnpj || '47042028000155');
  const hasMisidentifiedNotes = history.some(
    (h) =>
      h.clientName.toUpperCase().includes('RENE WILLIAN') ||
      (issuerCnpj && h.cleanCnpj === issuerCnpj) ||
      h.clientName === 'CLIENTE_DESCONHECIDO'
  );

  const handleAutoFixAll = () => {
    setFixing(true);
    try {
      const result = db.reprocessAndFixAllHistory();
      setFixSuccessMessage(result.message);
      loadHistory();
      setTimeout(() => setFixSuccessMessage(null), 6000);
    } catch (e: any) {
      alert('Erro ao reprocessar notas: ' + e.message);
    } finally {
      setFixing(false);
    }
  };

  const handleOpenEdit = (item: HistoryRecord) => {
    setEditingItem(item);
    setEditClientName(item.clientName);
    setEditCnpj(item.cnpj || '');
    setEditInvoiceNumber(item.invoiceNumber || '');
    setEditInvoiceDate(item.invoiceDate || '');
    setEditInvoiceValue(item.invoiceValue ? String(item.invoiceValue) : '');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const numVal = parseFloat(editInvoiceValue.replace(',', '.'));
    const valFormatted = !isNaN(numVal)
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numVal)
      : editingItem.invoiceValueFormatted;

    const cleanC = cleanCNPJ(editCnpj);
    const formattedC = cleanC.length === 14 ? formatCNPJ(cleanC) : editCnpj;

    const updated = db.updateHistoryRecord(editingItem.id, {
      clientName: editClientName.trim() || editingItem.clientName,
      cnpj: formattedC,
      cleanCnpj: cleanC,
      invoiceNumber: editInvoiceNumber.trim() || editingItem.invoiceNumber,
      invoiceDate: editInvoiceDate.trim() || editingItem.invoiceDate,
      invoiceValue: !isNaN(numVal) ? numVal : editingItem.invoiceValue,
      invoiceValueFormatted: valFormatted,
      status: 'PROCESSADO',
    });

    if (updated) {
      if (editClientName.trim()) {
        db.addOrUpdateClient({
          cnpj: formattedC || '00.000.000/0000-00',
          customName: editClientName.trim(),
          razaoSocial: editClientName.trim(),
        });
      }
      loadHistory();
      setEditingItem(null);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico de processamento?')) {
      db.clearHistory();
      setHistory([]);
    }
  };

  const handleExportCSV = () => {
    const recordsToExport = filteredHistory.length > 0 ? filteredHistory : history;
    if (recordsToExport.length === 0) return;

    const headers = [
      'Data Processamento',
      'Arquivo Original',
      'Arquivo Gerado',
      'Cliente (Tomador)',
      'CNPJ / CPF',
      'Numero Nota',
      'Data Emissao',
      'Valor Formatado',
      'Valor Numerico (R$)',
      'Status',
      'Caminho Destino',
    ];

    const rows = recordsToExport.map((h) => [
      h.processedAt ? new Date(h.processedAt).toLocaleString('pt-BR') : '',
      `"${h.originalFileName.replace(/"/g, '""')}"`,
      `"${h.generatedFileName.replace(/"/g, '""')}"`,
      `"${h.clientName.replace(/"/g, '""')}"`,
      h.cnpj,
      h.invoiceNumber,
      h.invoiceDate,
      `"${h.invoiceValueFormatted}"`,
      (h.invoiceValue || 0).toFixed(2).replace('.', ','),
      h.status,
      `"${(h.targetPath || '').replace(/"/g, '""')}"`,
    ]);

    const totalVal = recordsToExport.reduce((acc, h) => acc + (h.invoiceValue || 0), 0);
    const avgVal = recordsToExport.length > 0 ? totalVal / recordsToExport.length : 0;

    const summaryRows = [
      [],
      ['--- RESUMO CONSOLIDADO ---'],
      ['Total de Notas', String(recordsToExport.length)],
      ['Valor Total Faturado', totalVal.toFixed(2).replace('.', ',')],
      ['Ticket Medio', avgVal.toFixed(2).replace('.', ',')],
      ['Competencia / Filtro', selectedMonth !== 'ALL' ? selectedMonth : 'Todos os meses'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [
        headers.join(';'),
        ...rows.map((e) => e.join(';')),
        ...summaryRows.map((e) => e.join(';')),
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const monthSuffix = selectedMonth !== 'ALL' ? `_${selectedMonth}` : '';
    link.setAttribute(
      'download',
      `historico_notas_fiscais${monthSuffix}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueClients = Array.from(new Set(history.map((h) => h.clientName))).filter(Boolean);

  const allMonthlyGroups = useMemo(() => {
    return groupHistoryByMonth(history);
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        item.originalFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.generatedFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.cnpj && item.cnpj.includes(searchQuery)) ||
        (item.invoiceNumber && item.invoiceNumber.includes(searchQuery));

      const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
      const matchesClient = selectedClient === 'ALL' || item.clientName === selectedClient;
      
      const recordMonth = parseYearMonthFromRecord(item).monthKey;
      const matchesMonth = selectedMonth === 'ALL' || recordMonth === selectedMonth;

      return matchesSearch && matchesStatus && matchesClient && matchesMonth;
    });
  }, [history, searchQuery, selectedStatus, selectedClient, selectedMonth]);

  const totalFilteredValue = useMemo(() => {
    return filteredHistory.reduce((sum, h) => sum + (h.invoiceValue || 0), 0);
  }, [filteredHistory]);

  const averageFilteredValue = useMemo(() => {
    return filteredHistory.length > 0 ? totalFilteredValue / filteredHistory.length : 0;
  }, [filteredHistory, totalFilteredValue]);

  const filteredMonthlyGroups = useMemo(() => {
    return groupHistoryByMonth(filteredHistory);
  }, [filteredHistory]);

  const toggleMonthCollapse = (monthKey: string) => {
    setCollapsedMonths((prev) => ({
      ...prev,
      [monthKey]: !prev[monthKey],
    }));
  };

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

  const renderInvoiceRow = (item: HistoryRecord) => (
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
        {item.clientName.toUpperCase().includes('RENE WILLIAN') && (
          <span className="text-[10px] text-amber-600 font-medium block">
            Emissor atribuído
          </span>
        )}
      </td>
      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
        {item.cnpj || '-'}
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
            id={`btn-edit-history-${item.id}`}
            onClick={() => handleOpenEdit(item)}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
            title="Editar cliente ou dados"
          >
            <Edit2 className="w-3 h-3 text-slate-400" /> Editar
          </button>
          <button
            id={`btn-view-pdf-history-${item.id}`}
            onClick={() => setSelectedPdfToView(item)}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
            title="Visualizar PDF"
          >
            <FileText className="w-3 h-3 text-rose-500" /> PDF
          </button>
          <button
            id={`btn-view-history-detail-${item.id}`}
            onClick={() => onViewInvoiceDetails(item)}
            className="px-2 py-1 rounded-md text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3 h-3 text-blue-500" /> Detalhes
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Histórico de Processamento
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registro unificado de todas as notas fiscais organizadas no sistema.
          </p>
        </div>

        {/* Ações Discretas */}
        <div className="flex items-center gap-2 flex-wrap">
          {hasMisidentifiedNotes && (
            <button
              id="btn-reprocess-fix-history"
              onClick={handleAutoFixAll}
              disabled={fixing || history.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
              title="Reidentificar automaticamente tomadores"
            >
              <Sparkles className={`w-3.5 h-3.5 ${fixing ? 'animate-spin' : ''}`} />
              <span>{fixing ? 'Reidentificando...' : 'Reidentificar'}</span>
            </button>
          )}

          <button
            onClick={loadHistory}
            title="Recarregar"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-export-history-csv"
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>

          <button
            id="btn-clear-history"
            onClick={() => {
              if (onOpenResetModal) {
                onOpenResetModal();
              } else {
                handleClearHistory();
              }
            }}
            disabled={history.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar</span>
          </button>
        </div>
      </div>

      {/* Banner de Feedback Discreto */}
      {fixSuccessMessage && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{fixSuccessMessage}</span>
          </div>
          <button
            onClick={() => setFixSuccessMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hero Card com Métricas e Ícones Coloridos */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                Total filtrado
              </span>
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 font-mono tabular-nums">
              {filteredHistory.length} {filteredHistory.length === 1 ? 'nota' : 'notas'}
            </div>
            <div className="text-[11px] text-slate-400">
              {history.length} notas no histórico total
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Faturamento filtrado
              </span>
              <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              {formatBRL(totalFilteredValue)}
            </div>
            <div className="text-[11px] text-slate-400">
              Soma das notas exibidas
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                Ticket médio
              </span>
              <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-purple-700 dark:text-purple-300 font-mono tabular-nums">
              {formatBRL(averageFilteredValue)}
            </div>
            <div className="text-[11px] text-slate-400">
              Média por nota fiscal
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Minimalista */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-search-history"
              type="text"
              placeholder="Pesquisar nota ou cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-slate-400"
            />
          </div>

          <div>
            <select
              id="select-history-month-filter"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400"
            >
              <option value="ALL">Todos os meses ({allMonthlyGroups.length})</option>
              {allMonthlyGroups.map((group) => (
                <option key={group.monthKey} value={group.monthKey}>
                  {group.label} ({group.totalInvoices})
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              id="select-history-client-filter"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400"
            >
              <option value="ALL">Todos os clientes</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              id="select-history-status-filter"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400"
            >
              <option value="ALL">Todos os status</option>
              <option value="PROCESSADO">Processados</option>
              <option value="REVISAR">Revisão</option>
              <option value="ERRO">Erros</option>
            </select>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="text-slate-400 font-medium">
            Mostrando {filteredHistory.length} de {history.length} notas
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              id="btn-view-flat"
              onClick={() => setGroupByMonth(false)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                !groupByMonth
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lista contínua
            </button>
            <button
              type="button"
              id="btn-view-grouped"
              onClick={() => setGroupByMonth(true)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                groupByMonth
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Agrupado por mês
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo do Histórico */}
      {groupByMonth ? (
        <div className="space-y-4">
          {filteredMonthlyGroups.length > 0 ? (
            filteredMonthlyGroups.map((group) => {
              const isCollapsed = Boolean(collapsedMonths[group.monthKey]);
              return (
                <div
                  key={group.monthKey}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden"
                >
                  <div
                    onClick={() => toggleMonthCollapse(group.monthKey)}
                    className="p-3.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {group.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        · {group.totalInvoices} {group.totalInvoices === 1 ? 'nota' : 'notas'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold text-xs text-slate-900 dark:text-white tabular-nums">
                        {group.totalValueFormatted}
                      </span>
                      <div className="text-slate-400">
                        {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                          <tr>
                            <th className="py-2.5 px-4">Arquivo</th>
                            <th className="py-2.5 px-4">Cliente</th>
                            <th className="py-2.5 px-4">CNPJ</th>
                            <th className="py-2.5 px-4">Número</th>
                            <th className="py-2.5 px-4">Emissão</th>
                            <th className="py-2.5 px-4 text-right">Valor</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {group.records.map((item) => renderInvoiceRow(item))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-slate-400 text-xs">
              Nenhum registro encontrado para os filtros selecionados.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Arquivo</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4">Número</th>
                  <th className="py-3 px-4">Emissão</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((item) => renderInvoiceRow(item))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <History className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="font-medium text-xs">Nenhum registro no histórico de processamento.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Edição Manual de Nota */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Editar Dados da Nota
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Cliente / Tomador *
                </label>
                <input
                  type="text"
                  required
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  placeholder="Ex: TREND COMUNICACAO DIGITAL LTDA"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400 font-semibold uppercase"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  CNPJ ou CPF do Cliente
                </label>
                <input
                  type="text"
                  value={editCnpj}
                  onChange={(e) => setEditCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Número da Nota
                  </label>
                  <input
                    type="text"
                    value={editInvoiceNumber}
                    onChange={(e) => setEditInvoiceNumber(e.target.value)}
                    placeholder="Ex: 7"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Data de Emissão
                  </label>
                  <input
                    type="text"
                    value={editInvoiceDate}
                    onChange={(e) => setEditInvoiceDate(e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Valor Total (R$)
                </label>
                <input
                  type="text"
                  value={editInvoiceValue}
                  onChange={(e) => setEditInvoiceValue(e.target.value)}
                  placeholder="Ex: 800.00"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-slate-400 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
