export interface TokenBalance {
	symbol: string
	balance: string
	balanceUSD: string
	price: string
	platform: string
	metrics?: {
		apy?: number
	}
}

export interface AccountBalances {
	balances: TokenBalance[]
}

export interface YieldMetrics {
	apy: number
	volumeUsd1d: string
	volumeUsd7d: string
}

export interface YieldOpportunity {
	name: string
	metrics: YieldMetrics
}

export interface MarketData {
	usdc: {
		tokens: YieldOpportunity[]
	}
}

export interface PositionQuery {
	protocol: string
	token: string
}

export interface PositionData {
	protocol: string
	token: string
	data: YieldOpportunity[]
}

// StakeKit specific types
export interface StakeKitToken {
	token: {
		name: string
		symbol: string
		decimals: number
		network: string
		address?: string
		logoURI?: string
		coinGeckoId?: string
	}
	amount: string
	availableYields?: string[]
}

export interface StakeKitProvider {
	id: string
	name: string
	externalLink: string
	description: string
	logoURI: string
	tvl?: string
}

export interface StakeKitMetadata {
	name: string
	logoURI: string
	description: string
	documentation: string
	provider: StakeKitProvider
	token: StakeKitToken
	type: string
}

export interface StakeKitYield {
	id: string
	token: {
		name: string
		symbol: string
		decimals: number
		network: string
		address: string
		logoURI?: string
		coinGeckoId?: string
	}
	tokens: {
		name: string
		symbol: string
		decimals: number
		network: string
		address: string
		logoURI?: string
		coinGeckoId?: string
	}[]
	apy: number
	metadata: StakeKitMetadata
	isAvailable: boolean
}

export interface StakeKitResponse<T> {
	data: T
	hasNextPage: boolean
	limit: number
	page: number
}
