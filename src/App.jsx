import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import Investors from './pages/Investors';
import History from './pages/History';
import AddInvestor from './pages/AddInvestor';
import AddMember from './pages/AddMember';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="investments" element={<Investments />} />
          <Route path="investors" element={<Investors />} />
          <Route path="history" element={<History />} />
          <Route path="add-investor" element={<AddInvestor />} />
          <Route path="add-member" element={<AddMember />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
