import db from './db.js'
import poolsConf from './pools.js'
import _ from 'lodash'
import {
  reloadWinners,
  reloadWinnersBsc,
  countProfit,
} from './lib.js'
import { startBlock }from './blocks.js'

const updateLeaderboard = async () => {
  let list = []

  // clear records after start block, to reparse data
  await db('winners')
    .where('profit_eth', '>', '0')
    .andWhere('block', '>', startBlock.eth)
    .del()

  await db('winners')
    .where('profit_bnb', '>', '0')
    .andWhere('block', '>', startBlock.bsc)
    .del()

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
        block: item.block,
      })
    }

    await new Promise((resolve) => {
      setTimeout(() => resolve(true), 1000)
    })
  }

  const poolsBsc = poolsConf.bsc
  for (const pool of poolsBsc) {
    const data = await reloadWinners(pool, 'bsc')
    if (data && data.length > 0) {
      list = list.concat(data)
    }

    for (const item of data) {
      batch.push({
        address: item.to.toLowerCase(),
        rounds: 1,
        profit_bnb: item.value,
        block: item.block,
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

  return {
    full: list,
    leaders,
  }
}

export default updateLeaderboard
  
