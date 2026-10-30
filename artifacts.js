// Contract ABIs and bytecode for GoldVault platform
window.ARTIFACTS = {
  main: {
    abi: [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function pricePerGram() view returns (uint256)",
      "function reservedGrams() view returns (uint256)",
      "function backingRatioBps() view returns (uint256)",
      "function reserveCount() view returns (uint256)",
      "function reserves(uint256 id) view returns (uint256 grams, uint256 timestamp, string ref)",
      "function getLatestReserve() view returns (uint256 grams, uint256 timestamp, string ref)",
      "function mint(uint256 grams) payable",
      "function redeem(uint256 grams)",
      "function updateReserve(uint256 grams, string ref)",
      "function setPrice(uint256 p)",
      "function fundPayouts(uint256 amount)",
      "function payToken() view returns (address)",
      "function admin() view returns (address)",
      "function payoutPool() view returns (uint256)",
      "function Transfer(address indexed from, address indexed to, uint256 value)",
      "function ReserveUpdated(uint256 grams, uint256 timestamp, string ref)",
      "function PriceUpdated(uint256 oldPrice, uint256 newPrice)",
      "function Minted(address indexed user, uint256 grams, uint256 cost)",
      "function Redeemed(address indexed user, uint256 grams, uint256 payout)"
    ],
    bytecode: "0x"
  },
  token: {
    abi: [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function approve(address spender, uint256 amount) returns (bool)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function faucet()",
      "function mint(address to, uint256 amount)"
    ],
    bytecode: "0x"
  }
};
