import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  Building,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  Sparkles,
  FileQuestion,
  UserCheck,
  Eye,
} from 'lucide-react';
import { InvoiceItem, CandidateClient } from '../types';
import { formatCNPJ, cleanCNPJ, isValidCNPJ } from '../utils/cnpjValidator';
import { db } from '../services/db';
import { generateInvoiceFileName, generateTargetFolderPath } from '../services/fileOrganizer';
import { PdfViewerModal } from './PdfViewerModal';

interface ReviewModalProps {
  pendingItems: InvoiceItem[];
  onClose: () => void;
  onSaveItemReview: (
    itemId: string,
    updatedData: {
      clientName: string;
      cnpj: string;
      registerNewClient: boolean;
      manualNumber?: string;
      manualDate?: string;
      manualValue?: number;
    }
  ) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  pendingItems,
  onClose,
  onSaveItemReview,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentItem = pendingItems[currentIndex];

  const [selectedCnpj, setSelectedCnpj] = useState('');
  const [customName, setCustomName] = useState('');
  const [registerNewClient, setRegisterNewClient] = useState(true);
  const [manualNumber, setManualNumber] = useState('');
  const [manualDate, setManualDate] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Sincroniza estado quando muda de item
  useEffect(() => {
    if (currentItem && currentItem.extractedData) {
      const selected = currentItem.extractedData.selectedClient;
      const topCand = currentItem.extractedData.candidateClients[0];
      
      const initialCnpj = selected?.cnpj || topCand?.cnpj || '';
      const initialName = selected?.name || topCand?.name || '';

      setSelectedCnpj(initialCnpj);
      setCustomName(initialName);
      setRegisterNewClient(true);
      setManualNumber(currentItem.extractedData.numeroNota || '');
      setManualDate(currentItem.extractedData.dataEmissao || '');
      setManualValue(
        currentItem.extractedData.valorTotal !== null && currentItem.extractedData.valorTotal !== undefined
          ? String(currentItem.extractedData.valorTotal)
          : ''
      );
    } else if (currentItem) {
      setSelectedCnpj('');
      setCustomName('');
      setRegisterNewClient(false);
      setManualNumber('');
      setManualDate('');
      setManualValue('');
    }
  }, [currentIndex, currentItem]);

  if (!currentItem) {
    return null;
  }

  const isNeedsOcr = currentItem.extractedData?.needsOcr;
  const isAmbiguous = currentItem.extractedData?.identificationMethod === 'NAO_IDENTIFICADO';
  const isUnregistered = currentItem.extractedData?.selectedClient && !currentItem.extractedData.selectedClient.isPreRegistered;

  const candidates: CandidateClient[] = currentItem.extractedData?.candidateClients || [];

  const handleSelectCandidate = (candidate: CandidateClient) => {
    setSelectedCnpj(candidate.cnpj);
    setCustomName(candidate.name);
  };

  const handleApply = () => {
    const clean = cleanCNPJ(selectedCnpj);
    let valNum: number | undefined = undefined;
    if (manualValue) {
      const parsed = parseFloat(manualValue.replace(',', '.'));
      if (!isNaN(parsed)) valNum = parsed;
    }

    onSaveItemReview(currentItem.id, {
      clientName: customName.trim() || 'CLIENTE_CONFIRMADO',
      cnpj: clean ? formatCNPJ(clean) : '',
      registerNewClient: registerNewClient && isValidCNPJ(clean),
      manualNumber: manualNumber.trim() || undefined,
      manualDate: manualDate.trim() || undefined,
      manualValue: valNum,
    });

    if (currentIndex < pendingItems.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto text-slate-900 dark:text-slate-100">
      <div
        id="modal-review-stepper"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header with progress stepper */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Modo de Revisão de Notas</h2>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200">
                  {currentIndex + 1} de {pendingItems.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-sm">
                {currentItem.originalFileName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-review-view-pdf"
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Visualizar PDF original no Supabase Storage"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ver PDF</span>
            </button>
            <button
              id="btn-close-review"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Situation Banner */}
          {isNeedsOcr ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3">
              <FileQuestion className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-sm">Documento sem texto pesquisável (Necessita OCR)</strong>
                <p className="mt-0.5 text-rose-800 dark:text-rose-300">
                  Este PDF foi escaneado como imagem e não contém texto vetorial. Preencha os dados abaixo manualmente para incluir esta nota na organização.
                </p>
              </div>
            </div>
          ) : isAmbiguous ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-sm">Cliente Não Identificado com Certeza</strong>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  O sistema encontrou múltiplos CNPJs ou ambiguidade entre Prestador e Tomador. Selecione o candidato correto ou digite o nome do cliente.
                </p>
              </div>
            </div>
          ) : isUnregistered ? (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-sm">Nova Empresa Identificada</strong>
                <p className="mt-0.5 text-blue-800 dark:text-blue-300">
                  Identificamos o tomador da nota. Você pode ajustar o nome padrão que será utilizado e salvá-lo no cadastro permanente.
                </p>
              </div>
            </div>
          ) : null}

          {/* Candidate selection if multiple */}
          {candidates.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                Possíveis Candidatos Encontrados no PDF:
              </label>
              <div className="grid grid-cols-1 gap-2">
                {candidates.map((cand, idx) => {
                  const isSelected = selectedCnpj === cand.cnpj;
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSelectCandidate(cand)}
                      className={`text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/50 shadow-xs ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{cand.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {cand.role}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">{cand.cnpj}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">{cand.reason}</div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edit form */}
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                Nome que será utilizado para organização e pastas:
              </label>
              <input
                id="input-review-client-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Ex: ACME LOGISTICA"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                CNPJ da Empresa / Tomador:
              </label>
              <input
                id="input-review-cnpj"
                type="text"
                value={selectedCnpj}
                onChange={(e) => setSelectedCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* If missing or OCR, manual fiscal fields */}
            {isNeedsOcr && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Número NF</label>
                  <input
                    type="text"
                    value={manualNumber}
                    onChange={(e) => setManualNumber(e.target.value)}
                    placeholder="1234"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Data Emissão</label>
                  <input
                    type="text"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    placeholder="18/09/2026"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Valor (R$)</label>
                  <input
                    type="text"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    placeholder="1500.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            )}

            {/* Checkbox to add to permanent database */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <input
                type="checkbox"
                id="check-register-client"
                checked={registerNewClient}
                onChange={(e) => setRegisterNewClient(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="check-register-client" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <span className="font-bold text-slate-900 dark:text-slate-100 block">Salvar no Cadastro Permanente de Clientes</span>
                Depois de cadastrado, sempre que este CNPJ aparecer novamente em futuras notas, o sistema utilizará este nome automaticamente.
              </label>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => prev - 1)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={currentIndex === pendingItems.length - 1}
              onClick={() => setCurrentIndex((prev) => prev + 1)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Pular / Fechar
            </button>
            <button
              id="btn-confirm-review-item"
              type="button"
              onClick={handleApply}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
            >
              {currentIndex < pendingItems.length - 1 ? 'Confirmar e Próximo' : 'Confirmar e Concluir'}
            </button>
          </div>
        </div>
      </div>

      {/* Visualizador de PDF Original no Vercel Blob */}
      {isPreviewOpen && (
        <PdfViewerModal
          item={currentItem}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
};
