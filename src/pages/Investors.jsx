import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Check, Plus, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Investors.css';

const Investors = () => {
  const navigate = useNavigate();
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [activeInvestorId, setActiveInvestorId] = useState(null);
  const [monthsData, setMonthsData] = useState({});
  const [paidMonths, setPaidMonths] = useState({}); 
  const [processing, setProcessing] = useState({}); // Tracking clicks to prevent double-clicks
  
  const fetchInvestors = async () => {
    const { data, error } = await supabase
      .from('investors')
      .select('*')
      .eq('category', 'investor')
      .order('name');
    
    if (data) {
      setInvestors(data);
    }
    setLoading(false);
  };

  const fetchPaidMonths = async () => {
    const { data, error } = await supabase
      .from('interest_payments')
      .select('*');
    
    if (data) {
      const mapping = {};
      data.forEach(p => {
        if (!mapping[p.investor_id]) mapping[p.investor_id] = {};
        mapping[p.investor_id][p.month_number] = true;
      });
      setPaidMonths(mapping);
    }
  };

  useEffect(() => {
    fetchInvestors();
    fetchPaidMonths();

    const channel1 = supabase
      .channel('investors_page_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investors' }, fetchInvestors)
      .subscribe();

    const channel2 = supabase
      .channel('interest_payments_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interest_payments' }, fetchPaidMonths)
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, []);

  const generateMonths = (investor) => {
    const count = investor.months || 0;
    const interest = (parseFloat(investor.amount || 0) * parseFloat(investor.interest_percent || 0)) / 100;
    
    const newMonths = [];
    for (let i = 1; i <= count; i++) {
        const isPaid = paidMonths[investor.id]?.[i] || false;
      newMonths.push({
        id: i,
        title: `Month ${i}`,
        amount: interest.toFixed(2),
        done: isPaid
      });
    }
    return newMonths;
  };

  const toggleDetails = (investorId) => {
    if (activeInvestorId === investorId) {
      setActiveInvestorId(null);
    } else {
      setActiveInvestorId(investorId);
      const investor = investors.find(inv => inv.id === investorId);
      setMonthsData({
        ...monthsData,
        [investorId]: generateMonths(investor)
      });
    }
  };

  useEffect(() => {
    if (activeInvestorId) {
        const investor = investors.find(inv => inv.id === activeInvestorId);
        if (investor) {
            setMonthsData(prev => ({
                ...prev,
                [activeInvestorId]: generateMonths(investor)
            }));
        }
    }
  }, [paidMonths, investors]);

  const handleFieldChange = (id, field, value) => {
    setInvestors(prev => prev.map(inv => 
      inv.id === id ? { ...inv, [field]: value } : inv
    ));
  };

  const saveInvestorField = async (id, field, value) => {
    const updateData = {};
    if (field === 'months') updateData[field] = parseInt(value) || 0;
    else updateData[field] = parseFloat(value) || 0;

    await supabase
      .from('investors')
      .update(updateData)
      .eq('id', id);
  };

  const toggleInvestorDone = async (id, currentStatus) => {
    if (processing[`done_${id}`]) return;
    setProcessing(prev => ({ ...prev, [`done_${id}`]: true }));

    const { error: updateError } = await supabase
      .from('investors')
      .update({ is_done: !currentStatus })
      .eq('id', id);

    if (updateError) {
        setProcessing(prev => ({ ...prev, [`done_${id}`]: false }));
        return;
    }

    // ADD BACK principal to the total balance if marking as done
    if (!currentStatus) {
        const investor = investors.find(inv => inv.id === id);
        await supabase.from('transactions').insert({
          name: `${investor.name} (Repayment)`,
          initials: investor.name.charAt(0).toUpperCase(),
          amount: parseFloat(investor.amount),
          status: 'Completed',
          txn_type: 'Investment', // Adding to 'Investment' type adds to dashboard total_inv and balance
          bg_color: '#5c7cfa' 
        });
    }
    
    setProcessing(prev => ({ ...prev, [`done_${id}`]: false }));
  };

  const handleMonthComplete = async (investorId, monthId, monthAmount) => {
    const key = `${investorId}_${monthId}`;
    if (processing[key]) return;
    setProcessing(prev => ({ ...prev, [key]: true }));

    const amount = parseFloat(monthAmount);

    const { error: payError } = await supabase.from('interest_payments').insert({
      investor_id: investorId,
      month_number: monthId,
      amount: amount
    });

    if (payError) {
        setProcessing(prev => ({ ...prev, [key]: false }));
        return;
    }
    
    setProcessing(prev => ({ ...prev, [key]: false }));
  };

  if (loading) return <div className="investors-page">Loading...</div>;

  return (
    <div className="investors-page">
      <h1 className="page-title">INVESTORS</h1>

      {investors.map((investor) => (
        <div key={investor.id} className={`investor-row-card white-card ${investor.is_done ? 'is-done-card' : ''}`}>
          <div className="investor-main-row">
            <div className="inv-profile">
              <div className="txn-icon" style={{ backgroundColor: '#f06595' }}>
                {investor.name.charAt(0).toUpperCase()}
              </div>
              <div className="inv-person-name">{investor.name}</div>
            </div>
            
            <input 
              type="number" 
              className="compact-input-edit"
              value={investor.amount || ''}
              onChange={(e) => handleFieldChange(investor.id, 'amount', e.target.value)}
              onBlur={(e) => saveInvestorField(investor.id, 'amount', e.target.value)}
              placeholder="Amt"
            />

            <div className="percent-wrapper">
              <input 
                type="number" 
                className="compact-input-edit percent-input"
                value={investor.interest_percent || ''}
                onChange={(e) => handleFieldChange(investor.id, 'interest_percent', e.target.value)}
                onBlur={(e) => saveInvestorField(investor.id, 'interest_percent', e.target.value)}
                placeholder="%"
              />
              <span className="percent-sign">%</span>
            </div>

            <div className="percent-wrapper">
              <input 
                type="number" 
                className="compact-input-edit months-input"
                value={investor.months || ''}
                onChange={(e) => handleFieldChange(investor.id, 'months', e.target.value)}
                onBlur={(e) => saveInvestorField(investor.id, 'months', e.target.value)}
                placeholder="M"
              />
              <span className="percent-sign">M</span>
            </div>

            <div className="info-icon-wrapper" title={`Name: ${investor.name}\nPhone: ${investor.phone || 'N/A'}`}>
                <Info size={18} className="info-icon-btn" />
            </div>

            <button 
              className="icon-btn drop-btn" 
              onClick={() => toggleDetails(investor.id)}
            >
              {activeInvestorId === investor.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            <button 
              className={`icon-btn tick-btn ${investor.is_done ? 'active' : ''} ${processing[`done_${investor.id}`] ? 'dull-mode' : ''}`}
              onClick={() => toggleInvestorDone(investor.id, investor.is_done)}
              disabled={investor.is_done || processing[`done_${investor.id}`]}
            >
              <Check size={18} />
            </button>
          </div>

          <div className={`months-details ${activeInvestorId === investor.id ? 'show' : ''}`}>
            {(monthsData[investor.id] || []).map((month) => (
              <div key={month.id} className={`month-card ${month.done || processing[`${investor.id}_${month.id}`] ? 'dull-mode' : ''}`}>
                <span className="month-title">{month.title}</span>
                <input 
                  type="number" 
                  className="month-amount-input" 
                  defaultValue={month.amount}
                  onBlur={(e) => {
                    const newMonthsData = (monthsData[investor.id] || []).map(m => 
                      m.id === month.id ? { ...m, amount: e.target.value } : m
                    );
                    setMonthsData({ ...monthsData, [investor.id]: newMonthsData });
                  }}
                />
                <button 
                  className={`icon-btn small-tick ${month.done ? 'active' : ''}`}
                  onClick={() => {
                      const m = monthsData[investor.id].find(m => m.id === month.id);
                      handleMonthComplete(investor.id, month.id, m.amount);
                  }}
                  disabled={month.done || processing[`${investor.id}_${month.id}`]}
                >
                  <Check size={14} />
                </button>
              </div>
            ))}
            <button className="add-month-btn-inline" onClick={() => {
                const newMonths = (investor.months || 0) + 1;
                saveInvestorField(investor.id, 'months', newMonths);
            }}>
              <Plus size={16} /> Add Month
            </button>
          </div>
        </div>
      ))}

      <button className="fab" onClick={() => navigate('/add-investor')}>
        <Plus />
      </button>
    </div>
  );
};

export default Investors;
