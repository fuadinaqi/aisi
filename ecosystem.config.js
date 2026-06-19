module.exports = {
  apps: [
    {
      name: 'dakwah-api',
      script: 'apps/api/dist/server.js',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 4000 },
    },
    {
      name: 'dakwah-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: 'apps/web',
      instances: 1,
      env: { NODE_ENV: 'production', PORT: 3000 },
    },
  ],
};
