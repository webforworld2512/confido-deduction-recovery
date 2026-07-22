import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import DeductionList from './pages/DeductionList';
import DeductionDetail from './pages/DeductionDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deductions" element={<DeductionList />} />
        <Route path="/deductions/:id" element={<DeductionDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
