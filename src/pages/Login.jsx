import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock } from 'lucide-react';
import './Login.css'; // We will create this

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    
    // Hardcoded credentials as per original file
    const correctUser = "admin";
    const correctPass = "12345";

    if (username === "" || password === "") {
      setError("⚠ Please fill all fields");
    } else if (username === correctUser && password === correctPass) {
      setError("");
      alert("✅ Login Successful!");
      navigate('/dashboard');
    } else {
      setError("❌ Invalid Username or Password");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box glass-panel">
        <h2>Welcome Back 👋</h2>
        
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <User className="input-icon" size={18} />
            <input 
              type="text" 
              className="input-field-auth"
              placeholder="Username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            />
          </div>

          <button type="submit" className="btn-primary">Login</button>
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
