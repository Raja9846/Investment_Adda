import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './AddForms.css';

const AddInvestor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    interest: '',
    months: '',
    aadhaar: '',
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
      amount: parseFloat(formData.amount),
      interest_percent: parseFloat(formData.interest),
      months: parseInt(formData.months),
      aadhaar: formData.aadhaar,
      phone: formData.phone,
      category: 'investor'
    });

    setLoading(false);

    if (error) {
      alert('Error adding investor: ' + error.message);
    } else {
      alert('Investor Added Successfully!');
      navigate('/investors');
    }
  };

  return (
    <div className="form-page-container">
      <div className="form-card white-card">
        <h2>Add Investor</h2>
        
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
            <label>Amount (₹)</label>
            <input 
              type="number" 
              name="amount"
              placeholder="Enter Amount" 
              required
              className="form-input"
              value={formData.amount}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Interest (%)</label>
            <input 
              type="number" 
              name="interest"
              placeholder="Enter Interest" 
              required
              className="form-input"
              value={formData.interest}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Months</label>
            <input 
              type="number" 
              name="months"
              placeholder="Enter Months" 
              required
              className="form-input"
              value={formData.months}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Aadhaar Card No</label>
            <input 
              type="text" 
              name="aadhaar"
              placeholder="Enter Aadhaar Number" 
              required
              className="form-input"
              value={formData.aadhaar}
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
            {loading ? 'Adding...' : 'Add Investor'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddInvestor;
