import 'dotenv/config'
import Koa from 'koa'
import poolsConf from './pools.js'
import _ from 'lodash'
import {
  reloadPoolData,
  reloadBscData,
  checkPoolState,
  reloadWinners,
  reloadWinnersBsc,
  countProfit,
} from './lib.js'
import knex from 'knex'

const PORT = 8081

const app = new Koa()

const addressMap = {}
const cache = {}
let winnersCache = []
let winnersFullList = []
const lastUpdated = {}
const activityMap = {}
let leaderboard = []

let upd = 0

const db = knex({
  client: 'mysql2',
  connection: {
    socketPath: '/var/lib/mysql/mysql.sock',
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: 'banzai',
  },
});

const reloadLeaderboard = async () => {
  let list = []

  const req = await fetch('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH,BNB,SOL', {
    headers: {
      'X-CMC_PRO_API_KEY': process.env.COINMARKET_API_KEY,
    },
  }).catch((err) => {
    console.log('failed', err)
    return false
  })

  const rates = {}
  
  if (!req || !req.ok) return false
  const response = await req.json()
  Object.keys(response.data).forEach((ticker) => {
    const k = ticker.toLowerCase()

    if (response.data[ticker].quote && response.data[ticker].quote.USD.price) {
      rates[k] = response.data[ticker].quote.USD.price

      db('rates').where('ticker', '=', k).update({
        price: response.data[ticker].quote.USD.price
      }).then(() => console.log('saved rate into mysql'))
    }
  })
  console.log('rates were updated in database')

  // clear table
  await db('winners').where('address', '!=', 'null').del()

  const batch = []
  // first eth
  const pools = poolsConf.eth
  for (const pool of pools) {
    const data = await reloadWinners(pool, 'eth')
    if (data && data.length > 0) {
      list = list.concat(data)
    }

    for (const item of data) {
      batch.push({
        address: item.to.toLowerCase(),
        rounds: 1,
        profit_eth: item.value,
      })
    }

    await new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000)
    })
  }

  const poolsBsc = poolsConf.bsc
  for (const pool of poolsBsc) {
    const data = await reloadWinnersBsc(pool)
    if (data && data.length > 0) {
      list = list.concat(data)
    }

    for (const item of data) {
      batch.push({
        address: item.to.toLowerCase(),
        rounds: 1,
        profit_bnb: item.value,
      })
    }

    await new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000)
    })
  }

  while (batch.length > 0) {
    const pack = batch.splice(0, 10)
    await db('winners').insert(pack).then(() => console.log('save pack of winners', pack.length))
  }

  winnersFullList = list // raw
  const sortedData = _(list)
    .groupBy('to')
    .orderBy((item) => item.length, ['desc'])
    .values()

  const leaders = []
  sortedData.forEach((item) => {
    const addr = item[0].to.toLowerCase()

    leaders.push({
      address: addr,
      rounds: item.length,
      profits: countProfit(item),
    })
  })

  leaderboard = leaders
}

const reloadCache = async () => {
  console.log('==== Start reloading cache', new Date())
  let winnersList = []

  // first eth
  const pools = poolsConf.eth
  for (const pool of pools) {
    if (upd % 5 == 0) {
      const players = await checkPoolState(pool, 'eth')
      activityMap[pool.address] = players
    }

    const data = await reloadPoolData(pool, 'eth')
    if (data && data.tx) {
      cache[pool.address] = data.tx
      winnersList = winnersList.concat(data.winners)
      lastUpdated[pool.address] = new Date()
    }

    await new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000)
    })
  }
 
  const poolsBsc = poolsConf.bsc
  for (const pool of poolsBsc) {
    if (upd % 5 == 0) {
      const players = await checkPoolState(pool, 'bsc')
      activityMap[pool.address] = players
    }

    const data = await reloadBscData(pool)
    if (data && data.tx) {
      cache[pool.address] = data.tx
      winnersList = winnersList.concat(data.winners)
      lastUpdated[pool.address] = new Date()
    }

    await new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000)
    })
  }

  winnersCache = _.orderBy(winnersList, ['timestamp'], ['desc']).slice(0, 16)
  upd++

  console.log('==== End reloading cache', new Date())
}

const initMap = () => {
  // init address map
  Object.keys(poolsConf).forEach((chain) => {
    const pools = poolsConf[chain]

    pools.forEach((item) => {
      addressMap[item.address] = chain
    })
  })

  console.log(addressMap, 'INIT MAP')
}

initMap()
setInterval(reloadCache, 20*1000) // every 20 sec
setInterval(reloadLeaderboard, 4*60*60*1000) // every 4 hours

reloadCache()
reloadLeaderboard()

app.use(async ctx => {
  console.log(ctx.path)

  if (ctx.path.includes('/leaderboard')) {
    ctx.body = { leaderboard }
    return true
  }

  if (ctx.path == '/winners') {
    ctx.body = { winners: winnersCache, count: winnersCache.length }
    return true
  }

  if (ctx.path == '/winners/full') {
    ctx.body = { winners: winnersFullList, count: winnersFullList.length }
    return true
  }

  if (ctx.path.includes('/state')) {
    ctx.body = { state: activityMap }
    return true
  }

  if (ctx.path.includes('/tx/')) {
    const p = ctx.path.split('/tx/').pop()

    if (p && p != '' && addressMap[p]) {
      ctx.body = { transactions: cache[p] }
    } else {
      ctx.body = { transactions: [] }
    }
    return true
  }

  // default endpoint
  ctx.body = { status: 'Working', cache };
})

app.listen(PORT)
