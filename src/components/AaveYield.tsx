import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { TrendingUp, Info, Zap, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useNetwork } from "../contexts/NetworkContext";
import { useAaveMarketData } from "../hooks/useAaveMarketData";
import { useAaveUserPosition } from "../hooks/useAaveUserPosition";
import { useAaveUserSupplies } from "../hooks/useAaveUserSupplies";
import {
  useMultiChainAaveData,
  getBestAPY,
} from "../hooks/useMultiChainAaveData.ts";
import { AaveTokenCard } from "./AaveTokenCard";
import { getAaveConfigByChainId } from "../config/aave";

const CHAIN_INFO = {
  1: {
    // Ethereum
    name: "Ethereum",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
    color: "#627EEA",
  },
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
  43114: {
    // Avalanche
    name: "Avalanche",
    icon: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
    color: "#E84142",
  },
  11155111: {
    // Sepolia
    name: "Sepolia",
    icon: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
    color: "#627EEA",
  },
} as const;

interface AaveYieldProps {
  className?: string;
}

interface OptimizationResult {
  token: string;
  currentAPY: string;
  bestAPY: string;
  bestChainId: number;
  bestChainName: string;
  bestChainIcon: string;
  potentialGain: string;
}

export function AaveYield({ className = "" }: AaveYieldProps) {
  const { networkMode } = useNetwork();
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // State for optimization modal
  const [showOptimizationModal, setShowOptimizationModal] = useState(false);
  const [optimizationResults, setOptimizationResults] = useState<
    OptimizationResult[]
  >([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);

  // Get Aave config based on connected chain
  const AAVE_CONFIG = getAaveConfigByChainId(chainId);

  // Fetch real-time market data from Aave using official @aave/react SDK
  const {
    reserves: reservesData,
    loading: loadingMarketData,
    error: marketDataError,
  } = useAaveMarketData(AAVE_CONFIG.CHAIN_ID, address);

  // Fetch multi-chain APR data for comparison
  const { multiChainReserves, globalLoading: multiChainLoading } =
    useMultiChainAaveData(address);

  // Fetch user's Aave position (collateral, debt, health factor)
  const { position: userPosition } = useAaveUserPosition(
    AAVE_CONFIG.CHAIN_ID,
    address
  );

  // Fetch user's supplied positions (accurate per-token supplied amounts)
  const { supplies: userSupplies } = useAaveUserSupplies(
    AAVE_CONFIG.CHAIN_ID,
    address
  );

  // Debug log to verify supplied amounts
  if (address && Object.keys(userSupplies).length > 0) {
    console.log("User Supplies (from useUserSupplies hook):", userSupplies);
  }

  // Get chain info based on connected chain
  const chainInfo =
    CHAIN_INFO[chainId as keyof typeof CHAIN_INFO] || CHAIN_INFO[137];

  // Get all available markets (all reserves that are active) sorted by APY (highest first)
  const availableMarkets = Object.values(reservesData)
    .filter((reserve) => reserve.isActive)
    .sort((a, b) => {
      const apyA = parseFloat(a.supplyAPY) || 0;
      const apyB = parseFloat(b.supplyAPY) || 0;
      return apyB - apyA; // Descending order (highest APY first)
    });

  // Get available liquidity for a token
  const getAvailableLiquidity = (liquidity: string): string => {
    const value = parseFloat(liquidity);
    if (value > 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value > 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  // Optimize yield - find best chains for all available tokens
  const optimizeYield = async () => {
    if (!multiChainReserves || multiChainLoading) return;

    setIsOptimizing(true);
    const results: OptimizationResult[] = [];

    // Analyze each available token
    availableMarkets.forEach((reserve) => {
      const tokenMultiChainData = multiChainReserves[reserve.symbol];
      if (!tokenMultiChainData) return;

      const bestChain = getBestAPY(tokenMultiChainData);
      if (!bestChain) return;

      const currentAPY = parseFloat(reserve.supplyAPY) || 0;
      const bestAPYValue = parseFloat(bestChain.apy) || 0;

      // Only include if there's a meaningful improvement (>0.1% APY difference)
      if (bestAPYValue > currentAPY + 0.1) {
        results.push({
          token: reserve.symbol,
          currentAPY: reserve.supplyAPY,
          bestAPY: bestChain.apy,
          bestChainId: bestChain.chainId,
          bestChainName: bestChain.chainName,
          bestChainIcon: bestChain.chainIcon,
          potentialGain: (bestAPYValue - currentAPY).toFixed(2),
        });
      }
    });

    // Sort by potential gain (highest first)
    results.sort(
      (a, b) => parseFloat(b.potentialGain) - parseFloat(a.potentialGain)
    );

    setOptimizationResults(results);
    setIsOptimizing(false);
    setShowOptimizationModal(true);
  };

  // Switch to the best chain for yields
  const switchToBestChain = async (targetChainId: number) => {
    if (!switchChain) return;

    setIsSwitchingChain(true);
    try {
      await switchChain({ chainId: targetChainId });
      setShowOptimizationModal(false);
      setOptimizationResults([]);
    } catch (error) {
      console.error("Failed to switch chain:", error);
    } finally {
      setIsSwitchingChain(false);
    }
  };

  // Get the most recommended chain (with highest potential gains)
  const getRecommendedChain = () => {
    if (optimizationResults.length === 0) return null;

    // Group by chain and sum potential gains
    const chainGains: Record<
      number,
      { gains: number; count: number; chainName: string; chainIcon: string }
    > = {};

    optimizationResults.forEach((result) => {
      if (!chainGains[result.bestChainId]) {
        chainGains[result.bestChainId] = {
          gains: 0,
          count: 0,
          chainName: result.bestChainName,
          chainIcon: result.bestChainIcon,
        };
      }
      chainGains[result.bestChainId].gains += parseFloat(result.potentialGain);
      chainGains[result.bestChainId].count += 1;
    });

    // Find chain with highest combined gains
    let bestChain = null;
    let maxGains = 0;

    Object.entries(chainGains).forEach(([chainId, data]) => {
      if (data.gains > maxGains) {
        maxGains = data.gains;
        bestChain = {
          chainId: parseInt(chainId),
          ...data,
        };
      }
    });

    return bestChain;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border-2 border-neon-violet/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-violet/30 to-neon-violet/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-neon-violet" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-off-white">
                Aave V3 Yield
              </h3>
              <p className="text-sm text-soft-gray">
                Supply tokens to earn interest or withdraw your funds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Optimize Yield Button */}
            <button
              onClick={optimizeYield}
              disabled={isOptimizing || multiChainLoading || !address}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-neon-violet to-aqua-blue hover:from-neon-violet/80 hover:to-aqua-blue/80 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 text-sm font-semibold text-white shadow-lg hover:shadow-neon-violet/25"
            >
              <Zap
                className={`h-4 w-4 ${isOptimizing ? "animate-pulse" : ""}`}
              />
              {isOptimizing ? "Analyzing..." : "Optimize Yield"}
            </button>

            {/* Current Chain Info */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card border border-neon-violet/20">
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
        </div>
      </div>

      {/* Info Banner */}
      {chainId === 11155111 ? (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-yellow-500 font-semibold mb-1">
                Testnet Limitation
              </p>
              <p className="text-yellow-400/80">
                Aave V3 Sepolia pools have supply caps. If your transaction
                fails with "SUPPLY_CAP_EXCEEDED", try a smaller amount or switch
                between USDC/USDT.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-aqua-blue/10 border border-aqua-blue/30">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-aqua-blue mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-aqua-blue font-semibold mb-1">
                {chainInfo.name} Network
              </p>
              <p className="text-aqua-blue/80">
                You're connected to {chainInfo.name}. Real funds and gas fees
                apply.
                {chainId === 137 &&
                  " You can bridge from any chain using the buttons below."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Position Summary (if user has supplied/borrowed) */}
      {address && userPosition && userPosition.hasPositions && (
        <div className="p-5 rounded-xl glass-card border-2 border-neon-violet/30 bg-gradient-to-br from-neon-violet/5 to-transparent">
          <h4 className="text-sm font-semibold text-off-white mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-neon-violet" />
            Your Aave Position
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-soft-gray mb-1">
                Total Collateral
              </div>
              <div className="text-lg font-bold text-aqua-blue">
                ${parseFloat(userPosition.totalCollateralUSD).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-soft-gray mb-1">Total Debt</div>
              <div className="text-lg font-bold text-off-white">
                ${parseFloat(userPosition.totalDebtUSD).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-soft-gray mb-1">
                Available to Borrow
              </div>
              <div className="text-lg font-bold text-off-white">
                ${parseFloat(userPosition.availableBorrowsUSD).toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-xs text-soft-gray mb-1">Health Factor</div>
              <div
                className={`text-lg font-bold ${
                  parseFloat(userPosition.healthFactor) > 2
                    ? "text-green-400"
                    : parseFloat(userPosition.healthFactor) > 1.5
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {parseFloat(userPosition.healthFactor) > 0
                  ? parseFloat(userPosition.healthFactor).toFixed(2)
                  : "∞"}
              </div>
            </div>
            <div>
              <div className="text-xs text-soft-gray mb-1">Current LTV</div>
              <div className="text-lg font-bold text-off-white">
                {(parseFloat(userPosition.ltv) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-soft-gray mb-1">
                Liquidation Threshold
              </div>
              <div className="text-lg font-bold text-off-white">
                {(
                  parseFloat(userPosition.currentLiquidationThreshold) * 100
                ).toFixed(2)}
                %
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading and Error displays */}
      {multiChainLoading && (
        <div className="p-4 rounded-xl bg-aqua-blue/10 border border-aqua-blue/30">
          <p className="text-aqua-blue text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 animate-pulse" />
            Loading APR data from all chains...
          </p>
        </div>
      )}

      {marketDataError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-red-500 text-sm">
            Error loading market data. Please try again.
          </p>
        </div>
      )}

      {/* Token Cards Grid - Show all available markets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {availableMarkets.map((reserve) => {
          // Get multi-chain APY data for this token
          const tokenMultiChainData = multiChainReserves[reserve.symbol];
          const multiChainAPY = tokenMultiChainData
            ? Object.entries(tokenMultiChainData).map(([chainId, data]) => ({
                chainId: parseInt(chainId),
                chainName: data.chainName,
                chainIcon: data.chainIcon,
                chainColor: data.chainColor,
                supplyAPY: data.supplyAPY,
                available: data.available,
                loading: data.loading,
                error: data.error,
              }))
            : [];

          return (
            <AaveTokenCard
              key={reserve.symbol}
              token={reserve.symbol}
              tokenName={reserve.name}
              tokenLogo={reserve.tokenLogo}
              networkMode={networkMode}
              targetChainId={chainId} // Pass the actual connected chain ID
              chainIcon={chainInfo.icon}
              chainName={chainInfo.name}
              chainColor={chainInfo.color}
              apy={reserve.supplyAPY}
              availableLiquidity={getAvailableLiquidity(
                reserve.availableLiquidity
              )}
              userBalance={reserve.suppliable}
              userATokenBalance={
                userSupplies[reserve.symbol]?.suppliedAmount || "0"
              }
              aTokenAddress={reserve.aTokenAddress}
              underlyingAsset={reserve.underlyingAsset}
              decimals={reserve.decimals}
              loading={loadingMarketData}
              showBridgeSupply={reserve.symbol === "USDC"}
              multiChainAPY={multiChainAPY}
              onOptimizeYield={switchToBestChain}
            />
          );
        })}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-card border border-aqua-blue/20">
          <div className="text-sm text-soft-gray mb-1">Total Markets</div>
          <div className="text-2xl font-bold text-aqua-blue">
            {availableMarkets.length}
          </div>
          <div className="text-xs text-soft-gray mt-1">Active reserves</div>
        </div>
        <div className="p-4 rounded-xl glass-card border border-neon-violet/20">
          <div className="text-sm text-soft-gray mb-1">Protocol</div>
          <div className="text-2xl font-bold text-neon-violet">Aave V3</div>
          <div className="text-xs text-soft-gray mt-1">
            Decentralized lending
          </div>
        </div>
        <div className="p-4 rounded-xl glass-card border border-soft-gray/20">
          <div className="text-sm text-soft-gray mb-1">Network</div>
          <div className="text-2xl font-bold text-off-white flex items-center gap-2">
            <img
              src={chainInfo.icon}
              alt={chainInfo.name}
              className="w-6 h-6"
            />
            <span>{chainInfo.name}</span>
          </div>
          <div className="text-xs text-soft-gray mt-1">
            Chain ID: {AAVE_CONFIG.CHAIN_ID}
          </div>
        </div>
      </div>

      {/* Optimization Modal */}
      {showOptimizationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-deep-space/95 backdrop-blur-lg border-2 border-neon-violet/30 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-violet/30 to-aqua-blue/30 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-neon-violet" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-off-white">
                    Yield Optimization Results
                  </h3>
                  <p className="text-sm text-soft-gray">
                    Found better APY opportunities
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOptimizationModal(false)}
                className="text-soft-gray hover:text-off-white transition-colors"
              >
                ✕
              </button>
            </div>

            {optimizationResults.length > 0 ? (
              <>
                {/* Recommended Chain */}
                {(() => {
                  const recommendedChain = getRecommendedChain();
                  return recommendedChain ? (
                    <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-green-400/20 border border-green-400/30">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={recommendedChain.chainIcon}
                            alt={recommendedChain.chainName}
                            className="w-8 h-8 object-contain"
                          />
                          <div>
                            <h4 className="font-semibold text-green-400">
                              Recommended: {recommendedChain.chainName}
                            </h4>
                            <p className="text-xs text-green-300">
                              {recommendedChain.count} tokens with higher APY (+
                              {recommendedChain.gains.toFixed(2)}% total gain)
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            switchToBestChain(recommendedChain.chainId)
                          }
                          disabled={isSwitchingChain}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-400/40 text-green-400 hover:bg-green-500/30 transition-all disabled:opacity-50"
                        >
                          {isSwitchingChain ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="h-4 w-4" />
                          )}
                          Switch Now
                        </button>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Individual Token Results */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-off-white mb-3">
                    All Optimization Opportunities:
                  </h4>
                  {optimizationResults.map((result, index) => (
                    <div
                      key={`${result.token}-${index}`}
                      className="flex items-center justify-between p-3 rounded-lg glass-card border border-soft-gray/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-lg font-bold text-off-white">
                          {result.token}
                        </div>
                        <ArrowRight className="h-4 w-4 text-soft-gray" />
                        <div className="flex items-center gap-2">
                          <img
                            src={result.bestChainIcon}
                            alt={result.bestChainName}
                            className="w-5 h-5 object-contain"
                          />
                          <span className="text-sm text-soft-gray">
                            {result.bestChainName}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-green-400">
                          {result.currentAPY}% → {result.bestAPY}%
                        </div>
                        <div className="text-xs text-green-300">
                          +{result.potentialGain}% APY
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-soft-gray/20 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-soft-gray" />
                </div>
                <h4 className="text-lg font-semibold text-off-white mb-2">
                  Already Optimized!
                </h4>
                <p className="text-soft-gray">
                  You're already on the best chain for current market
                  conditions.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowOptimizationModal(false)}
                className="px-4 py-2 rounded-lg glass-card border border-soft-gray/20 text-soft-gray hover:text-off-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
