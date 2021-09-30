
function formatVolume (volumes) {
  let amount = 0
  for (const volume of volumes) {
    const decimals = tokenDecimals[volume.token]
    const rawAmount = ethers.BigNumber.from(volume.amount)
    const _amount = Number(ethers.utils.formatUnits(rawAmount, decimals))
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
    mainnetVolume
  ] = await Promise.all([
    fetchVolume('xdai'),
    fetchVolume('polygon'),
    fetchVolume('optimism'),
    fetchVolume('arbitrum'),
    fetchVolume('mainnet')
  ])

  const xdai = formatVolume(xdaiVolume)
  const polygon = formatVolume(polygonVolume)
  const optimism = formatVolume(optimismVolume)
  const arbitrum = formatVolume(arbitrumVolume)
  const ethereum = formatVolume(mainnetVolume)

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

async function poll() {
  const counter = document.getElementById('counter')
  const volume = await updateVolume()
  counter.innerText = volume.total.formattedAmount
}

async function main() {
  const fetchInterval = 10 * 1000
  while (true) {
    try {
      await poll()
      await new Promise((resolve) => setTimeout(() => resolve(null), fetchInterval))
    } catch(err){
      console.error(err)
    }
  }
}

main()

