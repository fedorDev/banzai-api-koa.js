import _ from 'lodash'
import { parseEther, formatEther } from 'viem'

const startBlock = {
  eth: 22185982,
  bsc: 48022467,
}

const ETH_API_KEY = process.env.ETH_API_KEY
const BSC_API_KEY = process.env.BSC_API_KEY

export const reloadPoolData = async (pool, chain) => {
  const result = []
  const winners = []

  const started = new Date()
  console.log('Started fetching ETH pool transactions', started)

  let url = `https://api.${chain == 'eth' ? 'etherscan' : 'bscscan'}.io/v2/api?module=account`
  url += `&chainId=${chain == 'eth' ? '1' : '56'}`
  url += `&action=txlistinternal&address=${pool.address}&page=1&offset=5&sort=desc`
  url += `&startblock=${startBlock[chain]}&apikey=${ETH_API_KEY}`

  // &startblock=0
  // &endblock=2702578
  const req = await fetch(url).catch((err) => {
    console.log('FAILED InternalTXs update')
    return false
  })

  if (req && req.ok) {
    const data = await req.json()
    if (data.result && data.message != 'NOTOK') {
      data.result.forEach((i) => {
        const d = {
          value: formatEther(i.value),
          hash: i.hash,
          block: i.blockNumber,
          from: i.from,
          to: i.to,
          chain: 'eth',
          timestamp: i.timeStamp*1,
          type: 'win',
        }

        if (d.value == `${pool.stake*9}` && !Number(i.isError)) {
          result.push(d)
          winners.push(d)
        }
      })
    }
  }

  let urlTx = `https://api.etherscan.io/v2/api?module=account`
  urlTx += `&chainId=${chain == 'eth' ? '1' : '56'}`
  urlTx += `&action=txlist&address=${pool.address}&page=1&offset=20&sort=desc`
  urlTx += `&startblock=${startBlock[chain]}&apikey=${ETH_API_KEY}`

  const reqTx = await fetch(urlTx).catch((err) => {
    console.log('FAILED TXs update')
    return false
  })

  if (reqTx && reqTx.ok) {
    const data = await reqTx.json()
    if (data.result && data.message != 'NOTOK') {
      data.result.forEach((i) => {
        const d = {
          value: formatEther(i.value),
          hash: i.hash,
          block: i.blockNumber,
          from: i.from,
          to: i.to,
          timestamp: i.timeStamp*1,
          type: 'stake',
        }

        if (d.value == `${pool.stake}` && !Number(i.isError)) result.push(d)
      })
    }
  }

  const ended = new Date()
  console.log('ended fetching', ended)
  return {
    tx: _.orderBy(result, ['timestamp'], ['desc']).slice(0, 16),
    winners,
  }
}

export const reloadBscData = async (pool) => {
  const result = []
  const winners = []

  const started = new Date()
  console.log('Started fetching BSC pool transactions', started)

  let url = `https://api.bscscan.com/api?module=account`
  url += `&action=txlistinternal&address=${pool.address}&page=1&offset=5&sort=desc`
  url += `&startblock=${startBlock.bsc}&apikey=${BSC_API_KEY}`

  const req = await fetch(url).catch((err) => {
    console.log('FAILED InternalTXs update')
    return false
  })

  if (req && req.ok) {
    const data = await req.json()
    if (data.result && data.message != 'NOTOK') {
      data.result.forEach((i) => {
        const d = {
          value: formatEther(i.value),
          hash: i.hash,
          block: i.blockNumber,
          from: i.from,
          to: i.to,
          chain: 'bsc',
          timestamp: i.timeStamp*1,
          type: 'win',
        }

        if (d.value == `${pool.stake*9}` && !Number(i.isError)) {
          result.push(d)
          winners.push(d)          
        }
      })
    }
  }

  let urlTx = `https://api.bscscan.com/api?module=account`
  urlTx += `&action=txlist&address=${pool.address}&page=1&offset=20&sort=desc`
  urlTx += `&startblock=${startBlock.bsc}&apikey=${BSC_API_KEY}`

  // &startblock=0
  // &endblock=2702578
  const reqTx = await fetch(urlTx).catch((err) => {
    console.log('FAILED TXs update')
    return false
  })

  if (reqTx && reqTx.ok) {
    const data = await reqTx.json()
    if (data.result && data.message != 'NOTOK') {
      data.result.forEach((i) => {
        const d = {
          value: formatEther(i.value),
          hash: i.hash,
          block: i.blockNumber,
          from: i.from,
          to: i.to,
          timestamp: i.timeStamp*1,
          type: 'stake',
        }

        if (d.value == `${pool.stake}` && !Number(i.isError)) result.push(d)
      })
    }
  }

  const ended = new Date()
  console.log('ended fetching', ended)
  return {
    tx: _.orderBy(result, ['timestamp'], ['desc']).slice(0, 16),
    winners,
  }
}
