import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Receipt, ShieldCheck } from 'lucide-react';
import { useCompany } from '#lib/CompanyContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/deductions', label: 'Deductions', icon: Receipt },
  { to: '/data-quality', label: 'Data Quality', icon: ShieldCheck },
];

export default function Layout() {
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompany();

  return (
    <div className="flex h-screen flex-col">
      {/* Top navbar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <span className="text-lg font-semibold tracking-tight text-slate-accent">
          Dispute Desk
          <span className="ml-0.5 text-slate-accent/40">.</span>
        </span>
        <Select
          value={selectedCompanyId?.toString() ?? 'all'}
          onValueChange={(v: string) => setSelectedCompanyId(v === 'all' ? null : Number(v))}
          items={{ all: 'All Companies', ...Object.fromEntries(companies.map((c) => [c.id.toString(), c.name])) }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="flex w-52 shrink-0 flex-col gap-1 border-r border-border bg-sidebar p-3">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-accent/12 text-slate-accent-fg'
                    : 'text-sidebar-foreground/65 hover:bg-slate-accent/6 hover:text-sidebar-foreground'
                }`
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
