import 'dotenv/config'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet, bsc } from 'viem/chains'
import GameAbi from './abi/Game.js'
import crypto from 'crypto'

function getRandomNumber() {
  const buffer = crypto.randomBytes(1)
  return buffer[0]
}

const pools = {
  eth: [],
  bsc: [
    '0x460D4b774fe559F88827f375c0ae1C0C2fe77B0f',
    '0xd50b76e2c4205cCb89cB6461726C3033253b941f',
    '0xCDeae25475e446DD467Ae31C04931D17013b60C4',
  ],
}

// init account
const account = privateKeyToAccount(process.env.ORACLE_WALLET_KEY)

const clientEth = createPublicClient({
  chain: mainnet,
  transport: http()
})
 
const clientBsc = createPublicClient({
  chain: bsc,
  transport: http()
})

const walletEth = createWalletClient({
  account,
  chain: mainnet,
  transport: http()
})

const walletBsc = createWalletClient({
  account,
  chain: bsc,
  transport: http()
})

const checkPoolEth = async (poolAddress) => {
  const data = await clientEth.readContract({
    address: poolAddress,
    abi: GameAbi,
    functionName: 'showPool',
  })

  if (data && data.length > 9) {
    const rand = getRandomNumber()
    console.log(poolAddress, 'pool is filled, will detectWinner()', rand)

    await walletEth.writeContract({
      address: poolAddress,
      abi: GameAbi,
      functionName: 'detectWinner',
      value: rand, // in WEI
    }).catch((err) => {
      console.log(err)
      return false
    })

    const winner = await clientEth.readContract({
      address: poolAddress,
      abi: GameAbi,
      functionName: 'lastWinner',
    })

    console.log('WINNER IS', winner)
  }
}

const checkPoolBsc = async (poolAddress) => {
  const data = await clientBsc.readContract({
    address: poolAddress,
    abi: GameAbi,
    functionName: 'showPool',
  })

  console.log(poolAddress, 'POOL IS', data)

  if (data && data.length > 9) {
    const rand = getRandomNumber()
    console.log(poolAddress, 'pool is filled, will detectWinner()', rand)

    await walletBsc.writeContract({
      address: poolAddress,
      abi: GameAbi,
      functionName: 'detectWinner',
      value: rand, // in WEI
    }).catch((err) => {
      console.log(err)
      return false
    })

    const winner = await clientBsc.readContract({
      address: poolAddress,
      abi: GameAbi,
      functionName: 'lastWinner',
    }).catch((err) => false)

    console.log('WINNER IS', winner)
  }
}

const checkPoolsHandler = async () => {
  console.log('check game contracts...')

  for (const pool of pools.eth) {
    await checkPoolEth(pool)
  }

  for (const pool of pools.bsc) {
    await checkPoolBsc(pool)
  }

  console.log('[+] check finished')
}

setInterval(checkPoolsHandler, 5*60*1000) // every 5 mins
console.log('Started loop...')
