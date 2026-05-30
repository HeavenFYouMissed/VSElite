---
name: azure-ai
description: Azure OpenAI, AI Search, embeddings, and RAG patterns
keywords:
  - azure openai
  - GPT
  - embedding
  - vector search
  - AI search
  - RAG
  - retrieval
  - cognitive
  - AI foundry
alwaysApply: false
---

# Azure AI Skill

## Azure OpenAI

### Chat Completion
```typescript
import { AzureOpenAI } from 'openai';

const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: '2024-06-01',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o', // deployment name
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userMessage },
  ],
  temperature: 0.7,
  max_tokens: 2000,
});
```

### Embeddings
```typescript
const embeddingResponse = await client.embeddings.create({
  model: 'text-embedding-3-large', // deployment name
  input: ['Document text to embed'],
});

const vector = embeddingResponse.data[0].embedding; // number[]
```

## Azure AI Search (RAG)

### Index Schema
```json
{
  "name": "documents",
  "fields": [
    { "name": "id", "type": "Edm.String", "key": true },
    { "name": "content", "type": "Edm.String", "searchable": true },
    { "name": "title", "type": "Edm.String", "searchable": true },
    { "name": "embedding", "type": "Collection(Edm.Single)", "dimensions": 3072, "vectorSearchProfile": "default" }
  ],
  "vectorSearch": {
    "algorithms": [{ "name": "hnsw", "kind": "hnsw" }],
    "profiles": [{ "name": "default", "algorithm": "hnsw" }]
  }
}
```

### Hybrid Search (Vector + Text)
```typescript
import { SearchClient, AzureKeyCredential } from '@azure/search-documents';

const searchClient = new SearchClient(
  process.env.SEARCH_ENDPOINT,
  'documents',
  new AzureKeyCredential(process.env.SEARCH_KEY)
);

const results = await searchClient.search(query, {
  vectorSearchOptions: {
    queries: [{
      kind: 'vector',
      vector: queryEmbedding,
      fields: ['embedding'],
      kNearestNeighborsCount: 5,
    }],
  },
  top: 10,
  select: ['id', 'title', 'content'],
});
```

## RAG Pattern

1. **Index** — chunk documents, embed, store in AI Search
2. **Retrieve** — embed user query, search for relevant chunks
3. **Augment** — inject retrieved chunks into LLM prompt
4. **Generate** — LLM generates answer grounded in retrieved context

```typescript
async function ragAnswer(question: string): Promise<string> {
  // 1. Embed question
  const qEmbedding = await embed(question);
  
  // 2. Search for relevant context
  const docs = await searchClient.search(question, {
    vectorSearchOptions: { queries: [{ vector: qEmbedding, ... }] },
    top: 5,
  });
  
  // 3. Build prompt with context
  const context = docs.results.map(r => r.document.content).join('\n\n');
  
  // 4. Generate answer
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `Answer based on this context:\n${context}` },
      { role: 'user', content: question },
    ],
  });
  
  return response.choices[0].message.content;
}
```

## Best Practices

- Use managed identity (not API keys) in production
- Set content filters appropriate to your use case
- Monitor token usage and costs via Azure Portal
- Use streaming for real-time responses
- Cache embeddings for repeated content
- Chunk documents at semantic boundaries (paragraphs, sections)
