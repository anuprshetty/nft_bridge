// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

class Utils {
  static dapp_contracts_info_folder_path;
  static contracts_setup_outputs = {};

  static {
    Utils.dapp_contracts_info_folder_path = Utils.setup_dapp_contracts_info();
  }

  static async display_hardhat_network_info() {
    let provider = hre.ethers.provider;

    const hardhat_network_info = {
      name: provider._networkName,
      url:
        "url" in hre.config.networks[provider._networkName]
          ? hre.config.networks[provider._networkName].url
          : "",
      chainId: parseInt((await provider.getNetwork()).chainId),
    };

    console.log("\n---------------- Hardhat Network Info ----------------");
    console.log(`${JSON.stringify(hardhat_network_info, null, 2)}`);
    console.log("------------------------------------------------------\n");
  }

  static setup_dapp_contracts_info() {
    const folder_path = path.join(__dirname, "..", "dapp_contracts_info/");

    if (!fs.existsSync(folder_path)) {
      fs.mkdirSync(folder_path);
    }

    return folder_path;
  }

  static async generate_dapp_contract_info(
    blockchainName,
    contractName,
    contractInstances
  ) {
    const artifact = await hre.artifacts.readArtifact(contractName);

    const dapp_contract_info = {
      contractName: artifact.contractName,
      sourceName: artifact.sourceName,
      contractInstances: contractInstances,
      abi: artifact.abi,
    };

    const folder_path = path.join(
      Utils.dapp_contracts_info_folder_path,
      blockchainName,
      "/"
    );

    if (!fs.existsSync(folder_path)) {
      fs.mkdirSync(folder_path);
    }

    fs.writeFileSync(
      path.join(folder_path, `${dapp_contract_info.contractName}.json`),
      JSON.stringify(dapp_contract_info, null, 2)
    );
  }

  static async getSigner() {
    var signer = null;
    if (hre.network.name === "eth_local_net_1") {
      signer = new hre.ethers.Wallet(
        hre.network.config.owner_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
    } else {
      signer = (await ethers.getSigners())[0];
    }
    return signer;
  }

  static get_hash_wallet_accounts() {
    var hash_wallet_accounts = [];
    var owner = null,
      user1 = null,
      user2 = null;
    if (hre.network.name === "eth_local_net_1") {
      owner = new hre.ethers.Wallet(
        hre.network.config.owner_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
      user1 = new hre.ethers.Wallet(
        hre.network.config.user1_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
      user2 = new hre.ethers.Wallet(
        hre.network.config.user2_private_key,
        new hre.ethers.JsonRpcProvider(hre.network.config.url)
      );
      hash_wallet_accounts = [owner, user1, user2];
    } else {
      hash_wallet_accounts = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "..", "hash_wallet_accounts.json"),
          "utf8"
        )
      );
    }
    return hash_wallet_accounts;
  }
}

class BaseContract {
  constructor(contract_name, contract_instance_name) {
    this.contract_name = contract_name;
    this.contract_instance_name = contract_instance_name;
    this.contract_address = "";
    this.contract = null;
    this.contract_constructor_args = [];

    if (!(this.contract_name in Utils.contracts_setup_outputs)) {
      Utils.contracts_setup_outputs[this.contract_name] = {};
    }
    Utils.contracts_setup_outputs[this.contract_name][
      this.contract_instance_name
    ] = {};
  }

  async deployContract() {
    const signer = await Utils.getSigner();

    const maxRetries = 6;
    const retryDelaySeconds = 10;

    let retries = 0;

    while (retries < maxRetries) {
      try {
        const Contract = await hre.ethers.getContractFactory(
          this.contract_name,
          signer
        );
        this.contract = await Contract.deploy(
          ...this.contract_constructor_args
        );
        await this.contract.waitForDeployment();
        break;
      } catch (error) {
        if ("code" in error && error.code === "UND_ERR_HEADERS_TIMEOUT") {
          console.error(
            `Error UND_ERR_HEADERS_TIMEOUT (${this.contract_name} contract - ${this.contract_instance_name} contract_instance). Retrying in ${retryDelaySeconds} seconds ...`
          );

          retries++;

          await new Promise((resolve) =>
            setTimeout(resolve, retryDelaySeconds * 1000)
          );
        } else {
          throw error;
        }
      }
    }

    if (retries === maxRetries) {
      console.error(
        `Error UND_ERR_HEADERS_TIMEOUT (${this.contract_name} contract - ${this.contract_instance_name} contract_instance). Failed to deploy after ${maxRetries} retries.`
      );
      process.exitCode = 1;
    }

    this.contract_address = this.contract.target;

    hre.ethernalUploadAst = true;
    await hre.ethernal.push({
      name: this.contract_name,
      address: this.contract_address,
    });

    Utils.contracts_setup_outputs[this.contract_name][
      this.contract_instance_name
    ]["address"] = this.contract_address;
  }

  async attachContract() {
    const Contract = await hre.ethers.getContractFactory(this.contract_name);

    this.contract = Contract.attach(this.contract_address);

    Utils.contracts_setup_outputs[this.contract_name][
      this.contract_instance_name
    ]["address"] = this.contract_address;
  }
}

class Token extends BaseContract {
  constructor(contract_instance_name, contract_constructor_args) {
    super("Token", contract_instance_name);

    this.symbol = contract_constructor_args.symbol;
    this.contract_constructor_args = [
      contract_constructor_args.name,
      contract_constructor_args.symbol,
      contract_constructor_args.maxSupply,
    ];
  }

  async mint(to, amount) {
    await (await this.contract.mint(to, amount)).wait();

    if (parseInt(await this.contract.balanceOf(to)) !== amount) {
      throw new Error(
        `Error in ${this.mint.name}() method while setting up ${this.contract_name} contract - ${this.contract_instance_name} contract_instance`
      );
    }
  }
}

class NFTMinter extends BaseContract {
  constructor(contract_instance_name, output_nft_info) {
    super("NFTMinter", contract_instance_name);

    this.output_nft_info = output_nft_info;
    this.contract_constructor_args = [
      output_nft_info.nft_collection_name,
      output_nft_info.symbol,
    ];
  }

  async addCustomPaymentCurrency(currency_index, name, symbol, token, cost) {
    await (
      await this.contract.addCustomPaymentCurrency(name, symbol, token, cost)
    ).wait();

    const customPaymentCurrency = await this.contract.customPaymentCurrencies(
      currency_index
    );

    if (
      customPaymentCurrency.symbol !== symbol ||
      customPaymentCurrency.token !== token ||
      parseInt(customPaymentCurrency.cost) !== cost
    ) {
      throw new Error(
        `Error in ${this.addCustomPaymentCurrency.name}() method while setting up ${this.contract_name} contract - ${this.contract_instance_name} contract_instance`
      );
    }
  }

  async setBaseURI(NFTMetadataFolderCID) {
    await (await this.contract.setBaseURI(NFTMetadataFolderCID)).wait();

    if ((await this.contract.baseURI()) !== `ipfs://${NFTMetadataFolderCID}/`) {
      throw new Error(
        `Error in ${this.setBaseURI.name}() method while setting up ${this.contract_name} contract - ${this.contract_instance_name} contract_instance`
      );
    }
  }
}

class NFTBridge extends BaseContract {
  constructor(contract_instance_name) {
    super("NFTBridge", contract_instance_name);
  }

  async setNFTMinter(newNFTMinter) {
    await (await this.contract.setNFTMinter(newNFTMinter)).wait();

    const nftMinter = await this.contract.nftMinter();

    if (nftMinter !== newNFTMinter) {
      throw new Error(
        `Error in ${this.setNFTMinter.name}() method while setting up ${this.contract_name} contract - ${this.contract_instance_name} contract_instance`
      );
    }
  }

  async setFeeToken(newFeeToken) {
    await (await this.contract.setFeeToken(newFeeToken)).wait();

    const feeToken = await this.contract.feeToken();

    if (feeToken !== newFeeToken) {
      throw new Error(
        `Error in ${this.setFeeToken.name}() method while setting up ${this.contract_name} contract - ${this.contract_instance_name} contract_instance`
      );
    }
  }
}

class BaseDeploy {
  constructor() {
    this.tokens = [];
    this.nft_collections = [];
    this.nft_bridges = [];
  }

  async deploy() {
    const token_alp = new Token("token_alpha", {
      name: "Token Alpha",
      symbol: "TKN-ALP",
      maxSupply: 1000000,
    });

    this.tokens = [token_alp];

    for (const token of this.tokens) {
      await token.deployContract();
    }

    const hash_wallet_accounts = Utils.get_hash_wallet_accounts();

    for (const token of this.tokens) {
      for (const account of hash_wallet_accounts) {
        await token.mint(account.address, 10000);
      }
    }

    const output_nfts_info = await this.get_output_nfts_info();

    this.nft_collections = [];
    for (let output_nft_info in output_nfts_info) {
      output_nft_info = output_nfts_info[output_nft_info];

      const nft_collection = new NFTMinter(
        output_nft_info.nft_collection_id,
        output_nft_info
      );
      this.nft_collections.push(nft_collection);
    }

    for (const nft_collection of this.nft_collections) {
      await nft_collection.deployContract();
    }

    for (const [c_index, nft_collection] of this.nft_collections.entries()) {
      for (const [t_index, token] of this.tokens.entries()) {
        const cost = parseInt((c_index + 1) * (t_index + 1));
        await nft_collection.addCustomPaymentCurrency(
          t_index,
          token.contract_instance_name,
          token.symbol,
          token.contract_address,
          cost
        );
      }
    }

    const [nft_collection_tnj] = this.nft_collections;

    const nft_bridge = new NFTBridge("nft_bridge");
    this.nft_bridges = [nft_bridge];
    await nft_bridge.deployContract();

    await nft_bridge.setNFTMinter(nft_collection_tnj.contract_address);
    await nft_bridge.setFeeToken(token_alp.contract_address);

    const dapp_contracts_info = [
      {
        contractName: this.tokens[0].contract_name,
        contractInstances: this.tokens.map((token) => ({
          name: token.contract_instance_name,
          address: token.contract_address,
        })),
      },
      {
        contractName: this.nft_collections[0].contract_name,
        contractInstances: this.nft_collections.map((nft_collection) => ({
          name: nft_collection.contract_instance_name,
          address: nft_collection.contract_address,
          nftCollection: nft_collection.output_nft_info.name,
        })),
      },
      {
        contractName: this.nft_bridges[0].contract_name,
        contractInstances: this.nft_bridges.map((nft_bridge) => ({
          name: nft_bridge.contract_instance_name,
          address: nft_bridge.contract_address,
        })),
      },
    ];

    for (const dapp_contract_info of dapp_contracts_info) {
      await Utils.generate_dapp_contract_info(
        "blockchain_1",
        dapp_contract_info.contractName,
        dapp_contract_info.contractInstances
      );
    }
  }

  async setBaseURI() {
    for (const nft_collection of this.nft_collections) {
      await nft_collection.setBaseURI(
        nft_collection.output_nft_info.nft_metadata_folder_cid
      );
    }
  }
}

class DeploySetup extends BaseDeploy {
  async deploySetup() {
    await this.deploy();
    await this.setup();
  }

  async get_output_nfts_info() {
    return JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../..", "nft/outputs/output_nfts_info.json"),
        "utf8"
      )
    );
  }

  async setup() {
    await this.setBaseURI();
  }
}

class DeployE2E extends BaseDeploy {
  async deployE2E() {
    await this.deploy();
  }

  async get_output_nfts_info() {
    const output_nfts_info = {
      tom_and_jerry: {
        nft_collection_id: "tom_and_jerry",
        nft_collection_name: "NFT Collection TomAndJerry",
        name: "Tom and Jerry",
        symbol: "COL-TNJ",
        image_name: "tom_and_jerry.png",
        num_copies: 0,
        ipfs_node_rpc_api: "/ip4/127.0.0.1/tcp/5001",
        nft_image_folder_cid: "",
        nft_metadata_folder_cid: "",
      },
    };

    return output_nfts_info;
  }
}

class SetupE2E extends BaseDeploy {
  async setupE2E() {
    await this.setup();
  }

  async setup() {
    await this.setupPrerequisites();
    await this.setBaseURI();
  }

  async setupPrerequisites() {
    const all_contracts_setup_inputs = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "contracts_setup_inputs.json"),
        "utf8"
      )
    );

    for (let contracts_setup_inputs in all_contracts_setup_inputs) {
      contracts_setup_inputs =
        all_contracts_setup_inputs[contracts_setup_inputs];
      for (let contract_setup_inputs in contracts_setup_inputs) {
        contract_setup_inputs = contracts_setup_inputs[contract_setup_inputs];
        if (!contract_setup_inputs.address) {
          throw new Error(`contracts_setup_inputs.json file is invalid.`);
        }
      }
    }

    const contracts_setup_inputs = all_contracts_setup_inputs.NFTMinter;

    this.nft_collections = [];
    for (let contract_setup_inputs in contracts_setup_inputs) {
      contract_setup_inputs = contracts_setup_inputs[contract_setup_inputs];

      const output_nft_info = {
        nft_metadata_folder_cid: contract_setup_inputs.nft_metadata_folder_cid,
      };

      const nft_collection = new NFTMinter(
        contract_setup_inputs.contract_instance_name,
        output_nft_info
      );
      nft_collection.contract_address = contract_setup_inputs.address;
      await nft_collection.attachContract();

      this.nft_collections.push(nft_collection);
    }
  }
}

async function main() {
  const DEPLOY_MODES = ["DeploySetup", "DeployE2E", "SetupE2E"];
  const DEPLOY_MODE = process.env.DEPLOY_MODE;
  if (!DEPLOY_MODE || !DEPLOY_MODES.includes(DEPLOY_MODE)) {
    throw new Error("Invalid DEPLOY_MODE");
  }

  await hre.run("compile");

  await Utils.display_hardhat_network_info();

  console.log("-----------------------------------------------------");
  console.log("------------- Contracts Deployment Info -------------");
  console.log("-----------------------------------------------------");

  if (DEPLOY_MODE === "DeploySetup") {
    const deploy_setup = new DeploySetup();
    await deploy_setup.deploySetup();
  } else if (DEPLOY_MODE === "DeployE2E") {
    const deploy_e2e = new DeployE2E();
    await deploy_e2e.deployE2E();
  } else if (DEPLOY_MODE === "SetupE2E") {
    const setup_e2e = new SetupE2E();
    await setup_e2e.setupE2E();
  } else {
    throw new Error("Invalid DEPLOY_MODE");
  }

  console.log(`\n${JSON.stringify(Utils.contracts_setup_outputs, null, 2)}`);
  console.log("-----------------------------------------------------");

  console.log("\nSUCCESS: contracts deployment ... DONE");
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
      1) Make sure hardhat network is running.\n \
      2) Make sure you have properly updated contracts_setup_inputs.json file."
  );
  process.exitCode = 1;
});
