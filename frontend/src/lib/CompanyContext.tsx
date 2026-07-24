import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { apiFetch } from '#lib/api';

interface Company {
  id: number;
  name: string;
  slug: string | null;
  is_active: number;
}

interface CompanyContextValue {
  companies: Company[];
  selectedCompanyId: number | null;
  setSelectedCompanyId: (id: number | null) => void;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ data: Company[] }>('/api/companies').then((res) => {
      setCompanies(res.data);
    });
  }, []);

  return (
    <CompanyContext value={{ companies, selectedCompanyId, setSelectedCompanyId }}>
      {children}
    </CompanyContext>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be inside CompanyProvider');
  return ctx;
}
