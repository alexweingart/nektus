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

          {/* All Logs */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">Logs</h2>
            <div className="bg-gray-50 border border-gray-300 rounded p-4" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                logs.slice(-50).reverse().map((log, index) => (
                  <div key={index} className="mb-3 p-3 bg-white rounded border border-gray-200 text-xs">
                    <div className="flex justify-between items-start">
                      <div className="font-mono text-gray-500 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</div>
                      <div className="font-semibold text-blue-600">{log.event}</div>
                    </div>
                    <div className="mt-1 text-gray-900 break-all">{log.message}</div>
                    {log.sessionId && (
                      <div className="text-gray-400 text-xs mt-1">Session: {log.sessionId}</div>
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