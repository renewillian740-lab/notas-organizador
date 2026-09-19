import { Client, HistoryRecord, AppSettings } from '../types';
import { cleanCNPJ, formatCNPJ } from '../utils/cnpjValidator';

const CLIENTS_STORAGE_KEY = 'organizador_nf_clientes_v1';
const HISTORY_STORAGE_KEY = 'organizador_nf_historico_v1';
const SETTINGS_STORAGE_KEY = 'organizador_nf_configuracoes_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  sourceDirectoryName: 'Notas Fiscais Origem',
  targetDirectoryName: 'Notas Fiscais Organizadas',
  namingPattern: 'NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf',
  folderStructure: 'MES_CLIENTE',
  duplicateHandling: 'NUMBER_SUFFIX',
  autoRegisterNewClients: false,
  alertOnAmbiguity: true,
};

class LocalDBService {
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
      console.error('Erro ao salvar clientes:', e);
    }
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

    if (existingIndex >= 0) {
      const existing = clients[existingIndex];
      const updated: Client = {
        ...existing,
        customName: clientData.customName.trim() || existing.customName,
        razaoSocial: clientData.razaoSocial?.trim() || existing.razaoSocial,
        nomeFantasia: clientData.nomeFantasia?.trim() || existing.nomeFantasia,
        email: clientData.email !== undefined ? clientData.email.trim() : existing.email,
        phone: clientData.phone !== undefined ? clientData.phone.trim() : existing.phone,
        updatedAt: now,
      };
      clients[existingIndex] = updated;
      this.saveClients(clients);
      return updated;
    } else {
      const newClient: Client = {
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
      clients.push(newClient);
      this.saveClients(clients);
      return newClient;
    }
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

  // ===================== HISTÓRICO =====================

  public getHistory(): HistoryRecord[] {
    try {
      const data = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data) as HistoryRecord[];
    } catch (e) {
      console.error('Erro ao ler histórico:', e);
      return [];
    }
  }

  public saveHistory(history: HistoryRecord[]): void {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Erro ao salvar histórico:', e);
    }
  }

  public addHistoryRecord(record: Omit<HistoryRecord, 'id' | 'processedAt'>): HistoryRecord {
    const history = this.getHistory();
    const newRecord: HistoryRecord = {
      ...record,
      id: 'hist_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      processedAt: new Date().toISOString(),
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
      version: 1,
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
}

export const db = new LocalDBService();
