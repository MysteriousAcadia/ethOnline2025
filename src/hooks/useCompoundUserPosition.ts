/**
 * Hook to fetch user's Compound V3 position
 * Includes base asset balance (supply/borrow) and collateral balances
 */

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { getCompoundConfigByChainId, COMET_ABI, ERC20_ABI } from "../config/compound";

export interface UserCollateralBalance {
  symbol: string;
  address: string;
  balance: string; // Formatted balance
  balanceRaw: bigint;
  decimals: number;
}

export interface UserCompoundPosition {
  baseAssetBalance: string; // Formatted (positive = supply, negative = borrow)
  baseAssetBalanceRaw: bigint;
  isSupplying: boolean;
  isBorrowing: boolean;
  borrowBalance: string; // Formatted borrow amount
  borrowBalanceRaw: bigint;
  collateralBalances: UserCollateralBalance[];
  walletBalances: Record<string, string>; // Wallet balances for each asset
  isCollateralized: boolean;
}

export interface UseCompoundUserPositionResult {
  position: UserCompoundPosition;
  loading: boolean;
  error: Error | null;
}

export function useCompoundUserPosition(
  chainId: number,
  userAddress?: string
): UseCompoundUserPositionResult {
  const [position, setPosition] = useState<UserCompoundPosition>({
    baseAssetBalance: "0",
    baseAssetBalanceRaw: 0n,
    isSupplying: false,
    isBorrowing: false,
    borrowBalance: "0",
    borrowBalanceRaw: 0n,
    collateralBalances: [],
    walletBalances: {},
    isCollateralized: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const COMPOUND_CONFIG = getCompoundConfigByChainId(chainId);

  // Get base asset balance (can be positive or negative)
  const { data: baseBalance } = useReadContract({
    address: COMPOUND_CONFIG.COMET as `0x${string}`,
    abi: COMET_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Get borrow balance
  const { data: borrowBalance } = useReadContract({
    address: COMPOUND_CONFIG.COMET as `0x${string}`,
    abi: COMET_ABI,
    functionName: "borrowBalanceOf",
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Check if borrow is collateralized
  const { data: isCollateralized } = useReadContract({
    address: COMPOUND_CONFIG.COMET as `0x${string}`,
    abi: COMET_ABI,
    functionName: "isBorrowCollateralized",
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Get wallet balance of base asset
  const { data: baseWalletBalance } = useReadContract({
    address: COMPOUND_CONFIG.BASE_ASSET.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Get collateral balances for each collateral asset
  const collateralAssets = Object.values(COMPOUND_CONFIG.COLLATERAL_ASSETS);
  
  // Create read contract calls for each collateral asset
  const collateralBalanceHooks = collateralAssets.map((asset) => {
    return useReadContract({
      address: COMPOUND_CONFIG.COMET as `0x${string}`,
      abi: COMET_ABI,
      functionName: "collateralBalanceOf",
      args: userAddress
        ? [userAddress as `0x${string}`, asset.address as `0x${string}`]
        : undefined,
      query: {
        enabled: !!userAddress,
      },
    });
  });

  // Get wallet balances for collateral assets
  const walletBalanceHooks = collateralAssets.map((asset) => {
    return useReadContract({
      address: asset.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: userAddress ? [userAddress as `0x${string}`] : undefined,
      query: {
        enabled: !!userAddress,
      },
    });
  });

  useEffect(() => {
    if (!userAddress) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Process base asset balance
      const baseBalanceNum = baseBalance ? BigInt(baseBalance.toString()) : 0n;
      const isSupplying = baseBalanceNum > 0n;
      const isBorrowing = baseBalanceNum < 0n;

      const baseBalanceFormatted =
        (Number(baseBalanceNum) / 10 ** COMPOUND_CONFIG.BASE_ASSET.decimals).toFixed(
          6
        );

