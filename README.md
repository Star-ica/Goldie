# GoldVault

A gold-backed token with a public proof-of-reserve trail.

One GGOLD equals one gram. The admin publishes reserve records, and minting is capped by the latest record. Mint and redeem settle in the stablecoin at the admin price per gram.

## Run
1. Serve this folder: `python3 -m http.server 8080` and open http://localhost:8080
2. Click **Connect wallet**. The app adds/switches to BOT Chain Testnet (Chain ID 968, RPC https://rpc.bohr.life, explorer https://scan.botchain.ai).
3. Click **Deploy new copy** (deploys the test token(s) and GoldVault), or paste an existing address and click **Use this address**. To pin an address for everyone, set `address` in config.js.
4. Use **Get test tokens** and **Approve**, then the action cards.

## Manual deploy (Remix)
Open contracts/GoldVault.sol, compile with 0.8.20+ (EVM version paris), deploy TestToken first, then GoldVault with the constructor arguments listed in config.js under deploy.args.

## Notes
Testnet demo code, not audited. TestToken has a public faucet and mint.
# Goldie
