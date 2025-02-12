import type { Address } from 'brahma-console-kit'

export interface ExecutorMetadata {
	name: string
	logo: string
	metadata: Record<string, any>
}

export interface ConsoleTransaction {
	to: `0x${string}`
	data: `0x${string}`
	value: string
	operation: number
}

export interface ConsoleTransactionResponse {
	transactions: ConsoleTransaction[]
	metadata: any
}

export interface ConsoleActionParams {
	protocol: string
	token: string
	amount: string
}

export interface TransactionParams {
	accountAddress: string
	type: 'DEPOSIT' | 'WITHDRAW' | 'SWAP'
	protocol: string
	token: string
	amount: string
}
