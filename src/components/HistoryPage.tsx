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
} from 'lucide-react';
import { HistoryRecord } from '../types';
import { db } from '../services/db';

interface HistoryPageProps {
  onViewInvoiceDetails: (record: HistoryRecord) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onViewInvoiceDetails }) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedClient, setSelectedClient] = useState<string>('ALL');

  const loadHistory = () => {
    setHistory(db.getHistory());
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleClearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o histórico de processamento?')) {
      db.clearHistory();
      loadHistory();
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
      `"${h.targetPath.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `historico_notas_fiscais_${new Date().toISOString().slice(0, 10)}.csv`);
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Processado
          </span>
        );
      case 'REVISAR':
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
            <AlertTriangle className="w-3 h-3" /> Revisão
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
            <XCircle className="w-3 h-3" /> Erro
          </span>
        );
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <History className="w-6 h-6 text-blue-600" /> Histórico de Processamento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Registro detalhado de todas as notas analisadas, organizadas e renomeadas.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            id="btn-export-history-csv"
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" /> Exportar Relatório CSV
          </button>
          <button
            id="btn-clear-history"
            onClick={handleClearHistory}
            disabled={history.length === 0}
            className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Limpar
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-history"
            type="text"
            placeholder="Pesquisar por arquivo, cliente, CNPJ ou número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <select
            id="select-history-client-filter"
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Todos os Status</option>
            <option value="PROCESSADO">Processados</option>
            <option value="REVISAR">Revisão Pendente</option>
            <option value="ERRO">Erros</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
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
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="space-y-0.5 max-w-xs truncate">
                        <span className="font-bold text-slate-900 block truncate" title={item.generatedFileName}>
                          {item.generatedFileName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono block truncate" title={item.originalFileName}>
                          {item.originalFileName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-800">{item.clientName}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-600">{item.cnpj || '-'}</td>
                    <td className="py-3.5 px-6 font-mono text-slate-800">{item.invoiceNumber || 'S_N'}</td>
                    <td className="py-3.5 px-6 text-slate-600">{item.invoiceDate}</td>
                    <td className="py-3.5 px-6 font-bold text-emerald-700">{item.invoiceValueFormatted}</td>
                    <td className="py-3.5 px-6">{getStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        id={`btn-view-history-detail-${item.id}`}
                        onClick={() => onViewInvoiceDetails(item)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors inline-flex items-center gap-1 font-semibold text-[11px]"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Nenhum registro no histórico de processamento.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
