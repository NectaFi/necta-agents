# 🤖 Necta Agents

An autonomous multi-agent DeFi system for yield optimization and portfolio management, built on Arbitrum. Powered by Bun, Hono, Vercel AI SDK, OpenAI, Brahma's ConsoleKit, Safe Smart Account, Supabase, Stakekit Viem, and more.

## Overview 📚

Necta Agents is an AI-powered DeFi automation system that:

-   Monitors market conditions and wallet status
-   Identifies optimal yield opportunities to maximize returns
-   Executes transactions securely through Brahma accounts (powered by Safe Smart Account)
-   Operates autonomously with no human intervention required

## System Architecture 🏗️

### Architectural Diagram

![Architecture](./architecture.png)

### User Flow Diagram

![User Flow](./user-flow.png)

The system consists of three main AI agents working together:

1. **Sentinel Agent**: Market analysis and opportunity detection

    - Monitors market conditions
    - Tracks wallet status
    - Generates intelligence reports

2. **Curator Agent**: Strategy formulation and task generation

    - Analyzes Sentinel reports
    - Determines optimal actions
    - Curates executable tasks

3. **Executor Agent**: Secure transaction execution
    - Processes tasks into transactions
    - Executes via Brahma ConsoleKit
    - Verifies transaction success

### Core Components

1. **Infrastructure**

    - Event Bus: Inter-agent communication system
    - Memory System: Supabase for persistent storage

2. **Data Sources**

    - Market Data: Stakekit for Protocol yields and token prices
    - Wallet Status: Account balances and positions

3. Onchain Execution: Brahma ConsoleKit

## Quick Start 🚀

### Prerequisites

-   Hono
-   Bun
-   Supabase account
-   ConsoleKit API key
-   OpenAI API key
-   Vercel AI SDK
-   Brahma ConsoleKit
-   Safe Smart Account
-   Stakekit API key

### Installation

1. Clone and install:

```bash
git clone https://github.com/NectaFi/necta-agents.git
cd necta-agents
bun install
```

2. Configure environment:

```bash
cp .env.example .env
```

### Setup Steps

1. **Register Executor (Gasless)**

```bash
ENABLE_AGENTS=true bun src/index.ts
```

2. **Create Brahma Account**

    - Visit [Console.fi](https://dev.console.fi)
    - Connect wallet (same as executor)
    - Create Brahma account
    - Create subscription with registered executor
    - Fund account with USDC

3. **Add Brahma Account**

```env
BRAHMA_ACCOUNT_ADDRESS="0x..."
```

## Security 🛡️

-   Non-custodial: All funds remain in Brahma account
-   Secure execution: ConsoleKit handles transaction security
-   Limited permissions: Executor only signs transaction data
-   Transaction simulation: All transactions are simulated before execution

## Development Guide 🛠️

### Project Structure

```
src/
├── agents/             # Agent implementations
├── services/           # External services integration
├── system-prompts/     # Agent behavior definitions
├── data/              # Data fetching and processing
├── comms/             # Inter-agent communication
└── config/            # Chain and protocol configs
```

### Key Files

-   `src/agents/index.ts`: Agent system initialization
-   `src/services/console-kit/`: ConsoleKit integration
-   `src/system-prompts/`: Agent behavior definitions
-   `src/data/`: Market data and protocol integrations

### Adding New Features

1. **Extend Agent Capabilities**

    - Add tools in agent's toolkit
    - Update system prompts
    - Register new event handlers

2. **Add Protocol Support**
    - Add protocol addresses
    - Implement data fetching
    - Update transaction building

## Contributing 🤝

## License 📄

MIT License - See [LICENSE](LICENSE) for details

## Disclaimer ⚠️

This code is provided as-is with no guarantees. Not audited. Use at your own risk. Not financial advice.
