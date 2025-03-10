import { getAccountBalances, getMarketData, getPositionData } from './stakekit'

/**
 * Test script for StakeKit full implementation
 *
 * This script tests the main functionality of the StakeKit implementation:
 * - getAccountBalances: Fetches token balances and yield positions
 * - getMarketData: Fetches market data for USDC opportunities
 * - getPositionData: Fetches position data for specific protocols and tokens
 */
async function main() {
	console.log('Testing StakeKit Full Implementation...')

	const chainConfig = { name: 'base' }
	const testAddress = '0xA44Fa8Ad3e905C8AB525cd0cb14319017F1e04e5'

	console.log('\n=== Testing getAccountBalances ===')
	console.log(`Fetching balances for ${testAddress}...`)
	const balances = await getAccountBalances(chainConfig, testAddress)

	console.log('This is the current status of the wallet:')

	// Display token balances
	const tokenBalances = balances.balances
		.filter((balance) => balance.platform === 'basic')
		.map(
			(balance) =>
				`[${balance.symbol}] balance: ${balance.balance} ($${balance.balanceUSD}) - price: $${balance.price}`
		)
		.join('\n')

	// Display position balances
	const positionBalances = balances.balances
		.filter((balance) => balance.platform !== 'basic')
		.map(
			(balance) =>
				`[${balance.symbol}] balance: ${balance.balance} ($${
					balance.balanceUSD
				}) on protocol ${balance.platform} with APY ${balance.metrics?.apy || 0}%`
		)
		.join('\n')

	console.log('Tokens:')
	console.log(tokenBalances || 'No token balances found')
	console.log('Open positions:')
	console.log(positionBalances || 'No open positions found')

	console.log('\n=== Testing getMarketData ===')
	console.log('Fetching market data...')
	const marketData = await getMarketData(chainConfig)

	console.log('These are the current market opportunities:')
	console.log('\nUSCD Opportunities:')

	if (marketData.usdc.tokens.length > 0) {
		marketData.usdc.tokens.forEach((opportunity) => {
			console.log(
				`[${opportunity.name}] APY: ${opportunity.metrics.apy}% - volume 1d: $${opportunity.metrics.volumeUsd1d} - volume 7d: $${opportunity.metrics.volumeUsd7d}`
			)
		})
	} else {
		console.log('No USDC opportunities found')
	}

	console.log('\n=== Testing getPositionData ===')
	console.log('Fetching position data...')
	const positionData = await getPositionData([
		{ protocol: 'morpho', token: 'usdc' },
		{ protocol: 'aave', token: 'usdc' },
	])

	console.log('Position data results:')
	positionData.forEach((position) => {
		console.log(
			`\n${position.protocol.toUpperCase()} ${position.token.toUpperCase()} opportunities:`
		)
		if (position.data.length > 0) {
			position.data.forEach((opportunity) => {
				console.log(`[${opportunity.name}] APY: ${opportunity.metrics.apy}%`)
			})
		} else {
			console.log(`No ${position.protocol} ${position.token} opportunities found`)
		}
	})
}

// Run the test
main().catch((error) => {
	console.error('Error in test script:', error)
	process.exit(1)
})
