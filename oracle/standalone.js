import 'dotenv/config'
import { createWalletClient, createPublicClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet, bsc } from 'viem/chains'
import pools from './pools.js'
import GameAbi from './abi/Game.js'
import crypto from 'crypto'

const INFURA_KEY = process.env.INFURA_KEY

function getRandomNumber() {
  const buffer = crypto.randomBytes(2)
  const hexString = buffer.toString('hex')

  return parseInt(hexString, 16) % 1000
}

// init account
const account = privateKeyToAccount(process.env.ORACLE_WALLET_KEY)

const clientEth = createPublicClient({
  chain: mainnet,
  transport: http(`https://mainnet.infura.io/v3/${INFURA_KEY}`)
})
 
const clientBsc = createPublicClient({
  chain: bsc,
  transport: http(`https://bsc-mainnet.infura.io/v3/${INFURA_KEY}`)
})

const walletEth = createWalletClient({
  account,
  chain: mainnet,
  transport: http(`https://mainnet.infura.io/v3/${INFURA_KEY}`)
})

const walletBsc = createWalletClient({
  account,
  chain: bsc,
  transport: http(`https://bsc-mainnet.infura.io/v3/${INFURA_KEY}`)
})

const checkPoolEth = async (poolAddress, maxPlayers) => {
  const data = await clientEth.readContract({
    address: poolAddress,
    abi: GameAbi,
    functionName: 'showPool',
  })

  if (data && data.length >= maxPlayers) {
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

const checkPoolBsc = async (poolAddress, maxPlayers) => {
  const data = await clientBsc.readContract({
    address: poolAddress,
    abi: GameAbi,
    functionName: 'showPool',
  })

  if (data && data.length >= maxPlayers) {
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
    await checkPoolEth(pool.address, pool.players)
  }

  for (const pool of pools.bsc) {
    await checkPoolBsc(pool.address, pool.players)
  }

  console.log('[+] check finished')
}

console.log(getRandomNumber())
console.log(getRandomNumber())
console.log(getRandomNumber())

const testVal = async () => {
  const rand = getRandomNumber()
  console.log('TEST rand', rand, typeof rand)

  const hash = await walletBsc.sendTransaction({ 
  // account,
    to: '0x90fe1986092Ec963C4e9368837D02CB297f545Fe',
    value: rand,
  })
}

// testVal()

checkPoolsHandler()
setInterval(checkPoolsHandler, 5*60*1000) // every 5 mins
console.log('Started loop...')
