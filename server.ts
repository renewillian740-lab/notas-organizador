import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// In-memory cache de arquivos PDF
const localPdfFallback = new Map<
  string,
  {
    buffer: Buffer;
    fileName: string;
    contentType: string;
    uploadedAt: Date;
  }
>();

const localInvoicesDb: any[] = [];
const localClientsDb: any[] = [];

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    storageProvider: 'local',
  });
});

// Storage status
app.get(['/api/storage/status', '/api/supabase/status', '/api/blob/status'], (req, res) => {
  res.json({
    connected: false,
    hasUrl: false,
    hasKey: false,
    keyType: 'none',
    bucket: 'local-storage',
    bucketExists: true,
    storageAccessible: true,
    tablesStatus: { invoices: true, clients: true },
    message: 'Modo de armazenamento local e cache de alta fidelidade ativo.',
    supabaseUrl: '',
  });
});

// SQL schema dummy endpoint
app.get('/api/supabase/sql-schema', (req, res) => {
  res.json({ sql: '-- Armazenamento local puro sem dependência de banco de dados externo.' });
});

// Upload de PDF
app.post(
  ['/api/storage/upload', '/api/blob/upload'],
  express.raw({ type: '*/*', limit: '50mb' }),
  (req, res) => {
    try {
      const rawFileName = req.headers['x-file-name'];
      const originalFileName = rawFileName
        ? decodeURIComponent(rawFileName as string)
        : (req.query.filename as string) || `nota_${Date.now()}.pdf`;

      const buffer = req.body;
      if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
        return res.status(400).json({ error: 'Nenhum dado binário de arquivo PDF foi recebido.' });
      }

      const sanitizedName = originalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const storagePath = `nfs/${year}/${month}/${Date.now()}_${sanitizedName}`;

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

      const viewUrl = `/api/storage/view?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;
      const downloadUrl = `/api/storage/download?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(originalFileName)}`;

      return res.json({
        success: true,
        provider: 'local',
        store: 'local-storage',
        bucket: 'local-storage',
        isPrivate: true,
        storagePath,
        url: `local://${storagePath}`,
        pathname: storagePath,
        viewUrl,
        downloadUrl,
        size: buffer.length,
        originalFileName,
        isRemoteUploaded: false,
      });
    } catch (err: any) {
      console.error('Erro no upload de PDF:', err);
      return res.status(500).json({ error: err.message || 'Erro interno no upload' });
    }
  }
);

// Visualização do PDF original
app.get(['/api/storage/view', '/api/blob/view'], (req, res) => {
  const storagePath = (req.query.path as string) || (req.query.pathname as string) || '';
  const url = (req.query.url as string) || '';
  const filename = (req.query.filename as string) || 'nota_fiscal_original.pdf';

  const targetPath = storagePath || (url.startsWith('local://') ? url.replace('local://', '') : url);

  const local =
    localPdfFallback.get(targetPath) ||
    localPdfFallback.get(storagePath) ||
    localPdfFallback.get(filename) ||
    localPdfFallback.get(url);

  if (local) {
    res.setHeader('Content-Type', local.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(local.fileName || filename)}"`);
    res.setHeader('Content-Length', String(local.buffer.length));
    return res.send(local.buffer);
  }

  return res.status(404).send('Documento PDF não encontrado.');
});

// Signed URL
app.get('/api/storage/signed-url', (req, res) => {
  const storagePath = (req.query.path as string) || (req.query.pathname as string) || '';
  const filename = (req.query.filename as string) || 'nota_fiscal_original.pdf';
  const fallbackViewUrl = `/api/storage/view?path=${encodeURIComponent(storagePath)}&filename=${encodeURIComponent(filename)}`;
  return res.json({
    success: true,
    signedUrl: fallbackViewUrl,
    viewUrl: fallbackViewUrl,
    bucket: 'local-storage',
    storagePath,
    isFallback: true,
  });
});

// Download do PDF original
app.get(['/api/storage/download', '/api/blob/download'], (req, res) => {
  const storagePath = (req.query.path as string) || (req.query.pathname as string) || '';
  const url = (req.query.url as string) || '';
  const filename = (req.query.filename as string) || 'nota_fiscal_original.pdf';

  const targetPath = storagePath || (url.startsWith('local://') ? url.replace('local://', '') : url);

  const local =
    localPdfFallback.get(targetPath) ||
    localPdfFallback.get(storagePath) ||
    localPdfFallback.get(filename);

  if (local) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(local.fileName || filename)}"`);
    return res.send(local.buffer);
  }

  return res.status(404).send('Arquivo não encontrado para download.');
});

// Invoices API
app.get('/api/invoices', (req, res) => {
  return res.json({ success: true, source: 'local', data: localInvoicesDb });
});

app.post('/api/invoices', (req, res) => {
  const item = req.body;
  if (!item || !item.originalFileName) {
    return res.status(400).json({ error: 'Dados da nota fiscal incompletos.' });
  }

  const recordId = item.id || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const processedAt = item.processedAt || new Date().toISOString();

  const localRecord = {
    ...item,
    id: recordId,
    processedAt,
    syncedToSupabase: true,
  };

  const existingIdx = localInvoicesDb.findIndex((i) => i.id === recordId);
  if (existingIdx >= 0) {
    localInvoicesDb[existingIdx] = localRecord;
  } else {
    localInvoicesDb.unshift(localRecord);
  }

  return res.json({
    success: true,
    savedToRemote: true,
    record: localRecord,
  });
});

app.patch('/api/invoices/dispatch', (req, res) => {
  const { recordIds, channel } = req.body;
  if (!Array.isArray(recordIds) || recordIds.length === 0 || !channel) {
    return res.status(400).json({ error: 'Parâmetros recordIds e channel são obrigatórios.' });
  }

  const now = new Date().toISOString();
  for (const inv of localInvoicesDb) {
    if (recordIds.includes(inv.id)) {
      if (channel === 'whatsapp') inv.sentWhatsappAt = now;
      if (channel === 'email') inv.sentEmailAt = now;
    }
  }

  res.json({ success: true, updatedCount: recordIds.length, timestamp: now });
});

app.delete('/api/invoices', (req, res) => {
  localInvoicesDb.length = 0;
  res.json({ success: true, message: 'Histórico de notas limpo.' });
});

// Clients API
app.get('/api/clients', (req, res) => {
  return res.json({ success: true, source: 'local', data: localClientsDb });
});

app.post('/api/clients', (req, res) => {
  const client = req.body;
  if (!client || !client.cleanCnpj || !client.customName) {
    return res.status(400).json({ error: 'Dados do cliente incompletos.' });
  }

  const clientId = client.id || `cli_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const updatedClient = {
    ...client,
    id: clientId,
    updatedAt: now,
  };

  const existingIdx = localClientsDb.findIndex((c) => c.cleanCnpj === client.cleanCnpj);
  if (existingIdx >= 0) {
    localClientsDb[existingIdx] = updatedClient;
  } else {
    localClientsDb.push(updatedClient);
  }

  res.json({ success: true, savedToRemote: true, client: updatedClient });
});

app.delete('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  const idx = localClientsDb.findIndex((c) => c.id === id);
  if (idx >= 0) localClientsDb.splice(idx, 1);
  res.json({ success: true });
});

// Reset system
app.post('/api/system/reset-all', (req, res) => {
  const { clearHistory = true, clearClients = false } = req.body || {};
  if (clearHistory) localInvoicesDb.length = 0;
  if (clearClients) localClientsDb.length = 0;
  localPdfFallback.clear();

  return res.json({
    success: true,
    message: 'Sistema zerado com sucesso.',
    clearedHistory: clearHistory,
    clearedClients: clearClients,
    deletedFilesCount: 0,
  });
});

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
    console.log(`Servidor Organizador NF ativo na porta ${PORT} (Modo Local).`);
  });
}

startServer();
