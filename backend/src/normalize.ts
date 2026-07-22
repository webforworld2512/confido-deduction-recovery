// Keys must be fully lowercased and whitespace-stripped to match the lookup in normalizeRetailer.
const RETAILER_MAP: Record<string, string> = {
  'kehe': 'KeHE',
  'kehedistributors': 'KeHE',
  'kehedistributorsllc': 'KeHE',
  'kehefooddistributors': 'KeHE',

  'kroger': 'Kroger',
  'krogerco': 'Kroger',
  'krogerco.': 'Kroger',
  'thekrogerco.': 'Kroger',

  'walmart': 'Walmart',
  'wal-mart': 'Walmart',
  'walmartinc.': 'Walmart',

  'target': 'Target',
  'targetcorp': 'Target',
  'targetcorporation': 'Target',
  'tgt': 'Target',

  'unfi': 'UNFI',
  'u.n.f.i.': 'UNFI',
  'unitednaturalfoods': 'UNFI',
  'unitednaturalfoodsinc': 'UNFI',

  'amazon': 'Amazon',
  'amzn': 'Amazon',
  'amazon.com': 'Amazon',
  'amazonvendor': 'Amazon',
  'amazonvendorcentral': 'Amazon',

  'bjs': "BJ's Wholesale Club",
  'bjswholesale': "BJ's Wholesale Club",
  "bj'swholesaleclub": "BJ's Wholesale Club",

  'cvs': 'CVS',
  'cvspharmacy': 'CVS',
  'cvshealth': 'CVS',

  'dotfoods': 'Dot Foods',
  'dotfoodsinc': 'Dot Foods',

  'gordonfoodservice': 'Gordon Food Service',
  'gfs': 'Gordon Food Service',
  'gfc': 'Gordon Food Service',
  'gordonfoodsvc': 'Gordon Food Service',
  'gordonfoodservice(gfc)': 'Gordon Food Service',

  'heb': 'H-E-B',
  'h-e-b': 'H-E-B',

  'winco': 'WinCo Foods',
  'wincofoods': 'WinCo Foods',

  'loblaw': 'Loblaw',
  'loblaws': 'Loblaw',
  'loblawcompanies': 'Loblaw',

  'ahold': 'Ahold Delhaize',
  'aholddelhaize': 'Ahold Delhaize',
};

export function normalizeRetailer(raw: string | null | undefined): string {
  if (raw == null) return 'Unknown';
  const trimmed = raw.replace(/[\s\t]+/g, '').toLowerCase();
  if (trimmed === '' || trimmed === 'n/a' || trimmed === '-' || trimmed === 'null') return 'Unknown';

  const match = RETAILER_MAP[trimmed];
  if (match) return match;

  // Strip dots for variants like "U.N.F.I" (no trailing dot)
  const noDots = trimmed.replace(/\./g, '');
  const dotsMatch = RETAILER_MAP[noDots];
  if (dotsMatch) return dotsMatch;

  return raw.trim();
}

export function parseAmount(raw: any): { cents: number | null; flag: string | null } {
  if (raw == null || raw === '') return { cents: null, flag: 'missing' };

  if (typeof raw === 'number') {
    if (isNaN(raw)) return { cents: null, flag: 'missing' };
    const flag = raw < 0 ? 'negative_original' : (Math.abs(raw) > 50000 ? 'outlier' : null);
    return { cents: Math.round(Math.abs(raw) * 100), flag };
  }

  if (typeof raw !== 'string') return { cents: null, flag: 'missing' };

  let s = raw.trim();
  if (s === '' || s === '-') return { cents: null, flag: 'missing' };
  if (s.toUpperCase() === 'TBD') return { cents: null, flag: 'tbd' };

  s = s.replace(/^USD\s*/i, '').replace(/^\$/, '').replace(/,/g, '');

  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.substring(1).replace(/^\$/, '');
  }

  const parenMatch = s.match(/^\((.+)\)$/);
  if (parenMatch) {
    negative = true;
    s = parenMatch[1];
  }

  s = s.trim();
  const num = Number(s);
  if (isNaN(num)) return { cents: null, flag: 'missing' };

  const absCents = Math.round(Math.abs(num) * 100);
  let flag: string | null = null;
  if (negative) flag = 'negative_original';
  else if (num > 50000) flag = 'outlier';

  return { cents: absCents, flag };
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function validateAndFormat(year: number, month: number, day: number): { date: string | null; flag: string | null } {
  if (month < 1 || month > 12 || day < 1 || day > 31) return { date: null, flag: 'invalid' };
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const flag = year >= 2028 ? 'suspicious_future_date' : null;
  return { date: iso, flag };
}

export function parseDate(raw: any): { date: string | null; flag: string | null } {
  if (raw == null) return { date: null, flag: null };
  if (typeof raw !== 'string') return { date: null, flag: null };

  const s = raw.trim();
  if (s === '' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'none' || s.toLowerCase() === 'n/a') {
    return { date: null, flag: null };
  }

  if (s === '0000-00-00') return { date: null, flag: 'invalid' };

  // "Month Day, Year" — e.g. "January 17, 2026"
  const spelledMatch = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (spelledMatch) {
    const month = MONTHS[spelledMatch[1].toLowerCase()];
    if (month) return validateAndFormat(Number(spelledMatch[3]), month, Number(spelledMatch[2]));
  }

  // YYYY-MM-DDTHH:MM:SS.sssZ (ISO timestamp)
  const isoTMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (isoTMatch) {
    return validateAndFormat(Number(isoTMatch[1]), Number(isoTMatch[2]), Number(isoTMatch[3]));
  }

  // YYYY-MM-DD
  const ymdDash = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdDash) {
    return validateAndFormat(Number(ymdDash[1]), Number(ymdDash[2]), Number(ymdDash[3]));
  }

  // YYYY/MM/DD or YYYY/MM/DD HH:MM:SS
  const ymdSlash = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (ymdSlash) {
    return validateAndFormat(Number(ymdSlash[1]), Number(ymdSlash[2]), Number(ymdSlash[3]));
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdySlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdySlash) {
    return validateAndFormat(Number(mdySlash[3]), Number(mdySlash[1]), Number(mdySlash[2]));
  }

  // M/D/YY (two-digit year, assume 2000s)
  const mdyShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdyShort) {
    return validateAndFormat(2000 + Number(mdyShort[3]), Number(mdyShort[1]), Number(mdyShort[2]));
  }

  // DD-MM-YYYY — disambiguate: if first part > 12 it must be the day
  const dmyDash = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyDash) {
    const a = Number(dmyDash[1]);
    const b = Number(dmyDash[2]);
    const year = Number(dmyDash[3]);
    if (a > 12) return validateAndFormat(year, b, a);
    if (b > 12) return validateAndFormat(year, a, b);
    // Ambiguous — default to DD-MM-YYYY per spec
    return validateAndFormat(year, b, a);
  }

  return { date: null, flag: 'invalid' };
}

// Keys are spaceless, dashless, lowercased to match the normalizeReason lookup.
const REASON_MAP: Record<string, string> = {
  'shortage': 'SHORT',
  'short': 'SHORT',
  'shortageproduct': 'SHORT',
  'shortageintransit': 'SHORT',

  'pricing': 'PRICE',
  'price': 'PRICE',
  'pricediscrepancy': 'PRICE',

  'freight': 'FREIGHT',
  'freightallowance': 'FREIGHT',
  'frieght': 'FREIGHT',

  'os&d': 'OSD',

  'compliance': 'COMP',
  'compliancefine': 'COMP',
  'fine': 'COMP',

  'spoilage': 'SPOIL',
  'spoiled': 'SPOIL',

  'unsaleables': 'UNSAL',
  'unsaleable': 'UNSAL',
  'unsalables': 'UNSAL',

  'billback': 'MCB',
  'mcb': 'MCB',

  'promotionalallowance': 'PROMO',
  'promo': 'PROMO',
};

export function normalizeReason(raw: string | null | undefined): string {
  if (raw == null) return 'OTHER';
  const key = raw.replace(/[\s\t]+/g, '').replace(/-/g, '').toLowerCase();
  if (key === '' || key === 'n/a' || key === '???' || key === 'misc' || key === 'other') return 'OTHER';
  return REASON_MAP[key] ?? 'OTHER';
}

export function parseDeleted(raw: any): boolean {
  return raw === true || raw === 1 || raw === 'true' || raw === '1';
}

export function getField(record: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    if (record[k] !== undefined) return record[k];
  }
  return undefined;
}
