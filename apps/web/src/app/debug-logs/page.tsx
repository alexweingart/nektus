'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PullToRefresh } from '../components/ui/layout/PullToRefresh';

interface LogEntry {
  timestamp: string;
  event: string;
  message: string;
  sessionId?: string;
  deviceId?: string;
}

export default function DebugLogsPage() {
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const logsRef = useRef<LogEntry[]>([]);

  useEffect(() => {
    // Load initial logs
    const loadLogs = async () => {
      try {
        const response = await fetch('/api/debug/logs');
        if (response.ok) {
          const data = await response.json();
          if (data.logs) {
            logsRef.current = data.logs;
            setAllLogs([...logsRef.current]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };
    loadLogs();
  }, []);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/debug/logs');
        if (response.ok) {
          const data = await response.json();
          if (data.logs) {
            // Merge new logs with existing ones (keep all logs, don't replace)
            const existingTimestamps = new Set(logsRef.current.map(log => log.timestamp));
            const newLogs = data.logs.filter((log: LogEntry) => !existingTimestamps.has(log.timestamp));
            if (newLogs.length > 0) {
              logsRef.current = [...logsRef.current, ...newLogs];
              setAllLogs([...logsRef.current]);
            }
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
      logsRef.current = [];
      setAllLogs([]);
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  // Extract device identifiers from logs
  const getDeviceFromLog = (log: LogEntry): string => {
    // Try to extract user info from message
    if (log.message?.includes('[alwei1335]')) return 'alwei1335';
    if (log.message?.includes('[ajweingart]')) return 'ajweingart';
    if (log.message?.includes('alwei')) return 'alwei-device';
    if (log.message?.includes('ajweingart')) return 'ajweingart-device';
    if (log.message?.includes('iOS')) return 'ios-device';
    if (log.message?.includes('Android')) return 'android-device';

    return 'unknown';
  };

  // Group logs by device
  const logsByDevice = allLogs.reduce((acc, log) => {
    const device = getDeviceFromLog(log);
    if (!acc[device]) acc[device] = [];
    acc[device].push(log);
    return acc;
  }, {} as Record<string, LogEntry[]>);

  const devices = ['all', ...Object.keys(logsByDevice).filter(d => d !== 'unknown'), 'unknown'].filter(d => d !== 'all' || allLogs.length > 0);
  const displayLogs = activeTab === 'all' ? allLogs : (logsByDevice[activeTab] || []);

  const handleRefresh = async () => {
    window.location.reload();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow p-6">
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

          {/* Device Tabs */}
          <div className="mb-4">
            <div className="flex space-x-1 bg-gray-200 rounded p-1">
              {devices.map((device) => (
                <button
                  key={device}
                  onClick={() => setActiveTab(device)}
                  className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                    activeTab === device
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {device === 'all' ? 'All' : device}
                  <span className="ml-1 text-xs text-gray-500">
                    ({activeTab === device ? displayLogs.length : (device === 'all' ? allLogs.length : logsByDevice[device]?.length || 0)})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div>
            <h2 className="text-xl font-semibold mb-4 text-gray-700">
              {activeTab === 'all' ? 'All Logs' : `${activeTab} Logs`}
            </h2>
            <div className="bg-gray-50 border border-gray-300 rounded p-4" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {displayLogs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                displayLogs
                  .slice()
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((log, index) => (
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
    </PullToRefresh>
  );
}