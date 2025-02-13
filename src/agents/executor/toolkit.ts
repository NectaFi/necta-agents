import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { Account } from 'viem'
import { z } from 'zod'
import env from '../../env'
import { deleteTask, retrieveTaskById, storeTask, updateTask } from '../../memory'
import { createPublicClient, createWalletClient, formatUnits, http } from 'viem'
import { getChain } from '../../utils/chain'
import { getMarketData, getPositionData } from '../../data'
import { ConsoleKitService } from '../../services/console-kit/index'
import { getChainConfig } from '../../config/chains'
import { PROTOCOL_ADDRESSES } from '../../services/console-kit/core-actions'

// Base USDC token address
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

export const getTransactionDataTool = (account: Account) =>
	tool({
		description:
			'A tool that transforms the tasks into transactions and prepares them for execution.',
		parameters: z.object({
			tasks: z.array(
				z.object({
					task: z.string(),
					taskId: z.string().nullable(),
				})
			),
		}),
		execute: async ({ tasks }) => {
			console.log('======== getTransactionData Tool =========')
			const consoleKit = new ConsoleKitService()

			const transactions = await Promise.all(
				tasks.map(async ({ task, taskId }) => {
					console.log(`[getTransactionData] Building transaction for task: "${task}"`)
					try {
						// Parse task to get amount and action
						const match = task.match(
							/(?:Swap|Deposit|Withdraw)\s+(\d+(?:\.\d+)?)\s+(\w+)(?:\s+(?:for|into|from)\s+(.+))$/
						)
						if (!match) {
							console.error(`Invalid task format: ${task}`)
							return null
						}

						const [_, amount, token, target] = match
						const type = task.toLowerCase().startsWith('swap')
							? 'SWAP'
							: task.toLowerCase().startsWith('deposit')
							? 'DEPOSIT'
							: 'WITHDRAW'

						// Get protocol address from market data
						const marketData = await getMarketData(
							getChainConfig(parseInt(env.CHAIN_ID))
						)
						console.log(
							'[getTransactionData] Available protocols:',
							marketData.usdc.tokens.map((p) => p.name)
						)
						console.log('[getTransactionData] Looking for protocol containing:', target)

						// Find exact protocol match
						const protocol = marketData.usdc.tokens.find(
							(p) =>
								p.name.toLowerCase() === target?.toLowerCase() ||
								p.name.toLowerCase().includes(target?.toLowerCase() || '')
						)

						if (!protocol) {
							console.error(
								`Protocol "${target}" not found in market data. Available protocols: ${marketData.usdc.tokens
									.map((p) => p.name)
									.join(', ')}`
							)
							return null
						}
						console.log('[getTransactionData] Found protocol:', protocol)

						// Get the actual protocol contract address
						const protocolAddress = protocol.address.startsWith('0x')
							? (protocol.address as `0x${string}`)
							: PROTOCOL_ADDRESSES[protocol.address.toLowerCase()]

						if (!protocolAddress) {
							console.error(
								`No contract address found for protocol "${target}" (ID: ${protocol.address})`
							)
							return null
						}

						console.log('[getTransactionData] Using protocol address:', protocolAddress)

						const txResponse = await consoleKit.buildTransaction({
							accountAddress: account.address,
							type,
							protocol: protocolAddress,
							token: USDC_ADDRESS,
							amount,
						})

						// Store task with transaction data and metadata
						const taskData = taskId
							? await updateTask(
									taskId,
									task,
									txResponse.transactions,
									{ symbol: token, address: USDC_ADDRESS }, // fromToken
									{ symbol: target || '', address: protocolAddress }, // toToken
									amount, // fromAmount
									'' // toAmount (optional)
							  )
							: await storeTask(
									task,
									txResponse.transactions,
									{ symbol: token, address: USDC_ADDRESS }, // fromToken
									{ symbol: target || '', address: protocolAddress }, // toToken
									amount // fromAmount
							  )

						// Extract task ID from response data
						const storedTaskId = taskData.data?.[0]?.id

						if (!storedTaskId) {
							throw new Error('Failed to store task')
						}

						return {
							task,
							taskId: storedTaskId,
							transactions: txResponse.transactions,
						}
					} catch (error) {
						console.error(error)
						return null
					}
				})
			)

			const validTransactions = transactions.filter(
				(tx): tx is NonNullable<typeof tx> => tx !== null
			)

			if (validTransactions.length === 0) {
				return `Failed to build any valid transactions. Please check the task format and try again.`
			}

			// Return task IDs and transactions for immediate execution
			return validTransactions
		},
	})

export const getExecutorToolkit = (account: Account) => {
	const consoleKit = new ConsoleKitService()
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))

	return {
		getTransactionData: getTransactionDataTool(account),
		executeTransaction: tool({
			description: 'A tool that executes a transaction using ConsoleKit.',
			parameters: z.object({
				taskId: z.string(),
			}),
			execute: async ({ taskId }) => {
				console.log('======== executeTransaction Tool =========')
				console.log(`[executeTransaction] executing transaction with task id: ${taskId}`)

				const { data: taskData } = await retrieveTaskById(taskId)

				if (!taskData || !taskData[0]) {
					return `Transaction not found for task ID: ${taskId}.`
				}

				const task = taskData[0]
				console.log(`[executeTransaction] executing task: "${task.task}"`)

				try {
					// Execute each transaction step through ConsoleKit
					const hashes: string[] = []
					for (const step of task.steps) {
						const txResponse = await consoleKit.buildTransaction({
							accountAddress: account.address,
							type: task.task.toLowerCase().startsWith('swap')
								? 'SWAP'
								: task.task.toLowerCase().startsWith('deposit')
								? 'DEPOSIT'
								: 'WITHDRAW',
							protocol: task.to_token.address,
							token: USDC_ADDRESS,
							amount: task.from_amount,
						})

						// Execute the transaction and get the hash
						const txHash = await consoleKit.executeTransaction(
							txResponse.transactions[0].data as `0x${string}`
						)
						if (typeof txHash === 'string') {
							console.log(`[executeTransaction] transaction hash: ${txHash}`)
							hashes.push(txHash)
						}
					}

					// Clean up the task
					await deleteTask(taskId)

					return `Transaction executed successfully for task: "${
						task.task
					}". Transaction hashes: ${hashes.join(', ')}`
				} catch (error) {
					console.error(`[executeTransaction] Error executing task:`, error)
					return `Failed to execute transaction: ${
						error instanceof Error ? error.message : 'Unknown error'
					}`
				}
			},
		}),
		getYieldOpportunities: tool({
			description: 'Get available yield opportunities for USDC',
			parameters: z.object({
				minApy: z.number().optional(),
			}),
			execute: async ({ minApy }) => {
				const marketData = await getMarketData(chainConfig)
				const opportunities = marketData.usdc.tokens

				if (!opportunities || opportunities.length === 0) {
					return 'No yield opportunities found for USDC'
				}

				const validOpportunities = minApy
					? opportunities.filter((opp) => opp.metrics.apy >= minApy)
					: opportunities

				return validOpportunities.length > 0
					? validOpportunities
							.map(
								(opp) =>
									`${opp.name}: APY ${opp.metrics.apy}% - TVL: $${opp.metrics.volumeUsd7d}`
							)
							.join('\n')
					: `No opportunities meeting minimum APY of ${minApy}% found`
			},
		}),
	}
}
