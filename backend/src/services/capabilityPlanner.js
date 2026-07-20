import { isLogStructured } from '../utils/logParser.js';

const generalExclusions = [
  /^what is (javascript|js|express|expressjs|node|nodejs|rest|rag|embeddings|jwt|git|html|css|cors)(\?)?$/,
  /^explain (jwt|rest|javascript|js|express|expressjs|node|nodejs|rag|embeddings|git|html|css|cors)$/,
  /^who developed (node|nodejs|javascript|python)(\?)?$/,
  /^(hi|hello|hey|good morning|good afternoon|good evening|who are you)(\?)?$/
];

const docIntentPatterns = [
  /\b(official doc(s|umentation)?|according to doc(s|umentation)?|latest doc(s|umentation)?|api reference|library doc(s|umentation)?|framework doc(s|umentation)?|use.*(doc(s|umentation)?))\b/,
  /\b(how does|explain|how to use)\b.*\b(next\.?js|react|express|mongoose|prisma|passport|sequelize|typeorm|knex|fastify|hapi|koa|nestjs|nest\.?js|angular|vue|svelte|nuxt|remix|gatsby|webpack|vite|vitest|jest|mocha|chai|sinon|supertest|redis|graphql|apollo|socket\.?io|tailwind|bootstrap|material.?ui|chakra|styled.?components|emotion|zod|yup|joi|ajv|drizzle|pino|winston|morgan|bcrypt|argon2|helmet|rate.?limit|multer|formidable|sharp|puppeteer|playwright|cheerio|axios|got|node.?fetch|dotenv|cors|cookie.?parser|body.?parser|compression|cluster|pm2|swagger|openapi|stripe|twilio|sendgrid|firebase|supabase|vercel)\b/,
  /\b(how does|explain|how to use)\b.*\b(middleware|routing|router|loaders|suspense|hooks|transactions|migrations|authentication|authorization|session|caching|rate limiting|websocket|streaming|ssr|ssg|isr|static generation|server components|client components|app router|pages router|api routes|edge functions|serverless)\b/
];

const docKeywords = [
  "next.js", "nextjs", "react", "express", "mongoose", "mongodb", "postgres", "pg", 
  "supabase", "jwt", "dotenv", "cors", "npm", "node", "api", "version", "docs", 
  "documentation", "latest", "current", "how does", "example", "examples", "pattern",
  "guide", "tutorial", "reference", "manual", "standards"
];

const repoIndicators = [
  /\b(this|the|my|current)\b.*\b(repo|repository|codebase|backend|project|app|server|workspace|directory|files|src|folders)\b/,
  /\b(login|chat|auth|api|db|database|route|endpoint|controller|service|middleware|config|configuration|provider|handler|orchestrator|server\.js|package\.json|env|port|express|console|network|cors|page|browser|localhost|url)\b/,
  /\b(where|how|why|what)\b.*\b(defined|configured|implemented|stored|written|saved|set|called|used|structured|organized|enforced|travel|flow|reach|path|journey)\b/
];

const repoKeywords = [
  'app.listen', 'max_user_message_chars', 'max_context_chars', 'agentorchestrator',
  'mcpclient', 'mcpserver', 'providerinterface', 'geminiprovider', 'openaiprovider',
  'localrepoprovider', 'repoprovider', 'login route', 'jwt secret', 'database connection',
  'console error', 'network request', 'network failure', 'page load', 'cors failure',
  'codebase', 'repo', 'repository', 'project files', 'source code', 'local files'
];

const fileRegex = /\b\w+\.(js|ts|json|jsx|tsx|html|css|env|md)\b/i;
const folderKeywords = ["src/", "backend/", "frontend/", "components/", "routes/", "services/", "controllers/"];

const changePatterns = [
  /\b(changed|change|commit|commits|git history|recent edits|last commit|recently)\b/,
  /\bwhy did .* start failing after.*\b/
];

const gitKeywords = [
  "git", "github", "commit", "commits", "history", "pr", "prs", "pull request", "pull requests",
  "issue", "issues", "branch", "branches", "repo origin", "remote remote", "origin url", "git remote",
  "yesterday", "recently", "latest commit", "last commit", "after upgrading", "after the last",
  "since the last", "modified"
];

const runtimeKeywords = [
  "console", "network", "browser", "page", "localhost", "devtools", "blank page", "cors",
  "screenshot", "request", "status code", "ui", "went blank", "rendering", "button", "click",
  "navigate", "active pages", "port 5000", "port 5050", "port 3000", "http://", "https://",
  "connection refused", "econnrefused", "fetch failed", "page load", "console error",
  "console message", "network tab"
];

const debuggingPatterns = [
  /\b(startup|fail|fails|failing|failed|crash|crashes|crashed|error|errors|exception|econnrefused|undefined during startup|broke|broken|bug|issue|not working|timeout|timeouts)\b/
];

const debugKeywords = [
  "fail", "error", "bug", "crash", "broke", "broken", "issue", "not working", "timeout", "blank", "exception", "failed", "failing"
];

export function planCapabilities(query) {
  if (!query || typeof query !== 'string') {
    return {
      requiresRepository: false,
      requiresGit: false,
      requiresRuntime: false,
      requiresDocumentation: false,
      requiresDebuggingRag: false
    };
  }

  const q = query.toLowerCase().trim();

  // 1. General Exclusions Check
  if (generalExclusions.some(regex => regex.test(q))) {
    return {
      requiresRepository: false,
      requiresGit: false,
      requiresRuntime: false,
      requiresDocumentation: false,
      requiresDebuggingRag: false
    };
  }

  // 2. Requires Documentation
  const requiresDocumentation = docIntentPatterns.some(regex => regex.test(q)) || 
                                docKeywords.some(kw => q.includes(kw));

  // 3. Requires Repository
  const hasRepoIndicator = repoIndicators.some(regex => regex.test(q)) ||
                            repoKeywords.some(kw => q.includes(kw)) ||
                            fileRegex.test(q) ||
                            folderKeywords.some(fk => q.includes(fk));
  const requiresRepository = hasRepoIndicator;

  // 4. Requires Git
  const requiresGit = changePatterns.some(regex => regex.test(q)) || 
                      gitKeywords.some(kw => q.includes(kw));

  // 5. Requires Runtime
  const requiresRuntime = runtimeKeywords.some(kw => q.includes(kw));

  // 6. Requires Debugging RAG
  const requiresDebuggingRag = debuggingPatterns.some(regex => regex.test(q)) || 
                               debugKeywords.some(kw => q.includes(kw)) ||
                               isLogStructured(query);

  let suggestedPriority = [];
  let suggestedBudgetGuidance = "";

  if (requiresDebuggingRag) {
      suggestedPriority = ["Parse Error Logs", "Chrome DevTools", "Codebase Inspection", "Git History"];
      suggestedBudgetGuidance = "Prioritize reading stack traces and viewing browser runtime state; only read files if specifically referenced in errors.";
  } else if (requiresRuntime) {
      suggestedPriority = ["Chrome DevTools", "Codebase Inspection"];
      suggestedBudgetGuidance = "Prioritize inspecting the browser console and network requests; check code only to cross-reference errors.";
  } else if (requiresDocumentation) {
      suggestedPriority = ["Context7 Documentation", "Codebase Inspection"];
      suggestedBudgetGuidance = "Look up the official documentation first to understand the API; only check the codebase to compare implementation against best practices.";
  } else if (requiresGit) {
      suggestedPriority = ["Git History", "Codebase Inspection"];
      suggestedBudgetGuidance = "Prioritize checking recent commits; inspect files only to understand specific changes.";
  } else if (requiresRepository) {
      suggestedPriority = ["Search/Read Codebase"];
      suggestedBudgetGuidance = "Focus on static codebase investigation; look for specific file paths, configuration, or implementations.";
  }

  return {
    requiresRepository,
    requiresGit,
    requiresRuntime,
    requiresDocumentation,
    requiresDebuggingRag,
    suggestedPriority,
    suggestedBudgetGuidance
  };
}
