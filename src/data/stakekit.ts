import type {
	AccountBalances,
	MarketData,
	PositionData,
	TokenBalance,
	YieldOpportunity,
} from './types'
import env from '../env'

// API configuration
const BASE_URL = 'https://api.stakek.it'
const STAKEKIT_API_KEY = env.STAKEKIT_API_KEY

/**
 * Helper function to make API calls to StakeKit
 */
async function fetchStakeKit<T>(endpoint: string, options = {}): Promise<T> {
	const url = `${BASE_URL}${endpoint}`
	const defaultOptions = {
		headers: {
			'Content-Type': 'application/json',
			'X-API-KEY': STAKEKIT_API_KEY,
		},
	}

	const response = await fetch(url, { ...defaultOptions, ...options })

	if (!response.ok) {
		console.warn(`[fetchStakeKit] API error: ${response.status} ${response.statusText}`)
		throw new Error(`StakeKit API error: ${response.status} ${response.statusText}`)
	}

	return response.json()
}

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
	console.log(`[getAccountBalances] Fetching balances for ${owner}...`)

	try {
		// Fetch basic token balances
		const tokenBalancesPayload = [
			{
				network: chainConfig.name,
				address: owner,
			},
			{
				network: chainConfig.name,
				address: owner,
				tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
			},
		]

		const tokenBalancesResponse = await fetchStakeKit<any[]>('/v1/tokens/balances', {
			method: 'POST',
			body: JSON.stringify({ addresses: tokenBalancesPayload }),
		})

		// Fetch yield opportunities to get their IDs
		const yieldsResponse = await fetchStakeKit<{ data: any[] }>(
			`/v2/yields?network=${chainConfig.name}`
		)

		// Filter for relevant yield opportunities (USDC and ETH)
		const relevantYields = yieldsResponse.data.filter(
			(y) => y.token?.symbol === 'USDC' || y.token?.symbol === 'ETH'
		)

		// Prepare payload for yield balances
		const yieldBalancesPayload = relevantYields
			.map((y) => ({
				addresses: { address: owner },
				integrationId: y.id,
			}))
			.slice(0, 20) // Limit to 20 to avoid large payloads

		// Fetch yield positions
		let yieldBalancesResponse: any[] = []
		if (yieldBalancesPayload.length > 0) {
			yieldBalancesResponse = await fetchStakeKit<any[]>('/v1/yields/balances', {
				method: 'POST',
				body: JSON.stringify(yieldBalancesPayload),
			})
		}

		// Process and combine the results
		const balances: TokenBalance[] = []

		// Add basic token balances
		tokenBalancesResponse.forEach((token) => {
			if (parseFloat(token.amount) > 0) {
				balances.push({
					symbol: token.token.symbol,
					balance: token.amount,
					balanceUSD: (parseFloat(token.amount) * (token.token.price || 0)).toString(),
					price: token.token.price?.toString() || '0',
					platform: 'basic',
				})
			}
		})

		// Add yield positions
		yieldBalancesResponse.forEach((position) => {
			if (!position.balances || !Array.isArray(position.balances)) {
				return
			}

			// Find positions with positive balances
			position.balances.forEach((balance: any) => {
				if (balance.type === 'staked' && parseFloat(balance.amount) > 0) {
					const yieldInfo = yieldsResponse.data.find(
						(y) => y.id === position.integrationId
					)

					balances.push({
						symbol: balance.token.symbol,
						balance: balance.amount,
						balanceUSD: (
							parseFloat(balance.amount) * (balance.token.price || 0)
						).toString(),
						price: balance.token.price?.toString() || '0',
						platform: yieldInfo?.metadata?.provider?.name?.toLowerCase() || 'unknown',
						metrics: {
							apy: yieldInfo?.apy ? yieldInfo.apy * 100 : 0,
						},
					})
				}
			})
		})

		console.log(`[getAccountBalances] Found ${balances.length} balances`)
		return { balances }
	} catch (error) {
		console.error(`[getAccountBalances] Error:`, error)
		return { balances: [] }
	}
}

/**
 * @dev Gets market data for various tokens
 * @param chainConfig - The chain configuration
 * @returns Market data for various tokens
 */
export async function getMarketData(chainConfig: { name: string }): Promise<MarketData> {
	console.log(`[getMarketData] Fetching market data...`)

	const opportunitiesMap = new Map<string, YieldOpportunity>()

	try {
		const yieldTypes = ['lending', 'vault']

		for (const yieldType of yieldTypes) {
			console.log(`[getMarketData] Fetching ${yieldType} opportunities...`)

			const response = await fetchStakeKit<{ data: any[] }>(
				`/v2/yields?type=${yieldType}&network=${chainConfig.name}`
			)

			if (response.data && Array.isArray(response.data)) {
				console.log(
					`[getMarketData] Found ${response.data.length} ${yieldType} opportunities`
				)

				response.data
					.filter((item) => item.token?.symbol === 'USDC' && item.apy && item.apy > 0)
					.forEach((item) => {
						const name = `${item.metadata.provider.name} ${item.metadata.name.replace(
							item.metadata.provider.name,
							''
						)}`.trim()
						const key = name.toLowerCase()

						if (
							!opportunitiesMap.has(key) ||
							item.apy > opportunitiesMap.get(key)!.metrics.apy / 100
						) {
							opportunitiesMap.set(key, {
								name,
								address: item.metadata.provider.id,
								metrics: {
									apy: item.apy * 100,
									volumeUsd1d: item.metadata.provider.tvl || '0',
									volumeUsd7d: item.metadata.provider.tvl || '0',
								},
							})
						}
					})
			}
		}
	} catch (error) {
		console.error(`[getMarketData] Error:`, error)
	}

	const opportunities = Array.from(opportunitiesMap.values()).sort(
		(a, b) => b.metrics.apy - a.metrics.apy
	)

	console.log(`[getMarketData] Found ${opportunities.length} unique USDC opportunities`)
	return {
		usdc: {
			tokens: opportunities,
		},
	}
}

/**
 * @dev Gets position data for specific protocols and tokens
 * @param queries - Array of protocol and token queries
 * @param minLiquidity - Minimum liquidity
 * @param minApy - Minimum APY
 * @param maxApy - Maximum APY
 * @returns Position data for specific protocols and tokens
 */
export async function getPositionData(
	queries: Array<{ protocol: string; token: string }>,
	minLiquidity: number = 10000000,
	minApy: number = 3,
	maxApy: number = 60
): Promise<PositionData[]> {
	console.log(`[getPositionData] Fetching position data for ${queries.length} queries...`)

	const results: PositionData[] = []

	try {
		const marketData = await getMarketData({ name: 'base' })

		for (const { protocol, token } of queries) {
			console.log(`[getPositionData] Processing query: ${protocol} ${token}`)

			const filteredOpportunities = marketData.usdc.tokens.filter((opportunity) =>
				opportunity.name.toLowerCase().includes(protocol.toLowerCase())
			)

			results.push({
				protocol,
				token,
				data: filteredOpportunities,
			})
		}
	} catch (error) {
		console.error(`[getPositionData] Error:`, error)
	}

	return results
}
