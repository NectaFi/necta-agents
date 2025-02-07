import { expect, test, describe } from 'bun:test'
import { getChainConfig, validateChainId, SUPPORTED_CHAINS, getSupportedChains } from './chains'

describe('Chain Configuration', () => {
	test('Base chain (8453) should be supported and enabled', () => {
		expect(validateChainId(8453)).toBe(true)
		const config = getChainConfig(8453)
		expect(config.name).toBe('base')
		expect(config.displayName).toBe('Base')
		expect(config.enabled).toBe(true)
	})

	test('Arbitrum chain (42161) should be supported and enabled', () => {
		expect(validateChainId(42161)).toBe(true)
		const config = getChainConfig(42161)
		expect(config.name).toBe('arbitrum')
		expect(config.displayName).toBe('Arbitrum')
		expect(config.enabled).toBe(true)
	})

	test('Unsupported chain should return false for validation', () => {
		expect(validateChainId(999999)).toBe(false)
	})

	test('getChainConfig should throw for unsupported chain', () => {
		expect(() => getChainConfig(999999)).toThrow('Chain 999999 not supported or not enabled')
	})

	test('Base chain config should have correct Portals configuration', () => {
		const config = getChainConfig(8453)
		expect(config.portals.networkId).toBe('base')
		expect(config.minLiquidity).toBe(10_000_000)
		expect(config.minEthBalance).toBe('0.002')
	})

	test('Arbitrum chain config should have correct Portals configuration', () => {
		const config = getChainConfig(42161)
		expect(config.portals.networkId).toBe('arbitrum')
		expect(config.minLiquidity).toBe(10_000_000)
		expect(config.minEthBalance).toBe('0.002')
	})

	test('getSupportedChains should return all enabled chains', () => {
		const chains = getSupportedChains()
		expect(chains.length).toBe(2)
		expect(chains.map((c) => c.name).sort()).toEqual(['arbitrum', 'base'])
	})
})
