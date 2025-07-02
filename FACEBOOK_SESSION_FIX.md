# Facebook Session Expiration Fix

## Problem Solved

Your Facebook sessions were expiring quickly (within 1-2 hours) because the app was using **short-lived access tokens** instead of **long-lived tokens**.

## What Changed

### 1. **Long-Lived Token Exchange**
- When you connect Facebook, the app now automatically exchanges short-lived tokens for long-lived tokens
- Long-lived tokens last **~60 days** instead of 1-2 hours
- Long-lived page tokens **never expire** (unless you change password or revoke permissions)

### 2. **Token Expiration Tracking**
- The database now properly stores token expiration dates
- The app checks token expiration before making API calls
- Expired tokens are automatically detected and handled

### 3. **Automatic Token Validation**
- Before every Facebook API call, the app validates the token is still active
- If a token is expired or invalid, you get a clear error message
- The account is automatically marked as disconnected for expired tokens

### 4. **Refresh Tokens Feature**
- Added a "Refresh Tokens" button in the Facebook page
- You can manually check the status of all your Facebook connections
- Shows which accounts need reconnection

### 5. **Better Error Handling**
- Clear error messages when tokens expire: "Facebook login session expired. Please reconnect your account."
- Automatic detection of token-related errors in API responses
- Graceful handling of expired tokens during posting

## How It Works Now

1. **Initial Connection**: Short-lived token → Long-lived token (60 days)
2. **Page Tokens**: Automatically get long-lived page tokens that don't expire
3. **Token Validation**: Every API call checks token validity first
4. **Expiration Handling**: Clear messages when reconnection is needed
5. **Manual Refresh**: Use "Refresh Tokens" to check status anytime

## User Experience

### Before Fix:
- ❌ Sessions expired every 1-2 hours
- ❌ Confusing error messages
- ❌ No way to check token status
- ❌ Frequent reconnections required

### After Fix:
- ✅ Sessions last ~60 days
- ✅ Clear expiration messages
- ✅ "Refresh Tokens" button for status checks
- ✅ Automatic long-lived token management
- ✅ Page tokens never expire

## Technical Details

### Backend Changes:
- `FacebookService.exchange_for_long_lived_token()` - Exchanges tokens
- `FacebookService.validate_and_refresh_token()` - Validates tokens
- `FacebookService.get_long_lived_page_tokens()` - Gets page tokens
- New `/api/social/facebook/refresh-tokens` endpoint
- Updated token storage with expiration dates

### Frontend Changes:
- "Refresh Tokens" button in Facebook page
- Better error handling for expired tokens
- Automatic token refresh on expiration
- Improved connection status messages

## Next Steps

1. **Reconnect your Facebook account** to get long-lived tokens
2. **Use the "Refresh Tokens" button** to verify your tokens
3. **Enjoy 60-day sessions** instead of hourly expiration!

## Facebook Token Types

| Token Type | Duration | Use Case |
|------------|----------|----------|
| Short-lived User Token | 1-2 hours | Initial login |
| Long-lived User Token | ~60 days | Our app now uses these |
| Long-lived Page Token | Permanent* | Never expires unless revoked |

*Page tokens only become invalid if you change password, revoke app permissions, or delete the page. 