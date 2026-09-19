import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Building2,
  CheckCircle2,
  X,
  AlertCircle,
  DollarSign,
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
    setErrorMessage('');
    setIsModalOpen(true);
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setCnpjInput(client.cnpj);
    setCustomNameInput(client.customName);
    setRazaoSocialInput(client.razaoSocial || '');
    setNomeFantasiaInput(client.nomeFantasia || '');
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
    });

    loadClients();
    setIsModalOpen(false);
  };

  const handleDeleteClient = (client: Client) => {
    if (
      window.confirm(
        `Tem certeza que deseja remover o cliente "${client.customName}" (${client.cnpj}) do cadastro permanente?`
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
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-blue-600" /> Cadastro Permanente de Clientes
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Associação de CNPJ → Nome oficial utilizado para renomeação e organização automática de pastas.
          </p>
        </div>
        <button
          id="btn-add-client-top"
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Adicionar Cliente
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Total de Clientes
          </span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{clients.length}</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Notas Vinculadas
          </span>
          <span className="text-2xl font-black text-blue-600 mt-1 block">
            {clients.reduce((acc, c) => acc + (c.notesCount || 0), 0)}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Valor Total Acumulado
          </span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block font-mono">
            {formatCurrency(
              clients.reduce((acc, c) => acc + getClientTotalValue(c), 0)
            )}
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="input-search-clients"
            type="text"
            placeholder="Pesquisar por nome do cliente, razão social ou CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Clients Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-6">Cliente (Nome no Sistema)</th>
                <th className="py-3.5 px-6">CNPJ</th>
                <th className="py-3.5 px-6">Razão Social / Fantasia</th>
                <th className="py-3.5 px-6 text-center">Notas</th>
                <th className="py-3.5 px-6 text-right">Valor Total Processado</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const totalVal = getClientTotalValue(client);
                  return (
                    <tr key={client.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                            {client.customName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-900">{client.customName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-semibold text-slate-700">
                        {client.cnpj}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600">
                        {client.razaoSocial || client.nomeFantasia || '-'}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                          {client.notesCount || 0} notas
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-emerald-700 font-mono">
                        {formatCurrency(totalVal)}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn-edit-client-${client.cleanCnpj}`}
                            onClick={() => openEditModal(client)}
                            title="Editar Cliente"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn-delete-client-${client.cleanCnpj}`}
                            onClick={() => handleDeleteClient(client)}
                            title="Excluir Cliente"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">
                      {searchQuery
                        ? 'Nenhum cliente encontrado com este termo.'
                        : 'Nenhum cliente cadastrado ainda.'}
                    </p>
                    <p className="text-[11px] mt-1">
                      Os clientes serão cadastrados automaticamente ou você pode clicar no botão acima.
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-base font-bold text-slate-900">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClient} className="p-6 space-y-4">
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  CNPJ (apenas números ou formatado) *
                </label>
                <input
                  id="input-modal-client-cnpj"
                  type="text"
                  value={cnpjInput}
                  onChange={(e) => setCnpjInput(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome Utilizado pelo Sistema (para pastas e arquivos) *
                </label>
                <input
                  id="input-modal-client-name"
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  placeholder="Ex: ACME LOGISTICA"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Razão Social Completa (opcional)
                </label>
                <input
                  id="input-modal-client-razao"
                  type="text"
                  value={razaoSocialInput}
                  onChange={(e) => setRazaoSocialInput(e.target.value)}
                  placeholder="Ex: ACME Logística e Distribuição S.A."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome Fantasia (opcional)
                </label>
                <input
                  id="input-modal-client-fantasia"
                  type="text"
                  value={nomeFantasiaInput}
                  onChange={(e) => setNomeFantasiaInput(e.target.value)}
                  placeholder="Ex: ACME Log"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-client-modal"
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
