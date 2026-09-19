import * as pdfjsLib from 'pdfjs-dist';
import { ExtractedInvoiceData, CandidateClient, EntityInfo, IdentificationMethod } from '../types';
import { extractAllCNPJsFromText, formatCNPJ, isValidCNPJ, cleanCNPJ } from '../utils/cnpjValidator';
import { db } from './db';

// Configuração segura do worker do PDF.js
try {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  }
} catch (e) {
  console.warn('Configurando worker PDF:', e);
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
  // Padrões comuns em NFS-e, NF-e, DANFE e CT-e brasileiras
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

  // Fallback: se não encontrar número explícito, procura primeira sequência de 4-8 dígitos isolada perto de "NF"
  const fallbackMatch = text.match(/NF[^\d]*(\d{3,8})/i);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1];
  }

  return 'S_N'; // Sem Número
}

/**
 * Heurística avançada para extrair data de emissão
 */
function extractInvoiceDate(text: string): { dataStr: string; ano: string; mes: string; mesExtenso: string } {
  const now = new Date();
  const defaultAno = String(now.getFullYear());
  const defaultMesIndex = now.getMonth();
  const defaultMes = String(defaultMesIndex + 1).padStart(2, '0');

  // Padrões comuns de data no Brasil (DD/MM/AAAA ou DD-MM-AAAA)
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
        // Formato Competência MM/AAAA
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
  // Padrões de valor monetário
  const valuePatterns = [
    /(?:VALOR\s+TOTAL\s+DA\s+NOTA|VALOR\s+TOTAL\s+DO\s+SERVI[ÇC]O|VALOR\s+L[ÍI]QUIDO|VALOR\s+TOTAL\s+DOS\s+SERVI[ÇC]OS|VALOR\s+TOTAL\s+DA\s+NF-e|VALOR\s+TOTAL\s+L[ÍI]QUIDO|VALOR\s+DA\s+NOTA|TOTAL\s+L[ÍI]QUIDO\s+DA\s+NOTA)\s*[:.\-]?\s*(?:R\$\s*)?([\d\.,]+)/i,
    /(?:TOTAL\s+GERAL|TOTAL\s+A\s+PAGAR|TOTAL\s+DA\s+FATURA|VALOR\s+SERVI[ÇC]OS)\s*[:.\-]?\s*(?:R\$\s*)?([\d\.,]+)/i,
    /(?:R\$\s*)([\d]{1,3}(?:\.[\d]{3})*,\d{2})/i,
  ];

  for (const pattern of valuePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      let rawVal = match[1].trim();
      // Remove pontos de milhar e substitui vírgula decimal
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
 * Extrai nomes empresariais (Razão Social / Nome Fantasia) próximos a um CNPJ
 */
function extractEntityNameNearCNPJ(context: string, cleanCnpj: string): { name: string; role: 'TOMADOR' | 'DESTINATARIO' | 'CLIENTE' | 'PRESTADOR' | 'EMITENTE' | 'OUTRO' } {
  const upper = context.toUpperCase();
  
  let role: 'TOMADOR' | 'DESTINATARIO' | 'CLIENTE' | 'PRESTADOR' | 'EMITENTE' | 'OUTRO' = 'OUTRO';

  // Identificação do papel pelo contexto
  if (upper.includes('TOMADOR') || upper.includes('DESTINAT') || upper.includes('CLIENTE') || upper.includes('CONTRATANTE')) {
    if (upper.includes('TOMADOR')) role = 'TOMADOR';
    else if (upper.includes('DESTINAT')) role = 'DESTINATARIO';
    else role = 'CLIENTE';
  } else if (upper.includes('PRESTADOR') || upper.includes('EMITENTE') || upper.includes('EMISSOR') || upper.includes('PRESTADORA')) {
    if (upper.includes('PRESTADOR')) role = 'PRESTADOR';
    else role = 'EMITENTE';
  }

  // Tenta capturar razão social pelo padrão "RAZÃO SOCIAL:", "NOME / RAZÃO SOCIAL:", "NOME:"
  const namePatterns = [
    /(?:Raz[ãa]o\s*Social|Nome\s*\/\s*Raz[ãa]o\s*Social|Nome\s*Empresarial|Nome\s*Fantasia|Nome)\s*[:.\-]?\s*([A-Z0-9\.\,\-\s\&]{3,60})/i,
    /(?:TOMADOR\s+DE\s+SERVI[ÇC]OS|DESTINAT[ÁA]RIO\/REMETENTE|PRESTADOR\s+DE\s+SERVI[ÇC]OS)[^\n]*?\n([A-Z0-9\.\,\-\s\&]{3,60})/i,
  ];

  for (const pattern of namePatterns) {
    const match = context.match(pattern);
    if (match && match[1]) {
      let candidate = match[1].trim();
      // Remove lixo comum e palavras-chave que podem ter sido engolidas
      candidate = candidate.replace(/\b(CNPJ|CPF|INSCRIÇÃO|ENDEREÇO|BAIRRO|MUNICÍPIO|UF|CEP|TELEFONE|E-MAIL|EMAIL)\b.*$/i, '').trim();
      if (candidate.length >= 3 && !/^\d+$/.test(candidate)) {
        return { name: candidate, role };
      }
    }
  }

  // Fallback: procura sequência de palavras em maiúsculas com mais de 2 termos
  const lines = context.split('\n').map((l) => l.trim());
  for (const line of lines) {
    if (line.length > 5 && line.length < 70 && !line.includes(cleanCnpj) && !/^\d+$/.test(line)) {
      if (!/(CNPJ|CPF|INSCRI|ENDERE|CEP|DATA|VALOR|TOTAL|NOTA|SERVI|MUNIC)/i.test(line)) {
        return { name: line, role };
      }
    }
  }

  return { name: `Empresa CNPJ ${formatCNPJ(cleanCnpj)}`, role };
}

/**
 * Algoritmo Principal de Extração e Identificação Semântica da Nota Fiscal
 */
export async function analyzeInvoicePDF(file: File): Promise<ExtractedInvoiceData> {
  const { text, pageCount } = await extractTextFromPDF(file);

  const hasText = text.trim().length > 30;
  const needsOcr = !hasText;

  if (needsOcr) {
    return {
      numeroNota: 'S_N',
      dataEmissao: '01/01/' + new Date().getFullYear(),
      anoEmissao: String(new Date().getFullYear()),
      mesEmissao: '01',
      mesExtenso: MONTH_NAMES[0],
      valorTotal: null,
      valorTotalFormatted: 'R$ 0,00',
      prestador: null,
      tomador: null,
      destinatario: null,
      emitente: null,
      allCnpjs: [],
      selectedClient: null,
      identificationMethod: 'NAO_IDENTIFICADO',
      diagnosticNotes: 'PDF sem camada de texto pesquisável. Documento necessita de OCR.',
      candidateClients: [],
      hasText: false,
      needsOcr: true,
      pageCount,
      rawText: text,
      confidenceScore: 0,
    };
  }

  // 1. Extração de Metadados
  const numeroNota = extractInvoiceNumber(text);
  const { dataStr, ano, mes, mesExtenso } = extractInvoiceDate(text);
  const { value: valorTotal, formatted: valorTotalFormatted } = extractInvoiceValue(text);

  // 2. Extração e Validação de todos os CNPJs
  const cnpjMatches = extractAllCNPJsFromText(text, 250);

  // 3. Consulta de Clientes Pré-Cadastrados no Banco Local
  const registeredClients = db.getClients();
  const registeredMap = new Map<string, (typeof registeredClients)[0]>();
  for (const client of registeredClients) {
    registeredMap.set(client.cleanCnpj, client);
  }

  // 4. Análise de Entidades e Contextos
  let prestador: EntityInfo | null = null;
  let tomador: EntityInfo | null = null;
  let destinatario: EntityInfo | null = null;
  let emitente: EntityInfo | null = null;

  const candidates: CandidateClient[] = [];
  const analyzedCnpjs: ExtractedInvoiceData['allCnpjs'] = [];

  for (const match of cnpjMatches) {
    const { name: extractedName, role } = extractEntityNameNearCNPJ(match.surroundingContext, match.clean);
    
    // Verifica se já está no cadastro
    const registered = registeredMap.get(match.clean);
    const finalName = registered ? registered.customName : extractedName;

    let score = 0;
    let reason = '';

    if (registered) {
      score += 100;
      reason += 'Empresa cadastrada no banco de clientes permanente (+100). ';
    }

    if (role === 'TOMADOR') {
      score += 80;
      reason += 'Identificado no bloco de TOMADOR DE SERVIÇOS (+80). ';
    } else if (role === 'DESTINATARIO') {
      score += 75;
      reason += 'Identificado no bloco de DESTINATÁRIO/CLIENTE (+75). ';
    } else if (role === 'CLIENTE') {
      score += 70;
      reason += 'Identificado com palavra-chave CLIENTE/CONTRATANTE (+70). ';
    } else if (role === 'PRESTADOR' || role === 'EMITENTE') {
      score += 10;
      reason += 'Identificado como PRESTADOR/EMISSOR da nota. ';
    } else {
      score += 20;
      reason += 'CNPJ válido identificado no corpo do documento. ';
    }

    const entityInfo: EntityInfo = {
      cnpj: match.formatted,
      cleanCnpj: match.clean,
      razaoSocial: finalName,
      rawContext: match.surroundingContext,
    };

    if (role === 'TOMADOR') tomador = entityInfo;
    else if (role === 'DESTINATARIO') destinatario = entityInfo;
    else if (role === 'PRESTADOR') prestador = entityInfo;
    else if (role === 'EMITENTE') emitente = entityInfo;

    candidates.push({
      cnpj: match.formatted,
      cleanCnpj: match.clean,
      name: finalName,
      role,
      confidence: score,
      reason,
    });

    analyzedCnpjs.push({
      cnpj: match.formatted,
      cleanCnpj: match.clean,
      context: match.surroundingContext,
      score,
      associatedName: finalName,
    });
  }

  // Ordena candidatos pelo score de confiança
  candidates.sort((a, b) => b.confidence - a.confidence);

  // 5. Decisão Inteligente de Identificação
  let selectedClient: ExtractedInvoiceData['selectedClient'] = null;
  let identificationMethod: IdentificationMethod = 'NAO_IDENTIFICADO';
  let diagnosticNotes = '';
  let confidenceScore = 0;

  if (candidates.length === 0) {
    identificationMethod = 'NAO_IDENTIFICADO';
    diagnosticNotes = 'Nenhum CNPJ válido identificado no documento.';
    confidenceScore = 10;
  } else {
    const topCandidate = candidates[0];
    const registered = registeredMap.get(topCandidate.cleanCnpj);

    if (registered) {
      // Prioridade máxima: CNPJ já cadastrado
      selectedClient = {
        cnpj: registered.cnpj,
        cleanCnpj: registered.cleanCnpj,
        name: registered.customName,
        isPreRegistered: true,
      };
      identificationMethod = 'CLIENTE_CADASTRADO_POR_CNPJ';
      diagnosticNotes = `Cliente "${registered.customName}" identificado automaticamente pelo CNPJ cadastrado (${registered.cnpj}).`;
      confidenceScore = 100;
    } else if (topCandidate.role === 'TOMADOR' || topCandidate.role === 'DESTINATARIO' || topCandidate.role === 'CLIENTE') {
      // Prioridade 2: Contexto forte de tomador/destinatário
      selectedClient = {
        cnpj: topCandidate.cnpj,
        cleanCnpj: topCandidate.cleanCnpj,
        name: topCandidate.name,
        isPreRegistered: false,
      };
      identificationMethod = 'CNPJ_CONTEXTO';
      diagnosticNotes = `Cliente identificado através de contexto semântico (${topCandidate.role}) com CNPJ ${topCandidate.cnpj}.`;
      confidenceScore = 85;
    } else if (candidates.length === 1) {
      // Apenas 1 CNPJ na nota
      selectedClient = {
        cnpj: topCandidate.cnpj,
        cleanCnpj: topCandidate.cleanCnpj,
        name: topCandidate.name,
        isPreRegistered: false,
      };
      identificationMethod = 'IDENTIFICACAO_AUTOMATICA';
      diagnosticNotes = `Único CNPJ identificado no documento (${topCandidate.cnpj}).`;
      confidenceScore = 60;
    } else {
      // Múltiplos CNPJs sem distinção clara de Tomador -> Ambiguidade requer confirmação
      identificationMethod = 'NAO_IDENTIFICADO';
      diagnosticNotes = `Múltiplos CNPJs encontrados (${candidates.length}) sem indicação conclusiva do Tomador. Requer revisão manual.`;
      confidenceScore = 40;
    }
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
    destinatario,
    emitente,
    allCnpjs: analyzedCnpjs,
    selectedClient,
    identificationMethod,
    diagnosticNotes,
    candidateClients: candidates,
    hasText,
    needsOcr,
    pageCount,
    rawText: text,
    confidenceScore,
  };
}
