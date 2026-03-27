import { useState, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import './Investments.css';

const Investments = () => {
  const navigate = useNavigate();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [confirmModal, setConfirmModal] = useState({ 
    isOpen: false, 
    data: null, 
    title: 'Confirm Payment', 
    message: '', 
    showCancel: true 
  });

  const fetchInvestors = async () => {
    const { data, error } = await supabase
      .from('investors')
      .select('*')
      .eq('category', 'investment')
      .order('created_at', { ascending: false });
    
    if (data) {
      setInvestors(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvestors();

    const channel = supabase
      .channel('investments_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investors' }, fetchInvestors)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleFieldChange = (id, field, value) => {
    setInvestors(prev => prev.map(inv => 
      inv.id === id ? { ...inv, [field]: value } : inv
    ));
  };

  const saveInvestorField = async (id, field, value) => {
    const numericValue = parseFloat(value) || 0;
    await supabase
      .from('investors')
      .update({ [field]: numericValue })
      .eq('id', id);
  };

  const handleComplete = async (investor) => {
    const amount = parseFloat(investor.amount) || 0;
    
    if (amount <= 0 || processing[investor.id]) {
      if (!processing[investor.id]) alert("Please enter a valid amount");
      return;
    }

    setProcessing(prev => ({ ...prev, [investor.id]: true }));

    const { error: updateError } = await supabase.from('investors').update({
      is_done: true,
      amount: amount
    }).eq('id', investor.id);

    if (updateError) {
        setProcessing(prev => ({ ...prev, [investor.id]: false }));
        setConfirmModal({
            isOpen: true,
            title: 'Error',
            message: updateError.message,
            showCancel: false,
            data: null
        });
        return;
    }
    
    setProcessing(prev => ({ ...prev, [investor.id]: false }));
  };

  const requestComplete = (investor) => {
    const amount = parseFloat(investor.amount) || 0;
    if (amount <= 0) {
      setConfirmModal({
          isOpen: true,
          title: 'Invalid Amount',
          message: 'Please enter a valid amount before completing.',
          showCancel: false,
          data: null
      });
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Payment',
      message: `Are you sure you want to mark payment of ₹${investor.amount} for ${investor.name} as completed?`,
      showCancel: true,
      data: investor
    });
  };

  if (loading) return <div className="investments-page">Loading...</div>;

  return (
    <div className="investments-page">
      <h1 className="page-title">INVESTMENTS</h1>

      <div className="investments-list">
        {investors.map((investor) => (
          <div key={investor.id} className={`inv-card white-card ${investor.is_done ? 'is-done' : ''}`}>
            
            <div className="inv-profile">
              <div className="txn-icon" style={{ backgroundColor: '#5c7cfa' }}>
                {investor.name.charAt(0).toUpperCase()}
              </div>
              <div className="inv-name">{investor.name}</div>
            </div>
            
            <div className="inv-amount-section">
              <input 
                type="number" 
                className="compact-input-edit main-amount-input"
                value={investor.amount || ''}
                onChange={(e) => handleFieldChange(investor.id, 'amount', e.target.value)}
                onBlur={(e) => saveInvestorField(investor.id, 'amount', e.target.value)}
                placeholder="₹ 0.00"
                disabled={investor.is_done}
              />
            </div>

            <div className="inv-actions">
              <button 
                className={`icon-btn tick-btn ${investor.is_done ? 'active' : ''} ${processing[investor.id] ? 'dull-mode' : ''}`}
                onClick={() => requestComplete(investor)}
                disabled={investor.is_done || processing[investor.id]}
              >
                <Check size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => navigate('/add-member')}>
        <Plus />
      </button>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          if (confirmModal.showCancel && confirmModal.data) {
            handleComplete(confirmModal.data);
          }
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.showCancel ? "Confirm" : "OK"}
        showCancel={confirmModal.showCancel}
      />
    </div>
  );
};

export default Investments;
