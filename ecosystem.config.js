module.exports = {
  apps: [{
    name: 'lms-backend',
    script: './server/server.js',
    instances: 1, // Use 1 instance to avoid rate limiting issues
    exec_mode: 'fork',
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
    max_restarts: 50, // Increased from 10
    restart_delay: 2000, // Reduced from 4000
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    shutdown_with_message: true
  }]
};
