/**
 * Aave V3 Subgraph Data Fetching
 * Uses Aave's official subgraph to fetch real-time market data
 * This avoids the ethers.js dependency issue with @aave/contract-helpers
 */

export interface AaveReserveData {
  symbol: string;
  name: string;
  underlyingAsset: string;
  aTokenAddress: string;
  decimals: number;
  supplyAPY: string;
  variableBorrowAPY: string;
  availableLiquidity: string;
  totalLiquidity: string;
  utilizationRate: string;
  supplyCap: string;
  borrowCap: string;
  isFrozen: boolean;
  isPaused: boolean;
  isActive: boolean;
}

// Subgraph endpoints for different chains
const SUBGRAPH_URLS: Record<number, string> = {
  1: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3",
  137: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-polygon",
  8453: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-base",
  42161: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-arbitrum",
  10: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-optimism",
  43114: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-avalanche",
  100: "https://api.thegraph.com/subgraphs/name/aave/protocol-v3-gnosis",
};

const RESERVES_QUERY = `
  query GetReserves {
    reserves(first: 100, where: { isActive: true }) {
      id
      symbol
      name
      decimals
      underlyingAsset
      aToken {
        id
      }
      liquidityRate
      variableBorrowRate
      availableLiquidity
      totalLiquidity
      utilizationRate
      supplyCap
      borrowCap
      isFrozen
      isPaused
      isActive
    }
  }
`;

/**
 * Fetch reserves data from Aave subgraph
 */
export async function fetchAaveReservesFromSubgraph(
  chainId: number
): Promise<Record<string, AaveReserveData>> {
  const subgraphUrl = SUBGRAPH_URLS[chainId];
