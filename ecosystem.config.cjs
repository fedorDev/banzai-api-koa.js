module.exports = {
  apps: [
    {
      name: 'banzai-data',
      script: 'index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'banzai-oracle',
      script: 'oracle/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
    {
      name: 'banzai-go-stats',
      script: '../go/data-api',
      instances: 1,
      autorestart: true,
      watch: false,
    }
  ]
}

