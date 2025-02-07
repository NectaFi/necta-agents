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
	symbol: string
	priceUSD: string
}

export interface StakeKitProtocol {
	name: string
	apy: number
	tvl: string
}

export interface StakeKitBalance {
	token: StakeKitToken
	amount: string
	amountUSD: string
	protocol?: StakeKitProtocol
}

export interface StakeKitYield {
	protocol: StakeKitProtocol
	apy: number
}
