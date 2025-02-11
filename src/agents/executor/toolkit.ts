import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'
import type { Account } from 'viem'
import { z } from 'zod'
import env from '../../env'
import { deleteTask, retrieveTaskById, retrieveTasks, storeTask, updateTask } from '../../memory'
import { createPublicClient, createWalletClient, formatUnits, http } from 'viem'
import { getChain } from '../../utils/chain'
import { getMarketData, getPositionData } from '../../data'
import { ConsoleKitService } from '../../services/console-kit'
import { getChainConfig } from '../../config/chains'

export const getTransactionDataTool = (account: Account) =>
	tool({
		description: 'A tool that transforms the tasks into transactions.',
		parameters: z.object({
			tasks: z.array(
				z.object({
					task: z.string(),
					taskId: z.string().nullable(),
				})
			),
		}),
		execute: async ({ tasks }: { tasks: { task: string; taskId: string | null }[] }) => {
			console.log('======== getTransactionData Tool =========')
			console.log(`[getTransactionData] fetching transactions data from Brian`)
			const transactions = await Promise.all(
				tasks.map(async ({ task, taskId }: { task: string; taskId: string | null }) => {
					console.log(
						`[getTransactionData] fetching transaction data for task: "${task}"`
					)
					try {
						const brianResponse = await fetch(
							`${
								env.BRIAN_API_URL ||
								'https://staging-api.brianknows.org/api/v0/agent/transaction'
							}`,
							{
								method: 'POST',
								body: JSON.stringify({
									prompt: task,
									chainId: env.CHAIN_ID,
									address: account.address,
								}),
								headers: {
									'Content-Type': 'application/json',
									'x-brian-api-key': env.BRIAN_API_KEY,
								},
							}
						)

						const { result } = await brianResponse.json()

						if (!result) {
							return null
						}

						const data = result[0].data
						console.log(`[getTransactionData] Brian says: ${data.description}`)
						const steps = data.steps

						return {
							task,
							steps,
							taskId,
							fromToken: data.fromToken,
							fromAmountUSD: `$${data.fromAmountUSD}`,
							toToken: data.toToken,
							toAmountUSD: `$${data.toAmountUSD}`,
							fromAmount: formatUnits(data.fromAmount, data.fromToken.decimals),
							outputAmount: formatUnits(data.toAmountMin, data.toToken.decimals),
						}
					} catch (error) {
						console.error(error)
						return null
					}
				})
			)

			if (transactions.length !== tasks.length) {
				return `Some transactions failed to fetch, please rewrite the tasks.`
			}

			const validTransactions = transactions.filter((transaction) => transaction !== null)

			const taskIds: any[] = []
			for (const transaction of validTransactions) {
				if (transaction.taskId) {
					const { data: taskData } = await updateTask(
						transaction.taskId,
						transaction.task,
						transaction.steps,
						transaction.fromToken,
						transaction.toToken,
						transaction.fromAmount,
						transaction.outputAmount
					)
					taskIds.push({
						taskId: taskData![0].id,
						task: transaction.task,
						createdAt: taskData![0].created_at,
					})
				} else {
					const { data: taskData } = await storeTask(
						transaction.task,
						transaction.steps,
						transaction.fromToken,
						transaction.toToken,
						transaction.fromAmount,
						transaction.outputAmount
					)
					taskIds.push({
						taskId: taskData![0].id,
						task: transaction.task,
						createdAt: taskData![0].created_at,
					})
				}
			}

			console.log(`[getTransactionData] transactions fetched correctly.`)

			return taskIds
		},
	})

export const getExecutorToolkit = (account: Account) => {
	const consoleKit = new ConsoleKitService()
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))

	return {
		getTransactionData: getTransactionDataTool(account),
		simulateTasks: tool({
			description:
				'A tool that simulates the output of all the tasks. It is useful to to check the outputs and to fix the inputs of other tasks. Always use this tool before the executeTransaction tool.',
			parameters: z.object({}),
			execute: async ({}) => {
				console.log('======== simulateTasks Tool =========')

				const { data: taskIds } = await retrieveTasks()

				if (!taskIds) {
					return `No tasks found.`
				}

				const tasks = await Promise.all(
					taskIds.map(async ({ id: taskId }) => {
						const { data: taskData } = await retrieveTaskById(taskId)

						if (!taskData) {
							return `Transaction not found for task [id: ${taskId}].`
						}

						if (!taskData[0].steps) {
							return `Transaction not found for task [id: ${taskId}].`
						}

						return [
							`[taskId: ${taskId}] "${taskData[0].task}"`,
							`The transaction is from ${taskData[0].to_token.symbol} to ${taskData[0].from_token.symbol}.`,
							`The amount is ${taskData[0].from_amount} ${taskData[0].from_token.symbol} and the output amount is ${taskData[0].to_amount} ${taskData[0].to_token.symbol}.`,
							`Fix the task accordingly and return just the updated task.`,
						].join('\n')
					})
				)

				const response = await generateText({
					model: openai('gpt-4o-mini'),
					prompt: [
						`You have simulated all the tasks you need to execute. This is the output of the simulation:`,
						tasks.join('\n'),
						`Fix the tasks accordingly and return just the updated tasks.`,
						`When the tasks are updated, remind yourself to get the updated transaction data and then execute the tasks.`,
					].join('\n'),
				})

				return response.text
			},
		}),
		executeTransaction: tool({
			description:
				'A tool that executes a transaction. Execute transactions in chronological order.',
			parameters: z.object({
				task: z.string(),
				taskId: z.string(),
			}),
			execute: async ({ task, taskId }) => {
				console.log('======== executeTransaction Tool =========')
				console.log(`[executeTransaction] executing transaction with task id: ${taskId}`)

				const { data: taskData } = await retrieveTaskById(taskId)

				if (!taskData) {
					return `Transaction not found for task: "${task}" [id: ${taskId}].`
				}

				const walletClient = createWalletClient({
					account,
					chain: getChain(parseInt(env.CHAIN_ID)),
					transport: http(),
				})
				const publicClient = createPublicClient({
					chain: getChain(parseInt(env.CHAIN_ID)),
					transport: http(),
				})

				const hashes: string[] = []

				for (const step of taskData[0].steps) {
					try {
						const hash = await walletClient.sendTransaction({
							to: step.to,
							value: BigInt(step.value),
							data: step.data,
						})
						console.log(`[executeTransaction] transaction hash: ${hash}`)
						const receipt = await publicClient.waitForTransactionReceipt({
							hash,
						})
						console.log(
							`[executeTransaction] transaction receipt: ${receipt.transactionHash}`
						)
						hashes.push(receipt.transactionHash)
					} catch (error) {
						console.log(
							`[executeTransaction] transaction for task "${task}" failed: ${error}`
						)
						return `[${new Date().toISOString()}] Transaction errored for task: "${task}". The error is: ${JSON.stringify(
							error,
							null,
							2
						)}`
					}
				}

				await deleteTask(taskId)

				return `[${new Date().toISOString()}] Transaction executed successfully for task: "${task}". Transaction hashes: ${hashes.join(
					', '
				)}`
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
		executeYieldTransaction: tool({
			description: 'Execute a yield-generating transaction through ConsoleKit',
			parameters: z.object({
				protocol: z.string(),
				amount: z.string(),
			}),
			execute: async ({ protocol, amount }) => {
				try {
					// Get position data to validate protocol
					const positionData = await getPositionData([{ protocol, token: 'USDC' }])

					if (!positionData[0].data.length) {
						return `No valid yield opportunities found for ${protocol}`
					}

					// Get protocol details from position data
					const protocolDetails = positionData[0].data[0]
					console.log(
						`[executeYieldTransaction] Using protocol: ${protocolDetails.name} with APY: ${protocolDetails.metrics.apy}%`
					)

					const task = `Deposit ${amount} USDC into ${protocol} for yield generation`
					console.log(`[executeYieldTransaction] Building transaction for task: ${task}`)

					// Build transaction through ConsoleKit
					const txResponse = await consoleKit.buildTransaction({
						accountAddress: account.address,
						type: 'DEPOSIT',
						protocol: protocol.toLowerCase(),
						token: 'USDC',
						amount,
					})

					if (!txResponse.transactions.length) {
						throw new Error('No transactions returned from ConsoleKit')
					}

					// Store task in memory with ConsoleKit data
					const { data: taskData } = await storeTask(
						task,
						txResponse.transactions,
						{ symbol: 'USDC', decimals: 6 },
						{ symbol: protocol, decimals: 18 },
						amount,
						amount
					)

					console.log(`[executeYieldTransaction] Task stored with ID: ${taskData![0].id}`)

					// Execute transaction using wallet client
					const walletClient = createWalletClient({
						account,
						chain: getChain(parseInt(env.CHAIN_ID)),
						transport: http(),
					})

					const tx = txResponse.transactions[0]
					console.log(`[executeYieldTransaction] Executing transaction to: ${tx.to}`)

					// Execute transaction
					const hash = await walletClient.sendTransaction({
						to: tx.to,
						value: BigInt(tx.value || '0'),
						data: tx.data as `0x${string}`,
					})

					console.log(`[executeYieldTransaction] Transaction sent with hash: ${hash}`)

					// Index transaction in ConsoleKit
					await consoleKit.executeTransaction(hash)
					console.log(`[executeYieldTransaction] Transaction indexed in ConsoleKit`)

					return `Successfully executed yield transaction for ${amount} USDC on ${protocol}. Transaction hash: ${hash}`
				} catch (error: any) {
					console.error('Failed to execute yield transaction:', error)
					return `Failed to execute yield transaction: ${error.message}`
				}
			},
		}),
	}
}
