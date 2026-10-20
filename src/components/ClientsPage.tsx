import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  X,
  AlertCircle,
} from 'lucide-react';
import { Client, HistoryRecord } from '../types';
import { db } from '../services/db';
import { formatCNPJ, cleanCNPJ, isValidCNPJ } from '../utils/cnpjValidator';

export const ClientsPage: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form states
  const [cnpjInput, setCnpjInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [razaoSocialInput, setRazaoSocialInput] = useState('');
  const [nomeFantasiaInput, setNomeFantasiaInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadClients = () => {
    setClients(db.getClients());
    setHistory(db.getHistory());
  };

  useEffect(() => {
    loadClients();
  }, []);

  const getClientTotalValue = (client: Client): number => {
    const historySum = history
      .filter((h) => h.cleanCnpj === client.cleanCnpj && h.invoiceValue && h.invoiceValue > 0)
      .reduce((acc, h) => acc + (h.invoiceValue || 0), 0);
    return Math.max(client.notesTotalValue || 0, historySum);
  };

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val || 0);
  };

  const openAddModal = () => {
    setEditingClient(null);
    setCnpjInput('');
    setCustomNameInput('');
    setRazaoSocialInput('');
    setNomeFantasiaInput('');
    setEmailInput('');
    setPhoneInput('');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setCnpjInput(client.cnpj);
    setCustomNameInput(client.customName);
    setRazaoSocialInput(client.razaoSocial || '');
    setNomeFantasiaInput(client.nomeFantasia || '');
    setEmailInput(client.email || '');
    setPhoneInput(client.phone || '');
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const handleSaveClient = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const clean = cleanCNPJ(cnpjInput);
    if (!clean) {
      setErrorMessage('Por favor, informe o CNPJ.');
      return;
    }

    if (!isValidCNPJ(clean)) {
      setErrorMessage('CNPJ inválido de acordo com as regras da Receita Federal.');
      return;
    }

    if (!customNameInput.trim()) {
      setErrorMessage('O nome do cliente é obrigatório.');
      return;
    }

    // Salva ou atualiza no banco
    db.addOrUpdateClient({
      cnpj: clean,
      customName: customNameInput.trim(),
      razaoSocial: razaoSocialInput.trim() || undefined,
      nomeFantasia: nomeFantasiaInput.trim() || undefined,
      email: emailInput.trim() || undefined,
      phone: phoneInput.trim() || undefined,
    });

    loadClients();
    setIsModalOpen(false);
  };

  const handleDeleteClient = (client: Client) => {
    if (
      window.confirm(
        `Tem certeza que deseja remover o cliente "${client.customName}" (${client.cnpj})?`
      )
    ) {
      db.deleteClient(client.id);
      loadClients();
    }
  };

  const filteredClients = clients.filter((c) => {
    const query = searchQuery.toLowerCase();
    return (
      c.customName.toLowerCase().includes(query) ||
      c.cleanCnpj.includes(cleanCNPJ(query)) ||
      (c.razaoSocial && c.razaoSocial.toLowerCase().includes(query)) ||
      (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(query))
    );
  });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Clientes
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastro de tomadores de serviços e associação de CNPJ para renomeação de pastas.
          </p>
        </div>

        <button
          id="btn-add-client-top"
          onClick={openAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo cliente</span>
        </button>
      </div>

      {/* Hero Card com Métricas Consolidadas */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Clientes cadastrados
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {clients.length}
            </div>
            <div className="text-[11px] text-slate-400">
              Tomadores registrados no sistema
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Notas vinculadas
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {clients.reduce((acc, c) => acc + (c.notesCount || 0), 0)}
            </div>
            <div className="text-[11px] text-slate-400">
              Documentos associados aos CNPJs
            </div>
          </div>

          <div className="pt-4 sm:pt-0 sm:pl-6 space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Faturamento acumulado
            </span>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {formatCurrency(
                clients.reduce((acc, c) => acc + getClientTotalValue(c), 0)
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              Soma total faturada por clientes
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Busca Minimalista */}
      <div className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-clients"
            type="text"
            placeholder="Pesquisar por nome do cliente, razão social ou CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-transparent border-0 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium px-2 shrink-0">
          {filteredClients.length} {filteredClients.length === 1 ? 'cliente' : 'clientes'}
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">CNPJ</th>
                <th className="py-3 px-4">Razão Social</th>
                <th className="py-3 px-4 text-center">Notas</th>
                <th className="py-3 px-4 text-right">Faturamento</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const totalVal = getClientTotalValue(client);
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                          {client.customName}
                        </span>
                        {client.nomeFantasia && client.nomeFantasia !== client.customName && (
                          <span className="text-[11px] text-slate-400 block">
                            {client.nomeFantasia}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                        {client.cnpj}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {client.razaoSocial || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          {client.notesCount || 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatCurrency(totalVal)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`btn-edit-client-${client.cleanCnpj}`}
                            onClick={() => openEditModal(client)}
                            title="Editar"
                            className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`btn-delete-client-${client.cleanCnpj}`}
                            onClick={() => handleDeleteClient(client)}
                            title="Excluir"
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="w-6 h-6 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-xs">
                      {searchQuery
                        ? 'Nenhum cliente encontrado com este termo.'
                        : 'Nenhum cliente cadastrado ainda.'}
                    </p>
                    <p className="text-[11px] mt-0.5">
                      Os clientes são registrados automaticamente ao processar notas fiscais.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add/Edit Client */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-5 space-y-3.5">
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  CNPJ *
                </label>
                <input
                  id="input-modal-client-cnpj"
                  type="text"
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Nome do Cliente (para pastas e arquivos) *
                </label>
                <input
                  id="input-modal-client-name"
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  placeholder="Ex: ACME LOGISTICA"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Razão Social (opcional)
                </label>
                <input
                  id="input-modal-client-razao"
                  type="text"
                  value={razaoSocialInput}
                  onChange={(e) => setRazaoSocialInput(e.target.value)}
                  placeholder="Ex: ACME Logística e Distribuição S.A."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Nome Fantasia (opcional)
                </label>
                <input
                  id="input-modal-client-fantasia"
                  type="text"
                  value={nomeFantasiaInput}
                  onChange={(e) => setNomeFantasiaInput(e.target.value)}
                  placeholder="Ex: ACME Log"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    E-mail
                  </label>
                  <input
                    id="input-modal-client-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="financeiro@empresa.com"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">
                    Telefone
                  </label>
                  <input
                    id="input-modal-client-phone"
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs focus:outline-hidden focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-client-modal"
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
    </div>
  );
};
