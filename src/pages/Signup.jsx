import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css'; // Reuse Login styles

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (email === "" || password === "" || confirmPassword === "") {
      setError("⚠ Please fill all fields");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("❌ Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError(`❌ ${authError.message}`);
      } else if (data.user) {
        setSuccess("✅ Signup successful! Please check your email for confirmation (if required) then sign in.");
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setError("❌ An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <Link to="/login" className="back-link">
          <ArrowLeft size={18} /> Back to Login
        </Link>
        <h2 style={{ marginTop: '20px' }}>Create Account 🚀</h2>
        
        <form onSubmit={handleSignup}>
          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input 
              type="email" 
              className="input-field-auth"
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input 
              type="password" 
              className="input-field-auth"
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input 
              type="password" 
              className="input-field-auth"
              placeholder="Confirm Password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
          >
            {loading ? <Loader2 className="spinner" size={18} /> : "Sign Up"}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
        {success && <p className="success-message">{success}</p>}

        <div className="login-footer">
          Already have an account? <Link to="/login" style={{ color: 'white', fontWeight: 'bold' }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
