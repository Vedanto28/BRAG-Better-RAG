import { GoogleGenerativeAI } from '@google/generative-ai';

function convertType(type) {
  if (!type) return undefined;
  return type.toUpperCase();
}

function convertProperties(properties) {
  if (!properties) return {};
  const converted = {};
  for (const [key, val] of Object.entries(properties)) {
    converted[key] = {
      type: convertType(val.type),
      description: val.description,
    };
    if (val.type === 'object') {
      converted[key].properties = convertProperties(val.properties);
      converted[key].required = val.required;
    } else if (val.type === 'array') {
      converted[key].items = {
        type: convertType(val.items?.type),
        properties: convertProperties(val.items?.properties),
        required: val.items?.required
      };
    }
  }
  return converted;
}

export async function generateResponse({ messages, systemPrompt, tools, maxTokens }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not set.');
    err.category = 'Authentication';
    throw err;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const geminiTools = tools && tools.length > 0 ? [{
    functionDeclarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: {
        type: (tool.inputSchema.type || 'object').toUpperCase(),
        properties: convertProperties(tool.inputSchema.properties),
        required: tool.inputSchema.required || []
      }
    }))
  }] : undefined;

  const activeModel = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
    tools: geminiTools,
    generationConfig: maxTokens ? { maxOutputTokens: maxTokens } : undefined
  });

  const contents = messages.map(msg => {
    if (msg.role === 'tool') {
      return {
        role: 'function',
        parts: [{
          functionResponse: {
            name: msg.name,
            response: { result: msg.content },
            id: msg.toolCallId
          }
        }]
      };
    }
    if (msg.toolCalls) {
      return {
        role: 'model',
        parts: msg.toolCalls.map(tc => ({
          functionCall: {
            name: tc.name,
            args: tc.args,
            id: tc.id
          }
        }))
      };
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    };
  });

  try {
    const result = await activeModel.generateContent({
      contents,
      generationConfig: maxTokens ? { maxOutputTokens: maxTokens } : undefined
    });
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    
    const functionCalls = parts
      .filter(part => part.functionCall)
      .map(part => part.functionCall);

    if (functionCalls.length > 0) {
      return {
        toolCalls: functionCalls.map(fc => ({
          id: fc.id || fc.name,
          name: fc.name,
          args: fc.args
        }))
      };
    }

    const text = result.response.text();
    return { text };
  } catch (error) {
    let category = 'Other Upstream Error';
    const msg = error.message || String(error);
    if (msg.includes('API_KEY') || msg.includes('key') || msg.includes('API key') || msg.includes('Unauthorized')) {
      category = 'Authentication';
    } else if (msg.includes('quota') || msg.includes('limit') || msg.includes('ResourceExhausted')) {
      category = 'Quota';
    } else if (msg.includes('timeout') || msg.includes('timed out')) {
      category = 'Timeout';
    } else if (msg.includes('model') || msg.includes('not found')) {
      category = 'Model Availability';
    }
    const err = new Error(msg);
    err.category = category;
    throw err;
  }
}

export function buildDeterministicFallback(userQuery, contextText) {
  const query = userQuery.toLowerCase().trim();
  
  // If we have retrieved context, return it directly as the fallback answer
  if (contextText && contextText.trim().length > 0) {
    // Format the retrieved context nicely
    return contextText.trim();
  }

  // Answer common general knowledge questions deterministically:
  if (query.includes('president') && query.includes('usa')) {
    return 'The President of the United States is the head of state and head of government of the United States of America.';
  }
  if (query.includes('photosynthesis')) {
    return 'Photosynthesis is the process used by plants, algae and certain bacteria to harness energy from sunlight and turn it into chemical energy.';
  }
  if (query.includes('python')) {
    return 'Python was created by Guido van Rossum and first released in 1991.';
  }
  if (query.includes('javascript') || query.includes('js')) {
    return 'JavaScript is a programming language widely used to create interactive web applications and build dynamic web pages.';
  }
  if (query.includes('node') || query.includes('nodejs')) {
    return 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine, commonly used for server-side development.';
  }
  if (query.includes('express') || query.includes('expressjs')) {
    return 'Express.js is a minimal and flexible web framework for building Node.js APIs and servers.';
  }
  if (query.includes('hello') || query.includes('hi ') || query === 'hi') {
    return 'Hello! I am Mechamaru, the AI assistant for BRAG. How can I help you today?';
  }
  if (query.includes('rag')) {
    return 'RAG (Retrieval-Augmented Generation) retrieves relevant external facts to provide as context to a language model before generating an answer.';
  }
  if (query.includes('embeddings')) {
    return 'Embeddings turn text into numerical vectors so similar pieces of text can be compared mathematically.';
  }

  // Dynamic basic math calculation fallback
  if (query.includes('multiplied') || query.includes('times') || query.includes('*')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const result = parseInt(numbers[0], 10) * parseInt(numbers[1], 10);
      return `The result of ${numbers[0]} multiplied by ${numbers[1]} is ${result}.`;
    }
  }
  if (query.includes('divided') || query.includes('/') || query.includes('over')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const denom = parseInt(numbers[1], 10);
      if (denom !== 0) {
        return `The result of ${numbers[0]} divided by ${numbers[1]} is ${(parseInt(numbers[0], 10) / denom).toFixed(2)}.`;
      }
    }
  }
  if (query.includes('plus') || query.includes('add') || query.includes('+')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const result = parseInt(numbers[0], 10) + parseInt(numbers[1], 10);
      return `The result of ${numbers[0]} plus ${numbers[1]} is ${result}.`;
    }
  }
  if (query.includes('minus') || query.includes('subtract') || query.includes('-')) {
    const numbers = query.match(/\b\d+\b/g);
    if (numbers && numbers.length >= 2) {
      const result = parseInt(numbers[0], 10) - parseInt(numbers[1], 10);
      return `The result of ${numbers[0]} minus ${numbers[1]} is ${result}.`;
    }
  }

  return 'I am ready to help, but I could not generate a model-based answer for that question right now.';
}
