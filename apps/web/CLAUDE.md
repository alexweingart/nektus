# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nektus is a Next.js 15 contact exchange application that enables real-time contact sharing through motion detection (bump-to-exchange). The app uses Firebase for authentication, profile storage, and real-time data sync, with Redis for matching logic. It features a PWA design with offline capabilities.

## Development Commands

### Core Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm start` - Start production server

### Development Variants
- `npm run dev:https` - Development server with HTTPS
- `npm run dev:local` - Local development with custom hostname
- `npm run dev:local:https` - Local HTTPS development
- `npm run dev:ngrok` - Development with ngrok tunneling

## Architecture Overview

### Core Components
- **Real-time Contact Exchange**: Motion-based contact sharing using accelerometer data, clock synchronization, and Redis-backed matching (`src/lib/services/realTimeContactExchangeService.ts`)
- **Profile Management**: Firebase Firestore integration with real-time subscriptions (`src/lib/firebase/clientProfileService.ts`)
- **Authentication**: NextAuth.js with Google OAuth and Firebase Auth integration
- **AI-powered Features**: OpenAI integration for bio generation and social profile discovery
- **PWA**: Progressive Web App with service worker, caching, and offline support

### Key Technologies
- **Frontend**: React 18, Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Firebase Admin SDK, Redis (Upstash)
- **Database**: Firebase Firestore for profiles and contacts
- **Auth**: NextAuth.js + Firebase Auth dual authentication
- **AI**: OpenAI API for content generation
- **Motion**: DeviceMotionEvent API with iOS permission handling
- **PWA**: next-pwa with Workbox for caching strategies

### Directory Structure
- `src/app/` - Next.js App Router pages and API routes
- `src/app/components/` - Reusable UI components and view components
- `src/lib/firebase/` - Firebase client and admin configurations, profile services
- `src/lib/services/` - Business logic services (contact exchange, vCard, messaging)
- `src/lib/utils/` - Utility functions (motion detection, clock sync, formatters)
- `src/types/` - TypeScript type definitions

### State Management
- **ProfileContext**: React Context for user profile state with Firebase real-time sync
- **SessionProvider**: NextAuth session management
- **AdminModeProvider**: Development/debugging features

### Key Services
- **RealTimeContactExchangeService**: Handles motion detection, timing synchronization, and contact matching
- **ClientProfileService**: Firebase Firestore operations with offline fallbacks
- **MotionDetector**: Accelerometer-based bump detection with iOS permission handling
- **ClockSync**: Server-client time synchronization for accurate motion matching

## Firebase Configuration

The app uses dual Firebase configurations:
- Client SDK (`clientConfig.ts`) for frontend operations
- Admin SDK (`adminConfig.ts`) for server-side operations
- Profile data stored in `profiles` collection with subcollections for contacts

## Development Notes

### Motion Detection
- Requires HTTPS for DeviceMotionEvent API access
- iOS requires explicit permission requests
- Uses vector magnitude and timing for matching algorithm

### Authentication Flow
- NextAuth handles OAuth flow
- Firebase Auth provides Firestore access tokens
- Profile creation happens post-authentication

### PWA Features
- Service worker handles caching strategies
- Manifest.json for app installation
- Background image and profile image caching

### Testing Motion Features
- Use `npm run dev:https` or `npm run dev:local:https` for motion API access
- Physical devices required for motion testing
- Clock synchronization critical for accurate matching

## CRITICAL CONSTRAINTS

### Time Window Constraints (NEVER MODIFY WITHOUT PERMISSION)
The geographic matching time windows in `src/lib/services/server/ipGeolocationService.ts` are:
- VPN: 200ms
- City: 500ms  
- State: 400ms
- Octet: 300ms

**DO NOT modify these values without explicit user permission.** These windows are precisely calibrated and any changes must solve timing issues through proper clock synchronization, not by expanding the windows.