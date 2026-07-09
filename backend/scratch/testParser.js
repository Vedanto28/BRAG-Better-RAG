import { parseErrorLog } from '../src/utils/logParser.js';

const testTraceA = `
TypeError: Cannot read properties of undefined (reading 'foo')
    at startServer (d:\\DESKTOP CONTENT\\Desktop\\for employment\\ai-chatBot\\backend\\server.js:25:20)
    at runTest (file:///d:/DESKTOP%20CONTENT/Desktop/for%20employment/ai-chatBot/backend/scratch/testResiliency.js:97:15)
`;

const resultA = parseErrorLog(testTraceA);
console.log("Result A:", JSON.stringify(resultA, null, 2));

const testTraceB = `
2026-07-10 01:23:45 UTC - TypeError: Cannot read properties of undefined (reading 'foo') PASSWORD=secret123
2026-07-10 01:23:46 UTC - TypeError: Cannot read properties of undefined (reading 'foo') key="super-token"
`;

const resultB = parseErrorLog(testTraceB);
console.log("Result B:", JSON.stringify(resultB, null, 2));
