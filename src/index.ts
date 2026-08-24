import { createApp } from "./api/app.js";

const port = Number(process.env.PORT) || 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`dart-risk-api 서버 시작: http://localhost:${port}`);
});
