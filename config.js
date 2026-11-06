// GoldVault on BOT Chain mainnet.
// GGOLD has 18 decimals: 1 GGOLD = 1 gram. Gram inputs below are typed in whole/decimal grams
// and converted to 18-decimal units before they reach the contract.
window.APP_CONFIG = {
  address: "0xa1b6C8623cAa6D7Afd721dea68D1110b533BDb97",
  name: "GoldVault",
  tagline: "A gold-backed token with a public proof-of-reserve trail.",

  stats: [
    { label: "Price per gram",   fn: "pricePerGram",   fmt: "bot" },
    { label: "GGOLD supply",     fn: "totalSupply",    fmt: "grams" },
    { label: "Proven reserve",   fn: "reservedGrams",  fmt: "grams" },
    { label: "Backing ratio",    fn: "backingRatioBps", fmt: "bps" },
    { label: "Payout pool",      fn: "__balance",      fmt: "bot" },
    { label: "Your GGOLD",       fn: "balanceOf",      fmt: "grams", args: ["me"] }
  ],

  // cost: "mint"  → sends exactly grams × pricePerGram as BOT
  // valueInput    → that input is sent as BOT (msg.value) instead of as an argument
  // owner: true   → only shown to the contract owner
  actions: [
    { title: "Mint GGOLD", fn: "mint", cost: "mint", button: "Mint",
      desc: "Pay BOT at the current price to mint GGOLD, up to the proven reserve.",
      inputs: [{ id: "grams", label: "Grams", type: "grams", default: "1" }] },
    { title: "Redeem GGOLD", fn: "redeem", button: "Redeem",
      desc: "Burn GGOLD and receive BOT at the current price from the payout pool.",
      inputs: [{ id: "grams", label: "Grams", type: "grams", default: "1" }] },
    { title: "Transfer GGOLD", fn: "transfer", button: "Send",
      desc: "Send GGOLD to another wallet.",
      inputs: [{ id: "to", label: "Recipient", type: "address" }, { id: "amount", label: "Grams", type: "grams", default: "1" }] },
    { title: "Fund payout pool", fn: "fundPayouts", valueInput: "amount", button: "Fund",
      desc: "Add BOT to the pool that pays redemptions. Anyone can fund it.",
      inputs: [{ id: "amount", label: "Amount (BOT)", type: "bot", default: "1" }] },
    { title: "Publish reserve (owner)", fn: "updateReserve", owner: true, button: "Publish",
      desc: "Record the audited grams held in the vault, with a link or IPFS CID to the audit report.",
      inputs: [{ id: "grams", label: "Grams in vault", type: "grams" }, { id: "ref", label: "Audit reference (URL or CID)", type: "text" }] },
    { title: "Set price (owner)", fn: "setPrice", owner: true, button: "Update price",
      desc: "BOT per 1 GGOLD. Applies to both mint and redeem.",
      inputs: [{ id: "p", label: "Price (BOT per gram)", type: "bot" }] }
  ],

  views: [
    { title: "Balance of", fn: "balanceOf", fmt: "grams", button: "Look up",
      inputs: [{ id: "a", label: "Address", type: "address", meDefault: true }] },
    { title: "Mint quote", fn: "__quote", fmt: "bot", button: "Quote",
      desc: "BOT needed to mint (or received when redeeming) this many grams.",
      inputs: [{ id: "grams", label: "Grams", type: "grams", default: "1" }] }
  ]
};
