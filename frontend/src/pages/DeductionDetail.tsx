import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Plus } from 'lucide-react';
import { apiFetch, formatCents, formatDate, formatTimestamp } from '#lib/api';
import { statusStyle, statusBadge, statusLabel } from '#lib/status';
import { toastSuccess, toastError } from '#lib/toast';
import { Button } from '#components/ui/button';
import { Badge } from '#components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card';
import { Input } from '#components/ui/input';
import { Separator } from '#components/ui/separator';
import { Skeleton } from '#components/ui/skeleton';
import { Textarea } from '#components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog';

interface Dispute {
  id: number;
  status: string;
  amount_disputed_cents: number;
  amount_recovered_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  activity_log: {
    id: number;
    from_status: string | null;
    to_status: string;
    note: string | null;
    created_at: string;
  }[];
}

interface DeductionDetail {
  id: number;
  company_id: number;
  retailer_id: number;
  reason_code: string;
  invoice_number: string | null;
  amount_cents: number | null;
  amount_remaining_cents: number | null;
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
  disputes: Dispute[];
}

type TransitionKind = 'in_review' | 'submitted' | 'accepted' | 'partial' | 'rejected';

const TRANSITION_CONFIG: Record<TransitionKind, { title: string; description: string }> = {
  in_review: { title: 'Move to In Review', description: 'Begin reviewing this dispute internally.' },
  submitted: { title: 'Submit to Retailer', description: 'Mark this dispute as submitted to the retailer.' },
  accepted: { title: 'Accept — Full Recovery', description: 'The retailer accepted the full disputed amount.' },
  partial: { title: 'Partial Recovery', description: 'The retailer agreed to a partial recovery. Enter the recovered amount.' },
  rejected: { title: 'Reject Dispute', description: 'The retailer rejected this dispute.' },
};

const TERMINAL = new Set(['accepted', 'partial', 'rejected']);

export default function DeductionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<DeductionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDisputeId, setActiveDisputeId] = useState<number | null>(null);
  const [transitionKind, setTransitionKind] = useState<TransitionKind | null>(null);
  const [dialogNotes, setDialogNotes] = useState('');
  const [dialogAmount, setDialogAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createNotes, setCreateNotes] = useState('');

  const refetch = useCallback(() => {
    apiFetch<DeductionDetail>(`/api/deductions/${id}`)
      .then(setData)
      .catch((e) => {
        setError(e.message);
        toastError(`Failed to load deduction: ${e.message}`);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const hasPriorResolved = (data?.disputes ?? []).some((d) => TERMINAL.has(d.status));

  function handleCreateClick() {
    if (hasPriorResolved) {
      setCreateNotes('');
      setCreateDialogOpen(true);
    } else {
      submitCreate('');
    }
  }

  function submitCreate(notes: string) {
    if (!data) return;
    setCreating(true);
    apiFetch<any>(`/api/deductions/${data.id}/dispute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
      .then(() => {
        setCreateDialogOpen(false);
        toastSuccess('Dispute created');
        refetch();
      })
      .catch((e) => toastError(`Failed to create dispute: ${e.message}`))
      .finally(() => setCreating(false));
  }

  function openTransition(disputeId: number, kind: TransitionKind, dispute: Dispute) {
    setActiveDisputeId(disputeId);
    setTransitionKind(kind);
    setDialogNotes('');
    if (kind === 'partial') {
      setDialogAmount((dispute.amount_disputed_cents / 100).toFixed(2));
    } else {
      setDialogAmount('');
    }
    setDialogOpen(true);
  }

  function submitTransition() {
    if (!activeDisputeId || !transitionKind) return;
    const dispute = data?.disputes.find((d) => d.id === activeDisputeId);
    if (!dispute) return;
    setSubmitting(true);

    const body: Record<string, any> = {
      status: transitionKind,
      notes: dialogNotes || undefined,
    };

    if (transitionKind === 'accepted') {
      body.amount_recovered_cents = dispute.amount_disputed_cents;
    } else if (transitionKind === 'partial') {
      const dollars = parseFloat(dialogAmount);
      if (isNaN(dollars) || dollars <= 0) {
        setSubmitting(false);
        toastError('Enter a valid recovery amount');
        return;
      }
      body.amount_recovered_cents = Math.round(dollars * 100);
    }

    apiFetch(`/api/disputes/${activeDisputeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(() => {
        setDialogOpen(false);
        const label = statusLabel(transitionKind);
        toastSuccess(`Dispute moved to ${label}`);
        refetch();
      })
      .catch((e) => toastError(`Transition failed: ${e.message}`))
      .finally(() => setSubmitting(false));
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/deductions')}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="mb-3 size-6 text-status-rejected" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setError(null); setLoading(true); refetch(); }}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><Skeleton className="h-5 w-16" /></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i}>
                    <Skeleton className="mb-1 h-3 w-20" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const remaining = data.amount_remaining_cents ?? data.amount_cents ?? 0;
  const hasOpenDispute = data.disputes.some((d) => !TERMINAL.has(d.status));
  const fullyRecovered = remaining <= 0;
  const canDisputeMore = !fullyRecovered && !hasOpenDispute;

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
            className="inline-flex items-center gap-1 rounded-full bg-status-active/15 px-2.5 py-0.5 text-xs font-medium text-status-active-fg"
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
                <dd className="font-mono tabular-nums text-lg font-semibold">{formatCents(data.amount_cents)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Remaining</dt>
                <dd className={`font-mono tabular-nums text-lg font-semibold ${fullyRecovered ? 'text-status-accepted-fg' : ''}`}>
                  {formatCents(remaining)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    of {formatCents(data.amount_cents)}
                  </span>
                </dd>
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
                    <span className="ml-2 text-xs text-slate-accent-fg">Typically disputable</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Original Status (source data)</dt>
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
                <div className="rounded-md bg-status-active/8 p-3 text-sm">
                  <span className="font-medium text-status-active-fg">Data issues: </span>
                  <span className="text-status-active-fg/85">{data.data_issue_notes}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Dispute History</CardTitle>
            {canDisputeMore && data.disputes.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleCreateClick} disabled={creating}>
                <Plus className="size-3.5 mr-1" />
                {creating ? 'Creating...' : 'Dispute Remaining'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {fullyRecovered && data.disputes.length > 0 && (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-status-accepted/35 bg-status-accepted/12 p-3 text-sm font-medium text-status-accepted-fg">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  Fully recovered — <span className="font-mono tabular-nums">{formatCents(data.amount_cents)}</span> back in full
                </span>
              </div>
            )}

            {data.disputes.length > 0 ? (
              <div className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[6px] before:w-px before:bg-border before:content-['']">
                {data.disputes.map((dispute, i) => {
                  const isTerminal = TERMINAL.has(dispute.status);
                  const st = statusStyle(dispute.status);
                  return (
                    <div key={dispute.id} className="relative flex gap-3">
                      <span
                        className={`relative z-10 mt-1.5 size-3 shrink-0 rounded-full ring-4 ring-card ${st.dot}`}
                      />
                      <div className={`min-w-0 flex-1 rounded-lg border p-3 ${st.tint}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            Attempt {data.disputes.length - i}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(
                              dispute.status
                            )}`}
                          >
                            {statusLabel(dispute.status)}
                          </span>
                          {isTerminal && dispute.status === 'accepted' && (
                            <CheckCircle2 className="size-4 text-status-accepted" />
                          )}
                          {isTerminal && dispute.status === 'rejected' && (
                            <XCircle className="size-4 text-status-rejected" />
                          )}
                        </div>

                        <dl className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Disputed</dt>
                            <dd className="font-mono tabular-nums font-medium">{formatCents(dispute.amount_disputed_cents)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Recovered</dt>
                            <dd className="font-mono tabular-nums font-medium">{formatCents(dispute.amount_recovered_cents)}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-muted-foreground">Created</dt>
                            <dd>{formatTimestamp(dispute.created_at)}</dd>
                          </div>
                          {dispute.resolved_at && (
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Resolved</dt>
                              <dd>{formatTimestamp(dispute.resolved_at)}</dd>
                            </div>
                          )}
                        </dl>

                        {isTerminal && (
                          <div className={`mt-3 flex items-start gap-1.5 text-xs font-medium ${
                            dispute.status === 'accepted'
                              ? 'text-status-accepted-fg'
                              : dispute.status === 'partial'
                                ? 'text-status-partial-fg'
                                : 'text-status-rejected-fg'
                          }`}>
                            {dispute.status === 'accepted' && (
                              <span>Fully recovered <span className="font-mono tabular-nums">{formatCents(dispute.amount_recovered_cents)}</span></span>
                            )}
                            {dispute.status === 'partial' && (
                              <span>Partially recovered <span className="font-mono tabular-nums">{formatCents(dispute.amount_recovered_cents)}</span> of <span className="font-mono tabular-nums">{formatCents(dispute.amount_disputed_cents)}</span></span>
                            )}
                            {dispute.status === 'rejected' && <span>Rejected by retailer</span>}
                          </div>
                        )}

                        {!isTerminal && (
                          <div className="flex flex-wrap gap-2 pt-3">
                            {dispute.status === 'new' && (
                              <Button size="sm" onClick={() => openTransition(dispute.id, 'in_review', dispute)}>
                                Move to In Review
                              </Button>
                            )}
                            {dispute.status === 'in_review' && (
                              <Button size="sm" onClick={() => openTransition(dispute.id, 'submitted', dispute)}>
                                Submit to Retailer
                              </Button>
                            )}
                            {dispute.status === 'submitted' && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-status-accepted text-white hover:bg-status-accepted/85"
                                  onClick={() => openTransition(dispute.id, 'accepted', dispute)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openTransition(dispute.id, 'partial', dispute)}
                                >
                                  Partial Recovery
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openTransition(dispute.id, 'rejected', dispute)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        )}

                        {dispute.activity_log.length > 0 && (
                          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                            <h4 className="text-xs font-medium text-muted-foreground">Activity</h4>
                            {dispute.activity_log.map((a) => (
                              <div key={a.id} className="flex items-start gap-2 text-xs">
                                <span className="shrink-0 text-muted-foreground">
                                  {formatTimestamp(a.created_at)}
                                </span>
                                <span>
                                  {a.from_status ? `${statusLabel(a.from_status)} → ` : ''}
                                  {statusLabel(a.to_status)}
                                  {a.note && <span className="text-muted-foreground"> — {a.note}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">No dispute filed yet.</p>
                {data.typically_disputable === 1 && (
                  <p className="text-xs text-slate-accent-fg">
                    This deduction is typically disputable.
                  </p>
                )}
                <Button size="sm" onClick={handleCreateClick} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Dispute'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {transitionKind && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{TRANSITION_CONFIG[transitionKind].title}</DialogTitle>
              <DialogDescription>{TRANSITION_CONFIG[transitionKind].description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {transitionKind === 'partial' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Recovery Amount ($) <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={dialogAmount}
                    onChange={(e) => setDialogAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Notes {transitionKind !== 'partial' && <span className="text-muted-foreground font-normal">(optional)</span>}
                </label>
                <Textarea
                  value={dialogNotes}
                  onChange={(e) => setDialogNotes(e.target.value)}
                  placeholder="Add a note about this transition..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button
                onClick={submitTransition}
                disabled={submitting || (transitionKind === 'partial' && (!dialogAmount || parseFloat(dialogAmount) <= 0))}
                className={
                  transitionKind === 'accepted'
                    ? 'bg-status-accepted text-white hover:bg-status-accepted/85'
                    : ''
                }
                variant={transitionKind === 'rejected' ? 'destructive' : 'default'}
              >
                {submitting ? 'Saving...' : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Remaining Balance</DialogTitle>
            <DialogDescription>
              This deduction has a prior resolved dispute. Explain why you're opening a new one.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Notes <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="Why are you re-disputing? (e.g. pursuing remaining balance, new evidence, retailer error)"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={() => submitCreate(createNotes)}
              disabled={creating || !createNotes.trim()}
            >
              {creating ? 'Creating...' : 'Create Dispute'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
