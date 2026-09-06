/**
 * DeepSeek LLM Provider
 * 
 * Third-tier LLM provider in the fallback chain: Gemini → OpenAI → DeepSeek → Deterministic.
 * DeepSeek API is OpenAI-compatible, so this follows the same message formatting and tool
 * calling conventions as openaiProvider.js.
 * 
 * Reads from env: DEEPSEEK_API_KEY, DEEPSEEK_MODEL (defaults to "deepseek-chat").
 */

export async function generateResponse({ messages, systemPrompt, tools, maxTokens, signal, apiKey: overrideKey }) {
  // TEST INJECTION POINT: Only reachable when TEST_DEEPSEEK_FAIL_ALL env var is set.
  // Used by test suites to simulate DeepSeek failures. Must not fire in production.
  if (process.env.TEST_DEEPSEEK_FAIL_ALL === 'true') {
    console.warn('[WARN] TEST_DEEPSEEK_FAIL_ALL is active — DeepSeek provider is returning a mocked error. This must not fire in production.');
    const err = new Error("Mocked DeepSeek API returned status 429: Rate limit exceeded");
    err.category = "Quota";
    err.status = 429;
    throw err;
  }

  const apiKey = overrideKey || process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_MCP;
  if (!apiKey) {
    const err = new Error('DEEPSEEK_API_KEY or DEEPSEEK_MCP is not set.');
    err.category = 'Authentication';
    throw err;
  }

  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: msg.toolCallId,
          name: msg.name,
          content: msg.content
        };
      }
      if (msg.toolCalls) {
        return {
          role: 'assistant',
          content: msg.content || null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.args)
            }
          }))
        };
      }
      return {
        role: msg.role,
        content: msg.content
      };
    })
  ];

  const deepseekTools = tools && tools.length > 0 ? tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  })) : undefined;

  try {
    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        tools: deepseekTools,
        max_tokens: maxTokens
      })
    };

    // Wire AbortSignal if available
    if (signal) {
      fetchOptions.signal = signal;
    }

    console.log(`[DeepSeek Provider] Calling DeepSeek API with model: ${model}`);

    const res = await fetch('https://api.deepseek.com/chat/completions', fetchOptions);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let category = 'Other Upstream Error';
      if (res.status === 401) category = 'Authentication';
      else if (res.status === 429) category = 'Quota';
      else if (res.status === 404) category = 'Model Availability';
      else if (res.status === 402) category = 'Quota'; // Insufficient balance

      const err = new Error(`DeepSeek API returned status ${res.status}: ${errorText || res.statusText}`);
      err.category = category;
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const responseMsg = choice?.message;

    const usage = data.usage ? {
      prompt_tokens: data.usage.prompt_tokens || 0,
      completion_tokens: data.usage.completion_tokens || 0
    } : null;

    if (responseMsg?.tool_calls && responseMsg.tool_calls.length > 0) {
      return {
        toolCalls: responseMsg.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments)
        })),
        usage,
        text: responseMsg?.content || ''
      };
    }

    return { text: responseMsg?.content || '', usage };
  } catch (error) {
    if (error.category) {
      throw error;
    }
    let category = 'Other Upstream Error';
    const msg = error.message || String(error);
    if (error.name === 'AbortError' || msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
      category = 'Timeout';
    } else if (msg.includes('quota') || msg.includes('429') || msg.includes('rate limit') || msg.includes('insufficient')) {
      category = 'Quota';
    }
    const err = new Error(msg);
    err.category = category;
    throw err;
  }
}
