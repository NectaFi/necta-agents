import { ConsoleKit } from 'brahma-console-kit'
import { ethers } from 'ethers'
import env from '../../env'
import { getChainConfig } from '../../config/chains'
import { registerExecutor, registerExecutorOnKernel } from './register-executor'
import { buildTransaction, executeTransaction } from './core-actions'
import type { TransactionParams, ConsoleTransactionResponse } from './types'

/**
 * ConsoleKit Service
 * Handles interaction with Brahma's ConsoleKit for on-chain execution
 */
export class ConsoleKitService {
	private consoleKit: ConsoleKit
	private registryId: string | null = null
	private chainConfig = getChainConfig(parseInt(env.CHAIN_ID))
	private provider: ethers.JsonRpcProvider
	private executorWallet: ethers.Wallet

	constructor() {
		if (!env.CONSOLE_API_KEY) {
			throw new Error('CONSOLE_API_KEY is required')
		}

		// Validate chain - only mainnet chains are supported
		const chainId = parseInt(env.CHAIN_ID)
		if (chainId !== 8453 && chainId !== 42161) {
			throw new Error('ConsoleKit only supports Base and Arbitrum mainnets')
		}

		// Initialize ConsoleKit with API key and base URL
		this.consoleKit = new ConsoleKit(env.CONSOLE_API_KEY, env.CONSOLE_BASE_URL)

		// Initialize provider and wallet
		this.provider = new ethers.JsonRpcProvider(env.JSON_RPC_URL)
		this.executorWallet = new ethers.Wallet(env.EXECUTOR_EOA_PRIVATE_KEY, this.provider)

		// Set registry ID if available
		if (env.EXECUTOR_REGISTRY_ID) {
			this.registryId = env.EXECUTOR_REGISTRY_ID
			console.log('[ConsoleKit] Using existing registry ID:', this.registryId)
		} else {
			// Auto-register executor if no registry ID is set
			console.log('[ConsoleKit] No registry ID found, attempting auto-registration...')
			console.log('[ConsoleKit] Note: Registration is gasless')
			this.autoRegisterExecutor().catch((error) => {
				console.error('[ConsoleKit] Auto-registration failed:', error.message)
				if (error.message.includes('invalid chain id')) {
					console.error(
						'[ConsoleKit] Make sure you are using a supported mainnet chain (Base or Arbitrum)'
					)
				}
				throw error
			})
		}
	}

	/**
	 * Automatically register executor with default configuration
	 */
	private async autoRegisterExecutor() {
		try {
			const executorData = await registerExecutor(
				this.consoleKit,
				this.provider,
				this.executorWallet
			)

			this.registryId = executorData.id
			console.log('[ConsoleKit] Executor registered with ID:', this.registryId)

			await registerExecutorOnKernel(
				this.consoleKit,
				this.provider,
				this.executorWallet,
				this.registryId
			)

			return executorData
		} catch (error) {
			console.error('[ConsoleKit] Registration error:', error)
			throw error
		}
	}

	/**
	 * Build a transaction using ConsoleKit's core actions
	 */
	async buildTransaction(params: TransactionParams): Promise<ConsoleTransactionResponse> {
		return buildTransaction(this.consoleKit, this.provider, params)
	}

	/**
	 * Execute a transaction using ConsoleKit
	 */
	async executeTransaction(transactionHash: `0x${string}`) {
		await executeTransaction(this.consoleKit, this.provider, transactionHash)
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

	/**
	 * Get the ConsoleKit instance
	 */
	getConsoleKit(): ConsoleKit {
		return this.consoleKit
	}

	/**
	 * Get the provider instance
	 */
	getProvider(): ethers.JsonRpcProvider {
		return this.provider
	}

	/**
	 * Get the executor wallet
	 */
	getExecutorWallet(): ethers.Wallet {
		return this.executorWallet
	}
}
