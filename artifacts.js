// ABI for GoldVault.sol (BOT Chain mainnet). No bytecode: the contract is already deployed.
window.ARTIFACTS = {
  main: {
    abi: [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function decimals() view returns (uint8)",
      "function owner() view returns (address)",
      "function pricePerGram() view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function balanceOf(address) view returns (uint256)",
      "function reserves(uint256) view returns (uint256 grams, string ref, uint64 timestamp)",
      "function reserveCount() view returns (uint256)",
      "function reservedGrams() view returns (uint256)",
      "function backingRatioBps() view returns (uint256)",
      "function updateReserve(uint256 grams, string ref)",
      "function setPrice(uint256 p)",
      "function mint(uint256 grams) payable",
      "function redeem(uint256 grams)",
      "function transfer(address to, uint256 amount) returns (bool)",
      "function fundPayouts() payable",
      "event Transfer(address indexed from, address indexed to, uint256 value)",
      "event ReserveUpdated(uint256 indexed index, uint256 grams, string ref)",
      "event PriceUpdated(uint256 price)",
      "event Minted(address indexed user, uint256 grams, uint256 paid)",
      "event Redeemed(address indexed user, uint256 grams, uint256 received)"
    ]
  }
};
