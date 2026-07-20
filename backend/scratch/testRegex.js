const text = `I found a GitHub PR containing this token: token="super_secret_github_token_12345".\nAPI_KEY: 'live_browser_key_9876543210'.`;
const globalSecretRegex = /\b([a-zA-Z0-9_\-]*?(?:key|secret|password|token)[a-zA-Z0-9_\-]*?\s*[:=]\s*)(["']?)([^\r\n"'\s]{10,})\2/gi;
console.log(text.replace(globalSecretRegex, (match, keyAndEq, quote, secretValue) => {
  console.log({match, keyAndEq, quote, secretValue});
  return keyAndEq + quote + '[REDACTED]' + quote;
}));
