import { createWebSearchResponse, createCompletion, getModelForTask } from '@/lib/ai/openai-client';

export interface EventSearchResult {
  activityType: string;
  title: string;
  description: string;
  address: string;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  url?: string;
  venue?: string;
}

export async function searchLocalEvents(
  location: string,
  timeframe: string
): Promise<EventSearchResult[]> {
  console.log(`🔍 Searching for events in ${location} for ${timeframe}`);

  try {
    // Calculate specific dates for the timeframe
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (timeframe) {
      case 'today':
        startDate = new Date(now);
        endDate = new Date(now);
        break;
      case 'tomorrow':
        startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'this weekend':
        // Find next Saturday
        const daysUntilSaturday = (6 - now.getDay() + 7) % 7;
        startDate = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
        endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // Sunday
        break;
      case 'next week':
        startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        break;
    }

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const searchInput = `Find real events in ${location} between ${formatDate(startDate)} and ${formatDate(endDate)}.

REQUIRED: Use web search to find actual upcoming events. Include:
- Local festivals and special events
- Museum exhibitions and gallery openings
- Concerts and performances
- Food/wine events and farmers markets
- Outdoor activities and tours
- Community events

Return only factual information about real events with: title, description, venue address, exact date (YYYY-MM-DD), start time, and activity type.`;

    console.log('🔍 About to call createWebSearchResponse...');
    const response = await createWebSearchResponse({
      input: searchInput,
      location: {
        type: 'approximate',
        country: 'US', // TODO: Make dynamic
        city: location
      }
    });
    console.log('🔍 createWebSearchResponse completed');

    // Parse the response from Responses API
    const responseText = response.output_text || '';

    console.log('🔍 Web search response:', {
      hasContent: !!responseText,
      contentLength: responseText.length,
      fullResponse: responseText // LOG FULL RESPONSE
    });

    if (!responseText) {
      console.log('⚠️ No content in web search response');
      return [];
    }

    // Since we're getting natural text, we need to extract structured data
    // Use a follow-up completion to parse the web search results into our format
    const parseCompletion = await createCompletion({
      model: getModelForTask('navigation'),
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that extracts event information from web search results. Parse the provided text and return only valid JSON with an "events" array.'
        },
        {
          role: 'user',
          content: `Parse this web search result and extract events into JSON format:

${responseText}

Return as JSON object with "events" array:
{
  "events": [{
    "activityType": "string",
    "title": "string",
    "description": "string",
    "address": "string",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "url": "string",
    "venue": "string"
  }]
}

Only return valid JSON. If no events found, return {"events": []}.`
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    try {
      const parsed = JSON.parse(parseCompletion.choices[0].message.content || '{"events": []}');
      const events = parsed.events || [];

      // Validate the extracted events
      const validEvents = events.filter((event: any) =>
        event.title &&
        event.description &&
        event.activityType &&
        event.date
      );

      console.log(`✅ Found ${validEvents.length} structured events for ${location}`);
      return validEvents;

    } catch (_parseError) {
      console.error('Error parsing event JSON:', _parseError);
      console.log('Raw parse response:', parseCompletion.choices[0].message.content);
      return [];
    }
  } catch (_error) {
    console.error('❌ Error searching for events:', _error);
    console.error('❌ Error details:', {
      message: _error instanceof Error ? _error.message : String(_error),
      stack: _error instanceof Error ? _error.stack : undefined
    });
    return [];
  }
}