# Automation Dashboard Backend

A powerful FastAPI backend for social media automation, designed to replace Make.com webhooks with a robust, scalable solution.

## 🚀 Features

- **User Authentication** - JWT-based auth with secure password hashing
- **Social Media Integration** - Facebook Pages API with auto-posting and auto-reply
- **Post Management** - Schedule, draft, and publish posts across platforms
- **Automation Rules** - Configurable triggers and actions for social media automation
- **RESTful API** - Well-documented endpoints with OpenAPI/Swagger docs
- **Database Management** - PostgreSQL with SQLAlchemy ORM and Alembic migrations
- **Background Tasks** - Celery integration for asynchronous processing
- **Security** - CORS, trusted hosts, and environment-based configuration

## 📋 Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Redis (for Celery background tasks)
- Facebook Developer Account (for social media integration)

## 🛠️ Installation

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Set up database:**
   ```bash
   # Create database in PostgreSQL
   createdb automation_dashboard
   
   # Run migrations
   alembic upgrade head
   ```

6. **Start Redis (for background tasks):**
   ```bash
   redis-server
   ```

## ⚙️ Configuration

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost/automation_dashboard

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT Authentication
SECRET_KEY=your-super-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Facebook Integration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Environment
ENVIRONMENT=development
DEBUG=True
CORS_ORIGINS=["http://localhost:3000", "https://localhost:3000"]
```

## 🚀 Running the Application

### Development Mode
```bash
python run.py
```

### Using uvicorn directly
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Production Mode
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📚 API Documentation

Once running, visit:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/health

## 🔑 Key API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Social Media
- `GET /api/social/accounts` - Get connected social accounts
- `POST /api/social/facebook/connect` - Connect Facebook account
- `POST /api/social/facebook/post` - Create Facebook post *(replaces Make.com)*
- `POST /api/social/facebook/auto-reply` - Toggle auto-reply *(replaces Make.com)*

### Posts & Automation
- `GET /api/social/posts` - Get user posts
- `POST /api/social/posts` - Create new post
- `GET /api/social/automation-rules` - Get automation rules
- `POST /api/social/automation-rules` - Create automation rule

## 🔄 Migrating from Make.com

Replace your Make.com webhook URLs with these endpoints:

### Old Make.com Webhook
```javascript
const WEBHOOK_URL_AUTO = "https://hook.eu2.make.com/m4f3qzhwhe4y62i9ghviwe4zw23hytio";
```

### New FastAPI Endpoint
```javascript
const API_BASE = "http://localhost:8000/api";

// Auto-posting
fetch(`${API_BASE}/social/facebook/post`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${userToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    page_id: pageId,
    message: message,
    post_type: "post-auto",
    image: imageUrl
  })
});

// Auto-reply toggle
fetch(`${API_BASE}/social/facebook/auto-reply`, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${userToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    enabled: true,
    page_id: pageId,
    response_template: "Thank you for your comment!"
  })
});
```

## 🗄️ Database Schema

The backend uses these main models:

- **User** - User accounts and authentication
- **SocialAccount** - Connected social media accounts
- **Post** - Social media posts and scheduling
- **AutomationRule** - Automation triggers and actions

## 🔧 Development

### Database Migrations
```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black app/
isort app/
```

## 📈 Background Tasks (Future)

The application is ready for Celery integration:

```bash
# Start Celery worker
celery -A app.tasks.celery_app worker --loglevel=info

# Start Celery beat (scheduler)
celery -A app.tasks.celery_app beat --loglevel=info
```

## 🔒 Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - Bcrypt for password security
- **CORS Protection** - Configurable origin restrictions
- **Input Validation** - Pydantic schemas for all endpoints
- **SQL Injection Protection** - SQLAlchemy ORM prevents injection attacks

## 🚀 Deployment

### Docker (Recommended)
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables for Production
```env
ENVIRONMENT=production
DEBUG=False
DATABASE_URL=postgresql://user:pass@prod-db:5432/automation_dashboard
SECRET_KEY=your-production-secret-key
CORS_ORIGINS=["https://yourdomain.com"]
```

## 🤝 Integration with Frontend

Update your React frontend to use the new backend:

```javascript
// Replace Make.com webhooks with API calls
const apiClient = {
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  
  async post(endpoint, data, token) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};
```

## 📞 Support

- Check the API documentation at `/docs`
- Review the database schema in `app/models/`
- Examine example requests in `app/schemas/`

## 🔮 Future Enhancements

- Instagram integration
- Email automation
- Campaign management
- Analytics dashboard
- Multi-tenant support
- Real-time notifications 