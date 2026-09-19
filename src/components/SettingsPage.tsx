import React, { useState, useEffect } from 'react';
import {
  Settings,
  FolderTree,
  FileCode,
  Save,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  HardDrive,
} from 'lucide-react';
import { AppSettings } from '../types';
import { db, DEFAULT_SETTINGS } from '../services/db';

interface SettingsPageProps {
  onSettingsSaved: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onSettingsSaved }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSettings(db.getSettings());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveSettings(settings);
    setSaveSuccess(true);
    onSettingsSaved();
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Deseja restaurar as configurações padrão?')) {
      setSettings(DEFAULT_SETTINGS);
      db.saveSettings(DEFAULT_SETTINGS);
      onSettingsSaved();
    }
  };

  const handleExportBackup = () => {
    const jsonStr = db.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_organizador_nf_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = db.importBackup(content);
      if (success) {
        setSettings(db.getSettings());
        setImportMessage({ type: 'success', text: 'Backup restaurado com sucesso!' });
        onSettingsSaved();
      } else {
        setImportMessage({ type: 'error', text: 'Arquivo de backup inválido ou corrompido.' });
      }
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-blue-600" /> Configurações do Sistema
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Personalize as regras de renomeação de arquivos, hierarquia de pastas e backups.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Configurações salvas com sucesso!
        </div>
      )}

      {importMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            importMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {importMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {importMessage.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card: Estrutura de Pastas */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
            <FolderTree className="w-4 h-4 text-blue-600" /> Estrutura de Pastas de Destino
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'ANO_MES_CLIENTE'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <input
                type="radio"
                name="folderStructure"
                value="ANO_MES_CLIENTE"
                checked={settings.folderStructure === 'ANO_MES_CLIENTE'}
                onChange={() => setSettings({ ...settings, folderStructure: 'ANO_MES_CLIENTE' })}
                className="sr-only"
              />
              <span className="font-bold text-slate-900 block mb-1">ANO / MÊS / CLIENTE</span>
              <span className="text-slate-500 font-mono text-[11px] block">
                2026 / 09 - SETEMBRO / ACME LOG / NF_...pdf
              </span>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'CLIENTE_ANO_MES'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <input
                type="radio"
                name="folderStructure"
                value="CLIENTE_ANO_MES"
                checked={settings.folderStructure === 'CLIENTE_ANO_MES'}
                onChange={() => setSettings({ ...settings, folderStructure: 'CLIENTE_ANO_MES' })}
                className="sr-only"
              />
              <span className="font-bold text-slate-900 block mb-1">CLIENTE / ANO / MÊS</span>
              <span className="text-slate-500 font-mono text-[11px] block">
                ACME LOG / 2026 / 09 - SETEMBRO / NF_...pdf
              </span>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'ANO_CLIENTE'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <input
                type="radio"
                name="folderStructure"
                value="ANO_CLIENTE"
                checked={settings.folderStructure === 'ANO_CLIENTE'}
                onChange={() => setSettings({ ...settings, folderStructure: 'ANO_CLIENTE' })}
                className="sr-only"
              />
              <span className="font-bold text-slate-900 block mb-1">ANO / CLIENTE</span>
              <span className="text-slate-500 font-mono text-[11px] block">
                2026 / ACME LOG / NF_...pdf
              </span>
            </label>
          </div>
        </div>

        {/* Card: Padrão de Nomenclatura */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
            <FileCode className="w-4 h-4 text-blue-600" /> Padrão de Nome do Arquivo
          </h2>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Formato Padrão
            </label>
            <input
              type="text"
              value={settings.namingPattern}
              disabled
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-slate-100 text-slate-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Formato oficial: <code>NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf</code> (caracteres especiais e barras são higienizados automaticamente).
            </p>
          </div>

          {/* Exemplo ao vivo */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono flex items-center justify-between">
            <span className="text-slate-400 text-[11px]">Exemplo de Saída:</span>
            <span className="font-bold text-emerald-400">NF_20260482_ACME_LOGISTICA_R$8450,00_15-09-2026.pdf</span>
          </div>
        </div>

        {/* Card: Regras de Duplicatas & Cadastros */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-blue-600" /> Regras de Duplicidade & Integridade
          </h2>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <input
                type="checkbox"
                id="check-setting-auto-register"
                checked={settings.autoRegisterNewClients}
                onChange={(e) => setSettings({ ...settings, autoRegisterNewClients: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="check-setting-auto-register" className="text-xs text-slate-700 cursor-pointer">
                <span className="font-bold text-slate-900 block">
                  Auto-cadastrar novas empresas identificadas
                </span>
                Adiciona automaticamente ao cadastro permanente os novos tomadores com alta confiança de identificação.
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
              <input
                type="checkbox"
                id="check-setting-alert-ambiguity"
                checked={settings.alertOnAmbiguity}
                onChange={(e) => setSettings({ ...settings, alertOnAmbiguity: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="check-setting-alert-ambiguity" className="text-xs text-slate-700 cursor-pointer">
                <span className="font-bold text-slate-900 block">
                  Exigir revisão manual em casos de ambiguidade
                </span>
                Pausa e solicita confirmação do operador quando houver múltiplos CNPJs sem tomador claro.
              </label>
            </div>
          </div>
        </div>

        {/* Buttons: Salvar & Restaurar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar Padrões
          </button>

          <button
            id="btn-save-settings"
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </div>
      </form>

      {/* Card: Backup e Restauração de Dados */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 uppercase tracking-wider">
          <HardDrive className="w-4 h-4 text-blue-600" /> Backup e Restauração de Dados
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Exporte ou restaure todos os seus clientes cadastrados, histórico de notas organizadas e configurações personalizadas em um único arquivo JSON.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            id="btn-export-full-backup"
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs"
          >
            <Download className="w-4 h-4 text-blue-600" /> Baixar Arquivo de Backup (.json)
          </button>

          <label className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-600" /> Restaurar Backup de Arquivo
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="sr-only"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
