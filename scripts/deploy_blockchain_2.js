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
    const maxRetries = 6;
    const retryDelaySeconds = 10;

    let retries = 0;

    while (retries < maxRetries) {
      try {
        const Contract = await hre.ethers.getContractFactory(
          this.contract_name
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

class BridgeNFTMinter extends BaseContract {
  constructor(contract_instance_name, output_nft_info) {
    super("BridgeNFTMinter", contract_instance_name);

    this.output_nft_info = output_nft_info;
    this.contract_constructor_args = [
      output_nft_info.nft_collection_name,
      output_nft_info.symbol,
    ];
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
