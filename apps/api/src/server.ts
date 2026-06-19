import app from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, () => {
  console.log(`API server running on http://localhost:${env.PORT}`);
  console.log(`Health check: http://localhost:${env.PORT}/health`);
});
