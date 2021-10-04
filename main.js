
function formatVolume (volumes, prices) {
  let amount = 0
  for (const volume of volumes) {
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

async function main () {
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

main()
