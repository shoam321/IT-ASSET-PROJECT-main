# IT Asset Tracker SaaS

A comprehensive IT asset management system built with React, Node.js, and PostgreSQL/Supabase. Automatically discover, track, and manage IT infrastructure across multiple platforms.

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

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- PostgreSQL database (Supabase recommended)

### Installation

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

### Configuration

#### Backend (.env)
```
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=5000
NODE_ENV=development
TENANT_ID=default_tenant
TENANT_NAME=Default Tenant
```

#### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
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
  asset_type VARCHAR(50) NOT NULL,
  manufacturer VARCHAR(255),
  model VARCHAR(255),
  serial_number VARCHAR(255) UNIQUE,
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
