/**
 * Anthropic LLM Provider
 *
 * Implements Anthropic Messages API (https://api.anthropic.com/v1/messages) adapter.
 * Supports Claude 3.5 Sonnet / Haiku with tool use and streaming/buffered responses.
 */

export async function generateResponse({
  messages,
  systemPrompt,
  tools,
  maxTokens = 4096,
  signal,
  apiKey: overrideKey,
  model: overrideModel
}) {
  // TEST INJECTION POINT: Only reachable when TEST_ANTHROPIC_FAIL_ALL env var is set.
  if (process.env.TEST_ANTHROPIC_FAIL_ALL === 'true') {
    console.warn('[WARN] TEST_ANTHROPIC_FAIL_ALL is active — Anthropic provider is returning a mocked error.');
    const err = new Error("Mocked Anthropic API returned status 429: Rate limit exceeded");
    err.category = "Quota";
    err.status = 429;
    throw err;
  }

  const apiKey = overrideKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY is not set.');
    err.category = 'Authentication';
    throw err;
  }

  const targetModel = overrideModel || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
  const targetUrl = 'https://api.anthropic.com/v1/messages';

  // Format messages for Anthropic Messages API
  const anthropicMessages = [];

  for (const msg of messages) {
    if (msg.role === 'tool') {
      anthropicMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
          }
        ]
      });
    } else if (msg.toolCalls && msg.toolCalls.length > 0) {
      const contentParts = [];
      if (msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0) {
        contentParts.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        contentParts.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.args || {}
        });
      }
      anthropicMessages.push({
        role: 'assistant',
        content: contentParts
      });
    } else if (msg.role === 'user' || msg.role === 'assistant') {
      anthropicMessages.push({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      });
    }
  }

  // Merge consecutive messages with the same role (Anthropic requires strict role alternation)
  const mergedMessages = [];
  for (const msg of anthropicMessages) {
    const prev = mergedMessages[mergedMessages.length - 1];
    if (prev && prev.role === msg.role) {
      const prevContent = Array.isArray(prev.content)
        ? prev.content
        : [{ type: 'text', text: prev.content }];
      const nextContent = Array.isArray(msg.content)
        ? msg.content
        : [{ type: 'text', text: msg.content }];
      prev.content = [...prevContent, ...nextContent];
    } else {
      mergedMessages.push(msg);
    }
  }

  const anthropicTools = tools && tools.length > 0 ? tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema || { type: 'object', properties: {} }
  })) : undefined;

  try {
    const bodyPayload = {
      model: targetModel,
      max_tokens: maxTokens || 4096,
      messages: mergedMessages
    };

    if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
      bodyPayload.system = systemPrompt;
    }

    if (anthropicTools && anthropicTools.length > 0) {
      bodyPayload.tools = anthropicTools;
    }

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(bodyPayload)
    };

    if (signal) {
      fetchOptions.signal = signal;
    }

    console.log(`[Anthropic Provider] Calling Anthropic Messages API with model: ${targetModel}`);

    const res = await fetch(targetUrl, fetchOptions);

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let category = 'Other Upstream Error';
      if (res.status === 401) category = 'Authentication';
      else if (res.status === 429) category = 'Quota';
      else if (res.status === 404) category = 'Model Availability';
      else if (res.status === 400 && errorText.includes('credit')) category = 'Quota';

      const err = new Error(`Anthropic API returned status ${res.status}: ${errorText || res.statusText}`);
      err.category = category;
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const contentList = Array.isArray(data.content) ? data.content : [];

    const toolUseItems = contentList.filter(item => item.type === 'tool_use');
    const textItems = contentList.filter(item => item.type === 'text');
    const textContent = textItems.map(t => t.text).join('\n');

    const usage = {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0
    };

    if (toolUseItems.length > 0) {
      return {
        toolCalls: toolUseItems.map(tc => ({
          id: tc.id,
          name: tc.name,
          args: tc.input || {}
        })),
        usage,
        text: textContent
      };
    }

    return {
      text: textContent || '',
      usage
    };
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
