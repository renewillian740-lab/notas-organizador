import React, { useState } from 'react';
import {
  X,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Users,
  HardDrive,
  Settings,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { db } from '../services/db';

interface ResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetComplete: () => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({
  isOpen,
  onClose,
  onResetComplete,
}) => {
  const [clearHistory, setClearHistory] = useState(true);
  const [clearStorage, setClearStorage] = useState(true);
  const [clearClients, setClearClients] = useState(true);
  const [resetSettings, setResetSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleConfirmReset = async () => {
    setLoading(true);
    setSuccessMsg('');

    try {
      const result = await db.resetAllSystemData({
        clearHistory,
        clearStorage,
        clearClients,
        resetSettings,
      });

      setSuccessMsg(result.message || 'Sistema zerado com sucesso!');
      setTimeout(() => {
        setLoading(false);
        onResetComplete();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao zerar dados:', err);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div
        id="modal-reset-all"
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/60 overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 px-6 border-b border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-rose-950 dark:text-rose-200 tracking-tight">
                Zerar Dados do Sistema
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                Limpeza de dados e reinicialização completa
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Atenção:</p>
              <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                Esta ação apagará os dados selecionados. Se desejar guardar registros anteriores, faça um backup na aba de Configurações antes de prosseguir.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Selecione o que deseja zerar:
            </label>

            {/* Opção: Histórico de Notas */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={clearHistory}
                onChange={(e) => setClearHistory(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Histórico de Notas Fiscais Processadas
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Limpa a lista de notas registradas, relatórios e status de envio.
                </p>
              </div>
            </label>

            {/* Opção: Bucket Supabase Storage */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={clearStorage}
                onChange={(e) => setClearStorage(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Arquivos no Supabase Storage (notas-fiscais)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Exclui os PDFs salvos no bucket privado do Supabase.
                </p>
              </div>
            </label>

            {/* Opção: Clientes */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={clearClients}
                onChange={(e) => setClearClients(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                  Cadastro de Clientes
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Remove todas as empresas e regras de nomes personalizados.
                </p>
              </div>
            </label>

            {/* Opção: Configurações */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={resetSettings}
                onChange={(e) => setResetSettings(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <div className="flex-1">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  Restaurar Padrões de Configurações
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Restaura o padrão de nomenclatura de arquivos e tema do sistema.
                </p>
              </div>
            </label>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {successMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              id="btn-confirm-reset-all"
              type="button"
              onClick={handleConfirmReset}
              disabled={loading || (!clearHistory && !clearStorage && !clearClients && !resetSettings)}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Zerando dados...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Zerar Tudo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
