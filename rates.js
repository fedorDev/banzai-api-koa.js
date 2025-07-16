import db from './db.js'

// use CoinMarketCap API
const updateRates = async () => {
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
} 

export default updateRates 