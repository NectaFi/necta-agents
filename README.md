# Necta Core Agents

A multi-agent system for autonomous DeFi operations, built for the Safe Agentaton.

## Architecture

The system consists of three main agents:

1. **Sentinel Agent**: Market analysis and opportunity detection
2. **Curator Agent**: Decision making and strategy formulation
3. **Executor Agent**: Transaction execution and safety verification

## Core Components

-   **Agent System**: Multi-agent system
-   **Event Bus**: Inter-agent communication system
-   **Data Layer**: Data sources for market data fetching
-   **Memory System**: Persistent storage with Supabase
-   **Chain Configuration**: Multi-chain support system
-   **System Prompt**: Agent behaviour definitions
-

## Setup

1. Install dependencies:

```bash
bun install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

Fill in the required API keys and configuration.

3. Register Executor (Gasless):

```bash
ENABLE_AGENTS=true bun src/index.ts
```

This will register your executor with ConsoleKit. The registration is gasless.

4. Create Brahma Account (Manual Steps):

    1. Visit https://dev.console.fi
    2. Connect your wallet (same as executor wallet)
    3. Create a new Brahma account
    4. Create a subscription with your registered executor
    5. Fund the account with at least 1 USDC for testing

5. Add your Brahma account address to `.env`:

```
BRAHMA_ACCOUNT_ADDRESS="0x..."
```

## Important Notes

-   Executor registration is completely gasless
-   Brahma account deployment requires funds
-   Keep at least 1 USDC in the Brahma account for testing
-   All funds in the Brahma account remain fully owned by you
-   Transaction relaying for automations is currently free
