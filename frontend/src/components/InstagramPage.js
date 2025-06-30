import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './SocialMediaPage.css';
import apiClient from '../services/apiClient';

function InstagramPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated: authIsAuthenticated } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [instagramConnected, setInstagramConnected] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    caption: '',
    image: null,
    hashtags: ''
  });

  // Icon Components
  const ImageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21,15 16,10 5,21"></polyline>
    </svg>
  );

  const MessageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  const HashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="9" x2="20" y2="9"></line>
      <line x1="4" y1="15" x2="20" y2="15"></line>
      <line x1="10" y1="3" x2="8" y2="21"></line>
      <line x1="16" y1="3" x2="14" y2="21"></line>
    </svg>
  );

  const RocketIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path>
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>
    </svg>
  );

  const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <circle cx="12" cy="16" r="1"></circle>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleInstagramConnect = async () => {
    if (!instagramConnected) {
      // Check HTTPS requirement
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setConnectionStatus('❌ Instagram login requires HTTPS. Please use https://localhost:3001 or deploy with HTTPS');
        return;
      }

      // Check backend authentication
      try {
        await apiClient.getCurrentUser();
      } catch (error) {
        setConnectionStatus('❌ Your session has expired. Please log out and log back in to connect Instagram.');
        setTimeout(() => {
          navigate('/');
        }, 3000);
        return;
      }

      setIsConnecting(true);
      setConnectionStatus('📦 Loading Facebook SDK for Instagram...');

      try {
        await loadFacebookSDK();

        if (!window.FB || typeof window.FB.login !== 'function') {
          setConnectionStatus('❌ Facebook SDK failed to load. Please refresh the page and try again.');
          setIsConnecting(false);
          return;
        }

        setConnectionStatus('🔐 Connecting to Instagram via Facebook...');

        window.FB.login((response) => {
          if (response.status === 'connected' && response.authResponse?.accessToken) {
            (async () => {
              try {
                setConnectionStatus('✅ Facebook login successful! Checking Instagram connection...');
                
                const accessToken = response.authResponse.accessToken;
                const userId = response.authResponse.userID;

                // Check for Instagram accounts linked to Facebook Pages
                const instagramAccountsResponse = await new Promise((resolve, reject) => {
                  window.FB.api('/me/accounts', {
                    access_token: accessToken,
                    fields: 'id,name,instagram_business_account{id,username,profile_picture_url}'
                  }, (response) => {
                    if (response.error) {
                      reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
                    } else {
                      resolve(response);
                    }
                  });
                });

                // Filter pages that have Instagram accounts
                const pagesWithInstagram = instagramAccountsResponse.data?.filter(
                  page => page.instagram_business_account
                ) || [];

                if (pagesWithInstagram.length === 0) {
                  setConnectionStatus('❌ No Instagram Business accounts found linked to your Facebook Pages. Please link an Instagram Business account to a Facebook Page first.');
                  setIsConnecting(false);
                  return;
                }

                // For now, use the first Instagram account found
                const instagramAccount = pagesWithInstagram[0].instagram_business_account;
                
                setConnectionStatus('✅ Connected to Instagram successfully!');
                setInstagramConnected(true);
                setIsConnecting(false);

                // Store Instagram account info for posting
                // You might want to store this in state or context
                console.log('Connected Instagram account:', instagramAccount);

              } catch (error) {
                console.error('[Instagram.login] Error in Instagram connection:', error);
                setConnectionStatus('❌ Error during Instagram setup: ' + (error.message || 'Unknown error'));
                setIsConnecting(false);
                setInstagramConnected(false);
              }
            })();
          } else {
            if (response.status === 'not_authorized') {
              setConnectionStatus('❌ Please authorize the app to continue and ensure you have Instagram Business accounts linked to your Facebook Pages.');
            } else {
              setConnectionStatus('❌ Instagram login cancelled or failed');
            }
            setIsConnecting(false);
          }
        }, {
          scope: [
            'pages_show_list',
            'instagram_basic',
            'instagram_manage_comments',
            'instagram_manage_insights',
            'instagram_content_publish',
            'pages_read_engagement',
            'pages_manage_posts'
          ].join(','),
          enable_profile_selector: true,
          return_scopes: true,
          auth_type: 'rerequest',
          display: 'popup'
        });
      } catch (error) {
        console.error('Instagram login error:', error);
        setConnectionStatus('❌ Instagram login failed: ' + error.message);
        setIsConnecting(false);
      }
      return;
    }

    // Instagram posting logic (when already connected)
    // Validate required fields
    if (!formData.caption || formData.caption.trim() === '') {
      setConnectionStatus('❌ Please enter a caption');
      return;
    }

    if (!formData.image) {
      setConnectionStatus('❌ Please select an image for Instagram post');
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionStatus('🚀 Posting to Instagram...');
      
      // Instagram posting logic will go here
      // For now, simulate the posting process
      setTimeout(() => {
        setConnectionStatus('✅ Posted to Instagram successfully!');
        
        // Reset form after successful submission
        setFormData({
          caption: '',
          image: null,
          hashtags: ''
        });
        setIsConnecting(false);
      }, 3000);
      
    } catch (error) {
      console.error('Instagram post creation error:', error);
      setConnectionStatus('❌ Failed to create Instagram post: ' + (error.message || 'Unknown error'));
      setIsConnecting(false);
    }
  };

  // Load Facebook SDK (reuse the same function as FacebookPage)
  const loadFacebookSDK = () => {
    return new Promise((resolve, reject) => {
      // Clean up any existing SDK
      const existingScript = document.getElementById('facebook-jssdk');
      if (existingScript) {
        existingScript.remove();
      }
      if (window.FB) {
        delete window.FB;
      }
      if (window.fbAsyncInit) {
        delete window.fbAsyncInit;
      }
      
      window.fbAsyncInit = function () {
        try {
          window.FB.init({
            appId: process.env.REACT_APP_INSTAGRAM_APP_ID || '24293410896962741',
            cookie: true,
            xfbml: true,
            version: 'v19.0'
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onerror = () => reject(new Error('Failed to load Facebook SDK script'));
      document.body.appendChild(script);
    });
  };

  if (!authIsAuthenticated) {
    return (
      <div className="page-container">
        <div className="auth-required">
          <h1>Please login to continue</h1>
          <p>You need to be logged in to use Instagram automation features.</p>
          <button onClick={() => navigate('/')} className="btn primary">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15,18 9,12 15,6"></polyline>
          </svg>
          Back to Dashboard
        </button>
        <div className="page-title-section">
          <h1 className="page-title">Instagram Automation</h1>
          <p className="page-subtitle">Connected to FastAPI Backend • User: {user?.full_name || user?.username}</p>
        </div>
      </header>

      <main className="page-main">
        <div className="platforms-container">
          <div className="platforms-grid">
            <div className={`platform-card ${instagramConnected ? 'authenticated' : ''}`}
                 style={{
                   '--platform-gradient': 'linear-gradient(135deg, #405DE6 0%, #5851DB 25%, #833AB4 50%, #C13584 75%, #E1306C 100%)',
                   '--platform-border': '#E1306C'
                 }}>
              <div className="platform-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="url(#instagram-gradient)">
                  <defs>
                    <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#405DE6"/>
                      <stop offset="25%" stopColor="#5851DB"/>
                      <stop offset="50%" stopColor="#833AB4"/>
                      <stop offset="75%" stopColor="#C13584"/>
                      <stop offset="100%" stopColor="#E1306C"/>
                    </linearGradient>
                  </defs>
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
              
              <div className="platform-content">
                <h3 className="platform-name">Instagram</h3>
                <p className="platform-description">
                  {instagramConnected ? 'Connected to Instagram' : 'Not Connected'}
                </p>
                
                {instagramConnected ? (
                  <div className="platform-form">
                    <div className="form-group">
                      <label className="form-label">
                        <ImageIcon />
                        Upload Image
                      </label>
                      <div className="image-upload-wrapper">
                        <input
                          type="file"
                          name="image"
                          accept="image/*"
                          onChange={handleInputChange}
                          className="image-input"
                          id="image-upload"
                        />
                        <label htmlFor="image-upload" className="image-upload-label">
                          <ImageIcon />
                          {formData.image ? formData.image.name : 'Choose an image'}
                        </label>
                      </div>
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">
                        <MessageIcon />
                        Caption
                      </label>
                      <textarea
                        name="caption"
                        placeholder="Write a caption for your Instagram post..."
                        value={formData.caption}
                        onChange={handleInputChange}
                        className="glass-input glass-textarea enhanced-textarea"
                        rows="4"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <HashIcon />
                        Hashtags
                      </label>
                      <input
                        type="text"
                        name="hashtags"
                        placeholder="#instagram #automation #social"
                        value={formData.hashtags}
                        onChange={handleInputChange}
                        className="glass-input"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="auth-prompt">
                    <p className="auth-description">
                      <LockIcon />
                      Please authenticate with Instagram to start posting
                    </p>
                  </div>
                )}
              </div>

              <div className="platform-actions">
                {instagramConnected ? (
                  <button 
                    className="connect-btn"
                    onClick={handleInstagramConnect}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <div className="loading-spinner" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <RocketIcon />
                        Post to Instagram
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                      </>
                    )}
                  </button>
                ) : (
                  <button 
                    className="connect-btn"
                    onClick={handleInstagramConnect}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <div className="loading-spinner" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LockIcon />
                        Connect Instagram
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9,18 15,12 9,6"></polyline>
                        </svg>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {connectionStatus && (
            <div className="connection-status">
              <div className={`status-message ${connectionStatus.includes('✅') ? 'success' : connectionStatus.includes('🚧') ? 'info' : 'error'}`}>
                {connectionStatus}
              </div>
            </div>
          )}
        </div>

        {/* Backend Status Indicator */}
        <div className="backend-status-footer">
          <div className="backend-indicator">
            <span className="status-dot"></span>
            <span>Connected to FastAPI Backend</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default InstagramPage; 