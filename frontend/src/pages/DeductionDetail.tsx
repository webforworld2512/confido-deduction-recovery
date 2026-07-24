import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { apiFetch, formatCents, formatDate } from '#lib/api';
import { Button } from '#components/ui/button';
import { Badge } from '#components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card';
import { Separator } from '#components/ui/separator';

interface DeductionDetail {
  id: number;
  company_id: number;
  retailer_id: number;
  reason_code: string;
  invoice_number: string | null;
  amount_cents: number | null;
  deducted_at: string | null;
  original_status: string | null;
  original_retailer_name: string | null;
  has_data_issues: number;
  data_issue_notes: string | null;
  company_name: string;
  company_slug: string | null;
  erp_system: string | null;
  default_currency: string | null;
  retailer_name: string;
  retailer_type: string | null;
  retailer_region: string | null;
  reason_label: string;
  reason_category: string;
  typically_disputable: number;
  dispute: {
    id: number;
    status: string;
    amount_disputed_cents: number;
    amount_recovered_cents: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
  } | null;
  activity_log: {
    id: number;
    from_status: string | null;
    to_status: string;
    note: string | null;
    created_at: string;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
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

export default function DeductionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DeductionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch<DeductionDetail>(`/api/deductions/${id}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  function createDispute() {
    if (!data) return;
    setCreating(true);
    apiFetch<any>(`/api/deductions/${data.id}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: '' }),
    })
      .then(() => apiFetch<DeductionDetail>(`/api/deductions/${id}`))
      .then(setData)
      .finally(() => setCreating(false));
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/deductions')}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/deductions')}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Deduction #{data.id}
        </h1>
        {data.has_data_issues === 1 && (
          <span
            title={data.data_issue_notes ?? ''}
            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          >
            <AlertTriangle className="size-3" /> Data issues
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="font-medium">{data.company_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Retailer</dt>
                <dd className="font-medium">
                  {data.retailer_name}
                  {data.retailer_type && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {data.retailer_type} / {data.retailer_region}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-mono text-lg font-semibold">{formatCents(data.amount_cents)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(data.deducted_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Invoice #</dt>
                <dd className="font-mono">{data.invoice_number ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reason</dt>
                <dd>
                  <Badge variant="secondary">{data.reason_label}</Badge>
                  {data.typically_disputable === 1 && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400">Typically disputable</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Original Status</dt>
                <dd>{data.original_status ?? '—'}</dd>
              </div>
              {data.original_retailer_name && data.original_retailer_name !== data.retailer_name && (
                <div>
                  <dt className="text-muted-foreground">Original Retailer Name</dt>
                  <dd className="text-xs text-muted-foreground">{data.original_retailer_name}</dd>
                </div>
              )}
            </dl>
            {data.data_issue_notes && (
              <>
                <Separator className="my-4" />
                <div className="rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
                  <span className="font-medium text-amber-800 dark:text-amber-200">Data issues: </span>
                  <span className="text-amber-700 dark:text-amber-300">{data.data_issue_notes}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dispute</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dispute ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      STATUS_COLORS[data.dispute.status] ?? ''
                    }`}
                  >
                    {statusLabel(data.dispute.status)}
                  </span>
                </div>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Amount Disputed</dt>
                    <dd className="font-mono font-medium">
                      {formatCents(data.dispute.amount_disputed_cents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Amount Recovered</dt>
                    <dd className="font-mono font-medium">
                      {formatCents(data.dispute.amount_recovered_cents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{new Date(data.dispute.created_at).toLocaleDateString()}</dd>
                  </div>
                  {data.dispute.resolved_at && (
                    <div>
                      <dt className="text-muted-foreground">Resolved</dt>
                      <dd>{new Date(data.dispute.resolved_at).toLocaleDateString()}</dd>
                    </div>
                  )}
                  {data.dispute.notes && (
                    <div>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd className="text-muted-foreground">{data.dispute.notes}</dd>
                    </div>
                  )}
                </dl>

                {data.activity_log.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Activity Log</h4>
                      {data.activity_log.map((a) => (
                        <div key={a.id} className="flex items-start gap-2 text-xs">
                          <span className="shrink-0 text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString()}
                          </span>
                          <span>
                            {a.from_status ? `${statusLabel(a.from_status)} → ` : ''}
                            {statusLabel(a.to_status)}
                            {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">No dispute filed yet.</p>
                {data.typically_disputable === 1 && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    This deduction is typically disputable.
                  </p>
                )}
                <Button size="sm" onClick={createDispute} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Dispute'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
