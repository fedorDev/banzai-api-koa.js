import _ from 'lodash'
import { createPublicClient, http, parseEther, formatEther } from 'viem'
import { mainnet, bsc } from 'viem/chains'
import GameAbi from './abi/Game.js'
import startBlock from './blocks.js'

const INFURA_KEY = process.env.INFURA_KEY

const ETH_API_KEY = process.env.ETH_API_KEY
const BSC_API_KEY = process.env.BSC_API_KEY

const clientEth = createPublicClient({
  chain: mainnet,
  transport: http(`https://mainnet.infura.io/v3/${INFURA_KEY}`)
})

const clientBsc = createPublicClient({
  chain: bsc,
  transport: http(`https://bsc-mainnet.infura.io/v3/${INFURA_KEY}`)
})

// read data from smart contract, check pool size
export const checkPoolState = async (pool, chain) => {
  let result = 0

  if (chain == 'bsc') {
    const data = await clientBsc.readContract({
      address: pool.address,
      abi: GameAbi,
      functionName: 'showPool',
    }).catch((err) => false)

    if (data && data.length > 0) result = data.length
  } else {
    const data = await clientEth.readContract({
      address: pool.address,
      abi: GameAbi,
      functionName: 'showPool',
    }).catch((err) => false)

    if (data && data.length > 0) result = data.length
  }

  return result
}

// parse last 200 internal transactions from Etherescan, payouts from contract
export const reloadWinners = async (pool, chain) => {
  const winners = []

  const started = new Date()
  console.log('Started fetching pool payout transactions', chain, started)

  let url = `https://api.etherscan.io/v2/api?module=account`
  url += `&chainId=${chain == 'eth' ? '1' : '56'}`
  url += `&action=txlistinternal&address=${pool.address}&page=1&offset=400&sort=desc`
  url += `&startblock=${startBlock[chain]}&apikey=${ETH_API_KEY}`

  // &startblock=0
  // &endblock=2702578
  const req = await fetch(url).catch((err) => {
    console.log('FAILED InternalTXs update', err)
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

        if (d.value == `${pool.prize}` && !Number(i.isError)) {
          winners.push(d)
        }
      })
    }
  }

  const ended = new Date()
  console.log('ended fetching', ended)
  return winners
}

// parse last 200 internal transactions from Etherescan, payouts from contract
export const reloadWinnersBsc = async (pool) => {
  const winners = []

  const started = new Date()
  console.log('Started fetching BSC pool payout transactions', started)

  let url = `https://api.bscscan.com/api?module=account`
  url += `&action=txlistinternal&address=${pool.address}&page=1&offset=400&sort=desc`
  url += `&startblock=${startBlock.bsc}&apikey=${BSC_API_KEY}`

  // &startblock=0
  // &endblock=2702578
  const req = await fetch(url).catch((err) => {
    console.log('FAILED InternalTXs update', err)
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

        if (d.value == `${pool.prize}` && !Number(i.isError)) {
          winners.push(d)
        }
      })
    }
  }

  const ended = new Date()
  console.log('ended fetching', ended)
  return winners
}

// get last 16 inbound and outbound Ethereum transactions of smart contract, sort by timestamp
export const reloadPoolData = async (pool, chain) => {
  const result = []
  const winners = []

  const started = new Date()
  console.log('Started fetching pool transactions', chain, started)

  let url = `https://api.etherscan.io/v2/api?module=account`
  url += `&chainid=${chain == 'eth' ? '1' : '56'}`
  url += `&action=txlistinternal&address=${pool.address}&page=1&offset=20&sort=desc`
  // url += `&startblock=${startBlock[chain]}`
  url += `&apikey=${ETH_API_KEY}`

  const req = await fetch(url).catch((err) => {
    console.log('FAILED InternalTXs update reloadPoolData', err)
    return false
  })

  if (req && req.ok) {
    const data = await req.json()
    console.log('GOTCHA ', data)

    if (data.result && data.message != 'NOTOK') {
      data.result.forEach((i) => {
        const d = {
          value: formatEther(i.value),
          hash: i.hash,
          block: i.blockNumber,
          from: i.from,
          to: i.to,
          chain,
          timestamp: i.timeStamp*1,
          type: 'win',
        }

        if (d.value == `${pool.stake}` && !Number(i.isError)) {
          d.type = 'stake' // internal tx stakes
          result.push(d)
        }

        if (d.value == `${pool.prize}` && !Number(i.isError)) {
          result.push(d)
          winners.push(d)
        }
      })
    }
  }

  let urlTx = `https://api.etherscan.io/v2/api?module=account`
  urlTx += `&chainid=${chain == 'eth' ? '1' : '56'}`
  urlTx += `&action=txlist&address=${pool.address}&page=1&offset=20&sort=desc`
  urlTx += `&startblock=${startBlock[chain]}&apikey=${ETH_API_KEY}`

  const reqTx = await fetch(urlTx).catch((err) => {
    console.log('FAILED TXs update, reloadPoolData', err)
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
  console.log('FETCHED TX', result)
  return {
    tx: _.orderBy(result, ['timestamp'], ['desc']).slice(0, 16),
    winners,
  }
}

// get last 16 inbound and outbound BSC transactions of smart contract, sort by timestamp
export const reloadBscData = async (pool) => {
  const result = []
  const winners = []

  const started = new Date()
  console.log('Started fetching BSC pool transactions', started)

  let url = `https://api.bscscan.com/api?module=account`
  url += `&action=txlistinternal&address=${pool.address}&page=1&offset=20&sort=desc`
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

        if (d.value == `${pool.stake}` && !Number(i.isError)) {
          d.type = 'stake' // internal tx stakes
          result.push(d)
        }

        if (d.value == `${pool.prize}` && !Number(i.isError)) {
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

export const countProfit = (list) => {
  const score = {
    eth: 0,
    bsc: 0,
  }

  list.forEach((item) => {
    const k = Number(item.value)
    score[item.chain] += k
  })

  return score
}
