import { useState, useEffect } from 'react';
import { Plus, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Investments.css';

const Investments = () => {
  const navigate = useNavigate();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  const fetchInvestors = async () => {
    const { data, error } = await supabase
      .from('investors')
      .select('*')
      .eq('category', 'investment')
      .order('name');
    
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
        alert("Error: " + updateError.message);
        return;
    }
    
    setProcessing(prev => ({ ...prev, [investor.id]: false }));
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
                onClick={() => handleComplete(investor)}
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
    </div>
  );
};

export default Investments;
