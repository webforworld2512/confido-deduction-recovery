export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function formatCents(cents: number | null | undefined): string {
  if (cents == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function formatCentsAbbrev(cents: number | null | undefined): { abbrev: string; full: string } {
  const full = formatCents(cents);
  if (cents == null) return { abbrev: full, full };
  const dollars = Math.abs(cents) / 100;
  if (dollars >= 1_000_000) {
    return { abbrev: `$${(dollars / 1_000_000).toFixed(1)}M`, full };
  }
  if (dollars >= 100_000) {
    return { abbrev: `$${(dollars / 1_000).toFixed(1)}K`, full };
  }
  return { abbrev: full, full };
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts.includes('T') ? ts : ts + 'Z');
  if (isNaN(d.getTime())) return ts;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d);
}
