# Optional: Sentry Error Tracking Setup

## Installation

```bash
cd itam-saas/Agent
npm install @sentry/node @sentry/profiling-node
```

## Configuration

### 1. Sign up at https://sentry.io (free tier available)

### 2. Create new project
- Platform: Node.js
- Copy your DSN

### 3. Add to Railway environment variables
```bash
railway variables --set SENTRY_DSN="https://your-sentry-dsn@sentry.io/project-id"
```

### 4. Add to server.js (after imports, before everything else)

```javascript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry FIRST
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new ProfilingIntegration(),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    profilesSampleRate: 0.1,
  });
}
```

### 5. Add error handler (replace existing global error handler)

```javascript
// Global error handler
app.use((err, req, res, next) => {
  const requestId = req?.requestId || 'unknown';
  console.error(`[${new Date().toISOString()}] [${requestId}] Unhandled error:`, err);
  
  // Send to Sentry
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(err);
  }
  
  // Record error for crash detection
  recordError(err, { requestId, url: req?.url, method: req?.method });
  
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({
    error: 'Internal server error',
    requestId
  });
});
```

### 6. Deploy

```bash
railway up
```

## Benefits

- Real-time error notifications
- Stack traces with context
- User impact tracking
- Performance monitoring
- Release tracking

---

**Status:** Optional but recommended for production monitoring.
