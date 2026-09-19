import React, { useState, useEffect } from 'react';
import {
  Send,
  FileText,
  Search,
  Eye,
  Copy,
  Check,
  MessageSquare,
  ShieldCheck,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  Building2,
  Database,
} from 'lucide-react';
import { db } from '../services/db';
import { HistoryRecord, SupabaseStatusResult } from '../types';
import { storageService } from '../services/storageService';
import { PdfViewerModal } from './PdfViewerModal';

export const SendInvoicesPage: React.FC = () => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordForView, setSelectedRecordForView] = useState<HistoryRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatusResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal de envio individual de WhatsApp
  const [whatsAppModalRecord, setWhatsAppModalRecord] = useState<HistoryRecord | null>(null);
  const [customPhone, setCustomPhone] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    // Sincroniza com Supabase se disponível
    const remoteRecords = await db.fetchRemoteHistory();
    setHistory(remoteRecords);
    const status = await storageService.getStatus();
    setSupabaseStatus(status);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRecords = history.filter((rec) => {
    const q = searchQuery.toLowerCase();
    return (
      rec.clientName.toLowerCase().includes(q) ||
      rec.cnpj.includes(q) ||
      rec.invoiceNumber.toLowerCase().includes(q) ||
      rec.originalFileName.toLowerCase().includes(q) ||
      rec.generatedFileName.toLowerCase().includes(q)
    );
  });

  const handleCopyLink = (record: HistoryRecord) => {
    const viewUrl = storageService.getPdfViewUrl(record);
    const fullUrl = viewUrl.startsWith('http') ? viewUrl : `${window.location.origin}${viewUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleOpenWhatsAppModal = (record: HistoryRecord) => {
    const clients = db.getClients();
    const client = clients.find((c) => c.cleanCnpj === record.cleanCnpj);
    const phone = client?.phone || '';

    const viewUrl = storageService.getPdfViewUrl(record);
    const fullUrl = viewUrl.startsWith('http') ? viewUrl : `${window.location.origin}${viewUrl}`;

    const defaultMsg = `Olá, ${record.clientName}! Segue a sua Nota Fiscal nº ${record.invoiceNumber} (Valor: ${record.invoiceValueFormatted}) emitida em ${record.invoiceDate}.\n\nVocê pode visualizar e baixar o documento fiscal original diretamente pelo link seguro do nosso Supabase Storage:\n${fullUrl}\n\nFicamos à disposição!`;

    setWhatsAppModalRecord(record);
    setCustomPhone(phone);
    setCustomMessage(defaultMsg);
  };

  const handleSendWhatsApp = () => {
    if (!whatsAppModalRecord) return;

    const cleanPhone = customPhone.replace(/\D/g, '');
    const encodedText = encodeURIComponent(customMessage);
    const waUrl = cleanPhone
      ? `https://wa.me/55${cleanPhone}?text=${encodedText}`
      : `https://wa.me/?text=${encodedText}`;

    window.open(waUrl, '_blank');

    db.updateHistoryDispatchStatus([whatsAppModalRecord.id], 'whatsapp');
    setWhatsAppModalRecord(null);
    loadData();
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Enviar Notas Fiscais
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
              <Database className="w-3 h-3" />
              Supabase Storage
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Envio dos arquivos PDF originais armazenados no Supabase Storage Privado (<strong className="font-semibold text-slate-700 dark:text-slate-300">{supabaseStatus?.bucket || 'notas-fiscais'}</strong>).
          </p>
        </div>

        {/* Status Chip */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-2.5 text-xs">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                supabaseStatus?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200 block leading-tight">
                Supabase: {supabaseStatus?.bucket || 'notas-fiscais'}
              </span>
              <span className="text-[10px] text-slate-400">
                {supabaseStatus?.connected
                  ? 'Nuvem Conectada (Privado)'
                  : 'Buffer Seguro Ativo'}
              </span>
            </div>
          </div>

          <button
            onClick={loadData}
            title="Atualizar lista"
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por cliente, CNPJ, número de nota ou nome de arquivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {filteredRecords.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredRecords.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* File info */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {item.generatedFileName}
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                        <ShieldCheck className="w-3 h-3" />
                        PDF Original no Supabase
                      </span>
                      {item.sentWhatsappAt && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                          <Check className="w-2.5 h-2.5" />
                          Enviado via WhatsApp
                        </span>
                      )}
                      {item.syncedToSupabase && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
                          Banco Sincronizado
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {item.clientName}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">{item.cnpj}</span>
                      <span>•</span>
                      <span>NF nº <strong>{item.invoiceNumber}</strong></span>
                      <span>•</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {item.invoiceValueFormatted}
                      </span>
                    </div>

                    <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
                      Original: {item.originalFileName}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                  <button
                    id={`btn-view-supabase-pdf-${item.id}`}
                    onClick={() => setSelectedRecordForView(item)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visualizar PDF</span>
                  </button>

                  <button
                    id={`btn-copy-supabase-link-${item.id}`}
                    onClick={() => handleCopyLink(item)}
                    title="Copiar link seguro do PDF"
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Link</span>
                      </>
                    )}
                  </button>

                  <button
                    id={`btn-send-whatsapp-${item.id}`}
                    onClick={() => handleOpenWhatsAppModal(item)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500 space-y-3">
            <FileText className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
            <p className="font-semibold text-sm">Nenhuma nota fiscal encontrada para envio.</p>
            <p className="text-xs max-w-sm mx-auto">
              Processe e organize notas na aba &quot;Processar notas&quot;. Cada PDF original será automaticamente gravado no Supabase Storage e ficará pronto para visualização e envio.
            </p>
          </div>
        )}
      </div>

      {/* Modal de envio WhatsApp */}
      {whatsAppModalRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setWhatsAppModalRecord(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Enviar NF via WhatsApp
                </h3>
              </div>
              <button
                onClick={() => setWhatsAppModalRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Cliente Destinatário
                </label>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                  {whatsAppModalRecord.clientName} ({whatsAppModalRecord.cnpj})
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Telefone / WhatsApp com DDD (opcional para preenchimento direto)
                </label>
                <input
                  type="text"
                  placeholder="Ex: 11987654321"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">
                  Mensagem com Link do PDF Original no Supabase Storage
                </label>
                <textarea
                  rows={6}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono leading-relaxed text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200 flex items-start gap-2 text-[11px]">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <span>
                  O link enviado carrega o <strong>arquivo PDF original intacto</strong> diretamente do Supabase Storage. O cliente pode visualizar no navegador ou baixar o documento fiscal oficial.
                </span>
              </div>
            </div>

            <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
              <button
                onClick={() => setWhatsAppModalRecord(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendWhatsApp}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Abrir WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização do PDF Original */}
      {selectedRecordForView && (
        <PdfViewerModal
          item={selectedRecordForView}
          onClose={() => setSelectedRecordForView(null)}
        />
      )}
    </div>
  );
};
