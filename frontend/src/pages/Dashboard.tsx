import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, Scale, TrendingUp } from 'lucide-react';
import { useCompany } from '#lib/CompanyContext';
import { apiFetch, formatCents } from '#lib/api';
import { toastError } from '#lib/toast';
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card';
import { Skeleton } from '#components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { statusStyle, statusLabel } from '#lib/status';

interface DashboardData {
  total_deductions_count: number;
  total_deductions_amount: number;
  disputed_count: number;
  disputed_amount: number;
  recovered_amount: number;
  recovery_rate: number;
  by_status: { status: string; count: number; amount: number }[];
  by_retailer: { retailer: string; count: number; amount: number; disputed: number; recovered: number }[];
  by_reason: { reason: string; code: string; count: number; amount: number; typically_disputable: number }[];
  undisputed_disputable: { count: number; amount: number };
  recovery_timeline: { week: string; recovered: number; cumulative: number }[];
}

export default function Dashboard() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCompanyId != null) params.set('company_id', String(selectedCompanyId));
    apiFetch<DashboardData>(`/api/dashboard?${params}`)
      .then(setData)
      .catch(() => toastError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="mb-1 h-8 w-28" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-20" /></div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data || data.total_deductions_count === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {selectedCompanyId != null
                ? 'No deductions found for this company.'
                : 'No deductions found. Seed the database to get started.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Deductions',
      value: formatCents(data.total_deductions_amount),
      sub: `${data.total_deductions_count} deductions`,
      icon: FileText,
      border: 'border-t-slate-accent',
      iconColor: 'text-slate-accent',
    },
    {
      title: 'Disputed',
      value: formatCents(data.disputed_amount),
      sub: `${data.disputed_count} disputes`,
      icon: Scale,
      border: 'border-t-status-new',
      iconColor: 'text-status-new',
    },
    {
      title: 'Recovered',
      value: formatCents(data.recovered_amount),
      sub: `${(data.recovery_rate * 100).toFixed(1)}% recovery rate`,
      icon: DollarSign,
      border: 'border-t-status-accepted',
      iconColor: 'text-status-accepted',
    },
    {
      title: 'Undisputed Disputable',
      value: formatCents(data.undisputed_disputable.amount),
      sub: `${data.undisputed_disputable.count} deductions`,
      icon: TrendingUp,
      border: 'border-t-status-active',
      iconColor: 'text-status-active',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className={`border-t-[3px] ${c.border}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`size-4 ${c.iconColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{c.value}</div>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top retailers by amount</CardTitle>
          </CardHeader>
          <CardContent>
            {data.by_retailer.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No retailer data.</p>
            ) : (
              <div className="space-y-3">
                {data.by_retailer.slice(0, 8).map((r) => {
                  const pct = data.total_deductions_amount > 0
                    ? (r.amount / data.total_deductions_amount) * 100
                    : 0;
                  return (
                    <div key={r.retailer} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{r.retailer}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">{formatCents(r.amount)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-slate-accent"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By reason</CardTitle>
          </CardHeader>
          <CardContent>
            {data.by_reason.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No reason data.</p>
            ) : (
              <div className="space-y-2">
                {data.by_reason.map((r) => (
                  <div key={r.code} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="truncate">{r.reason}</span>
                      {r.typically_disputable === 1 && (
                        <span className="shrink-0 rounded border border-slate-accent/40 px-1.5 py-0.5 text-[10px] font-medium text-slate-accent-fg">
                          Disputable
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums text-muted-foreground">{r.count}</span>
                      <span className="text-right font-mono tabular-nums whitespace-nowrap">{formatCents(r.amount)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {data.by_status.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disputes by status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {data.by_status.map((s) => {
                const st = statusStyle(s.status);
                return (
                  <div
                    key={s.status}
                    className={`flex flex-col items-center rounded-lg border px-6 py-3 ${st.tint}`}
                  >
                    <span className="text-lg font-bold tabular-nums">{s.count}</span>
                    <span className="text-xs text-muted-foreground">{statusLabel(s.status)}</span>
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">{formatCents(s.amount)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {data.recovery_timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recovery over time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.recovery_timeline} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="week"
                    tickFormatter={(v: string) => {
                      const d = new Date(v + 'T00:00:00');
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }}
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${(v / 100).toLocaleString()}`}
                    className="text-xs"
                    tick={{ fill: 'currentColor' }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatCents(value), 'Cumulative Recovered']}
                    labelFormatter={(label: string) => {
                      const d = new Date(label + 'T00:00:00');
                      return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                    }}
                    contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '0.5rem' }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="var(--status-accepted)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--status-accepted)', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
