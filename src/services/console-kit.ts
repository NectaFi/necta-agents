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

		// Validate chain - only mainnet chains are supported
		const chainId = parseInt(env.CHAIN_ID)
		if (chainId !== 8453 && chainId !== 42161) {
			// Base and Arbitrum mainnet only
			throw new Error(
				'ConsoleKit only supports Base and Arbitrum mainnets. Testnets are not supported.'
			)
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
			const { chainId: chainIdBig } = await this.provider.getNetwork()
			const chainId = parseInt(chainIdBig.toString(), 10)

			console.log('[ConsoleKit] Registering executor on chain:', chainId)

			const executorConfig: ConsoleExecutorConfig = {
				clientId: env.EXECUTOR_CLIENT_ID,
				executor: this.executorWallet.address as `0x${string}`,
				feeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
				hopAddresses: ['0xAE75B29ADe678372D77A8B41225654138a7E6ff1'] as `0x${string}`[],
				inputTokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'] as `0x${string}`[],
				limitPerExecution: true,
				timestamp: new Date().getTime(),
			}

			const executorMetadata = {
				name: 'necta-executor',
				logo: '',
				metadata: {},
			}

			console.log('[ConsoleKit] Generating registration message...')
			const { domain, message, types } =
				await this.consoleKit.automationContext.generateConsoleExecutorRegistration712Message(
					chainId,
					executorConfig
				)

			console.log('[ConsoleKit] Signing registration message...')
			const executorRegistrationSignature = await this.executorWallet._signTypedData(
				domain,
				types,
				message
			)

			console.log('[ConsoleKit] Registering with Console...')
			const executorData = await this.consoleKit.automationContext.registerExecutorOnConsole(
				executorRegistrationSignature,
				chainId,
				executorConfig,
				executorMetadata.name,
				executorMetadata.logo,
				executorMetadata.metadata
			)

			if (!executorData) {
				throw new Error('Failed to register executor on console - no data returned')
			}

			this.registryId = executorData.id
			console.log('[ConsoleKit] Executor registered with ID:', this.registryId)

			// Register with Kernel
			const kernelConfig: KernelExecutorConfig = {
				defaultEvery: '120s',
				executionTTL: '120s',
				type: 'INTERVAL',
			}

			console.log('[ConsoleKit] Generating kernel registration message...')
			const kernelMessage =
				await this.consoleKit.automationContext.generateKernelExecutorRegistration712Message(
					chainId,
					this.registryId,
					kernelConfig
				)

			console.log('[ConsoleKit] Signing kernel registration message...')
			const kernelRegistrationSignature = await this.executorWallet._signTypedData(
				kernelMessage.domain,
				kernelMessage.types,
				kernelMessage.message
			)

			console.log('[ConsoleKit] Registering with kernel...')
			await this.consoleKit.automationContext.registerExecutorOnKernel(
				this.registryId,
				kernelRegistrationSignature,
				kernelConfig
			)

			console.log('[ConsoleKit] Executor successfully registered with Kernel')
			return executorData
		} catch (error) {
			console.error('[ConsoleKit] Registration error:', error)
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
		const { chainId: chainIdBig } = await this.provider.getNetwork()
		const chainId = parseInt(chainIdBig.toString(), 10)

		// Use ConsoleKit's core actions for transaction building
		const response = await this.consoleKit.coreActions.send(
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

	/**
	 * Execute a transaction using ConsoleKit
	 */
	async executeTransaction(transactionHash: `0x${string}`) {
		const { chainId: chainIdBig } = await this.provider.getNetwork()
		const chainId = parseInt(chainIdBig.toString(), 10)

		await this.consoleKit.coreActions.indexTransaction(transactionHash, chainId)
		console.log('[ConsoleKit] Transaction indexed:', transactionHash)
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
