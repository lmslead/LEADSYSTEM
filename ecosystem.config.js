                                                                                           
module.exports = {
  apps: [
    {
      name: "lms-backend",
      script: "./server/server.js",

      exec_mode: "cluster",
      instances: 4,   // 🔥 EXACTLY 4 SERVERS

      env: {
        NODE_ENV: "production",
        PORT: 5000,

        MONGODB_URI: "mongodb+srv://rglms10:RGLMS123@lmsdatabase.jo25hav.mongodb.net/papadms",
        JWT_SECRET: "LMSSECRETKEY",
        CORS_ORIGIN: "https://olivialms.cloud",

        // ── Redis (required for multi-server / PM2 cluster Socket.IO) ──────
        // Set to your Redis server address.  Both servers must point to the
        // SAME Redis instance so Socket.IO events cross process boundaries.
        // Example:  redis://:<password>@<redis-host>:6379
        REDIS_URL: "redis://127.0.0.1:6379",

        GTI_POSTBACK_URL: "https://global-telecom-investors.trackdrive.com/api/v1/calls/update_call/[call_uuid]",
        GTI_AUTH_HEADER: "Basic dGRwdWJhNzhlNDIwMmE3ZWFkMTkzNzY3ZGFhMzNmOTIwYTIxNjp0ZHBydmQ5OThlZDQ0YmVjYmQxNzM2ZDc2MDI1YzEyM2UwN2UxNzhiYjc1YmY=",
        GTI_TTL_DAYS: "30",
        VICIDIAL_HANGUP_URL: "http://14.96.246.98/VLC_API/hangup_api.php",
        // Redis — shared Socket.IO adapter + cache across all PM2 workers and servers.
        // Point both servers at the same Redis instance (or Redis Cluster).
        REDIS_URL: "redis://127.0.0.1:6379"
        },

      max_memory_restart: "900M",
      autorestart: true,
      watch: false
    }
  ]
};



