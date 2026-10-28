const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "nacif-electric-api",
      cwd: path.resolve(__dirname, "backend"),
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "src/server.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        FRONTEND_URL: "https://nacifenergy.com.br",
      },
    },
  ],
};
