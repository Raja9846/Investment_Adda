import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Share2 } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    total_investment: 0,
    total_interest: 0,
    total_balance: 0
  });

  const handleShare = async () => {
    const shareText = `💰 Investment Adda Dashboard\n\n📈 Investment: ${formatCurrency(stats.total_investment)}\n📉 Interest: ${formatCurrency(stats.total_interest)}\n✅ Total Balance: ${formatCurrency(stats.total_balance)}\n\nCheck your investments now!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Investment Adda',
          text: shareText,
          url: `${window.location.origin}/dashboard?view=dashboard`
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(`${shareText}\n${window.location.origin}/dashboard?view=dashboard`);
        alert('Dashboard stats copied to clipboard!');
      } catch (err) {
        alert('Could not share or copy dashboard stats.');
      }
    }
  };

  useEffect(() => {
    // 1. Fetch initial data
    const fetchStats = async () => {
      const { data, error } = await supabase
        .from('app_state')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (error) {
        console.error('Error fetching dashboard stats:', error);
      } else if (data && data.length > 0) {
        setStats(data[0]);
      }
    };

    fetchStats();

    // 2. Subscribe to real-time updates (Listen for ANY change to app_state)
    const channel = supabase
      .channel('app_state_realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'app_state' }, 
        (payload) => {
          if (payload.new) {
            setStats(payload.new);
          } else {
            fetchStats(); // Fallback to re-fetch on delete or complex changes
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header-row">
        <h1 className="page-title">DASHBOARD</h1>
        <button className="icon-btn share-btn" onClick={handleShare} title="Share Dashboard">
          <Share2 size={20} />
        </button>
      </div>
      
      <div className="cards-grid">
        <div className="stat-card white-card">
          <h4>INVESTMENT</h4>
          <h2>{formatCurrency(stats.total_investment)}</h2>
          <div className="card-decoration bg-blue"></div>
        </div>

        <div className="stat-card white-card">
          <h4>INTEREST</h4>
          <h2>{formatCurrency(stats.total_interest)}</h2>
          <div className="card-decoration bg-green"></div>
        </div>

        <div className="stat-card white-card">
          <h4>TOTAL BALANCE</h4>
          <h2>{formatCurrency(stats.total_balance)}</h2>
          <div className="card-decoration bg-purple"></div>
        </div>
      </div>
      
    </div>
  );
};

export default Dashboard;
