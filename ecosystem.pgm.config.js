const path = require('path');

module.exports = {
  apps: [
    {
      name: 'pgm-api',
      script: path.join(__dirname, 'apps/api-pgm/bin/pgm-api'),
      cwd: __dirname,
      instances: 1,
      max_memory_restart: '256M',
      env: {
        APP_ENV: 'production',
        PORT: 4001,
      },
    },
  ],
};
