export function buildPrompt(context, userQuery) {
  const contextText = Array.isArray(context) && context.length > 0
    ? context.map((entry) => `${entry.topic}: ${entry.content}`).join('\n')
    : 'No relevant context found.';

  return `You are a helpful AI assistant.\n\nUse the provided context whenever relevant.\n\nContext: ${contextText}\n\nUser Question: ${userQuery}\n\nAnswer:`;
}
