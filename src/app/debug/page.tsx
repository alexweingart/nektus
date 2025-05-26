'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function AIDebugPage() {
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const emailToTest = email || (session?.user?.email as string);
      
      if (!emailToTest) {
        setError('Please enter an email address or sign in');
        setLoading(false);
        return;
      }
      
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
    if (!session?.user?.email) {
      setError('You must be signed in to force regeneration');
      return;
    }
    
    // Clear the localStorage flag to allow regeneration
    const aiContentStatusKey = `nektus_ai_content_status_${session.user.email}`;
    localStorage.removeItem(aiContentStatusKey);
    
    // Set session storage flag to trigger regeneration
    sessionStorage.setItem('nektus_profile_setup_completed', 'true');
    
    alert('AI content regeneration has been forced. Please refresh the home page to trigger generation.');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">AI Content Generation Diagnostics</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">Test AI Generation</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email to Test</label>
          <input
            type="email"
            className="border rounded p-2 w-full"
            placeholder={session?.user?.email || "Enter email"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-sm text-gray-500 mt-1">
            {session?.user?.email ? 
              "Leave blank to use your signed-in email" : 
              "Please enter an email address to test"}
          </p>
        </div>
        
        <div className="flex space-x-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={runDiagnostics}
            disabled={loading}
          >
            {loading ? 'Running Tests...' : 'Run Diagnostics'}
          </button>
          
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={forceRegeneration}
            disabled={!session?.user?.email}
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
