import { createApp } from "./api/app.js";
import { logger } from "./lib/logger.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  logger.info(`dart-risk-api 서버 시작: http://localhost:${port}`);
});
