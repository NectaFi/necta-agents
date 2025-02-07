import * as chains from 'viem/chains'
import { getChainConfig } from '../config/chains'

export const getChain = (chainId: number) => {
	// First validate chain is supported in our config
	getChainConfig(chainId)
	// Then get viem chain info
	return Object.values(chains).find((chain) => chain.id === chainId)
}
