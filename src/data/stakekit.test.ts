import { expect, test, describe } from 'bun:test'
import { getAccountBalances, getMarketData, getPositionData } from './stakekit'
import env from '../env'
import { getChainConfig } from '../config/chains'

// Test wallet address from our env
const TEST_ADDRESS = env.PRIVATE_KEY as `0x${string}`
const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))

describe('StakeKit Integration', () => {
	test('should fetch account tokens and yields', async () => {
		try {
			const result = await getAccountBalances(chainConfig, TEST_ADDRESS)

			expect(result).toBeDefined()
			expect(result.balances).toBeArray()

			// Test passes even if no balances are returned
			if (result.balances.length > 0) {
				const balance = result.balances[0]
				expect(balance).toHaveProperty('symbol')
				expect(balance).toHaveProperty('balance')
				expect(balance).toHaveProperty('platform')
				expect(balance).toHaveProperty('metrics')
				expect(balance.metrics).toBeDefined()
				expect(balance.metrics?.apy).toBeDefined()

				// Verify types
				expect(typeof balance.symbol).toBe('string')
				expect(typeof balance.balance).toBe('string')
				expect(typeof balance.platform).toBe('string')
				expect(typeof balance.metrics?.apy).toBe('number')
			}
		} catch (error) {
			// If the API is unavailable, the test should pass
			if (error instanceof Error && error.message.includes('503 Service Unavailable')) {
				console.warn('StakeKit API is temporarily unavailable')
				return
			}
			throw error
		}
	}, 20000) // Increased timeout to 20 seconds

	test('should fetch USDC market data', async () => {
		const result = await getMarketData(chainConfig)

		expect(result).toBeDefined()
		expect(result.usdc).toBeDefined()
		expect(result.usdc.tokens).toBeArray()

		// If we have yield data, verify its structure
		if (result.usdc.tokens.length > 0) {
			const yieldData = result.usdc.tokens[0]
			expect(yieldData).toHaveProperty('name')
			expect(yieldData).toHaveProperty('metrics')
			expect(yieldData.metrics).toHaveProperty('apy')
			expect(yieldData.metrics).toHaveProperty('volumeUsd1d')
			expect(yieldData.metrics).toHaveProperty('volumeUsd7d')

			// Verify types
			expect(typeof yieldData.name).toBe('string')
			expect(typeof yieldData.metrics.apy).toBe('number')
			expect(typeof yieldData.metrics.volumeUsd1d).toBe('string')
			expect(typeof yieldData.metrics.volumeUsd7d).toBe('string')
		}

		console.log('Market data result:', JSON.stringify(result, null, 2))
	}, 10000)

	test('should fetch position data for specific protocols', async () => {
		const queries = [
			{ protocol: 'aave', token: 'USDC' },
			{ protocol: 'compound', token: 'USDC' },
		]

		const results = await getPositionData(queries)

		expect(results).toBeArray()
		expect(results).toHaveLength(2)

		results.forEach((result) => {
			expect(result).toHaveProperty('protocol')
			expect(result).toHaveProperty('token')
			expect(result).toHaveProperty('data')
			expect(result.data).toBeArray()

			// If we have data, verify its structure
			if (result.data.length > 0) {
				const position = result.data[0]
				expect(position).toHaveProperty('name')
				expect(position).toHaveProperty('metrics')
				expect(position.metrics).toHaveProperty('apy')
				expect(position.metrics).toHaveProperty('volumeUsd1d')
				expect(position.metrics).toHaveProperty('volumeUsd7d')
			}

			console.log('Position data result:', JSON.stringify(result, null, 2))
		})
	}, 10000)

	test('should handle API errors gracefully', async () => {
		const queries = [{ protocol: 'invalid-protocol', token: 'USDC' }]

		const results = await getPositionData(queries)
		expect(results).toBeArray()
		expect(results[0].data).toBeArray()
		expect(results[0].data).toHaveLength(0)
	}, 10000)
})
