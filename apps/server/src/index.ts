import { createServer } from "node:http";
import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { config } from "./config/env.js";
import { seedDevelopmentData } from "./services/bootstrap.service.js";
import { startDeadlineMonitor } from "./services/deadline-monitor.service.js";
import { initializeRealtime } from "./services/realtime.service.js";

await connectDatabase();
await seedDevelopmentData();

const server = createServer(app);
initializeRealtime(server);
startDeadlineMonitor();

server.listen(config.port, () => {
  console.log(`CCS REST API listening on http://localhost:${config.port}`);
});
