export async function generateResponse({ messages, systemPrompt, tools, maxTokens }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not set.');
    err.category = 'Authentication';
    throw err;
  }

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
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: formattedMessages,
        tools: openaiTools,
        max_tokens: maxTokens
      })
    });

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
