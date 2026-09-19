/**
 * Gerador de PDFs reais de teste com notas fiscais brasileiras autênticas
 * para validação imediata do fluxo completo sem depender de uploads externos do usuário.
 */

function createMinimalPdfWithText(textLines: string[]): Blob {
  // Constrói um documento PDF 1.4 válido e bem formatado com stream de texto puro
  const streamLines = [
    'BT',
    '/F1 12 Tf',
    '50 780 Td',
    '15 TL',
  ];

  for (const line of textLines) {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    streamLines.push(`(${escaped}) '`);
  }
  streamLines.push('ET');

  const streamContent = streamLines.join('\n');
  const streamLength = streamContent.length;

  const pdfBody = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000227 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${400 + streamLength}
%%EOF`;

  return new Blob([pdfBody], { type: 'application/pdf' });
}

export function generateSampleInvoiceFiles(): File[] {
  // Amostra 1: NFS-e de Serviços com Prestador e Tomador bem definidos
  const nf1Lines = [
    'PREFEITURA MUNICIPAL DE SAO PAULO',
    'NOTA FISCAL ELETRONICA DE SERVICOS - NFS-e',
    'Numero da Nota: 20260482',
    'Data e Hora da Emissao: 15/09/2026 14:32:10',
    'Codigo de Verificacao: AB99-ZZ12',
    '------------------------------------------------------------',
    'PRESTADOR DE SERVICOS',
    'Razao Social: TECH SOLUTIONS BRASIL LTDA',
    'Nome Fantasia: TECH SOLUTIONS',
    'CNPJ: 11.222.333/0001-81',
    'Inscricao Municipal: 1.234.567-8',
    'Endereco: Av. Paulista, 1000 - Sao Paulo/SP',
    '------------------------------------------------------------',
    'TOMADOR DE SERVICOS / CLIENTE',
    'Razao Social: ACME LOGISTICA E DISTRIBUICAO S.A.',
    'Nome Fantasia: ACME LOG',
    'CNPJ: 04.252.011/0001-10',
    'Endereco: Rua das Industrias, 500 - Campinas/SP',
    '------------------------------------------------------------',
    'DISCRIMINACAO DOS SERVICOS',
    'Desenvolvimento de software customizado e manutencao mensal de servidores.',
    'VALOR TOTAL DOS SERVICOS: R$ 8.450,00',
    'VALOR TOTAL DA NOTA: R$ 8.450,00',
    'VALOR LIQUIDO: R$ 8.450,00',
  ];

  // Amostra 2: DANFE / NF-e Mercadorias com Emitente e Destinatário
  const nf2Lines = [
    'DANFE - DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRONICA',
    'CHAVE DE ACESSO: 3526 0900 1234 5678 0001 5500 1000 0019 4510 0123 4567',
    'NF-e No. 000.019.452',
    'Serie: 1',
    'Data de Emissao: 08/09/2026',
    '------------------------------------------------------------',
    'EMITENTE',
    'Razao Social: PAPELARIA & SUPRIMENTOS CENTRAL LTDA',
    'CNPJ: 07.526.557/0001-00',
    'Inscricao Estadual: 111.222.333.444',
    '------------------------------------------------------------',
    'DESTINATARIO / REMETENTE',
    'Nome / Razao Social: NOVA ERA ENGENHARIA E CONSTRUCOES LTDA',
    'CNPJ / CPF: 33.453.650/0001-09',
    'Endereco: Alameda Santos, 820 - Bela Vista - Sao Paulo/SP',
    'Data Saida/Entrada: 08/09/2026',
    '------------------------------------------------------------',
    'CALCULO DO IMPOSTO',
    'BASE DE CALCULO ICMS: R$ 3.200,00',
    'VALOR DO ICMS: R$ 576,00',
    'VALOR TOTAL DA NF-e: R$ 3.200,00',
  ];

  // Amostra 3: NFS-e com Cliente Contratante Alpha
  const nf3Lines = [
    'SISTEMA TRIBUTARIO MUNICIPAL - NFS-E',
    'Numero da NFS-e: 8841',
    'Data de Emissao: 02/09/2026',
    'Competencia: 09/2026',
    'PRESTADOR: STUDIO DESIGN CRIATIVO LTDA',
    'CNPJ: 14.550.218/0001-90',
    '------------------------------------------------------------',
    'TOMADOR / CLIENTE CONTRATANTE:',
    'Razao Social: HIPERMERCADOS BRASILEIROS S.A.',
    'CNPJ: 00.776.574/0001-56',
    'VALOR TOTAL DA NOTA: R$ 12.900,00',
  ];

  // Amostra 4: Nota com Múltiplos CNPJs e Ambiguidade (requer revisão)
  const nf4Lines = [
    'RELATORIO FISCAL CONSOLIDADO E NOTA DE SERVICO',
    'Numero da Nota: 77201',
    'Data: 11/09/2026',
    'Consorcio Operador CNPJ: 60.701.190/0001-04 (BANCO ITAU CONSIGNADO S.A.)',
    'Subcontratada Operacional CNPJ: 00.000.000/0001-91 (BANCO DO BRASIL S.A.)',
    'VALOR TOTAL: R$ 4.720,00',
  ];

  // Amostra 5: Documento digitalizado sem camada de texto (para teste de OCR)
  const nf5Lines: string[] = []; // Vazio propositalmente

  // Amostra 6: NF 27 - Guilherme dos Santos Aragão
  const nf27Lines = [
    'NOTA FISCAL ELETRONICA DE SERVICOS - NFS-e',
    'Numero da Nota: 27',
    'Data de Emissao: 30/06/2026',
    '------------------------------------------------------------',
    'PRESTADOR DE SERVICOS',
    'Razao Social: CONSULTORIA E SERVICOS TECNICOS LTDA',
    'CNPJ: 12.345.678/0001-99',
    '------------------------------------------------------------',
    'TOMADOR DE SERVICOS / CLIENTE',
    'Razao Social: GUILHERME DOS SANTOS ARAGAO',
    'CNPJ: 55.573.511/0001-00',
    '------------------------------------------------------------',
    'VALOR TOTAL DA NOTA: R$ 4.400,00',
  ];

  const blob1 = createMinimalPdfWithText(nf1Lines);
  const blob2 = createMinimalPdfWithText(nf2Lines);
  const blob3 = createMinimalPdfWithText(nf3Lines);
  const blob4 = createMinimalPdfWithText(nf4Lines);
  const blob5 = createMinimalPdfWithText(nf5Lines);
  const blob27 = createMinimalPdfWithText(nf27Lines);

  return [
    new File([blob27], 'NF_27_55.573.511_GUILHERME_DOS_SANTOS_ARAGAO_R$4400,00_30-06-2026.pdf', { type: 'application/pdf' }),
    new File([blob1], 'NF_original_servico_tech_acme.pdf', { type: 'application/pdf' }),
    new File([blob2], 'DANFE_019452_papelaria_novaera.pdf', { type: 'application/pdf' }),
    new File([blob3], 'NFS-e_8841_design_hipermercado.pdf', { type: 'application/pdf' }),
    new File([blob4], 'Nota_Consorcio_Multiplos_CNPJs.pdf', { type: 'application/pdf' }),
    new File([blob5], 'Nota_Scanneada_Sem_Texto_Digitalizado.pdf', { type: 'application/pdf' }),
  ];
}
