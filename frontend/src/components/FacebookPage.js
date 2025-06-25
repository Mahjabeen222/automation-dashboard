import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import './SocialMediaPage.css';

function FacebookPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated: authIsAuthenticated, logout } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  
  // Facebook OAuth states
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [facebookConnected, setFacebookConnected] = useState(false);
  
  // Auto-reply toggle state
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  
  // Form data state
  const [formData, setFormData] = useState({
    message: '',
    image: null
  });
  
  // Post type selection state
  const [postType, setPostType] = useState('post-auto');

  // Icon Components
  const PostTypeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
    </svg>
  );

  const MessageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );

  const PageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
    </svg>
  );

  const ImageIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21,15 16,10 5,21"></polyline>
    </svg>
  );

  const AutoReplyIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
    </svg>
  );

  const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <circle cx="12" cy="16" r="1"></circle>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
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

  const LogoutIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16,17 21,12 16,7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  );

  // Clean up any existing Facebook SDK instances
  const cleanupFacebookSDK = () => {
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
  };

  // Load Facebook SDK function
  const loadFacebookSDK = () => {
    return new Promise((resolve, reject) => {
      cleanupFacebookSDK();
      
      window.fbAsyncInit = function () {
        try {
          const appId = process.env.REACT_APP_FACEBOOK_APP_ID || '1526961221410200';
          
          window.FB.init({
            appId: appId,
            cookie: true,
            xfbml: true,
            version: 'v23.0'
          });

          // Check if user is already logged in
          window.FB.getLoginStatus((response) => {
            if (response.status === 'connected') {
              fetchPages(response.authResponse.accessToken);
            }
          });

          resolve();
        } catch (error) {
          console.error('Facebook SDK initialization error:', error);
          reject(error);
        }
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';

      script.onerror = () => {
        reject(new Error('Failed to load Facebook SDK script'));
      };

      document.body.appendChild(script);
    });
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handlePostTypeChange = (e) => {
    setPostType(e.target.value);
    // Clear image when switching away from image post types
    if (!e.target.value.includes('image')) {
      setFormData(prev => ({ ...prev, image: null }));
    }
  };

  // UPDATED: Replace Make.com auto-reply webhook with backend API
  const handleAutoReplyToggle = async () => {
    const newState = !autoReplyEnabled;
    setAutoReplyEnabled(newState);
    
    try {
      setConnectionStatus('🔄 Updating auto-reply setting...');
      
      await apiClient.toggleAutoReply(
        selectedPage?.id || 'user_profile',
        newState,
        'Thank you for your comment! We\'ll get back to you soon.'
      );

      setConnectionStatus(`${newState ? '✅' : '❌'} Auto-reply ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Auto-reply toggle error:', error);
      setConnectionStatus('❌ Failed to update auto-reply setting');
      setAutoReplyEnabled(!newState); // Revert on error
    }
  };

  const loginWithFacebook = async () => {
    // Check HTTPS requirement first
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setConnectionStatus('❌ Facebook login requires HTTPS. Please use https://localhost:3001 or deploy with HTTPS');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('📦 Loading Facebook SDK...');

    try {
      await loadFacebookSDK();

      if (!window.FB || typeof window.FB.login !== 'function') {
        setConnectionStatus('❌ Facebook SDK failed to load. Please refresh the page and try again.');
        setIsConnecting(false);
        return;
      }

      setConnectionStatus('🔐 Connecting to Facebook...');
      
      window.FB.login((response) => {
        if (response.authResponse) {
          setConnectionStatus('✅ Facebook login successful!');
          connectToBackend(response.authResponse);
        } else if (response.status === 'not_authorized') {
          setConnectionStatus('❌ Please authorize the app to continue. Check Facebook App settings.');
          setIsConnecting(false);
        } else if (response.status === 'unknown') {
          setConnectionStatus('❌ Facebook app configuration error. Please check your Facebook App settings.');
          setIsConnecting(false);
        } else {
          setConnectionStatus('❌ Facebook login cancelled or failed');
          setIsConnecting(false);
        }
      }, {
        scope: [
          'public_profile',
          'pages_show_list',
          'pages_read_engagement', 
          'pages_manage_posts',
          'pages_manage_engagement',
          'pages_read_user_content'
        ].join(',')
      });
    } catch (error) {
      console.error('Facebook login error:', error);
      
      if (error.message && error.message.includes('http pages')) {
        setConnectionStatus('❌ Facebook requires HTTPS. Please use HTTPS or localhost');
      } else if (error.message && error.message.includes('init not called')) {
        setConnectionStatus('❌ Facebook SDK initialization failed. Please refresh the page and try again.');
      } else {
        setConnectionStatus('❌ Facebook login failed: ' + error.message);
      }
      setIsConnecting(false);
    }
  };

  // UPDATED: Connect Facebook to backend instead of just setting local state
  const connectToBackend = async (authResponse) => {
    try {
      setConnectionStatus('🔗 Connecting to backend...');
      
      // Get user info from Facebook
      window.FB.api('/me', { fields: 'id,name,email' }, async (userInfo) => {
        if (userInfo.error) {
          throw new Error(userInfo.error.message);
        }

        // Get user's pages
        window.FB.api('/me/accounts', { fields: 'id,name,category,access_token' }, async (pagesResponse) => {
          const pages = pagesResponse.data || [];
          
          // Connect to our backend
          const result = await apiClient.connectFacebook(
            authResponse.accessToken,
            userInfo.id,
            pages.map(page => ({
              id: page.id,
              name: page.name,
              category: page.category || 'Page',
              access_token: page.access_token,
              can_post: true
            }))
          );

          setFacebookConnected(true);
          setPageAccessToken(authResponse.accessToken);
          setSelectedPage({
            id: userInfo.id,
            name: userInfo.name,
            access_token: authResponse.accessToken,
            category: 'Personal Profile',
            profilePicture: '',
            email: userInfo.email || '',
            isUserProfile: true,
            canPost: true,
            canComment: true,
            followerCount: 0
          });
          
          setConnectionStatus(`✅ Connected successfully! ${result.data?.pages_connected || 0} pages connected.`);
          setIsConnecting(false);
        });
      });
    } catch (error) {
      console.error('Backend connection error:', error);
      setConnectionStatus('❌ Failed to connect to backend: ' + (error.message || 'Unknown error'));
      setIsConnecting(false);
      setFacebookConnected(false);
    }
  };

  const fetchPages = (userAccessToken) => {
    setConnectionStatus('📄 Setting up your Facebook connection...');
    
    try {
      // Get user profile info (works with basic permissions)
      window.FB.api('/me', 'GET', { 
        access_token: userAccessToken,
        fields: 'id,name,picture,email'
      }, (userResponse) => {
        if (userResponse.error) {
          console.error('Facebook API error:', userResponse.error);
          setConnectionStatus(`❌ Facebook API error: ${userResponse.error.message}`);
          setIsConnecting(false);
          return;
        }

        setConnectionStatus('✅ Facebook connected successfully!');
        setFacebookConnected(true);
        
        // Set up user profile for posting (using basic permissions)
        setSelectedPage({
          id: userResponse.id,
          name: userResponse.name,
          access_token: userAccessToken,
          category: 'Personal Profile',
          profilePicture: userResponse.picture?.data?.url || '',
          email: userResponse.email || '',
          isUserProfile: true,
          canPost: true, // User can always post to their own profile
          canComment: true, // User can always comment
          followerCount: 0
        });
        setPageAccessToken(userAccessToken);
        setIsConnecting(false);
      });
    } catch (error) {
      console.error('Fetch user profile error:', error);
      setConnectionStatus('❌ Failed to connect to Facebook');
      setIsConnecting(false);
    }
  };

  // UPDATED: Replace Make.com webhook with backend API
  const handleFacebookConnect = async () => {
    if (!facebookConnected) {
      loginWithFacebook();
      return;
    }

    // Validate required fields
    if (!formData.message || formData.message.trim() === '') {
      setConnectionStatus('❌ Please enter a message');
      return;
    }

    if (!pageAccessToken) {
      setConnectionStatus('❌ No Facebook access token available');
      return;
    }

    // Validate image for image post types
    if (postType.includes('image') && !formData.image) {
      setConnectionStatus('❌ Please select an image for image posts');
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionStatus('🚀 Posting to Facebook...');
      
      // Use our backend API instead of Make.com webhook
      const result = await apiClient.createFacebookPost(
        selectedPage?.id || 'user_profile',
        formData.message,
        postType,
        formData.image ? formData.image.name : null
      );

      setConnectionStatus(`✅ ${result.message}`);
      
      // Reset form after successful submission
      setFormData({
        message: '',
        image: null
      });
    } catch (error) {
      console.error('Post creation error:', error);
      setConnectionStatus('❌ Failed to create post: ' + (error.message || 'Unknown error'));
    } finally {
      setIsConnecting(false);
    }
  };

  // UPDATED: Use auth context logout instead of Facebook-only logout
  const handleLogout = async () => {
    if (window.FB) {
      window.FB.logout(() => {
        // Facebook logout complete
      });
    }
    
    // Logout from our auth system
    await logout();
    setFacebookConnected(false);
    setSelectedPage(null);
    setPageAccessToken('');
    setConnectionStatus('👋 Logged out successfully');
    navigate('/social-media');
  };

  // Show login form if not authenticated with our system
  if (!authIsAuthenticated) {
    return (
      <div className="page-container">
        <div className="auth-required">
          <h1>Please login to continue</h1>
          <p>You need to be logged in to use Facebook automation features.</p>
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
          Back to Social Media
        </button>
        <div className="page-title-section">
          <h1 className="page-title">Facebook Automation</h1>
          <p className="page-subtitle">Connected to FastAPI Backend • User: {user?.full_name || user?.username}</p>
        </div>
      </header>

      <main className="page-main">
        <div className="platforms-container">
          <div className="platforms-grid">
            <div className={`platform-card ${facebookConnected ? 'authenticated' : ''}`}
                 style={{
                   '--platform-gradient': 'linear-gradient(135deg, #1877F2 0%, #42a5f5 100%)',
                   '--platform-border': '#1877F2'
                 }}>
              <div className="platform-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="#1877F2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              
              <div className="platform-content">
                <h3 className="platform-name">Facebook</h3>
                <p className="platform-description">
                  {facebookConnected ? `Connected as ${selectedPage?.name || 'Facebook User'}` : 'Not Connected'}
                </p>
                
                {facebookConnected ? (
                  <div className="platform-form">
                    {/* Auto-reply toggle */}
                    <div className="form-group auto-reply-group">
                      <label className="form-label toggle-label">
                        <AutoReplyIcon />
                        Auto-reply to comments
                        <div className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={autoReplyEnabled}
                            onChange={handleAutoReplyToggle}
                            className="toggle-input"
                          />
                          <span className="toggle-slider"></span>
                        </div>
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <PostTypeIcon />
                        Post Type
                      </label>
                      <div className="custom-select-wrapper">
                        <select
                          value={postType}
                          onChange={handlePostTypeChange}
                          className="glass-input glass-select custom-select"
                        >
                          <option value="post-auto">Write with AI</option>
                          <option value="post-manual">Write Manually</option>
                          <option value="image-post-auto">Image post with AI</option>
                          <option value="image-post-manual">Image post Manually</option>
                        </select>
                        <div className="select-arrow">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    {/* Connection Info */}
                    <div className="form-group">
                      <label className="form-label">
                        <PageIcon />
                        Connected Account
                      </label>
                      {selectedPage?.isUserProfile ? (
                        <div className="page-card selected">
                          <div className="page-avatar">
                            {selectedPage.profilePicture ? (
                              <img src={selectedPage.profilePicture} alt={selectedPage.name} />
                            ) : (
                              <div className="page-avatar-placeholder">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="page-info">
                            <div className="page-details">
                            </div>
                            <div className="page-permissions">
                              <span className="permission-badge post">{selectedPage.name}</span>
                            </div>
                          </div>
                          <div className="page-selector">
                            <div className="radio-button selected">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="no-pages-message">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          <p>No pages found. Please make sure you have Facebook pages associated with your account.</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Image upload field for manual image posts */}
                    {postType === 'image-post-manual' && (
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
                    )}
                    
                    <div className="form-group">
                      <label className="form-label">
                        <MessageIcon />
                        Your Message
                      </label>
                      <textarea
                        name="message"
                        placeholder="What's on your mind? Share your thoughts with the world..."
                        value={formData.message}
                        onChange={handleInputChange}
                        className="glass-input glass-textarea enhanced-textarea"
                        rows="4"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="auth-prompt">
                    <p className="auth-description">
                      <LockIcon />
                      Please authenticate with Facebook to start posting
                    </p>
                  </div>
                )}
              </div>

              <div className="platform-actions">
                {facebookConnected ? (
                  <div className="auth-actions">
                    <button 
                      className="connect-btn"
                      onClick={handleFacebookConnect}
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
                          Post to Facebook
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9,18 15,12 9,6"></polyline>
                          </svg>
                        </>
                      )}
                    </button>
                    <button 
                      className="logout-btn"
                      onClick={handleLogout}
                    >
                      <LogoutIcon />
                      Logout
                    </button>
                  </div>
                ) : (
                  <button 
                    className="connect-btn"
                    onClick={handleFacebookConnect}
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
                        Connect Facebook
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

export default FacebookPage; 