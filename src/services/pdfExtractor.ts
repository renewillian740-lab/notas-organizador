import { ExtractedInvoiceData, CandidateClient, EntityInfo, IdentificationMethod } from '../types';
import {
  extractAllCNPJsFromText,
  formatCNPJ,
  formatCPF,
  formatDocument,
  isValidCNPJ,
  isValidCPF,
  cleanCNPJ,
  cleanDocument,
  extractMetadataFromFileName,
} from '../utils/cnpjValidator';
import { db } from './db';

// Lazy loading do módulo pdfjs-dist sob demanda
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjs) => {
      try {
        if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version || '4.10.38'}/pdf.worker.min.mjs`;
        }
      } catch (e) {
        console.warn('Configurando worker PDF:', e);
      }
      return pdfjs;
    });
  }
  return pdfjsLibPromise;
}

const MONTH_NAMES = [
  '01 - JANEIRO',
  '02 - FEVEREIRO',
  '03 - MARÇO',
  '04 - ABRIL',
  '05 - MAIO',
  '06 - JUNHO',
  '07 - JULHO',
  '08 - AGOSTO',
  '09 - SETEMBRO',
  '10 - OUTUBRO',
  '11 - NOVEMBRO',
  '12 - DEZEMBRO',
];

export async function extractTextFromPDF(file: File): Promise<{ text: string; pageCount: number }> {
  try {
    const pdfjsLib = await getPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;

    let fullText = '';
    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item: any) => item.str || '')
        .filter((str: string) => str.trim().length > 0);
      fullText += pageStrings.join(' ') + '\n';
    }

    return { text: fullText.trim(), pageCount };
  } catch (error) {
    console.error('Erro ao processar PDF via PDF.js:', error);
    throw new Error('Não foi possível ler o arquivo PDF.');
  }
}

/**
 * Heurística avançada para extrair número da nota fiscal
 */
function extractInvoiceNumber(text: string): string {
  const patterns = [
    /(?:N[úu]mero\s*da\s*(?:Nota|NFS-e|NF-e|DANFE)|N[ºo°\.]\s*da\s*Nota|N[ºo°\.]\s*(?:NFS-e|NF-e|DANFE))\s*[:.\-]?\s*(\d{1,9})/i,
    /(?:NF-e|NFS-e|DANFE|N°|Nº|Numero|Número)\s*[:.\-]?\s*(\d{1,9})\b/i,
    /(?:DANFE\s+DOCUMENTO\s+AUXILIAR[^\d]*N[ºo°\.]\s*)(\d{1,3}(?:\.\d{3})*)/i,
    /(?:N[ºo°\.]\s*)(\d{1,3}\.\d{3}\.\d{3})/i,
    /(?:N[ºo°\.]\s*)(\d{4,9})/i,
    /(?:DOCUMENTO\s+AUXILIAR\s+DA\s+NOTA\s+FISCAL[^\d]*?)(\d{1,9})/i,
    /\bN[ºo°\.]\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const cleanNum = match[1].replace(/\D/g, '');
      if (cleanNum.length > 0) {
        return cleanNum;
      }
    }
  }

  const fallbackMatch = text.match(/NF[^\d]*(\d{3,8})/i);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1];
  }

  return 'S_N';
}

/**
 * Heurística avançada para extrair data de emissão
 */
function extractInvoiceDate(text: string): { dataStr: string; ano: string; mes: string; mesExtenso: string } {
  const now = new Date();
  const defaultAno = String(now.getFullYear());
  const defaultMesIndex = now.getMonth();
  const defaultMes = String(defaultMesIndex + 1).padStart(2, '0');

  const datePatterns = [
    /(?:Data(?:\s*e\s*Hora)?\s*(?:da)?\s*Emiss[aã]o|Data\s*do\s*Fato\s*Gerador|Emiss[aã]o|Data\s*de\s*Sa[ií]da)\s*[:.\-]?\s*(\d{2})[\/\.-](\d{2})[\/\.-](\d{4})/i,
    /(?:Compet[êe]ncia)\s*[:.\-]?\s*(\d{2})[\/\.-](\d{4})/i,
    /\b(\d{2})[\/\.-](\d{2})[\/\.-](20\d{2})\b/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (match.length === 4) {
        const dia = match[1].padStart(2, '0');
        const mes = match[2].padStart(2, '0');
        const ano = match[3];
        const mesNum = parseInt(mes, 10);
        if (mesNum >= 1 && mesNum <= 12) {
          return {
            dataStr: `${dia}/${mes}/${ano}`,
            ano,
            mes,
            mesExtenso: MONTH_NAMES[mesNum - 1] || `${mes} - MÊS`,
          };
        }
      } else if (match.length === 3) {
        const mes = match[1].padStart(2, '0');
        const ano = match[2];
        const mesNum = parseInt(mes, 10);
        if (mesNum >= 1 && mesNum <= 12) {
          return {
            dataStr: `01/${mes}/${ano}`,
            ano,
            mes,
            mesExtenso: MONTH_NAMES[mesNum - 1] || `${mes} - MÊS`,
          };
        }
      }
    }
  }

  return {
    dataStr: `${String(now.getDate()).padStart(2, '0')}/${defaultMes}/${defaultAno}`,
    ano: defaultAno,
    mes: defaultMes,
    mesExtenso: MONTH_NAMES[defaultMesIndex],
  };
}

/**
 * Heurística avançada para extrair valor total da nota
 */
function extractInvoiceValue(text: string): { value: number | null; formatted: string } {
  const valuePatterns = [
    /(?:VALOR\s+TOTAL\s+DA\s+NOTA|VALOR\s+TOTAL\s+DO\s+SERVI[ÇC]O|VALOR\s+L[ÍI]QUIDO|VALOR\s+TOTAL\s+DOS\s+SERVI[ÇC]OS|VALOR\s+TOTAL\s+DA\s+NF-e|VALOR\s+TOTAL\s+L[ÍI]QUIDO|VALOR\s+DA\s+NOTA|TOTAL\s+L[ÍI]QUIDO\s+DA\s+NOTA)\s*[:.\-]?\s*(?:R\$\s*)?([\d\.,]+)/i,
    /(?:TOTAL\s+GERAL|TOTAL\s+A\s+PAGAR|TOTAL\s+DA\s+FATURA|VALOR\s+SERVI[ÇC]OS)\s*[:.\-]?\s*(?:R\$\s*)?([\d\.,]+)/i,
    /(?:R\$\s*)([\d]{1,3}(?:\.[\d]{3})*,\d{2})/i,
  ];

  for (const pattern of valuePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let rawVal = match[1].trim();
      const cleanVal = rawVal.replace(/\./g, '').replace(',', '.');
      const num = parseFloat(cleanVal);
      if (!isNaN(num) && num > 0) {
        return {
          value: num,
          formatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num),
        };
      }
    }
  }

  return {
    value: null,
    formatted: 'R$ 0,00',
  };
}

/**
 * Divide o texto do documento em seções semânticas estruturadas
 */
function splitInvoiceSections(text: string): {
  prestadorText: string;
  tomadorText: string;
  servicosText: string;
} {
  const upper = text.toUpperCase();

  const tomadorKeywords = [
    'TOMADOR DE SERVIÇOS',
    'TOMADOR DE SERVICOS',
    'DADOS DO TOMADOR',
    'DESTINATÁRIO / REMETENTE',
    'DESTINATARIO / REMETENTE',
    'DESTINATÁRIO',
    'DESTINATARIO',
    'IDENTIFICAÇÃO DO TOMADOR',
    'DADOS DO CLIENTE',
    'PAGADOR / CONTRATANTE',
    'TOMADOR',
  ];

  const prestadorKeywords = [
    'PRESTADOR DE SERVIÇOS',
    'PRESTADOR DE SERVICOS',
    'DADOS DO PRESTADOR',
    'EMITENTE',
    'IDENTIFICAÇÃO DO PRESTADOR',
    'PRESTADOR',
  ];

  const servicosKeywords = [
    'DISCRIMINAÇÃO DOS SERVIÇOS',
    'DISCRIMINACAO DOS SERVICOS',
    'DESCRIÇÃO DOS SERVIÇOS',
    'DADOS DOS SERVIÇOS',
    'VALOR TOTAL DOS SERVIÇOS',
    'CÁLCULO DO ISSQN',
    'VALORES',
  ];

  let tomadorIndex = -1;
  for (const kw of tomadorKeywords) {
    const idx = upper.indexOf(kw);
    if (idx !== -1 && (tomadorIndex === -1 || idx < tomadorIndex)) {
      tomadorIndex = idx;
    }
  }

  let prestadorIndex = -1;
  for (const kw of prestadorKeywords) {
    const idx = upper.indexOf(kw);
    if (idx !== -1 && (prestadorIndex === -1 || idx < prestadorIndex)) {
      prestadorIndex = idx;
    }
  }

  let servicosIndex = -1;
  for (const kw of servicosKeywords) {
    const idx = upper.indexOf(kw);
    if (idx !== -1 && (servicosIndex === -1 || idx < servicosIndex)) {
      servicosIndex = idx;
    }
  }

  let prestadorText = '';
  let tomadorText = '';
  let servicosText = '';

  if (prestadorIndex !== -1 && tomadorIndex !== -1) {
    if (prestadorIndex < tomadorIndex) {
      prestadorText = text.substring(prestadorIndex, tomadorIndex);
      tomadorText =
        servicosIndex > tomadorIndex
          ? text.substring(tomadorIndex, servicosIndex)
          : text.substring(tomadorIndex, tomadorIndex + 1200);
    } else {
      tomadorText = text.substring(tomadorIndex, prestadorIndex);
      prestadorText =
        servicosIndex > prestadorIndex
          ? text.substring(prestadorIndex, servicosIndex)
          : text.substring(prestadorIndex, prestadorIndex + 1200);
    }
  } else if (tomadorIndex !== -1) {
    tomadorText =
      servicosIndex > tomadorIndex
        ? text.substring(tomadorIndex, servicosIndex)
        : text.substring(tomadorIndex, tomadorIndex + 1200);
  } else if (prestadorIndex !== -1) {
    prestadorText = text.substring(prestadorIndex, prestadorIndex + 1000);
  }

  if (servicosIndex !== -1) {
    servicosText = text.substring(servicosIndex);
  }

  return { prestadorText, tomadorText, servicosText };
}

/**
 * Extrai Razão Social ou Nome Empresarial dentro de uma seção específica
 */
function extractNameFromSection(sectionText: string): string | null {
  if (!sectionText || sectionText.trim().length === 0) return null;

  const patterns = [
    /(?:Raz[ãa]o\s*Social|Nome\s*\/\s*Raz[ãa]o\s*Social|Nome\s*Empresarial|Nome\s*Fantasia)\s*[:.\-]?\s*([A-Z0-9\.\,\-\s\&]{3,65})/i,
    /(?:Nome)\s*[:.\-]?\s*([A-Z0-9\.\,\-\s\&]{3,60})/i,
  ];

  for (const pat of patterns) {
    const match = sectionText.match(pat);
    if (match && match[1]) {
      let cleaned = match[1].trim();
      cleaned = cleaned
        .replace(
          /\b(CPF|CNPJ|INSCRIÇÃO|ENDEREÇO|BAIRRO|MUNICÍPIO|UF|CEP|TELEFONE|E-MAIL|EMAIL|COMPETÊNCIA|DATA)\b.*$/i,
          ''
        )
        .trim();
      if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) {
        return cleaned.toUpperCase();
      }
    }
  }

  // Fallback: Procura por linhas com termos em maiúsculas após o cabeçalho
  const lines = sectionText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(1, 4)) {
    if (
      line.length >= 4 &&
      line.length <= 70 &&
      !/(TOMADOR|PRESTADOR|CNPJ|CPF|INSCRI|ENDERE|CEP|MUNIC|VALOR|SERVI)/i.test(line) &&
      !/^\d+$/.test(line)
    ) {
      return line.toUpperCase();
    }
  }

  return null;
}

/**
 * Algoritmo Principal de Extração e Identificação Semântica da Nota Fiscal
 */
export async function analyzeInvoicePDF(
  file: File,
  originalFileName?: string
): Promise<ExtractedInvoiceData> {
  const fileName = originalFileName || file.name || '';
  const fileMeta = extractMetadataFromFileName(fileName);

  let text = '';
  let pageCount = 1;

  try {
    const extracted = await extractTextFromPDF(file);
    text = extracted.text;
    pageCount = extracted.pageCount;
  } catch (e) {
    console.warn('Falha na leitura direta do PDF:', e);
  }

  const hasText = text.trim().length > 30;
  const needsOcr = !hasText && !fileMeta.hasStructure;

  // Se o PDF não tiver camada de texto pesquisável, mas o nome do arquivo trouxer metadados completos
  if (!hasText && fileMeta.hasStructure && fileMeta.clientName) {
    const chosenClient = fileMeta.clientName;
    const formattedVal = fileMeta.invoiceValueFormatted || 'R$ 0,00';
    const dateStr = fileMeta.invoiceDate || '01/01/' + new Date().getFullYear();

    const registeredClients = db.getClients();
    const registered = registeredClients.find(
      (c) => c.customName.toUpperCase() === chosenClient.toUpperCase()
    );

    return {
      numeroNota: fileMeta.invoiceNumber || 'S_N',
      dataEmissao: dateStr,
      anoEmissao: dateStr.split('/')[2] || String(new Date().getFullYear()),
      mesEmissao: dateStr.split('/')[1] || '01',
      mesExtenso: MONTH_NAMES[parseInt(dateStr.split('/')[1] || '1', 10) - 1] || '01 - JANEIRO',
      valorTotal: fileMeta.invoiceValue ?? null,
      valorTotalFormatted: formattedVal,
      prestador: null,
      tomador: {
        cnpj: fileMeta.cnpjOrCpf || '',
        cleanCnpj: cleanDocument(fileMeta.cnpjOrCpf || ''),
        razaoSocial: chosenClient,
        rawContext: `Extraído do arquivo: ${fileName}`,
      },
      destinatario: null,
      emitente: null,
      allCnpjs: [],
      selectedClient: {
        cnpj: fileMeta.cnpjOrCpf || '',
        cleanCnpj: cleanDocument(fileMeta.cnpjOrCpf || ''),
        name: registered ? registered.customName : chosenClient,
        isPreRegistered: Boolean(registered),
      },
      identificationMethod: 'IDENTIFICACAO_AUTOMATICA',
      diagnosticNotes: `Cliente "${chosenClient}" identificado diretamente pelo padrão do nome do arquivo original.`,
      candidateClients: [
        {
          cnpj: fileMeta.cnpjOrCpf || '',
          cleanCnpj: cleanDocument(fileMeta.cnpjOrCpf || ''),
          name: chosenClient,
          role: 'TOMADOR',
          confidence: 100,
          reason: 'Extraído com sucesso da estrutura do nome do arquivo original.',
        },
      ],
      hasText: false,
      needsOcr: false,
      pageCount,
      rawText: text,
      confidenceScore: 95,
    };
  }

  // 1. Extração de Metadados Básicos
  let numeroNota = extractInvoiceNumber(text);
  if (numeroNota === 'S_N' && fileMeta.invoiceNumber) {
    numeroNota = fileMeta.invoiceNumber;
  }

  let { dataStr, ano, mes, mesExtenso } = extractInvoiceDate(text);
  if (fileMeta.invoiceDate && dataStr.startsWith('01/01')) {
    dataStr = fileMeta.invoiceDate;
    const parts = dataStr.split('/');
    if (parts.length === 3) {
      ano = parts[2];
      mes = parts[1];
      mesExtenso = MONTH_NAMES[parseInt(mes, 10) - 1] || mesExtenso;
    }
  }

  let { value: valorTotal, formatted: valorTotalFormatted } = extractInvoiceValue(text);
  if ((valorTotal === null || valorTotal === 0) && fileMeta.invoiceValue) {
    valorTotal = fileMeta.invoiceValue;
    valorTotalFormatted = fileMeta.invoiceValueFormatted || valorTotalFormatted;
  }

  // 2. Extração estruturada por seções
  const { prestadorText, tomadorText } = splitInvoiceSections(text);

  // 3. Obter configurações do Emissor (Minha Empresa / Prestador)
  const settings = db.getSettings();
  const issuerCnpjClean = cleanCNPJ(settings.issuerCnpj || '47042028000155');
  const issuerName = (settings.issuerName || 'RENE WILLIAN').toUpperCase();

  // 4. Extração de todos os documentos (CNPJs e CPFs) do documento
  const allDocMatches = extractAllCNPJsFromText(text, 250);

  // 5. Consulta de Clientes Pré-Cadastrados no Banco Local (excluindo emissor)
  const registeredClients = db.getClients().filter((c) => {
    const isIssuer =
      (issuerCnpjClean && c.cleanCnpj === issuerCnpjClean) ||
      (c.customName && c.customName.toUpperCase().includes('RENE WILLIAN'));
    return !isIssuer;
  });
  const registeredMap = new Map<string, (typeof registeredClients)[0]>();
  for (const client of registeredClients) {
    registeredMap.set(client.cleanCnpj, client);
  }

  // 6. Análise detalhada do Tomador vs Prestador
  let prestador: EntityInfo | null = null;
  let tomador: EntityInfo | null = null;
  const candidates: CandidateClient[] = [];
  const analyzedCnpjs: ExtractedInvoiceData['allCnpjs'] = [];

  // Tenta extrair o nome do tomador diretamente da seção TOMADOR
  const tomadorExtractedName = extractNameFromSection(tomadorText);
  const prestadorExtractedName = extractNameFromSection(prestadorText);

  // Identifica documentos dentro das seções específicas
  const tomadorDocs = extractAllCNPJsFromText(tomadorText, 150);
  const prestadorDocs = extractAllCNPJsFromText(prestadorText, 150);

  // Se encontrou documento e nome no prestador:
  if (prestadorDocs.length > 0 || prestadorExtractedName) {
    const pDoc = prestadorDocs[0];
    prestador = {
      cnpj: pDoc ? pDoc.formatted : settings.issuerCnpj || '',
      cleanCnpj: pDoc ? pDoc.clean : issuerCnpjClean,
      razaoSocial: prestadorExtractedName || settings.issuerName || 'PRESTADOR DE SERVIÇOS',
      rawContext: prestadorText.substring(0, 300),
    };
  }

  for (const match of allDocMatches) {
    const upperContext = match.surroundingContext.toUpperCase();
    const isPrestadorContext =
      upperContext.includes('PRESTADOR') ||
      upperContext.includes('EMITENTE') ||
      upperContext.includes('EMISSOR') ||
      (prestadorText && prestadorText.includes(match.raw));

    const isTomadorContext =
      upperContext.includes('TOMADOR') ||
      upperContext.includes('DESTINAT') ||
      upperContext.includes('CLIENTE') ||
      upperContext.includes('CONTRATANTE') ||
      (tomadorText && tomadorText.includes(match.raw));

    const isIssuerDoc =
      (issuerCnpjClean && match.clean === issuerCnpjClean) ||
      (issuerName && upperContext.includes('RENE WILLIAN'));

    let role: 'TOMADOR' | 'DESTINATARIO' | 'CLIENTE' | 'PRESTADOR' | 'EMITENTE' | 'OUTRO' = 'OUTRO';

    if (isIssuerDoc || (isPrestadorContext && !isTomadorContext)) {
      role = 'PRESTADOR';
    } else if (isTomadorContext) {
      role = 'TOMADOR';
    } else {
      role = 'OUTRO';
    }

    const registered = registeredMap.get(match.clean);
    let entityName = registered ? registered.customName : '';

    if (!entityName) {
      if (role === 'TOMADOR' && tomadorExtractedName) {
        entityName = tomadorExtractedName;
      } else if (role === 'PRESTADOR' && prestadorExtractedName) {
        entityName = prestadorExtractedName;
      } else {
        const nearName = extractNameFromSection(match.surroundingContext);
        entityName = nearName || `Empresa ${match.formatted}`;
      }
    }

    let confidence = 0;
    let reason = '';

    if (role === 'PRESTADOR' || isIssuerDoc) {
      // PRESTADOR / EMISSOR NUNCA PODE SER SELECIONADO COMO CLIENTE!
      confidence = -10000;
      reason = 'Identificado como PRESTADOR/EMITENTE da nota (desqualificado como cliente).';
    } else {
      if (registered) {
        confidence += 250;
        reason += `Cliente previamente cadastrado (${registered.customName}) (+250). `;
      }
      if (role === 'TOMADOR') {
        confidence += 180;
        reason += 'Localizado explicitamente na seção TOMADOR DE SERVIÇOS (+180). ';
      } else {
        confidence += 40;
        reason += 'Documento válido encontrado no texto (+40). ';
      }
    }

    const entityInfo: EntityInfo = {
      cnpj: match.formatted,
      cleanCnpj: match.clean,
      razaoSocial: entityName,
      rawContext: match.surroundingContext,
    };

    if (role === 'TOMADOR' && !tomador) {
      tomador = entityInfo;
    }

    candidates.push({
      cnpj: match.formatted,
      cleanCnpj: match.clean,
      name: entityName,
      role,
      confidence,
      reason,
    });

    analyzedCnpjs.push({
      cnpj: match.formatted,
      cleanCnpj: match.clean,
      context: match.surroundingContext,
      score: confidence,
      associatedName: entityName,
    });
  }

  // Se o nome do arquivo trouxe um cliente válido e claro (ex: TREND COMUNICACAO, ARYZONA, CLUB AGENCIA, FELIPE GOIS MELO)
  if (fileMeta.clientName && !fileMeta.clientName.toUpperCase().includes('RENE WILLIAN')) {
    const fnClient = fileMeta.clientName;
    const registered = registeredClients.find(
      (c) => c.customName.toUpperCase() === fnClient.toUpperCase()
    );

    candidates.push({
      cnpj: fileMeta.cnpjOrCpf || (tomador ? tomador.cnpj : ''),
      cleanCnpj: cleanDocument(fileMeta.cnpjOrCpf || (tomador ? tomador.cleanCnpj : '')),
      name: registered ? registered.customName : fnClient,
      role: 'TOMADOR',
      confidence: 190,
      reason: `Identificado com alta precisão a partir do arquivo original "${fileName}" (+190).`,
    });
  } else if (tomadorExtractedName && !tomadorExtractedName.toUpperCase().includes('RENE WILLIAN')) {
    // Se extraiu o nome do Tomador na seção do PDF mesmo sem CNPJ explícito
    candidates.push({
      cnpj: tomadorDocs.length > 0 ? tomadorDocs[0].formatted : '',
      cleanCnpj: tomadorDocs.length > 0 ? tomadorDocs[0].clean : '',
      name: tomadorExtractedName,
      role: 'TOMADOR',
      confidence: 160,
      reason: 'Razão Social extraída da seção de TOMADOR DE SERVIÇOS do PDF (+160).',
    });
  }

  // Filtra apenas candidatos elegíveis (com score positivo) e ordena
  const validCandidates = candidates.filter((c) => c.confidence > 0);
  validCandidates.sort((a, b) => b.confidence - a.confidence);

  let selectedClient: ExtractedInvoiceData['selectedClient'] = null;
  let identificationMethod: IdentificationMethod = 'NAO_IDENTIFICADO';
  let diagnosticNotes = '';
  let confidenceScore = 0;

  if (validCandidates.length > 0) {
    const top = validCandidates[0];
    const registered = registeredMap.get(top.cleanCnpj);

    selectedClient = {
      cnpj: top.cnpj,
      cleanCnpj: top.cleanCnpj,
      name: top.name,
      isPreRegistered: Boolean(registered),
    };

    if (registered) {
      identificationMethod = 'CLIENTE_CADASTRADO_POR_CNPJ';
      diagnosticNotes = `Cliente "${top.name}" identificado pelo cadastro permanente (${top.cnpj}).`;
      confidenceScore = 100;
    } else if (top.role === 'TOMADOR') {
      identificationMethod = 'CNPJ_CONTEXTO';
      diagnosticNotes = `Tomador de Serviços identificado com sucesso: "${top.name}".`;
      confidenceScore = 90;
    } else {
      identificationMethod = 'IDENTIFICACAO_AUTOMATICA';
      diagnosticNotes = `Cliente identificado no documento: "${top.name}".`;
      confidenceScore = 75;
    }
  } else {
    identificationMethod = 'NAO_IDENTIFICADO';
    diagnosticNotes = 'Não foi possível identificar o Tomador de Serviços automaticamente. Requer revisão manual.';
    confidenceScore = 20;
  }

  return {
    numeroNota,
    dataEmissao: dataStr,
    anoEmissao: ano,
    mesEmissao: mes,
    mesExtenso,
    valorTotal,
    valorTotalFormatted,
    prestador,
    tomador,
    destinatario: tomador,
    emitente: prestador,
    allCnpjs: analyzedCnpjs,
    selectedClient,
    identificationMethod,
    diagnosticNotes,
    candidateClients: validCandidates,
    hasText,
    needsOcr,
    pageCount,
    rawText: text,
    confidenceScore,
  };
}
