import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
import { useCompany } from '#lib/CompanyContext';
import { apiFetch, formatCents, formatDate } from '#lib/api';
import { reasonBadge, statusBadge, statusLabel } from '#lib/status';
import { toastSuccess, toastError } from '#lib/toast';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Skeleton } from '#components/ui/skeleton';
import { Switch } from '#components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table';

interface Deduction {
  id: number;
  company_id: number;
  retailer_id: number;
  reason_code: string;
  invoice_number: string | null;
  amount_cents: number | null;
  deducted_at: string | null;
  original_status: string | null;
  has_data_issues: number;
  data_issue_notes: string | null;
  company_name: string;
  retailer_name: string;
  retailer_type: string | null;
  retailer_region: string | null;
  reason_label: string;
  reason_category: string;
  typically_disputable: number;
  dispute_id: number | null;
  dispute_status: string | null;
}

interface Retailer {
  id: number;
  canonical_name: string;
  type: string | null;
  region: string | null;
}

interface ReasonOption {
  code: string;
  label: string;
}

interface UndisputedDisputable {
  count: number;
  amount: number;
}

export default function DeductionList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();

  const [data, setData] = useState<Deduction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const limit = 25;

  const [retailerId, setRetailerId] = useState<string>('all');
  const [reasonCode, setReasonCode] = useState<string>('all');
  const [disputeFilter, setDisputeFilter] = useState<string>('all');
  const [disputableOnly, setDisputableOnly] = useState(false);
  const [search, setSearch] = useState('');

  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [reasons, setReasons] = useState<ReasonOption[]>([]);
  const [undisputed, setUndisputed] = useState<UndisputedDisputable | null>(null);

  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    apiFetch<{ data: Retailer[] }>('/api/retailers').then((r) => setRetailers(r.data));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId != null) params.set('company_id', String(selectedCompanyId));
    apiFetch<{ by_reason: any[]; undisputed_disputable: UndisputedDisputable }>(
      `/api/dashboard?${params}`
    ).then((d) => {
      setReasons(
        d.by_reason.map((r) => ({ code: r.code, label: r.reason }))
      );
      setUndisputed(d.undisputed_disputable);
    });
  }, [selectedCompanyId]);

  function buildFilterParams() {
    const params = new URLSearchParams();
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);
    if (selectedCompanyId != null) params.set('company_id', String(selectedCompanyId));
    if (retailerId !== 'all') params.set('retailer_id', retailerId);
    if (reasonCode !== 'all') params.set('reason_code', reasonCode);
    if (disputeFilter === 'disputed') params.set('has_dispute', 'true');
    if (disputeFilter === 'undisputed') params.set('has_dispute', 'false');
    if (disputableOnly) params.set('typically_disputable', 'true');
    if (search.trim()) params.set('search', search.trim());
    return params;
  }

  const fetchDeductions = useCallback(() => {
    setLoading(true);
    const params = buildFilterParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    apiFetch<{ data: Deduction[]; total: number }>(`/api/deductions?${params}`)
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch(() => toastError('Failed to load deductions'))
      .finally(() => setLoading(false));
  }, [page, sortBy, sortOrder, selectedCompanyId, retailerId, reasonCode, disputeFilter, disputableOnly, search]);

  useEffect(() => {
    fetchDeductions();
  }, [fetchDeductions]);

  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, retailerId, reasonCode, disputeFilter, disputableOnly, search]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const hasActiveFilters = search !== '' || retailerId !== 'all' || reasonCode !== 'all' || disputeFilter !== 'all' || disputableOnly;

  function resetFilters() {
    setSearch('');
    setRetailerId('all');
    setReasonCode('all');
    setDisputeFilter('all');
    setDisputableOnly(false);
  }

  function handleSort(col: 'date' | 'amount') {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  }

  function sortIndicator(col: 'date' | 'amount') {
    if (sortBy !== col) return null;
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = buildFilterParams();
      params.set('page', '1');
      params.set('limit', '10000');
      const res = await apiFetch<{ data: Deduction[] }>(`/api/deductions?${params}`);

      const headers = [
        'ID', 'Date', 'Invoice #', 'Company', 'Retailer', 'Retailer Type', 'Retailer Region',
        'Reason', 'Reason Category', 'Amount', 'Dispute Status', 'Disputable',
        'Has Data Issues', 'Data Issue Notes',
      ];

      const rows = res.data.map((d) => [
        d.id,
        d.deducted_at ?? '',
        d.invoice_number ?? '',
        d.company_name,
        d.retailer_name,
        d.retailer_type ?? '',
        d.retailer_region ?? '',
        d.reason_label,
        d.reason_category,
        d.amount_cents != null ? (d.amount_cents / 100).toFixed(2) : '',
        d.dispute_status ? statusLabel(d.dispute_status) : '',
        d.typically_disputable ? 'Yes' : 'No',
        d.has_data_issues ? 'Yes' : 'No',
        d.data_issue_notes ?? '',
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => {
          const str = String(cell);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deductions-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toastSuccess(`Exported ${res.data.length} deductions`);
    } catch {
      toastError('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Deductions</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || total === 0}>
            <Download className="mr-1 size-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {undisputed && undisputed.count > 0 && !disputableOnly && (
        <div className="flex items-center gap-3 rounded-lg border border-status-active/30 bg-status-active/8 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-status-active" />
          <div className="text-sm">
            <span className="font-medium text-status-active-fg">
              {undisputed.count} disputable deductions
            </span>{' '}
            <span className="text-status-active-fg/85">
              totaling <span className="tabular-nums">{formatCents(undisputed.amount)}</span> have not been disputed yet.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto shrink-0"
            onClick={() => {
              setDisputableOnly(true);
              setDisputeFilter('undisputed');
            }}
          >
            Show them
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search invoice #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 pl-8"
          />
        </div>

        <Select
          value={retailerId}
          onValueChange={(v: string) => setRetailerId(v)}
          items={{ all: 'All Retailers', ...Object.fromEntries(retailers.map((r) => [r.id.toString(), r.canonical_name])) }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Retailers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Retailers</SelectItem>
            {retailers.map((r) => (
              <SelectItem key={r.id} value={r.id.toString()}>
                {r.canonical_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={reasonCode}
          onValueChange={(v: string) => setReasonCode(v)}
          items={{ all: 'All Reasons', ...Object.fromEntries(reasons.map((r) => [r.code, r.label])) }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Reasons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reasons</SelectItem>
            {reasons.map((r) => (
              <SelectItem key={r.code} value={r.code}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={disputeFilter}
          onValueChange={(v: string) => setDisputeFilter(v)}
          items={{ all: 'All', disputed: 'Disputed', undisputed: 'Undisputed' }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Dispute Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
            <SelectItem value="undisputed">Undisputed</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            checked={disputableOnly}
            onCheckedChange={setDisputableOnly}
            id="disputable-toggle"
          />
          <label htmlFor="disputable-toggle" className="text-sm text-muted-foreground cursor-pointer">
            Disputable only
          </label>
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={resetFilters}
          >
            <X className="mr-1 size-3" />
            Reset filters
          </Button>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort('date')}
              >
                Date{sortIndicator('date')}
              </TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Retailer</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead
                className="cursor-pointer select-none text-right"
                onClick={() => handleSort('amount')}
              >
                Amount{sortIndicator('amount')}
              </TableHead>
              <TableHead>Dispute</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="size-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hasActiveFilters
                        ? 'No deductions match these filters.'
                        : 'No deductions found.'}
                    </p>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={resetFilters}>
                        <X className="mr-1 size-3" />
                        Reset filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/deductions/${d.id}`)}
                >
                  <TableCell className="whitespace-nowrap">{formatDate(d.deducted_at)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.invoice_number ?? '—'}
                  </TableCell>
                  <TableCell>{d.retailer_name}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${reasonBadge(
                        d.reason_category
                      )}`}
                    >
                      {d.reason_label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">
                    {formatCents(d.amount_cents)}
                  </TableCell>
                  <TableCell>
                    {d.dispute_status ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(
                          d.dispute_status
                        )}`}
                      >
                        {statusLabel(d.dispute_status)}
                      </span>
                    ) : d.typically_disputable ? (
                      <span className="inline-flex items-center rounded-full border border-slate-accent/40 px-2 py-0.5 text-xs font-medium text-slate-accent-fg">
                        Disputable
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
