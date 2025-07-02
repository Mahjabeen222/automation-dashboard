# Instagram Business Account Integration Guide

## Overview

This document explains how Instagram Business account integration works through Facebook's Graph API, based on a working FastAPI + React implementation, and provides guidance for implementing it in Django + React Vite.

## How Instagram Integration Works

### 1. The Facebook-Instagram Connection

Instagram Business accounts must be connected to Facebook Pages to use the Instagram Basic Display API and Instagram Graph API. Here's the flow:

```
User Facebook Account → Facebook Page → Instagram Business Account → API Access
```

**Key Requirements:**
- Instagram Business or Creator account
- Connected to a Facebook Page
- Admin/Editor access to the Facebook Page
- Facebook App with proper permissions

### 2. Authentication Flow

The authentication process involves several steps:

1. **Facebook SDK Initialization**: Load Facebook SDK with your App ID
2. **User Login**: User grants permissions through Facebook OAuth
3. **Token Exchange**: Exchange short-lived token for long-lived token (60 days)
4. **Page Discovery**: Fetch user's Facebook Pages
5. **Instagram Account Discovery**: Find Instagram accounts connected to pages
6. **Account Storage**: Store account details and tokens

## Current Implementation Analysis

### Frontend (React) - Key Components

#### 1. Facebook SDK Initialization
```javascript
// Instagram App ID (can be same as Facebook App ID)
const INSTAGRAM_APP_ID = process.env.REACT_APP_INSTAGRAM_APP_ID || '697225659875731';

// Initialize Facebook SDK
window.fbAsyncInit = function() {
  window.FB.init({
    appId: INSTAGRAM_APP_ID,
    cookie: true,
    xfbml: true,
    version: 'v18.0'
  });
};
```

#### 2. Authentication & Permissions
```javascript
// Required permissions for Instagram integration
const requiredPermissions = [
  'pages_show_list',           // Access user's Facebook Pages
  'instagram_basic',           // Basic Instagram access
  'instagram_content_publish', // Post content to Instagram
  'pages_read_engagement'      // Read Page engagement data
];

// Facebook login with Instagram permissions
window.FB.login((response) => {
  if (response.status === 'connected') {
    const accessToken = response.authResponse.accessToken;
    handleConnectInstagram(accessToken);
  }
}, {
  scope: requiredPermissions.join(',')
});
```

#### 3. UI State Management
```javascript
const [isConnected, setIsConnected] = useState(false);
const [instagramAccounts, setInstagramAccounts] = useState([]);
const [selectedAccount, setSelectedAccount] = useState('');
const [fbAccessToken, setFbAccessToken] = useState(null);
const [activeTab, setActiveTab] = useState('connect');
```

### Backend (FastAPI/Python) - Key Components

#### 1. Service Architecture
```python
class InstagramService:
    def __init__(self):
        self.graph_url = "https://graph.facebook.com/v18.0"
        self.app_id = settings.facebook_app_id
        self.app_secret = settings.facebook_app_secret
```

#### 2. Token Management
```python
def exchange_for_long_lived_token(self, short_lived_token: str) -> Tuple[str, datetime]:
    """Exchange short-lived token for long-lived token (60 days)"""
    url = f"{self.graph_url}/oauth/access_token"
    params = {
        'grant_type': 'fb_exchange_token',
        'client_id': self.app_id,
        'client_secret': self.app_secret,
        'fb_exchange_token': short_lived_token
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    return data['access_token'], datetime.now() + timedelta(seconds=data['expires_in'])
```

#### 3. Instagram Account Discovery
```python
def get_facebook_pages_with_instagram(self, access_token: str) -> List[Dict]:
    """Get Facebook Pages with Instagram Business accounts"""
    
    # Get user's Facebook Pages with Instagram accounts
    url = f"{self.graph_url}/me/accounts"
    params = {
        'access_token': access_token,
        'fields': 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}'
    }
    
    response = requests.get(url, params=params)
    pages_data = response.json()
    
    # Extract Instagram accounts from pages
    instagram_accounts = []
    for page in pages_data.get('data', []):
        instagram_account = page.get('instagram_business_account')
        if instagram_account:
            instagram_accounts.append({
                'platform_id': instagram_account['id'],
                'username': instagram_account.get('username'),
                'display_name': instagram_account.get('name'),
                'page_access_token': page.get('access_token')
            })
    
    return instagram_accounts
```

#### 4. Post Creation
```python
def create_post(self, instagram_user_id: str, page_access_token: str, 
               caption: str, image_url: Optional[str] = None) -> Dict:
    """Create Instagram post via Graph API"""
    
    # Step 1: Create media object
    media_url = f"{self.graph_url}/{instagram_user_id}/media"
    media_params = {
        'access_token': page_access_token,
        'caption': caption
    }
    
    if image_url:
        media_params['image_url'] = image_url
    
    media_response = requests.post(media_url, data=media_params)
    creation_id = media_response.json()['id']
    
    # Step 2: Publish the media
    publish_url = f"{self.graph_url}/{instagram_user_id}/media_publish"
    publish_params = {
        'access_token': page_access_token,
        'creation_id': creation_id
    }
    
    publish_response = requests.post(publish_url, data=publish_params)
    return publish_response.json()
```

## Implementation Guide for Django + React Vite

### 1. Django Backend Setup

#### Install Dependencies
```bash
pip install requests python-decouple djangorestframework django-cors-headers
```

#### Settings Configuration
```python
# settings.py
import os
from decouple import config

# Facebook/Instagram App Configuration
FACEBOOK_APP_ID = config('FACEBOOK_APP_ID')
FACEBOOK_APP_SECRET = config('FACEBOOK_APP_SECRET')
FACEBOOK_GRAPH_API_VERSION = 'v18.0'

# Add to INSTALLED_APPS
INSTALLED_APPS = [
    # ... other apps
    'rest_framework',
    'corsheaders',
]

# Add to MIDDLEWARE
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    # ... other middleware
]

# CORS Configuration for React Vite
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",
]

CORS_ALLOW_CREDENTIALS = True
```

#### Models
```python
# models.py
from django.db import models
from django.contrib.auth.models import User

class SocialAccount(models.Model):
    PLATFORM_CHOICES = [
        ('instagram', 'Instagram'),
        ('facebook', 'Facebook'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    platform_id = models.CharField(max_length=100, unique=True)
    username = models.CharField(max_length=100)
    display_name = models.CharField(max_length=255, blank=True)
    access_token = models.TextField()
    refresh_token = models.TextField(blank=True)
    token_expires_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'platform', 'platform_id']

class InstagramPost(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    instagram_account = models.ForeignKey(SocialAccount, on_delete=models.CASCADE)
    platform_post_id = models.CharField(max_length=100, unique=True)
    caption = models.TextField()
    media_url = models.URLField(blank=True)
    post_type = models.CharField(max_length=20, default='image')
    posted_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
```

#### Instagram Service
```python
# services/instagram_service.py
import requests
from datetime import datetime, timedelta
from django.conf import settings
from typing import Dict, List, Optional, Tuple

class InstagramService:
    def __init__(self):
        self.graph_url = f"https://graph.facebook.com/{settings.FACEBOOK_GRAPH_API_VERSION}"
        self.app_id = settings.FACEBOOK_APP_ID
        self.app_secret = settings.FACEBOOK_APP_SECRET
    
    def exchange_for_long_lived_token(self, short_lived_token: str) -> Tuple[str, datetime]:
        """Exchange short-lived token for long-lived token"""
        url = f"{self.graph_url}/oauth/access_token"
        params = {
            'grant_type': 'fb_exchange_token',
            'client_id': self.app_id,
            'client_secret': self.app_secret,
            'fb_exchange_token': short_lived_token
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        expires_at = datetime.now() + timedelta(seconds=data.get('expires_in', 5184000))
        return data['access_token'], expires_at
    
    def get_instagram_accounts(self, access_token: str) -> List[Dict]:
        """Get Instagram Business accounts from Facebook Pages"""
        url = f"{self.graph_url}/me/accounts"
        params = {
            'access_token': access_token,
            'fields': 'id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}'
        }
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        pages_data = response.json()
        instagram_accounts = []
        
        for page in pages_data.get('data', []):
            instagram_account = page.get('instagram_business_account')
            if instagram_account:
                instagram_accounts.append({
                    'platform_id': instagram_account['id'],
                    'username': instagram_account.get('username', ''),
                    'display_name': instagram_account.get('name', ''),
                    'page_name': page.get('name', ''),
                    'page_id': page['id'],
                    'page_access_token': page.get('access_token'),
                    'followers_count': instagram_account.get('followers_count', 0),
                    'media_count': instagram_account.get('media_count', 0),
                    'profile_picture': instagram_account.get('profile_picture_url', '')
                })
        
        return instagram_accounts
    
    def create_post(self, instagram_user_id: str, page_access_token: str, 
                   caption: str, image_url: Optional[str] = None) -> Dict:
        """Create Instagram post"""
        # Step 1: Create media object
        media_url = f"{self.graph_url}/{instagram_user_id}/media"
        media_params = {
            'access_token': page_access_token,
            'caption': caption
        }
        
        if image_url:
            media_params['image_url'] = image_url
        
        media_response = requests.post(media_url, data=media_params)
        media_response.raise_for_status()
        creation_id = media_response.json()['id']
        
        # Step 2: Publish the media
        publish_url = f"{self.graph_url}/{instagram_user_id}/media_publish"
        publish_params = {
            'access_token': page_access_token,
            'creation_id': creation_id
        }
        
        publish_response = requests.post(publish_url, data=publish_params)
        publish_response.raise_for_status()
        
        return {
            'success': True,
            'post_id': publish_response.json()['id'],
            'creation_id': creation_id
        }

# Global instance
instagram_service = InstagramService()
```

#### Views/API Endpoints
```python
# views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .services.instagram_service import instagram_service
from .models import SocialAccount

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def connect_instagram(request):
    """Connect Instagram account via Facebook token"""
    try:
        access_token = request.data.get('access_token')
        if not access_token:
            return Response({'error': 'Access token required'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Exchange for long-lived token
        long_lived_token, expires_at = instagram_service.exchange_for_long_lived_token(access_token)
        
        # Get Instagram accounts
        instagram_accounts = instagram_service.get_instagram_accounts(long_lived_token)
        
        if not instagram_accounts:
            return Response({
                'success': False,
                'error': 'No Instagram Business accounts found'
            })
        
        # Save accounts to database
        saved_accounts = []
        for account in instagram_accounts:
            social_account, created = SocialAccount.objects.update_or_create(
                user=request.user,
                platform='instagram',
                platform_id=account['platform_id'],
                defaults={
                    'username': account['username'],
                    'display_name': account['display_name'],
                    'access_token': account['page_access_token'],
                    'token_expires_at': expires_at,
                    'is_active': True
                }
            )
            saved_accounts.append(account)
        
        return Response({
            'success': True,
            'data': {'accounts': saved_accounts}
        })
        
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_instagram_post(request):
    """Create Instagram post"""
    try:
        instagram_user_id = request.data.get('instagram_user_id')
        caption = request.data.get('caption')
        image_url = request.data.get('image_url')  # Optional
        
        # Get the social account
        social_account = SocialAccount.objects.get(
            user=request.user,
            platform='instagram',
            platform_id=instagram_user_id,
            is_active=True
        )
        
        # Create post
        result = instagram_service.create_post(
            instagram_user_id=instagram_user_id,
            page_access_token=social_account.access_token,
            caption=caption,
            image_url=image_url
        )
        
        if result['success']:
            # Save post to database
            InstagramPost.objects.create(
                user=request.user,
                instagram_account=social_account,
                platform_post_id=result['post_id'],
                caption=caption,
                media_url=image_url or '',
                posted_at=datetime.now()
            )
        
        return Response(result)
        
    except SocialAccount.DoesNotExist:
        return Response({
            'success': False,
            'error': 'Instagram account not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

#### URL Configuration
```python
# urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('api/instagram/connect/', views.connect_instagram, name='connect_instagram'),
    path('api/instagram/post/', views.create_instagram_post, name='create_instagram_post'),
]
```

### 2. React Vite Frontend Setup

#### Install Dependencies
```bash
npm install axios
```

#### Environment Configuration
```env
# .env
VITE_FACEBOOK_APP_ID=your_facebook_app_id
VITE_API_BASE_URL=http://localhost:8000
```

#### API Client
```javascript
// src/services/apiClient.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const instagramAPI = {
  connectInstagram: async (accessToken) => {
    const response = await apiClient.post('/api/instagram/connect/', {
      access_token: accessToken
    });
    return response.data;
  },

  createPost: async (postData) => {
    const response = await apiClient.post('/api/instagram/post/', postData);
    return response.data;
  },
};

export default apiClient;
```

#### Instagram Component
```jsx
// src/components/InstagramPage.jsx
import React, { useState, useEffect } from 'react';
import { instagramAPI } from '../services/apiClient';

const InstagramPage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [instagramAccounts, setInstagramAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;

  useEffect(() => {
    // Initialize Facebook SDK
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });
    };

    // Load Facebook SDK
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));
  }, [FACEBOOK_APP_ID]);

  const handleFacebookLogin = () => {
    setLoading(true);
    setMessage('Connecting to Facebook...');

    window.FB.login(async (response) => {
      if (response.status === 'connected') {
        try {
          const result = await instagramAPI.connectInstagram(response.authResponse.accessToken);
          
          if (result.success) {
            setInstagramAccounts(result.data.accounts);
            setIsConnected(true);
            setMessage('Instagram accounts connected successfully!');
          } else {
            setMessage(`Connection failed: ${result.error}`);
          }
        } catch (error) {
          setMessage(`Error: ${error.message}`);
        }
      } else {
        setMessage('Facebook login failed or was cancelled');
      }
      setLoading(false);
    }, {
      scope: 'pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement'
    });
  };

  const handleCreatePost = async () => {
    if (!selectedAccount || !postContent.trim()) {
      setMessage('Please select an account and enter post content');
      return;
    }

    setLoading(true);
    setMessage('Creating Instagram post...');

    try {
      const result = await instagramAPI.createPost({
        instagram_user_id: selectedAccount,
        caption: postContent
      });

      if (result.success) {
        setMessage('Post created successfully!');
        setPostContent('');
      } else {
        setMessage(`Failed to create post: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error creating post: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="instagram-page">
      <h1>Instagram Management</h1>
      
      {message && (
        <div className={`message ${message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      {!isConnected ? (
        <div className="connect-section">
          <h2>Connect Instagram Account</h2>
          <p>Connect your Instagram Business account through Facebook</p>
          <button onClick={handleFacebookLogin} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect via Facebook'}
          </button>
        </div>
      ) : (
        <div className="manage-section">
          <h2>Connected Accounts</h2>
          <select 
            value={selectedAccount} 
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            <option value="">Select Account</option>
            {instagramAccounts.map(account => (
              <option key={account.platform_id} value={account.platform_id}>
                @{account.username} - {account.display_name}
              </option>
            ))}
          </select>

          <div className="post-section">
            <h3>Create Post</h3>
            <textarea
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder="Write your Instagram caption..."
              rows="4"
            />
            <button onClick={handleCreatePost} disabled={loading || !selectedAccount}>
              {loading ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstagramPage;
```

### 3. Configuration Steps

#### Facebook App Setup
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use existing one
3. Add Instagram Basic Display and Instagram Graph API products
4. Configure OAuth redirect URIs
5. Add your domain to App Domains
6. Get App ID and App Secret

#### Required Permissions
- `pages_show_list` - Access user's Facebook Pages
- `instagram_basic` - Basic Instagram access
- `instagram_content_publish` - Post content to Instagram
- `pages_read_engagement` - Read Page engagement data

#### Environment Variables
```env
# Django
FACEBOOK_APP_ID=your_app_id
FACEBOOK_APP_SECRET=your_app_secret

# React Vite
VITE_FACEBOOK_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:8000
```

## Common Issues & Troubleshooting

### 1. "No Instagram Business accounts found"
**Causes:**
- Instagram account is personal, not business
- Instagram not connected to Facebook Page
- User doesn't have admin access to Facebook Page

**Solutions:**
- Convert Instagram to Business account in Instagram app
- Connect Instagram to Facebook Page in Page settings
- Ensure user has Admin/Editor role on the Page

### 2. Token Expiration
**Issue:** Access tokens expire after 60 days
**Solution:** Implement token refresh mechanism

```python
def refresh_token_if_needed(self, social_account):
    """Check and refresh token if needed"""
    if social_account.token_expires_at and social_account.token_expires_at < datetime.now():
        # Implement token refresh logic
        pass
```

### 3. CORS Issues
**For Django + React Vite:**
```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite default
]
CORS_ALLOW_CREDENTIALS = True
```

### 4. Permission Errors
**Check granted permissions:**
```python
def verify_permissions(self, access_token):
    url = f"{self.graph_url}/me/permissions"
    response = requests.get(url, params={'access_token': access_token})
    return response.json()
```

## Testing

### 1. Manual Testing Steps
1. Ensure Instagram account is Business/Creator
2. Connect Instagram to Facebook Page
3. Test Facebook login flow
4. Verify Instagram accounts are discovered
5. Test post creation

### 2. Error Handling
```python
try:
    result = instagram_service.create_post(...)
except requests.exceptions.RequestException as e:
    # Handle API errors
    logger.error(f"Instagram API error: {e}")
except Exception as e:
    # Handle other errors
    logger.error(f"Unexpected error: {e}")
```

## Security Considerations

1. **Token Storage:** Store access tokens securely (encrypted)
2. **HTTPS:** Use HTTPS in production
3. **Token Validation:** Validate tokens before API calls
4. **Rate Limiting:** Implement rate limiting for API calls
5. **Permissions:** Request only necessary permissions

## Conclusion

This integration leverages Facebook's Graph API to manage Instagram Business accounts. The key is understanding that Instagram Business accounts are accessed through their connected Facebook Pages, not directly. Ensure proper setup of the Facebook app, correct permissions, and proper error handling for a robust implementation.

The Django + React Vite implementation follows the same principles as the FastAPI + React version, with Django-specific patterns for models, views, and API structure. 

## Why Your Instagram Works vs. Your Friend's Issue

Based on the implementation, here are the key differences that might explain why your Instagram integration works while your friend's doesn't:

### 1. **Facebook App Configuration**
- **Your setup**: Uses a properly configured Facebook App with Instagram Basic Display and Instagram Graph API products enabled
- **Common issue**: Missing Instagram products in Facebook App settings

### 2. **Instagram Account Type**
- **Your setup**: Uses Instagram Business/Creator accounts connected to Facebook Pages
- **Common issue**: Trying to use personal Instagram accounts

### 3. **Permission Scope**
- **Your setup**: Requests specific permissions: `pages_show_list`, `instagram_basic`, `instagram_content_publish`, `pages_read_engagement`
- **Common issue**: Missing required permissions in OAuth request

### 4. **Token Management**
- **Your setup**: Exchanges short-lived tokens for long-lived tokens (60 days)
- **Common issue**: Using expired or short-lived tokens

### 5. **Error Handling**
- **Your setup**: Comprehensive error handling with specific troubleshooting messages
- **Common issue**: Poor error handling making debugging difficult

## Quick Implementation Checklist for Django + React Vite

### Backend (Django) Checklist:
- [ ] Install required packages (`requests`, `djangorestframework`, `django-cors-headers`)
- [ ] Configure Facebook App ID and Secret in settings
- [ ] Create models for SocialAccount and InstagramPost
- [ ] Implement InstagramService class
- [ ] Create API endpoints for connect and post creation
- [ ] Configure CORS for Vite (port 5173)
- [ ] Set up proper error handling

### Frontend (React Vite) Checklist:
- [ ] Configure environment variables (VITE_FACEBOOK_APP_ID)
- [ ] Install Facebook SDK script
- [ ] Create API client with axios
- [ ] Implement Instagram component with Facebook login
- [ ] Handle authentication flow and token management
- [ ] Create UI for account selection and post creation
- [ ] Implement proper error handling and user feedback

### Configuration Checklist:
- [ ] Facebook App has Instagram Basic Display product
- [ ] Facebook App has Instagram Graph API product
- [ ] Instagram account is Business/Creator type
- [ ] Instagram account is connected to Facebook Page
- [ ] User has Admin/Editor access to Facebook Page
- [ ] OAuth redirect URIs are configured
- [ ] App domains are properly set

This implementation guide provides a solid foundation for implementing Instagram integration in Django + React Vite based on the working FastAPI + React system. 