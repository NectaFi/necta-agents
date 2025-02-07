import type { Hex } from 'viem'
import env from '../env'
import { getChainConfig } from '../config/chains'
import type {
	AccountBalances,
	MarketData,
	PositionData,
	StakeKitBalance,
	StakeKitYield,
} from './types'

const STAKEKIT_API_URL = 'https://api.stakek.it/v1'

/**
 * @dev Gets the balances of an account including yield positions
 * @param owner - The owner of the account
 * @returns The balances of the account
 */
export const getAccountBalances = async (owner: Hex): Promise<AccountBalances> => {
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))
	const url = `${STAKEKIT_API_URL}/tokens/balances`

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': env.STAKEKIT_API_KEY,
		},
		body: JSON.stringify({
			address: owner,
			chainId: chainConfig.id,
		}),
	})

	const data = await response.json()
	return {
		balances: (data.data || []).map((balance: StakeKitBalance) => ({
			symbol: balance.token.symbol,
			balance: balance.amount,
			balanceUSD: balance.amountUSD,
			price: balance.token.priceUSD,
			platform: balance.protocol?.name || 'native',
			metrics: {
				apy: balance.protocol?.apy || 0,
			},
		})),
	}
}

/**
 * @dev Gets the market data for yield opportunities
 * @returns The market data for yield opportunities
 */
export const getMarketData = async (
	minApy: number = 3,
	maxApy: number = 60
): Promise<MarketData> => {
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))
	const url = `${STAKEKIT_API_URL}/yields`

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'X-API-Key': env.STAKEKIT_API_KEY,
		},
	})

	const data = await response.json()
	return {
		usdc: {
			tokens: (data.data || [])
				.filter(
					(yieldData: StakeKitYield) =>
						yieldData.apy >= minApy &&
						yieldData.apy <= maxApy &&
						yieldData.protocol.name.toLowerCase().includes('usdc')
				)
				.map((yieldData: StakeKitYield) => ({
					name: yieldData.protocol.name,
					metrics: {
						apy: yieldData.apy,
						volumeUsd1d: yieldData.protocol.tvl,
						volumeUsd7d: yieldData.protocol.tvl,
					},
				})),
		},
	}
}

/**
 * @dev Gets the market data for multiple protocol/token combinations
 * @param queries - Array of {protocol, token} pairs to check
 * @param minLiquidity - Minimum liquidity threshold
 * @param minApy - Minimum APY threshold
 * @param maxApy - Maximum APY threshold
 * @returns The market data for the specified positions
 */
export const getPositionData = async (
	queries: Array<{ protocol: string; token: string }>,
	minLiquidity: number = 10000000,
	minApy: number = 3,
	maxApy: number = 60
): Promise<PositionData[]> => {
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))

	const results = await Promise.all(
		queries.map(async ({ protocol, token }) => {
			const url = `${STAKEKIT_API_URL}/yields`

			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': env.STAKEKIT_API_KEY,
				},
			})

			const data = await response.json()
			return {
				protocol,
				token,
				data: (data.data || [])
					.filter(
						(yieldData: StakeKitYield) =>
							yieldData.apy >= minApy &&
							yieldData.apy <= maxApy &&
							yieldData.protocol.name
								.toLowerCase()
								.includes(protocol.toLowerCase()) &&
							yieldData.protocol.name.toLowerCase().includes(token.toLowerCase())
					)
					.map((yieldData: StakeKitYield) => ({
						name: yieldData.protocol.name,
						metrics: {
							apy: yieldData.apy,
							volumeUsd1d: yieldData.protocol.tvl,
							volumeUsd7d: yieldData.protocol.tvl,
						},
					})),
			}
		})
	)
	return results
}
