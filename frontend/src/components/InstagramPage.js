import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import './InstagramPage.css';

const InstagramPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [fbAccessToken, setFbAccessToken] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [userMedia, setUserMedia] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [activeTab, setActiveTab] = useState('connect');


  // Instagram App ID (different from Facebook App ID)
  const INSTAGRAM_APP_ID = process.env.REACT_APP_INSTAGRAM_APP_ID || '697225659875731';

  useEffect(() => {
    const checkLoginStatus = () => {
      if (!window.FB || !isAuthenticated) return;
      
      window.FB.getLoginStatus((response) => {
        if (response.status === 'connected') {
          setFbAccessToken(response.authResponse.accessToken);
          setMessage('Instagram: Using existing Facebook login session');
          // Auto-connect Instagram accounts if we have a token
          handleConnectInstagram(response.authResponse.accessToken);
        } else {
          setMessage('Instagram: Please connect your Facebook account to continue');
        }
      });
    };

    const initializeFacebookSDK = () => {
      // Always reinitialize with Instagram App ID to avoid conflicts
      if (window.FB) {
        // SDK already exists, reinitialize with Instagram App ID
        window.FB.init({
          appId: INSTAGRAM_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        setSdkLoaded(true);
        checkLoginStatus();
        return;
      }

      // Load FB SDK for the first time
      window.fbAsyncInit = function() {
        window.FB.init({
          appId: INSTAGRAM_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
        setSdkLoaded(true);
        checkLoginStatus();
      };

      // Load the SDK script
      (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s); js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode.insertBefore(js, fjs);
      }(document, 'script', 'facebook-jssdk'));
    };

    initializeFacebookSDK();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [INSTAGRAM_APP_ID, isAuthenticated]);

  const handleConnectInstagram = async (accessToken = fbAccessToken) => {
    if (!isAuthenticated) {
      setMessage('Please log in to your account first before connecting Instagram.');
      setLoading(false);
      return;
    }

    if (!accessToken) {
      setMessage('No access token available. Please log in with Facebook first.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setMessage('Fetching Instagram Business accounts...');
      
      const response = await apiClient.connectInstagram(accessToken);

      if (response.success && response.data && response.data.accounts && response.data.accounts.length > 0) {
        // Map the backend response to match our frontend expectations
        const mappedAccounts = response.data.accounts.map(account => ({
          id: account.platform_id,
          username: account.username,
          name: account.display_name || account.page_name,
          followers_count: account.followers_count || 0,
          media_count: account.media_count || 0,
          profile_picture_url: account.profile_picture
        }));
        
        setInstagramAccounts(mappedAccounts);
        setIsConnected(true);
        setActiveTab('post');
        setMessage(`Found ${mappedAccounts.length} Instagram Business account(s)!`);
        
        // Auto-select first account if only one
        if (mappedAccounts.length === 1) {
          setSelectedAccount(mappedAccounts[0].id);
          loadUserMedia(mappedAccounts[0].id);
        }
      } else {
        setMessage('No Instagram Business accounts found. Make sure you have an Instagram Business account connected to your Facebook Page.');
      }
    } catch (error) {
      console.error('Instagram connection error:', error);
      
      // Extract and display error message
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle various error object formats
        errorMessage = error.message || error.detail || error.error || JSON.stringify(error);
      }
      
      // Display error with proper formatting for troubleshooting steps
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = () => {
    if (!window.FB) {
      setMessage('Facebook SDK not loaded');
      return;
    }

    setLoading(true);
    setMessage('Initiating Instagram OAuth via Facebook...');

    // Instagram requires specific permissions
    window.FB.login((response) => {
      if (response.status === 'connected') {
        const accessToken = response.authResponse.accessToken;
        setFbAccessToken(accessToken);
        setMessage('Facebook login successful! Connecting Instagram accounts...');
        handleConnectInstagram(accessToken);
      } else {
        setMessage('Facebook login failed or was cancelled');
        setLoading(false);
      }
    }, {
      scope: 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement'
    });
  };

  const handleGenerateAIPost = async () => {
    if (!selectedAccount) {
      setMessage('Please select an Instagram account first');
      return;
    }

    setGeneratingAI(true);
    setMessage('Generating AI post...');

    try {
      const response = await apiClient.createInstagramPost({
        instagram_user_id: selectedAccount,
        use_ai: true,
        prompt: 'Create an engaging Instagram post',
        post_type: 'post-auto'
      });

      if (response.success) {
        setPostContent(response.data?.generated_caption || response.ai_content || '');
        setMessage('AI post generated successfully!');
      } else {
        setMessage(`Failed to generate AI post: ${response.error}`);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setMessage(`Error generating AI post: ${error.message || 'Unknown error'}`);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleCreatePost = async () => {
    if (!selectedAccount || !postContent.trim()) {
      setMessage('Please select an account and enter post content');
      return;
    }

    setLoading(true);
    setMessage('Creating Instagram post...');

    try {
      // Debug: Log the backend connection first
      console.log('🔍 DEBUG: Testing backend connection...');
      const testConnection = await apiClient.testConnection();
      console.log('🔍 DEBUG: Backend connection test result:', testConnection);
      
      if (!testConnection) {
        throw new Error('Backend server is not responding. Please make sure the backend is running on http://localhost:8000');
      }

      let response;
      
      if (postImage) {
        // For now, file uploads are not supported - show message
        setMessage('File uploads are not yet supported. Please use text-only posts for now.');
        setLoading(false);
        return;
      } else {
        // Use JSON for text-only posts
        console.log('🔍 DEBUG: Sending JSON request without image...');
        response = await apiClient.createInstagramPost({
          instagram_user_id: selectedAccount,
          caption: postContent,
          use_ai: false,
          post_type: 'manual'
        });
      }

      if (response.success) {
        setMessage('Instagram post created successfully!');
        setPostContent('');
        setPostImage(null);
        // Refresh media after posting
        if (selectedAccount) {
          loadUserMedia(selectedAccount);
        }
      } else {
        setMessage(`Failed to create post: ${response.error}`);
      }
    } catch (error) {
      console.error('Post creation error:', error);
      
      // Enhanced error messaging
      let errorMessage = 'Unknown error occurred';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === 'TypeError' && error.message?.includes('Failed to fetch')) {
        errorMessage = 'Backend connection failed. Please check:\n1. Backend server is running on http://localhost:8000\n2. CORS is properly configured\n3. Your network connection is working';
      }
      
      setMessage(`Error creating post: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const loadUserMedia = async (instagramUserId) => {
    setLoadingMedia(true);
    try {
      const media = await apiClient.getInstagramMedia(instagramUserId);
      setUserMedia(media || []);
    } catch (error) {
      console.error('Error loading media:', error);
      setMessage(`Error loading media: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleAccountChange = (accountId) => {
    setSelectedAccount(accountId);
    if (accountId) {
      loadUserMedia(accountId);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPostImage(file);
    }
  };

  const handleLogout = () => {
    if (window.FB) {
      window.FB.logout(() => {
        setIsConnected(false);
        setInstagramAccounts([]);
        setSelectedAccount('');
        setFbAccessToken(null);
        setUserMedia([]);
        setActiveTab('connect');
        setMessage('Logged out successfully');
      });
    }
  };

  if (authLoading) {
    return (
      <div className="instagram-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="instagram-container">
        <div className="header-section">
          <button onClick={() => navigate('/')} className="back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Dashboard
          </button>
          <h1>Instagram Management</h1>
          <p>Please log in to your account to connect and manage Instagram.</p>
        </div>
        <div className="auth-required">
          <div className="auth-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <circle cx="12" cy="16" r="1"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h2>Authentication Required</h2>
          <p>You need to be logged in to use Instagram features. Please log in first.</p>
        </div>
      </div>
    );
  }

  if (!sdkLoaded) {
    return (
      <div className="instagram-container">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p>Loading Instagram SDK...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="instagram-container">
      <div className="header-section">
        <button onClick={() => navigate('/')} className="back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </button>
        <div className="header-content">
          <div className="header-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </div>
          <div className="header-text">
            <h1>Instagram Management</h1>
            <p>Connect and manage your Instagram Business accounts</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`status-message ${message.includes('Error') || message.includes('Failed') ? 'error' : message.includes('success') ? 'success' : 'info'}`}>
          <div className="message-content">
            <span className="message-text">{message}</span>
          </div>
        </div>
      )}

      <div className="main-content">
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'connect' ? 'active' : ''}`}
            onClick={() => setActiveTab('connect')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h4v4M16 4l4 4M8 20H4v-4M8 20l-4-4"/>
            </svg>
            Connect Account
          </button>

          <button 
            className={`tab-button ${activeTab === 'post' ? 'active' : ''}`}
            onClick={() => setActiveTab('post')}
            disabled={!isConnected}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3h18v18H3zM9 9h6v6H9z"/>
            </svg>
            Create Post
          </button>

          <button 
            className={`tab-button ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
            disabled={!isConnected || !selectedAccount}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            Media Gallery
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'connect' && (
            <div className="connect-section">
              {!isConnected ? (
                <div className="connection-card">
                  <div className="connection-icon">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                      <circle cx="12" cy="12" r="4"/>
                      <path d="M17.5 6.5h.01"/>
                    </svg>
                  </div>
                  <h2>Connect Instagram Account</h2>
                  <p>Connect your Instagram Business account through Facebook to start posting and managing content.</p>
                  
                  <button 
                    onClick={handleFacebookLogin} 
                    disabled={loading}
                    className="connect-main-button"
                  >
                    {loading ? (
                      <>
                        <div className="button-spinner"></div>
                        Connecting...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Connect via Facebook
                      </>
                    )}
                  </button>

                  <div className="requirements-card">
                    <h3>Requirements</h3>
                    <ul>
                      <li>Instagram Business or Creator account</li>
                      <li>Connected to a Facebook Page</li>
                      <li>Admin access to the Facebook Page</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="connected-accounts">
                  <div className="accounts-header">
                    <h2>Connected Instagram Accounts</h2>
                    <button onClick={handleLogout} className="logout-button">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16,17 21,12 16,7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Disconnect
                    </button>
                  </div>
                  
                  <div className="accounts-grid">
                    {instagramAccounts.map(account => (
                      <div 
                        key={account.id} 
                        className={`account-card ${selectedAccount === account.id ? 'selected' : ''}`}
                        onClick={() => handleAccountChange(account.id)}
                      >
                        <div className="account-avatar">
                          {account.profile_picture_url ? (
                            <img src={account.profile_picture_url} alt={account.username} />
                          ) : (
                            <div className="avatar-placeholder">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                <circle cx="12" cy="7" r="4"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="account-info">
                          <h3>@{account.username}</h3>
                          <p>{account.name}</p>
                          <div className="account-stats">
                            <span>{account.followers_count} followers</span>
                            <span>{account.media_count} posts</span>
                          </div>
                        </div>
                        {selectedAccount === account.id && (
                          <div className="selected-indicator">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20,6 9,17 4,12"/>
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'post' && selectedAccount && (
            <div className="post-section">
              <div className="post-card">
                <div className="post-header">
                  <h2>Create Instagram Post</h2>
                  <p>Create engaging content for your Instagram audience</p>
                </div>



                <div className="post-form">
                  <div className="form-group">
                    <label htmlFor="caption">Caption</label>
                    <textarea
                      id="caption"
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      placeholder="Write your Instagram caption..."
                      rows="6"
                      className="post-textarea"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="image">Image (Optional)</label>
                    <div className="image-upload">
                      <input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="file-input"
                      />
                      <label htmlFor="image" className="file-label">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="9" cy="9" r="2"/>
                          <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                        </svg>
                        {postImage ? postImage.name : 'Choose Image'}
                      </label>
                    </div>
                  </div>

                  <button 
                    onClick={handleCreatePost}
                    disabled={loading || !postContent.trim()}
                    className="publish-button"
                  >
                    {loading ? (
                      <>
                        <div className="button-spinner"></div>
                        Publishing...
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                        Publish Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'media' && selectedAccount && (
            <div className="media-section">
              <div className="media-header">
                <h2>Recent Posts</h2>
                <p>Your latest Instagram content</p>
              </div>
              
              {loadingMedia ? (
                <div className="loading-media">
                  <div className="loading-spinner"></div>
                  <p>Loading media...</p>
                </div>
              ) : userMedia.length > 0 ? (
                <div className="media-grid">
                  {userMedia.slice(0, 12).map((media) => (
                    <div key={media.id} className="media-item">
                      <div className="media-content">
                        {media.media_type === 'IMAGE' ? (
                          <img src={media.media_url} alt="Instagram post" />
                        ) : media.media_type === 'VIDEO' ? (
                          <video controls>
                            <source src={media.media_url} type="video/mp4" />
                          </video>
                        ) : null}
                      </div>
                      <div className="media-overlay">
                        <div className="media-info">
                          <p className="media-caption">
                            {media.caption ? media.caption.substring(0, 100) + '...' : 'No caption'}
                          </p>
                          <p className="media-date">
                            {new Date(media.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-media">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                  <h3>No Media Found</h3>
                  <p>No media found for this account. Start creating posts to see them here!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramPage; 