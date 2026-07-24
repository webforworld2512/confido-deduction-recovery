import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CompanyProvider } from '#lib/CompanyContext';
import Layout from '#components/Layout';
import Dashboard from './pages/Dashboard';
import DeductionList from './pages/DeductionList';
import DeductionDetail from './pages/DeductionDetail';

export default function App() {
  return (
    <BrowserRouter>
      <CompanyProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/deductions" element={<DeductionList />} />
            <Route path="/deductions/:id" element={<DeductionDetail />} />
          </Route>
        </Routes>
      </CompanyProvider>
    </BrowserRouter>
  );
}
