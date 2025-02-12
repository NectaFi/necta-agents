import { ConsoleKit } from 'brahma-console-kit'
import type { PreComputedAddressData, TaskStatusData, Address } from 'brahma-console-kit'
import { ethers } from 'ethers'
import { poll } from './utils'

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
