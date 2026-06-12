import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Read Groq API Key from environment variable
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key is null. Please configure GROQ_API_KEY in .env.local.' }, { status: 401 });
    }

    const text = await req.text();
    const body = JSON.parse(text);

    // Map system prompt and messages to Groq/OpenAI compatible format
    const groqMessages = [];
    if (body.system) {
      groqMessages.push({ role: 'system', content: body.system });
    }
    
    // Add all user/assistant messages
    if (body.messages && Array.isArray(body.messages)) {
      groqMessages.push(...body.messages);
    }

    // Proxy request to Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant', // Updated from decommissioned llama3-8b-8192
        messages: groqMessages,
        stream: false, // Disabling stream for simpler handling
      })
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json().catch(() => ({}));
      console.error('Groq API Error details:', errorData);
      
      let errorMessage = 'Groq API Error';
      if (errorData?.error?.code === 'rate_limit_exceeded') {
        errorMessage = 'Rate Limit Reached (6000 Tokens Per Minute). Please wait 20-30 seconds before asking your next question, or upgrade your Groq API key tier.';
      } else if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
      }

      return NextResponse.json({ error: errorMessage, details: errorData }, { status: groqResponse.status });
    }

    const data = await groqResponse.json();
    
    // Adapt Groq's OpenAI-style response to match the Anthropic format the frontend expects
    const adaptedResponse = {
      content: [
        { text: data.choices[0].message.content }
      ]
    };

    return NextResponse.json(adaptedResponse);
    
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
