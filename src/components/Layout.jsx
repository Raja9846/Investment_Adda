import { Outlet, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { 
  List, 
  Users, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewOnly = searchParams.get('view') === 'dashboard';

  useEffect(() => {
    if (isViewOnly && location.pathname !== '/dashboard') {
      navigate('/dashboard?view=dashboard', { replace: true });
    }
  }, [isViewOnly, location.pathname, navigate]);

  const navItems = [
    { path: '/dashboard', icon: <List size={22} />, label: 'Dashboard' },
    { path: '/investments', icon: <TrendingUp size={22} />, label: 'Investments' },
    { path: '/investors', icon: <Users size={22} />, label: 'Investors' },
    { path: '/history', icon: <Clock size={22} />, label: 'History' }
  ];

  return (
    <div className="app-container">
      {/* ================= DESKTOP NAVBAR ================= */}
      {!isViewOnly && (
        <nav className="desktop-navbar">
          <div className="logo">Investment Adda</div>
          <div className="nav-icons">
            {navItems.map((item) => (
              <Link 
                key={item.path} 
                to={item.path}
                className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              >
                {item.icon}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* ================= MAIN CONTENT ================= */}
      <main className={`main-content ${isViewOnly ? 'view-only-full' : ''}`}>
        <Outlet />
      </main>

      {/* ================= MOBILE BOTTOM NAV ================= */}
      {!isViewOnly && (
        <nav className="mobile-bottom-nav">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.icon}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
};

export default Layout;
