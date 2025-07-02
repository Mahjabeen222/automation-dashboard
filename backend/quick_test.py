"""
Quick test after .env file update
"""

import asyncio
import httpx
from app.config import get_settings

# Clear cache to get fresh settings
get_settings.cache_clear()

async def quick_test():
    settings = get_settings()
    
    print("🔄 Testing After .env Update...")
    print(f"App ID: {settings.facebook_app_id}")
    print(f"App Secret: {settings.facebook_app_secret[:10]}...{settings.facebook_app_secret[-4:]}")
    print()
    
    # Test token exchange with your fresh token
    user_token = "EAAVsw10wHZAgBO886oga4ZBVCLrMPZAKlGk4d11rKW3YZAxwI3TPnP3SMT9GQgjIthwuOmVhtsFG2DT8ml91zL16hPN0y6aiVvOxE2Q1l0LJcq7xxGeRF5GvMZBwzp578ISZATmrfpdAAnPUHVyaBZCZBC7x9DtbWdAExB8Y8fk31T3JLD5EwqNu4BurJzDZBlZAZCeri8ZCnJNhyVw465RizgZDZD"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://graph.facebook.com/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": settings.facebook_app_id,
                "client_secret": settings.facebook_app_secret,
                "fb_exchange_token": user_token
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ SUCCESS! Token exchange works!")
            print(f"Long-lived token: {result.get('access_token')[:30]}...")
            print(f"Expires in: {result.get('expires_in')} seconds (~{result.get('expires_in', 0) // 86400} days)")
            print("\n🎉 Your Facebook integration is now fixed!")
        else:
            print(f"❌ Still failing: {response.text}")
            if settings.facebook_app_id == "1526961221410200":
                print("   The .env file still has old values - make sure you saved it!")
            else:
                print("   App credentials might still be wrong")

if __name__ == "__main__":
    asyncio.run(quick_test()) 