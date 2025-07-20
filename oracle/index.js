import 'dotenv/config'
import { createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet, bsc } from 'viem/chains'
import pools from '../pools.js'
import GameAbi from '../abi/Game.js'
import crypto from 'crypto'
import amqp from 'amqplib'

const INFURA_KEY = process.env.INFURA_KEY

function getRandomNumber() {
  const buffer = crypto.randomBytes(2)
  const hexString = buffer.toString('hex')

  return parseInt(hexString, 16) % 1000
}

// init account
const account = privateKeyToAccount(process.env.ORACLE_WALLET_KEY)

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

const initConsumer = async () => {
  const connection = await amqp.connect('amqp://localhost')
  const channel = await connection.createChannel()
  await channel.assertQueue('detect-winner', { durable: false })
  await channel.assertQueue('heartbeat', { durable: false })

  channel.consume('heartbeat', function(msg) {
    console.log('Pong!')
  })

  channel.consume('detect-winner', async function(msg) {
    const rand = getRandomNumber()

    const s = msg.content.toString()
    const [chain, address] = s.split(':')

    console.log(address, 'pool is filled, will detectWinner()', chain, rand)

    const wallet = chain == 'bsc' ? walletBsc : walletEth
    await wallet.writeContract({
      address,
      abi: GameAbi,
      functionName: 'detectWinner',
      value: rand, // in WEI
    }).catch((err) => {
      console.log(err)
      return false
    })
  
  }, {
      noAck: true
  })  
}

initConsumer()

console.log('Started oracle...')
