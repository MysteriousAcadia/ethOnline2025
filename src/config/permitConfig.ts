/**
 * EIP-2612 Permit Domain Configuration
 * 
 * Different chains use different domain parameters for USDC and other tokens.
 * This file maintains the correct parameters for each token on each chain.
 * 
 * Reference: https://eips.ethereum.org/EIPS/eip-2612
 */

import type { NetworkMode } from "../contexts/NetworkContext";

export interface PermitDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}

/**
 * Token permit domain configurations by chain
 */
export const TOKEN_PERMIT_DOMAINS = {
  // Sepolia Testnet
  sepolia: {
    USDC: {
      name: "USDC",
      version: "1",
    },
    USDT: {
      name: "Tether USD", 
      version: "1",
    },
    DAI: {
      name: "Dai Stablecoin",
      version: "1",
    },
  },
  
