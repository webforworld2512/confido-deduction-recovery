import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, FileText, Scale, TrendingUp } from 'lucide-react';
import { useCompany } from '#lib/CompanyContext';
import { apiFetch, formatCents } from '#lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '#components/ui/card';

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
}

export default function Dashboard() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCompanyId != null) params.set('company_id', String(selectedCompanyId));
    apiFetch<DashboardData>(`/api/dashboard?${params}`).then(setData);
  }, [selectedCompanyId]);

  if (!data) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Deductions',
      value: formatCents(data.total_deductions_amount),
      sub: `${data.total_deductions_count} deductions`,
      icon: FileText,
    },
    {
      title: 'Disputed',
      value: formatCents(data.disputed_amount),
      sub: `${data.disputed_count} disputes`,
      icon: Scale,
    },
    {
      title: 'Recovered',
      value: formatCents(data.recovered_amount),
      sub: `${(data.recovery_rate * 100).toFixed(1)}% recovery rate`,
      icon: DollarSign,
    },
    {
      title: 'Undisputed Disputable',
      value: formatCents(data.undisputed_disputable.amount),
      sub: `${data.undisputed_disputable.count} deductions`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <p className="text-xs text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Retailers by Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.by_retailer.slice(0, 8).map((r) => {
                const pct = data.total_deductions_amount > 0
                  ? (r.amount / data.total_deductions_amount) * 100
                  : 0;
                return (
                  <div key={r.retailer} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{r.retailer}</span>
                      <span className="font-mono text-muted-foreground">{formatCents(r.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Reason</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.by_reason.map((r) => (
                <div key={r.code} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {r.reason}
                    {r.typically_disputable === 1 && (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Disputable
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted-foreground">{r.count}</span>
                    <span className="w-24 text-right font-mono">{formatCents(r.amount)}</span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.by_status.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disputes by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {data.by_status.map((s) => (
                <div key={s.status} className="flex flex-col items-center rounded-lg border px-6 py-3">
                  <span className="text-lg font-bold">{s.count}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {s.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{formatCents(s.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
