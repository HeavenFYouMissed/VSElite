---
name: ai-llm-integration
description: LLM API integration, prompt engineering, and AI tool patterns
keywords:
  - AI
  - LLM
  - GPT
  - Claude
  - OpenAI
  - Anthropic
  - prompt
  - completion
  - embedding
  - token
  - context window
  - streaming
alwaysApply: false
---

# AI/LLM Integration Skill

## API Patterns

### OpenAI-Compatible API
```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  }),
});
```

### Streaming Response
```typescript
const response = await fetch(url, {
  method: 'POST',
  headers: { ... },
  body: JSON.stringify({ ...params, stream: true }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
  
  for (const line of lines) {
    if (line === 'data: [DONE]') break;
    const json = JSON.parse(line.slice(6));
    const token = json.choices[0]?.delta?.content;
    if (token) process.stdout.write(token);
  }
}
```

## Prompt Engineering

### System Message Structure
1. Role definition (who the AI is)
2. Constraints (what it must/must not do)
3. Output format (how to structure responses)
4. Context (relevant information)

### Best Practices
- Be specific and explicit (don't assume the model "knows what you mean")
- Provide examples (few-shot prompting)
- Separate instructions from data (use delimiters like XML tags)
- Chain complex tasks (break into steps)
- Set output format explicitly (JSON, markdown, etc.)

## Token Management

- 1 token ≈ 4 characters (English)
- Always calculate: `prompt_tokens + max_tokens < context_window`
- Leave headroom (don't fill to the brim)
- Truncate oldest messages first when near limit
- Use tiktoken or similar for precise counting

## Error Handling

```typescript
async function callWithRetry(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429) {
        // Rate limited — exponential backoff
        await sleep(1000 * Math.pow(2, i));
        continue;
      }
      if (error.status === 500 || error.status === 503) {
        // Server error — retry
        await sleep(2000);
        continue;
      }
      throw error; // Don't retry client errors (400, 401, etc.)
    }
  }
}
```

## Embedding & RAG

- Use embeddings for semantic search (not keyword matching)
- Chunk documents at natural boundaries (paragraphs, functions)
- Store chunks with metadata (source file, line numbers)
- Retrieve top-K chunks, include as context in prompt
- Always cite sources in the response
