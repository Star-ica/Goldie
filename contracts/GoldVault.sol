// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "./Token.sol";

/// @title GoldVault - gold-backed token (1 token = 1 gram). The admin publishes proof-of-reserve records;
/// minting is capped by the latest reserve. Mint and redeem settle against a stablecoin at the admin price.
contract GoldVault {
    string public constant name = "Gold Vault Token";
    string public constant symbol = "GGOLD";
    uint8 public constant decimals = 18;

    IERC20 public immutable payToken;
    address public owner;
    uint256 public pricePerGram; // payment-token units per 1 GGOLD (1e18 scale)
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    struct Reserve { uint256 grams; string ref; uint64 timestamp; }
    Reserve[] public reserves;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event ReserveUpdated(uint256 indexed index, uint256 grams, string ref);
    event PriceUpdated(uint256 price);
    event Minted(address indexed user, uint256 grams, uint256 paid);
    event Redeemed(address indexed user, uint256 grams, uint256 received);

    modifier onlyOwner() { require(msg.sender == owner, "owner only"); _; }

    constructor(address _payToken, uint256 _pricePerGram) {
        payToken = IERC20(_payToken);
        pricePerGram = _pricePerGram;
        owner = msg.sender;
    }

    function reserveCount() external view returns (uint256) { return reserves.length; }
    function reservedGrams() public view returns (uint256) { return reserves.length == 0 ? 0 : reserves[reserves.length - 1].grams; }
    function backingRatioBps() external view returns (uint256) {
        return totalSupply == 0 ? 10000 : (reservedGrams() * 10000) / totalSupply;
    }

    function updateReserve(uint256 grams, string calldata ref) external onlyOwner {
        reserves.push(Reserve(grams, ref, uint64(block.timestamp)));
        emit ReserveUpdated(reserves.length - 1, grams, ref);
    }
    function setPrice(uint256 p) external onlyOwner { require(p > 0, "zero"); pricePerGram = p; emit PriceUpdated(p); }

    function mint(uint256 grams) external {
        require(grams > 0 && totalSupply + grams <= reservedGrams(), "exceeds proven reserve");
        uint256 cost = (grams * pricePerGram) / 1e18;
        totalSupply += grams; balanceOf[msg.sender] += grams;
        require(payToken.transferFrom(msg.sender, address(this), cost), "transfer");
        emit Transfer(address(0), msg.sender, grams);
        emit Minted(msg.sender, grams, cost);
    }
    function redeem(uint256 grams) external {
        require(grams > 0 && balanceOf[msg.sender] >= grams, "balance");
        uint256 payout = (grams * pricePerGram) / 1e18;
        require(payToken.balanceOf(address(this)) >= payout, "payout pool low");
        balanceOf[msg.sender] -= grams; totalSupply -= grams;
        require(payToken.transfer(msg.sender, payout), "transfer");
        emit Transfer(msg.sender, address(0), grams);
        emit Redeemed(msg.sender, grams, payout);
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount; balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    function fundPayouts(uint256 amount) external {
        require(payToken.transferFrom(msg.sender, address(this), amount), "transfer");
    }
}
