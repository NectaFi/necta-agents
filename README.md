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

1. Clone the repository:

```bash
git clone https://github.com/your-username/necta-agents.git
cd necta-agents
```

2. Install dependencies:

```bash
bun install
```

3. Copy environment example:

```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`

5. Run the development server:

```bash
bun src/index.ts
```

## Development

The project uses:

-   TypeScript for type safety
-   Zod for runtime validation
-   Bun as the runtime
-   Hono for API routing
-   Viem for blockchain interactions

## Testing

Run the test suite:

```bash
bun test
```
