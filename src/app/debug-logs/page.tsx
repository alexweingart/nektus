'use client';

import React, { useState, useEffect } from 'react';

interface LogEntry {
  timestamp: string;
  event: string;
  message: string;
  sessionId?: string;
}

export default function DebugLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/debug/logs');
        if (response.ok) {
          const data = await response.json();
          if (data.logs) {
            setLogs(data.logs);
          }
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isLive]);

  const clearLogs = async () => {
    try {
      await fetch('/api/debug/logs', { method: 'DELETE' });
      setLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const motionLogs = logs.filter(log => log.event === 'motion_debug');
  const otherLogs = logs.filter(log => log.event !== 'motion_debug');

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Debug Logs</h1>
            <div className="space-x-2">
              <button
                onClick={() => setIsLive(!isLive)}
                className={`px-4 py-2 rounded ${isLive
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-700'
                }`}
              >
                {isLive ? 'Live' : 'Paused'}
              </button>
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                Clear Logs
              </button>
            </div>
          </div>

          {/* Motion Debug Logs */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">Motion Debug Logs</h2>
            <div className="bg-blue-50 border border-blue-200 rounded p-4 max-h-96 overflow-y-auto">
              {motionLogs.length === 0 ? (
                <p className="text-gray-500">No motion debug logs yet...</p>
              ) : (
                motionLogs.slice(-20).map((log, index) => (
                  <div key={index} className="mb-2 p-2 bg-white rounded text-xs">
                    <div className="font-mono text-gray-500">{log.timestamp}</div>
                    <div className="font-bold text-blue-700">{log.event}</div>
                    <div className="mt-1">{log.message}</div>
                    {log.sessionId && (
                      <div className="text-gray-400 text-xs">Session: {log.sessionId}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Other Logs */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-600">Other Logs</h2>
            <div className="bg-gray-50 border border-gray-200 rounded p-4 max-h-96 overflow-y-auto">
              {otherLogs.length === 0 ? (
                <p className="text-gray-500">No other logs yet...</p>
              ) : (
                otherLogs.slice(-20).map((log, index) => (
                  <div key={index} className="mb-2 p-2 bg-white rounded text-xs">
                    <div className="font-mono text-gray-500">{log.timestamp}</div>
                    <div className="font-bold">{log.event}</div>
                    <div className="mt-1">{log.message}</div>
                    {log.sessionId && (
                      <div className="text-gray-400 text-xs">Session: {log.sessionId}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}