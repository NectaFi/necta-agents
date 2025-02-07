import { expect, test, describe } from 'bun:test'
import { getAccountBalances, getMarketData, getPositionData } from './stakekit'
import env from '../env'

// Test wallet address from our env
const TEST_ADDRESS = env.PRIVATE_KEY as `0x${string}`

describe('StakeKit Integration', () => {
	test('should fetch account balances', async () => {
		const result = await getAccountBalances(TEST_ADDRESS)

		expect(result).toBeDefined()
		expect(result.balances).toBeArray()

		if (result.balances.length > 0) {
			const balance = result.balances[0]
			expect(balance).toHaveProperty('symbol')
			expect(balance).toHaveProperty('balance')
			expect(balance).toHaveProperty('balanceUSD')
			expect(balance).toHaveProperty('price')
			expect(balance).toHaveProperty('platform')
		}
	}, 10000) // 10 second timeout

	test('should fetch USDC market data', async () => {
		try {
			const result = await getMarketData()

			expect(result).toBeDefined()
			expect(result.usdc).toBeDefined()
			expect(result.usdc.tokens).toBeArray()

			if (result.usdc.tokens.length > 0) {
				const opportunity = result.usdc.tokens[0]
				expect(opportunity).toHaveProperty('name')
				expect(opportunity.metrics).toHaveProperty('apy')
				expect(opportunity.metrics).toHaveProperty('volumeUsd1d')
				expect(opportunity.metrics).toHaveProperty('volumeUsd7d')
			}
		} catch (error) {
			console.error('Market data fetch error:', error)
			throw error
		}
	}, 10000) // 10 second timeout

	test('should fetch position data for specific protocols', async () => {
		try {
			const queries = [
				{ protocol: 'aave-v3', token: 'USDC' },
				{ protocol: 'compound-v3', token: 'USDC' },
			]

			const results = await getPositionData(queries)

			expect(results).toBeArray()
			expect(results).toHaveLength(2)

			results.forEach((result) => {
				expect(result).toHaveProperty('protocol')
				expect(result).toHaveProperty('token')
				expect(result).toHaveProperty('data')
				expect(result.data).toBeArray()

				if (result.data.length > 0) {
					const opportunity = result.data[0]
					expect(opportunity).toHaveProperty('name')
					expect(opportunity.metrics).toHaveProperty('apy')
					expect(opportunity.metrics).toHaveProperty('volumeUsd1d')
					expect(opportunity.metrics).toHaveProperty('volumeUsd7d')
				}
			})
		} catch (error) {
			console.error('Position data fetch error:', error)
			throw error
		}
	}, 10000) // 10 second timeout

	test('should handle API errors gracefully', async () => {
		try {
			// Test with invalid protocol
			const queries = [{ protocol: 'invalid-protocol', token: 'USDC' }]

			const results = await getPositionData(queries)
			expect(results).toBeArray()
			expect(results[0].data).toBeArray()
			expect(results[0].data).toHaveLength(0)
		} catch (error) {
			console.error('Error handling test error:', error)
			throw error
		}
	}, 10000) // 10 second timeout
})
