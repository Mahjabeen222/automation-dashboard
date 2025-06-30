import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import './SocialMediaPage.css';

function FacebookPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [availablePages, setAvailablePages] = useState([]);
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('auto');
  const [cardFlipped, setCardFlipped] = useState(false);
  
  // Auto post states
  const [autoFormData, setAutoFormData] = useState({
    prompt: '',
    mediaType: 'none',
    mediaFile: null,
    generatedContent: '',
    isGenerating: false
  });
  
  // Manual post states
  const [manualFormData, setManualFormData] = useState({
    message: '',
    mediaType: 'none',
    mediaFile: null
  });

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);

  // Facebook App Configuration
  const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || '1526961221410200';

  // Icon Components
  const MediaIcon = ({ type }) => {
    switch(type) {
      case 'photo':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
        );
      case 'video':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        );
    }
  };

  // fetchPages function
  const fetchPages = async (accessToken) => {
    if (!accessToken) {
      setConnectionStatus('❌ No Facebook access token found. Please try reconnecting.');
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }
    
    try {
      // Check permissions
      const permissionsResponse = await new Promise((resolve, reject) => {
        window.FB.api('/me/permissions', { access_token: accessToken }, (response) => {
          if (response.error) reject(new Error(response.error.message));
          else resolve(response);
        });
      });
      
      const grantedPermissions = permissionsResponse.data?.filter(p => p.status === 'granted').map(p => p.permission) || [];
      const requiredPermissions = ['pages_show_list', 'pages_manage_posts'];
      const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));
      
      if (missingPermissions.length > 0) {
        setConnectionStatus(`❌ Missing permissions: ${missingPermissions.join(', ')}. Your app needs "Pages API" permissions.`);
        console.error('[fetchPages] Missing required permissions:', missingPermissions);
      }
      
      // Get user info
      const userInfo = await new Promise((resolve, reject) => {
        window.FB.api('/me', { access_token: accessToken, fields: 'id,name,email' }, (response) => {
          if (response.error) reject(new Error(response.error.message));
          else resolve(response);
        });
      });
      
      // Get user's pages
      const pagesResponse = await new Promise((resolve, reject) => {
        window.FB.api('/me/accounts', {
          access_token: accessToken,
          fields: 'id,name,category,access_token,picture,fan_count,tasks'
        }, (response) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
          } else {
            resolve(response);
          }
        });
      });

      const pages = pagesResponse.data || [];
      const mappedPages = pages.map(page => {
        const tasks = page.tasks || [];
        const canPost = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE');
        const canComment = tasks.includes('MODERATE') || tasks.includes('MANAGE');
        
        return {
          id: page.id,
          name: page.name,
          category: page.category || 'Page',
          access_token: page.access_token,
          profilePicture: page.picture?.data?.url || '',
          canPost: canPost,
          canComment: canComment,
          followerCount: page.fan_count || 0
        };
      });

      setAvailablePages(mappedPages);
      
      // Page selection logic
      if (mappedPages.length === 1) {
        setSelectedPage(mappedPages[0]);
        setConnectionStatus(`✅ Connected successfully! 1 page found.`);
      } else if (mappedPages.length > 1) {
        setSelectedPage(null);
        setConnectionStatus(`✅ Connected successfully! ${mappedPages.length} pages found. Please select a page below.`);
      } else {
        // Fallback to user profile if no pages available
        setSelectedPage({
          id: userInfo.id,
          name: userInfo.name,
          access_token: accessToken,
          category: 'Personal Profile',
          profilePicture: '',
          canPost: true,
          canComment: true,
          followerCount: 0
        });
        setConnectionStatus('✅ Connected as personal profile (no pages found).');
      }
      setFacebookConnected(true);
      setCardFlipped(true);
      setIsConnecting(false);
      return { mappedPages, userInfo };
    } catch (error) {
      console.error('Facebook API error:', error);
      setConnectionStatus('❌ Failed to get Facebook data: ' + (error.message || 'Unknown error'));
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }
  };

  // Connect to backend
  const connectToBackend = async (accessToken, userInfo, mappedPages) => {
    try {
      const response = await apiClient.connectFacebook(
        accessToken,
        userInfo?.id,
        mappedPages
      );
      setConnectionStatus('✅ Successfully connected to backend!');
      return response;
    } catch (error) {
      console.error('Backend connection error:', error);
      setConnectionStatus('❌ Backend connection failed: ' + (error.message || 'Unknown error'));
      throw error;
    }
  };

  const handleAutoInputChange = (e) => {
    const { name, value, files } = e.target;
    setAutoFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleManualInputChange = (e) => {
    const { name, value, files } = e.target;
    setManualFormData(prev => ({
      ...prev,
      [name]: files ? files[0] : value
    }));
  };

  const handleMediaTypeChange = (type, formType) => {
    if (formType === 'auto') {
      setAutoFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null
      }));
    } else {
      setManualFormData(prev => ({
        ...prev,
        mediaType: type,
        mediaFile: null
      }));
    }
  };

  // Generate content using AI
  const generatePostContent = async () => {
    if (!autoFormData.prompt.trim()) {
      setConnectionStatus('❌ Please enter a prompt for AI generation');
      return;
    }

    setAutoFormData(prev => ({ ...prev, isGenerating: true }));
    setConnectionStatus('🤖 Generating content with AI...');

    try {
      const response = await apiClient.generateContent(autoFormData.prompt);
      setAutoFormData(prev => ({
        ...prev,
        generatedContent: response.content,
        isGenerating: false
      }));
      setConnectionStatus('✅ Content generated successfully!');
    } catch (error) {
      console.error('Content generation error:', error);
      setConnectionStatus('❌ Failed to generate content: ' + (error.message || 'Unknown error'));
      setAutoFormData(prev => ({ ...prev, isGenerating: false }));
    }
  };

  // Publish post to Facebook
  const publishPost = async () => {
    if (!selectedPage) {
      setConnectionStatus('❌ Please select a page first');
      return;
    }

    const isAutoMode = activeTab === 'auto';
    const content = isAutoMode ? autoFormData.generatedContent : manualFormData.message;
    const mediaType = isAutoMode ? autoFormData.mediaType : manualFormData.mediaType;
    const mediaFile = isAutoMode ? autoFormData.mediaFile : manualFormData.mediaFile;

    if (!content || content.trim() === '') {
      setConnectionStatus('❌ Please enter some content for your post');
      return;
    }

    if (mediaType !== 'none' && !mediaFile) {
      setConnectionStatus('❌ Please select a media file to upload');
      return;
    }

    try {
      setIsPublishing(true);
      setConnectionStatus('🔄 Publishing post to Facebook...');
      
      if (mediaType === 'none') {
        await postTextOnly(content);
      } else {
        await postWithMedia(content, mediaFile, mediaType);
      }

      setConnectionStatus('✅ Post published successfully!');
      
      // Clear form data
      if (isAutoMode) {
        setAutoFormData(prev => ({
          ...prev,
          prompt: '',
          generatedContent: '',
          mediaFile: null,
          mediaType: 'none'
        }));
      } else {
        setManualFormData(prev => ({
          ...prev,
          message: '',
          mediaFile: null,
          mediaType: 'none'
        }));
      }

    } catch (error) {
      console.error('Post publishing error:', error);
      setConnectionStatus('❌ Failed to publish post: ' + (error.message || 'Unknown error'));
    } finally {
      setIsPublishing(false);
    }
  };

  // Post text-only content
  const postTextOnly = async (message) => {
    return new Promise((resolve, reject) => {
      window.FB.api(`/${selectedPage.id}/feed`, 'POST', {
        message: message,
        access_token: selectedPage.access_token
      }, (response) => {
        if (response.error) {
          reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
        } else {
          resolve(response);
        }
      });
    });
  };

  // Post content with media
  const postWithMedia = async (message, file, mediaType) => {
    const fileData = await fileToBase64(file);
    
    if (mediaType === 'photo') {
      return new Promise((resolve, reject) => {
        window.FB.api(`/${selectedPage.id}/photos`, 'POST', {
          caption: message,
          source: fileData,
          access_token: selectedPage.access_token
        }, (response) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
          } else {
            resolve(response);
          }
        });
      });
    } else if (mediaType === 'video') {
      return new Promise((resolve, reject) => {
        window.FB.api(`/${selectedPage.id}/videos`, 'POST', {
          description: message,
          source: fileData,
          access_token: selectedPage.access_token
        }, (response) => {
          if (response.error) {
            reject(new Error(`${response.error.message} (Code: ${response.error.code})`));
          } else {
            resolve(response);
          }
        });
      });
    }
  };

  // Convert file to base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const loginWithFacebook = async () => {
    // Check HTTPS requirement
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setConnectionStatus('❌ Facebook login requires HTTPS. Please use https://localhost:3001 or deploy with HTTPS');
      return;
    }

    // Check backend authentication
    try {
      await apiClient.getCurrentUser();
    } catch (error) {
      setConnectionStatus('❌ Your session has expired. Please log out and log back in to connect Facebook.');
      setTimeout(() => {
        logout();
        navigate('/');
      }, 3000);
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
        if (response.authResponse && response.authResponse.accessToken) {
          setConnectionStatus('✅ Facebook login successful! Fetching pages...');
          
          (async () => {
            try {
              const { mappedPages, userInfo } = await fetchPages(response.authResponse.accessToken);
              
              if (mappedPages.length > 0) {
                setConnectionStatus('🔄 Connecting to backend...');
                const backendResponse = await connectToBackend(response.authResponse.accessToken, userInfo, mappedPages);
                
                if (backendResponse?.data?.pages) {
                  setAvailablePages(mappedPages);
                  setConnectionStatus(`✅ Connected successfully! ${backendResponse.data.pages_connected} pages synchronized with backend.`);
                }
              } else {
                setConnectionStatus('🔄 No pages found in Facebook API. Connecting to backend to check for existing connections...');
                
                try {
                  await connectToBackend(response.authResponse.accessToken, userInfo, []);
                  
                  const existingAccounts = await apiClient.getSocialAccounts();
                  const facebookPages = existingAccounts.filter(acc => 
                    acc.platform === 'facebook' && acc.account_type === 'page' && acc.is_connected
                  );
                  
                  if (facebookPages.length > 0) {
                    const backendMappedPages = facebookPages.map(page => ({
                      id: page.platform_user_id,
                      name: page.display_name,
                      category: page.platform_data?.category || 'Page',
                      access_token: page.access_token || response.authResponse.accessToken,
                      profilePicture: page.profile_picture_url || '',
                      canPost: page.platform_data?.can_post !== false,
                      canComment: page.platform_data?.can_comment !== false,
                      followerCount: page.follower_count || 0
                    }));
                    
                    setAvailablePages(backendMappedPages);
                    setConnectionStatus(`✅ Found ${facebookPages.length} existing page(s) from previous connections!`);
                  } else {
                    setConnectionStatus('⚠️ No pages found. You may need to grant page permissions or create a Facebook page first.');
                  }
                } catch (backendError) {
                  console.error('[FB.login] Backend check failed:', backendError);
                  setConnectionStatus('⚠️ No pages found. You may need to grant page permissions or create a Facebook page first.');
                }
              }
            } catch (error) {
              console.error('[FB.login] Error in page fetching or backend connection:', error);
              setConnectionStatus('❌ Error during setup: ' + (error.message || 'Unknown error'));
              setIsConnecting(false);
              setFacebookConnected(false);
            }
          })();
        } else {
          if (response.status === 'not_authorized') {
            setConnectionStatus('❌ Please authorize the app to continue and select at least one page.');
          } else {
            setConnectionStatus('❌ Facebook login cancelled or failed');
          }
          setIsConnecting(false);
        }
      }, {
        scope: [
          'public_profile',
          'pages_show_list',
          'pages_read_engagement', 
          'pages_manage_posts',
          'pages_manage_engagement',
          'pages_read_user_content',
          'pages_manage_metadata'
        ].join(','),
        enable_profile_selector: true,
        return_scopes: true,
        auth_type: 'rerequest',
        display: 'popup'
      });
    } catch (error) {
      console.error('Facebook login error:', error);
      setConnectionStatus('❌ Facebook login failed: ' + error.message);
    }
  };

  // Clean up Facebook SDK
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

  // Load Facebook SDK
  const loadFacebookSDK = () => {
    return new Promise((resolve, reject) => {
      cleanupFacebookSDK();
      
      window.fbAsyncInit = function () {
        try {
          window.FB.init({
            appId: FACEBOOK_APP_ID,
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

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
      backgroundSize: '400% 400%',
      animation: 'liquidBackground 8s ease infinite',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <style jsx>{`
        @keyframes liquidBackground {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes cardFlip {
          0% { transform: perspective(1000px) rotateY(0deg); }
          50% { transform: perspective(1000px) rotateY(90deg); }
          100% { transform: perspective(1000px) rotateY(0deg); }
        }
        
        @keyframes cardExpand {
          0% { 
            width: 350px; 
            height: 200px; 
            transform: scale(1);
          }
          100% { 
            width: 900px; 
            height: auto; 
            transform: scale(1);
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .flip-card {
          animation: ${cardFlipped ? 'cardFlip 0.8s ease-in-out, cardExpand 0.8s ease-in-out' : 'float 3s ease-in-out infinite'};
        }
        
        .glass-effect {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 
            0 8px 32px 0 rgba(31, 38, 135, 0.37),
            inset 0 1px 1px rgba(255, 255, 255, 0.4);
        }
        
        .button-shimmer {
          background: linear-gradient(90deg, #1877f2, #166fe5, #1877f2);
          background-size: 200% 100%;
          animation: shimmer 2s ease-in-out infinite;
        }
        
        .page-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 
            0 20px 40px rgba(31, 38, 135, 0.3),
            0 0 20px rgba(255, 255, 255, 0.5);
        }
        
        input:focus, textarea:focus {
          outline: none;
          border: 2px solid rgba(59, 130, 246, 0.6);
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        }
      `}</style>

      {/* Status Card */}
      {connectionStatus && (
        <div className="glass-effect" style={{ 
          padding: '1rem 1.5rem',
          borderRadius: '20px',
          marginBottom: '2rem',
          color: '#2d3748',
          fontWeight: '500',
          animation: 'pulse 2s ease-in-out infinite',
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          {connectionStatus}
        </div>
      )}

      {/* Main Card */}
      <div 
        className="flip-card glass-effect"
        style={{ 
          width: facebookConnected ? 'auto' : '350px',
          height: facebookConnected ? 'auto' : '200px',
          maxWidth: facebookConnected ? '900px' : '350px',
          borderRadius: '25px',
          padding: facebookConnected ? '2.5rem' : '2rem',
          transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          transformStyle: 'preserve-3d'
        }}
      >
        {!facebookConnected ? (
          /* Connect Card */
          <div style={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="#1877f2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            
            <button 
              onClick={loginWithFacebook} 
              disabled={isConnecting}
              className="button-shimmer"
              style={{ 
                padding: '0.875rem 2rem',
                fontSize: '1.125rem',
                color: 'white',
                border: 'none',
                borderRadius: '15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontWeight: '600',
                transition: 'all 0.3s ease',
                boxShadow: '0 10px 30px rgba(24, 119, 242, 0.4)',
                opacity: isConnecting ? 0.7 : 1,
                transform: isConnecting ? 'scale(0.95)' : 'scale(1)'
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              {isConnecting ? 'Connecting...' : 'Connect Facebook'}
            </button>
          </div>
        ) : (
          /* Connected Content */
          <div style={{ width: '100%' }}>
            {/* Pages Grid */}
            {availablePages.length > 0 && (
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {availablePages.map(page => (
                  <div
                    key={page.id}
                    onClick={() => {
                      setSelectedPage(page);
                      setConnectionStatus(`✅ Connected to ${page.name}`);
                    }}
                    className="page-card glass-effect"
                    style={{
                      padding: '1.5rem',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: selectedPage?.id === page.id ? 
                        '2px solid rgba(59, 130, 246, 0.6)' : 
                        '1px solid rgba(255, 255, 255, 0.18)',
                      background: selectedPage?.id === page.id ? 
                        'rgba(59, 130, 246, 0.1)' : 
                        'rgba(255, 255, 255, 0.25)',
                      color: '#2d3748'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {page.profilePicture ? (
                        <img 
                          src={page.profilePicture} 
                          alt=""
                          style={{
                            width: '3rem',
                            height: '3rem',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid rgba(255, 255, 255, 0.5)',
                            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '3rem',
                          height: '3rem',
                          borderRadius: '50%',
                          background: 'rgba(24, 119, 242, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '3px solid rgba(255, 255, 255, 0.5)'
                        }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877f2">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                      )}
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#1a202c', fontWeight: '700' }}>
                          {page.name}
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#4a5568' }}>
                          {page.followerCount.toLocaleString()} followers
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Post Creation Section */}
            {selectedPage && (
              <div className="glass-effect" style={{ 
                padding: '2rem',
                borderRadius: '20px',
                background: 'rgba(255, 255, 255, 0.35)'
              }}>
                {/* Tabs */}
                <div style={{ 
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '2rem'
                }}>
                  {['auto', 'manual'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '0.875rem 1.5rem',
                        background: activeTab === tab ? 
                          'rgba(59, 130, 246, 0.8)' : 
                          'rgba(255, 255, 255, 0.5)',
                        color: activeTab === tab ? 'white' : '#374151',
                        border: 'none',
                        borderRadius: '15px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        fontWeight: '600',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: activeTab === tab ? 
                          '0 8px 25px rgba(59, 130, 246, 0.4)' : 
                          '0 4px 15px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      {tab === 'auto' ? '🤖 AI Post' : '✍️ Manual Post'}
                    </button>
                  ))}
                </div>

                {/* Content Area */}
                <div style={{ marginBottom: '2rem' }}>
                  <textarea
                    value={activeTab === 'auto' ? autoFormData.prompt : manualFormData.message}
                    onChange={activeTab === 'auto' ? handleAutoInputChange : handleManualInputChange}
                    name={activeTab === 'auto' ? 'prompt' : 'message'}
                    placeholder={activeTab === 'auto' ? 
                      '✨ Describe what you want to post and let AI create it for you...' : 
                      '📝 Write your post content here...'}
                    style={{
                      width: '100%',
                      minHeight: '140px',
                      padding: '1.25rem',
                      borderRadius: '15px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      background: 'rgba(255, 255, 255, 0.7)',
                      color: '#1a202c',
                      resize: 'vertical',
                      fontSize: '1rem',
                      transition: 'all 0.3s ease',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Media Options */}
                <div style={{ 
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '2rem',
                  flexWrap: 'wrap'
                }}>
                  {['none', 'photo', 'video'].map(type => (
                    <button
                      key={type}
                      onClick={() => handleMediaTypeChange(type, activeTab)}
                      style={{
                        padding: '0.875rem 1.25rem',
                        background: (activeTab === 'auto' ? autoFormData.mediaType : manualFormData.mediaType) === type ?
                          'rgba(16, 185, 129, 0.8)' :
                          'rgba(255, 255, 255, 0.6)',
                        border: 'none',
                        borderRadius: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: (activeTab === 'auto' ? autoFormData.mediaType : manualFormData.mediaType) === type ? 'white' : '#374151',
                        transition: 'all 0.3s ease',
                        fontWeight: '600',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: (activeTab === 'auto' ? autoFormData.mediaType : manualFormData.mediaType) === type ?
                          '0 8px 25px rgba(16, 185, 129, 0.4)' :
                          '0 4px 15px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <MediaIcon type={type} />
                      {type === 'none' ? 'Text Only' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Action Buttons */}
                <div style={{ 
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap'
                }}>
                  {activeTab === 'auto' && (
                    <button
                      onClick={generatePostContent}
                      disabled={autoFormData.isGenerating || !autoFormData.prompt.trim()}
                      style={{
                        padding: '1rem 2rem',
                        background: autoFormData.isGenerating ? 
                          'rgba(16, 185, 129, 0.6)' : 
                          'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '15px',
                        cursor: 'pointer',
                        opacity: autoFormData.isGenerating || !autoFormData.prompt.trim() ? 0.6 : 1,
                        transition: 'all 0.3s ease',
                        fontWeight: '600',
                        fontSize: '1rem',
                        boxShadow: '0 8px 25px rgba(16, 185, 129, 0.4)',
                        transform: autoFormData.isGenerating ? 'scale(0.95)' : 'scale(1)'
                      }}
                    >
                      {autoFormData.isGenerating ? '🔄 Generating...' : '✨ Generate Content'}
                    </button>
                  )}
                  
                  <button
                    onClick={publishPost}
                    disabled={isPublishing || (activeTab === 'auto' ? !autoFormData.generatedContent : !manualFormData.message)}
                    style={{
                      padding: '1rem 2rem',
                      background: isPublishing ? 
                        'rgba(59, 130, 246, 0.6)' : 
                        'linear-gradient(135deg, #3b82f6, #2563eb)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '15px',
                      cursor: 'pointer',
                      opacity: isPublishing || (activeTab === 'auto' ? !autoFormData.generatedContent : !manualFormData.message) ? 0.6 : 1,
                      transition: 'all 0.3s ease',
                      fontWeight: '600',
                      fontSize: '1rem',
                      boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                      transform: isPublishing ? 'scale(0.95)' : 'scale(1)'
                    }}
                  >
                    {isPublishing ? '🚀 Publishing...' : '📢 Publish Post'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FacebookPage;