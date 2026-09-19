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
  Palette,
  Check,
  Trash2,
  FolderPlus,
  Sparkles,
  Building2,
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
          text: 'Backup restaurado com sucesso! Dados e configurações atualizados.',
        });
        onSettingsSaved();
      } else {
        setImportMessage({
          type: 'error',
          text: 'Arquivo de backup inválido ou corrompido. Verifique o formato JSON.',
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
      badge: 'Padrão',
    },
    {
      id: 'ANO_MES_CLIENTE',
      title: 'Ano / Mês / Cliente',
      subtitle: 'Estrutura completa por exercício fiscal',
      pathExample: '2026 / 09 - SETEMBRO / ACME LOGISTICA / NF_...pdf',
      badge: 'Fiscal',
    },
    {
      id: 'CLIENTE_MES',
      title: 'Cliente / Mês',
      subtitle: 'Agrupamento direto pela empresa tomadora',
      pathExample: 'ACME LOGISTICA / 09 - SETEMBRO / NF_...pdf',
      badge: 'Por Cliente',
    },
    {
      id: 'CLIENTE_DIRETO',
      title: 'Apenas Cliente',
      subtitle: 'Sem separação mensal',
      pathExample: 'ACME LOGISTICA / NF_...pdf',
      badge: 'Direto',
    },
  ];

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Configurações
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Personalize a organização de pastas, regras de nomenclatura, tema e segurança do sistema.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Restaurar Padrões
          </button>
          <button
            id="btn-save-settings-top"
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Salvar Alterações
          </button>
        </div>
      </div>

      {/* Alertas de Notificação */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Configurações salvas e aplicadas com sucesso!</span>
        </div>
      )}

      {importMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xs ${
            importMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* Seção 1: Tema e Aparência */}
        <section className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Palette className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Aparência Visual e Tema
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Escolha o estilo de interface de sua preferência.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {theme === 'light' ? 'Tema Claro' : theme === 'dark' ? 'Tema Escuro' : 'Automático'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Opção Claro */}
            <button
              type="button"
              id="theme-select-light"
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                theme === 'light'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center">
                  <Sun className="w-4 h-4" />
                </div>
                {theme === 'light' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                  Tema Claro
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                  Fundo limpo e alto contraste para ambientes iluminados.
                </span>
              </div>
            </button>

            {/* Opção Escuro */}
            <button
              type="button"
              id="theme-select-dark"
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                theme === 'dark'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 flex items-center justify-center">
                  <Moon className="w-4 h-4" />
                </div>
                {theme === 'dark' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                  Tema Escuro
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                  Conforto visual e tons escuros para menor fadiga ocular.
                </span>
              </div>
            </button>

            {/* Opção Sistema */}
            <button
              type="button"
              id="theme-select-system"
              onClick={() => handleThemeChange('system')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                theme === 'system'
                  ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <Monitor className="w-4 h-4" />
                </div>
                {theme === 'system' && (
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                  Automático
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                  Sincroniza automaticamente com o sistema operacional.
                </span>
              </div>
            </button>
          </div>
        </section>

        {/* Seção 2: Minha Empresa (Prestador / Emissor) */}
        <section className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Minha Empresa (Prestador / Emissor)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dados da sua empresa que emite as notas. O sistema ignora estes dados na identificação do cliente e seleciona o Tomador de Serviços.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                CNPJ da Minha Empresa (Emissor)
              </label>
              <input
                id="input-issuer-cnpj"
                type="text"
                value={settings.issuerCnpj || ''}
                onChange={(e) => setSettings({ ...settings, issuerCnpj: e.target.value })}
                placeholder="47.042.028/0001-55"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Razão Social / Nome da Minha Empresa
              </label>
              <input
                id="input-issuer-name"
                type="text"
                value={settings.issuerName || ''}
                onChange={(e) => setSettings({ ...settings, issuerName: e.target.value })}
                placeholder="RENE WILLIAN SANTOS MENEZES 86139841500"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs uppercase font-medium focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Ao processar notas, o sistema compara automaticamente o emissor com esses dados e extrai com precisão a empresa Tomadora (o cliente real).
            </span>
          </div>
        </section>

        {/* Seção 3: Estrutura de Pastas de Destino */}
        <section className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Estrutura de Pastas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Defina como as subpastas serão geradas automaticamente na organização dos PDFs.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {folderStructureOptions.map((opt) => {
              const isSelected = settings.folderStructure === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`p-4 rounded-2xl border cursor-pointer text-xs transition-all flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/25 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
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
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                        {opt.title}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                        {opt.subtitle}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    📁 {opt.pathExample}
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Seção 3: Padrão de Nomenclatura */}
        <section className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Padrão de Nome dos Arquivos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Formatação padronizada e higienizada aplicada a cada nota fiscal processada.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf
              </div>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                Oficial Padronizado
              </span>
            </div>

            {/* Exemplo ao Vivo */}
            <div className="p-4 rounded-2xl bg-slate-900 dark:bg-slate-950 text-slate-200 text-xs font-mono border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-slate-400 text-[11px]">Exemplo de Arquivo Gerado:</span>
              </div>
              <span className="font-bold text-emerald-400 break-all">
                NF_20260482_ACME_LOGISTICA_R$8450,00_15-09-2026.pdf
              </span>
            </div>
          </div>
        </section>

        {/* Seção 4: Regras de Identificação e Duplicidade */}
        <section className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Regras de Identificação & Integridade
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configurações do motor semântico para novos cadastros e resolução de ambiguidades.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5">
              <input
                type="checkbox"
                id="check-setting-auto-register"
                checked={settings.autoRegisterNewClients}
                onChange={(e) =>
                  setSettings({ ...settings, autoRegisterNewClients: e.target.checked })
                }
                className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="check-setting-auto-register"
                className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed"
              >
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  Auto-cadastrar novas empresas identificadas
                </span>
                Adiciona automaticamente ao cadastro permanente as novas empresas tomadoras identificadas com alta confiança nas notas fiscais.
              </label>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3.5">
              <input
                type="checkbox"
                id="check-setting-alert-ambiguity"
                checked={settings.alertOnAmbiguity}
                onChange={(e) =>
                  setSettings({ ...settings, alertOnAmbiguity: e.target.checked })
                }
                className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
              />
              <label
                htmlFor="check-setting-alert-ambiguity"
                className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer leading-relaxed"
              >
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  Exigir confirmação em notas ambíguas
                </span>
                Pausa e solicita revisão do operador sempre que houver múltiplos CNPJs ou sem indicação explícita de tomador no documento.
              </label>
            </div>
          </div>
        </section>

        {/* Seção 5: Backup e Restauração de Dados */}
        <section className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Backup e Restauração
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Exporte ou recupere o histórico, empresas cadastradas e configurações do sistema em arquivo JSON.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              id="btn-export-full-backup"
              type="button"
              onClick={handleExportBackup}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Baixar Backup Completo (.json)
            </button>

            <label className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer">
              <Upload className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Restaurar Backup de Arquivo
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="sr-only"
              />
            </label>
          </div>
        </section>

        {/* Seção 6: Zona de Perigo / Zerar Dados */}
        <section className="p-6 bg-rose-50/60 dark:bg-rose-950/20 rounded-3xl border border-rose-200/80 dark:border-rose-900/60 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2 uppercase tracking-wider">
                <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                Zona de Exclusão / Zerar Tudo
              </h2>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed mt-1 max-w-xl">
                Limpe instantaneamente todas as notas fiscais processadas, histórico consolidado, arquivos em nuvem e cadastros de clientes com confirmação segura.
              </p>
            </div>

            <button
              id="btn-settings-open-reset-all"
              type="button"
              onClick={() => (onOpenResetModal ? onOpenResetModal() : setIsResetModalOpen(true))}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Zerar Tudo</span>
            </button>
          </div>
        </section>

        {/* Barra de Ações Inferior */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
          </button>

          <button
            id="btn-save-settings"
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </div>
      </form>

      {/* Modal de Confirmação para Zerar Tudo */}
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
