// Centralized status → color mapping so every surface (badges, timeline,
// dashboard cards, charts) draws from one coherent palette.

type StatusStyle = {
  badge: string; // tinted pill: background + readable text
  tint: string; // low-opacity card background + border, for timeline cards
  dot: string; // solid accent, for timeline dots / chart marks
  stroke: string; // raw color value, for recharts fills/strokes
};

const STATUS_STYLES: Record<string, StatusStyle> = {
  new: {
    badge: 'bg-status-new/15 text-status-new-fg',
    tint: 'bg-status-new/8 border-status-new/30',
    dot: 'bg-status-new',
    stroke: 'var(--status-new)',
  },
  in_review: {
    badge: 'bg-status-active/15 text-status-active-fg',
    tint: 'bg-status-active/8 border-status-active/30',
    dot: 'bg-status-active',
    stroke: 'var(--status-active)',
  },
  submitted: {
    badge: 'bg-status-active/15 text-status-active-fg',
    tint: 'bg-status-active/8 border-status-active/30',
    dot: 'bg-status-active',
    stroke: 'var(--status-active)',
  },
  accepted: {
    badge: 'bg-status-accepted/15 text-status-accepted-fg',
    tint: 'bg-status-accepted/10 border-status-accepted/35',
    dot: 'bg-status-accepted',
    stroke: 'var(--status-accepted)',
  },
  partial: {
    badge: 'bg-status-partial/18 text-status-partial-fg',
    tint: 'bg-status-partial/10 border-status-partial/35',
    dot: 'bg-status-partial',
    stroke: 'var(--status-partial)',
  },
  rejected: {
    badge: 'bg-status-rejected/15 text-status-rejected-fg',
    tint: 'bg-status-rejected/10 border-status-rejected/35',
    dot: 'bg-status-rejected',
    stroke: 'var(--status-rejected)',
  },
};

const FALLBACK: StatusStyle = {
  badge: 'bg-muted text-muted-foreground',
  tint: 'bg-muted/40 border-border',
  dot: 'bg-muted-foreground',
  stroke: 'var(--muted-foreground)',
};

export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? FALLBACK;
}

export function statusBadge(status: string): string {
  return statusStyle(status).badge;
}

export function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Deduction reason categories → the same muted palette, so table badges
// read as one system rather than picking random saturated colors.
export const REASON_CATEGORY_BADGE: Record<string, string> = {
  Pricing: 'bg-slate-accent/12 text-slate-accent-fg',
  Logistics: 'bg-status-active/14 text-status-active-fg',
  Compliance: 'bg-status-new/15 text-status-new-fg',
  Promotional: 'bg-status-accepted/14 text-status-accepted-fg',
  Financial: 'bg-status-rejected/14 text-status-rejected-fg',
  Other: 'bg-muted text-muted-foreground',
};

export function reasonBadge(category: string): string {
  return REASON_CATEGORY_BADGE[category] ?? REASON_CATEGORY_BADGE['Other'];
}
