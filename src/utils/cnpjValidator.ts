/**
 * Utilitários para extração, normalização e validação oficial de CNPJ.
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

/**
 * Validação rigorosa dos dígitos verificadores (DV1 e DV2) do CNPJ (Módulo 11)
 */
export function isValidCNPJ(cnpj: string): boolean {
  const clean = cleanCNPJ(cnpj);

  // Deve ter exatamente 14 dígitos numéricos
  if (clean.length !== 14) return false;

  // Rejeita sequências de dígitos idênticos conhecidas (00000000000000, 11111111111111, etc)
  if (/^(\d)\1{13}$/.test(clean)) return false;

  // Validação do primeiro dígito verificador (DV1)
  const peso1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma1 = 0;
  for (let i = 0; i < 12; i++) {
    soma1 += parseInt(clean.charAt(i), 10) * peso1[i];
  }
  let resto1 = soma1 % 11;
  let dv1 = resto1 < 2 ? 0 : 11 - resto1;
  if (parseInt(clean.charAt(12), 10) !== dv1) return false;

  // Validação do segundo dígito verificador (DV2)
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

export interface ExtractedCNPJMatch {
  raw: string;
  clean: string;
  formatted: string;
  isValid: boolean;
  startIndex: number;
  endIndex: number;
  surroundingContext: string;
}

/**
 * Extrai todos os CNPJs (formatados ou apenas dígitos) de uma string de texto,
 * retornando os contextos adjacentes para análise semântica.
 */
export function extractAllCNPJsFromText(text: string, contextWindow = 200): ExtractedCNPJMatch[] {
  if (!text) return [];

  const results: ExtractedCNPJMatch[] = [];
  const foundCleanMap = new Set<string>();

  // 1. Padrão com pontuação: XX.XXX.XXX/XXXX-XX
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
        startIndex: match.index,
        endIndex: match.index + raw.length,
        surroundingContext,
      });
      foundCleanMap.add(clean);
    }
  }

  // 2. Padrão apenas dígitos: 14 dígitos consecutivos não capturados anteriormente
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
        startIndex: match.index,
        endIndex: match.index + raw.length,
        surroundingContext,
      });
      foundCleanMap.add(clean);
    }
  }

  return results;
}
