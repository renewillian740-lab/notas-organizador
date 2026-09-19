import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  FileText,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  RefreshCw,
  Database,
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { db } from '../services/db';
import { PdfViewerModal } from './PdfViewerModal';

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
  const [selectedPdfToView, setSelectedPdfToView] = useState<HistoryRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    // Busca dados remotos do Supabase com fallback local
    const records = await db.fetchRemoteHistory();
    setHistory(records);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico de processamento?')) {
      db.clearHistory();
      setHistory([]);
    }
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;

    const headers = [
      'Data Processamento',
      'Arquivo Original',
      'Arquivo Gerado',
      'Cliente',
      'CNPJ',
      'Numero Nota',
      'Data Emissao',
      'Valor Formatado',
      'Status',
      'Caminho Destino',
      'Provedor Storage',
    ];

    const rows = history.map((h) => [
      h.processedAt ? new Date(h.processedAt).toLocaleString('pt-BR') : '',
      `"${h.originalFileName.replace(/"/g, '""')}"`,
      `"${h.generatedFileName.replace(/"/g, '""')}"`,
      `"${h.clientName.replace(/"/g, '""')}"`,
      h.cnpj,
      h.invoiceNumber,
      h.invoiceDate,
      `"${h.invoiceValueFormatted}"`,
      h.status,
      `"${(h.targetPath || '').replace(/"/g, '""')}"`,
      h.storageProvider || 'supabase',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historico_notas_fiscais_supabase_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const uniqueClients = Array.from(new Set(history.map((h) => h.clientName))).filter(Boolean);

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.originalFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.generatedFileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.cnpj.includes(searchQuery) ||
      item.invoiceNumber.includes(searchQuery);

    const matchesStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
    const matchesClient = selectedClient === 'ALL' || item.clientName === selectedClient;

    return matchesSearch && matchesStatus && matchesClient;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PROCESSADO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-3 h-3" /> Processado
          </span>
        );
      case 'REVISAR':
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" /> Revisão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300">
            <XCircle className="w-3 h-3" /> Erro
          </span>
        );
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
              <History className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Histórico de Processamento
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
              <Database className="w-3 h-3" /> Armazenamento Seguro
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Registro consolidado de todas as notas fiscais organizadas e seus respectivos arquivos PDF.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadHistory}
            title="Sincronizar com Supabase"
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            id="btn-export-history-csv"
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Exportar Relatório CSV
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
            className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" /> Zerar Tudo
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-history"
            type="text"
            placeholder="Pesquisar por arquivo, cliente, CNPJ ou número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
          />
        </div>

        <div>
          <select
            id="select-history-client-filter"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Todos os Clientes</option>
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
            className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PROCESSADO">Processados</option>
            <option value="REVISAR">Revisão Pendente</option>
            <option value="ERRO">Erros</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Arquivo Renomeado / Original</th>
                <th className="py-3.5 px-6">Cliente</th>
                <th className="py-3.5 px-6">CNPJ</th>
                <th className="py-3.5 px-6">Número</th>
                <th className="py-3.5 px-6">Data</th>
                <th className="py-3.5 px-6">Valor</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="space-y-0.5 max-w-xs truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block truncate" title={item.generatedFileName}>
                            {item.generatedFileName}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono block truncate" title={item.originalFileName}>
                          {item.originalFileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-800 dark:text-slate-200">{item.clientName}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-600 dark:text-slate-400">{item.cnpj || '-'}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-800 dark:text-slate-200">{item.invoiceNumber || 'S_N'}</td>
                    <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">{item.invoiceDate}</td>
                    <td className="py-3.5 px-6 font-bold text-emerald-700 dark:text-emerald-400">{item.invoiceValueFormatted}</td>
                    <td className="py-3.5 px-6">{getStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`btn-view-pdf-history-${item.id}`}
                          onClick={() => setSelectedPdfToView(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors inline-flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                          title="Visualizar PDF original no Supabase Storage"
                        >
                          <FileText className="w-3.5 h-3.5" /> Visualizar PDF
                        </button>
                        <button
                          id={`btn-view-history-detail-${item.id}`}
                          onClick={() => onViewInvoiceDetails(item)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors inline-flex items-center gap-1 font-semibold text-[11px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Nenhum registro no histórico de processamento.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
