'use client';

import React, { useState, useEffect, useRef } from 'react';

interface MotionEvent {
  timestamp: number;
  magnitude: number;
  jerk: number;
  acceleration: { x: number; y: number; z: number };
  thresholds: { magnitude: number; jerk: number };
  exceedsThresholds: { magnitude: boolean; jerk: boolean; both: boolean };
}

interface MotionDebuggerProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export const MotionDebugger: React.FC<MotionDebuggerProps> = ({ enabled, onToggle }) => {
  const [motionEvents, setMotionEvents] = useState<MotionEvent[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Real-time motion monitoring
  useEffect(() => {
    if (!enabled || !isMonitoring) return;

    const motionEventHandler = (event: DeviceMotionEvent) => {
      const accel = event.acceleration ?? event.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      const magnitude = Math.hypot(accel.x, accel.y, accel.z);
      const now = Date.now();
      
      // Calculate jerk (simplified)
      const prevEvent = motionEvents[motionEvents.length - 1];
      let jerk = 0;
      if (prevEvent && prevEvent.timestamp > 0) {
        const deltaTime = (now - prevEvent.timestamp) / 1000;
        const deltaMagnitude = magnitude - prevEvent.magnitude;
        jerk = Math.abs(deltaMagnitude / deltaTime);
      }

      const newEvent: MotionEvent = {
        timestamp: now,
        magnitude: magnitude,
        jerk: jerk,
        acceleration: { x: accel.x, y: accel.y, z: accel.z },
        thresholds: { magnitude: 10, jerk: 100 }, // Default thresholds
        exceedsThresholds: {
          magnitude: magnitude >= 10,
          jerk: jerk >= 100,
          both: magnitude >= 10 && jerk >= 100
        }
      };

      setMotionEvents(prev => {
        const updated = [...prev, newEvent];
        return updated.slice(-100); // Keep last 100 events
      });
    };

    window.addEventListener('devicemotion', motionEventHandler);
    
    return () => {
      window.removeEventListener('devicemotion', motionEventHandler);
    };
  }, [enabled, isMonitoring, motionEvents]);

  // Canvas visualization
  useEffect(() => {
    if (!enabled || !canvasRef.current || motionEvents.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw magnitude over time
    const maxMagnitude = Math.max(...motionEvents.map(e => e.magnitude), 20);
    const maxJerk = Math.max(...motionEvents.map(e => e.jerk), 200);
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    motionEvents.forEach((event, index) => {
      const x = (index / motionEvents.length) * canvas.width;
      const y = canvas.height - (event.magnitude / maxMagnitude) * (canvas.height / 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw jerk over time
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    motionEvents.forEach((event, index) => {
      const x = (index / motionEvents.length) * canvas.width;
      const y = canvas.height - (event.jerk / maxJerk) * (canvas.height / 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw threshold lines
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Magnitude threshold
    const magThresholdY = canvas.height - (10 / maxMagnitude) * (canvas.height / 2);
    ctx.beginPath();
    ctx.moveTo(0, magThresholdY);
    ctx.lineTo(canvas.width, magThresholdY);
    ctx.stroke();
    
    // Jerk threshold
    const jerkThresholdY = canvas.height - (100 / maxJerk) * (canvas.height / 2);
    ctx.beginPath();
    ctx.moveTo(0, jerkThresholdY);
    ctx.lineTo(canvas.width, jerkThresholdY);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }, [enabled, motionEvents]);

  // Fetch analytics
  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/debug/motion-analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analysis);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  // Clear analytics data
  const clearAnalytics = async () => {
    try {
      await fetch('/api/debug/motion-analytics', { method: 'DELETE' });
      setAnalytics(null);
    } catch (error) {
      console.error('Failed to clear analytics:', error);
    }
  };

  // Get device info
  useEffect(() => {
    if (enabled && typeof window !== 'undefined') {
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isAndroid = /Android/.test(userAgent);
      
      setDeviceInfo({
        userAgent,
        isIOS,
        isAndroid,
        hasDeviceMotion: typeof DeviceMotionEvent !== 'undefined',
        hasPermissionAPI: typeof (DeviceMotionEvent as any).requestPermission === 'function',
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints
      });
    }
  }, [enabled]);

  if (!enabled) return null;

  const latestEvent = motionEvents[motionEvents.length - 1];
  const avgMagnitude = motionEvents.length > 0 ? motionEvents.reduce((sum, e) => sum + e.magnitude, 0) / motionEvents.length : 0;
  const maxMagnitude = motionEvents.length > 0 ? Math.max(...motionEvents.map(e => e.magnitude)) : 0;
  const eventsAboveThreshold = motionEvents.filter(e => e.exceedsThresholds.both).length;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white p-4 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Motion Debugger</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`px-3 py-1 rounded text-sm ${
                isMonitoring 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isMonitoring ? 'Stop' : 'Start'} Monitoring
            </button>
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Load Analytics
            </button>
            <button
              onClick={clearAnalytics}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
            >
              Clear Data
            </button>
            <button
              onClick={() => onToggle(false)}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Real-time Data */}
          <div className="bg-gray-800 p-3 rounded">
            <h4 className="font-semibold mb-2">Real-time Data</h4>
            <div className="text-sm space-y-1">
              <div>Events: {motionEvents.length}</div>
              <div>Current Magnitude: {latestEvent?.magnitude.toFixed(2) || '0.00'}</div>
              <div>Current Jerk: {latestEvent?.jerk.toFixed(1) || '0.0'}</div>
              <div>Avg Magnitude: {avgMagnitude.toFixed(2)}</div>
              <div>Max Magnitude: {maxMagnitude.toFixed(2)}</div>
              <div>Above Threshold: {eventsAboveThreshold}</div>
              <div className={`font-semibold ${latestEvent?.exceedsThresholds.both ? 'text-green-400' : 'text-red-400'}`}>
                Detection: {latestEvent?.exceedsThresholds.both ? 'YES' : 'NO'}
              </div>
            </div>
          </div>

          {/* Device Info */}
          <div className="bg-gray-800 p-3 rounded">
            <h4 className="font-semibold mb-2">Device Info</h4>
            <div className="text-sm space-y-1">
              <div>Platform: {deviceInfo?.platform || 'Unknown'}</div>
              <div>iOS: {deviceInfo?.isIOS ? 'Yes' : 'No'}</div>
              <div>Android: {deviceInfo?.isAndroid ? 'Yes' : 'No'}</div>
              <div>DeviceMotion: {deviceInfo?.hasDeviceMotion ? 'Yes' : 'No'}</div>
              <div>Permission API: {deviceInfo?.hasPermissionAPI ? 'Yes' : 'No'}</div>
              <div>Touch Points: {deviceInfo?.maxTouchPoints || 0}</div>
            </div>
          </div>

          {/* Analytics Summary */}
          {analytics && (
            <div className="bg-gray-800 p-3 rounded">
              <h4 className="font-semibold mb-2">Analytics</h4>
              <div className="text-sm space-y-1">
                <div>Total Sessions: {analytics.overview?.totalSessions || 0}</div>
                <div>Success Rate: {analytics.overview?.successRate?.toFixed(1) || '0.0'}%</div>
                <div>Avg Events/Session: {analytics.overview?.avgEventsPerSession?.toFixed(1) || '0.0'}</div>
                <div>Pattern Success: {analytics.patternAnalysis?.patternSuccessRate?.toFixed(1) || '0.0'}%</div>
                <div>Suggested Mag: {analytics.thresholdAnalysis?.suggestedThresholds?.magnitude?.toFixed(1) || 'N/A'}</div>
                <div>Suggested Jerk: {analytics.thresholdAnalysis?.suggestedThresholds?.jerk?.toFixed(1) || 'N/A'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Visualization */}
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Motion Visualization</h4>
          <canvas
            ref={canvasRef}
            width={800}
            height={200}
            className="w-full h-32 bg-gray-800 rounded"
          />
          <div className="text-xs text-gray-400 mt-1">
            Blue: Magnitude | Red: Jerk | Green Dashed: Thresholds
          </div>
        </div>

        {/* Recent Events */}
        <div className="mt-4">
          <h4 className="font-semibold mb-2">Recent Events</h4>
          <div className="max-h-32 overflow-y-auto text-xs">
            {motionEvents.slice(-10).reverse().map((event, index) => (
              <div 
                key={event.timestamp} 
                className={`p-1 mb-1 rounded ${event.exceedsThresholds.both ? 'bg-green-800' : 'bg-gray-800'}`}
              >
                <span className="text-gray-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                {' '}
                Mag: {event.magnitude.toFixed(2)} | Jerk: {event.jerk.toFixed(1)}
                {event.exceedsThresholds.both && <span className="text-green-400 ml-2">✓ DETECTED</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {analytics?.recommendations && analytics.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Recommendations</h4>
            <div className="text-sm space-y-1">
              {analytics.recommendations.map((rec: string, index: number) => (
                <div key={index} className="p-2 bg-yellow-900 rounded">
                  💡 {rec}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }; 