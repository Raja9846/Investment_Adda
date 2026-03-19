import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './AddForms.css';

const AddMember = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('investors').insert({
      name: formData.name,
      phone: formData.phone,
      amount: 0,
      interest_percent: 0,
      months: 0,
      category: 'investment'
    });

    setLoading(false);

    if (error) {
      alert('Error adding member: ' + error.message);
    } else {
      alert('Member Added Successfully!');
      navigate('/investments');
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
    </div>
  );
};

export default AddMember;
