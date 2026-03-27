import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import ConfirmModal from '../components/ConfirmModal';
import './AddForms.css';

const AddMember = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: '' });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('investors').insert({
      name: formData.name,
      phone: formData.phone,
      amount: 0,
      interest_percent: 0,
      months: 0,
      category: 'investment',
      user_id: user?.id
    });

    setLoading(false);

    if (error) {
      setModal({ isOpen: true, title: 'Error', message: 'Error adding member: ' + error.message, type: 'error' });
    } else {
      setModal({ isOpen: true, title: 'Success! 🚀', message: 'Member Added Successfully!', type: 'success' });
    }
  };

  return (
    <div className="form-page-container">
      <div className="form-card white-card">
        <h2>Add Member</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Name</label>
            <input 
              type="text" 
              name="name"
              placeholder="Enter Name" 
              required
              className="form-input"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Phone No</label>
            <input 
              type="tel" 
              name="phone"
              placeholder="Enter Phone Number" 
              required
              className="form-input"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="btn-primary mt-3" disabled={loading}>
            {loading ? 'Adding...' : 'Add Member'}
          </button>
        </form>
      </div>

      <ConfirmModal 
        isOpen={modal.isOpen}
        onClose={() => {
            setModal({ ...modal, isOpen: false });
            if (modal.type === 'success') navigate('/investments');
        }}
        onConfirm={() => {
            setModal({ ...modal, isOpen: false });
            if (modal.type === 'success') navigate('/investments');
        }}
        title={modal.title}
        message={modal.message}
        confirmText="OK"
        showCancel={false}
      />
    </div>
  );
};

export default AddMember;
