import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useNexus } from "@avail-project/nexus-widgets";
import { Wallet, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useNetwork } from "../contexts/NetworkContext";

interface TokenBalance {
  symbol: string;
  name: string;
  total: string;
  decimals: number;
  chains: {
    chainId: number;
    chainName: string;
    balance: string;
    logo: string;
  }[];
}

const SUPPORTED_TOKENS = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "USDT", name: "Tether USD" },
  { symbol: "POL", name: "Polygon" },
  { symbol: "MON", name: "Monad" },
];

const CHAIN_INFO: Record<number, { name: string; logo: string }> = {
  11155111: {
    name: "Sepolia",
    logo: "https://assets.coingecko.com/asset_platforms/images/279/large/ethereum.png",
  },
  84532: {
    name: "Base Sepolia",
    logo: "https://pbs.twimg.com/profile_images/1945608199500910592/rnk6ixxH_400x400.jpg",
  },
  421614: {
    name: "Arbitrum Sepolia",
    logo: "https://assets.coingecko.com/coins/images/16547/large/arb.jpg",
  },
  11155420: {
    name: "Optimism Sepolia",
    logo: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  },
  80002: {
    name: "Polygon Amoy",
    logo: "https://assets.coingecko.com/coins/images/4713/small/polygon.png",
  },
  10143: {
    name: "Monad Testnet",
    logo: "https://assets.coingecko.com/coins/images/38927/standard/monad.jpg",
  },
};

export function UnifiedBalance() {
  const { address, isConnected } = useAccount();
  const { sdk, isSdkInitialized } = useNexus();
  const { networkMode } = useNetwork();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const hasFetched = useRef(false);
  const isLoadingRef = useRef(false);

  const toggleToken = (symbol: string) => {
    setExpandedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const fetchBalances = useCallback(async () => {
    console.log("Starting fetchBalances...");
    console.log("SDK state:", { sdk: !!sdk, address: !!address, isConnected, isSdkInitialized });
    
    if (!sdk || !address || !isConnected) {
      console.log("Missing basic requirements");
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isLoadingRef.current) {
      console.log("Already loading, skipping...");
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log("Fetching unified balances for address:", address);

      // Try to get unified balances - if SDK isn't initialized, this will throw an error
      const unifiedBalances = await sdk.getUnifiedBalances();
      console.log("Unified balances from Nexus SDK:", unifiedBalances);

      const tokenBalances: TokenBalance[] = [];

      for (const token of SUPPORTED_TOKENS) {
        // Find this token in the unified balances
        const tokenBalance = unifiedBalances.find(
          (asset: any) =>
            asset.symbol?.toUpperCase() === token.symbol.toUpperCase()
        );

        if (
          tokenBalance &&
          tokenBalance.breakdown &&
          tokenBalance.breakdown.length > 0
        ) {
          // Extract chain-specific balances
          const chainBalances = tokenBalance.breakdown
            .map((chainData: any) => ({
              chainId: chainData.chain.id,
              chainName:
                CHAIN_INFO[chainData.chain.id]?.name ||
                chainData.chain.name ||
                `Chain ${chainData.chain.id}`,
              balance: chainData.balance || "0",
              logo:
                CHAIN_INFO[chainData.chain.id]?.logo ||
                chainData.chain.logo ||
                "",
            }))
            .filter((c: any) => parseFloat(c.balance) > 0);

          tokenBalances.push({
            symbol: token.symbol,
            name: token.name,
            total: tokenBalance.balance || "0",
            decimals:
              tokenBalance.decimals ||
              (token.symbol === "USDC" || token.symbol === "USDT" ? 6 : 18),
            chains: chainBalances,
          });
        } else {
          // Token not found or has zero balance
          tokenBalances.push({
            symbol: token.symbol,
            name: token.name,
            total: "0",
            decimals:
              token.symbol === "USDC" || token.symbol === "USDT" ? 6 : 18,
            chains: [],
          });
        }
      }

      setBalances(tokenBalances);
      hasFetched.current = true;
      console.log("Balances fetched successfully:", tokenBalances);
    } catch (err) {
      console.error("Error fetching unified balances:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch balances";
      
      // If it's an initialization error, retry after a short delay
      if (errorMessage.includes("not initialized") || errorMessage.includes("CA not initialized")) {
        console.log("SDK not ready yet, will retry when state updates...");
        hasFetched.current = false; // Allow retry
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [sdk, address, isConnected]);

  // Fetch balances when SDK is available - retry on SDK state updates
  useEffect(() => {
    console.log("useEffect triggered:", { isConnected, address: !!address, sdk: !!sdk, isSdkInitialized, networkMode, hasFetched: hasFetched.current, isLoading: isLoadingRef.current });
    
    if (!isConnected || !address || !sdk) {
      hasFetched.current = false;
      return;
    }

    // Try to fetch balances if we haven't successfully fetched yet
    // The fetchBalances function will handle SDK initialization errors gracefully
    if (!hasFetched.current && !isLoadingRef.current) {
      console.log("Attempting to fetch balances...");
      fetchBalances();
    }
  }, [sdk, isConnected, address, isSdkInitialized, networkMode, fetchBalances]);

  // Reset and refetch when network mode changes
  useEffect(() => {
    if (isConnected && address && sdk) {
      console.log("Network mode changed to:", networkMode, "- refreshing balances");
      hasFetched.current = false;
      fetchBalances();
    }
  }, [networkMode, isConnected, address, sdk, fetchBalances]);

  const formatBalance = (balance: string, decimals: number): string => {
    const value = parseFloat(balance);
    if (value === 0) return "0.00";
    if (value < 0.01) return "< 0.01";
    return value.toFixed(decimals === 6 ? 2 : 4);
  };

  if (!isConnected) {
    return (
      <div className="p-8 rounded-2xl glass-card border-2 border-neon-violet/20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-violet/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-neon-violet" />
          </div>
          <div>
            <h3
              className="text-xl font-bold text-off-white"
              style={{ fontFamily: "Inter Tight, sans-serif" }}
            >
              Unified Balance
            </h3>
            <p className="text-sm text-soft-gray">
              Connect your wallet to view balances
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border-2 border-neon-violet/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-violet/10 flex items-center justify-center">
              <Wallet className="h-6 w-6 text-neon-violet" />
            </div>
            <div>
              <h3
                className="text-xl font-bold text-off-white"
                style={{ fontFamily: "Inter Tight, sans-serif" }}
              >
                Unified Balance
              </h3>
              <p className="text-sm text-soft-gray">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              hasFetched.current = false;
              fetchBalances();
            }}
            disabled={loading}
            className="p-3 rounded-xl glass-card glass-card-hover transition-all duration-300 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-5 w-5 text-neon-violet ${
                loading ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/20 to-transparent border border-red-500/30">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="p-8 rounded-2xl glass-card border-2 border-aqua-blue/20 text-center">
          <div className="flex flex-col items-center gap-4">
