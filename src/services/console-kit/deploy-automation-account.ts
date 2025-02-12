import { ConsoleKit } from 'brahma-console-kit'
import type { PreComputedAddressData, TaskStatusData, Address } from 'brahma-console-kit'
import { ethers } from 'ethers'
import { poll } from './utils'
import env from '../../env'

const AutomationSubscriptionParams = {
	inputToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address, // Base USDC
	inputAmount: BigInt(1000000), // 1 USDC
	inputTokenPerIterationLimit: BigInt(200000), // 0.2 USDC per iteration
	duration: 0,
	metadata: {
		every: '120s',
		receiver: '0xAE75B29ADe678372D77A8B41225654138a7E6ff1',
		transferAmount: '200000',
	},
}

async function main() {
	console.log('[Deploy] Starting Brahma account deployment...')

	if (!env.USER_EOA_PRIVATE_KEY) {
		throw new Error('USER_EOA_PRIVATE_KEY is required')
	}

	if (!env.EXECUTOR_REGISTRY_ID) {
		throw new Error('EXECUTOR_REGISTRY_ID is required')
	}

	const consoleKit = new ConsoleKit(env.CONSOLE_API_KEY, env.CONSOLE_BASE_URL)
	const provider = new ethers.JsonRpcProvider(env.JSON_RPC_URL)
	const userWallet = new ethers.Wallet(env.USER_EOA_PRIVATE_KEY.replace('0x', ''), provider)
	const userEoaAddress = userWallet.address as Address

	console.log('[Deploy] Using user address:', userEoaAddress)
	console.log('[Deploy] Using executor registry:', env.EXECUTOR_REGISTRY_ID)

	try {
		// 1. Setup precompute balances
		console.log('[Deploy] Setting up precompute balances...')
		const precomputeData = await setupPrecomputeBalances(
			consoleKit,
			provider,
			userWallet,
			userEoaAddress,
			parseInt(env.CHAIN_ID),
			AutomationSubscriptionParams.inputToken,
			AutomationSubscriptionParams.inputAmount
		)

		console.log('[Deploy] Precompute setup complete')

		// 2. Deploy automation account
		console.log('[Deploy] Deploying automation account...')
		const { taskId } = await deployAutomationAccount(
			consoleKit,
			provider,
			userWallet,
			userEoaAddress,
			parseInt(env.CHAIN_ID),
			precomputeData,
			env.EXECUTOR_REGISTRY_ID,
			AutomationSubscriptionParams
		)

		console.log('[Deploy] Deployment initiated with task ID:', taskId)

		// 3. Poll for deployment status
		console.log('[Deploy] Polling for deployment status...')
		const taskData = await pollDeploymentStatus(consoleKit, taskId, parseInt(env.CHAIN_ID))

		console.log('[Deploy] Deployment complete:', taskData)

		if (taskData.status === 'successful' && taskData.outputTransactionHash) {
			console.log('[Deploy] Successfully deployed Brahma account')
			console.log('[Deploy] Transaction hash:', taskData.outputTransactionHash)
		} else {
			throw new Error(`Deployment failed with status: ${taskData.status}`)
		}
	} catch (error) {
		console.error('[Deploy] Error:', error)
		process.exit(1)
	}
}

// Run the deployment
main().catch((error) => {
	console.error('[Deploy] Fatal error:', error)
	process.exit(1)
})

export interface AutomationSubscriptionParams {
	inputToken: Address
	inputAmount: bigint
	inputTokenPerIterationLimit: bigint
	duration: number
	metadata: {
		every: string
		receiver: string
		transferAmount: string
	}
}

export async function setupPrecomputeBalances(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	userWallet: ethers.Wallet,
	userEoa: Address,
	chainId: number,
	inputToken: Address,
	inputAmount: bigint
): Promise<PreComputedAddressData> {
	const precomputedData = await consoleKit.publicDeployer.fetchPreComputeData(
		userEoa,
		chainId,
		inputToken
	)
	if (!precomputedData) throw new Error('precompute call fail')

	const totalDepositAmount = BigInt(precomputedData.feeEstimate) + inputAmount

	try {
		const inputTokenContract = new ethers.Contract(
			inputToken,
			['function transfer(address to, uint256 amount) returns (bool)'],
			userWallet
		)

		const tx = await userWallet.sendTransaction({
			to: await inputTokenContract.getAddress(),
			value: 0,
			data: inputTokenContract.interface.encodeFunctionData('transfer', [
				precomputedData.precomputedAddress,
				totalDepositAmount,
			]),
		})
		await tx.wait(2)
	} catch (e) {
		console.error(e)
		throw new Error('precompute setup balance fail')
	}

	console.log('[precompute]', { precomputedData })
	return precomputedData
}

export async function deployAutomationAccount(
	consoleKit: ConsoleKit,
	provider: ethers.JsonRpcProvider,
	userWallet: ethers.Wallet,
	userEoa: Address,
	chainId: number,
	precomputeData: PreComputedAddressData,
	executorRegistryId: string,
	params: AutomationSubscriptionParams
) {
	const inputTokenContract = new ethers.Contract(
		params.inputToken,
		['function decimals() view returns (uint8)'],
		userWallet
	)
	const inputTokenDecimals = await inputTokenContract.decimals()

	const tokens = [params.inputToken]
	const amounts = [params.inputAmount.toString()]

	const tokenInputs = {
		[params.inputToken]: params.inputAmount.toString(),
	}
	const tokenLimits = {
		[params.inputToken]: ethers.formatUnits(params.inputAmount, inputTokenDecimals),
	}

	const automationDuration = params.duration > 3600 ? params.duration - 3600 : params.duration

	const accountGenerationData = await consoleKit.publicDeployer.generateAutomationSubAccount(
		userEoa,
		precomputeData.precomputedAddress,
		chainId,
		executorRegistryId,
		params.inputToken,
		precomputeData.feeEstimate,
		tokens,
		amounts,
		{
			duration: automationDuration,
			tokenInputs: tokenInputs,
			tokenLimits: tokenLimits,
		},
		params.metadata
	)
	if (!accountGenerationData) throw new Error('automation account generation data fetch fail')

	const {
		signaturePayload: { domain, message, types },
		subAccountPolicyCommit,
		subscriptionDraftID,
	} = accountGenerationData

	const deploymentSignature = await userWallet.signTypedData(
		{
			verifyingContract: domain.verifyingContract,
			chainId: parseInt(domain.chainId as string, 16),
		},
		types,
		message
	)

	const deployData = await consoleKit.publicDeployer.deployBrahmaAccount(
		userEoa,
		chainId,
		executorRegistryId,
		subscriptionDraftID,
		subAccountPolicyCommit,
		params.inputToken,
		tokens,
		amounts,
		deploymentSignature,
		precomputeData.feeEstimateSignature,
		precomputeData.feeEstimate,
		{}
	)
	if (!deployData) throw new Error('automation account deployment fail')

	return deployData
}

export async function pollDeploymentStatus(
	consoleKit: ConsoleKit,
	deploymentTaskId: string,
	chainId: number
): Promise<TaskStatusData> {
	const isTaskComplete = (taskStatus: TaskStatusData) =>
		!(
			taskStatus.status === 'successful' ||
			taskStatus.status === 'cancelled' ||
			taskStatus.status === 'failed'
		)
	const getTaskStatus = async () => {
		const taskStatus = await consoleKit.publicDeployer.fetchDeploymentStatus(deploymentTaskId)
		console.log({ taskStatus })
		return taskStatus
	}

	const taskStatus = await poll<TaskStatusData>(getTaskStatus, isTaskComplete, 5000)

	if (taskStatus.outputTransactionHash)
		await consoleKit.coreActions.indexTransaction(taskStatus.outputTransactionHash, chainId)

	return taskStatus
}
