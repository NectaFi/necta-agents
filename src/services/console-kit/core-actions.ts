import { ConsoleKit } from 'brahma-console-kit'
import { ethers } from 'ethers'
import type { ConsoleTransactionResponse, TransactionParams } from './types'

export async function buildTransaction(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	params: TransactionParams
): Promise<ConsoleTransactionResponse> {
	const { chainId: chainIdBig } = await provider.getNetwork()
	const chainId = parseInt(chainIdBig.toString(), 10)

	// Use ConsoleKit's core actions for transaction building
	const response = await consoleKit.coreActions.send(
		chainId,
		params.accountAddress as `0x${string}`,
		{
			to: params.protocol.toLowerCase() as `0x${string}`,
			tokenAddress: params.token.toLowerCase() as `0x${string}`,
			amount: params.amount,
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
