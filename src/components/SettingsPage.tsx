import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
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
  Sun,
  Moon,
  Monitor,
  Building2,
  Percent,
  Trash2,
} from 'lucide-react';
import { AppSettings } from '../types';
import { db, DEFAULT_SETTINGS } from '../services/db';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { ResetModal } from './ResetModal';

interface SettingsPageProps {
  onSettingsSaved: () => void;
  onOpenResetModal?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onSettingsSaved,
  onOpenResetModal,
}) => {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    const loaded = db.getSettings();
    setSettings(loaded);
  }, []);

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
    setSettings((prev) => ({ ...prev, theme: newTheme }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveSettings(settings);
    setSaveSuccess(true);
    onSettingsSaved();
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    if (window.confirm('Deseja restaurar todas as configurações para o padrão original?')) {
      setSettings(DEFAULT_SETTINGS);
      db.saveSettings(DEFAULT_SETTINGS);
      setTheme(DEFAULT_SETTINGS.theme || 'light');
      onSettingsSaved();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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
        const updated = db.getSettings();
        setSettings(updated);
        if (updated.theme) {
          setTheme(updated.theme);
        }
        setImportMessage({
          type: 'success',
          text: 'Backup restaurado com sucesso!',
        });
        onSettingsSaved();
      } else {
        setImportMessage({
          type: 'error',
          text: 'Arquivo de backup inválido. Verifique o formato JSON.',
        });
      }
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const folderStructureOptions = [
    {
      id: 'MES_CLIENTE',
      title: 'Mês / Cliente',
      subtitle: 'Padrão recomendado',
      pathExample: '09 - SETEMBRO / ACME LOGISTICA / NF_...pdf',
    },
    {
      id: 'ANO_MES_CLIENTE',
      title: 'Ano / Mês / Cliente',
      subtitle: 'Estrutura completa fiscal',
      pathExample: '2026 / 09 - SETEMBRO / ACME LOGISTICA / NF_...pdf',
    },
    {
      id: 'CLIENTE_MES',
      title: 'Cliente / Mês',
      subtitle: 'Agrupamento por empresa',
      pathExample: 'ACME LOGISTICA / 09 - SETEMBRO / NF_...pdf',
    },
    {
      id: 'CLIENTE_DIRETO',
      title: 'Apenas Cliente',
      subtitle: 'Sem divisão mensal',
      pathExample: 'ACME LOGISTICA / NF_...pdf',
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      {/* Header Minimalista */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Configurações
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Personalize a organização de pastas, dados do emissor, alíquota de impostos e tema.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Restaurar padrões</span>
          </button>

          <button
            id="btn-save-settings-top"
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar alterações</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Configurações salvas e aplicadas com sucesso!</span>
        </div>
      )}

      {importMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            importMessage.type === 'success'
              ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {importMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{importMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Aparência Visual */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aparência Visual
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Escolha o tema da interface
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              id="theme-select-light"
              onClick={() => handleThemeChange('light')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                theme === 'light'
                  ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Claro</span>
              </div>
              {theme === 'light' && <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white"></span>}
            </button>

            <button
              type="button"
              id="theme-select-dark"
              onClick={() => handleThemeChange('dark')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                theme === 'dark'
                  ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Escuro</span>
              </div>
              {theme === 'dark' && <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white"></span>}
            </button>

            <button
              type="button"
              id="theme-select-system"
              onClick={() => handleThemeChange('system')}
              className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                theme === 'system'
                  ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Monitor className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Automático</span>
              </div>
              {theme === 'system' && <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white"></span>}
            </button>
          </div>
        </section>

        {/* Minha Empresa & Alíquota Padrão */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Minha Empresa (Prestador / Emissor)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dados do emissor para distinguir automaticamente do cliente tomador nas notas fiscais
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                CNPJ da Minha Empresa
              </label>
              <input
                id="input-issuer-cnpj"
                type="text"
                value={settings.issuerCnpj || ''}
                onChange={(e) => setSettings({ ...settings, issuerCnpj: e.target.value })}
                placeholder="47.042.028/0001-55"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-mono focus:outline-hidden focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Razão Social / Nome da Minha Empresa
              </label>
              <input
                id="input-issuer-name"
                type="text"
                value={settings.issuerName || ''}
                onChange={(e) => setSettings({ ...settings, issuerName: e.target.value })}
                placeholder="RENE WILLIAN SANTOS MENEZES 86139841500"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs uppercase font-medium focus:outline-hidden focus:border-slate-400"
              />
            </div>

            <div className="md:col-span-2 pt-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Alíquota Padrão de Imposto (%)
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-28">
                  <input
                    id="input-default-tax-rate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={settings.defaultTaxRate !== undefined ? settings.defaultTaxRate : 6.0}
                    onChange={(e) => setSettings({ ...settings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                    className="w-full pl-3 pr-7 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-hidden focus:border-slate-400 font-mono text-right"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
                <span className="text-xs text-slate-400">
                  Porcentagem padrão para a aba <strong>Impostos</strong>.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Estrutura de Pastas */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Estrutura de Subpastas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Como as subpastas serão geradas na organização dos arquivos
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {folderStructureOptions.map((opt) => {
              const isSelected = settings.folderStructure === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border cursor-pointer text-xs transition-colors flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="radio"
                    name="folderStructure"
                    value={opt.id}
                    checked={isSelected}
                    onChange={() =>
                      setSettings({ ...settings, folderStructure: opt.id as any })
                    }
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-white text-xs">
                      {opt.title}
                    </span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white"></span>}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate">
                    📁 {opt.pathExample}
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Padrão de Nomenclatura */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Padrão de Nome dos Arquivos
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Formatação aplicada na renomeação de cada nota fiscal
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs flex items-center justify-between text-slate-800 dark:text-slate-200">
            <span>NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf</span>
            <span className="text-[11px] text-slate-400">Oficial</span>
          </div>
        </section>

        {/* Regras Semânticas */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Regras de Identificação
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Comportamento do motor de leitura automática
            </p>
          </div>

          <div className="space-y-2 pt-1 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoRegisterNewClients}
                onChange={(e) =>
                  setSettings({ ...settings, autoRegisterNewClients: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 text-slate-900 rounded border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <span className="text-slate-700 dark:text-slate-300">
                Cadastrar automaticamente novas empresas identificadas no documento
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alertOnAmbiguity}
                onChange={(e) =>
                  setSettings({ ...settings, alertOnAmbiguity: e.target.checked })
                }
                className="mt-0.5 w-4 h-4 text-slate-900 rounded border-slate-300 dark:border-slate-700 cursor-pointer"
              />
              <span className="text-slate-700 dark:text-slate-300">
                Solicitar confirmação manual em notas com múltiplos CNPJs ou ambiguidade
              </span>
            </label>
          </div>
        </section>

        {/* Backup & Restauração */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Backup e Restauração
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Exporte ou restaure o histórico, cadastros e configurações em JSON
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              id="btn-export-full-backup"
              type="button"
              onClick={handleExportBackup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Baixar backup (.json)</span>
            </button>

            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Restaurar arquivo</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="sr-only"
              />
            </label>
          </div>
        </section>

        {/* Zona de Exclusão */}
        <section className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Zerar Dados do Sistema
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Limpa histórico de notas e cadastros de clientes com confirmação
            </p>
          </div>

          <button
            id="btn-settings-open-reset-all"
            type="button"
            onClick={() => (onOpenResetModal ? onOpenResetModal() : setIsResetModalOpen(true))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Zerar tudo</span>
          </button>
        </section>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-medium text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Restaurar valores padrão
          </button>

          <button
            id="btn-save-settings"
            type="submit"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
          >
            Salvar configurações
          </button>
        </div>
      </form>

      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetComplete={() => {
          onSettingsSaved();
        }}
      />
    </div>
  );
};
