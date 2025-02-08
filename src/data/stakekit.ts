import type {
	AccountBalances,
	MarketData,
	PositionData,
	StakeKitToken,
	StakeKitYield,
	StakeKitResponse,
} from './types'
import env from '../env'
import { getChainConfig } from '../config/chains'

const STAKEKIT_API_URL = 'https://api.stakek.it'

const DEFAULT_HEADERS = {
	'X-API-KEY': env.STAKEKIT_API_KEY,
	'Content-Type': 'application/json',
}

/**
 * Helper function to make StakeKit API calls with consistent error handling
 */
async function fetchStakeKit<T>(endpoint: string, options = {}): Promise<StakeKitResponse<T[]>> {
	try {
		const response = await fetch(`${STAKEKIT_API_URL}${endpoint}`, {
			headers: DEFAULT_HEADERS,
			...options,
		})

		if (!response.ok) {
			console.warn(`StakeKit API error: ${response.status} ${response.statusText}`)
			return { data: [], hasNextPage: false, limit: 0, page: 0 }
		}

		return await response.json()
	} catch (error) {
		console.error(`Error fetching ${endpoint}:`, error)
		return { data: [], hasNextPage: false, limit: 0, page: 0 }
	}
}

// Helper for filtering USDC tokens
const isUSDC = (symbol: string) => ['usdc', 'usdbc', 'usdc.e'].includes(symbol.toLowerCase())

/**
 * @dev Gets the balances of an account including yield positions
 * @param chainConfig - The chain configuration
 * @param owner - The owner address
 * @returns The balances of the account
 */
export async function getAccountBalances(
	chainConfig: { name: string },
	owner: string
): Promise<AccountBalances> {
	const balanceData = await fetchStakeKit<StakeKitToken>('/v1/tokens/balances', {
		method: 'POST',
		body: JSON.stringify({
			addresses: [{ network: chainConfig.name, address: owner }],
		}),
	})

	return {
		balances: (balanceData?.data || []).map((token) => ({
			symbol: token.token.symbol,
			balance: token.amount || '0',
			balanceUSD: '0',
			price: '0',
			platform: 'native',
			metrics: { apy: 0 },
		})),
	}
}

/**
 * @dev Gets the market data for yield opportunities
 * @param chainConfig - The chain configuration
 * @returns The market data for yield opportunities
 */
export async function getMarketData(chainConfig: { name: string }): Promise<MarketData> {
	const data = await fetchStakeKit<StakeKitYield>(
		`/v2/yields?type=lending&network=${chainConfig.name}`
	)

	const usdcYields = (data?.data || [])
		.filter((yieldData) => isUSDC(yieldData.token?.symbol || ''))
		.sort((a, b) => b.apy - a.apy)
		.map((yieldData) => ({
			name: `${yieldData.metadata.provider.name} ${yieldData.token.symbol}`,
			metrics: {
				apy: yieldData.apy * 100,
				volumeUsd1d: yieldData.metadata.provider.tvl || '0',
				volumeUsd7d: yieldData.metadata.provider.tvl || '0',
			},
		}))

	return { usdc: { tokens: usdcYields } }
}

/**
 * @dev Gets the market data for multiple protocol/token combinations
 * @param queries - Array of {protocol, token} pairs to check
 * @param minLiquidity - Minimum liquidity threshold
 * @param minApy - Minimum APY threshold
 * @param maxApy - Maximum APY threshold
 * @returns The market data for the specified positions
 */
export async function getPositionData(
	queries: Array<{ protocol: string; token: string }>,
	minLiquidity: number = 10000000,
	minApy: number = 3,
	maxApy: number = 60
): Promise<PositionData[]> {
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))

	const results = await Promise.all(
		queries.map(async ({ protocol, token }) => {
			const data = await fetchStakeKit<StakeKitYield>(
				`/v2/yields?type=lending&network=${chainConfig.name}`
			)

			return {
				protocol,
				token,
				data: (data?.data || [])
					.filter(
						(yieldData) =>
							yieldData.apy >= minApy / 100 &&
							yieldData.apy <= maxApy / 100 &&
							yieldData.metadata.provider.name
								.toLowerCase()
								.includes(protocol.toLowerCase()) &&
							yieldData.token.symbol.toLowerCase().includes(token.toLowerCase())
					)
					.map((yieldData) => ({
						name: yieldData.metadata.provider.name,
						metrics: {
							apy: yieldData.apy * 100,
							volumeUsd1d: yieldData.metadata.provider.tvl || '0',
							volumeUsd7d: yieldData.metadata.provider.tvl || '0',
						},
					})),
			}
		})
	)
	return results
}
