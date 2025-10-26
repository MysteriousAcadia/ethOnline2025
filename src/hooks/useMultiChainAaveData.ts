/**
 * Custom hook for fetching Aave market data from multiple chains simultaneously
 * Provides APR data for all supported chains for comparison
 */

import { useState, useEffect } from "react";
import { useAaveMarketData } from "./useAaveMarketData";
import type { AaveReserveInfo } from "./useAaveMarketData";
import { getSupportedMainnetChainIds } from "../config/aave";

// Chain info for display purposes
const CHAIN_INFO = {
  1: {
    name: "Ethereum",
    icon: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    color: "#627EEA",
  },
  137: {
    name: "Polygon",
    icon: "https://icons.llamao.fi/icons/chains/rsz_polygon.jpg",
    color: "#8247E5",
  },
  8453: {
    name: "Base",
    icon: "https://icons.llamao.fi/icons/chains/rsz_base.jpg",
    color: "#0052FF",
  },
  43114: {
    name: "Avalanche",
    icon: "https://icons.llamao.fi/icons/chains/rsz_avalanche.jpg",
    color: "#E84142",
  },
  11155111: {
    name: "Sepolia",
    icon: "https://icons.llamao.fi/icons/chains/rsz_ethereum.jpg",
    color: "#627EEA",
  },
} as const;

export interface ChainReserveData {
  chainId: number;
  chainName: string;
  chainIcon: string;
  chainColor: string;
  reserves: Record<string, AaveReserveInfo>;
  loading: boolean;
  error: Error | null;
}

export interface MultiChainReserveData {
  [symbol: string]: {
    [chainId: number]: {
      chainName: string;
      chainIcon: string;
      chainColor: string;
      supplyAPY: string;
      available: boolean;
      loading: boolean;
      error?: string;
    };
  };
}

export interface UseMultiChainAaveDataResult {
  chainData: ChainReserveData[];
  multiChainReserves: MultiChainReserveData;
  globalLoading: boolean;
  allTokens: string[];
}

/**
 * Hook to fetch Aave market data from all supported chains
 */
export function useMultiChainAaveData(
  userAddress?: string
): UseMultiChainAaveDataResult {
  const [multiChainReserves, setMultiChainReserves] =
    useState<MultiChainReserveData>({});
  const [allTokens, setAllTokens] = useState<string[]>([]);

  // Get supported chains (including testnet for development)
  const supportedChains =
    process.env.NODE_ENV === "development"
      ? [1, 137, 8453, 43114, 11155111]
      : getSupportedMainnetChainIds();

  // Fetch data from each chain
  const chainResults = supportedChains.map((chainId) => {
    const chainInfo = CHAIN_INFO[chainId as keyof typeof CHAIN_INFO];
    const { reserves, loading, error } = useAaveMarketData(
      chainId,
      userAddress
    );

    return {
      chainId,
      chainName: chainInfo.name,
      chainIcon: chainInfo.icon,
      chainColor: chainInfo.color,
      reserves,
      loading,
      error,
    };
  });

  useEffect(() => {
    // Collect all unique token symbols across all chains
    const tokenSet = new Set<string>();
    chainResults.forEach((chain) => {
      Object.keys(chain.reserves).forEach((symbol) => tokenSet.add(symbol));
    });
    const tokens = Array.from(tokenSet).sort();
    setAllTokens(tokens);

    // Build multi-chain reserves data structure
    const multiChainData: MultiChainReserveData = {};

    tokens.forEach((symbol) => {
      multiChainData[symbol] = {};

      chainResults.forEach((chain) => {
        const reserve = chain.reserves[symbol];
        multiChainData[symbol][chain.chainId] = {
          chainName: chain.chainName,
          chainIcon: chain.chainIcon,
          chainColor: chain.chainColor,
          supplyAPY: reserve ? reserve.supplyAPY : "0.00",
          available: !!reserve && reserve.isActive,
          loading: chain.loading,
          error: chain.error?.message,
        };
      });
    });

    setMultiChainReserves(multiChainData);
  }, [
    chainResults
      .map((r) =>
        JSON.stringify({
          reserves: r.reserves,
          loading: r.loading,
          error: r.error?.message,
        })
      )
      .join("|"),
  ]);

  // Calculate global loading state
  const globalLoading = chainResults.some((chain) => chain.loading);

  return {
    chainData: chainResults,
    multiChainReserves,
    globalLoading,
    allTokens,
  };
}

/**
 * Get the best APY for a token across all chains
 */
export function getBestAPY(tokenData: MultiChainReserveData[string]): {
  chainId: number;
  chainName: string;
  chainIcon: string;
  apy: string;
} | null {
  let bestChain = null;
  let bestAPY = 0;

  Object.entries(tokenData).forEach(([chainId, data]) => {
    if (data.available && !data.loading && !data.error) {
      const apy = parseFloat(data.supplyAPY) || 0;
      if (apy > bestAPY) {
        bestAPY = apy;
        bestChain = {
          chainId: parseInt(chainId),
          chainName: data.chainName,
          chainIcon: data.chainIcon,
          apy: data.supplyAPY,
        };
      }
    }
  });

  return bestChain;
}

/**
 * Get chain-specific data for a token
 */
export function getTokenChainData(
  multiChainReserves: MultiChainReserveData,
  symbol: string,
  chainId: number
) {
  return multiChainReserves[symbol]?.[chainId];
}
