import { app } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { config } from "./config/env.js";
import { seedDevelopmentData } from "./services/bootstrap.service.js";

await connectDatabase();
await seedDevelopmentData();

app.listen(config.port, () => {
  console.log(`CCS REST API listening on http://localhost:${config.port}`);
});
