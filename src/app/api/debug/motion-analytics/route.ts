/**
 * Debug endpoint for motion analytics
 * Analyzes logged motion data and provides insights for threshold tuning
 * GET /api/debug/motion-analytics
 * POST /api/debug/motion-analytics (with motion data for analysis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';

// In-memory storage for motion analytics (in production, use Redis or database)
let motionAnalyticsStore: Map<string, any[]> = new Map();

interface MotionEvent {
  timestamp: number;
  magnitude: number;
  jerk: number;
  acceleration: { x: number; y: number; z: number };
  isIOS: boolean;
  userAgent: string;
  thresholds: { magnitude: number; jerk: number };
  exceedsThresholds: { magnitude: boolean; jerk: boolean; both: boolean };
}

interface MotionSession {
  sessionId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  outcome: 'success' | 'timeout' | 'error';
  detectionType?: string;
  confidence?: number;
  totalEvents: number;
  deviceInfo: any;
  events: MotionEvent[];
  summary: any;
}

// Analyze motion data and provide insights
function analyzeMotionData(sessions: MotionSession[]): any {
  if (sessions.length === 0) {
    return { error: 'No motion data available for analysis' };
  }

  const analysis = {
    overview: {
      totalSessions: sessions.length,
      successfulSessions: sessions.filter(s => s.outcome === 'success').length,
      timeoutSessions: sessions.filter(s => s.outcome === 'timeout').length,
      errorSessions: sessions.filter(s => s.outcome === 'error').length,
      successRate: 0,
      avgEventsPerSession: 0,
      avgSessionDuration: 0
    },
    deviceAnalysis: {
      iOS: { sessions: 0, successRate: 0, avgMagnitude: 0, avgJerk: 0 },
      Android: { sessions: 0, successRate: 0, avgMagnitude: 0, avgJerk: 0 },
      other: { sessions: 0, successRate: 0, avgMagnitude: 0, avgJerk: 0 }
    },
    thresholdAnalysis: {
      currentThresholds: { magnitude: 0, jerk: 0 },
      suggestedThresholds: { magnitude: 0, jerk: 0 },
      thresholdEffectiveness: 0,
      missedOpportunities: 0,
      falsePositives: 0
    },
    patternAnalysis: {
      asymmetricBumps: 0,
      subtlePatterns: 0,
      traditionalDetections: 0,
      patternSuccessRate: 0
    },
    recommendations: [] as string[]
  };

  // Calculate overview metrics
  analysis.overview.successRate = analysis.overview.successfulSessions / analysis.overview.totalSessions * 100;
  analysis.overview.avgEventsPerSession = sessions.reduce((sum, s) => sum + s.totalEvents, 0) / sessions.length;
  
  const sessionsWithDuration = sessions.filter(s => s.endTime);
  if (sessionsWithDuration.length > 0) {
    analysis.overview.avgSessionDuration = sessionsWithDuration.reduce((sum, s) => sum + (s.endTime! - s.startTime), 0) / sessionsWithDuration.length;
  }

  // Analyze by device type
  const deviceTypes = ['iOS', 'Android', 'other'];
  for (const deviceType of deviceTypes) {
    const deviceSessions = sessions.filter(s => {
      if (deviceType === 'iOS') return s.deviceInfo?.isIOS === true;
      if (deviceType === 'Android') return s.deviceInfo?.isAndroid === true;
      return !s.deviceInfo?.isIOS && !s.deviceInfo?.isAndroid;
    });

    if (deviceSessions.length > 0) {
      analysis.deviceAnalysis[deviceType as keyof typeof analysis.deviceAnalysis] = {
        sessions: deviceSessions.length,
        successRate: deviceSessions.filter(s => s.outcome === 'success').length / deviceSessions.length * 100,
        avgMagnitude: deviceSessions.reduce((sum, s) => {
          const events = s.events || [];
          return sum + (events.length > 0 ? events.reduce((eSum, e) => eSum + e.magnitude, 0) / events.length : 0);
        }, 0) / deviceSessions.length,
        avgJerk: deviceSessions.reduce((sum, s) => {
          const events = s.events || [];
          return sum + (events.length > 0 ? events.reduce((eSum, e) => eSum + e.jerk, 0) / events.length : 0);
        }, 0) / deviceSessions.length
      };
    }
  }

  // Analyze patterns
  const successfulSessions = sessions.filter(s => s.outcome === 'success');
  analysis.patternAnalysis.traditionalDetections = successfulSessions.filter(s => s.detectionType === 'traditional').length;
  analysis.patternAnalysis.asymmetricBumps = successfulSessions.filter(s => s.detectionType === 'asymmetric_sustained' || s.detectionType === 'asymmetric_variability').length;
  analysis.patternAnalysis.subtlePatterns = successfulSessions.filter(s => s.detectionType === 'subtle_pattern').length;
  analysis.patternAnalysis.patternSuccessRate = (analysis.patternAnalysis.asymmetricBumps + analysis.patternAnalysis.subtlePatterns) / analysis.overview.successfulSessions * 100;

  // Threshold analysis
  const allEvents = sessions.flatMap(s => s.events || []);
  if (allEvents.length > 0) {
    const avgMagnitude = allEvents.reduce((sum, e) => sum + e.magnitude, 0) / allEvents.length;
    const avgJerk = allEvents.reduce((sum, e) => sum + e.jerk, 0) / allEvents.length;
    
    // Get current thresholds from most recent session
    const recentSession = sessions.sort((a, b) => b.startTime - a.startTime)[0];
    if (recentSession.events && recentSession.events.length > 0) {
      analysis.thresholdAnalysis.currentThresholds = recentSession.events[0].thresholds;
    }

    // Calculate suggested thresholds based on success patterns
    const successfulEvents = successfulSessions.flatMap(s => s.events || []);
    const timeoutSessions = sessions.filter(s => s.outcome === 'timeout');
    const timeoutEvents = timeoutSessions.flatMap(s => s.events || []);

    if (successfulEvents.length > 0) {
      const successMagnitudes = successfulEvents.map(e => e.magnitude);
      const successJerks = successfulEvents.map(e => e.jerk);
      
      // Suggest thresholds at 5th percentile of successful detections
      successMagnitudes.sort((a, b) => a - b);
      successJerks.sort((a, b) => a - b);
      
      const percentile5Index = Math.floor(successMagnitudes.length * 0.05);
      analysis.thresholdAnalysis.suggestedThresholds = {
        magnitude: successMagnitudes[percentile5Index] || avgMagnitude,
        jerk: successJerks[percentile5Index] || avgJerk
      };
    }

    // Calculate effectiveness
    const thresholdMet = allEvents.filter(e => e.exceedsThresholds.both).length;
    analysis.thresholdAnalysis.thresholdEffectiveness = thresholdMet / allEvents.length * 100;
    
    // Estimate missed opportunities (timeout sessions with events that nearly met thresholds)
    analysis.thresholdAnalysis.missedOpportunities = timeoutEvents.filter(e => 
      e.magnitude >= analysis.thresholdAnalysis.currentThresholds.magnitude * 0.8 ||
      e.jerk >= analysis.thresholdAnalysis.currentThresholds.jerk * 0.8
    ).length;
  }

  // Generate recommendations
  if (analysis.overview.successRate < 70) {
    analysis.recommendations.push('Success rate is below 70%. Consider lowering thresholds or improving motion detection sensitivity.');
  }

  if (analysis.deviceAnalysis.iOS.successRate < analysis.deviceAnalysis.Android.successRate - 20) {
    analysis.recommendations.push('iOS success rate is significantly lower than Android. Consider iOS-specific threshold adjustments.');
  }

  if (analysis.patternAnalysis.patternSuccessRate > 30) {
    analysis.recommendations.push('Pattern-based detection is contributing significantly to success. Consider optimizing pattern detection parameters.');
  }

  if (analysis.thresholdAnalysis.missedOpportunities > analysis.overview.successfulSessions * 0.5) {
    analysis.recommendations.push('Many timeout sessions had near-threshold events. Consider slightly lowering thresholds.');
  }

  if (analysis.thresholdAnalysis.suggestedThresholds.magnitude < analysis.thresholdAnalysis.currentThresholds.magnitude * 0.8) {
    analysis.recommendations.push(`Consider lowering magnitude threshold from ${analysis.thresholdAnalysis.currentThresholds.magnitude.toFixed(1)} to ${analysis.thresholdAnalysis.suggestedThresholds.magnitude.toFixed(1)}.`);
  }

  return analysis;
}

// GET endpoint - retrieve analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const userMotionData = motionAnalyticsStore.get(userId) || [];
    
    const analysis = analyzeMotionData(userMotionData);
    
    return NextResponse.json({
      success: true,
      userId: userId,
      analysis: analysis,
      rawSessions: userMotionData.length,
      message: `Motion analytics for ${userMotionData.length} sessions`
    });
    
  } catch (error) {
    console.error('Motion analytics error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint - submit motion data for analysis
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const userId = session.user.id;
    
    // Store the motion session data
    if (!motionAnalyticsStore.has(userId)) {
      motionAnalyticsStore.set(userId, []);
    }
    
    const userSessions = motionAnalyticsStore.get(userId)!;
    userSessions.push({
      sessionId: data.sessionId || `session-${Date.now()}`,
      userId: userId,
      startTime: data.startTime || Date.now(),
      endTime: data.endTime,
      outcome: data.outcome || 'unknown',
      detectionType: data.detectionType,
      confidence: data.confidence,
      totalEvents: data.totalEvents || 0,
      deviceInfo: data.deviceInfo || {},
      events: data.events || [],
      summary: data.summary || {}
    });
    
    // Keep only the latest 100 sessions per user
    if (userSessions.length > 100) {
      userSessions.splice(0, userSessions.length - 100);
    }
    
    motionAnalyticsStore.set(userId, userSessions);
    
    return NextResponse.json({
      success: true,
      message: 'Motion data stored for analysis',
      totalSessions: userSessions.length
    });
    
  } catch (error) {
    console.error('Motion analytics storage error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: DELETE endpoint to clear analytics data
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    motionAnalyticsStore.delete(userId);
    
    return NextResponse.json({
      success: true,
      message: 'Motion analytics data cleared'
    });
    
  } catch (error) {
    console.error('Motion analytics clear error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
} 