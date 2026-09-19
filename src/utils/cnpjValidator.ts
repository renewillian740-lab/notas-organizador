/**
 * Utilitários para extração, normalização e validação oficial de CNPJ e CPF.
 * Baseado no algoritmo padrão do Ministério da Fazenda / Receita Federal do Brasil.
 */

export function cleanCNPJ(cnpj: string): string {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

export function formatCNPJ(cnpj: string): string {
  const clean = cleanCNPJ(cnpj);
  if (clean.length !== 14) return cnpj;
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

export function cleanCPF(cpf: string): string {
  if (!cpf) return '';
  return cpf.replace(/\D/g, '');
}

export function formatCPF(cpf: string): string {
  const clean = cleanCPF(cpf);
  if (clean.length !== 11) return cpf;
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function cleanDocument(doc: string): string {
  if (!doc) return '';
  return doc.replace(/\D/g, '');
}

export function formatDocument(doc: string): string {
  const clean = cleanDocument(doc);
  if (clean.length === 14) return formatCNPJ(clean);
  if (clean.length === 11) return formatCPF(clean);
  return doc;
}

export function isValidDocument(doc: string): boolean {
  const clean = cleanDocument(doc);
  if (clean.length === 14) return isValidCNPJ(clean);
  if (clean.length === 11) return isValidCPF(clean);
  return false;
}

/**
 * Validação rigorosa dos dígitos verificadores (DV1 e DV2) do CNPJ (Módulo 11)
 */
export function isValidCNPJ(cnpj: string): boolean {
  const clean = cleanCNPJ(cnpj);

  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  const peso1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma1 = 0;
  for (let i = 0; i < 12; i++) {
    soma1 += parseInt(clean.charAt(i), 10) * peso1[i];
  }
  let resto1 = soma1 % 11;
  let dv1 = resto1 < 2 ? 0 : 11 - resto1;
  if (parseInt(clean.charAt(12), 10) !== dv1) return false;

  const peso2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma2 = 0;
  for (let i = 0; i < 13; i++) {
    soma2 += parseInt(clean.charAt(i), 10) * peso2[i];
  }
  let resto2 = soma2 % 11;
  let dv2 = resto2 < 2 ? 0 : 11 - resto2;
  if (parseInt(clean.charAt(13), 10) !== dv2) return false;

  return true;
}

/**
 * Validação dos dígitos verificadores do CPF
 */
export function isValidCPF(cpf: string): boolean {
  const clean = cleanCPF(cpf);
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;

  let soma1 = 0;
  for (let i = 0; i < 9; i++) {
    soma1 += parseInt(clean.charAt(i), 10) * (10 - i);
  }
  let resto1 = (soma1 * 10) % 11;
  if (resto1 === 10 || resto1 === 11) resto1 = 0;
  if (resto1 !== parseInt(clean.charAt(9), 10)) return false;

  let soma2 = 0;
  for (let i = 0; i < 10; i++) {
    soma2 += parseInt(clean.charAt(i), 10) * (11 - i);
  }
  let resto2 = (soma2 * 10) % 11;
  if (resto2 === 10 || resto2 === 11) resto2 = 0;
  if (resto2 !== parseInt(clean.charAt(10), 10)) return false;

  return true;
}

export interface ExtractedCNPJMatch {
  raw: string;
  clean: string;
  formatted: string;
  isValid: boolean;
  type: 'CNPJ' | 'CPF';
  startIndex: number;
  endIndex: number;
  surroundingContext: string;
}

/**
 * Extrai todos os CNPJs e CPFs de uma string de texto com seus contextos
 */
export function extractAllCNPJsFromText(text: string, contextWindow = 200): ExtractedCNPJMatch[] {
  if (!text) return [];

  const results: ExtractedCNPJMatch[] = [];
  const foundCleanMap = new Set<string>();

  // 1. CNPJ Formatado: XX.XXX.XXX/XXXX-XX
  const formattedRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
  let match: RegExpExecArray | null;

  while ((match = formattedRegex.exec(text)) !== null) {
    const raw = match[0];
    const clean = cleanCNPJ(raw);
    if (clean.length === 14 && isValidCNPJ(clean)) {
      const startIndex = Math.max(0, match.index - contextWindow);
      const endIndex = Math.min(text.length, match.index + raw.length + contextWindow);
      const surroundingContext = text.substring(startIndex, endIndex);

      results.push({
        raw,
        clean,
        formatted: formatCNPJ(clean),
        isValid: true,
        type: 'CNPJ',
        startIndex: match.index,
        endIndex: match.index + raw.length,
        surroundingContext,
      });
      foundCleanMap.add(clean);
    }
  }

  // 2. CNPJ 14 dígitos consecutivos não formatados
  const unformattedRegex = /\b\d{14}\b/g;
  while ((match = unformattedRegex.exec(text)) !== null) {
    const raw = match[0];
    const clean = raw;
    if (!foundCleanMap.has(clean) && isValidCNPJ(clean)) {
      const startIndex = Math.max(0, match.index - contextWindow);
      const endIndex = Math.min(text.length, match.index + raw.length + contextWindow);
      const surroundingContext = text.substring(startIndex, endIndex);

      results.push({
        raw,
        clean,
        formatted: formatCNPJ(clean),
        isValid: true,
        type: 'CNPJ',
        startIndex: match.index,
        endIndex: match.index + raw.length,
        surroundingContext,
      });
      foundCleanMap.add(clean);
    }
  }

  // 3. CPF Formatado: XXX.XXX.XXX-XX (apenas se não for parte de CNPJ)
  const cpfRegex = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
  while ((match = cpfRegex.exec(text)) !== null) {
    const raw = match[0];
    const clean = cleanCPF(raw);
    if (clean.length === 11 && isValidCPF(clean) && !foundCleanMap.has(clean)) {
      const startIndex = Math.max(0, match.index - contextWindow);
      const endIndex = Math.min(text.length, match.index + raw.length + contextWindow);
      const surroundingContext = text.substring(startIndex, endIndex);

      results.push({
        raw,
        clean,
        formatted: formatCPF(clean),
        isValid: true,
        type: 'CPF',
        startIndex: match.index,
        endIndex: match.index + raw.length,
        surroundingContext,
      });
      foundCleanMap.add(clean);
    }
  }

  return results;
}

export interface FileNameMetadata {
  invoiceNumber?: string;
  clientName?: string;
  cnpjOrCpf?: string;
  invoiceValue?: number;
  invoiceValueFormatted?: string;
  invoiceDate?: string;
  hasStructure: boolean;
}

/**
 * Heurística para extrair metadados confiáveis de nomes de arquivos como:
 * "NF_7_TREND_COMUNICACAO_DIGITAL_LTDA_R$800,00_25-02-2026.pdf"
 * "NF_25_40.178.879_FELIPE_GOIS_MELO_R$2000,00_22-06-2026.pdf"
 * "NF_8_ARYZONA_PRODUCAO_AUDIOVISUAL_LTDA_R$400,00.pdf"
 */
export function extractMetadataFromFileName(fileName: string): FileNameMetadata {
  if (!fileName) return { hasStructure: false };

  // Remove extensão .pdf
  const base = fileName.replace(/\.pdf$/i, '').trim();

  let invoiceNumber: string | undefined;
  let clientName: string | undefined;
  let cnpjOrCpf: string | undefined;
  let invoiceValue: number | undefined;
  let invoiceValueFormatted: string | undefined;
  let invoiceDate: string | undefined;

  // 1. Extração de Data no formato DD-MM-AAAA ou DD_MM_AAAA ou DD/MM/AAAA
  const dateMatch = base.match(/(\d{2})[-_\.](\d{2})[-_\.](\d{4})/);
  if (dateMatch) {
    invoiceDate = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
  }

  // 2. Extração de Valor Monetário no formato R$xxx,xx ou R$xxx.xx ou R$xxxx
  const valueMatch = base.match(/R\$?\s*([\d\.,]+)/i);
  if (valueMatch && valueMatch[1]) {
    const rawVal = valueMatch[1].replace(/\./g, '').replace(',', '.');
    const num = parseFloat(rawVal);
    if (!isNaN(num) && num > 0) {
      invoiceValue = num;
      invoiceValueFormatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(num);
    }
  }

  // 3. Extração de Número da Nota no início (NF_123_ ou NF-123_ ou NF123_)
  const nfMatch = base.match(/^NFS?[-_eE]?_?(\d+)/i);
  if (nfMatch && nfMatch[1]) {
    invoiceNumber = nfMatch[1];
  }

  // 4. Extração do Nome do Cliente no miolo do nome do arquivo
  // Padrão: NF_NUMERO_[CNPJ_]?CLIENTE_NAME_R$VALOR...
  // Exemplo: NF_7_TREND_COMUNICACAO_DIGITAL_LTDA_R$800,00_25-02-2026
  let center = base;
  if (nfMatch) {
    center = center.substring(nfMatch[0].length);
  }
  // Remove valor e tudo que vem depois
  if (valueMatch) {
    const vIndex = center.toUpperCase().indexOf('R$');
    if (vIndex >= 0) {
      center = center.substring(0, vIndex);
    }
  } else if (dateMatch) {
    const dIndex = center.indexOf(dateMatch[0]);
    if (dIndex >= 0) {
      center = center.substring(0, dIndex);
    }
  }

  // Limpa underscores no início e fim
  center = center.replace(/^_+|_+$/g, '').replace(/^-+|-+$/g, '').trim();

  // Verifica se há CNPJ/CPF no início do nome do cliente (ex: 40.178.879_FELIPE_GOIS_MELO ou 40178879000100)
  const leadingDocMatch = center.match(/^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{8,14})[_\-\s]+(.*)$/);
  if (leadingDocMatch) {
    cnpjOrCpf = formatDocument(leadingDocMatch[1]);
    center = leadingDocMatch[2];
  }

  // Normaliza o nome do cliente substituindo underscores por espaços
  if (center.length >= 2) {
    const cleanName = center.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    // Rejeita se for apenas números ou palavras reservadas
    if (!/^\d+$/.test(cleanName) && !/^(NF|NOTA|PDF)$/i.test(cleanName)) {
      clientName = cleanName.toUpperCase();
    }
  }

  const hasStructure = Boolean(invoiceNumber || clientName || invoiceValue);

  return {
    invoiceNumber,
    clientName,
    cnpjOrCpf,
    invoiceValue,
    invoiceValueFormatted,
    invoiceDate,
    hasStructure,
  };
}

