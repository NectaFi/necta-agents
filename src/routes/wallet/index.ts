import { Hono } from 'hono'
import {
	getAccountBalances,
	getWalletBalanceChart,
	getWalletFungiblePositions,
	getWalletPortfolio,
	getWalletTransactions,
} from '../../data'
import { cache } from 'hono/cache'
import { privateKeyToAccount } from 'viem/accounts'
import env from '../../env'
import { getChainConfig } from '../../config/chains'

const walletRouter = new Hono()

walletRouter.get('/balances/:address', async (c) => {
	const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))
	const address = c.req.param('address')
	return c.json(await getAccountBalances(chainConfig, address))
})

walletRouter.get(
	'/',
	cache({
		cacheName: 'necta-app',
		cacheControl: 'max-age=36000',
	}),
	async (c) => {
		const chainConfig = getChainConfig(parseInt(env.CHAIN_ID))
		const account = privateKeyToAccount(env.PRIVATE_KEY as `0x${string}`)
		const period = c.req.query('period') || 'month'

		const [chart, portfolio, transactions, positions, wallet] = await Promise.all([
			getWalletBalanceChart(account.address, period),
			getWalletPortfolio(account.address),
			getWalletTransactions(account.address),
			getWalletFungiblePositions(account.address),
			getAccountBalances(chainConfig, account.address),
		])

		// Transform data to match frontend schema
		const tokens =
			positions?.data?.map((token: any) => ({
				symbol: token.asset.symbol,
				balance: token.quantity,
				value: token.value.toString(),
			})) || []

		const defiPositions =
			portfolio?.data?.positions?.map((pos: any) => ({
				protocol: pos.protocol.name,
				amount: pos.quantity,
				value: pos.value.toString(),
			})) || []

		return c.json({
			address: account.address,
			balance: positions?.data?.[0]?.quantity || '0',
			totalBalance: positions?.meta?.total_value?.toString() || '0',
			totalValue: parseFloat(positions?.meta?.total_value || '0'),
			averageApy: wallet?.balances?.[0]?.metrics?.apy || 0,
			riskScore: 2, // TODO: Implement risk scoring
			tokens,
			positions: defiPositions,
		})
	}
)

export { walletRouter }
