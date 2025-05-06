import 'dotenv/config'
import Koa from 'koa'
import poolsConf from './pools.js'
import _ from 'lodash'
import { reloadPoolData, reloadBscData } from './lib.js'

const PORT = 8081

const app = new Koa()

const addressMap = {}
const cache = {}
let winnersCache = []
const lastUpdated = {}

const reloadCache = async () => {
  console.log('==== Start reloading cache', new Date())
  let winnersList = []

  // first eth
  const pools = poolsConf.eth
  for (const pool of pools) {
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
setInterval(reloadCache, 20*1000) // every 10 sec

app.use(async ctx => {
  console.log(ctx.path)

  if (ctx.path.includes('/winners')) {
    ctx.body = { winners: winnersCache }
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
