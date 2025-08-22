import 'dotenv/config'
import Koa from 'koa'
import amqp from 'amqplib'
import poolsConf from './pools.js'
import _ from 'lodash'
import {
  reloadPoolData,
  checkPoolState,
} from './lib.js'
import updateRates from './rates.js'
import { updateLeaderboard, getLastWinners } from './leaders.js'

const PORT = 8081

const app = new Koa()

const addressMap = {}
const cache = {}
let winnersCache = []
let winnersFullList = []
const lastUpdated = {}
const activityMap = {}
let leaderboard = []

let channel = null

let upd = 0

const reloadData = async () => {
  // update currency rates
  updateRates()

  // update leaderboard
  const lst = await updateLeaderboard()
  winnersCache = await getLastWinners()
  leaderboard = lst.leaders || []
}

const reloadCache = async () => {
  console.log('==== Start reloading cache', new Date())

  // first eth
  const pools = poolsConf.eth
  for (const pool of pools) {
    if (upd % 5 == 0) {
      const players = await checkPoolState(pool, 'eth')
      activityMap[pool.address] = players

      // if round was completed, emit message to Queue
      if (channel && players >= pool.players) { // for debug
        channel.sendToQueue('detect-winner', Buffer.from('eth:' + pool.address))
      }
    }

    const data = await reloadPoolData(pool, 'eth')
    if (data && data.tx) {
      cache[pool.address] = data.tx
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
      if (channel && players >= pool.players) {
        channel.sendToQueue('detect-winner', Buffer.from('bsc:' + pool.address))
      }
      activityMap[pool.address] = players
    }

    const data = await reloadPoolData(pool, 'bsc')
    if (data && data.tx) {
      cache[pool.address] = data.tx
      lastUpdated[pool.address] = new Date()
    }

    await new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000)
    })
  }

  upd++
  channel.sendToQueue('detect-winner', Buffer.from('ping')) // heartbeat to keep alive connection
  console.log('==== End reloading cache', new Date())
}

const initialize = async () => {
  // init channel to RabbitMQ
  const connection = await amqp.connect('amqp://localhost')
  channel = await connection.createChannel()
  await channel.assertQueue('detect-winner', { durable: false })

  // init address map
  Object.keys(poolsConf).forEach((chain) => {
    const pools = poolsConf[chain]

    pools.forEach((item) => {
      addressMap[item.address] = chain
    })
  })

  console.log(addressMap, 'INIT MAP')

  // set timers to update cache and data
  setInterval(reloadCache, 20*1000) // every 20 sec
  setInterval(reloadData, 4*60*60*1000) // every 4 hours  

  // fill with initial data
  reloadCache()
  reloadData()
}

initialize()

app.use(async ctx => {
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
      ctx.body = { transactions: cache[p] || [] }
    } else {
      ctx.body = { transactions: [] }
    }
    return true
  }

  // default endpoint
  ctx.body = { status: 'Working', cache };
})

app.listen(PORT)
