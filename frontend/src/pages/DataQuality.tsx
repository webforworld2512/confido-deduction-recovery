import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCompany } from '#lib/CompanyContext';
import { apiFetch, formatCents, formatDate } from '#lib/api';
import { Card, CardContent } from '#components/ui/card';
import { Button } from '#components/ui/button';
import { Skeleton } from '#components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#components/ui/table';

interface IssueType {
  type: string;
  count: number;
}

interface FlaggedRecord {
  id: number;
  invoice_number: string | null;
  amount_cents: number | null;
  deducted_at: string | null;
  data_issue_notes: string;
  company_name: string;
  retailer_name: string;
  reason_label: string;
  reason_category: string;
}

interface DataQualityData {
  total_flagged: number;
  issue_types: IssueType[];
  records: FlaggedRecord[];
  total: number;
  page: number;
  limit: number;
}

const ISSUE_LABELS: Record<string, string> = {
  amount: 'Amount issues',
  date: 'Date issues',
  company: 'Company issues',
  retailer: 'Retailer issues',
};

export default function DataQuality() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [data, setData] = useState<DataQualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [issueFilter, setIssueFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (selectedCompanyId != null) params.set('company_id', String(selectedCompanyId));
    if (issueFilter) params.set('issue_type', issueFilter);
    apiFetch<DataQualityData>(`/api/data-quality?${params}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [selectedCompanyId, issueFilter, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [selectedCompanyId, issueFilter]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Data quality</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.total_flagged} flagged record{data.total_flagged !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <Skeleton className="mb-2 h-8 w-16" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {data.issue_types.map((it) => {
            const active = issueFilter === it.type;
            return (
              <Card
                key={it.type}
                className={`cursor-pointer transition-colors ${active ? 'border-slate-accent ring-1 ring-slate-accent/30' : 'hover:border-border/80'}`}
                onClick={() => setIssueFilter(active ? null : it.type)}
              >
                <CardContent className="pt-5">
                  <div className="text-2xl font-bold tabular-nums">{it.count}</div>
                  <p className="text-xs text-muted-foreground">{ISSUE_LABELS[it.type] ?? it.type}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {issueFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Showing: <span className="font-medium text-foreground">{ISSUE_LABELS[issueFilter] ?? issueFilter}</span>
          </span>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setIssueFilter(null)}>
            Clear filter
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Retailer</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Issues</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data || data.records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <AlertTriangle className="size-5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {issueFilter ? 'No records match this issue type.' : 'No data quality issues found.'}
                    </p>
                    {issueFilter && (
                      <Button variant="ghost" size="sm" onClick={() => setIssueFilter(null)}>
                        Clear filter
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.records.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/deductions/${r.id}`)}
                >
                  <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(r.deducted_at)}</TableCell>
                  <TableCell>{r.retailer_name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.invoice_number ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums whitespace-nowrap">
                    {formatCents(r.amount_cents)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.data_issue_notes.split('; ').map((note, i) => (
                        <span
                          key={i}
                          className="inline-flex rounded-full bg-status-active/12 px-2 py-0.5 text-[11px] font-medium text-status-active-fg"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
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

      {data && totalPages > 1 && (
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
