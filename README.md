# IT Asset Tracker - Self-Hosted SaaS Platform

A comprehensive, **fully self-hostable** IT asset management system built with React, Node.js, and PostgreSQL. Deploy on your own infrastructure to maintain complete control over your asset data and operations.

> 🏠 **100% Self-Hosted** - Run entirely on your own servers, no external dependencies required  
> 🔒 **Data Privacy** - Your asset data never leaves your infrastructure  
> 🚀 **Easy Deployment** - Simple setup with Docker Compose or manual installation  
> 💰 **Zero Vendor Lock-in** - Open source, fully customizable, and free to use

## Features

- 📊 **Asset Dashboard** - View and manage all IT assets in one place
- 🔍 **Smart Search** - Filter assets by tag, manufacturer, model, or user
- ➕ **Asset Management** - Add, edit, and delete assets
- 🔄 **Auto Discovery** - Automatically discover assets from cloud providers
- 📈 **Statistics** - Track asset counts and status
- 🗄️ **PostgreSQL Integration** - Persistent data storage with Supabase
- 🎨 **Modern UI** - Dark theme with Tailwind CSS and Lucide icons

## Tech Stack

### Frontend
- React 18.2.0
- Tailwind CSS 3.4.1
- Lucide React Icons
- React Scripts

### Backend
- Node.js with Express
- PostgreSQL with pg driver
- Supabase (hosted PostgreSQL)
- CORS enabled

### Infrastructure
- Firebase Admin SDK (optional for discovery agent)
- Environment-based configuration

## Project Structure

```
IT ASSET PROJECT/
├── Index.js                    # Firebase discovery agent
├── Package.json               # Root package
├── itam-saas/
│   ├── Agent/                 # Backend API server
│   │   ├── server.js
│   │   ├── db.js
│   │   ├── queries.js
│   │   ├── package.json
│   │   └── .env
│   └── Client/                # React frontend
│       ├── src/
│       │   ├── App.jsx
│       │   ├── index.js
│       │   └── services/db.js
│       ├── public/
│       ├── package.json
│       └── .env
```

## Notes & Troubleshooting

- Billing `/api/billing` returning 400 for users not linked to an organization: see [BILLING_ORG_CONTEXT_FIX.md](BILLING_ORG_CONTEXT_FIX.md)

## Self-Hosting Guide

### Prerequisites
- **Node.js 16+** - Runtime for backend and frontend
- **PostgreSQL 12+** - Database (can run locally or in Docker)
- **Grafana (Optional)** - For monitoring dashboards
- **Git** - To clone the repository

### Quick Start with Docker Compose (Recommended)

**Coming Soon:** Full Docker Compose setup with all services (PostgreSQL, Backend, Frontend, Grafana) in one command.

```bash
# Clone and start all services
git clone https://github.com/yourusername/IT-ASSET.git
cd IT-ASSET
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
# Grafana: http://localhost:3001
```

### Manual Installation (Full Control)

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/IT-ASSET.git
cd IT-ASSET
```

2. **Install Backend Dependencies**
```bash
cd itam-saas/Agent
npm install
```

3. **Install Frontend Dependencies**
```bash
cd ../Client
npm install
```

### Configuration for Self-Hosting

#### Backend Environment Variables (.env)
Create `itam-saas/Agent/.env`:
```env
# Database Connection (Use your local PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/itassets

# Server Configuration
PORT=5000
NODE_ENV=production

# Multi-tenancy (for single-tenant self-hosting, use defaults)
TENANT_ID=my_company
TENANT_NAME=My Company IT Assets

# Authentication
JWT_SECRET=your-secure-random-secret-here

# Email (Optional - for alerts)
RESEND_API_KEY=your_resend_key_if_needed
```

#### Frontend Environment Variables (.env)
Create `itam-saas/Client/.env`:
```env
# Point to your self-hosted backend
REACT_APP_API_URL=http://localhost:5000/api

# Optional: Self-hosted Grafana for monitoring
REACT_APP_GRAFANA_URL=http://localhost:3001

# # Production Deployment (Self-Hosted on Your Server)

**Build for Production:**
```bash
# Build Frontend
cd itam-saas/Client
npm run build

# Serve static files with nginx or any web server
# Or use Node.js static server:
npx serve -s build -l 80

# Backend runs as-is:
cd ../Agent
NODE_ENV=production node server.js
```

**Systemd Service (Linux):**
```bash
# Create service file: /etc/systemd/system/itassets.service
[Unit]
Description=IT Asset Tracker Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/itassets/itam-saas/Agent
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

**Reverse Proxy (Nginx):**
```nginx
server {
    listen 80;
    server_name assets.yourdomain.com;

    # Frontend
    location / {
        root /opt/itassets/itam-saas/Client/build;
        try_files $uri /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Self-Hosting Benefits

✅ **Complete Data Control** - All asset data stays on your infrastructure  
✅ **Customizable** - Modify code to fit your exact requirements  
✅ **No Subscription Fees** - One-time setup, no recurring costs  
✅ **Enterprise Security** - Deploy behind your firewall  
✅ **Compliance Ready** - Meet data residency requirements  
✅ **Unlimited Users** - No per-user pricing constraints  

##Google SSO (Optional - leave blank for local auth)
REACT_APP_GOOGLE_CLIENT_ID=
```

#### PostgreSQL Setup (Self-Hosted)

**Option 1: Local PostgreSQL Installation**
```bash
# Install PostgreSQL (Windows)
winget install PostgreSQL.PostgreSQL

# Or use Docker
docker run -d \
  --name itassets-postgres \
  -e POSTGRES_PASSWORD=yourpassword \
  -e POSTGRES_DB=itassets \
  -p 5432:5432 \
  postgres:15
```

**Option 2: Use Database Initialization Scripts**
```bash
# Initialize database schema
psql -U yourusername -d itassets -f itam-saas/Agent/init-db.sql
```

### Running the Application

**Terminal 1 - Backend Server:**
```bash
cd itam-saas/Agent
npm start
```

**Terminal 2 - Frontend Dev Server:**
```bash
cd itam-saas/Client
npm start
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Assets
- `GET /api/assets` - Get all assets
- `GET /api/assets/:id` - Get asset by ID
- `GET /api/assets/search/:query` - Search assets
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset

### Statistics
- `GET /api/stats` - Get asset statistics

### Health
- `GET /health` - Health check endpoint

## Database Schema

### Assets Table
```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag VARCHAR(255) UNIQUE NOT NULL,
  aSelf-Hosting Roadmap

- [x] Manual installation guide
- [x] PostgreSQL integration
- [x] Environment configuration
- [ ] **Docker Compose setup** (In Progress)
- [ ] Kubernetes Helm charts
- [ ] Automated backup scripts
- [ ] Multi-tenant support for hosting providers
- [ ] One-click AWS/Azure/GCP deployment templates
  assigned_user_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'In Use',
  cost DECIMAL(10, 2) DEFAULT 0,
  discovered BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Discovery Agent

The `Index.js` file runs a scheduled discovery agent that:
1. Connects to external APIs (AWS, Azure, etc.)
2. Discovers IT assets across your infrastructure
3. Syncs discovered assets to the database
4. Runs on a configurable schedule (default: hourly)

### Environment Variables
```
FIREBASE_SERVICE_ACCOUNT_KEY=<service-account-json>
DISCOVERY_INTERVAL_MS=3600000
FIRESTORE_PATH=/artifacts/default-asset-tracker/users
```

## Usage

### Add Asset
1. Click "Add Asset" button
2. Fill in asset details (tag, type, manufacturer, model, serial, user)
3. Click "Save Asset"

### Search Assets
1. Use the search bar to filter by asset tag, manufacturer, or model
2. Results update in real-time

### Delete Asset
1. Click the trash icon on any asset row
2. Asset will be immediately deleted

### View Statistics
1. Statistics cards at the bottom show:
   - Total Assets
   - Assets In Use
   - PostgreSQL Connection Status

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support, email support@itasset.local or open an issue on GitHub.

## Roadmap

- [ ] Multi-tenant support
- [ ] Real AWS/Azure discovery integration
- [ ] Asset depreciation tracking
- [ ] Compliance reporting
- [ ] Mobile app
- [ ] Advanced analytics

## Authors

- **Your Name** - Initial work

## Acknowledgments

- Firebase Admin SDK
- React community
- Tailwind CSS
- Supabase team
