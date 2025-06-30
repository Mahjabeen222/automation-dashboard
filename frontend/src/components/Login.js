import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    // Add timeout to prevent infinite hanging
    const timeout = setTimeout(() => {
      setMessage('Error: Request timed out. Please check if the backend server is running.');
      setLoading(false);
    }, 10000); // 10 second timeout
    
    try {
      if (isRegister) {
        console.log('Attempting registration...');
        await register({
          email,
          password,
          username,
          full_name: fullName,
        });
        setMessage('Registration successful! Please login.');
        setIsRegister(false);
      } else {
        console.log('Attempting login with:', { email });
        console.log('API URL:', process.env.REACT_APP_API_URL || 'http://localhost:8000/api');
        
        const response = await login(email, password);
        console.log('Login response:', response);
        
        setMessage('Login successful!');
        // Clear the timeout on success
        clearTimeout(timeout);
        
        // Navigate to dashboard after successful login
        navigate('/');
      }
    } catch (error) {
      console.error('Login/Register error:', error);
      setMessage(`Error: ${error.message}`);
      
      // Log more details for debugging
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setMessage('Error: Cannot connect to backend server. Please ensure the backend is running on http://localhost:8000');
      }
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
      <h2>{isRegister ? 'Register' : 'Login'}</h2>
      
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label>Full Name:</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                required
              />
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label>Username:</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                required
              />
            </div>
          </>
        )}
        
        <div style={{ marginBottom: '15px' }}>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : (isRegister ? 'Register' : 'Login')}
        </button>
      </form>
      
      <p style={{ textAlign: 'center', marginTop: '15px' }}>
        {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setMessage('');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#007bff',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          {isRegister ? 'Login' : 'Register'}
        </button>
      </p>
      
      {message && (
        <div style={{
          marginTop: '15px',
          padding: '10px',
          backgroundColor: message.includes('Error') ? '#f8d7da' : '#d4edda',
          color: message.includes('Error') ? '#721c24' : '#155724',
          border: `1px solid ${message.includes('Error') ? '#f5c6cb' : '#c3e6cb'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default Login; 