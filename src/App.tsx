import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { db } from './services/db';
import { HistoryRecord } from './types';
import { RefreshCw } from 'lucide-react';

// Code Splitting via React.lazy - Carregamento dinâmico sob demanda
const ProcessInvoices = lazy(() =>
  import('./components/ProcessInvoices').then((m) => ({ default: m.ProcessInvoices }))
);
const UploadDataPage = lazy(() =>
  import('./components/UploadDataPage').then((m) => ({ default: m.UploadDataPage }))
);
const ClientsPage = lazy(() =>
  import('./components/ClientsPage').then((m) => ({ default: m.ClientsPage }))
);
const HistoryPage = lazy(() =>
  import('./components/HistoryPage').then((m) => ({ default: m.HistoryPage }))
);
const SettingsPage = lazy(() =>
  import('./components/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const InvoiceDetailModal = lazy(() =>
  import('./components/InvoiceDetailModal').then((m) => ({ default: m.InvoiceDetailModal }))
);
const ResetModal = lazy(() =>
  import('./components/ResetModal').then((m) => ({ default: m.ResetModal }))
);

function PageLoadingFallback() {
  return (
    <div className="flex-1 flex items-center justify-center p-12 text-slate-400">
      <div className="flex items-center gap-2.5 text-xs font-bold text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span>Carregando módulo...</span>
      </div>
    </div>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<
    'dashboard' | 'process' | 'upload' | 'clients' | 'history' | 'settings'
  >('dashboard');

  const [clientsCount, setClientsCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [totalLifetime, setTotalLifetime] = useState(0);
  const [processedLifetime, setProcessedLifetime] = useState(0);
  const [pendingLifetime, setPendingLifetime] = useState(0);
  const [recentHistory, setRecentHistory] = useState<HistoryRecord[]>([]);

  const [selectedDetailRecord, setSelectedDetailRecord] = useState<HistoryRecord | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const refreshGlobalState = () => {
    const clients = db.getClients();
    const history = db.getHistory();

    setClientsCount(clients.length);
    setHistoryCount(history.length);
    setTotalLifetime(history.length);
    setProcessedLifetime(history.filter((h) => h.status === 'PROCESSADO').length);
    setPendingLifetime(history.filter((h) => h.status === 'REVISAR' || h.status === 'PENDENTE').length);
    setRecentHistory(history);
  };

  useEffect(() => {
    refreshGlobalState();

    // Sincroniza dados com Supabase se configurado
    Promise.all([db.fetchRemoteClients(), db.fetchRemoteHistory()]).then(() => {
      refreshGlobalState();
    });
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif] text-slate-900 dark:text-slate-100">
      {/* Persistent Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenResetModal={() => setIsResetModalOpen(true)}
        pendingReviewCount={pendingLifetime}
        clientsCount={clientsCount}
        historyCount={historyCount}
      />

      {/* Main App Content View */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50/80 dark:bg-slate-950/80">
        <Suspense fallback={<PageLoadingFallback />}>
          {currentTab === 'dashboard' && (
            <Dashboard
              totalNotesLifetime={totalLifetime}
              processedNotesLifetime={processedLifetime}
              pendingNotesCount={pendingLifetime}
              clientsCount={clientsCount}
              recentHistory={recentHistory}
              onNavigateTab={setCurrentTab}
              onViewInvoiceDetails={(item) => setSelectedDetailRecord(item)}
              onLoadSamples={() => setCurrentTab('process')}
            />
          )}

          {currentTab === 'process' && (
            <ProcessInvoices
              onProcessingCompleted={refreshGlobalState}
            />
          )}

          {currentTab === 'upload' && (
            <UploadDataPage
              onDataUploaded={refreshGlobalState}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'clients' && <ClientsPage />}

          {currentTab === 'history' && (
            <HistoryPage
              onViewInvoiceDetails={(item) => setSelectedDetailRecord(item)}
              onOpenResetModal={() => setIsResetModalOpen(true)}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              onSettingsSaved={refreshGlobalState}
              onOpenResetModal={() => setIsResetModalOpen(true)}
            />
          )}
        </Suspense>
      </main>

      {/* Detail Inspector Modal */}
      {selectedDetailRecord && (
        <Suspense fallback={null}>
          <InvoiceDetailModal
            item={selectedDetailRecord}
            onClose={() => setSelectedDetailRecord(null)}
          />
        </Suspense>
      )}

      {/* Reset Modal Global */}
      {isResetModalOpen && (
        <Suspense fallback={null}>
          <ResetModal
            isOpen={isResetModalOpen}
            onClose={() => setIsResetModalOpen(false)}
            onResetComplete={() => {
              refreshGlobalState();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
