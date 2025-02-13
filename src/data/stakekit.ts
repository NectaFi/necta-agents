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
import {
	createPublicClient,
	http,
	formatEther,
	formatUnits,
	getContract,
	type PublicClient,
} from 'viem'
import { arbitrum, base } from 'viem/chains'

const STAKEKIT_API_URL = 'https://api.stakek.it'

const DEFAULT_HEADERS = {
	'X-API-KEY': env.STAKEKIT_API_KEY,
	'Content-Type': 'application/json',
}

// Base USDC token address
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

// ERC20 ABI - only what we need for balanceOf
const ERC20_ABI = [
	{
		inputs: [{ name: 'account', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'decimals',
		outputs: [{ name: '', type: 'uint8' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const

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
	// Setup Viem client
	const chain = chainConfig.name === 'arbitrum' ? arbitrum : base
	const publicClient = createPublicClient({
		chain,
		transport: http(),
	})

	// Get native ETH balance
	const ethBalance = await publicClient.getBalance({
		address: owner as `0x${string}`,
	})

	// Get USDC balance using Viem contract
	const usdcContract = getContract({
		address: USDC_ADDRESS,
		abi: ERC20_ABI,
		client: publicClient,
	})

	const [usdcBalance, usdcDecimals] = await Promise.all([
		usdcContract.read.balanceOf([owner as `0x${string}`]),
		usdcContract.read.decimals(),
	])

	return {
		balances: [
			// Add USDC balance
			{
				symbol: 'USDC',
				balance: formatUnits(usdcBalance, usdcDecimals),
				balanceUSD: '0',
				price: '0',
				platform: 'basic',
				metrics: { apy: 0 },
			},
			// Add ETH balance for gas
			{
				symbol: 'ETH',
				balance: formatEther(ethBalance),
				balanceUSD: '0',
				price: '0',
				platform: 'native',
				metrics: { apy: 0 },
			},
		],
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
		.filter(
			(yieldData) => yieldData.token?.address?.toLowerCase() === USDC_ADDRESS.toLowerCase()
		)
		.sort((a, b) => b.apy - a.apy)
		.map((yieldData) => ({
			name: `${yieldData.metadata.provider.name} ${yieldData.token.symbol}`,
			address: yieldData.metadata.provider.id,
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
							yieldData.token.address?.toLowerCase() === USDC_ADDRESS.toLowerCase()
					)
					.map((yieldData) => ({
						name: yieldData.metadata.provider.name,
						address: yieldData.metadata.provider.id,
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
