import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Diagnose AI content generation issues
export async function POST(request: NextRequest) {
  try {
    // Skip authentication check for debugging purposes
    console.log('Starting AI diagnosis...');

    // Parse request body
    const body = await request.json();
    const email = body.email;
    
    console.log('Diagnostic request for email:', email);
    
    if (!email) {
      return NextResponse.json(
        { error: 'No email provided' },
        { status: 400 }
      );
    }
    
    const userEmail = email;

    // Diagnosis results
    const results: any = {
      timestamp: new Date().toISOString(),
      email: userEmail,
      openaiSetup: !!openai,
      firestore: {
        checked: false,
        exists: false,
        data: null
      },
      tests: {
        completions: {
          attempted: false,
          success: false,
          response: null,
          error: null
        },
        images: {
          attempted: false,
          success: false,
          response: null,
          error: null
        }
      }
    };

    // Check for existing AI content in Firestore
    try {
      const aiContentRef = doc(db, 'ai_content', userEmail);
      const aiContentSnap = await getDoc(aiContentRef);
      
      results.firestore.checked = true;
      results.firestore.exists = aiContentSnap.exists();
      
      if (aiContentSnap.exists()) {
        results.firestore.data = aiContentSnap.data();
      }
    } catch (error) {
      results.firestore.error = error instanceof Error ? error.message : String(error);
    }

    // Test OpenAI text completions API
    if (openai) {
      try {
        results.tests.completions.attempted = true;
        
        const response = await openai.chat.completions.create({
          model: 'gpt-4o', // Trying the model specified in the updated code
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that generates short, engaging personal bios.'
            },
            {
              role: 'user',
              content: 'Generate a creative, engaging bio for a test user. Keep it under 10 words.'
            }
          ],
          max_tokens: 50,
          temperature: 0.7,
        });
        
        results.tests.completions.success = true;
        results.tests.completions.response = response.choices[0]?.message?.content;
      } catch (error) {
        results.tests.completions.error = error instanceof Error 
          ? { message: error.message, name: error.name } 
          : String(error);
      }

      // Test OpenAI image generation API
      try {
        results.tests.images.attempted = true;
        
        // Try with dall-e-3 first (fallback that should work)
        const imageResponse = await openai.images.generate({
          model: 'dall-e-3', // Use the more widely available DALL-E 3 model
          prompt: 'Create a simple, abstract gradient background in blue and green tones.',
          n: 1,
          size: '1024x1024',
          quality: 'standard',
        });
        
        results.tests.images.success = true;
        results.tests.images.response = {
          url: imageResponse.data[0]?.url,
          model: 'dall-e-3'
        };
      } catch (dalleError) {
        // If dall-e-3 fails, try with gpt-image-1
        try {
          const gptImageResponse = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: 'Create a simple, abstract gradient background in blue and green tones.',
            n: 1,
            size: '1024x1024',
            quality: 'standard',
          });
          
          results.tests.images.success = true;
          results.tests.images.response = {
            url: gptImageResponse.data[0]?.url,
            model: 'gpt-image-1'
          };
        } catch (gptImageError) {
          // Both models failed
          results.tests.images.error = {
            dalle: dalleError instanceof Error 
              ? { message: dalleError.message, name: dalleError.name } 
              : String(dalleError),
            gptImage: gptImageError instanceof Error 
              ? { message: gptImageError.message, name: gptImageError.name } 
              : String(gptImageError)
          };
        }
      }
    }

    // Fix suggestions based on results
    const suggestions = [];
    
    if (!results.openaiSetup) {
      suggestions.push('OpenAI API key is missing or invalid. Check your .env.local file.');
    }
    
    if (!results.tests.completions.success) {
      suggestions.push('Text generation API failed. Check the error message and your OpenAI account quota/billing.');
    }
    
    if (!results.tests.images.success) {
      suggestions.push('Image generation API failed. Check if gpt-image-1 or dall-e-3 is available in your OpenAI account.');
      suggestions.push('Try updating the model reference in the generate function to use dall-e-3 instead of gpt-image-1.');
    }
    
    if (results.firestore.exists) {
      suggestions.push('AI content already exists in the database but might not be displaying correctly. Check client-side loading logic.');
    } else {
      suggestions.push('No AI content found in database. Force regeneration by clearing localStorage flags.');
    }
    
    results.suggestions = suggestions;

    // Return full diagnostic results
    return NextResponse.json(results);
  } catch (error) {
    console.error('Diagnosis error:', error);
    return NextResponse.json(
      { error: 'Diagnosis failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
