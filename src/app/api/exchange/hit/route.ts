/**
 * API endpoint for receiving contact exchange "hits" (bumps/taps)
 * Uses Redis for scalable matching and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import type { ContactExchangeRequest, ContactExchangeResponse } from '@/types/contactExchange';
import { 
  checkRateLimit,
  storePendingExchange,
  findMatchingExchange,
  storeExchangeMatch,
  removePendingExchange
} from '@/lib/redis/client';
import { sendToSession } from '@/lib/utils/sseHelpers';

function getClientIP(request: NextRequest): string {
  // Get IP address for matching
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  return '127.0.0.1';
}

function getIPBlock(ip: string): string {
  // Group by /24 subnet for local matching
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }
  return ip;
}

function generateExchangeToken(): string {
  // Generate a secure random token
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    // Get session for user authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const clientIP = getClientIP(request);
    const rateLimit = await checkRateLimit(
      `exchange:${clientIP}:${session.user.email}`,
      10, // 10 requests
      60000 // per minute
    );
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Rate limit exceeded',
          resetTime: rateLimit.resetTime
        },
        { status: 429 }
      );
    }

    // Parse request
    const exchangeRequest: ContactExchangeRequest = await request.json();
    
    // Validate required fields
    if (!exchangeRequest.session || !exchangeRequest.ts) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate timestamp (not too old, not in future)
    const now = Date.now();
    const timeDiff = Math.abs(now - exchangeRequest.ts);
    const clientDelay = now - exchangeRequest.ts; // positive = client timestamp is in the past
    
    console.log(`⏰ Timestamp validation: Server time: ${now}, Client time: ${exchangeRequest.ts}, Delay: ${clientDelay}ms`);
    
    if (timeDiff > 10000) { // 10 seconds tolerance
      return NextResponse.json(
        { success: false, message: 'Request timestamp is invalid' },
        { status: 400 }
      );
    }

    // Prepare exchange data
    const ipBlock = getIPBlock(clientIP);
    const exchangeData = {
      userId: session.user.id, // Use the actual user ID, not email
      userEmail: session.user.email, // Keep email for logging
      timestamp: exchangeRequest.ts,
      magnitude: exchangeRequest.mag,
      vector: exchangeRequest.vector,
      rtt: exchangeRequest.rtt,
      ipBlock
    };

    console.log(`Exchange hit from ${session.user.email} (${exchangeRequest.session}):`, {
      timestamp: exchangeRequest.ts,
      magnitude: exchangeRequest.mag,
      ipBlock,
      hasVector: !!exchangeRequest.vector
    });

    // Look for matching exchange using improved time-based + broad geo matching
    console.log(`🔍 Looking for matches for session ${exchangeRequest.session} with timestamp ${exchangeRequest.ts}`);
    const matchResult = await findMatchingExchange(
      exchangeRequest.session, 
      clientIP,
      null, // location - we'll use IP-based geo instead
      3000, // 3 second time window for testing (more forgiving)
      exchangeRequest.ts // pass timestamp for time-based matching
    );
    console.log(`🔍 Match result:`, matchResult);

    if (matchResult) {
      // We found a match!
      const { sessionId: matchedSessionId, matchData } = matchResult;
      console.log(`🎉 Match found between ${exchangeRequest.session} and ${matchedSessionId}`);
      
      // Generate exchange token
      const exchangeToken = generateExchangeToken();
      console.log(`🔑 Generated exchange token: ${exchangeToken}`);
      
      // Store the match in Redis
      await storeExchangeMatch(
        exchangeToken,
        exchangeRequest.session,
        matchedSessionId,
        session.user.id, // Use user ID instead of email
        matchData.userId
      );
      console.log(`💾 Stored exchange match in Redis`);
      
      // Send real-time notifications to both users
      try {
        // Notify the user who just made the request (current session)
        const notificationSent1 = sendToSession(exchangeRequest.session, {
          type: 'match',
          token: exchangeToken,
          youAre: 'A'
        });
        
        // Notify the previously waiting user (matched session)
        const notificationSent2 = sendToSession(matchedSessionId, {
          type: 'match', 
          token: exchangeToken,
          youAre: 'B'
        });
        
        console.log(`Real-time notifications: Session A (${exchangeRequest.session}): ${notificationSent1}, Session B (${matchedSessionId}): ${notificationSent2}`);
      } catch (error) {
        console.warn('Failed to send real-time notifications:', error);
      }
      
      return NextResponse.json({
        success: true,
        matched: true,
        token: exchangeToken,
        youAre: 'A'
      } as ContactExchangeResponse);
      
    } else {
      // No match found, store this exchange as pending in Redis
      console.log(`⏳ No match found, storing session ${exchangeRequest.session} as pending`);
      await storePendingExchange(exchangeRequest.session, exchangeData, 30);
      console.log(`💾 Stored pending exchange for session ${exchangeRequest.session}`);
      
      // Check again for matches after storing (to handle race conditions)
      console.log(`🔄 Checking again for matches after storing...`);
      const secondMatchResult = await findMatchingExchange(
        exchangeRequest.session, 
        clientIP,
        null,
        3000, // 3 second time window
        exchangeRequest.ts
      );
      
      if (secondMatchResult) {
        console.log(`🎉 Found match on second check between ${exchangeRequest.session} and ${secondMatchResult.sessionId}`);
        
        // Remove ourselves from pending since we found a match
        await removePendingExchange(exchangeRequest.session, clientIP);
        
        // Generate exchange token
        const exchangeToken = generateExchangeToken();
        console.log(`🔑 Generated exchange token: ${exchangeToken}`);
        
        // Store the match in Redis
        await storeExchangeMatch(
          exchangeToken,
          exchangeRequest.session,
          secondMatchResult.sessionId,
          session.user.id, // Use user ID instead of email
          secondMatchResult.matchData.userId
        );
        
        // Send real-time notifications
        try {
          const notificationSent1 = sendToSession(exchangeRequest.session, {
            type: 'match',
            token: exchangeToken,
            youAre: 'A'
          });
          
          const notificationSent2 = sendToSession(secondMatchResult.sessionId, {
            type: 'match', 
            token: exchangeToken,
            youAre: 'B'
          });
          
          console.log(`Real-time notifications: Session A (${exchangeRequest.session}): ${notificationSent1}, Session B (${secondMatchResult.sessionId}): ${notificationSent2}`);
        } catch (error) {
          console.warn('Failed to send real-time notifications:', error);
        }
        
        return NextResponse.json({
          success: true,
          matched: true,
          token: exchangeToken,
          youAre: 'A'
        } as ContactExchangeResponse);
      }
      
      return NextResponse.json({
        success: true,
        matched: false,
        message: 'Exchange registered, waiting for match'
      } as ContactExchangeResponse);
    }

  } catch (error) {
    console.error('Exchange hit error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
