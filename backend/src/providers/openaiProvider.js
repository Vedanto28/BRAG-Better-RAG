export async function generateResponse({ messages, systemPrompt, tools, maxTokens, signal, apiKey: overrideKey, baseUrl: overrideUrl, model: overrideModel }) {
  // TEST INJECTION POINT: Only reachable when TEST_OPENAI_FAIL_ALL env var is set.
  // Used by testResiliency.js and testOrchestratorFailures.js to simulate OpenAI quota errors.
  // If this fires outside a test context, it indicates an environment misconfiguration.
  if (process.env.TEST_OPENAI_FAIL_ALL === 'true') {
    console.warn('[WARN] TEST_OPENAI_FAIL_ALL is active — OpenAI provider is returning a mocked error. This must not fire in production.');
    const err = new Error("Mocked OpenAI API returned status 429: Rate limit exceeded");
    err.category = "Quota";
    err.status = 429;
    throw err;
  }

  const apiKey = overrideKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not set.');
    err.category = 'Authentication';
    throw err;
  }

  const targetUrl = (overrideUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
  const targetModel = overrideModel || process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

  const openaiTools = tools && tools.length > 0 ? tools.map(tool => ({
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
        model: targetModel,
        messages: formattedMessages,
        tools: openaiTools,
        max_tokens: maxTokens
      })
    };
    if (signal) fetchOptions.signal = signal;

    const res = await fetch(targetUrl, fetchOptions);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let category = 'Other Upstream Error';
      if (res.status === 401) category = 'Authentication';
      else if (res.status === 429) category = 'Quota';
      else if (res.status === 404) category = 'Model Availability';
      
      const err = new Error(`OpenAI API returned status ${res.status}: ${errorText || res.statusText}`);
      err.category = category;
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const responseMsg = choice?.message;

    if (responseMsg?.tool_calls && responseMsg.tool_calls.length > 0) {
      return {
        toolCalls: responseMsg.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          args: JSON.parse(tc.function.arguments)
        }))
      };
    }

    return { text: responseMsg?.content || '' };
  } catch (error) {
    if (error.category) {
      throw error;
    }
    let category = 'Other Upstream Error';
    if (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('timed out')) {
      category = 'Timeout';
    }
    const err = new Error(error.message || String(error));
    err.category = category;
    throw err;
  }
}
