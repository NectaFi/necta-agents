import { z } from 'zod'
import { validateChainId } from './config/chains'

export const envSchema = z.object({
	PORT: z.coerce.number().default(3000),
	SUPABASE_URL: z.string(),
	SUPABASE_KEY: z.string(),
	PRIVATE_KEY: z.string(),
	ZERION_API_KEY: z.string(),
	OPENAI_API_KEY: z.string(),
	STAKEKIT_API_KEY: z.string(),
	CHAIN_ID: z
		.string()
		.default('42161')
		.refine((val) => validateChainId(parseInt(val)), 'Chain ID not supported or not enabled'),
	CHAIN_NAME: z.string().default('base'),
	MODEL_NAME: z.string().default('gpt-4o-2024-08-06'),
	ENABLE_AGENTS: z
		.string()
		.default('false')
		.transform((val) => val === 'true'),
	CONSOLE_KIT_API_KEY: z.string(),
	// ConsoleKit specific variables
	EXECUTOR_CLIENT_ID: z.string().default('necta-executor'),
	EXECUTOR_REGISTRY_ID: z.string().optional(), // Will be set after registration
	CONSOLE_BASE_URL: z.string().default('https://dev.console.fi/v1/vendor'),
})

export const env = envSchema.parse(process.env)

export type Environment = {
	Bindings: z.infer<typeof envSchema>
}

export default env
