import React, { useState, useEffect } from 'react';
import {
  Send,
  Mail,
  MessageSquare,
  Check,
  Copy,
  ExternalLink,
  Users,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Phone,
  AtSign,
  Sparkles,
  Edit2,
  RefreshCw,
  FolderOpen,
  DollarSign,
  Download,
  FileCheck,
  Paperclip,
  Share2,
} from 'lucide-react';
import { Client, HistoryRecord } from '../types';
import { db } from '../services/db';
import { downloadInvoicePdf, downloadInvoicesZip, shareInvoicePdfOrZip } from '../services/pdfGenerator';

export const SendInvoicesPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedClientCnpj, setSelectedClientCnpj] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'email'>('whatsapp');

  // Contact inline editing
  const [editingContactCnpj, setEditingContactCnpj] = useState<string | null>(null);
  const [tempEmail, setTempEmail] = useState('');
  const [tempPhone, setTempPhone] = useState('');

  // Copy notification toast state
  const [copiedSuccess, setCopiedSuccess] = useState<string | null>(null);

  // Template state
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    'Olá, *{cliente}*!\n\n' +
      'Seguem as notas fiscais referentes a *{mes_ano}*:\n\n' +
      '{lista_notas}\n\n' +
      '💰 *Valor Total:* {valor_total}\n' +
      '📄 *Total de Notas:* {total_notas} arquivo(s)\n\n' +
      'Qualquer dúvida, estamos à disposição!'
  );

  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState(
    'Notas Fiscais - {cliente} - {mes_ano}'
  );

  const [emailBodyTemplate, setEmailBodyTemplate] = useState(
    'Prezados,\n\n' +
      'Encaminhamos o resumo das notas fiscais emitidas/organizadas para a empresa {cliente} em {mes_ano}:\n\n' +
      '{lista_notas}\n\n' +
      'Resumo Financeiro:\n' +
      '- Total de Documentos: {total_notas}\n' +
      '- Valor Total das Notas: {valor_total}\n\n' +
      'Atenciosamente,\n' +
      'Departamento Financeiro / Contabilidade'
  );

  const loadData = () => {
    const loadedClients = db.getClients();
    const loadedHistory = db.getHistory().filter((h) => h.status === 'PROCESSADO');
    setClients(loadedClients);
    setHistory(loadedHistory);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter clients with history
  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.customName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.cnpj.includes(searchQuery) ||
      (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (client.phone && client.phone.includes(searchQuery));
    return matchesSearch;
  });

  // Records filtered by selected client
  const activeRecords = history.filter((record) => {
    if (selectedClientCnpj === 'ALL') return true;
    return record.cleanCnpj === selectedClientCnpj;
  });

  // Currently selected records for dispatch
  const selectedRecords = activeRecords.filter((r) => selectedRecordIds.includes(r.id));

  // Determine target client for dispatch preview
  const targetClient: Client | undefined =
    selectedClientCnpj !== 'ALL'
      ? clients.find((c) => c.cleanCnpj === selectedClientCnpj)
      : selectedRecords.length > 0
      ? clients.find((c) => c.cleanCnpj === selectedRecords[0].cleanCnpj)
      : undefined;

  // Toggle record selection
  const toggleSelectRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === activeRecords.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(activeRecords.map((r) => r.id));
    }
  };

  // Helper formatting
  const formatCurrency = (val: number | null): string => {
    if (val === null || val === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  // Generate Message Content
  const generateFormattedMessage = (type: 'whatsapp' | 'email_body' | 'email_subject') => {
    const clientName = targetClient ? targetClient.customName : 'Cliente';
    const recordList = selectedRecords.length > 0 ? selectedRecords : activeRecords;

    const totalVal = recordList.reduce((acc, r) => acc + (r.invoiceValue || 0), 0);
    const totalCount = recordList.length;

    const nowMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const formattedMonth = nowMonth.charAt(0).toUpperCase() + nowMonth.slice(1);

    let notesListText = '';
    if (type === 'whatsapp') {
      notesListText = recordList
        .map(
          (r) =>
            `• *NF nº ${r.invoiceNumber || 'S/N'}* | Emissão: ${r.invoiceDate || '-'} | Valor: *${formatCurrency(r.invoiceValue)}*`
        )
        .join('\n');
    } else {
      notesListText = recordList
        .map(
          (r) =>
            `  - NF nº ${r.invoiceNumber || 'S/N'} (${r.invoiceDate || 'Data N/I'}): ${formatCurrency(r.invoiceValue)}`
        )
        .join('\n');
    }

    let template =
      type === 'whatsapp'
        ? whatsappTemplate
        : type === 'email_subject'
        ? emailSubjectTemplate
        : emailBodyTemplate;

    return template
      .replace(/{cliente}/g, clientName)
      .replace(/{mes_ano}/g, formattedMonth)
      .replace(/{valor_total}/g, formatCurrency(totalVal))
      .replace(/{total_notas}/g, totalCount.toString())
      .replace(/{lista_notas}/g, notesListText || '(Nenhuma nota selecionada)');
  };

  // Dispatch Actions
  const handleOpenWhatsapp = () => {
    if (!targetClient || !targetClient.phone) {
      alert('Por favor, informe o número de WhatsApp do cliente antes de enviar.');
      return;
    }

    const cleanPhone = targetClient.phone.replace(/\D/g, '');
    const phoneWithDdd = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = generateFormattedMessage('whatsapp');

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phoneWithDdd}&text=${encodeURIComponent(
      text
    )}`;

    window.open(whatsappUrl, '_blank');

    // Automatically record dispatch
    const recordIdsToMark = (selectedRecords.length > 0 ? selectedRecords : activeRecords).map(
      (r) => r.id
    );
    db.updateHistoryDispatchStatus(recordIdsToMark, 'whatsapp');
    loadData();
  };

  const handleOpenEmail = () => {
    if (!targetClient || !targetClient.email) {
      alert('Por favor, informe o e-mail do cliente antes de enviar.');
      return;
    }

    const email = targetClient.email.trim();
    const subject = generateFormattedMessage('email_subject');
    const body = generateFormattedMessage('email_body');

    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailtoUrl;

    // Automatically record dispatch
    const recordIdsToMark = (selectedRecords.length > 0 ? selectedRecords : activeRecords).map(
      (r) => r.id
    );
    db.updateHistoryDispatchStatus(recordIdsToMark, 'email');
    loadData();
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSuccess(label);
    setTimeout(() => setCopiedSuccess(null), 3000);
  };

  const handleMarkAsDispatched = (channel: 'whatsapp' | 'email') => {
    const recordIdsToMark = (selectedRecords.length > 0 ? selectedRecords : activeRecords).map(
      (r) => r.id
    );
    if (recordIdsToMark.length === 0) return;

    db.updateHistoryDispatchStatus(recordIdsToMark, channel);
    loadData();
    setCopiedSuccess(`Status atualizado como enviado via ${channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}!`);
    setTimeout(() => setCopiedSuccess(null), 3000);
  };

  // Save quick edit for client contact
  const handleSaveContactEdit = (client: Client) => {
    db.addOrUpdateClient({
      cnpj: client.cleanCnpj,
      customName: client.customName,
      email: tempEmail,
      phone: tempPhone,
    });
    setEditingContactCnpj(null);
    loadData();
  };

  const handleStartEditContact = (client: Client) => {
    setEditingContactCnpj(client.cleanCnpj);
    setTempEmail(client.email || '');
    setTempPhone(client.phone || '');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {copiedSuccess && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{copiedSuccess}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Send className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Enviar Notas aos Clientes
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Envio rápido e formatado de resumos de notas fiscais via WhatsApp e E-mail.
          </p>
        </div>

        {/* Channel Selector Pills */}
        <div className="flex items-center gap-2 bg-slate-200/70 p-1 rounded-xl">
          <button
            onClick={() => setActiveChannel('whatsapp')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeChannel === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={() => setActiveChannel('email')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeChannel === 'email'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>E-mail</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Client Selector & Notes List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Client Filter Box */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
              1. Selecionar Cliente
            </label>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente por nome ou CNPJ..."
                className="w-full pl-9 pr-3.5 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              <button
                onClick={() => {
                  setSelectedClientCnpj('ALL');
                  setSelectedRecordIds([]);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                  selectedClientCnpj === 'ALL'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>Todos os Clientes</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {history.length} notas
                </span>
              </button>

              {filteredClients.map((client) => {
                const clientNotesCount = history.filter(
                  (h) => h.cleanCnpj === client.cleanCnpj
                ).length;
                const isSelected = selectedClientCnpj === client.cleanCnpj;

                return (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClientCnpj(client.cleanCnpj);
                      const clientNotes = history.filter((h) => h.cleanCnpj === client.cleanCnpj);
                      setSelectedRecordIds(clientNotes.map((n) => n.id));
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <p className="truncate">{client.customName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{client.cnpj}</p>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                        clientNotesCount > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {clientNotesCount} notas
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact Details Card for Selected Client */}
          {targetClient && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 truncate">
                    {targetClient.customName}
                  </h3>
                </div>
                {editingContactCnpj !== targetClient.cleanCnpj && (
                  <button
                    onClick={() => handleStartEditContact(targetClient)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar contatos
                  </button>
                )}
              </div>

              {editingContactCnpj === targetClient.cleanCnpj ? (
                <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                      E-mail do Cliente:
                    </label>
                    <input
                      type="email"
                      value={tempEmail}
                      onChange={(e) => setTempEmail(e.target.value)}
                      placeholder="financeiro@empresa.com"
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                      WhatsApp / Celular:
                    </label>
                    <input
                      type="text"
                      value={tempPhone}
                      onChange={(e) => setTempPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingContactCnpj(null)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSaveContactEdit(targetClient)}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        WhatsApp
                      </span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {targetClient.phone || 'Não informado'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">
                        E-mail
                      </span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {targetClient.email || 'Não informado'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes Selection Table */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                2. Selecionar Notas ({selectedRecords.length > 0 ? selectedRecords.length : activeRecords.length} de {activeRecords.length})
              </label>
              <button
                onClick={toggleSelectAll}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                {selectedRecordIds.length === activeRecords.length ? 'Desmarcar Todas' : 'Marcar Todas'}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {activeRecords.length > 0 ? (
                activeRecords.map((record) => {
                  const isChecked =
                    selectedRecordIds.length === 0 || selectedRecordIds.includes(record.id);

                  return (
                    <div
                      key={record.id}
                      onClick={() => toggleSelectRecord(record.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isChecked
                          ? 'bg-blue-50/50 border-blue-200'
                          : 'bg-slate-50/50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by container onClick
                          className="rounded-xs border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="truncate">
                          <p className="font-bold text-slate-900 truncate">
                            NF {record.invoiceNumber || 'S/N'} - {record.clientName}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Emissão: {record.invoiceDate || 'N/I'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadInvoicePdf(record);
                          }}
                          title="Baixar arquivo PDF desta nota"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <div className="text-right">
                          <span className="font-mono font-bold text-emerald-700 block">
                            {formatCurrency(record.invoiceValue)}
                          </span>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {record.sentWhatsappAt && (
                              <span
                                title={`Enviado via WhatsApp em ${new Date(record.sentWhatsappAt).toLocaleDateString()}`}
                                className="w-2 h-2 rounded-full bg-emerald-500"
                              />
                            )}
                            {record.sentEmailAt && (
                              <span
                                title={`Enviado via E-mail em ${new Date(record.sentEmailAt).toLocaleDateString()}`}
                                className="w-2 h-2 rounded-full bg-blue-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <FileText className="w-6 h-6 mx-auto mb-1 opacity-30" />
                  <p className="text-xs font-medium">Nenhuma nota processada encontrada.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Dispatch Preview & Action Panel (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            {/* Action Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {activeChannel === 'whatsapp' ? (
                  <MessageSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                )}
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Pré-visualização e Anexo ({activeChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Mensagem pré-formatada + download direto do arquivo PDF/ZIP.
                  </p>
                </div>
              </div>

              {/* Quick Channel & Download Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={async () => {
                    const list = selectedRecords.length > 0 ? selectedRecords : activeRecords;
                    if (list.length === 0) {
                      alert('Nenhuma nota selecionada.');
                      return;
                    }
                    const bundleName = targetClient ? targetClient.customName : 'Notas_Fiscais';
                    const msgText = generateFormattedMessage(activeChannel === 'whatsapp' ? 'whatsapp' : 'email_body');
                    const shared = await shareInvoicePdfOrZip(list, bundleName, msgText);
                    if (shared) {
                      setCopiedSuccess('Arquivo compartilhado com sucesso!');
                      setTimeout(() => setCopiedSuccess(null), 3000);
                    } else {
                      // Fallback: download PDF/ZIP and alert
                      if (list.length === 1) {
                        downloadInvoicePdf(list[0]);
                      } else {
                        await downloadInvoicesZip(list, bundleName);
                      }
                      alert(
                        'O arquivo PDF/ZIP foi baixado! Agora abra o WhatsApp/E-mail e selecione este arquivo baixado como anexo.'
                      );
                    }
                  }}
                  title="Compartilha o arquivo PDF/ZIP diretamente no aplicativo (WhatsApp, E-mail, etc)"
                  className="px-3.5 py-2 rounded-xl font-bold text-xs bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Compartilhar Arquivo Direto</span>
                </button>

                <button
                  onClick={async () => {
                    const list = selectedRecords.length > 0 ? selectedRecords : activeRecords;
                    if (list.length === 1) {
                      downloadInvoicePdf(list[0]);
                    } else if (list.length > 1) {
                      const name = targetClient ? targetClient.customName : 'Clientes';
                      await downloadInvoicesZip(list, name);
                    } else {
                      alert('Nenhuma nota selecionada para baixar.');
                    }
                  }}
                  title="Baixar arquivos de notas selecionadas em PDF ou ZIP"
                  className="px-3.5 py-2 rounded-xl font-bold text-xs bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>
                    {(selectedRecords.length > 0 ? selectedRecords : activeRecords).length > 1
                      ? 'Baixar ZIP de Notas'
                      : 'Baixar PDF da Nota'}
                  </span>
                </button>

                {activeChannel === 'whatsapp' ? (
                  <button
                    onClick={handleOpenWhatsapp}
                    id="btn-send-whatsapp-main"
                    className="px-4 py-2 rounded-xl font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar Texto no WhatsApp</span>
                  </button>
                ) : (
                  <button
                    onClick={handleOpenEmail}
                    id="btn-send-email-main"
                    className="px-4 py-2 rounded-xl font-bold text-xs bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>Enviar Texto por E-mail</span>
                  </button>
                )}
              </div>
            </div>

            {/* Attachment Instructions Banner */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Paperclip className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Como enviar os arquivos PDF anexados junto com a mensagem:</span>
              </div>
              <ol className="list-decimal list-inside text-[11px] leading-relaxed text-amber-800 font-medium space-y-0.5">
                <li>
                  Clique em <strong>"Baixar PDF da Nota"</strong> (ou ZIP) para salvar o arquivo original organizado no seu computador.
                </li>
                <li>
                  Clique no botão <strong>"Enviar no {activeChannel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}"</strong> para abrir o app com o texto pronto.
                </li>
                <li>
                  No WhatsApp/E-mail, clique no ícone de <strong>clipe / anexo</strong> e selecione o PDF que você acabou de baixar!
                </li>
              </ol>
            </div>

            {/* Email Subject Line (If Email active) */}
            {activeChannel === 'email' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Assunto do E-mail:</label>
                <input
                  type="text"
                  value={generateFormattedMessage('email_subject')}
                  readOnly
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                />
              </div>
            )}

            {/* Formatted Message Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">Conteúdo Gerado:</label>
                <button
                  onClick={() =>
                    handleCopyToClipboard(
                      generateFormattedMessage(activeChannel === 'whatsapp' ? 'whatsapp' : 'email_body'),
                      'Texto copiado para a área de transferência!'
                    )
                  }
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar Texto</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto border border-slate-800 shadow-inner select-all">
                {generateFormattedMessage(activeChannel === 'whatsapp' ? 'whatsapp' : 'email_body')}
              </div>
            </div>

            {/* Dispatch Tools & Manual Status Update */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Status de envio:{' '}
                  <strong>
                    {(selectedRecords.length > 0 ? selectedRecords : activeRecords).filter(
                      (r) => (activeChannel === 'whatsapp' ? r.sentWhatsappAt : r.sentEmailAt)
                    ).length}{' '}
                    de {(selectedRecords.length > 0 ? selectedRecords : activeRecords).length} enviadas
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleMarkAsDispatched(activeChannel)}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Marcar como Enviado</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
