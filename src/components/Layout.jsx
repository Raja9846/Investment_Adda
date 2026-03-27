import { Outlet, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  List, 
  Users, 
  TrendingUp, 
  Clock,
  LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConfirmModal from './ConfirmModal';
import './Layout.css';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isViewOnly = searchParams.get('view') === 'dashboard';
  const [session, setSession] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session && !isViewOnly) {
        navigate('/login', { replace: true });
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session && !isViewOnly) {
        navigate('/login', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [isViewOnly, navigate]);

  useEffect(() => {
    // If in view-only mode but trying to access other routes, redirect to dashboard
    if (isViewOnly && location.pathname !== '/dashboard') {
      navigate('/dashboard?view=dashboard', { replace: true });
    }
  }, [isViewOnly, location.pathname, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

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
            <button onClick={() => setShowLogoutConfirm(true)} className="nav-link logout-btn" title="Logout">
              <LogOut size={22} />
            </button>
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
          <button onClick={() => setShowLogoutConfirm(true)} className="nav-link logout-btn">
            <LogOut size={22} />
          </button>
        </nav>
      )}
      {/* ================= CONFIRM MODAL ================= */}
      <ConfirmModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          handleLogout();
          setShowLogoutConfirm(false);
        }}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Logout"
      />
    </div>
  );
};

export default Layout;
