import { HistoryRecord } from '../types';

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export interface MonthlyClientSummary {
  clientName: string;
  cnpj: string;
  cleanCnpj: string;
  count: number;
  totalValue: number;
  totalValueFormatted: string;
}

export interface MonthlyGroup {
  monthKey: string; // "2026-09"
  year: number; // 2026
  month: number; // 9 (1-indexed)
  label: string; // "Setembro de 2026"
  shortLabel: string; // "Set/2026"
  monthNumberStr: string; // "09"
  totalInvoices: number;
  totalValue: number;
  totalValueFormatted: string;
  averageValue: number;
  averageValueFormatted: string;
  processedCount: number;
  pendingCount: number;
  errorCount: number;
  records: HistoryRecord[];
  topClients: MonthlyClientSummary[];
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Extrai ano e mês de uma data em diversos formatos possíveis
 * (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, ISO string, etc.)
 */
export function parseYearMonthFromRecord(record: HistoryRecord): {
  year: number;
  month: number; // 1-12
  monthKey: string; // YYYY-MM
} {
  const dateStr = record.invoiceDate?.trim();

  if (dateStr) {
    // 1. Formato DD/MM/YYYY ou DD-MM-YYYY ou DD.MM.YYYY
    const brMatch = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (brMatch) {
      const month = parseInt(brMatch[2], 10);
      const year = parseInt(brMatch[3], 10);
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return {
          year,
          month,
          monthKey: `${year}-${String(month).padStart(2, '0')}`,
        };
      }
    }

    // 2. Formato YYYY-MM-DD
    const isoMatch = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return {
          year,
          month,
          monthKey: `${year}-${String(month).padStart(2, '0')}`,
        };
      }
    }

    // 3. Formato DD/MM/YY (dois dígitos no ano)
    const shortYearMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
    if (shortYearMatch) {
      const month = parseInt(shortYearMatch[2], 10);
      const yy = parseInt(shortYearMatch[3], 10);
      const year = yy >= 70 ? 1900 + yy : 2000 + yy;
      if (month >= 1 && month <= 12) {
        return {
          year,
          month,
          monthKey: `${year}-${String(month).padStart(2, '0')}`,
        };
      }
    }
  }

  // Fallback: usar processedAt se existir
  if (record.processedAt) {
    try {
      const d = new Date(record.processedAt);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        return {
          year,
          month,
          monthKey: `${year}-${String(month).padStart(2, '0')}`,
        };
      }
    } catch {
      // Ignora erro
    }
  }

  // Fallback final: ano e mês atuais
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
  };
}

/**
 * Agrupa todos os registros do histórico por Mês e Ano, ordenando do mais recente para o mais antigo
 */
export function groupHistoryByMonth(records: HistoryRecord[]): MonthlyGroup[] {
  const groupsMap = new Map<string, HistoryRecord[]>();

  for (const record of records) {
    const { monthKey } = parseYearMonthFromRecord(record);
    const existing = groupsMap.get(monthKey);
    if (existing) {
      existing.push(record);
    } else {
      groupsMap.set(monthKey, [record]);
    }
  }

  // Ordenar chaves decrescentes (ex: "2026-09", "2026-08", etc.)
  const sortedKeys = Array.from(groupsMap.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    const items = groupsMap.get(key) || [];
    const [yearStr, monthStr] = key.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const monthName = MONTH_NAMES_PT[month - 1] || `Mês ${month}`;
    const monthShort = MONTH_SHORT_PT[month - 1] || `Mês ${month}`;

    const totalInvoices = items.length;
    const totalValue = items.reduce((sum, item) => sum + (item.invoiceValue || 0), 0);
    const averageValue = totalInvoices > 0 ? totalValue / totalInvoices : 0;

    const processedCount = items.filter((i) => i.status === 'PROCESSADO').length;
    const pendingCount = items.filter((i) => i.status === 'PENDENTE' || i.status === 'REVISAR').length;
    const errorCount = items.filter((i) => i.status === 'ERRO').length;

    // Calcular top clientes do mês
    const clientMap = new Map<string, { cnpj: string; cleanCnpj: string; count: number; totalValue: number }>();
    for (const item of items) {
      const name = item.clientName || 'CLIENTE NÃO IDENTIFICADO';
      const existing = clientMap.get(name);
      const val = item.invoiceValue || 0;
      if (existing) {
        existing.count += 1;
        existing.totalValue += val;
      } else {
        clientMap.set(name, {
          cnpj: item.cnpj || '',
          cleanCnpj: item.cleanCnpj || '',
          count: 1,
          totalValue: val,
        });
      }
    }

    const topClients: MonthlyClientSummary[] = Array.from(clientMap.entries())
      .map(([clientName, data]) => ({
        clientName,
        cnpj: data.cnpj,
        cleanCnpj: data.cleanCnpj,
        count: data.count,
        totalValue: data.totalValue,
        totalValueFormatted: formatBRL(data.totalValue),
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    return {
      monthKey: key,
      year,
      month,
      label: `${monthName} de ${year}`,
      shortLabel: `${monthShort}/${year}`,
      monthNumberStr: monthStr,
      totalInvoices,
      totalValue,
      totalValueFormatted: formatBRL(totalValue),
      averageValue,
      averageValueFormatted: formatBRL(averageValue),
      processedCount,
      pendingCount,
      errorCount,
      records: items,
      topClients,
    };
  });
}

/**
 * Exporta fechamento mensal em CSV formatado
 */
export function exportMonthlyGroupCSV(group: MonthlyGroup): void {
  const headers = [
    'Mês Referência',
    'Arquivo Gerado',
    'Cliente (Tomador)',
    'CNPJ / CPF',
    'Número da Nota',
    'Data de Emissão',
    'Valor da Nota (R$)',
    'Status',
    'Caminho de Destino',
  ];

  const rows = group.records.map((r) => [
    `"${group.label}"`,
    `"${(r.generatedFileName || '').replace(/"/g, '""')}"`,
    `"${(r.clientName || '').replace(/"/g, '""')}"`,
    `"${r.cnpj || ''}"`,
    `"${r.invoiceNumber || ''}"`,
    `"${r.invoiceDate || ''}"`,
    (r.invoiceValue || 0).toFixed(2).replace('.', ','),
    `"${r.status}"`,
    `"${(r.targetPath || '').replace(/"/g, '""')}"`,
  ]);

  // Resumo no rodapé do CSV
  const summaryRows = [
    [],
    ['RESUMO DO MÊS', group.label],
    ['Total de Notas Emitidas', String(group.totalInvoices)],
    ['Valor Total Faturado', (group.totalValue || 0).toFixed(2).replace('.', ',')],
    ['Ticket Médio', (group.averageValue || 0).toFixed(2).replace('.', ',')],
    ['Notas Processadas', String(group.processedCount)],
    ['Notas em Revisão', String(group.pendingCount)],
  ];

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [
      headers.join(';'),
      ...rows.map((e) => e.join(';')),
      ...summaryRows.map((e) => e.join(';')),
    ].join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    `fechamento_mensal_${group.monthKey.replace('-', '_')}_${group.shortLabel.replace('/', '_')}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
