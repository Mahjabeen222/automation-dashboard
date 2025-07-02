import React, { useState, useEffect } from 'react';
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
  const [existingConnections, setExistingConnections] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  // Auto post states
  const [autoFormData, setAutoFormData] = useState({
    prompt: '',
    mediaType: 'none',
    mediaFile: null,
    generatedContent: '',
    isGenerating: false
  });
  
  // Scheduling states
  const [isScheduleMode, setIsScheduleMode] = useState(false);
  const [scheduleData, setScheduleData] = useState({
    prompt: '',
    time: '',
    frequency: 'daily', // daily, weekly, monthly
    isActive: false,
    scheduleId: null
  });
  
  // Manual post states
  const [manualFormData, setManualFormData] = useState({
    message: '',
    mediaType: 'none',
    mediaFile: null
  });

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  
  // Posts history
  const [postHistory, setPostHistory] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // Facebook App Configuration
  const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || '1526961221410200';

  // Check for existing Facebook connections on component mount
  useEffect(() => {
    checkExistingFacebookConnections();
  }, []);

  // Cleanup on component unmount to prevent DOM errors
  useEffect(() => {
    return () => {
      // Clean up any pending operations
      setIsConnecting(false);
      setIsPublishing(false);
      setIsLoggingOut(false);
      setIsCheckingStatus(false);
    };
  }, []);

  const checkExistingFacebookConnections = async () => {
    try {
      setIsCheckingStatus(true);
      const response = await apiClient.getFacebookStatus();
      
      if (response.connected) {
        setExistingConnections(response);
        setFacebookConnected(true);
        
        // Convert backend data to frontend format for compatibility
        const pagesFromBackend = response.accounts.pages.map(page => ({
          id: page.platform_id,
          name: page.name,
          category: page.category,
          access_token: '', // Don't expose tokens in frontend
          profilePicture: page.profile_picture || '',
          canPost: page.can_post,
          canComment: page.can_comment,
          followerCount: page.follower_count
        }));
        
        setAvailablePages(pagesFromBackend);
        
        if (pagesFromBackend.length === 1) {
          setSelectedPage(pagesFromBackend[0]);
        }
        
        setCardFlipped(true);
        setConnectionStatus(`Connected! ${response.pages_count} Facebook page(s) available.`);
      } else {
        setConnectionStatus('Ready to connect your Facebook account');
      }
    } catch (error) {
      console.error('Error checking Facebook status:', error);
      setConnectionStatus('Unable to check Facebook connection status');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleFacebookLogout = async () => {
    try {
      setIsLoggingOut(true);
      setConnectionStatus('Disconnecting from Facebook...');
      
      const response = await apiClient.logoutFacebook();
      
      // Reset all Facebook-related state
      setFacebookConnected(false);
      setExistingConnections(null);
      setAvailablePages([]);
      setSelectedPage(null);
      setCardFlipped(false);
      setPostHistory([]);
      
      setConnectionStatus('Successfully disconnected from Facebook');
      
      // Clear the message after a few seconds
      setTimeout(() => {
        setConnectionStatus('Ready to connect your Facebook account');
      }, 3000);
      
    } catch (error) {
      console.error('Error logging out from Facebook:', error);
      setConnectionStatus('Failed to disconnect from Facebook: ' + error.message);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Load post history
  const loadPostHistory = async () => {
    if (!selectedPage) return;
    
    try {
      setIsLoadingPosts(true);
      const response = await apiClient.getSocialPosts('facebook');
      setPostHistory(response.slice(0, 10)); // Show last 10 posts
    } catch (error) {
      console.error('Error loading post history:', error);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  // Load posts when page is selected
  useEffect(() => {
    if (selectedPage && facebookConnected) {
      loadPostHistory();
    }
  }, [selectedPage, facebookConnected]);

  // Handle schedule activation/deactivation
  const handleScheduleToggle = async () => {
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    if (!scheduleData.prompt || !scheduleData.time) {
      setConnectionStatus('Please fill in prompt and time before activating schedule');
      return;
    }

    try {
      if (!scheduleData.isActive) {
        // Activating schedule - create scheduled post
        setConnectionStatus('Creating scheduled post...');
        
        const response = await apiClient.createScheduledPost({
          prompt: scheduleData.prompt,
          post_time: scheduleData.time,
          frequency: scheduleData.frequency,
          social_account_id: selectedPage.id
        });

        setScheduleData(prev => ({ 
          ...prev, 
          isActive: true,
          scheduleId: response.data.id
        }));
        
        setConnectionStatus('Schedule activated successfully! Posts will be published automatically.');
        
        // Load post history to show scheduled posts
        setTimeout(() => {
          loadPostHistory();
        }, 1000);
        
      } else {
        // Deactivating schedule - delete scheduled post
        if (scheduleData.scheduleId) {
          setConnectionStatus('Deactivating schedule...');
          
          await apiClient.deleteScheduledPost(scheduleData.scheduleId);
          
          setConnectionStatus('Schedule deactivated successfully');
        }
        
        setScheduleData(prev => ({ 
          ...prev, 
          isActive: false,
          scheduleId: null
        }));
      }
      
    } catch (error) {
      console.error('Schedule toggle error:', error);
      setConnectionStatus('Failed to update schedule: ' + (error.message || 'Unknown error'));
    }
  };

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
      setConnectionStatus('No Facebook access token found. Please try reconnecting.');
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
        setConnectionStatus(`Missing permissions: ${missingPermissions.join(', ')}. Your app needs "Pages API" permissions.`);
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
        setConnectionStatus(`Connected successfully! 1 page found.`);
      } else if (mappedPages.length > 1) {
        setSelectedPage(null);
        setConnectionStatus(`Connected successfully! ${mappedPages.length} pages found. Please select a page below.`);
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
        setConnectionStatus('Connected as personal profile (no pages found).');
      }
      setFacebookConnected(true);
      setCardFlipped(true);
      setIsConnecting(false);
      return { mappedPages, userInfo };
    } catch (error) {
      console.error('Facebook API error:', error);
      setConnectionStatus('Failed to get Facebook data: ' + (error.message || 'Unknown error'));
      setIsConnecting(false);
      setFacebookConnected(false);
      return { mappedPages: [], userInfo: null };
    }
  };

  // Connect to backend
  const connectToBackend = async (accessToken, userInfo, pages) => {
    try {
      const response = await apiClient.connectFacebook(accessToken, userInfo.id, pages);
      
      if (response.data?.data?.token_type === 'long_lived_user_token') {
        const expiresAt = response.data.data.token_expires_at;
        if (expiresAt) {
          const expiryDate = new Date(expiresAt);
          setConnectionStatus(`Connected with long-lived token (expires: ${expiryDate.toLocaleDateString()})`);
        } else {
          setConnectionStatus('Connected with long-lived token');
        }
      }
      
      return response;
    } catch (error) {
      console.error('Backend connection error:', error);
      
      if (error.response?.status === 401) {
        setConnectionStatus('Your session has expired. Please log out and log back in to connect Facebook.');
        setTimeout(() => {
          logout();
          navigate('/');
        }, 3000);
      } else if (error.response?.data?.detail?.includes('long-lived token')) {
        setConnectionStatus('Failed to get long-lived Facebook token. Please try reconnecting.');
      } else {
        setConnectionStatus('Failed to connect to backend: ' + (error.response?.data?.detail || error.message));
      }
      
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
      setConnectionStatus('Please enter a prompt for AI generation');
      return;
    }

    setAutoFormData(prev => ({ ...prev, isGenerating: true }));
    setConnectionStatus('Generating content with AI...');

    try {
      const response = await apiClient.generateContent(autoFormData.prompt);
      setAutoFormData(prev => ({
        ...prev,
        generatedContent: response.content,
        isGenerating: false
      }));
      setConnectionStatus('Content generated successfully!');
    } catch (error) {
      console.error('Content generation error:', error);
      setConnectionStatus('Failed to generate content: ' + (error.message || 'Unknown error'));
      setAutoFormData(prev => ({ ...prev, isGenerating: false }));
    }
  };

  // Publish post to Facebook
  const publishPost = async () => {
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    const isAutoMode = activeTab === 'auto';
    const content = isAutoMode ? autoFormData.generatedContent : manualFormData.message;
    const mediaType = isAutoMode ? autoFormData.mediaType : manualFormData.mediaType;
    const mediaFile = isAutoMode ? autoFormData.mediaFile : manualFormData.mediaFile;

    if (!content || content.trim() === '') {
      setConnectionStatus('Please enter some content for your post');
      return;
    }

    if (mediaType !== 'none' && !mediaFile) {
      setConnectionStatus('Please select a media file to upload');
      return;
    }

    try {
      setIsPublishing(true);
      setConnectionStatus('Publishing post to Facebook...');
      
      // Ensure Facebook SDK is initialized and ready
      if (!window.FB) {
        console.log('Facebook SDK not found, initializing...');
        await loadFacebookSDK();
      }
      
      // Verify SDK is properly initialized
      if (!window.FB || !window.FB.api || !window.FB.getLoginStatus) {
        throw new Error('Facebook SDK not properly initialized');
      }
      
      // Check login status before posting
      const loginStatus = await new Promise((resolve) => {
        window.FB.getLoginStatus(resolve, true);
      });
      
      if (loginStatus.status !== 'connected') {
        throw new Error('Facebook login session expired. Please reconnect your account.');
      }
      
      console.log('Facebook SDK ready for posting');
      
      if (mediaType === 'none') {
        await postTextOnly(content);
      } else {
        await postWithMedia(content, mediaFile, mediaType);
      }

      setConnectionStatus('Post published successfully!');
      
      // Reload post history
      setTimeout(() => {
        loadPostHistory();
      }, 1000);
      
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
      setConnectionStatus('Failed to publish post: ' + (error.message || 'Unknown error'));
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
      setConnectionStatus('Facebook login requires HTTPS. Please use https://localhost:3001 or deploy with HTTPS');
      return;
    }

    // Check backend authentication
    try {
      await apiClient.getCurrentUser();
    } catch (error) {
      setConnectionStatus('Your session has expired. Please log out and log back in to connect Facebook.');
      setTimeout(() => {
        logout();
        navigate('/');
      }, 3000);
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('Loading Facebook SDK...');

    try {
      await loadFacebookSDK();

      if (!window.FB || typeof window.FB.login !== 'function') {
        setConnectionStatus('Facebook SDK failed to load. Please refresh the page and try again.');
        setIsConnecting(false);
        return;
      }

      setConnectionStatus('Connecting to Facebook...');
      
      window.FB.login((response) => {
        if (response.authResponse && response.authResponse.accessToken) {
          setConnectionStatus('Facebook login successful! Fetching pages...');
          
          (async () => {
            try {
              const { mappedPages, userInfo } = await fetchPages(response.authResponse.accessToken);
              
              if (mappedPages.length > 0) {
                setConnectionStatus('Connecting to backend...');
                const backendResponse = await connectToBackend(response.authResponse.accessToken, userInfo, mappedPages);
                
                if (backendResponse?.data?.pages) {
                  setAvailablePages(mappedPages);
                  setConnectionStatus(`Connected successfully! ${backendResponse.data.pages_connected} pages synchronized with backend.`);
                }
              } else {
                setConnectionStatus('No pages found in Facebook API. Connecting to backend to check for existing connections...');
                
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
                    setConnectionStatus(`Found ${facebookPages.length} existing page(s) from previous connections!`);
                  } else {
                    setConnectionStatus('No pages found. You may need to grant page permissions or create a Facebook page first.');
                  }
                } catch (backendError) {
                  console.error('[FB.login] Backend check failed:', backendError);
                  setConnectionStatus('No pages found. You may need to grant page permissions or create a Facebook page first.');
                }
              }
            } catch (error) {
              console.error('[FB.login] Error in page fetching or backend connection:', error);
              setConnectionStatus('Error during setup: ' + (error.message || 'Unknown error'));
              setIsConnecting(false);
              setFacebookConnected(false);
            }
          })();
        } else {
          if (response.status === 'not_authorized') {
            setConnectionStatus('Please authorize the app to continue and select at least one page.');
          } else {
            setConnectionStatus('Facebook login cancelled or failed');
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
      setConnectionStatus('Facebook login failed: ' + error.message);
    }
  };

  // Clean up Facebook SDK - safer approach
  const cleanupFacebookSDK = () => {
    try {
      // Clear Facebook objects without DOM manipulation
      if (window.FB) {
        try {
          if (window.FB.getLoginStatus) {
            window.FB.logout();
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        delete window.FB;
      }
      
      if (window.fbAsyncInit) {
        delete window.fbAsyncInit;
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  };

  // Load Facebook SDK with multiple version fallbacks
  const loadFacebookSDK = () => {
    return new Promise((resolve, reject) => {
      cleanupFacebookSDK();
      
      // Try multiple API versions in order of preference
      const versions = ['v21.0', 'v20.0', 'v19.0', 'v18.0'];
      let currentVersionIndex = 0;
      
              const tryInitialization = () => {
        const version = versions[currentVersionIndex];
        
        window.fbAsyncInit = function () {
          try {
            window.FB.init({
              appId: FACEBOOK_APP_ID,
              cookie: true,
              xfbml: true,
              version: version,
              status: true
            });
            
            console.log(`Facebook SDK initialized successfully with ${version}`);
            
            // Test if the SDK is working
            window.FB.getLoginStatus(function(response) {
              console.log('Facebook SDK test successful:', response.status);
              resolve();
            }, true);
            
          } catch (error) {
            console.error(`Facebook SDK initialization failed with ${version}:`, error);
            
            // Try next version
            currentVersionIndex++;
            if (currentVersionIndex < versions.length) {
              console.log(`Trying Facebook SDK version ${versions[currentVersionIndex]}...`);
              setTimeout(tryInitialization, 500);
            } else {
              reject(new Error('All Facebook SDK versions failed to initialize'));
            }
          }
        };

        // Safer script loading - only add if not already present
        if (!document.getElementById('facebook-jssdk')) {
          const script = document.createElement('script');
          script.id = 'facebook-jssdk';
          script.src = 'https://connect.facebook.net/en_US/sdk.js';
          script.async = true;
          script.defer = true;
          script.crossOrigin = 'anonymous';
          script.onerror = () => {
            console.error(`Failed to load Facebook SDK script for ${version}`);
            
            // Try next version
            currentVersionIndex++;
            if (currentVersionIndex < versions.length) {
              console.log(`Trying Facebook SDK version ${versions[currentVersionIndex]}...`);
              setTimeout(tryInitialization, 500);
            } else {
              reject(new Error('Failed to load Facebook SDK script'));
            }
          };
          
          document.body.appendChild(script);
        }
      };

      tryInitialization();
    });
  };

  // Add refresh tokens function
  const refreshTokens = async () => {
    try {
      setConnectionStatus('Refreshing Facebook tokens...');
      const response = await apiClient.refreshFacebookTokens();
      
      if (response.data.summary.expired > 0) {
        setConnectionStatus(`Token refresh complete. ${response.data.summary.expired} account(s) need reconnection.`);
        setFacebookConnected(false);
        // Trigger a status check to update the UI
        setTimeout(() => {
          checkExistingFacebookConnections();
        }, 1000);
      } else {
        setConnectionStatus(`All tokens are valid. ${response.data.summary.valid} account(s) verified.`);
        checkExistingFacebookConnections();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      if (error.response?.status === 401) {
        setConnectionStatus('Your session has expired. Please log out and log back in.');
        setTimeout(() => {
          logout();
          navigate('/');
        }, 3000);
      } else {
        setConnectionStatus('Failed to refresh tokens: ' + (error.response?.data?.detail || error.message));
      }
    }
  };

  // Update handleCreatePost to handle token expiration errors better
  const handleCreatePost = async (e) => {
    e.preventDefault();
    
    if (!selectedPage) {
      setConnectionStatus('Please select a page first');
      return;
    }

    setIsPublishing(true);
    setConnectionStatus('Creating post...');

    try {
      const currentMessage = activeTab === 'auto' ? autoFormData.generatedContent || autoFormData.prompt : manualFormData.message;
      const currentMediaFile = activeTab === 'auto' ? autoFormData.mediaFile : manualFormData.mediaFile;
      
      const response = await apiClient.createFacebookPost({
        page_id: selectedPage.id,
        message: currentMessage,
        image: currentMediaFile || null,
        post_type: activeTab === 'auto' ? 'auto-generated' : 'manual'
      });

      setConnectionStatus(response.data.message);
      
      // Clear the form data
      if (activeTab === 'auto') {
        setAutoFormData(prev => ({ ...prev, prompt: '', generatedContent: '', mediaFile: null }));
      } else {
        setManualFormData(prev => ({ ...prev, message: '', mediaFile: null }));
      }
      
      // Refresh posts
      setTimeout(() => {
        loadPostHistory();
      }, 1000);
      
    } catch (error) {
      console.error('Post creation error:', error);
      
      if (error.response?.status === 401 || error.response?.data?.detail?.includes('expired')) {
        setConnectionStatus('Facebook session expired. Please reconnect your account.');
        setFacebookConnected(false);
        // Automatically trigger token refresh
        setTimeout(() => {
          refreshTokens();
        }, 2000);
      } else {
        setConnectionStatus('Failed to create post: ' + (error.response?.data?.detail || error.message));
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      background: '#ffffff',
      padding: '0',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Navigation Header */}
      <div className="glass-effect" style={{
        padding: '1.5rem 2rem',
        margin: '1.5rem',
        borderRadius: '25px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(24, 119, 242, 0.05)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        border: '1px solid rgba(24, 119, 242, 0.1)',
        boxShadow: '0 15px 35px rgba(24, 119, 242, 0.08)',
        position: 'sticky',
        top: '1.5rem',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            padding: '0.75rem',
            borderRadius: '15px',
            background: facebookConnected ? 'rgba(34, 197, 94, 0.2)' : 'rgba(24, 119, 242, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            position: 'relative'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill={facebookConnected ? "#22c55e" : "#1877f2"}>
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            {facebookConnected && (
              <div style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 0 2px white'
              }} />
            )}
          </div>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#1a202c',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}>
              {facebookConnected ? 
                (selectedPage ? `${selectedPage.name}` : 'Facebook Manager') : 
                'Facebook Manager'
              }
            </h1>
            <div style={{ 
              margin: 0, 
              fontSize: '0.875rem', 
              color: '#4a5568',
              textShadow: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {facebookConnected ? (
                selectedPage ? (
                  <>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#22c55e'
                    }} />
                    <span>
                      {selectedPage.category} • {selectedPage.follower_count || 0} followers
                    </span>
                  </>
                ) : (
                  <>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#f59e0b'
                    }} />
                    <span>Connected • Select a page to continue</span>
                  </>
                )
              ) : (
                <>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#6b7280'
                  }} />
                  <span>Not connected • Ready to link your account</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Dynamic Status Indicator */}
          {facebookConnected && selectedPage && (
            <div style={{
              padding: '0.5rem 1rem',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '25px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: '#065f46'
            }}>
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                animation: 'pulse 2s infinite'
              }} />
              Live
            </div>
          )}
          
          {/* Quick Actions */}
          {facebookConnected && selectedPage && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => window.open(`https://facebook.com/${selectedPage.id}`, '_blank')}
                style={{
                  padding: '0.5rem',
                  background: 'rgba(24, 119, 242, 0.1)',
                  border: '1px solid rgba(24, 119, 242, 0.2)',
                  borderRadius: '10px',
                  color: '#1877f2',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.3s ease'
                }}
                title="View Page"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
              
              <button
                onClick={loadPostHistory}
                disabled={isLoadingPosts}
                style={{
                  padding: '0.5rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '10px',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.3s ease',
                  opacity: isLoadingPosts ? 0.7 : 1
                }}
                title="Refresh Posts"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isLoadingPosts ? 'rotate(360deg)' : 'none', transition: 'transform 1s ease' }}>
                  <path d="M23 4v6h-6"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>
          )}
          
          {/* Facebook Connection Actions - Only show when connected */}
          {facebookConnected && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={refreshTokens}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '15px',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  textShadow: 'none'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Refresh Tokens
              </button>
              
              <button 
                onClick={handleFacebookLogout}
                disabled={isLoggingOut}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: isLoggingOut ? 
                    'rgba(239, 68, 68, 0.6)' : 
                    'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '15px',
                  color: isLoggingOut ? 'white' : '#dc2626',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  fontSize: '0.875rem',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  textShadow: 'none',
                  opacity: isLoggingOut ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isLoggingOut) {
                  e.target.style.background = 'rgba(239, 68, 68, 0.15)';
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 8px 25px rgba(239, 68, 68, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoggingOut) {
                  e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = 'none';
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16,17 21,12 16,7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              {isLoggingOut ? 'Disconnecting...' : 'Disconnect'}
            </button>
            </div>
          )}
          
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.875rem 1.5rem',
              background: 'rgba(24, 119, 242, 0.1)',
              border: '1px solid rgba(24, 119, 242, 0.2)',
              borderRadius: '15px',
              color: '#1a202c',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600',
              fontSize: '0.875rem',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              textShadow: 'none'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(24, 119, 242, 0.15)';
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 8px 25px rgba(24, 119, 242, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(24, 119, 242, 0.1)';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m12 19-7-7 7-7"/>
              <path d="M19 12H5"/>
            </svg>
            Dashboard
          </button>
        </div>
      </div>

      {/* Main Content Container */}
      <div style={{
        flex: 1,
        padding: '0 1.5rem 2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: facebookConnected ? 'flex-start' : 'center'
      }}>
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .flip-card {
          animation: ${cardFlipped ? 'none' : 'float 4s ease-in-out infinite'};
        }
        
        .glass-effect {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }
        
        .page-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }
        
        input:focus, textarea:focus {
          outline: none;
          border: 2px solid rgba(59, 130, 246, 0.6);
        }
      `}</style>

        {/* Status Card */}
        {connectionStatus && (
          <div style={{ 
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            marginBottom: '2rem',
            color: '#1a202c',
            fontWeight: '500',
            textAlign: 'center',
            maxWidth: '600px',
            background: connectionStatus.includes('Failed') || connectionStatus.includes('error') || connectionStatus.includes('Error') ? 
              'rgba(239, 68, 68, 0.1)' : 
              connectionStatus.includes('successful') || connectionStatus.includes('Connected') || connectionStatus.includes('completed') ? 
                'rgba(34, 197, 94, 0.1)' : 
                'rgba(59, 130, 246, 0.1)',
            border: connectionStatus.includes('Failed') || connectionStatus.includes('error') || connectionStatus.includes('Error') ? 
              '1px solid rgba(239, 68, 68, 0.3)' : 
              connectionStatus.includes('successful') || connectionStatus.includes('Connected') || connectionStatus.includes('completed') ? 
                '1px solid rgba(34, 197, 94, 0.3)' : 
                '1px solid rgba(59, 130, 246, 0.3)',
            fontSize: '0.95rem'
          }}>
            {connectionStatus}
          </div>
        )}

        {/* Main Card */}
        <div 
          className="flip-card glass-effect"
          style={{ 
            width: facebookConnected ? 'auto' : '400px',
            height: facebookConnected ? 'auto' : '280px',
            maxWidth: facebookConnected ? '1000px' : '400px',
            borderRadius: '30px',
            padding: facebookConnected ? '3rem' : '2.5rem',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            transformStyle: 'preserve-3d',
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.08)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Decorative Elements */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-50%',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '-30%',
            left: '-30%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(circle, rgba(123, 97, 255, 0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
                  {!facebookConnected ? (
            /* Connect Card */
            <div style={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              position: 'relative',
              zIndex: 1
            }}>
              <div style={{ 
                marginBottom: '1rem',
                padding: '1.5rem',
                borderRadius: '25px',
                background: 'rgba(24, 119, 242, 0.15)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: '1px solid rgba(24, 119, 242, 0.3)',
                animation: 'float 3s ease-in-out infinite'
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="#1877f2">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              
              <h3 style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                color: '#1a202c',
                textShadow: 'none',
                marginBottom: '0.75rem',
                margin: '0 0 0.75rem 0'
              }}>
                Connect Your Facebook
              </h3>
              

              
              <button 
                onClick={loginWithFacebook} 
                disabled={isConnecting || isCheckingStatus}
                style={{ 
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  background: '#1877f2',
                  boxShadow: '0 4px 12px rgba(24, 119, 242, 0.3)',
                  opacity: (isConnecting || isCheckingStatus) ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isConnecting && !isCheckingStatus) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(24, 119, 242, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isConnecting && !isCheckingStatus) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(24, 119, 242, 0.3)';
                  }
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                {isCheckingStatus ? 'Checking Connection...' : (isConnecting ? 'Connecting...' : 'Connect Facebook')}
              </button>
            </div>
        ) : (
          /* Connected Content */
          <div style={{ width: '100%' }}>
            {/* Pages Section Header */}
            {availablePages.length > 0 && (
              <div style={{ 
                textAlign: 'center',
                marginBottom: '2rem',
                position: 'relative',
                zIndex: 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h2 style={{
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      color: '#1a202c',
                      textShadow: 'none',
                      marginBottom: '0.5rem',
                      margin: '0 0 0.5rem 0'
                    }}>
                      Your Facebook Pages
                    </h2>
                    <p style={{
                      fontSize: '1rem',
                      color: '#4a5568',
                      textShadow: 'none',
                      margin: '0'
                    }}>
                      Select a page to start creating and managing posts
                    </p>
                    {existingConnections && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.2)',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        color: '#065f46',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        Connected since {new Date(existingConnections.accounts.pages[0]?.connected_at || existingConnections.accounts.personal[0]?.connected_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pages Grid */}
            {availablePages.length > 0 && (
              <div style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '1.5rem',
                marginBottom: '3rem',
                position: 'relative',
                zIndex: 1
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
                      padding: '2rem',
                      borderRadius: '25px',
                      cursor: 'pointer',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: selectedPage?.id === page.id ? 
                        '2px solid rgba(59, 130, 246, 0.8)' : 
                        '1px solid rgba(226, 232, 240, 0.8)',
                      background: selectedPage?.id === page.id ? 
                        'rgba(59, 130, 246, 0.08)' : 
                        'rgba(248, 250, 252, 0.8)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      boxShadow: selectedPage?.id === page.id ?
                        '0 20px 40px rgba(59, 130, 246, 0.15)' :
                        '0 15px 30px rgba(0, 0, 0, 0.05)',
                      position: 'relative',
                      overflow: 'hidden'

                    }}
                  >
                    {/* Selection Indicator */}
                    {selectedPage?.id === page.id && (
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="none">
                          <polyline points="20,6 9,17 4,12"/>
                        </svg>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
                      {page.profilePicture ? (
                        <img 
                          src={page.profilePicture} 
                          alt=""
                          style={{
                            width: '4rem',
                            height: '4rem',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid rgba(255, 255, 255, 0.6)',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '4rem',
                          height: '4rem',
                          borderRadius: '50%',
                          background: 'rgba(24, 119, 242, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '3px solid rgba(255, 255, 255, 0.6)',
                          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)'
                        }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877f2">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontSize: '1.25rem', 
                          color: '#1a202c', 
                          fontWeight: '700',
                          textShadow: 'none',
                          marginBottom: '0.25rem'
                        }}>
                          {page.name}
                        </h3>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{ 
                            fontSize: '0.875rem', 
                            color: '#4a5568',
                            textShadow: 'none'
                          }}>
                            {page.followerCount.toLocaleString()} followers
                          </span>
                          {page.canPost && (
                            <div style={{
                              padding: '0.25rem 0.5rem',
                              background: 'rgba(34, 197, 94, 0.15)',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              color: '#065f46',
                              fontWeight: '600',
                              textShadow: 'none'
                            }}>
                              Can Post
                            </div>
                          )}
                        </div>
                        <p style={{ 
                          margin: 0, 
                          fontSize: '0.875rem', 
                          color: '#6b7280',
                          textShadow: 'none'
                        }}>
                          {page.category}
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
                padding: '3rem',
                borderRadius: '30px',
                background: 'rgba(248, 250, 252, 0.8)',
                backdropFilter: 'blur(25px)',
                WebkitBackdropFilter: 'blur(25px)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden'
              }}>
                {/* Decorative Gradient */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(90deg, #667eea, #764ba2, #f093fb, #f5576c)',
                  borderRadius: '30px 30px 0 0'
                }} />

                {/* Section Header */}
                <div style={{ 
                  textAlign: 'center',
                  marginBottom: '2.5rem'
                }}>
                  <h2 style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: '#1a202c',
                    textShadow: 'none',
                    marginBottom: '0.5rem',
                    margin: '0 0 0.5rem 0'
                  }}>
                    Create New Post
                  </h2>
                  <p style={{
                    fontSize: '1rem',
                    color: '#4a5568',
                    textShadow: 'none',
                    margin: '0'
                  }}>
                    Choose AI assistance or create manually for {selectedPage.name}
                  </p>
                </div>

                {/* Tabs */}
                <div style={{ 
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '2.5rem',
                  justifyContent: 'center',
                  flexWrap: 'wrap'
                }}>
                  {['auto', 'manual', 'schedule'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        padding: '1.125rem 2.5rem',
                        background: activeTab === tab ? 
                          'linear-gradient(135deg, #667eea, #764ba2)' : 
                          'rgba(255, 255, 255, 0.3)',
                        color: activeTab === tab ? '#ffffff' : '#4a5568',
                        border: activeTab === tab ? 
                          '2px solid rgba(102, 126, 234, 0.4)' : 
                          '1px solid rgba(226, 232, 240, 0.8)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        fontWeight: '700',
                        fontSize: '1rem',
                        backdropFilter: 'blur(15px)',
                        WebkitBackdropFilter: 'blur(15px)',
                        boxShadow: activeTab === tab ? 
                          '0 10px 30px rgba(102, 126, 234, 0.4)' : 
                          '0 6px 20px rgba(0, 0, 0, 0.1)',
                        textShadow: activeTab === tab ? 
                          '0 2px 4px rgba(0, 0, 0, 0.2)' : 
                          '0 1px 2px rgba(0, 0, 0, 0.1)',
                        transform: activeTab === tab ? 'translateY(-2px)' : 'translateY(0)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}
                      onMouseEnter={(e) => {
                        if (activeTab !== tab) {
                          e.target.style.background = 'rgba(248, 250, 252, 0.8)';
                          e.target.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeTab !== tab) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                          e.target.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {tab === 'auto' ? (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="3"/>
                              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                            </svg>
                            AI Assistant
                          </>
                        ) : tab === 'manual' ? (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                            </svg>
                            Manual Mode
                          </>
                        ) : (
                          <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12,6 12,12 16,14"/>
                            </svg>
                            Schedule Posts
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Content Area */}
                <div style={{ marginBottom: '2rem' }}>
                  {activeTab === 'auto' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {/* AI Prompt Input */}
                      <div>
                        <label style={{ 
                          marginBottom: '0.5rem', 
                          fontWeight: '600',
                          color: '#4a5568',
                          fontSize: '0.875rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                          </svg>
                          AI Prompt
                        </label>
                        <textarea
                          value={autoFormData.prompt}
                          onChange={handleAutoInputChange}
                          name="prompt"
                          placeholder="Describe what you want to post (e.g., 'cat story', 'motivational Monday', 'product launch')..."
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '2px solid rgba(226, 232, 240, 0.8)',
                            background: 'rgba(255, 255, 255, 0.9)',
                            color: '#1a202c',
                            resize: 'vertical',
                            fontSize: '1rem',
                            fontFamily: 'inherit',
                            transition: 'all 0.3s ease'
                          }}
                        />
                      </div>
                      
                      {/* Generated Content Display/Edit */}
                      {autoFormData.generatedContent && (
                        <div>
                          <label style={{ 
                            marginBottom: '0.5rem', 
                            fontWeight: '600',
                            color: '#10b981',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 12l2 2 4-4"/>
                              <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/>
                              <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/>
                              <path d="M3 12h6m12 0h-6"/>
                            </svg>
                            Generated Content (Edit as needed)
                          </label>
                          <textarea
                            value={autoFormData.generatedContent}
                            onChange={(e) => setAutoFormData(prev => ({ ...prev, generatedContent: e.target.value }))}
                            style={{
                              width: '100%',
                              minHeight: '140px',
                              padding: '1.25rem',
                              borderRadius: '15px',
                              border: '2px solid rgba(16, 185, 129, 0.3)',
                              background: 'rgba(16, 185, 129, 0.05)',
                              color: '#1a202c',
                              resize: 'vertical',
                              fontSize: '1rem',
                              fontFamily: 'inherit',
                              transition: 'all 0.3s ease'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : activeTab === 'schedule' ? (
                    /* Simple Schedule Mode */
                    <div style={{ 
                      maxWidth: '500px',
                      margin: '0 auto'
                    }}>
                      {/* Simple Header */}
                      <div style={{
                        textAlign: 'center',
                        marginBottom: '2rem'
                      }}>
                        <h3 style={{ 
                          margin: '0 0 0.5rem 0',
                          color: '#1a202c',
                          fontSize: '1.5rem',
                          fontWeight: '700'
                        }}>
                          Auto-Post
                        </h3>
                        <p style={{ 
                          margin: '0',
                          color: '#6b7280',
                          fontSize: '1rem'
                        }}>
                          Set up automatic posts with AI
                        </p>
                      </div>

                      {/* Simple Form */}
                      <div style={{
                        padding: '2rem',
                        background: '#fff',
                        borderRadius: '16px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)'
                      }}>
                        {/* What to post */}
                        <div style={{ marginBottom: '1.5rem' }}>
                          <label style={{ 
                            display: 'block', 
                            marginBottom: '0.5rem', 
                            fontWeight: '600',
                            color: '#374151',
                            fontSize: '1rem'
                          }}>
                            What should I post?
                          </label>
                          <textarea
                            value={scheduleData.prompt}
                            onChange={(e) => setScheduleData(prev => ({ ...prev, prompt: e.target.value }))}
                            placeholder="e.g., motivational quotes, business tips, daily questions..."
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              padding: '1rem',
                              borderRadius: '8px',
                              border: '2px solid #e5e7eb',
                              background: '#fff',
                              color: '#1a202c',
                              resize: 'none',
                              fontSize: '1rem',
                              fontFamily: 'inherit'
                            }}
                          />
                        </div>

                        {/* When and how often */}
                        <div style={{ 
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '1rem',
                          marginBottom: '1.5rem'
                        }}>
                          <div>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.5rem', 
                              fontWeight: '600',
                              color: '#374151',
                              fontSize: '1rem'
                            }}>
                              When?
                            </label>
                            <input
                              type="time"
                              value={scheduleData.time}
                              onChange={(e) => setScheduleData(prev => ({ ...prev, time: e.target.value }))}
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '2px solid #e5e7eb',
                                background: '#fff',
                                color: '#1a202c',
                                fontSize: '1rem'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.5rem', 
                              fontWeight: '600',
                              color: '#374151',
                              fontSize: '1rem'
                            }}>
                              How often?
                            </label>
                            <select
                              value={scheduleData.frequency}
                              onChange={(e) => setScheduleData(prev => ({ ...prev, frequency: e.target.value }))}
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '8px',
                                border: '2px solid #e5e7eb',
                                background: '#fff',
                                color: '#1a202c',
                                fontSize: '1rem'
                              }}
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                        </div>

                        {/* Status and control */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem',
                          background: scheduleData.isActive ? '#f0fdf4' : '#f9fafb',
                          borderRadius: '8px',
                          border: scheduleData.isActive ? '1px solid #bbf7d0' : '1px solid #e5e7eb'
                        }}>
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              marginBottom: '0.25rem'
                            }}>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: scheduleData.isActive ? '#22c55e' : '#9ca3af'
                              }} />
                              <span style={{
                                fontWeight: '600',
                                color: scheduleData.isActive ? '#166534' : '#6b7280',
                                fontSize: '1rem'
                              }}>
                                {scheduleData.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            {scheduleData.isActive && scheduleData.time && (
                              <p style={{ 
                                margin: '0',
                                fontSize: '0.85rem',
                                color: '#6b7280'
                              }}>
                                Posts {scheduleData.frequency} at {scheduleData.time}
                              </p>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {scheduleData.isActive && (
                              <button
                                onClick={async () => {
                                  try {
                                    setConnectionStatus('Testing...');
                                    await apiClient.request('/api/social/scheduled-posts/trigger', { method: 'POST' });
                                    setConnectionStatus('Test completed');
                                    setTimeout(() => loadPostHistory(), 1000);
                                  } catch (error) {
                                    setConnectionStatus('Test failed: ' + error.message);
                                  }
                                }}
                                style={{
                                  padding: '0.5rem 0.75rem',
                                  background: '#3b82f6',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  fontSize: '0.8rem'
                                }}
                              >
                                Test
                              </button>
                            )}
                            
                            <button
                              onClick={handleScheduleToggle}
                              disabled={!scheduleData.prompt || !scheduleData.time}
                              style={{
                                padding: '0.75rem 1.5rem',
                                background: scheduleData.isActive ? '#ef4444' : '#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: (!scheduleData.prompt || !scheduleData.time) ? 'not-allowed' : 'pointer',
                                fontWeight: '600',
                                fontSize: '1rem',
                                opacity: (!scheduleData.prompt || !scheduleData.time) ? 0.5 : 1,
                                minWidth: '80px'
                              }}
                            >
                              {scheduleData.isActive ? 'Stop' : 'Start'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Manual Mode */
                    <div>
                      <label style={{ 
                        marginBottom: '0.5rem', 
                        fontWeight: '600',
                        color: '#4a5568',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                        </svg>
                        Post Content
                      </label>
                      <textarea
                        value={manualFormData.message}
                        onChange={handleManualInputChange}
                        name="message"
                        placeholder="Write your post content here..."
                        style={{
                          width: '100%',
                          minHeight: '140px',
                          padding: '1.25rem',
                          borderRadius: '15px',
                          border: '2px solid rgba(226, 232, 240, 0.8)',
                          background: 'rgba(255, 255, 255, 0.9)',
                          color: '#1a202c',
                          resize: 'vertical',
                          fontSize: '1rem',
                          transition: 'all 0.3s ease',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Media Options - Only show for auto and manual modes */}
                {activeTab !== 'schedule' && (
                <div style={{ 
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '2rem',
                  flexWrap: 'wrap'
                }}>
                  {['none', 'photo'].map(type => (
                    <button
                      key={type}
                      onClick={() => handleMediaTypeChange(type, activeTab)}
                      style={{
                        padding: '0.875rem 1.25rem',
                        background: (activeTab === 'auto' ? autoFormData.mediaType : manualFormData.mediaType) === type ?
                          'rgba(16, 185, 129, 0.8)' :
                          'rgba(248, 250, 252, 0.8)',
                        border: 'none',
                        borderRadius: '15px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: (activeTab === 'auto' ? autoFormData.mediaType : manualFormData.mediaType) === type ? 'white' : '#4a5568',
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
                )}

                {/* Action Buttons - Only show for auto and manual modes */}
                {activeTab !== 'schedule' && (
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {autoFormData.isGenerating ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                              <path d="M21 12a9 9 0 11-6.219-8.56"/>
                            </svg>
                            Generating...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="3"/>
                              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                            </svg>
                            Generate Content
                          </>
                        )}
                      </div>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isPublishing ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 11-6.219-8.56"/>
                          </svg>
                          Publishing...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 19V5m-7 7l7-7 7 7"/>
                          </svg>
                          Publish Post
                        </>
                      )}
                    </div>
                  </button>
                </div>
                )}
              </div>
            )}
            
            {/* Posts History Section */}
            {selectedPage && facebookConnected && (
              <div className="glass-effect" style={{ 
                marginTop: '3rem',
                padding: '2rem',
                borderRadius: '25px',
                background: 'rgba(248, 250, 252, 0.8)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                boxShadow: '0 15px 30px rgba(0, 0, 0, 0.05)',
                position: 'relative',
                zIndex: 1,
                maxWidth: '1000px',
                width: '100%'
              }}>
                {/* Section Header */}
                <div style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '2rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      padding: '0.75rem',
                      borderRadius: '12px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                    <div>
                      <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#1a202c',
                        margin: '0'
                      }}>
                        Recent Posts
                      </h3>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        margin: '0'
                      }}>
                        Your latest Facebook posts from {selectedPage.name}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={loadPostHistory}
                    disabled={isLoadingPosts}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '12px',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      transition: 'all 0.3s ease',
                      opacity: isLoadingPosts ? 0.7 : 1
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6"/>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                    {isLoadingPosts ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* Posts List */}
                <div style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {isLoadingPosts ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3rem',
                      color: '#6b7280'
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                      <span style={{ marginLeft: '0.75rem' }}>Loading posts...</span>
                    </div>
                  ) : postHistory.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '3rem',
                      color: '#6b7280'
                    }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ margin: '0 auto 1rem auto' }}>
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                        <line x1="9" y1="9" x2="9.01" y2="9"/>
                        <line x1="15" y1="9" x2="15.01" y2="9"/>
                      </svg>
                      <p style={{ margin: '0', fontSize: '1.1rem', fontWeight: '600' }}>No posts yet</p>
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem' }}>Your published posts will appear here</p>
                    </div>
                  ) : (
                    postHistory.map((post, index) => (
                      <div
                        key={post.id || index}
                        style={{
                          padding: '1.5rem',
                          background: 'rgba(255, 255, 255, 0.8)',
                          borderRadius: '15px',
                          border: '1px solid rgba(226, 232, 240, 0.8)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'rgba(24, 119, 242, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877f2">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                            </svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{ fontWeight: '600', color: '#1a202c' }}>{selectedPage.name}</span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Recently'}
                              </span>
                              <div style={{
                                padding: '0.25rem 0.5rem',
                                background: post.status === 'published' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                                color: post.status === 'published' ? '#065f46' : '#374151',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>
                                {post.status || 'Published'}
                              </div>
                            </div>
                            <p style={{ 
                              margin: '0',
                              color: '#374151',
                              lineHeight: '1.5',
                              fontSize: '0.95rem'
                            }}>
                              {post.content || post.message || 'Post content not available'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }
      `}</style>
             </div>
    </div>
  );
}

export default FacebookPage;