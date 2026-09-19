export type IdentificationMethod =
  | 'CLIENTE_CADASTRADO_POR_CNPJ'
  | 'CNPJ_CONTEXTO'
  | 'IDENTIFICACAO_AUTOMATICA'
  | 'CONFIRMACAO_MANUAL'
  | 'NAO_IDENTIFICADO';

export type InvoiceStatus =
  | 'ANALISANDO'
  | 'IDENTIFICADO'
  | 'PENDENTE'
  | 'PROCESSADO'
  | 'ERRO'
  | 'REVISAR';

export interface Client {
  id: string;
  cnpj: string; // Formatted XX.XXX.XXX/XXXX-XX
  cleanCnpj: string; // 14 digits
  customName: string; // Nome definido pelo usuário ou aceito
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  phone?: string;
  notesCount: number;
  createdAt: string;
  updatedAt: string;
  notesTotalValue?: number;
}

export interface EntityInfo {
  cnpj: string;
  cleanCnpj: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  endereco?: string;
  rawContext?: string;
}

export interface CandidateClient {
  cnpj: string;
  cleanCnpj: string;
  name: string;
  role: 'TOMADOR' | 'DESTINATARIO' | 'CLIENTE' | 'PRESTADOR' | 'EMITENTE' | 'OUTRO';
  confidence: number;
  reason: string;
}

export interface ExtractedInvoiceData {
  numeroNota: string;
  dataEmissao: string; // DD/MM/YYYY
  anoEmissao: string; // YYYY
  mesEmissao: string; // MM
  mesExtenso: string; // 09 - SETEMBRO
  valorTotal: number | null;
  valorTotalFormatted: string;
  
  // Entidades
  prestador: EntityInfo | null;
  tomador: EntityInfo | null;
  destinatario: EntityInfo | null;
  emitente: EntityInfo | null;
  
  // CNPJs encontrados com score e contexto
  allCnpjs: Array<{
    cnpj: string;
    cleanCnpj: string;
    context: string;
    score: number;
    associatedName?: string;
  }>;
  
  // Cliente final selecionado/identificado
  selectedClient: {
    cnpj: string;
    cleanCnpj: string;
    name: string;
    isPreRegistered: boolean;
  } | null;
  
  identificationMethod: IdentificationMethod;
  diagnosticNotes: string;
  candidateClients: CandidateClient[];
  
  // Metadados do PDF
  hasText: boolean;
  needsOcr: boolean;
  pageCount: number;
  rawText: string;
  confidenceScore: number;
}

export interface InvoiceItem {
  id: string;
  file: File;
  originalFileName: string;
  originalFileSize: number;
  status: InvoiceStatus;
  statusMessage?: string;
  extractedData: ExtractedInvoiceData | null;
  generatedFileName: string;
  targetFolderPath: string; // ex: 2026/09 - SETEMBRO/CLIENTE ABC
  destinationFilePath: string; // ex: 2026/09 - SETEMBRO/CLIENTE ABC/NF_123_CLIENTE_R$150,00_01-09-2026.pdf
  processedAt?: string;
  errorMessage?: string;
  
  // Armazenamento Supabase Storage
  storageBucket?: string;
  storagePath?: string;
  storageUrl?: string;
  storageViewUrl?: string;
  storageDownloadUrl?: string;
  isRemoteUploaded?: boolean;

  // Compatibilidade com campos legados
  blobUrl?: string;
  blobPathname?: string;
  blobViewUrl?: string;
  blobDownloadUrl?: string;
}

export interface HistoryRecord {
  id: string;
  originalFileName: string;
  generatedFileName: string;
  clientName: string;
  cnpj: string;
  cleanCnpj: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: number | null;
  invoiceValueFormatted: string;
  status: InvoiceStatus;
  identificationMethod: IdentificationMethod;
  targetPath: string;
  storedFilePath?: string;
  fileUrl?: string;
  
  // Armazenamento Supabase Storage
  storageBucket?: string;
  storagePath?: string;
  storageUrl?: string;
  storageViewUrl?: string;
  storageDownloadUrl?: string;
  storageProvider?: 'supabase' | 'local';

  // Compatibilidade com campos legados
  blobUrl?: string;
  blobPathname?: string;
  blobViewUrl?: string;
  blobDownloadUrl?: string;
  blobStorageName?: string;
  mimeType?: string;
  hasOriginalPdf?: boolean;
  pdfStorageId?: string;
  
  processedAt: string;
  sentWhatsappAt?: string;
  sentEmailAt?: string;
  diagnosticSummary: string;
  rawTextSnippet?: string;
  syncedToSupabase?: boolean;
}

export interface SupabaseStatusResult {
  connected: boolean;
  hasUrl: boolean;
  hasKey: boolean;
  keyType?: 'service_role' | 'anon' | 'none';
  bucket: string;
  bucketExists?: boolean;
  storageAccessible?: boolean;
  tablesStatus?: {
    invoices: boolean;
    clients: boolean;
  };
  message: string;
}


export interface AppSettings {
  sourceDirectoryName: string;
  targetDirectoryName: string;
  namingPattern: string; // ex: NF_[NUMERO]_[CLIENTE]_[VALOR]_[DATA].pdf
  folderStructure:
    | 'MES_CLIENTE'
    | 'CLIENTE_MES'
    | 'CLIENTE_DIRETO'
    | 'ANO_MES_CLIENTE'
    | 'CLIENTE_ANO_MES'
    | 'ANO_CLIENTE';
  duplicateHandling: 'NUMBER_SUFFIX' | 'SKIP';
  autoRegisterNewClients: boolean;
  alertOnAmbiguity: boolean;
  theme?: 'light' | 'dark' | 'system';
  issuerCnpj?: string; // CNPJ da Minha Empresa / Emissor / Prestador
  issuerName?: string; // Razão Social / Nome da Minha Empresa
}

