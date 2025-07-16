import knex from 'knex'

// init connect to MySQL
const db = knex({
  client: 'mysql2',
  connection: {
    socketPath: '/var/lib/mysql/mysql.sock',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: 'banzai',
  },
})

export default db
