#!/usr/bin/env node

const { execSync } = require('child_process');
const OpenAI = require('openai');

// Get OpenAI API key from environment
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Error: OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: apiKey,
});

async function generateCommitMessage() {
  try {
    // Get git diff for staged changes, excluding auto-generated files
    let diff;
    try {
      // Exclude service worker and other auto-generated files from AI analysis
      diff = execSync('git diff --staged --no-color -- . ":(exclude)public/sw.js" ":(exclude)*.map" ":(exclude).next/*"', { encoding: 'utf8' });
    } catch {
      console.error('Error: Unable to get git diff. Make sure you have staged changes.');
      process.exit(1);
    }

    if (!diff.trim()) {
      // If no meaningful changes after excluding auto-generated files, 
      // check if we only have service worker changes
      const swDiff = execSync('git diff --staged --no-color public/sw.js', { encoding: 'utf8' });
      if (swDiff.trim()) {
        // Only service worker changes - use a standard message
        console.log('Update service worker to include new app build assets');
        return;
      } else {
        console.error('Error: No staged changes found. Please stage your changes first.');
        process.exit(1);
      }
    }

    // Limit diff size to avoid token limits (keep first 4000 characters)
    const truncatedDiff = diff.length > 4000 ? diff.substring(0, 4000) + '\n\n[... diff truncated ...]' : diff;

    const prompt = `Based on the following git diff, generate a concise and descriptive commit message. The message should:
- Be under 72 characters for the first line
- Start with a verb in imperative mood (e.g., "Add", "Fix", "Update", "Remove")
- Clearly describe what was changed
- Be specific but concise

Git diff:
${truncatedDiff}

Generate only the commit message, no additional text:`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    const commitMessage = completion.choices[0]?.message?.content?.trim();
    
    if (!commitMessage) {
      console.error('Error: Failed to generate commit message');
      process.exit(1);
    }

    // Clean up the message (remove quotes if present)
    const cleanMessage = commitMessage.replace(/^["']|["']$/g, '');
    
    // Output ONLY the commit message to stdout
    console.log(cleanMessage);
    
  } catch (error) {
    console.error('Error generating commit message:', error.message);
    process.exit(1);
  }
}

generateCommitMessage(); 