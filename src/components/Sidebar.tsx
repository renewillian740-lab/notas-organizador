import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  Send,
  History,
  Settings,
  ShieldCheck,
  FolderSync,
  FileCheck2,
} from 'lucide-react';

interface SidebarProps {
  currentTab: 'dashboard' | 'process' | 'clients' | 'dispatch' | 'history' | 'settings';
  onSelectTab: (tab: 'dashboard' | 'process' | 'clients' | 'dispatch' | 'history' | 'settings') => void;
  pendingReviewCount: number;
  clientsCount: number;
  historyCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
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
      id: 'dispatch',
      label: 'Enviar Notas',
      icon: Send,
      badge: null,
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

      {/* Safety & Integrity Guarantee Footer */}
      <div className="p-4 mx-4 mb-4 rounded-xl bg-slate-800/70 border border-slate-700/50">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-slate-200">Arquivos Originais Intactos</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              O sistema nunca modifica ou apaga os PDFs de origem. Sempre opera com cópias seguras.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
