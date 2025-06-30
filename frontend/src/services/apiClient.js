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
        const errorData = await response.json().catch(() => ({}));
        
        // Handle 401 Unauthorized specifically
        if (response.status === 401) {
          console.warn('Authentication failed - token may be expired');
          this.setToken(null); // Clear invalid token
          throw new Error('Could not validate credentials - please log in again');
        }
        
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
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
    return this.request('/ai/generate-content', {
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