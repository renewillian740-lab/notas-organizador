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
  Sun,
  Moon,
  Monitor,
  Palette,
  Database,
  Check,
  Copy,
  Terminal,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { AppSettings, SupabaseStatusResult } from '../types';
import { db, DEFAULT_SETTINGS } from '../services/db';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { storageService } from '../services/storageService';
import { ResetModal } from './ResetModal';

interface SettingsPageProps {
  onSettingsSaved: () => void;
  onOpenResetModal?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onSettingsSaved, onOpenResetModal }) => {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatusResult | null>(null);
  const [sqlSchema, setSqlSchema] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const fetchStatusAndSchema = async () => {
    setLoadingStatus(true);
    const status = await storageService.getStatus();
    setSupabaseStatus(status);
    try {
      const res = await fetch('/api/supabase/sql-schema');
      if (res.ok) {
        const json = await res.json();
        if (json.sql) {
          setSqlSchema(json.sql);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar SQL Schema:', e);
    }
    setLoadingStatus(false);
  };

  useEffect(() => {
    const loaded = db.getSettings();
    setSettings(loaded);
    fetchStatusAndSchema();
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
    if (window.confirm('Deseja restaurar as configurações padrão?')) {
      setSettings(DEFAULT_SETTINGS);
      db.saveSettings(DEFAULT_SETTINGS);
      setTheme(DEFAULT_SETTINGS.theme || 'light');
      onSettingsSaved();
    }
  };

  const handleExportBackup = () => {
    const jsonStr = db.exportBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_organizador_nf_supabase_${new Date().toISOString().slice(0, 10)}.json`;
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

  const handleCopySql = () => {
    if (!sqlSchema) return;
    navigator.clipboard.writeText(sqlSchema);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> Configurações do Sistema
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Personalize aparência visual, regras de renomeação de arquivos, persistência no Supabase e backups.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Configurações salvas com sucesso!
        </div>
      )}

      {importMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            importMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
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
        {/* Card: Tema e Aparência Visual */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
              <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Tema e Aparência
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Modo Atual: {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro' : 'Automático'}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Escolha o tema de visualização de sua preferência para navegar e gerenciar as notas fiscais.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Tema Claro */}
            <button
              type="button"
              id="theme-select-light"
              onClick={() => handleThemeChange('light')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                theme === 'light'
                  ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Sun className="w-4 h-4" />
                </div>
                {theme === 'light' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
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

            {/* Tema Escuro */}
            <button
              type="button"
              id="theme-select-dark"
              onClick={() => handleThemeChange('dark')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                theme === 'dark'
                  ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-lg bg-indigo-900 text-indigo-300 flex items-center justify-center">
                  <Moon className="w-4 h-4" />
                </div>
                {theme === 'dark' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
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

            {/* Tema Automático / Sistema */}
            <button
              type="button"
              id="theme-select-system"
              onClick={() => handleThemeChange('system')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                theme === 'system'
                  ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                  <Monitor className="w-4 h-4" />
                </div>
                {theme === 'system' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                )}
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                  Automático
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block leading-relaxed">
                  Segue automaticamente as configurações do sistema operacional.
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Card: Estrutura de Pastas */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
            <FolderTree className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Estrutura de Pastas de Destino
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'MES_CLIENTE'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="folderStructure"
                value="MES_CLIENTE"
                checked={settings.folderStructure === 'MES_CLIENTE'}
                onChange={() => setSettings({ ...settings, folderStructure: 'MES_CLIENTE' })}
                className="sr-only"
              />
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 dark:text-slate-100">MÊS / CLIENTE</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  Padrão (Pasta do Ano)
                </span>
              </div>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] block">
                09 - SETEMBRO / ACME LOG / NF_...pdf
              </span>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'CLIENTE_MES'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="folderStructure"
                value="CLIENTE_MES"
                checked={settings.folderStructure === 'CLIENTE_MES'}
                onChange={() => setSettings({ ...settings, folderStructure: 'CLIENTE_MES' })}
                className="sr-only"
              />
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">CLIENTE / MÊS</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] block">
                ACME LOG / 09 - SETEMBRO / NF_...pdf
              </span>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'CLIENTE_DIRETO'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="folderStructure"
                value="CLIENTE_DIRETO"
                checked={settings.folderStructure === 'CLIENTE_DIRETO'}
                onChange={() => setSettings({ ...settings, folderStructure: 'CLIENTE_DIRETO' })}
                className="sr-only"
              />
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">APENAS CLIENTE</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] block">
                ACME LOG / NF_...pdf
              </span>
            </label>

            <label
              className={`p-4 rounded-xl border cursor-pointer text-xs transition-all ${
                settings.folderStructure === 'ANO_MES_CLIENTE'
                  ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
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
              <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">ANO / MÊS / CLIENTE</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] block">
                2026 / 09 - SETEMBRO / ACME LOG / NF_...pdf
              </span>
            </label>
          </div>
        </div>

        {/* Card: Padrão de Nomenclatura */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
            <FileCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Padrão de Nome do Arquivo
          </h2>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
              Formato Padrão
            </label>
            <input
              type="text"
              value={settings.namingPattern}
              disabled
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Formato oficial: <code>NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf</code> (caracteres especiais e barras são higienizados automaticamente).
            </p>
          </div>

          {/* Exemplo ao vivo */}
          <div className="p-3.5 rounded-xl bg-slate-900 dark:bg-slate-950 text-slate-200 text-xs font-mono flex items-center justify-between border border-slate-800">
            <span className="text-slate-400 text-[11px]">Exemplo de Saída:</span>
            <span className="font-bold text-emerald-400">NF_20260482_ACME_LOGISTICA_R$8450,00_15-09-2026.pdf</span>
          </div>
        </div>

        {/* Card: Regras de Duplicatas & Cadastros */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Regras de Duplicidade & Integridade
          </h2>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="check-setting-auto-register"
                checked={settings.autoRegisterNewClients}
                onChange={(e) => setSettings({ ...settings, autoRegisterNewClients: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="check-setting-auto-register" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
                  Auto-cadastrar novas empresas identificadas
                </span>
                Adiciona automaticamente ao cadastro permanente os novos tomadores com alta confiança de identificação.
              </label>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="check-setting-alert-ambiguity"
                checked={settings.alertOnAmbiguity}
                onChange={(e) => setSettings({ ...settings, alertOnAmbiguity: e.target.checked })}
                className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="check-setting-alert-ambiguity" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="font-bold text-slate-900 dark:text-slate-100 block">
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
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar Padrões
          </button>

          <button
            id="btn-save-settings"
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Salvar Configurações
          </button>
        </div>
      </form>

      {/* Card: Status do Supabase Storage & Banco de Dados */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Supabase Storage & Banco de Dados
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatusAndSchema}
              title="Atualizar status de conexão"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-600"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            </button>
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                supabaseStatus?.connected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              {supabaseStatus?.connected ? 'SUPABASE CONECTADO' : 'BUFFER LOCAL ATIVO'}
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-600 dark:text-slate-300">
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block uppercase">
                Bucket Storage Privado
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {supabaseStatus?.bucket || 'notas-fiscais'} (Privado)
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block uppercase">
                Tabelas no Banco
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                invoices, clients
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 block uppercase">
                Status do Storage
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs">
                {supabaseStatus?.storageAccessible ? 'Pronto para Uploads' : 'Modo Seguro / Buffer'}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 space-y-1.5">
            <p>
              • <strong>Armazenamento de PDFs:</strong> Os PDFs originais são enviados para o bucket privado{' '}
              <code className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                {supabaseStatus?.bucket || 'notas-fiscais'}
              </code>{' '}
              no Supabase Storage. As URLs assinadas com token temporário protegem os arquivos contra acessos públicos indevidos.
            </p>
            <p>
              • <strong>Persistência dos Registros:</strong> O histórico completo de notas fiscais e cadastro de empresas clientes é gravado diretamente no banco PostgreSQL do Supabase, garantindo sincronização permanente entre dispositivos.
            </p>
          </div>
        </div>

        {/* Script SQL para criação de tabelas */}
        {sqlSchema && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Script SQL de Inicialização do Supabase
              </span>
              <button
                type="button"
                onClick={handleCopySql}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 flex items-center gap-1 cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copiar SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
              {sqlSchema}
            </pre>
          </div>
        )}
      </div>

      {/* Card: Backup e Restauração de Dados */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
          <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Backup e Restauração de Dados
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Exporte ou restaure todos os seus clientes cadastrados, histórico de notas organizadas e configurações personalizadas em um único arquivo JSON.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            id="btn-export-full-backup"
            type="button"
            onClick={handleExportBackup}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Baixar Arquivo de Backup (.json)
          </button>

          <label className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors flex items-center gap-2 shadow-xs cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Restaurar Backup de Arquivo
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="sr-only"
            />
          </label>
        </div>
      </div>

      {/* Card: Zona de Perigo / Zerar Tudo */}
      <div className="p-6 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2 uppercase tracking-wider">
              <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Zona de Perigo / Zerar Tudo
            </h2>
            <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed mt-1">
              Limpe instantaneamente todas as notas fiscais processadas, histórico, arquivos do Supabase Storage e cadastros do sistema.
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
      </div>

      {/* Reset Modal */}
      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onResetComplete={() => {
          onSettingsSaved();
          fetchStatusAndSchema();
        }}
      />
    </div>
  );
};
