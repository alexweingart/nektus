# Upstash Redis Setup for Vercel

This project uses **Upstash Redis** (which is now Vercel's recommended solution for KV storage) for real-time contact exchange matching and rate limiting.

## Setup Instructions

### 1. Connect to your Vercel project

```bash
vercel link
```

### 2. Pull environment variables

```bash
vercel env pull .env.development.local
```

This will automatically pull the Upstash Redis environment variables that Vercel sets up when you add the integration.

### 3. Add Upstash Redis Integration (if not already done)

1. Go to your Vercel project dashboard
2. Navigate to the "Integrations" tab
3. Add "Upstash Redis"
4. This will automatically set up the required environment variables

### 4. Environment Variables

The following environment variables will be automatically set by Vercel:

```bash
# Upstash Redis Configuration (automatically set by Vercel)
KV_REST_API_URL="https://your-instance.upstash.io"
KV_REST_API_TOKEN="your-token-here"
KV_REST_API_READ_ONLY_TOKEN="your-read-only-token-here"
KV_URL="rediss://default:token@your-instance.upstash.io:6379"
REDIS_URL="rediss://default:token@your-instance.upstash.io:6379"
```

### 5. Development vs Production

- **Development**: Uses the same Upstash Redis instance (pulled from Vercel)
- **Production**: Automatically uses the Upstash Redis instance linked to your Vercel project
- **Fallback**: If Upstash is unavailable, the app falls back to in-memory storage

## Features Supported

- ✅ **Rate limiting** for API endpoints
- ✅ **Real-time contact exchange** matching
- ✅ **SSE (Server-Sent Events)** connection tracking
- ✅ **Match data storage** with automatic expiry
- ✅ **Fallback support** for development without Redis

## Usage in Code

The Upstash Redis client is automatically initialized and used throughout the application:

```typescript
import { Redis } from '@upstash/redis';

// Automatically uses environment variables
const redis = Redis.fromEnv();
```

No additional configuration needed - everything works out of the box with Vercel's Upstash integration!
