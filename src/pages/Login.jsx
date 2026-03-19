import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (email === "" || password === "") {
      setError("⚠ Please fill all fields");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(`❌ ${authError.message}`);
      } else if (data.user) {
        navigate('/dashboard');
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
        <h2>Welcome Back 👋</h2>
        
        <form onSubmit={handleLogin}>
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

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
          >
            {loading ? <Loader2 className="spinner" size={18} /> : "Login"}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}

        <div className="login-footer">
          © {new Date().getFullYear()} Login System
        </div>
      </div>
    </div>
  );
};

export default Login;
