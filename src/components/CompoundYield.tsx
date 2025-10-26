import { useAccount, useChainId } from "wagmi";
import { TrendingUp, Info } from "lucide-react";
import { getCompoundConfigByChainId } from "../config/compound";
import { useCompoundMarketData } from "../hooks/useCompoundMarketData";
import { useCompoundUserPosition } from "../hooks/useCompoundUserPosition";
import { CompoundTokenCard } from "./CompoundTokenCard";

const CHAIN_INFO = {
  137: {
    // Polygon
    name: "Polygon",
    icon: "https://statics.aave.com/polygon.svg",
    color: "#8247E5",
  },
  8453: {
    // Base
    name: "Base",
    icon: "https://cryptologos.cc/logos/coinbase-coin-logo.svg",
    color: "#0052FF",
  },
} as const;

interface CompoundYieldProps {
  className?: string;
}

export function CompoundYield({ className = "" }: CompoundYieldProps) {
  const { address } = useAccount();
  const chainId = useChainId();

  // Get Compound config based on connected chain
  const COMPOUND_CONFIG = getCompoundConfigByChainId(chainId);

  // Fetch market data
  const {
    marketData,
    loading: loadingMarketData,
    error: marketDataError,
  } = useCompoundMarketData(chainId);

  // Fetch user position
  const { position: userPosition } = useCompoundUserPosition(chainId, address);

  // Get chain info
  const chainInfo =
    CHAIN_INFO[chainId as keyof typeof CHAIN_INFO] || CHAIN_INFO[8453];

  // Format large numbers
  const formatLargeNumber = (value: string): string => {
    const num = parseFloat(value);
    if (num > 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num > 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-off-white flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-aqua-blue" />
            Compound V3
          </h2>
          <p className="text-soft-gray mt-1">
            Supply assets to earn yield or use as collateral to borrow {COMPOUND_CONFIG.BASE_ASSET.symbol}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg glass-card border border-aqua-blue/20">
          <img
            src={chainInfo.icon}
            alt={chainInfo.name}
            className="w-5 h-5 object-contain"
          />
          <span className="text-sm font-medium text-off-white">
            {chainInfo.name}
          </span>
        </div>
      </div>

      {/* Market Overview */}
      {marketData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl glass-card border border-aqua-blue/20">
            <div className="text-xs text-soft-gray mb-1">Supply APY</div>
            <div className="text-2xl font-bold text-aqua-blue">
              {marketData.supplyAPY}%
            </div>
            <div className="text-xs text-soft-gray mt-1">
              Earn on {COMPOUND_CONFIG.BASE_ASSET.symbol}
            </div>
          </div>
          <div className="p-4 rounded-xl glass-card border border-neon-violet/20">
            <div className="text-xs text-soft-gray mb-1">Borrow APY</div>
            <div className="text-2xl font-bold text-neon-violet">
              {marketData.borrowAPY}%
            </div>
            <div className="text-xs text-soft-gray mt-1">
              Borrow {COMPOUND_CONFIG.BASE_ASSET.symbol}
