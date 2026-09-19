import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  History,
  Settings,
  ShieldCheck,
  FileCheck2,
  Sun,
  Moon,
  Monitor,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  currentTab: 'dashboard' | 'process' | 'clients' | 'history' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'process' | 'clients' | 'history' | 'settings') => void;
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
      id: 'process',
      label: 'Processar notas',
      icon: FileSpreadsheet,
      badge: pendingReviewCount > 0 ? { text: `${pendingReviewCount}`, color: 'bg-amber-500 text-white' } : null,
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
    <aside className="w-72 bg-slate-900 text-slate-200 flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white leading-tight">
              Organizador NF
            </h1>
            <p className="text-xs text-slate-400 font-medium">Gestão Inteligente de PDFs</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-btn-${item.id}`}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.badge.color}`}>
                  {item.badge.text}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme Switcher Segmented Control */}
      <div className="px-4 mb-3">
        <div className="p-1 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-1">
          <button
            type="button"
            id="theme-btn-light"
            onClick={() => setTheme('light')}
            title="Tema Claro"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'light'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Claro</span>
          </button>
          <button
            type="button"
            id="theme-btn-dark"
            onClick={() => setTheme('dark')}
            title="Tema Escuro"
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              theme === 'dark'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Escuro</span>
          </button>
          <button
            type="button"
            id="theme-btn-system"
            onClick={() => setTheme('system')}
            title="Seguir Sistema Operacional"
            className={`p-1.5 rounded-lg text-xs transition-all ${
              theme === 'system'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Safety & Integrity Guarantee Footer */}
      <div className="p-3.5 mx-4 mb-2 rounded-xl bg-slate-800/70 border border-slate-700/50">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-200">Arquivos Originais Intactos</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              O sistema nunca modifica ou apaga os PDFs de origem.
            </p>
          </div>
        </div>
      </div>

      {/* Botão para Zerar Tudo */}
      {onOpenResetModal && (
        <div className="px-4 mb-4">
          <button
            type="button"
            id="sidebar-btn-reset-all"
            onClick={onOpenResetModal}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-rose-900/50 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 hover:text-rose-100 text-xs font-bold transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Zerar Tudo</span>
          </button>
        </div>
      )}
    </aside>
  );
};
