// ECONNRESET error for hardhat network: The ECONNRESET error typically indicates that the TCP connection was abruptly closed by the remote server, or some network issue occurred.

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { expect } = require("chai");

class Blockchain {
  constructor(name, tokenName, nftMinterName, nftBridgeName) {
    this.name = name;

    this.tokenName = tokenName;
    this.nftMinterName = nftMinterName;
    this.nftBridgeName = nftBridgeName;

    this.tokenInfo = null;
    this.nftMinterInfo = null;
    this.nftBridgeInfo = null;

    this.token = null;
    this.nftMinter = null;
    this.nftBridge = null;
  }

  async setContracts() {
    const folder_path = path.join(
      __dirname,
      "../dapp_contracts_info/",
      this.name,
      "/"
    );

    this.tokenInfo = JSON.parse(
      fs.readFileSync(path.join(folder_path, `${this.tokenName}.json`), "utf8")
    );
    this.nftMinterInfo = JSON.parse(
      fs.readFileSync(
        path.join(folder_path, `${this.nftMinterName}.json`),
        "utf8"
      )
    );
    this.nftBridgeInfo = JSON.parse(
      fs.readFileSync(
        path.join(folder_path, `${this.nftBridgeName}.json`),
        "utf8"
      )
    );

    this.token = new hre.ethers.Contract(
      this.tokenInfo.contractInstances[0].address,
      this.tokenInfo.abi
    );
    this.nftMinter = new hre.ethers.Contract(
      this.nftMinterInfo.contractInstances[0].address,
      this.nftMinterInfo.abi
    );
    this.nftBridge = new hre.ethers.Contract(
      this.nftBridgeInfo.contractInstances[0].address,
      this.nftBridgeInfo.abi
    );
  }
}

async function main() {
  const b1 = new Blockchain("blockchain_1", "Token", "NFTMinter", "NFTBridge");
  await b1.setContracts();

  console.log("b1: ", b1);

  [owner, user1, user2] = await hre.ethers.getSigners();

  // 0: Minting NFT tokens.

  await (
    await user1.sendTransaction({
      to: b1.nftMinter.target,
      value: ethers.parseEther("0.0005"),
      data: new hre.ethers.Interface(b1.nftMinterInfo.abi).encodeFunctionData(
        "mint(address,uint256)",
        [user1.address, 5]
      ),
    })
  ).wait();

  console.log(
    "user1_tokens: ",
    await b1.nftMinter.connect(user1).walletOfOwner(user1.address)
  );

  // Moving NFT from one blockchain to another blockchain.

  const user_account_1 = user1;
  const user_account_2 = user2;
  const tokenId = 3;

  // 1:
  let account_address = await b1.nftMinter.connect(owner).ownerOf(tokenId);
  expect(account_address).to.equal(user_account_1.address);

  // 7:
  await b1.nftMinter
    .connect(user_account_1)
    .approve(b1.nftBridge.target, tokenId);
  account_address = await b1.nftMinter
    .connect(user_account_1)
    .getApproved(tokenId);
  expect(account_address).to.equal(b1.nftBridge.target);

  // 8:
  let nftMovingFeeCustom = await b1.nftBridge
    .connect(user_account_1)
    .nftMovingFeeCustom();
  await b1.token
    .connect(user_account_1)
    .approve(b1.nftBridge.target, nftMovingFeeCustom);
  let allowance = await b1.token
    .connect(user_account_1)
    .allowance(user_account_1.address, b1.nftBridge.target);
  expect(allowance).to.equal(nftMovingFeeCustom);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.log(
    "\n--------------------------- ERROR --------------------------\n"
  );
  console.error(error);
  console.log(
    "\n------------------------------------------------------------\n"
  );
  console.log(
    "ERROR NOTE:\n \
      1) Make sure hardhat network is running."
  );
  process.exitCode = 1;
});
