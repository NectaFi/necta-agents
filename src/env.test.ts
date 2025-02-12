import { expect, test, describe } from 'bun:test'
import { z } from 'zod'
import { envSchema } from './env'

describe('Environment Configuration', () => {
	test('should accept valid Base chain ID', () => {
		const validEnv = {
			CHAIN_ID: '8453',
			CHAIN_NAME: 'base',
			// Add other required env vars
			SUPABASE_URL: 'test',
			SUPABASE_KEY: 'test',
			EXECUTOR_EOA_PRIVATE_KEY: 'test',
			USER_EOA_PRIVATE_KEY: 'test',
			ZERION_API_KEY: 'test',
			BRIAN_API_KEY: 'test',
			PORTALS_API_KEY: 'test',
			OPENAI_API_KEY: 'test',
			STAKEKIT_API_KEY: 'test',
		}

		expect(() => envSchema.parse(validEnv)).not.toThrow()
	})

	test('should reject invalid chain ID', () => {
		const invalidEnv = {
			CHAIN_ID: '999999',
			CHAIN_NAME: 'invalid',
			// Add other required env vars
			SUPABASE_URL: 'test',
			SUPABASE_KEY: 'test',
			EXECUTOR_EOA_PRIVATE_KEY: 'test',
			USER_EOA_PRIVATE_KEY: 'test',
			ZERION_API_KEY: 'test',
			BRIAN_API_KEY: 'test',
			PORTALS_API_KEY: 'test',
			OPENAI_API_KEY: 'test',
			STAKEKIT_API_KEY: 'test',
		}

		expect(() => envSchema.parse(invalidEnv)).toThrow()
	})
})
