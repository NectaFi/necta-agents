import { z } from 'zod'

/**
 * Chain Configuration System
 *
 * This configuration supports both development and production environments:
 *
 * Development:
 * - Chain selection through environment variables
 * - Single chain operation for testing
 *
 * Production/UI:
 * - Chain selection through UI dropdown
 * - Uses getSupportedChains() for available options
 * - Dynamic chain switching without env changes
 */

/**
 * Chain configuration schema
 * Used to validate and type chain configurations
 */
const chainConfigSchema = z.object({
	id: z.number(),
	name: z.string(),
	displayName: z.string(), // Used in UI for chain selection
	enabled: z.boolean(), // Controls availability in UI and validation
	minLiquidity: z.number(),
	minEthBalance: z.string(),
	portals: z.object({
		networkId: z.string(),
	}),
})

export type ChainConfig = z.infer<typeof chainConfigSchema>

/**
 * Currently supported chains
 * Add new chains here to make them available in the system
 */
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
	8453: {
		id: 8453,
		name: 'base',
		displayName: 'Base',
		enabled: true,
		minLiquidity: 10_000_000,
		minEthBalance: '0.002',
		portals: {
			networkId: 'base',
		},
	},
	42161: {
		id: 42161,
		name: 'arbitrum',
		displayName: 'Arbitrum',
		enabled: true,
		minLiquidity: 10_000_000,
		minEthBalance: '0.002',
		portals: {
			networkId: 'arbitrum',
		},
	},
}

/**
 * Get chain configuration by chain ID
 * Used internally by the system to validate and get chain settings
 */
export function getChainConfig(chainId: number): ChainConfig {
	const config = SUPPORTED_CHAINS[chainId]
	if (!config || !config.enabled) {
		throw new Error(`Chain ${chainId} not supported or not enabled`)
	}
	return config
}

/**
 * Validate if a chain ID is supported and enabled
 * Used for environment validation and UI chain selection
 */
export function validateChainId(chainId: number): boolean {
	return SUPPORTED_CHAINS[chainId]?.enabled ?? false
}

/**
 * Get all supported and enabled chains
 * Used by UI to populate chain selection dropdown
 * Returns only enabled chains for production use
 */
export function getSupportedChains(): ChainConfig[] {
	return Object.values(SUPPORTED_CHAINS).filter((chain) => chain.enabled)
}
