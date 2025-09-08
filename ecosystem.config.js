module.exports = {
  apps: [
    {
      name: 'lms-backend',
      script: 'server/server.js',
      instances: 1, // Can be increased based on CPU cores
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      // Production optimizations
      exec_mode: 'fork', // Use 'cluster' for multiple instances
      min_uptime: '10s',
      max_restarts: 10,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      // Environment specific settings
      node_args: '--max-old-space-size=1024'
    }
  ]
};
