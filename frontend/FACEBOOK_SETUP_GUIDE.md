# Facebook Integration Setup Guide

## 🚀 Quick Debugging Steps

1. **Open your browser's Developer Console** (F12) and check for error messages when you click "Connect to Facebook"
2. **Check the Console logs** - the updated code now provides detailed logging
3. **Follow the setup steps below** if you see configuration errors

## 📋 Prerequisites Checklist

### 1. Facebook App Configuration

#### Create a Facebook App:
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "My Apps" → "Create App"
3. Choose "Business" app type
4. Fill in app details and create

#### Configure App Settings:
1. In your Facebook App dashboard, go to **Settings** → **Basic**
2. Note down your **App ID** (you'll need this)
3. Add your domain to **App Domains** (e.g., `localhost`, `yourdomain.com`)

#### Set Up Facebook Login:
1. Go to **Products** → **Facebook Login** → **Settings**
2. Add Valid OAuth Redirect URIs:
   - For development: `http://localhost:3000/`
   - For production: `https://yourdomain.com/`

#### Configure Permissions:
1. Go to **App Review** → **Permissions and Features**
2. Request these permissions:
   - `pages_manage_posts` - To post on behalf of pages
   - `pages_read_engagement` - To read page insights
   - `pages_show_list` - To get list of pages

## 📸 Instagram Integration Setup

### Adding Instagram to Your Existing Facebook App

#### Step 1: Add Instagram Products
1. In your Facebook App dashboard, go to **Products**
2. Click **"+ Add Product"**
3. Find **"Instagram Graph API"** and click **"Set Up"**
4. This will add Instagram capabilities to your existing Facebook app

#### Step 2: Configure Instagram Permissions
1. Go to **App Review** → **Permissions and Features**
2. Request these **additional** Instagram permissions:
   - `instagram_basic` - Basic Instagram account access
   - `instagram_content_publish` - Create and publish posts
   - `instagram_manage_comments` - Manage comments on posts
   - `instagram_manage_insights` - Access Instagram analytics

#### Step 3: Instagram Business Account Requirements
**IMPORTANT:** Instagram API requires:
- ✅ Instagram **Business** or **Creator** account (not personal)
- ✅ Instagram account must be **linked to a Facebook Page**
- ✅ You must be an admin of both the Instagram account and Facebook Page

#### Step 4: Link Instagram to Facebook Page
1. Go to your Facebook Page settings
2. Navigate to **Instagram** → **Connect Account**
3. Log in to your Instagram Business account
4. Authorize the connection

#### Step 5: Test Instagram Connection
1. Use the updated Instagram page in your automation dashboard
2. Click "Connect Instagram"
3. It will use the same Facebook login but with Instagram permissions
4. Verify that your Instagram Business account is detected

### 2. Environment Configuration

Create a `.env` file in your project root:

```env
REACT_APP_FACEBOOK_APP_ID=your_actual_app_id_here
```

**Replace `your_actual_app_id_here` with your real Facebook App ID**

### 3. Make.com Webhook Setup

1. Your webhook URL: `https://hook.eu2.make.com/m4f3qzhwhe4y62i9ghviwe4zw23hytio`
2. Make sure your Make.com scenario is **active**
3. Test the webhook URL manually to ensure it's working

## 🐛 Common Issues & Solutions

### Issue 1: "No Instagram Business accounts found"
**Solutions:**
- Ensure you have an Instagram **Business** account (not personal)
- Link your Instagram account to a Facebook Page first
- Make sure you're an admin of both accounts
- Check that the Facebook Page → Instagram connection is active

### Issue 2: "Instagram permissions denied"
**Solutions:**
- Your app needs App Review approval for Instagram permissions in production
- For testing, add yourself as a test user in App Roles → Roles
- Ensure your Instagram account is set to Business/Creator mode

### Issue 3: "Facebook SDK not loaded"
**Solution:** Check your internet connection and firewall settings. The SDK loads from Facebook's CDN.

### Issue 4: "Facebook App ID not configured"
**Solution:** Make sure you have a `.env` file with `REACT_APP_FACEBOOK_APP_ID=your_app_id`

### Issue 5: "Login was cancelled or failed"
**Solutions:**
- Make sure your domain is added to Facebook App settings
- Check if your app is in "Development" mode (only you can test it)
- For production, submit your app for review

### Issue 6: "No Facebook pages found"
**Solution:** 
- You need to have a Facebook Page (not just a personal profile)
- Create a page at [facebook.com/pages/create](https://facebook.com/pages/create)

### Issue 7: "Webhook failed"
**Solutions:**
- Check if your Make.com scenario is active
- Verify the webhook URL is correct
- Check Make.com logs for errors

### Issue 8: Permission Errors
**Solutions:**
- Make sure you've requested the right permissions in Facebook App settings
- For production apps, permissions need to be approved by Facebook

## 🔍 Debug Information

When you click "Connect Instagram", check the browser console for:

1. **SDK Loading:** Should see "✅ Facebook SDK initialized successfully"
2. **Login Process:** Should see detailed logs of each step
3. **API Responses:** Should see Facebook API responses
4. **Instagram Accounts:** Should see detected Instagram Business accounts
5. **Webhook Communication:** Should see webhook request/response details

## 📱 Testing Steps

1. **Test SDK Loading:**
   - Open console, type `window.FB` - should return an object
   
2. **Test App ID:**
   - Check console for "Initializing Facebook SDK with App ID: YOUR_ID"
   
3. **Test Login:**
   - Click connect button, should open Facebook login popup
   
4. **Test Permissions:**
   - After login, should see "Facebook login successful" in console
   
5. **Test Page Access:**
   - Should see "Found page: [Page Name]" in activity log

6. **Test Instagram Detection:**
   - Should see "Connected Instagram account: [Account Details]" in console

## 🚀 Production Checklist

- [ ] Facebook App is switched from "Development" to "Live" mode
- [ ] All required permissions are approved by Facebook
- [ ] Domain is properly configured in Facebook App settings
- [ ] SSL certificate is installed (HTTPS required for production)
- [ ] Make.com webhook is tested and working
- [ ] Instagram Business account is properly linked to Facebook Page
- [ ] Instagram permissions are approved through App Review

## 📞 Still Having Issues?

If you're still having problems, please share:
1. **Console error messages** (screenshot or copy-paste)
2. **Your Facebook App ID** (for verification)
3. **The exact error message** from the activity log
4. **Your domain/URL** you're testing from
5. **Instagram account type** (Business/Creator/Personal)
6. **Whether Instagram is linked to a Facebook Page**

This will help identify the specific issue! 🕵️‍♂️ 