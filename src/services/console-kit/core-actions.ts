import { ConsoleKit } from 'brahma-console-kit'
import { ethers } from 'ethers'
import type { ConsoleTransactionResponse, TransactionParams } from './types'

// Protocol addresses on Base
export const PROTOCOL_ADDRESSES: Record<string, `0x${string}`> = {
	aave: '0x0595D1Df64279ddB51F1bdC405Fe2D0b4Cc86681' as `0x${string}`, // Aave v3 Pool on Base
}

export async function buildTransaction(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	params: TransactionParams
): Promise<ConsoleTransactionResponse> {
	const { chainId: chainIdBig } = await provider.getNetwork()
	const chainId = parseInt(chainIdBig.toString(), 10)

	// Get protocol contract address - either from mapping or use directly if it's a valid address
	const protocolAddress = params.protocol.startsWith('0x')
		? (params.protocol as `0x${string}`)
		: PROTOCOL_ADDRESSES[params.protocol.toLowerCase()]

	if (!protocolAddress) {
		throw new Error(`Protocol address not found for: ${params.protocol}`)
	}

	// Ensure token address is properly formatted
	if (!params.token.startsWith('0x')) {
		throw new Error(`Invalid token address format: ${params.token}`)
	}

	// Convert amount to wei (6 decimals for USDC)
	const amountInWei = ethers.parseUnits(params.amount, 6).toString()

	console.log('[ConsoleKit] Building transaction with params:', {
		chainId,
		accountAddress: params.accountAddress,
		to: protocolAddress,
		tokenAddress: params.token,
		amount: amountInWei,
	})

	// Use ConsoleKit's core actions for transaction building
	const response = await consoleKit.coreActions.send(
		chainId,
		params.accountAddress as `0x${string}`,
		{
			to: protocolAddress,
			tokenAddress: params.token as `0x${string}`,
			amount: amountInWei,
		}
	)

	return {
		transactions: [
			{
				to: response.data.transactions[0].to as `0x${string}`,
				data: response.data.transactions[0].data as `0x${string}`,
				value: response.data.transactions[0].value || '0',
				operation: 0,
			},
		],
		metadata: response.data.metadata || {},
	}
}

export async function executeTransaction(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	transactionHash: `0x${string}`
) {
	const { chainId: chainIdBig } = await provider.getNetwork()
	const chainId = parseInt(chainIdBig.toString(), 10)

	await consoleKit.coreActions.indexTransaction(transactionHash, chainId)
	console.log('[ConsoleKit] Transaction indexed:', transactionHash)
}
