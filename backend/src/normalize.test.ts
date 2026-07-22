import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRetailer,
  parseAmount,
  parseDate,
  normalizeReason,
  parseDeleted,
  getField,
} from './normalize';

// ── normalizeRetailer ──

describe('normalizeRetailer', () => {
  it('maps KeHE variants', () => {
    assert.equal(normalizeRetailer('KeHE'), 'KeHE');
    assert.equal(normalizeRetailer('kehe'), 'KeHE');
    assert.equal(normalizeRetailer('KEHE'), 'KeHE');
    assert.equal(normalizeRetailer('  KeHE'), 'KeHE');
    assert.equal(normalizeRetailer('KEHE\t'), 'KeHE');
    assert.equal(normalizeRetailer('KeHE '), 'KeHE');
    assert.equal(normalizeRetailer('KeHE Distributors'), 'KeHE');
    assert.equal(normalizeRetailer('KeHE Distributors LLC'), 'KeHE');
    assert.equal(normalizeRetailer('Kehe Food Distributors'), 'KeHE');
    assert.equal(normalizeRetailer('K e H E'), 'KeHE');
    assert.equal(normalizeRetailer('Kehe'), 'KeHE');
  });

  it('maps Kroger variants', () => {
    assert.equal(normalizeRetailer('Kroger'), 'Kroger');
    assert.equal(normalizeRetailer('kroger'), 'Kroger');
    assert.equal(normalizeRetailer('KROGER'), 'Kroger');
    assert.equal(normalizeRetailer('Kroger  '), 'Kroger');
    assert.equal(normalizeRetailer('Kroger Co'), 'Kroger');
    assert.equal(normalizeRetailer('Kroger Co.'), 'Kroger');
    assert.equal(normalizeRetailer('The Kroger Co.'), 'Kroger');
    assert.equal(normalizeRetailer('kroger co'), 'Kroger');
  });

  it('maps Walmart variants', () => {
    assert.equal(normalizeRetailer('Walmart'), 'Walmart');
    assert.equal(normalizeRetailer('WALMART'), 'Walmart');
    assert.equal(normalizeRetailer('Wal-Mart'), 'Walmart');
    assert.equal(normalizeRetailer('Wal Mart'), 'Walmart');
    assert.equal(normalizeRetailer('Walmart Inc.'), 'Walmart');
  });

  it('maps Target variants', () => {
    assert.equal(normalizeRetailer('Target'), 'Target');
    assert.equal(normalizeRetailer('TARGET'), 'Target');
    assert.equal(normalizeRetailer('Target '), 'Target');
    assert.equal(normalizeRetailer('Target Corp'), 'Target');
    assert.equal(normalizeRetailer('Target Corporation'), 'Target');
    assert.equal(normalizeRetailer('Tgt'), 'Target');
    assert.equal(normalizeRetailer('target'), 'Target');
  });

  it('maps UNFI variants', () => {
    assert.equal(normalizeRetailer('UNFI'), 'UNFI');
    assert.equal(normalizeRetailer('UNFI '), 'UNFI');
    assert.equal(normalizeRetailer('Unfi'), 'UNFI');
    assert.equal(normalizeRetailer('unfi'), 'UNFI');
    assert.equal(normalizeRetailer('U.N.F.I.'), 'UNFI');
    assert.equal(normalizeRetailer('Un fi'), 'UNFI');
    assert.equal(normalizeRetailer('United Natural Foods'), 'UNFI');
    assert.equal(normalizeRetailer('United Natural Foods Inc'), 'UNFI');
  });

  it('maps Amazon variants', () => {
    assert.equal(normalizeRetailer('Amazon'), 'Amazon');
    assert.equal(normalizeRetailer('AMZN'), 'Amazon');
    assert.equal(normalizeRetailer('Amazon.com'), 'Amazon');
    assert.equal(normalizeRetailer('Amazon Vendor'), 'Amazon');
    assert.equal(normalizeRetailer('Amazon Vendor Central'), 'Amazon');
    assert.equal(normalizeRetailer('amazon vendor central'), 'Amazon');
  });

  it("maps BJ's variants", () => {
    assert.equal(normalizeRetailer('BJs'), "BJ's Wholesale Club");
    assert.equal(normalizeRetailer('Bjs Wholesale'), "BJ's Wholesale Club");
    assert.equal(normalizeRetailer("BJ's Wholesale Club"), "BJ's Wholesale Club");
  });

  it('maps CVS variants', () => {
    assert.equal(normalizeRetailer('CVS'), 'CVS');
    assert.equal(normalizeRetailer('cvs'), 'CVS');
    assert.equal(normalizeRetailer('CVS Pharmacy'), 'CVS');
    assert.equal(normalizeRetailer('CVS Health'), 'CVS');
  });

  it('maps Dot Foods variants', () => {
    assert.equal(normalizeRetailer('Dot Foods'), 'Dot Foods');
    assert.equal(normalizeRetailer('DOT FOODS'), 'Dot Foods');
    assert.equal(normalizeRetailer('Dot Foods Inc'), 'Dot Foods');
    assert.equal(normalizeRetailer('Dotfoods'), 'Dot Foods');
    assert.equal(normalizeRetailer('dot foods'), 'Dot Foods');
  });

  it('maps Gordon Food Service variants', () => {
    assert.equal(normalizeRetailer('Gordon Food Service'), 'Gordon Food Service');
    assert.equal(normalizeRetailer('GFS'), 'Gordon Food Service');
    assert.equal(normalizeRetailer('GFC'), 'Gordon Food Service');
    assert.equal(normalizeRetailer('Gordon Food Svc'), 'Gordon Food Service');
    assert.equal(normalizeRetailer('Gordon Food Service (GFC)'), 'Gordon Food Service');
    assert.equal(normalizeRetailer('gordon food service'), 'Gordon Food Service');
  });

  it('maps H-E-B variants', () => {
    assert.equal(normalizeRetailer('H-E-B'), 'H-E-B');
    assert.equal(normalizeRetailer('H-E-B '), 'H-E-B');
    assert.equal(normalizeRetailer('HEB'), 'H-E-B');
    assert.equal(normalizeRetailer('Heb'), 'H-E-B');
    assert.equal(normalizeRetailer('H E B'), 'H-E-B');
  });

  it('maps WinCo Foods variants', () => {
    assert.equal(normalizeRetailer('WinCo'), 'WinCo Foods');
    assert.equal(normalizeRetailer('WINCO'), 'WinCo Foods');
    assert.equal(normalizeRetailer('Winco'), 'WinCo Foods');
    assert.equal(normalizeRetailer('WinCo Foods'), 'WinCo Foods');
    assert.equal(normalizeRetailer('winco foods'), 'WinCo Foods');
  });

  it('maps Loblaw variants', () => {
    assert.equal(normalizeRetailer('Loblaw'), 'Loblaw');
    assert.equal(normalizeRetailer('LOBLAW'), 'Loblaw');
    assert.equal(normalizeRetailer('Loblaws'), 'Loblaw');
    assert.equal(normalizeRetailer('loblaw companies'), 'Loblaw');
  });

  it('maps Ahold Delhaize variants', () => {
    assert.equal(normalizeRetailer('Ahold'), 'Ahold Delhaize');
    assert.equal(normalizeRetailer('AHOLD'), 'Ahold Delhaize');
    assert.equal(normalizeRetailer('Ahold Delhaize'), 'Ahold Delhaize');
  });

  it('returns Unknown for null/empty/garbage', () => {
    assert.equal(normalizeRetailer(null), 'Unknown');
    assert.equal(normalizeRetailer(undefined), 'Unknown');
    assert.equal(normalizeRetailer(''), 'Unknown');
    assert.equal(normalizeRetailer('  '), 'Unknown');
    assert.equal(normalizeRetailer('   '), 'Unknown');
    assert.equal(normalizeRetailer('-'), 'Unknown');
    assert.equal(normalizeRetailer('N/A'), 'Unknown');
    assert.equal(normalizeRetailer('n/a'), 'Unknown');
    assert.equal(normalizeRetailer('NULL'), 'Unknown');
    assert.equal(normalizeRetailer('null'), 'Unknown');
  });
});

// ── parseAmount ──

describe('parseAmount', () => {
  it('handles plain numbers', () => {
    assert.deepEqual(parseAmount(2.6), { cents: 260, flag: null });
    assert.deepEqual(parseAmount(39.96), { cents: 3996, flag: null });
    assert.deepEqual(parseAmount(0), { cents: 0, flag: null });
    assert.deepEqual(parseAmount(1.38), { cents: 138, flag: null });
  });

  it('flags negative numbers', () => {
    assert.deepEqual(parseAmount(-93.47), { cents: 9347, flag: 'negative_original' });
    assert.deepEqual(parseAmount(-0.5), { cents: 50, flag: 'negative_original' });
  });

  it('flags outliers > $50K', () => {
    assert.deepEqual(parseAmount(50001), { cents: 5000100, flag: 'outlier' });
    assert.deepEqual(parseAmount(50000), { cents: 5000000, flag: null });
  });

  it('handles dollar strings', () => {
    assert.deepEqual(parseAmount('$26,783.65'), { cents: 2678365, flag: null });
    assert.deepEqual(parseAmount('$0.18'), { cents: 18, flag: null });
    assert.deepEqual(parseAmount('$117.63'), { cents: 11763, flag: null });
    assert.deepEqual(parseAmount('$2,584.55'), { cents: 258455, flag: null });
    assert.deepEqual(parseAmount('$40,596.35'), { cents: 4059635, flag: null });
  });

  it('handles USD prefix', () => {
    assert.deepEqual(parseAmount('USD 1798.98'), { cents: 179898, flag: null });
    assert.deepEqual(parseAmount('USD 0.23'), { cents: 23, flag: null });
    assert.deepEqual(parseAmount('USD 3.54'), { cents: 354, flag: null });
  });

  it('handles accounting parens (negative)', () => {
    assert.deepEqual(parseAmount('(102.78)'), { cents: 10278, flag: 'negative_original' });
    assert.deepEqual(parseAmount('(3.44)'), { cents: 344, flag: 'negative_original' });
  });

  it('handles negative dollar strings', () => {
    assert.deepEqual(parseAmount('-$642.38'), { cents: 64238, flag: 'negative_original' });
    assert.deepEqual(parseAmount('-$115.92'), { cents: 11592, flag: 'negative_original' });
    assert.deepEqual(parseAmount('-$3.28'), { cents: 328, flag: 'negative_original' });
    assert.deepEqual(parseAmount('-$32.69'), { cents: 3269, flag: 'negative_original' });
  });

  it('handles scientific notation', () => {
    assert.deepEqual(parseAmount('1.2E7'), { cents: 1200000000, flag: 'outlier' });
  });

  it('handles padded whitespace strings', () => {
    assert.deepEqual(parseAmount('  -93.47  '), { cents: 9347, flag: 'negative_original' });
    assert.deepEqual(parseAmount('  -26.98  '), { cents: 2698, flag: 'negative_original' });
    assert.deepEqual(parseAmount('  105.06  '), { cents: 10506, flag: null });
    assert.deepEqual(parseAmount('  0.20  '), { cents: 20, flag: null });
  });

  it('handles plain numeric strings', () => {
    assert.deepEqual(parseAmount('0.05'), { cents: 5, flag: null });
    assert.deepEqual(parseAmount('1,146.71'), { cents: 114671, flag: null });
    assert.deepEqual(parseAmount('15119.47'), { cents: 1511947, flag: null });
    assert.deepEqual(parseAmount('-14.90'), { cents: 1490, flag: 'negative_original' });
  });

  it('handles bare negative string', () => {
    assert.deepEqual(parseAmount('-14.90'), { cents: 1490, flag: 'negative_original' });
  });

  it('returns null for TBD', () => {
    assert.deepEqual(parseAmount('TBD'), { cents: null, flag: 'tbd' });
  });

  it('returns null for missing/empty', () => {
    assert.deepEqual(parseAmount(null), { cents: null, flag: 'missing' });
    assert.deepEqual(parseAmount(undefined), { cents: null, flag: 'missing' });
    assert.deepEqual(parseAmount(''), { cents: null, flag: 'missing' });
    assert.deepEqual(parseAmount('-'), { cents: null, flag: 'missing' });
  });

  it('handles $0.00', () => {
    assert.deepEqual(parseAmount('$0.00'), { cents: 0, flag: null });
  });

  it('handles NaN number', () => {
    assert.deepEqual(parseAmount(NaN), { cents: null, flag: 'missing' });
  });
});

// ── parseDate ──

describe('parseDate', () => {
  it('parses YYYY-MM-DD', () => {
    assert.deepEqual(parseDate('2026-01-05'), { date: '2026-01-05', flag: null });
    assert.deepEqual(parseDate('2026-12-28'), { date: '2026-12-28', flag: null });
  });

  it('parses ISO timestamps', () => {
    assert.deepEqual(parseDate('2026-01-01T00:00:00.000Z'), { date: '2026-01-01', flag: null });
    assert.deepEqual(parseDate('2026-02-12T00:00:00.000Z'), { date: '2026-02-12', flag: null });
  });

  it('parses YYYY/MM/DD HH:MM:SS', () => {
    assert.deepEqual(parseDate('2026/01/01 00:00:00'), { date: '2026-01-01', flag: null });
    assert.deepEqual(parseDate('2026/12/18 00:00:00'), { date: '2026-12-18', flag: null });
  });

  it('parses MM/DD/YYYY', () => {
    assert.deepEqual(parseDate('01/05/2026'), { date: '2026-01-05', flag: null });
    assert.deepEqual(parseDate('12/28/2026'), { date: '2026-12-28', flag: null });
    assert.deepEqual(parseDate('02/14/2026'), { date: '2026-02-14', flag: null });
  });

  it('parses M/D/YY (short year)', () => {
    assert.deepEqual(parseDate('3/14/26'), { date: '2026-03-14', flag: null });
    assert.deepEqual(parseDate('8/3/26'), { date: '2026-08-03', flag: null });
    assert.deepEqual(parseDate('1/5/26'), { date: '2026-01-05', flag: null });
    assert.deepEqual(parseDate('9/21/26'), { date: '2026-09-21', flag: null });
  });

  it('parses DD-MM-YYYY (day > 12 disambiguates)', () => {
    assert.deepEqual(parseDate('18-05-2026'), { date: '2026-05-18', flag: null });
    assert.deepEqual(parseDate('25-01-2026'), { date: '2026-01-25', flag: null });
    assert.deepEqual(parseDate('13-07-2026'), { date: '2026-07-13', flag: null });
    assert.deepEqual(parseDate('28-11-2026'), { date: '2026-11-28', flag: null });
  });

  it('treats ambiguous DD-MM-YYYY as DD-MM', () => {
    // 01-05-2026: both ≤ 12, defaults to DD=01, MM=05
    assert.deepEqual(parseDate('01-05-2026'), { date: '2026-05-01', flag: null });
    assert.deepEqual(parseDate('06-02-2026'), { date: '2026-02-06', flag: null });
  });

  it('parses spelled-out dates', () => {
    assert.deepEqual(parseDate('January 17, 2026'), { date: '2026-01-17', flag: null });
    assert.deepEqual(parseDate('March 4, 2026'), { date: '2026-03-04', flag: null });
    assert.deepEqual(parseDate('September 25, 2026'), { date: '2026-09-25', flag: null });
    assert.deepEqual(parseDate('July 1, 2026'), { date: '2026-07-01', flag: null });
  });

  it('flags 2028+ as suspicious', () => {
    assert.deepEqual(parseDate('2028-01-08'), { date: '2028-01-08', flag: 'suspicious_future_date' });
    assert.deepEqual(parseDate('2028-12-21'), { date: '2028-12-21', flag: 'suspicious_future_date' });
  });

  it('rejects invalid month 13', () => {
    assert.deepEqual(parseDate('2026-13-01'), { date: null, flag: 'invalid' });
    assert.deepEqual(parseDate('2026-13-28'), { date: null, flag: 'invalid' });
  });

  it('rejects 0000-00-00', () => {
    assert.deepEqual(parseDate('0000-00-00'), { date: null, flag: 'invalid' });
  });

  it('returns null for empty/null/none', () => {
    assert.deepEqual(parseDate(null), { date: null, flag: null });
    assert.deepEqual(parseDate(''), { date: null, flag: null });
    assert.deepEqual(parseDate('  '), { date: null, flag: null });
    assert.deepEqual(parseDate('null'), { date: null, flag: null });
    assert.deepEqual(parseDate('NULL'), { date: null, flag: null });
    assert.deepEqual(parseDate('None'), { date: null, flag: null });
    assert.deepEqual(parseDate('N/A'), { date: null, flag: null });
    assert.deepEqual(parseDate('n/a'), { date: null, flag: null });
    assert.deepEqual(parseDate('-'), { date: null, flag: null });
  });
});

// ── normalizeReason ──

describe('normalizeReason', () => {
  it('maps shortage variants', () => {
    assert.equal(normalizeReason('Shortage'), 'SHORT');
    assert.equal(normalizeReason('SHORTAGE'), 'SHORT');
    assert.equal(normalizeReason('shortage'), 'SHORT');
    assert.equal(normalizeReason('Short'), 'SHORT');
    assert.equal(normalizeReason('Shortage - Product'), 'SHORT');
    assert.equal(normalizeReason('Shortage in Transit'), 'SHORT');
  });

  it('maps pricing variants', () => {
    assert.equal(normalizeReason('Pricing'), 'PRICE');
    assert.equal(normalizeReason('PRICING'), 'PRICE');
    assert.equal(normalizeReason('pricing'), 'PRICE');
    assert.equal(normalizeReason('Price'), 'PRICE');
    assert.equal(normalizeReason('Price Discrepancy'), 'PRICE');
  });

  it('maps freight variants', () => {
    assert.equal(normalizeReason('Freight'), 'FREIGHT');
    assert.equal(normalizeReason('freight'), 'FREIGHT');
    assert.equal(normalizeReason('Freight Allowance'), 'FREIGHT');
    assert.equal(normalizeReason('Frieght'), 'FREIGHT');
  });

  it('maps OS&D', () => {
    assert.equal(normalizeReason('OS&D'), 'OSD');
  });

  it('maps compliance variants', () => {
    assert.equal(normalizeReason('Compliance'), 'COMP');
    assert.equal(normalizeReason('Compliance Fine'), 'COMP');
    assert.equal(normalizeReason('Fine'), 'COMP');
  });

  it('maps spoilage variants', () => {
    assert.equal(normalizeReason('Spoilage'), 'SPOIL');
    assert.equal(normalizeReason('spoilage'), 'SPOIL');
    assert.equal(normalizeReason('Spoiled'), 'SPOIL');
  });

  it('maps unsaleables variants', () => {
    assert.equal(normalizeReason('Unsaleables'), 'UNSAL');
    assert.equal(normalizeReason('unsaleables'), 'UNSAL');
    assert.equal(normalizeReason('Unsaleable'), 'UNSAL');
    assert.equal(normalizeReason('Unsalables'), 'UNSAL');
  });

  it('maps bill back variants', () => {
    assert.equal(normalizeReason('Bill Back'), 'MCB');
    assert.equal(normalizeReason('Billback'), 'MCB');
    assert.equal(normalizeReason('MCB'), 'MCB');
  });

  it('maps promo variants', () => {
    assert.equal(normalizeReason('Promotional Allowance'), 'PROMO');
    assert.equal(normalizeReason('Promo'), 'PROMO');
  });

  it('returns OTHER for misc/null/unknown', () => {
    assert.equal(normalizeReason(null), 'OTHER');
    assert.equal(normalizeReason(undefined), 'OTHER');
    assert.equal(normalizeReason(''), 'OTHER');
    assert.equal(normalizeReason('???'), 'OTHER');
    assert.equal(normalizeReason('N/A'), 'OTHER');
    assert.equal(normalizeReason('misc'), 'OTHER');
    assert.equal(normalizeReason('Other'), 'OTHER');
  });
});

// ── parseDeleted ──

describe('parseDeleted', () => {
  it('returns true for truthy values', () => {
    assert.equal(parseDeleted(true), true);
    assert.equal(parseDeleted(1), true);
    assert.equal(parseDeleted('true'), true);
    assert.equal(parseDeleted('1'), true);
  });

  it('returns false for falsy/other values', () => {
    assert.equal(parseDeleted(false), false);
    assert.equal(parseDeleted(0), false);
    assert.equal(parseDeleted('false'), false);
    assert.equal(parseDeleted('0'), false);
    assert.equal(parseDeleted(null), false);
    assert.equal(parseDeleted(undefined), false);
    assert.equal(parseDeleted('null'), false);
  });
});

// ── getField ──

describe('getField', () => {
  it('returns first defined key', () => {
    assert.equal(getField({ retailer_name: 'Walmart' }, 'retailer_name', 'retailer'), 'Walmart');
    assert.equal(getField({ retailer: 'kehe' }, 'retailer_name', 'retailer'), 'kehe');
  });

  it('returns undefined when no key matches', () => {
    assert.equal(getField({ foo: 'bar' }, 'retailer_name', 'retailer'), undefined);
  });

  it('returns first key even if value is null', () => {
    assert.equal(getField({ amount: null, total_amount: 100 }, 'amount', 'total_amount'), null);
  });

  it('skips undefined, takes next', () => {
    assert.equal(getField({ total_amount: 42.5 }, 'amount', 'total_amount'), 42.5);
  });
});
