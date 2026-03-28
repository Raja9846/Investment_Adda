import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import './History.css';

const History = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, data: null });

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });
      
      if (data) {
        setTransactions(data);
      }
      setLoading(false);
    };

    fetchTransactions();

    const channel = supabase
      .channel('public:transactions')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'transactions' }, 
        fetchTransactions
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleTransactionClick = async (txn) => {
    if (txn.status === 'Completed' || processing[txn.id]) return;
    setProcessing(prev => ({ ...prev, [txn.id]: true }));

    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: 'Completed' })
      .eq('id', txn.id);

    if (updateError) {
        setProcessing(prev => ({ ...prev, [txn.id]: false }));
        return;
    }
    setProcessing(prev => ({ ...prev, [txn.id]: false }));
  };

  const handleDeleteTransaction = async (txn) => {
    setProcessing(prev => ({ ...prev, [`delete_${txn.id}`]: true }));
    
    // 1. Soft-delete the transaction
    const { error: txnError } = await supabase
      .from('transactions')
      .update({ is_deleted: true })
      .eq('id', txn.id);

    if (txnError) {
      console.error('Error deleting transaction:', txnError);
      setProcessing(prev => ({ ...prev, [`delete_${txn.id}`]: false }));
      return;
    }

    // 2. If it's a primary transaction (Investment or Settlement), delete the investor
    if (txn.investor_id && !txn.month_num) {
      await supabase.from('investors').update({ is_deleted: true }).eq('id', txn.investor_id);
    } 
    // 3. If it's an interest transaction, delete the payment record
    else if (txn.investor_id && txn.month_num) {
      await supabase.from('interest_payments').update({ is_deleted: true })
        .eq('investor_id', txn.investor_id)
        .eq('month_number', txn.month_num);
    }

    setProcessing(prev => ({ ...prev, [`delete_${txn.id}`]: false }));
  };

  const requestDelete = (e, txn) => {
    e.stopPropagation(); // Don't trigger transaction click logic
    setConfirmModal({
      isOpen: true,
      data: txn
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' • ' + 
           date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) return <div className="history-page">Loading...</div>;

  return (
    <div className="history-page">
      <h1 className="page-title">HISTORY</h1>

      <div className="history-container white-card">
        <div className="history-scroll-area">
          {transactions.length === 0 ? (
            <div className="no-data">No transactions yet.</div>
          ) : (
            transactions.map((txn) => (
              <div 
                key={txn.id} 
                className={`transaction-card ${txn.status === 'Pending' && !processing[txn.id] ? 'clickable-txn' : ''}`}
                onClick={() => handleTransactionClick(txn)}
              >
                
                <div className="txn-left">
                  <div className="txn-icon" style={{ backgroundColor: txn.bg_color || '#5c7cfa' }}>
                    {txn.initials}
                  </div>
                  
                  <div className="txn-details">
                    <div className="txn-name">{txn.name}</div>
                    <div className="txn-date">{formatDate(txn.created_at)}</div>
                  </div>
                </div>

                <div className="txn-right">
                  <div className="txn-amount-group">
                    <div className={`txn-amount ${txn.txn_type === 'Settlement' ? 'text-danger' : 'text-success'}`}>
                      {txn.txn_type === 'Settlement' ? `- ₹${txn.amount.toLocaleString('en-IN')}` : `₹${txn.amount.toLocaleString('en-IN')}`}
                    </div>
                    <div className="txn-time-micro">{new Date(txn.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                  <div className={`txn-status ${txn.status === 'Completed' ? 'badge-success' : 'badge-danger'}`}>
                    {txn.status}
                  </div>
                  <button 
                    className="icon-btn delete-btn-history"
                    onClick={(e) => requestDelete(e, txn)}
                    disabled={processing[`delete_${txn.id}`]}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, data: null })}
        onConfirm={() => {
          if (confirmModal.data) handleDeleteTransaction(confirmModal.data);
          setConfirmModal({ isOpen: false, data: null });
        }}
        title="Confirm Deletion"
        message={`Are you sure you want to delete the transaction "${confirmModal.data?.name}"? This will hide it from history but will not change the total balance.`}
        confirmText="Delete"
        isDanger={true}
      />
    </div>
  );
};

export default History;
