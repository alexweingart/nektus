'use client';

import { useState, useEffect } from 'react';
import { OpenAI } from 'openai';

// This component will force AI content generation directly in the client
// bypassing Firestore entirely to debug content generation issues
export default function ForceContentGenerator({ email, onGenerated }: { 
  email: string, 
  onGenerated: (data: { bio: string, backgroundImage: string }) => void 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generateContent = async () => {
    setIsGenerating(true);
    setStatus('Starting generation...');
    setError(null);

    try {
      // Make API call to generate bio
      setStatus('Generating bio...');
      const bioResponse = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bio',
          profile: { 
            name: 'Alexander Weingart', 
            email: email,
            userId: email
          }
        }),
      });

      if (!bioResponse.ok) {
        throw new Error(`Bio generation failed: ${bioResponse.status}`);
      }
      
      const bioData = await bioResponse.json();
      const generatedBio = bioData.bio || 'Curious explorer, coffee aficionado, and aspiring storyteller.';
      
      // Make API call to generate background
      setStatus('Generating background image...');
      const bgResponse = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'background',
          profile: { 
            name: 'Alexander Weingart', 
            email: email,
            userId: email
          }
        }),
      });

      if (!bgResponse.ok) {
        throw new Error(`Background generation failed: ${bgResponse.status}`);
      }
      
      const bgData = await bgResponse.json();
      const generatedBg = bgData.imageUrl || '/gradient-bg.jpg';
      
      // Return the generated content
      onGenerated({
        bio: generatedBio,
        backgroundImage: generatedBg
      });
      
      // Save to local storage for persistence across page loads
      localStorage.setItem('nektus_generated_content', JSON.stringify({
        bio: generatedBio,
        backgroundImage: generatedBg,
        timestamp: new Date().toISOString()
      }));
      
      setStatus('Generation completed successfully!');
    } catch (err) {
      console.error('Content generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-white p-4 rounded-lg shadow-lg z-50 max-w-xs">
      <h3 className="text-sm font-bold mb-2">AI Content Debug</h3>
      
      {error && (
        <div className="mb-2 text-xs text-red-600">
          Error: {error}
        </div>
      )}
      
      {status && !error && (
        <div className="mb-2 text-xs text-green-600">
          Status: {status}
        </div>
      )}
      
      <button
        onClick={generateContent}
        disabled={isGenerating}
        className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 disabled:opacity-50"
      >
        {isGenerating ? 'Generating...' : 'Force Direct Generation'}
      </button>
    </div>
  );
}
