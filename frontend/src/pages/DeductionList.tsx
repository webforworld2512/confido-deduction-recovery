import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useCompany } from '#lib/CompanyContext';
import { apiFetch, formatCents, formatDate } from '#lib/api';
import { Badge } from '#components/ui/badge';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
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

const REASON_CATEGORY_COLORS: Record<string, string> = {
  Pricing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Logistics: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Compliance: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  Promotional: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Financial: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const DISPUTE_STATUS_COLORS: Record<string, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  in_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  submitted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  partial: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DeductionList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();

  const [data, setData] = useState<Deduction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
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

  const fetchDeductions = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    params.set('sort_by', sortBy);
    params.set('sort_order', sortOrder);

    if (selectedCompanyId != null) params.set('company_id', String(selectedCompanyId));
    if (retailerId !== 'all') params.set('retailer_id', retailerId);
    if (reasonCode !== 'all') params.set('reason_code', reasonCode);
    if (disputeFilter === 'disputed') params.set('has_dispute', 'true');
    if (disputeFilter === 'undisputed') params.set('has_dispute', 'false');
    if (disputableOnly) params.set('typically_disputable', 'true');
    if (search.trim()) params.set('search', search.trim());

    apiFetch<{ data: Deduction[]; total: number }>(`/api/deductions?${params}`)
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, sortBy, sortOrder, selectedCompanyId, retailerId, reasonCode, disputeFilter, disputableOnly, search]);

  useEffect(() => {
    fetchDeductions();
  }, [fetchDeductions]);

  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, retailerId, reasonCode, disputeFilter, disputableOnly, search]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Deductions</h1>
        <span className="text-sm text-muted-foreground">{total.toLocaleString()} total</span>
      </div>

      {undisputed && undisputed.count > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-200">
              {undisputed.count} disputable deductions
            </span>{' '}
            <span className="text-amber-700 dark:text-amber-300">
              totaling {formatCents(undisputed.amount)} have not been disputed yet.
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
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No deductions found.
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
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        REASON_CATEGORY_COLORS[d.reason_category] ?? REASON_CATEGORY_COLORS['Other']
                      }`}
                    >
                      {d.reason_label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono whitespace-nowrap">
                    {formatCents(d.amount_cents)}
                  </TableCell>
                  <TableCell>
                    {d.dispute_status ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          DISPUTE_STATUS_COLORS[d.dispute_status] ?? ''
                        }`}
                      >
                        {statusLabel(d.dispute_status)}
                      </span>
                    ) : d.typically_disputable ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Disputable
                      </Badge>
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
