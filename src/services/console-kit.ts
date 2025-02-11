import { ConsoleKit } from 'brahma-console-kit'
import type { Address, ConsoleExecutorConfig, KernelExecutorConfig } from 'brahma-console-kit'
import { ethers } from 'ethers'
import env from '../env'
import { getChainConfig } from '../config/chains'

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

/**
 * ConsoleKit Service
 * Handles interaction with Brahma's ConsoleKit for on-chain execution
 */
export class ConsoleKitService {
	private consoleKit: ConsoleKit
	private registryId: string | null = null
	private chainConfig = getChainConfig(parseInt(env.CHAIN_ID))
	private provider: ethers.providers.JsonRpcProvider
	private executorWallet: ethers.Wallet

	constructor() {
		if (!env.CONSOLE_KIT_API_KEY) {
			throw new Error('CONSOLE_KIT_API_KEY is required')
		}

		// Initialize ConsoleKit with API key and base URL from environment
		this.consoleKit = new ConsoleKit(env.CONSOLE_KIT_API_KEY, env.CONSOLE_BASE_URL)

		// Initialize provider and wallet
		const rpcUrl = `https://${this.chainConfig.name}.rpc.thirdweb.com`
		this.provider = new ethers.providers.JsonRpcProvider(rpcUrl)
		this.executorWallet = new ethers.Wallet(env.PRIVATE_KEY, this.provider)

		// Set registry ID if available in environment
		if (env.EXECUTOR_REGISTRY_ID) {
			this.registryId = env.EXECUTOR_REGISTRY_ID
			console.log('[ConsoleKit] Using existing registry ID:', this.registryId)
		}
	}

	/**
	 * Register executor with Console and Kernel
	 * This is required before any execution can take place
	 */
	async registerExecutor(
		executorConfig: ConsoleExecutorConfig,
		executorMetadata: ExecutorMetadata
	) {
		try {
			const { chainId: chainIdBig } = await this.provider.getNetwork()
			const chainId = parseInt(chainIdBig.toString(), 10)

			// Get the registration message to sign
			const { domain, message, types } =
				await this.consoleKit.automationContext.generateConsoleExecutorRegistration712Message(
					chainId,
					executorConfig
				)

			// Sign the registration message
			const executorRegistrationSignature = await this.executorWallet._signTypedData(
				domain,
				types,
				message
			)

			// Register executor with Console
			const executorData = await this.consoleKit.automationContext.registerExecutorOnConsole(
				executorRegistrationSignature,
				chainId,
				executorConfig,
				executorMetadata.name,
				executorMetadata.logo,
				executorMetadata.metadata
			)

			if (!executorData) {
				throw new Error('Failed to register executor on console')
			}

			this.registryId = executorData.id
			console.log('[ConsoleKit] Executor registered with ID:', this.registryId)

			// Register executor with Kernel
			const kernelConfig: KernelExecutorConfig = {
				defaultEvery: '120s',
				executionTTL: '120s',
				type: 'INTERVAL',
			}

			// Get the kernel registration message to sign
			const kernelMessage =
				await this.consoleKit.automationContext.generateKernelExecutorRegistration712Message(
					chainId,
					this.registryId,
					kernelConfig
				)

			// Sign the kernel registration message
			const kernelRegistrationSignature = await this.executorWallet._signTypedData(
				kernelMessage.domain,
				kernelMessage.types,
				kernelMessage.message
			)

			// Register with kernel
			await this.consoleKit.automationContext.registerExecutorOnKernel(
				this.registryId,
				kernelRegistrationSignature,
				kernelConfig
			)

			console.log('[ConsoleKit] Executor registered with Kernel')
			return executorData
		} catch (error) {
			console.error('[ConsoleKit] Failed to register executor:', error)
			throw error
		}
	}

	/**
	 * Build a transaction using ConsoleKit's core actions
	 */
	async buildTransaction(params: {
		accountAddress: string
		type: 'DEPOSIT' | 'WITHDRAW' | 'SWAP'
		protocol: string
		token: string
		amount: string
	}): Promise<ConsoleTransactionResponse> {
		try {
			const { chainId: chainIdBig } = await this.provider.getNetwork()
			const chainId = parseInt(chainIdBig.toString(), 10)

			let response: any

			switch (params.type) {
				case 'DEPOSIT':
				case 'WITHDRAW':
					// Use send for deposits and withdrawals
					response = await this.consoleKit.coreActions.send(
						chainId,
						params.accountAddress as `0x${string}`,
						{
							to: params.protocol as `0x${string}`, // Protocol address
							tokenAddress: params.token as `0x${string}`, // Token contract address
							amount: params.amount,
						}
					)
					break
				case 'SWAP':
					// For swap, we need additional parameters like tokenOut and slippage
					// First get swap routes
					const routes = await this.consoleKit.coreActions.getSwapRoutes(
						params.token as `0x${string}`, // tokenIn address
						params.protocol as `0x${string}`, // tokenOut address
						params.accountAddress as `0x${string}`,
						params.amount,
						'1', // 1% slippage
						chainId
					)

					if (!routes.data.length) {
						throw new Error('No swap routes found')
					}

					// Use the first route
					response = await this.consoleKit.coreActions.swap(
						chainId,
						params.accountAddress as `0x${string}`,
						{
							tokenIn: params.token as `0x${string}`,
							tokenOut: params.protocol as `0x${string}`,
							amountIn: params.amount,
							slippage: 1,
							chainId,
							route: routes.data[0],
						}
					)
					break
				default:
					throw new Error(`Unsupported transaction type: ${params.type}`)
			}

			// Transform response to match ConsoleTransactionResponse type
			return {
				transactions: [
					{
						to: response.data.transactions[0].to,
						data: response.data.transactions[0].data,
						value: response.data.transactions[0].value || '0',
						operation: 0,
					},
				],
				metadata: response.data.metadata || {},
			}
		} catch (error) {
			console.error('[ConsoleKit] Failed to build transaction:', error)
			throw error
		}
	}

	/**
	 * Execute a transaction using ConsoleKit
	 */
	async executeTransaction(transactionHash: `0x${string}`) {
		try {
			const { chainId: chainIdBig } = await this.provider.getNetwork()
			const chainId = parseInt(chainIdBig.toString(), 10)

			await this.consoleKit.coreActions.indexTransaction(transactionHash, chainId)
			console.log('[ConsoleKit] Transaction indexed:', transactionHash)
		} catch (error) {
			console.error('[ConsoleKit] Failed to execute transaction:', error)
			throw error
		}
	}

	/**
	 * Fetch pending tasks from Kernel
	 * @param cursor Pagination cursor
	 * @param limit Number of tasks to fetch
	 */
	async fetchTasks(cursor: number = 0, limit: number = 10) {
		if (!this.registryId) {
			throw new Error('Executor not registered')
		}

		try {
			return await this.consoleKit.automationContext.fetchTasks(
				this.registryId,
				cursor,
				limit
			)
		} catch (error) {
			console.error('[ConsoleKit] Failed to fetch tasks:', error)
			throw error
		}
	}

	/**
	 * Submit a task to Kernel
	 * @param taskRequest Task request parameters
	 */
	async submitTask(taskRequest: any) {
		if (!this.registryId) {
			throw new Error('Executor not registered')
		}

		try {
			return await this.consoleKit.automationContext.submitTask(taskRequest)
		} catch (error) {
			console.error('[ConsoleKit] Failed to submit task:', error)
			throw error
		}
	}

	/**
	 * Get the executor registry ID if registered
	 */
	getRegistryId(): string | null {
		return this.registryId
	}

	/**
	 * Check if the executor is registered
	 */
	isRegistered(): boolean {
		return this.registryId !== null
	}
}
