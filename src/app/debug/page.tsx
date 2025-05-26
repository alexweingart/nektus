'use client';

import React, { useState, useEffect } from 'react';

export default function AIDebugPage() {
  const [email, setEmail] = useState('ajweingart@gmail.com');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  
  // Use useEffect to ensure we're only running on client-side
  useEffect(() => {
    setIsClient(true);
    console.log('Debug page mounted');
  }, []);

  const runDiagnostics = async () => {
    console.log('Running diagnostics...');
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const emailToTest = email;
      
      if (!emailToTest) {
        setError('Please enter an email address');
        setLoading(false);
        return;
      }
      
      console.log('Sending request for:', emailToTest);
      
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailToTest }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Diagnostic test failed');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const forceRegeneration = () => {
    console.log('Forcing regeneration...');
    if (!email) {
      setError('Please enter an email address first');
      return;
    }
    
    try {
      // Note: AI content is now generated automatically when needed
      // No need to manually trigger or force regeneration
      alert('AI content is now generated automatically when viewing your profile if any fields are missing.');
    } catch (err) {
      console.error('Error in force regeneration:', err);
      setError('Error clearing cache. See console for details.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">AI Content Generation Diagnostics</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">AI Generation Status</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-700 mb-4">
            AI content is now generated automatically when viewing your profile if any fields are missing.
            No manual intervention is needed.
          </p>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  AI content will be generated for any missing bio, background image, or profile picture
                  when you view your profile.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-4">
          <button
            onClick={runDiagnostics}
            disabled={loading}
            className={`px-4 py-2 rounded text-white font-medium ${
              loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Running...' : 'Run Diagnostics'}
          </button>
          <button
            onClick={forceRegeneration}
            disabled={!isClient || !email}
            className={`px-4 py-2 rounded text-white font-medium ${
              !isClient || !email ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            Force AI Regeneration
          </button>
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded">
            {error}
          </div>
        )}
      </div>
      
      {results && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Diagnostic Results</h2>
          
          <div className="mb-4">
            <h3 className="font-medium">Basic Information</h3>
            <div className="ml-4 mt-2">
              <p><span className="font-medium">Email:</span> {results.email}</p>
              <p>
                <span className="font-medium">OpenAI Setup:</span> 
                <span className={results.openaiSetup ? "text-green-600" : "text-red-600"}>
                  {results.openaiSetup ? "✅ Working" : "❌ Not Working"}
                </span>
              </p>
              <p>
                <span className="font-medium">Timestamp:</span> {results.timestamp}
              </p>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium">Firestore Data</h3>
            <div className="ml-4 mt-2">
              {results.firestore.checked ? (
                <>
                  <p>
                    <span className="font-medium">AI Content in Database:</span> 
                    <span className={results.firestore.exists ? "text-green-600" : "text-yellow-600"}>
                      {results.firestore.exists ? "✅ Found" : "⚠️ Not Found"}
                    </span>
                  </p>
                  
                  {results.firestore.exists && results.firestore.data && (
                    <div className="mt-2 p-3 bg-gray-50 rounded overflow-auto max-h-60">
                      <p className="font-medium mb-1">Stored Content:</p>
                      <pre className="text-xs whitespace-pre-wrap">
                        {JSON.stringify(results.firestore.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-red-600">Failed to check Firestore</p>
              )}
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium">API Tests</h3>
            
            <div className="ml-4 mt-2">
              <h4 className="font-medium">Text Generation (Bio)</h4>
              <div className="ml-4 mt-1">
                {results.tests.completions.attempted ? (
                  results.tests.completions.success ? (
                    <>
                      <p className="text-green-600">✅ Success</p>
                      <p className="mt-1"><span className="font-medium">Generated Bio:</span> {results.tests.completions.response}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-red-600">❌ Failed</p>
                      {results.tests.completions.error && (
                        <div className="mt-1 p-2 bg-red-50 rounded text-xs overflow-auto max-h-32">
                          <pre>{JSON.stringify(results.tests.completions.error, null, 2)}</pre>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <p className="text-gray-500">Not attempted</p>
                )}
              </div>
            </div>
            
            <div className="ml-4 mt-4">
              <h4 className="font-medium">Image Generation (Background)</h4>
              <div className="ml-4 mt-1">
                {results.tests.images.attempted ? (
                  results.tests.images.success ? (
                    <>
                      <p className="text-green-600">✅ Success with {results.tests.images.response.model}</p>
                      {results.tests.images.response.url && (
                        <div className="mt-2">
                          <p className="mb-1 font-medium">Generated Image:</p>
                          <img 
                            src={results.tests.images.response.url} 
                            alt="Generated test image" 
                            className="w-full max-w-sm h-auto rounded border"
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-red-600">❌ Failed</p>
                      {results.tests.images.error && (
                        <div className="mt-1 p-2 bg-red-50 rounded text-xs overflow-auto max-h-32">
                          <pre>{JSON.stringify(results.tests.images.error, null, 2)}</pre>
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <p className="text-gray-500">Not attempted</p>
                )}
              </div>
            </div>
          </div>
          
          {results.suggestions && results.suggestions.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-medium text-blue-800 mb-2">Suggestions to Fix:</h3>
              <ul className="list-disc pl-5 space-y-1">
                {results.suggestions.map((suggestion: string, idx: number) => (
                  <li key={idx} className="text-blue-800">{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
