import 'dotenv/config';
import app from '../server.js';
import { getMcpClient, resetMcpClient } from '../src/services/mcpClient.js';

const PORT = 5019;

async function run() {
  process.env.PORT = PORT;
  const server = app.listen(PORT, async () => {
    console.log(`[Test Server] Running on port ${PORT}`);
    
    // First connection
    console.log("\n--- Establishing First Connection ---");
    const client1 = await getMcpClient();
    
    // Reset connection
    console.log("\n--- Resetting Connection (clearing clientInstance) ---");
    resetMcpClient();
    
    // Second connection
    console.log("\n--- Establishing Second Connection ---");
    const client2 = await getMcpClient();
    
    console.log("\n--- Waiting for 5 seconds to observe reconnect loops ---");
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log("\n--- Cleaning up ---");
    server.close();
    process.exit(0);
  });
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
