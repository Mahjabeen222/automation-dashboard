// API Client for Backend Integration
class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    try {
      console.log(`🔍 DEBUG: baseURL = ${this.baseURL}`);
      console.log(`🔍 DEBUG: endpoint = ${endpoint}`);
      console.log(`🔍 DEBUG: final URL = ${url}`);
      console.log(`Making API request to: ${url}`);
      
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.warn('Failed to parse error response as JSON');
        }
        
        // Handle 401 Unauthorized specifically
        if (response.status === 401) {
          console.warn('Authentication failed - token may be expired');
          this.setToken(null); // Clear invalid token
          throw new Error('Could not validate credentials - please log in again');
        }
        
        // Handle validation errors (422)
        if (response.status === 422 && errorData.detail) {
          // Handle Pydantic validation errors
          if (Array.isArray(errorData.detail)) {
            const validationErrors = errorData.detail.map(err => 
              `${err.loc.join('.')}: ${err.msg}`
            ).join(', ');
            throw new Error(`Validation Error: ${validationErrors}`);
          } else {
            throw new Error(errorData.detail);
          }
        }
        
        // Extract error message properly
        let errorMessage = 'Unknown error occurred';
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log(`API response from ${endpoint}:`, responseData);
      return responseData;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`API request timeout for ${endpoint}`);
        throw new Error('Request timed out - backend server may not be responding');
      }
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Test connection to backend
  async testConnection() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`);
      return response.ok;
    } catch (error) {
      console.error('Backend connection test failed:', error);
      return false;
    }
  }

  // Authentication endpoints
  async register(userData) {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(email, password) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    
    return response;
  }

  async getCurrentUser() {
    return this.request('/api/auth/me');
  }

  async logout() {
    this.setToken(null);
  }

  // Social Media endpoints (Replace Make.com webhooks)
  async getFacebookStatus() {
    return this.request('/api/social/facebook/status');
  }

  async connectFacebook(accessToken, userId, pages = []) {
    return this.request('/api/social/facebook/connect', {
      method: 'POST',
      body: JSON.stringify({
        access_token: accessToken,
        user_id: userId,
        pages: pages,
      }),
    });
  }

  async refreshFacebookTokens() {
    return this.request('/api/social/facebook/refresh-tokens', {
      method: 'POST',
    });
  }

  async logoutFacebook() {
    return this.request('/api/social/facebook/logout', {
      method: 'POST',
    });
  }

  // Scheduling endpoints
  async createScheduledPost(scheduleData) {
    const params = new URLSearchParams({
      prompt: scheduleData.prompt,
      post_time: scheduleData.post_time,
      frequency: scheduleData.frequency || 'daily',
      social_account_id: scheduleData.social_account_id.toString()
    });
    
    return this.request(`/api/social/scheduled-posts?${params.toString()}`, {
      method: 'POST',
    });
  }

  async getScheduledPosts() {
    return this.request('/api/social/scheduled-posts');
  }

  async updateScheduledPost(scheduleId, scheduleData) {
    return this.request(`/api/social/scheduled-posts/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(scheduleData),
    });
  }

  async deleteScheduledPost(scheduleId) {
    return this.request(`/api/social/scheduled-posts/${scheduleId}`, {
      method: 'DELETE',
    });
  }

  async getSocialPosts(platform = null, limit = 50) {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    params.append('limit', limit.toString());
    
    return this.request(`/api/social/posts?${params.toString()}`);
  }

  async connectInstagram(accessToken) {
    return this.request('/api/social/instagram/connect', {
      method: 'POST',
      body: JSON.stringify({
        access_token: accessToken
      }),
    });
  }

  // REPLACE Make.com auto-post webhook
  async createFacebookPost(pageId, message, postType = 'post-auto', image = null) {
    return this.request('/social/facebook/post', {
      method: 'POST',
      body: JSON.stringify({
        page_id: pageId,
        message: message,
        post_type: postType,
        image: image,
      }),
    });
  }

  // Instagram post creation
  async createInstagramPost(data) {
    // Accept either FormData or an object for flexibility
    if (data instanceof FormData) {
      // FormData for file uploads - use custom headers to avoid CORS issues
      const url = `${this.baseURL}/api/social/instagram/post`;
      const config = {
        method: 'POST',
        body: data,
      };

      // Add authorization header manually for FormData
      if (this.token) {
        config.headers = {
          'Authorization': `Bearer ${this.token}`
        };
      }

      try {
        console.log(`🔍 DEBUG: FormData upload to ${url}`);
        const response = await fetch(url, config);
        
        if (!response.ok) {
          let errorData = {};
          try {
            errorData = await response.json();
          } catch (e) {
            console.warn('Failed to parse error response as JSON');
          }
          
          let errorMessage = 'Unknown error occurred';
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        console.log(`FormData upload response:`, responseData);
        return responseData;
      } catch (error) {
        console.error(`FormData upload error:`, error);
        throw error;
      }
    } else {
      // JSON for text-only posts or AI generation
      return this.request('/api/social/instagram/post', {
        method: 'POST',
        body: JSON.stringify({
          instagram_user_id: data.instagram_user_id,
          caption: data.caption,
          image_url: data.image_url,
          post_type: data.post_type || 'manual',
          use_ai: data.use_ai || false,
          prompt: data.prompt
        }),
      });
    }
  }

  // Get Instagram media
  async getInstagramMedia(instagramUserId, limit = 25) {
    return this.request(`/api/social/instagram/media/${instagramUserId}?limit=${limit}`);
  }

  // REPLACE Make.com auto-reply webhook
  async toggleAutoReply(pageId, enabled, responseTemplate = 'Thank you for your comment!') {
    return this.request('/social/facebook/auto-reply', {
      method: 'POST',
      body: JSON.stringify({
        enabled: enabled,
        page_id: pageId,
        response_template: responseTemplate,
      }),
    });
  }

  // Get connected social accounts
  async getSocialAccounts() {
    return this.request('/social/accounts');
  }

  // Get posts
  async getPosts(platform = null, status = null, limit = 50) {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    
    const query = params.toString();
    return this.request(`/social/posts${query ? `?${query}` : ''}`);
  }

  // Get automation rules
  async getAutomationRules(platform = null, ruleType = null) {
    const params = new URLSearchParams();
    if (platform) params.append('platform', platform);
    if (ruleType) params.append('rule_type', ruleType);
    
    const query = params.toString();
    return this.request(`/social/automation-rules${query ? `?${query}` : ''}`);
  }

  // Generate content using Groq API
  async generateContent(prompt) {
    return this.request('/api/ai/generate-content', {
      method: 'POST',
      body: JSON.stringify({
        prompt: prompt,
        platform: 'facebook',
        content_type: 'post'
      }),
    });
  }
}

const apiClient = new ApiClient();
export default apiClient; 