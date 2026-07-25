import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { CompanyProvider } from '#lib/CompanyContext';
import Layout from '#components/Layout';
import Dashboard from './pages/Dashboard';
import DeductionList from './pages/DeductionList';
import DeductionDetail from './pages/DeductionDetail';
import DataQuality from './pages/DataQuality';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link to="/" className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        Back to Dashboard
      </Link>
    </div>
  );
}

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
            <Route path="*" element={<NotFound />} />
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
