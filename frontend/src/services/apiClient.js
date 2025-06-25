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
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Authentication endpoints
  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.access_token) {
      this.setToken(response.access_token);
    }
    
    return response;
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    this.setToken(null);
  }

  // Social Media endpoints (Replace Make.com webhooks)
  async connectFacebook(accessToken, userId, pages = []) {
    return this.request('/social/facebook/connect', {
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
}

const apiClient = new ApiClient();
export default apiClient; 