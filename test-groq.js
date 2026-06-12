const apiKey = 'YOUR_API_KEY_HERE';

fetch('https://api.groq.com/openai/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'llama3-8b-8192',
    messages: [{ role: 'user', content: 'hello' }]
  })
}).then(res => res.json()).then(console.log).catch(console.error);
