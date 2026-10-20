import React from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  FileSpreadsheet,
  FolderUp,
  Users,
  History,
  Settings,
  ShieldCheck,
  FileCheck2,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Calculator,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  currentTab: 'dashboard' | 'monthly' | 'taxes' | 'process' | 'upload' | 'clients' | 'history' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'monthly' | 'taxes' | 'process' | 'upload' | 'clients' | 'history' | 'settings') => void;
  onOpenResetModal?: () => void;
  pendingReviewCount: number;
  clientsCount: number;
  historyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenResetModal,
  pendingReviewCount,
  clientsCount,
  historyCount,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'monthly',
      label: 'Visão Mensal',
      icon: CalendarDays,
      badge: null,
    },
    {
      id: 'taxes',
      label: 'Impostos',
      icon: Calculator,
      badge: { text: 'Simular', color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
    },
    {
      id: 'process',
      label: 'Processar notas',
      icon: FileSpreadsheet,
      badge: pendingReviewCount > 0 ? { text: `${pendingReviewCount}`, color: 'bg-amber-500 text-white' } : null,
    },
    {
      id: 'upload',
      label: 'Subir dados',
      icon: FolderUp,
      badge: null,
    },
    {
      id: 'clients',
      label: 'Clientes',
      icon: Users,
      badge: clientsCount > 0 ? { text: `${clientsCount}`, color: 'bg-slate-100 text-slate-700' } : null,
    },
    {
      id: 'history',
      label: 'Histórico',
      icon: History,
      badge: historyCount > 0 ? { text: `${historyCount}`, color: 'bg-slate-100 text-slate-700' } : null,
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: Settings,
      badge: null,
    },
  ] as const;

  const { theme, setTheme } = useTheme();

  return (
    <aside className="w-64 bg-slate-950 text-slate-200 flex flex-col shrink-0 border-r border-slate-800/80 select-none">
      {/* Brand Header com Cor */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
              Organizador NF
            </h1>
            <p className="text-[11px] text-blue-400 font-medium">Gestão & Fiscal</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/30'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/90'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive
                      ? 'text-white'
                      : item.id === 'taxes'
                      ? 'text-amber-400'
                      : item.id === 'dashboard'
                      ? 'text-blue-400'
                      : item.id === 'process'
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : item.badge.color || 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge.text}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme Switcher Minimalista */}
      <div className="px-3 mb-3">
        <div className="p-0.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center gap-1">
          <button
            type="button"
            id="theme-btn-light"
            onClick={() => setTheme('light')}
            title="Tema Claro"
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition-colors ${
              theme === 'light'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sun className="w-3 h-3" />
            <span>Claro</span>
          </button>
          <button
            type="button"
            id="theme-btn-dark"
            onClick={() => setTheme('dark')}
            title="Tema Escuro"
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[11px] font-medium transition-colors ${
              theme === 'dark'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Moon className="w-3 h-3" />
            <span>Escuro</span>
          </button>
          <button
            type="button"
            id="theme-btn-system"
            onClick={() => setTheme('system')}
            title="Seguir Sistema Operacional"
            className={`p-1 rounded text-[11px] transition-colors ${
              theme === 'system'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Safety info minimalista */}
      <div className="px-3 mb-2">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Arquivos originais 100% preservados</span>
        </div>
      </div>

      {/* Botão para Zerar Tudo */}
      {onOpenResetModal && (
        <div className="px-3 mb-3">
          <button
            type="button"
            id="sidebar-btn-reset-all"
            onClick={onOpenResetModal}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-900 text-xs font-medium transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Zerar dados</span>
          </button>
        </div>
      )}
    </aside>
  );
};
