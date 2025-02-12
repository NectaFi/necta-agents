import { ConsoleKit } from 'brahma-console-kit'
import type { ConsoleExecutorConfig, KernelExecutorConfig } from 'brahma-console-kit'
import { ethers } from 'ethers'
import type { ExecutorMetadata } from './types'
import env from '../../env'

export async function registerExecutor(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	executorWallet: ethers.Wallet
) {
	try {
		const { chainId: chainIdBig } = await provider.getNetwork()
		const chainId = parseInt(chainIdBig.toString(), 10)

		console.log('[ConsoleKit] Registering executor on chain:', chainId)

		const executorConfig: ConsoleExecutorConfig = {
			clientId: env.EXECUTOR_CLIENT_ID,
			executor: executorWallet.address as `0x${string}`,
			feeReceiver: '0x0000000000000000000000000000000000000000' as `0x${string}`,
			hopAddresses: ['0xAE75B29ADe678372D77A8B41225654138a7E6ff1'] as `0x${string}`[],
			inputTokens: ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'] as `0x${string}`[],
			limitPerExecution: true,
			timestamp: new Date().getTime(),
		}

		const executorMetadata: ExecutorMetadata = {
			name: 'necta-executor',
			logo: '',
			metadata: {},
		}

		console.log('[ConsoleKit] Generating registration message...')
		const { domain, message, types } =
			await consoleKit.automationContext.generateConsoleExecutorRegistration712Message(
				chainId,
				executorConfig
			)

		console.log('[ConsoleKit] Signing registration message...')
		const executorRegistrationSignature = await executorWallet.signTypedData(
			domain,
			types,
			message
		)

		console.log('[ConsoleKit] Registering with Console...')
		const executorData = await consoleKit.automationContext.registerExecutorOnConsole(
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

		return executorData
	} catch (error) {
		console.error('[ConsoleKit] Registration error:', error)
		throw error
	}
}

export async function registerExecutorOnKernel(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	executorWallet: ethers.Wallet,
	registryId: string
) {
	const { chainId: chainIdBig } = await provider.getNetwork()
	const chainId = parseInt(chainIdBig.toString(), 10)

	const kernelConfig: KernelExecutorConfig = {
		defaultEvery: '120s',
		executionTTL: '120s',
		type: 'INTERVAL',
	}

	console.log('[ConsoleKit] Generating kernel registration message...')
	const kernelMessage =
		await consoleKit.automationContext.generateKernelExecutorRegistration712Message(
			chainId,
			registryId,
			kernelConfig
		)

	console.log('[ConsoleKit] Signing kernel registration message...')
	const kernelRegistrationSignature = await executorWallet.signTypedData(
		kernelMessage.domain,
		kernelMessage.types,
		kernelMessage.message
	)

	console.log('[ConsoleKit] Registering with kernel...')
	await consoleKit.automationContext.registerExecutorOnKernel(
		registryId,
		kernelRegistrationSignature,
		kernelConfig
	)

	console.log('[ConsoleKit] Executor successfully registered with Kernel')
}
