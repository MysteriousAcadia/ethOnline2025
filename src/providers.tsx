import { useEffect, useRef, useMemo } from "react";
import { WagmiProvider, useAccount } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { NexusProvider, useNexus } from "@avail-project/nexus-widgets";
import { AaveProvider, production, AaveClient } from "@aave/react";
import { config } from "./config/wagmi";
import { sepolia, polygon } from "wagmi/chains";
import { NetworkProvider, useNetwork } from "./contexts/NetworkContext";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

// WalletBridge component forwards wallet provider from wagmi to Nexus
function WalletBridge() {
  const { connector, isConnected } = useAccount();
  const { setProvider, sdk, isSdkInitialized, initializeSdk } = useNexus();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    console.log("WalletBridge state:", {
      isConnected,
      hasConnector: !!connector,
      hasGetProvider: !!connector?.getProvider,
      isSdkInitialized,
      hasSdk: !!sdk,
      hasInitializedRef: hasInitializedRef.current,
    });

    // Reset initialization flag when wallet disconnects
    if (!isConnected) {
      hasInitializedRef.current = false;
      return;
    }

    // Skip if already initialized or in progress
    if (hasInitializedRef.current || isSdkInitialized) {
      return;
    }

    if (isConnected && connector?.getProvider) {
      console.log("Getting provider from connector...");
