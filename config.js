// GoldVault platform configuration
window.APP_CONFIG = {
  address: "0x0000000000000000000000000000000000000000",
  slug: "goldvault",
  name: "GoldVault",
  accent: "#d4a437",
  tagline: "A gold-backed token with a public proof-of-reserve trail.",
  about:
    "One GGOLD equals one gram of physical gold. The admin publishes verifiable reserve records, and minting is capped by the latest record. Mint and redeem settle in the stablecoin at the admin-set price per gram.",
  tokens: ["payToken"],
  deploy: {
    tokens: [{ name: "Mock USD", symbol: "mUSD" }],
    args: ["$t0", "70000000000000000000"]
  },
  amountFields: ["grams", "payoutPool"],
  timeFields: ["timestamp"],
  stats: [
    { label: "Price per gram", fn: "pricePerGram", fmt: "token" },
    { label: "GGOLD supply", fn: "totalSupply", fmt: "token" },
    { label: "Grams in reserve", fn: "reservedGrams", fmt: "token" },
    { label: "Backing ratio", fn: "backingRatioBps", fmt: "bps" },
    { label: "Your GGOLD", fn: "balanceOf", fmt: "token", args: ["me"] },
    { label: "Payout pool", fn: "payoutPool", fmt: "token" }
  ],
  actions: [
    {
      title: "Mint GGOLD",
      fn: "mint",
      desc: "Buy gold-backed tokens with mUSD. One GGOLD = one gram.",
      inputs: [{ id: "grams", label: "Grams", type: "amount", default: "5" }]
    },
    {
      title: "Redeem GGOLD",
      fn: "redeem",
      desc: "Burn GGOLD and receive mUSD at the current price per gram.",
      inputs: [{ id: "grams", label: "Grams", type: "amount", default: "5" }]
    },
    {
      title: "Publish reserve record",
      fn: "updateReserve",
      desc: "Admin: publish the grams of gold held in the vault, with an audit reference.",
      inputs: [
        { id: "grams", label: "Grams in vault", type: "amount", default: "100" },
        { id: "ref", label: "Audit reference", type: "text", default: "Vault audit #1" }
      ]
    },
    {
      title: "Set price per gram",
      fn: "setPrice",
      desc: "Admin: update the price per gram (in mUSD, 18 decimals).",
      inputs: [{ id: "p", label: "Price", type: "amount", default: "70" }]
    },
    {
      title: "Fund payout pool",
      fn: "fundPayouts",
      desc: "Admin: deposit mUSD into the payout pool for redemptions.",
      inputs: [{ id: "amount", label: "Amount", type: "amount", default: "1000" }]
    }
  ],
  views: [
    {
      title: "Reserve record",
      fn: "reserves",
      desc: "Look up a specific reserve record by number.",
      inputs: [{ id: "id", label: "Record number", type: "uint", default: "0" }]
    },
    {
      title: "Reserve count",
      fn: "reserveCount",
      button: "Check",
      desc: "See how many reserve records have been published.",
      inputs: []
    }
  ]
};
