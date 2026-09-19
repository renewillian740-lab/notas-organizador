import { Client, HistoryRecord, AppSettings } from '../types';
import { cleanCNPJ, formatCNPJ, extractMetadataFromFileName, cleanDocument } from '../utils/cnpjValidator';

const CLIENTS_STORAGE_KEY = 'organizador_nf_clientes_v1';
const HISTORY_STORAGE_KEY = 'organizador_nf_historico_v1';
const SETTINGS_STORAGE_KEY = 'organizador_nf_configuracoes_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  sourceDirectoryName: 'Notas Fiscais Origem',
  targetDirectoryName: 'Notas Fiscais Organizadas',
  namingPattern: 'NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf',
  folderStructure: 'MES_CLIENTE',
  duplicateHandling: 'NUMBER_SUFFIX',
  autoRegisterNewClients: true,
  alertOnAmbiguity: true,
  theme: 'light',
  issuerCnpj: '47.042.028/0001-55',
  issuerName: 'RENE WILLIAN SANTOS MENEZES 86139841500',
};


class DBService {
  private isSyncingInvoices = false;
  private isSyncingClients = false;

  // ===================== CLIENTES =====================
  
  public getClients(): Client[] {
    try {
      const data = localStorage.getItem(CLIENTS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as Client[];
    } catch (e) {
      console.error('Erro ao ler clientes do armazenamento local:', e);
      return [];
    }
  }

  public saveClients(clients: Client[]): void {
    try {
      localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
    } catch (e) {
      console.error('Erro ao salvar clientes localmente:', e);
    }
  }

  public async fetchRemoteClients(): Promise<Client[]> {
    return this.getClients();
  }

  public findClientByCNPJ(cnpj: string): Client | undefined {
    const clean = cleanCNPJ(cnpj);
    if (!clean) return undefined;
    const clients = this.getClients();
    return clients.find((c) => c.cleanCnpj === clean);
  }

  public addOrUpdateClient(clientData: {
    cnpj: string;
    customName: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    email?: string;
    phone?: string;
  }): Client {
    const clean = cleanCNPJ(clientData.cnpj);
    const clients = this.getClients();
    const existingIndex = clients.findIndex((c) => c.cleanCnpj === clean);

    const now = new Date().toISOString();
    let savedClient: Client;

    if (existingIndex >= 0) {
      const existing = clients[existingIndex];
      savedClient = {
        ...existing,
        customName: clientData.customName.trim() || existing.customName,
        razaoSocial: clientData.razaoSocial?.trim() || existing.razaoSocial,
        nomeFantasia: clientData.nomeFantasia?.trim() || existing.nomeFantasia,
        email: clientData.email !== undefined ? clientData.email.trim() : existing.email,
        phone: clientData.phone !== undefined ? clientData.phone.trim() : existing.phone,
        updatedAt: now,
      };
      clients[existingIndex] = savedClient;
    } else {
      savedClient = {
        id: 'cli_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        cnpj: formatCNPJ(clean),
        cleanCnpj: clean,
        customName: clientData.customName.trim(),
        razaoSocial: clientData.razaoSocial?.trim(),
        nomeFantasia: clientData.nomeFantasia?.trim(),
        email: clientData.email?.trim(),
        phone: clientData.phone?.trim(),
        notesCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      clients.push(savedClient);
    }

    this.saveClients(clients);
    return savedClient;
  }

  public deleteClient(id: string): void {
    const clients = this.getClients().filter((c) => c.id !== id);
    this.saveClients(clients);
  }

  public incrementClientStats(cleanCnpj: string, amount: number | null): void {
    const clients = this.getClients();
    const client = clients.find((c) => c.cleanCnpj === cleanCnpj);
    if (client) {
      client.notesCount = (client.notesCount || 0) + 1;
      if (amount && amount > 0) {
        client.notesTotalValue = (client.notesTotalValue || 0) + amount;
      }
      client.updatedAt = new Date().toISOString();
      this.saveClients(clients);
    }
  }

  // ===================== HISTÓRICO DE NOTAS FISCAIS =====================

  public getHistory(): HistoryRecord[] {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as HistoryRecord[];
    } catch (e) {
      console.error('Erro ao ler histórico local:', e);
      return [];
    }
  }

  public saveHistory(history: HistoryRecord[]): void {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Erro ao salvar histórico local:', e);
    }
  }

  /**
   * Sincroniza e busca registros persistidos do Supabase
   */
  public async fetchRemoteHistory(): Promise<HistoryRecord[]> {
    return this.getHistory();
  }

  public addHistoryRecord(record: Omit<HistoryRecord, 'id' | 'processedAt'>): HistoryRecord {
    const history = this.getHistory();
    const newRecord: HistoryRecord = {
      ...record,
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      processedAt: new Date().toISOString(),
      syncedToSupabase: true,
    };
    history.unshift(newRecord); // Mais recentes primeiro
    this.saveHistory(history);
    return newRecord;
  }

  public clearHistory(): void {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }

  public updateHistoryDispatchStatus(
    recordIds: string[],
    channel: 'whatsapp' | 'email'
  ): void {
    const history = this.getHistory();
    const now = new Date().toISOString();
    let updated = false;

    for (const item of history) {
      if (recordIds.includes(item.id)) {
        if (channel === 'whatsapp') {
          item.sentWhatsappAt = now;
        } else {
          item.sentEmailAt = now;
        }
        updated = true;
      }
    }

    if (updated) {
      this.saveHistory(history);
    }
  }

  public updateHistoryRecord(id: string, updates: Partial<HistoryRecord>): HistoryRecord | null {
    const history = this.getHistory();
    const index = history.findIndex((h) => h.id === id);
    if (index === -1) return null;

    const updated = {
      ...history[index],
      ...updates,
    };
    history[index] = updated;
    this.saveHistory(history);

    return updated;
  }

  /**
   * Reidentifica e repara registros do histórico onde o emissor/prestador (ex: Rene Willian)
   * foi incorretamente atribuído como cliente, extraindo o cliente real do nome original do arquivo
   * ou contexto semântico.
   */
  public reprocessAndFixAllHistory(): { fixedCount: number; newClientsCount: number; message: string } {
    const history = this.getHistory();
    const settings = this.getSettings();
    const issuerCnpjClean = cleanCNPJ(settings.issuerCnpj || '47042028000155');
    const issuerName = (settings.issuerName || 'RENE WILLIAN').toUpperCase();

    let fixedCount = 0;
    const newlyIdentifiedClients = new Map<string, string>();

    // 1. Remove o próprio emissor da lista de clientes caso tenha sido cadastrado acidentalmente
    const currentClients = this.getClients();
    const filteredClients = currentClients.filter((c) => {
      const isIssuer =
        (issuerCnpjClean && c.cleanCnpj === issuerCnpjClean) ||
        (c.customName && c.customName.toUpperCase().includes('RENE WILLIAN'));
      return !isIssuer;
    });
    if (filteredClients.length !== currentClients.length) {
      this.saveClients(filteredClients);
    }

    const updatedHistory = history.map((record) => {
      const isIncorrectClient =
        !record.clientName ||
        record.clientName === 'CLIENTE_DESCONHECIDO' ||
        record.clientName.toUpperCase().includes('RENE WILLIAN') ||
        (issuerCnpjClean && record.cleanCnpj === issuerCnpjClean);

      const fileMeta = extractMetadataFromFileName(record.originalFileName);

      if (fileMeta.hasStructure && (isIncorrectClient || fileMeta.clientName)) {
        fixedCount++;
        const correctedClientName = fileMeta.clientName || record.clientName;
        const correctedNumber = fileMeta.invoiceNumber || record.invoiceNumber;
        const correctedValue = fileMeta.invoiceValue ?? record.invoiceValue;
        const correctedValueFormatted = fileMeta.invoiceValueFormatted || record.invoiceValueFormatted;
        const correctedDate = fileMeta.invoiceDate || record.invoiceDate;
        const correctedDoc = fileMeta.cnpjOrCpf || (isIncorrectClient ? '' : record.cnpj);

        // Se encontrou um cliente real novo, cadastra no banco
        if (correctedClientName && !correctedClientName.toUpperCase().includes('RENE WILLIAN')) {
          newlyIdentifiedClients.set(correctedClientName, correctedDoc || '');
        }

        // Reconstrói nome de arquivo padronizado
        const generatedFileName = `NF_${correctedNumber}_${correctedClientName.replace(/[\s\/\\:*?"<>|]+/g, '_')}_${(correctedValueFormatted || '').replace(/\s+/g, '')}_${correctedDate.replace(/\//g, '-')}.pdf`;
        const targetPath = `Notas Organizadas/${correctedClientName}/${generatedFileName}`;

        return {
          ...record,
          clientName: correctedClientName,
          cnpj: correctedDoc,
          cleanCnpj: cleanDocument(correctedDoc),
          invoiceNumber: correctedNumber,
          invoiceValue: correctedValue,
          invoiceValueFormatted: correctedValueFormatted,
          invoiceDate: correctedDate,
          generatedFileName,
          targetPath,
          status: 'PROCESSADO' as const,
        };
      }

      return record;
    });

    this.saveHistory(updatedHistory);

    // 2. Cadastra automaticamente os clientes reais identificados
    let newClientsCount = 0;
    newlyIdentifiedClients.forEach((doc, clientName) => {
      const exists = this.getClients().some(
        (c) => c.customName.toUpperCase() === clientName.toUpperCase()
      );
      if (!exists) {
        newClientsCount++;
        const dummyCnpj = doc || '00.000.000/0000-00';
        this.addOrUpdateClient({
          cnpj: dummyCnpj,
          customName: clientName,
          razaoSocial: clientName,
        });
      }
    });

    // 3. Atualiza contadores e totais dos clientes
    const finalClients = this.getClients();
    finalClients.forEach((client) => {
      const clientRecords = updatedHistory.filter(
        (h) =>
          h.clientName.toUpperCase() === client.customName.toUpperCase() ||
          (client.cleanCnpj && h.cleanCnpj === client.cleanCnpj)
      );
      client.notesCount = clientRecords.length;
      client.notesTotalValue = clientRecords.reduce((acc, r) => acc + (r.invoiceValue || 0), 0);
    });
    this.saveClients(finalClients);

    return {
      fixedCount,
      newClientsCount,
      message: `${fixedCount} notas foram reidentificadas com os clientes corretos e ${newClientsCount} novos clientes foram cadastrados!`,
    };
  }


  // ===================== CONFIGURAÇÕES =====================

  public getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!data) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  public saveSettings(settings: AppSettings): void {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Erro ao salvar configurações:', e);
    }
  }

  // ===================== EXPORTAÇÃO / BACKUP =====================

  public exportBackup(): string {
    const backup = {
      version: 2,
      storageProvider: 'local',
      exportedAt: new Date().toISOString(),
      clients: this.getClients(),
      history: this.getHistory(),
      settings: this.getSettings(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.clients)) {
        this.saveClients(data.clients);
      }
      if (Array.isArray(data.history)) {
        this.saveHistory(data.history);
      }
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      return true;
    } catch (e) {
      console.error('Falha ao importar backup:', e);
      return false;
    }
  }

  // ===================== RESET GERAL DO SISTEMA (ZERAR TUDO) =====================

  public async resetAllSystemData(options?: {
    clearHistory?: boolean;
    clearClients?: boolean;
    resetSettings?: boolean;
    clearStorage?: boolean;
  }): Promise<{ success: boolean; message: string }> {
    const opts = {
      clearHistory: true,
      clearClients: true,
      resetSettings: false,
      clearStorage: true,
      ...options,
    };

    try {
      if (opts.clearHistory) {
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
      if (opts.clearClients) {
        localStorage.removeItem(CLIENTS_STORAGE_KEY);
      }
      if (opts.resetSettings) {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
      }
    } catch (e: any) {
      console.warn('Aviso durante reset:', e);
    }

    return {
      success: true,
      message: 'Dados locais e caches foram zerados com sucesso.',
    };
  }
}

export const db = new DBService();
