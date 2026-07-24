import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { CompanyProvider } from '#lib/CompanyContext';
import Layout from '#components/Layout';
import Dashboard from './pages/Dashboard';
import DeductionList from './pages/DeductionList';
import DeductionDetail from './pages/DeductionDetail';
import DataQuality from './pages/DataQuality';

export default function App() {
  return (
    <BrowserRouter>
      <CompanyProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/deductions" element={<DeductionList />} />
            <Route path="/deductions/:id" element={<DeductionDetail />} />
            <Route path="/data-quality" element={<DataQuality />} />
          </Route>
        </Routes>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-foreground)',
            },
          }}
        />
      </CompanyProvider>
    </BrowserRouter>
  );
}
