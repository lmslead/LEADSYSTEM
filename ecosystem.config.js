module.exports = {
  apps: [{
    name: 'lms-backend',
    script: './server/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: '/var/log/pm2/lms-backend-error.log',
    out_file: '/var/log/pm2/lms-backend-out.log',
    log_file: '/var/log/pm2/lms-backend-combined.log',
    time: true,
    max_memory_restart: '1G',
    autorestart: true,
    watch: false,
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000
  }]
};
