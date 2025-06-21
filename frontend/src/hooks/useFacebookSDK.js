import { useEffect } from 'react';

const useFacebookSDK = () => {
  useEffect(() => {
    // Check if SDK is already loaded
    if (window.FB) {
      console.log('Facebook SDK already loaded');
      return;
    }

    console.log('Loading Facebook SDK...');

    window.fbAsyncInit = function() {
      const appId = process.env.REACT_APP_FACEBOOK_APP_ID || 'your-facebook-app-id';
      
      console.log('Initializing Facebook SDK with App ID:', appId);
      
      if (!appId || appId === 'your-facebook-app-id') {
        console.error('❌ Facebook App ID not configured! Please set REACT_APP_FACEBOOK_APP_ID in your .env file');
        return;
      }

      window.FB.init({
        appId: appId,
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });

      // Check if initialization was successful
      window.FB.getLoginStatus((response) => {
        console.log('Facebook SDK initialized. Login status:', response.status);
      });

      console.log('✅ Facebook SDK initialized successfully');
    };

    // Load Facebook SDK script
    if (!document.getElementById('facebook-jssdk')) {
      console.log('Loading Facebook SDK script...');
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.onload = () => {
        console.log('✅ Facebook SDK script loaded');
      };
      script.onerror = () => {
        console.error('❌ Failed to load Facebook SDK script');
      };
      document.body.appendChild(script);
    }
  }, []);
};

export default useFacebookSDK; 