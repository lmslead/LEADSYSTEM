                                                                                         
/**module.exports = {
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

        GTI_POSTBACK_URL: "https://global-telecom-investors.trackdrive.com/api/v1/calls/update_call/[call_uuid]",
        GTI_AUTH_HEADER: "Basic dGRwdWJhNzhlNDIwMmE3ZWFkMTkzNzY3ZGFhMzNmOTIwYTIxNjp0ZHBydmQ5OThlZDQ0YmVjYmQxNzM2ZDc2MDI1YzEyM2UwN2UxNzhiYjc1YmY=",
        GTI_TTL_DAYS: "30",
        VICIDIAL_HANGUP_URL: "http://14.96.246.98/VLC_API/hangup_api.php"
        },

      max_memory_restart: "900M",
      autorestart: true,
      watch: false
    }
  ]
};

*/