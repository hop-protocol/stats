
function formatVolume (volumes, prices) {
  let amount = 0
  for (const volume of volumes) {
    if (!enabledTokens[volume.token]) {
      continue
    }
    const decimals = tokenDecimals[volume.token]
    const rawAmount = ethers.BigNumber.from(volume.amount)
    const _amount = Number(ethers.utils.formatUnits(rawAmount, decimals)) * prices[volume.token]
    amount = amount + _amount
  }
  const formattedAmount = formatCurrency(amount)
  return {
    amount,
    formattedAmount
  }
}

const tokenDecimals = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  MATIC: 18,
  ETH: 18
}

function formatCurrency (value, token) {
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    // style: 'currency',
    // currency: 'USD'
  })

  if (token === 'MATIC' || token === 'ETH') {
    return currencyFormatter.format(value)
  }

  return `$${currencyFormatter.format(value)}`
}

function getUrl (chain) {
  return `https://api.thegraph.com/subgraphs/name/hop-protocol/hop-${chain}`
}

async function queryFetch (url, query, variables) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      query,
      variables: variables || {}
    })
  })
  const jsonRes = await res.json()
  return jsonRes.data
}

async function fetchDailyVolume (chain, token, startDate, endDate) {
  const query = `
    query DailyVolume($token: String, $startDate: Int, $endDate: Int) {
      dailyVolumes(
        where: {
          token: $token,
          date_gte: $startDate,
          date_lte: $endDate
        },
        orderBy: date,
        orderDirection: desc,
        first: 1000
      ) {
        id
        amount
        token
        date
      }
    }
  `
  const url = getUrl(chain)
  const data = await queryFetch(url, query, {
    token,
    startDate,
    endDate,
  })
  return data.dailyVolumes
}

async function fetchVolume (chain) {
  const query = `
    query Volume {
      volumes(
        orderDirection: desc
      ) {
        id
        amount
        token
      }
    }
  `
  const url = getUrl(chain)
  const data = await queryFetch(url, query)
  return data.volumes
}

async function updateVolume () {
  const [
    xdaiVolume,
    polygonVolume,
    optimismVolume,
    arbitrumVolume,
    mainnetVolume,
    prices
  ] = await Promise.all([
    fetchVolume('xdai'),
    fetchVolume('polygon'),
    fetchVolume('optimism'),
    fetchVolume('arbitrum'),
    fetchVolume('mainnet'),
    getUsdPrices()
  ])

  const xdai = formatVolume(xdaiVolume, prices)
  const polygon = formatVolume(polygonVolume, prices)
  const optimism = formatVolume(optimismVolume, prices)
  const arbitrum = formatVolume(arbitrumVolume, prices)
  const ethereum = formatVolume(mainnetVolume, prices)

  const totalAmount = xdai.amount + polygon.amount + optimism.amount + arbitrum.amount + ethereum.amount
  const total = {
    amount: totalAmount,
    formattedAmount: formatCurrency(totalAmount)
  }

  const volume = {
    xdai,
    polygon,
    optimism,
    arbitrum,
    ethereum,
    total
  }

  return volume
}

const enabledTokens = {
  USDC: true,
  USDT: true,
  DAI: true,
  MATIC: true,
  ETH: true,
}

async function getUsdPrices () {
  const baseUrl = 'https://api.coingecko.com/api/v3'
  const tokens = {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    MATIC: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0',
    ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
  }
  const base = 'usd'
  const addresses = Object.values(tokens)
  const params = {
    contract_addresses: addresses.join(','),
    vs_currencies: base,
    include_market_cap: false,
    include_24hr_vol: false,
    include_24hr_change: false,
    include_last_updated_at: false
  }

  let qs = ''
  for (const key in params) {
    qs += `${key}=${params[key]}&`
  }

  const url = `${baseUrl}/simple/token_price/ethereum?${qs}`
  const res = await fetch(url)
  const json = await res.json()
  const prices = {}

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]
    const token = Object.keys(tokens).find(key => tokens[key] === address)
    try {
      const item = json[address.toLowerCase()]
      if (!item) {
        throw new Error('not found')
      }

      const price = Number(item[base])
      prices[token] = price
    } catch (err) {
      console.error(err)
      prices[token] = 1
    }
  }

  return prices
}

async function poll () {
  const counter = document.getElementById('counter')
  const volume = await updateVolume()
  counter.innerText = volume.total.formattedAmount
}

function sumAmounts(items) {
  let sum = ethers.BigNumber.from(0)
  for (let item of items) {
    amount = ethers.BigNumber.from(item.amount)
    sum = sum.add(amount)
  }
  return sum
}

function nearestDate (dates, target) {
  if (!target) target = Date.now()
  else if (target instanceof Date) target = target.getTime()

  var nearest = Infinity
  var winner = -1

  dates.forEach(function (date, index) {
    if (date instanceof Date) date = date.getTime()
    var distance = Math.abs(date - target)
    if (distance < nearest) {
      nearest = distance
      winner = index
    }
  })

  return winner
}

function getPriceHistory(name) {
  const url = `https://api.coingecko.com/api/v3/coins/${name}/market_chart?vs_currency=usd&days=30&interval=daily`
  return fetch(url)
    .then(res => res.json())
    .then(json => json.prices)
}

async function logDailyVolumes() {
  const pricesArr = await Promise.all([
    getPriceHistory('ethereum'),
    getPriceHistory('matic-network')
  ])
  const prices = {
    ETH: pricesArr[0],
    MATIC: pricesArr[1]
  }

  const tokens = ['USDC', 'USDT', 'DAI', 'MATIC', 'ETH']
  const chains = ['polygon', 'xdai', 'arbitrum', 'optimism']
  const days = [1, 7, 30]

  const now = Math.floor(luxon.DateTime.utc().toSeconds())
  const dayId = Math.floor(now / 86400)

  for (let numDays of days) {
    const startDate = (dayId - numDays) * 86400
    const endDate = dayId * 86400

    for (let chain of chains) {
      for (let token of tokens) {
        let price = 1
        if (!['USDC', 'USDT', 'DAI'].includes(token)) {
          const dates = prices[token].reverse().map(x => x[0])
          const nearest = nearestDate(dates, startDate * 1000)
          price = prices[token][nearest][1]
        }

        const items = await fetchDailyVolume(chain, token, startDate, endDate)
        const amount = sumAmounts(items)
        const decimals = tokenDecimals[token]
        const fmt = ethers.utils.formatUnits(amount, decimals)
        const formattedAmount = formatCurrency(fmt, token)
        const usdAmount = formatCurrency(price * Number(fmt))
        console.log(`last ${numDays} day(s) ${chain} ${token} ${formattedAmount} (${usdAmount})`)
      }
    }
  }
}

async function runPoller() {
  const fetchInterval = 10 * 1000
  while (true) {
    try {
      await poll()
      await new Promise((resolve) => setTimeout(() => resolve(null), fetchInterval))
    } catch (err) {
      console.error(err)
    }
  }
}

async function main () {
  runPoller()
  logDailyVolumes()
}

main()
