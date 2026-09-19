import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// In-memory cache de fallback para garantir continuidade perfeita mesmo sem internet/chaves
const localPdfFallback = new Map<
  string,
  {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    uploadedAt: Date;
  }
>();

// In-memory fallback para registros de notas e clientes se Supabase estiver desconectado
const localInvoicesDb: any[] = [];
const localClientsDb: any[] = [];

// Middleware para JSON básico
app.use(express.json({ limit: '10mb' }));

// ==========================================
// SUPABASE CLIENT (Lazy Initialization)
// ==========================================
let supabaseClientInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim();

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  try {
    supabaseClientInstance = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClientInstance;
  } catch (err) {
    console.error('Erro ao inicializar cliente Supabase:', err);
    return null;
  }
}

function getBucketName(): string {
  return (process.env.SUPABASE_STORAGE_BUCKET || 'notas-fiscais').trim();
}

/**
 * Garante que o bucket privado de armazenamento no Supabase Storage exista
 */
async function ensurePrivateBucket(supabase: SupabaseClient, bucketName: string): Promise<boolean> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn('Não foi possível listar buckets do Supabase Storage:', error.message);
      return false;
    }

    const existing = buckets?.find((b) => b.name === bucketName || b.id === bucketName);
    if (!existing) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: false, // Bucket 100% privado e seguro
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['application/pdf'],
      });
      if (createError) {
        console.warn(`Tentativa de criar bucket privado '${bucketName}':`, createError.message);
      }
    }
    return true;
  } catch (err: any) {
    console.warn('Erro ao verificar/criar bucket no Supabase:', err.message);
    return false;
  }
}

// ==========================================
// 1. ROTAS DE STATUS & CONFIGURAÇÃO DO SUPABASE
// ==========================================

app.get(['/api/storage/status', '/api/supabase/status', '/api/blob/status'], async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || '';
  const bucketName = getBucketName();

  const hasUrl = !!supabaseUrl;
  const hasKey = !!(serviceKey || anonKey);
  const keyType = serviceKey ? 'service_role' : anonKey ? 'anon' : 'none';

  let bucketExists = false;
  let tablesStatus = {
    invoices: false,
    clients: false,
  };
  let isConnected = false;
  let message = '';

  const supabase = getSupabase();

  if (supabase && hasUrl && hasKey) {
    try {
      // 1. Testa Storage
      const { data: buckets, error: storageErr } = await supabase.storage.listBuckets();
      if (!storageErr && buckets) {
        isConnected = true;
        bucketExists = buckets.some((b) => b.name === bucketName || b.id === bucketName);
        if (!bucketExists) {
          // Tenta criar automaticamente
          await ensurePrivateBucket(supabase, bucketName);
          bucketExists = true;
        }
      }

      // 2. Testa Tabela invoices
      const { error: invErr } = await supabase.from('invoices').select('id').limit(1);
      tablesStatus.invoices = !invErr;

      // 3. Testa Tabela clients
      const { error: cliErr } = await supabase.from('clients').select('id').limit(1);
      tablesStatus.clients = !cliErr;

      message = `Conectado com sucesso ao Supabase (${supabaseUrl}) com bucket privado '${bucketName}'.`;
    } catch (e: any) {
      isConnected = false;
      message = `Falha na conexão com Supabase: ${e.message}`;
    }
  } else {
    message =
      'Credenciais do Supabase não configuradas (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY). Modo de armazenamento local ativo com cache de alta fidelidade.';
  }

  res.json({
    connected: isConnected,
    hasUrl,
    hasKey,
    keyType,
    bucket: bucketName,
    bucketExists,
    storageAccessible: isConnected && bucketExists,
    tablesStatus,
    message,
    supabaseUrl: hasUrl ? supabaseUrl.replace(/(https?:\/\/)([^.]+)(\..*)/, '$1$2$3') : '',
  });
});

// Retorna o SQL DDL completo para criar o schema no Supabase
app.get('/api/supabase/sql-schema', (req, res) => {
  const bucketName = getBucketName();
  const sql = `
-- ==========================================
-- 1. BUCKET PRIVADO NO SUPABASE STORAGE
-- ==========================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('${bucketName}', '${bucketName}', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 2. TABELA DE NOTAS FISCAIS (invoices)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  original_file_name TEXT NOT NULL,
  generated_file_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  clean_cnpj TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date TEXT,
  invoice_value NUMERIC(12,2),
  invoice_value_formatted TEXT,
  status TEXT DEFAULT 'PROCESSADO',
  identification_method TEXT,
  target_path TEXT,
  storage_bucket TEXT DEFAULT '${bucketName}',
  storage_path TEXT,
  storage_url TEXT,
  storage_view_url TEXT,
  diagnostic_summary TEXT,
  raw_text_snippet TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  sent_whatsapp_at TIMESTAMPTZ,
  sent_email_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_invoices_clean_cnpj ON public.invoices(clean_cnpj);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_processed_at ON public.invoices(processed_at DESC);

-- ==========================================
-- 3. TABELA DE CLIENTES CADASTRADOS (clients)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  cnpj TEXT NOT NULL,
  clean_cnpj TEXT UNIQUE NOT NULL,
  custom_name TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  email TEXT,
  phone TEXT,
  notes_count INTEGER DEFAULT 0,
  notes_total_value NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_clean_cnpj ON public.clients(clean_cnpj);
  `.trim();

  res.json({ sql, bucketName });
});

// ==========================================
// 2. ROTAS DE SUPABASE STORAGE (PDFs ORIGINAIS)
// ==========================================

// Upload de PDF para o Supabase Storage Privado
app.post(
  ['/api/storage/upload', '/api/blob/upload'],
  express.raw({ type: '*/*', limit: '50mb' }),
  async (req, res) => {
    try {
      const rawFileName = req.headers['x-file-name'];
      const originalFileName = rawFileName
        ? decodeURIComponent(rawFileName as string)
        : (req.query.filename as string) || `nota_${Date.now()}.pdf`;

      const buffer = req.body;
      if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
        return res
          .status(400)
          .json({ error: 'Nenhum dado binário de arquivo PDF foi recebido.' });
      }

      const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const storagePath = `nfs/${year}/${month}/${Date.now()}_${sanitizedName}`;
      const bucketName = getBucketName();

      // Armazena no cache local de segurança
      localPdfFallback.set(storagePath, {
        buffer,
        fileName: originalFileName,
        contentType: 'application/pdf',
        uploadedAt: new Date(),
      });
      localPdfFallback.set(originalFileName, {
        buffer,
        fileName: originalFileName,
        contentType: 'application/pdf',
        uploadedAt: new Date(),
      });

      const supabase = getSupabase();

      if (supabase) {
        try {
          await ensurePrivateBucket(supabase, bucketName);

          const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(storagePath, buffer, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (error) {
            console.warn('Erro no upload para o Supabase Storage:', error.message);
            throw error;
          }

          // Gera Signed URL válida por 7 dias para acesso seguro e direto se desejado
          let signedUrl = '';
          try {
            const { data: signData } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
            if (signData?.signedUrl) {
              signedUrl = signData.signedUrl;
            }
          } catch (signErr) {
            console.warn('Aviso: Não foi possível criar Signed URL direta:', signErr);
          }

          const viewUrl = `/api/storage/view?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;
          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;

          return res.json({
            success: true,
            provider: 'supabase',
            store: bucketName,
            bucket: bucketName,
            isPrivate: true,
            storagePath,
            url: signedUrl || viewUrl,
            pathname: storagePath,
            signedUrl,
            viewUrl,
            downloadUrl,
            size: buffer.length,
            originalFileName,
            isRemoteUploaded: true,
          });
        } catch (storageErr: any) {
          console.warn('Supabase Storage upload falhou, mantendo em buffer local:', storageErr.message);
          const viewUrl = `/api/storage/view?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;
          const downloadUrl = `/api/storage/download?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;

          return res.json({
            success: true,
            provider: 'supabase',
            store: bucketName,
            bucket: bucketName,
            isPrivate: true,
            storagePath,
            url: `local://${storagePath}`,
            pathname: storagePath,
            viewUrl,
            downloadUrl,
            size: buffer.length,
            originalFileName,
            isRemoteUploaded: false,
            warning: storageErr.message,
          });
        }
      }

      // Sem Supabase configurado: Retorna URL de visualização local
      const viewUrl = `/api/storage/view?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;
      const downloadUrl = `/api/storage/download?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;

      return res.json({
        success: true,
        provider: 'local',
        store: bucketName,
        bucket: bucketName,
        isPrivate: true,
        storagePath,
        url: `local://${storagePath}`,
        pathname: storagePath,
        viewUrl,
        downloadUrl,
        size: buffer.length,
        originalFileName,
        isRemoteUploaded: false,
        warning: 'Supabase não configurado. PDF retido em cache de memória seguro.',
      });
    } catch (err: any) {
      console.error('Erro no upload de PDF:', err);
      return res.status(500).json({ error: err.message || 'Erro interno no upload' });
    }
  }
);

// Visualização do PDF original (inline stream seguro)
app.get(['/api/storage/view', '/api/blob/view'], async (req, res) => {
  const storagePath = (req.query.path as string) || (req.query.pathname as string) || '';
  const url = (req.query.url as string) || '';
  const filename = (req.query.filename as string) || 'nota_fiscal_original.pdf';
  const bucketName = (req.query.bucket as string) || getBucketName();

  const targetPath = storagePath || (url.startsWith('local://') ? url.replace('local://', '') : url);

  const supabase = getSupabase();

  if (supabase && targetPath && !targetPath.startsWith('local/')) {
    try {
      const { data, error } = await supabase.storage.from(bucketName).download(targetPath);
      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${encodeURIComponent(filename)}"`
        );
        res.setHeader('Content-Length', String(buffer.length));
        return res.send(buffer);
      }
    } catch (err: any) {
      console.warn('Erro ao baixar do Supabase Storage para visualização:', err.message);
    }
  }

  // Fallback para cache em memória
  const local =
    localPdfFallback.get(targetPath) ||
    localPdfFallback.get(storagePath) ||
    localPdfFallback.get(filename) ||
    localPdfFallback.get(url);

  if (local) {
    res.setHeader('Content-Type', local.contentType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(local.fileName || filename)}"`
    );
    res.setHeader('Content-Length', String(local.buffer.length));
    return res.send(local.buffer);
  }

  return res.status(404).send('Documento PDF não encontrado no Supabase Storage.');
});

// Gerar URL assinada temporária sob demanda para o PDF original
app.get('/api/storage/signed-url', async (req, res) => {
  const storagePath = (req.query.path as string) || (req.query.pathname as string) || '';
  const bucketName = (req.query.bucket as string) || getBucketName();
  const filename = (req.query.filename as string) || 'nota_fiscal_original.pdf';
  const expiresIn = parseInt((req.query.expiresIn as string) || '3600', 10); // 1 hora padrão

  const supabase = getSupabase();

  if (supabase && storagePath && !storagePath.startsWith('local/')) {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(storagePath, expiresIn);

      if (!error && data?.signedUrl) {
        return res.json({
          success: true,
          signedUrl: data.signedUrl,
          expiresIn,
          bucket: bucketName,
          storagePath,
          viewUrl: data.signedUrl,
        });
      }
    } catch (err: any) {
      console.warn('Erro ao criar URL assinada no Supabase:', err.message);
    }
  }

  const fallbackViewUrl = `/api/storage/view?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(filename)}`;
  return res.json({
    success: true,
    signedUrl: fallbackViewUrl,
    viewUrl: fallbackViewUrl,
    bucket: bucketName,
    storagePath,
    isFallback: true,
  });
});

// Download do PDF original (attachment)
app.get(['/api/storage/download', '/api/blob/download'], async (req, res) => {
  const storagePath = (req.query.path as string) || (req.query.pathname as string) || '';
  const url = (req.query.url as string) || '';
  const filename = (req.query.filename as string) || 'nota_fiscal_original.pdf';
  const bucketName = (req.query.bucket as string) || getBucketName();

  const targetPath = storagePath || (url.startsWith('local://') ? url.replace('local://', '') : url);

  const supabase = getSupabase();

  if (supabase && targetPath && !targetPath.startsWith('local/')) {
    try {
      const { data, error } = await supabase.storage.from(bucketName).download(targetPath);
      if (!error && data) {
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(filename)}"`
        );
        res.setHeader('Content-Length', String(buffer.length));
        return res.send(buffer);
      }
    } catch (err: any) {
      console.warn('Erro ao baixar do Supabase Storage:', err.message);
    }
  }

  const local =
    localPdfFallback.get(targetPath) ||
    localPdfFallback.get(storagePath) ||
    localPdfFallback.get(filename);

  if (local) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(local.fileName || filename)}"`
    );
    return res.send(local.buffer);
  }

  return res.status(404).send('Arquivo não encontrado para download.');
});

// ==========================================
// 3. ROTAS DE PERSISTÊNCIA NO SUPABASE (TABELA invoices)
// ==========================================

// Listar histórico de notas fiscais do Supabase
app.get('/api/invoices', async (req, res) => {
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('processed_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        // Mapeia snake_case para o modelo camelCase do app
        const formatted = data.map((row: any) => ({
          id: row.id,
          originalFileName: row.original_file_name,
          generatedFileName: row.generated_file_name,
          clientName: row.client_name,
          cnpj: row.cnpj,
          cleanCnpj: row.clean_cnpj,
          invoiceNumber: row.invoice_number,
          invoiceDate: row.invoice_date,
          invoiceValue: row.invoice_value ? Number(row.invoice_value) : null,
          invoiceValueFormatted: row.invoice_value_formatted,
          status: row.status,
          identificationMethod: row.identification_method,
          targetPath: row.target_path,
          storageBucket: row.storage_bucket,
          storagePath: row.storage_path,
          storageUrl: row.storage_url,
          storageViewUrl: row.storage_view_url,
          diagnosticSummary: row.diagnostic_summary,
          rawTextSnippet: row.raw_text_snippet,
          processedAt: row.processed_at,
          sentWhatsappAt: row.sent_whatsapp_at,
          sentEmailAt: row.sent_email_at,
          syncedToSupabase: true,
        }));

        return res.json({ success: true, source: 'supabase', data: formatted });
      }
    } catch (e: any) {
      console.warn('Erro ao consultar notas do Supabase, retornando cache local:', e.message);
    }
  }

  return res.json({ success: true, source: 'local', data: localInvoicesDb });
});

// Salvar/Persistir registro de nota fiscal no Supabase
app.post('/api/invoices', async (req, res) => {
  const item = req.body;
  if (!item || !item.originalFileName) {
    return res.status(400).json({ error: 'Dados da nota fiscal incompletos.' });
  }

  const recordId = item.id || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const processedAt = item.processedAt || new Date().toISOString();

  const supabaseRow = {
    id: recordId,
    original_file_name: item.originalFileName,
    generated_file_name: item.generatedFileName || item.originalFileName,
    client_name: item.clientName || 'Não Identificado',
    cnpj: item.cnpj || '',
    clean_cnpj: item.cleanCnpj || '',
    invoice_number: item.invoiceNumber || '',
    invoice_date: item.invoiceDate || '',
    invoice_value: item.invoiceValue !== null && item.invoiceValue !== undefined ? Number(item.invoiceValue) : null,
    invoice_value_formatted: item.invoiceValueFormatted || '',
    status: item.status || 'PROCESSADO',
    identification_method: item.identificationMethod || 'IDENTIFICACAO_AUTOMATICA',
    target_path: item.targetPath || '',
    storage_bucket: item.storageBucket || getBucketName(),
    storage_path: item.storagePath || item.blobPathname || '',
    storage_url: item.storageUrl || item.blobUrl || '',
    storage_view_url: item.storageViewUrl || item.blobViewUrl || '',
    diagnostic_summary: item.diagnosticSummary || '',
    raw_text_snippet: item.rawTextSnippet || '',
    processed_at: processedAt,
    sent_whatsapp_at: item.sentWhatsappAt || null,
    sent_email_at: item.sentEmailAt || null,
  };

  // Atualiza cache local em memória
  const existingIdx = localInvoicesDb.findIndex((i) => i.id === recordId);
  const localRecord = {
    ...item,
    id: recordId,
    processedAt,
    syncedToSupabase: false,
  };
  if (existingIdx >= 0) {
    localInvoicesDb[existingIdx] = localRecord;
  } else {
    localInvoicesDb.unshift(localRecord);
  }

  const supabase = getSupabase();
  let savedToRemote = false;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('invoices').upsert(supabaseRow).select();
      if (!error) {
        savedToRemote = true;
        localRecord.syncedToSupabase = true;
      } else {
        console.warn('Aviso ao persistir nota no Supabase:', error.message);
      }
    } catch (e: any) {
      console.warn('Falha na inserção da nota no Supabase:', e.message);
    }
  }

  return res.json({
    success: true,
    savedToRemote,
    record: localRecord,
  });
});

// Atualizar status de envio (WhatsApp / E-mail) no Supabase
app.patch('/api/invoices/dispatch', async (req, res) => {
  const { recordIds, channel } = req.body;
  if (!Array.isArray(recordIds) || recordIds.length === 0 || !channel) {
    return res.status(400).json({ error: 'Parâmetros recordIds e channel são obrigatórios.' });
  }

  const now = new Date().toISOString();
  const updatePayload: any = {
    updated_at: now,
  };
  if (channel === 'whatsapp') {
    updatePayload.sent_whatsapp_at = now;
  } else if (channel === 'email') {
    updatePayload.sent_email_at = now;
  }

  // Atualiza cache local
  for (const inv of localInvoicesDb) {
    if (recordIds.includes(inv.id)) {
      if (channel === 'whatsapp') inv.sentWhatsappAt = now;
      if (channel === 'email') inv.sentEmailAt = now;
    }
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('invoices').update(updatePayload).in('id', recordIds);
    } catch (e: any) {
      console.warn('Erro ao atualizar status de envio no Supabase:', e.message);
    }
  }

  res.json({ success: true, updatedCount: recordIds.length, timestamp: now });
});

// Limpar histórico de notas fiscais
app.delete('/api/invoices', async (req, res) => {
  localInvoicesDb.length = 0;
  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('invoices').delete().neq('id', 'placeholder');
    } catch (e: any) {
      console.warn('Erro ao limpar notas no Supabase:', e.message);
    }
  }
  res.json({ success: true, message: 'Histórico de notas limpo.' });
});

// ==========================================
// 4. ROTAS DE CLIENTES NO SUPABASE (TABELA clients)
// ==========================================

app.get('/api/clients', async (req, res) => {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('custom_name');
      if (!error && Array.isArray(data)) {
        const mapped = data.map((row: any) => ({
          id: row.id,
          cnpj: row.cnpj,
          cleanCnpj: row.clean_cnpj,
          customName: row.custom_name,
          razaoSocial: row.razao_social,
          nomeFantasia: row.nome_fantasia,
          email: row.email,
          phone: row.phone,
          notesCount: row.notes_count || 0,
          notesTotalValue: row.notes_total_value ? Number(row.notes_total_value) : 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        return res.json({ success: true, source: 'supabase', data: mapped });
      }
    } catch (e: any) {
      console.warn('Erro ao carregar clientes do Supabase:', e.message);
    }
  }
  return res.json({ success: true, source: 'local', data: localClientsDb });
});

app.post('/api/clients', async (req, res) => {
  const client = req.body;
  if (!client || !client.cleanCnpj || !client.customName) {
    return res.status(400).json({ error: 'Dados do cliente incompletos.' });
  }

  const clientId = client.id || `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const supabaseRow = {
    id: clientId,
    cnpj: client.cnpj,
    clean_cnpj: client.cleanCnpj,
    custom_name: client.customName,
    razao_social: client.razaoSocial || null,
    nome_fantasia: client.nomeFantasia || null,
    email: client.email || null,
    phone: client.phone || null,
    notes_count: client.notesCount || 0,
    notes_total_value: client.notesTotalValue || 0,
    created_at: client.createdAt || now,
    updated_at: now,
  };

  const existingIdx = localClientsDb.findIndex((c) => c.cleanCnpj === client.cleanCnpj);
  const updatedClient = {
    ...client,
    id: clientId,
    updatedAt: now,
  };
  if (existingIdx >= 0) {
    localClientsDb[existingIdx] = updatedClient;
  } else {
    localClientsDb.push(updatedClient);
  }

  const supabase = getSupabase();
  let savedToRemote = false;

  if (supabase) {
    try {
      const { error } = await supabase.from('clients').upsert(supabaseRow, { onConflict: 'clean_cnpj' });
      if (!error) {
        savedToRemote = true;
      }
    } catch (e: any) {
      console.warn('Erro ao salvar cliente no Supabase:', e.message);
    }
  }

  res.json({ success: true, savedToRemote, client: updatedClient });
});

app.delete('/api/clients/:id', async (req, res) => {
  const { id } = req.params;
  const idx = localClientsDb.findIndex((c) => c.id === id);
  if (idx >= 0) localClientsDb.splice(idx, 1);

  const supabase = getSupabase();
  if (supabase) {
    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch (e: any) {
      console.warn('Erro ao excluir cliente no Supabase:', e.message);
    }
  }
  res.json({ success: true });
});

// ==========================================
// 5. ROTA DE RESET GERAL DO SISTEMA (ZERAR TUDO)
// ==========================================
app.post('/api/system/reset-all', async (req, res) => {
  const { clearHistory = true, clearClients = false, clearStorage = true } = req.body || {};

  if (clearHistory) {
    localInvoicesDb.length = 0;
  }
  if (clearClients) {
    localClientsDb.length = 0;
  }
  localPdfFallback.clear();

  const supabase = getSupabase();
  const bucketName = getBucketName();
  let deletedFilesCount = 0;

  if (supabase) {
    try {
      if (clearHistory) {
        await supabase.from('invoices').delete().neq('id', '__keep_none__');
      }
      if (clearClients) {
        await supabase.from('clients').delete().neq('id', '__keep_none__');
      }

      if (clearStorage) {
        const { data: rootFiles } = await supabase.storage.from(bucketName).list('', { limit: 100 });
        if (rootFiles && rootFiles.length > 0) {
          const directFiles = rootFiles.filter((f) => !f.id && f.name).map((f) => f.name);
          if (directFiles.length > 0) {
            await supabase.storage.from(bucketName).remove(directFiles);
            deletedFilesCount += directFiles.length;
          }
        }

        // Limpeza de pastas nfs/
        const currentYear = new Date().getFullYear().toString();
        const { data: months } = await supabase.storage.from(bucketName).list(`nfs/${currentYear}`);
        if (months && months.length > 0) {
          for (const m of months) {
            const { data: mFiles } = await supabase.storage.from(bucketName).list(`nfs/${currentYear}/${m.name}`);
            if (mFiles && mFiles.length > 0) {
              const paths = mFiles.map((f) => `nfs/${currentYear}/${m.name}/${f.name}`);
              await supabase.storage.from(bucketName).remove(paths);
              deletedFilesCount += paths.length;
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('Aviso durante reset no Supabase:', e.message);
    }
  }

  return res.json({
    success: true,
    message: 'Sistema zerado com sucesso.',
    clearedHistory: clearHistory,
    clearedClients: clearClients,
    clearedStorage: clearStorage,
    deletedFilesCount,
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storageProvider: 'supabase',
    bucket: getBucketName(),
  });
});

// ==========================================
// 5. VITE MIDDLEWARE / STATIC ASSETS
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor Organizador NF ativo na porta ${PORT} com Supabase Storage e DB.`);
  });
}

startServer();
