import os
import json
import io
import copy

from PIL import Image
import ipfshttpclient
import subprocess


def get_json_content(json_file_path):
    with open(json_file_path, "r") as json_file:
        json_content = json.load(json_file)

    return json_content


def get_input_nfts_info():
    file_path = os.path.join(os.path.dirname(__file__), "inputs/input_nfts_info.json")

    input_nfts_info = get_json_content(file_path)

    return input_nfts_info


def ipfs_push_with_ipfshttpclient(ipfs_node_rpc_api, files, file_extension):
    # IMPORTANT:
    # - Error: ipfshttpclient.exceptions.VersionMismatch: Unsupported daemon version '0.25.0' (not in range: 0.4.23 ≤ … < 0.8.0)
    # - Known Issue: ipfshttpclient doesn't work on ipfs daemon version which is not in above range. So we are using ipfs cli commands.
    with ipfshttpclient.connect(ipfs_node_rpc_api) as ipfs_client:
        files_folder = {
            f"{file_id}.{file_extension}": file
            for file_id, file in enumerate(files, start=1)
        }
        files_folder_info = ipfs_client.add(files_folder, wrap_with_directory=True)

        files_folder_cid = files_folder_info["Hash"]

        ipfs_client.pin.add(
            files_folder_cid
        )  # Explicitly pin the content to ensure that it's not garbage collected in the IPFS node.

        return files_folder_cid


def run_cli_command(command):
    process = subprocess.Popen(
        command.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    output, error = process.communicate()
    return output.strip(), error.strip()


def ipfs_push_with_ipfs_cli(ipfs_node_rpc_api, folder_path):
    ipfs_cli_command = f"ipfs --api {ipfs_node_rpc_api} add -r {folder_path}"
    output, error = run_cli_command(ipfs_cli_command)

    # if error:
    #     print(f"Error in ipfs_push_with_ipfs_cli: {error}")
    #     exit(1)

    files_folder_cid = output.split()[-2]

    ipfs_cli_command = f"ipfs --api {ipfs_node_rpc_api} pin add {files_folder_cid}"  # Explicitly pin the content to ensure that it's not garbage collected in the IPFS node.
    output, error = run_cli_command(ipfs_cli_command)

    if error:
        print(f"Error in ipfs_push_with_ipfs_cli: {error}")
        exit(1)

    return files_folder_cid


def nft_image_generator(input_nfts_info):
    nft_image_folders_cids = []
    for input_nft_info in input_nfts_info:
        image_path = os.path.join(
            os.path.dirname(__file__), "inputs/images/", input_nft_info["image_name"]
        )
        image_extension = os.path.splitext(input_nft_info["image_name"])[1][1:]
        num_copies = input_nft_info["num_copies"]
        ipfs_node_rpc_api = input_nft_info["ipfs_node_rpc_api"]

        temp_folder_path = os.path.join(
            os.path.dirname(__file__),
            f"outputs/temp_nft_images/{input_nft_info['nft_collection_id']}/",
        )

        if not os.path.exists(temp_folder_path):
            os.makedirs(temp_folder_path)

        with Image.open(image_path) as base_image:
            nft_images = []
            for image_id in range(1, num_copies + 1):
                nft_image = io.BytesIO()
                base_image.save(nft_image, format=image_extension)
                nft_image.seek(0)
                nft_images.append(nft_image.getvalue())

                temp_file_path = os.path.join(
                    temp_folder_path, str(image_id) + "." + image_extension
                )

                with open(temp_file_path, "wb") as temp_file:
                    nft_image.seek(0)
                    temp_file.write(nft_image.getvalue())

        # nft_image_folder_cid = ipfs_push_with_ipfshttpclient(
        #     ipfs_node_rpc_api, nft_images, image_extension
        # )

        nft_image_folder_cid = ipfs_push_with_ipfs_cli(
            ipfs_node_rpc_api, temp_folder_path
        )

        nft_image_folders_cids.append(nft_image_folder_cid)

    return nft_image_folders_cids


def get_nft_metadata(base_metadata, base_metadata_placeholders):
    temp_base_metadata = copy.deepcopy(base_metadata)

    def replace_placeholders(temp_base_metadata, placeholders):
        if isinstance(temp_base_metadata, str):
            for placeholder_key, placeholder_value in placeholders.items():
                temp_base_metadata = temp_base_metadata.replace(
                    f"{{{placeholder_key}}}", str(placeholder_value)
                )
            return temp_base_metadata
        elif isinstance(temp_base_metadata, dict):
            return {
                metadata_key: replace_placeholders(metadata_value, placeholders)
                for metadata_key, metadata_value in temp_base_metadata.items()
            }
        elif isinstance(temp_base_metadata, list):
            return [
                replace_placeholders(item, placeholders) for item in temp_base_metadata
            ]
        else:
            return temp_base_metadata

    return replace_placeholders(temp_base_metadata, base_metadata_placeholders)


def nft_metadata_generator(input_nfts_info, nft_image_folders_cids):
    nft_metadata_folders_cids = []
    for index, input_nft_info in enumerate(input_nfts_info):
        nft_image_folder_cid = nft_image_folders_cids[index]

        image_extension = os.path.splitext(input_nft_info["image_name"])[1][1:]
        metadata_path = os.path.join(
            os.path.dirname(__file__), "inputs/nft_metadata.json"
        )

        name = input_nft_info["name"]
        metadata_extension = "json"
        num_copies = input_nft_info["num_copies"]
        ipfs_node_rpc_api = input_nft_info["ipfs_node_rpc_api"]

        temp_folder_path = os.path.join(
            os.path.dirname(__file__),
            f"outputs/temp_nft_metadata/{input_nft_info['nft_collection_id']}/",
        )

        if not os.path.exists(temp_folder_path):
            os.makedirs(temp_folder_path)

        base_metadata = get_json_content(metadata_path)

        nft_metadata_list = []
        for image_id in range(1, num_copies + 1):
            base_metadata_placeholders = {
                "name": name,
                "nft_image_folder_cid": nft_image_folder_cid,
                "image_id": image_id,
                "image_extension": image_extension,
            }

            nft_metadata = get_nft_metadata(base_metadata, base_metadata_placeholders)

            nft_metadata_list.append(json.dumps(nft_metadata))

            temp_file_path = os.path.join(
                temp_folder_path, str(image_id) + "." + metadata_extension
            )
            with open(temp_file_path, "w", encoding="utf-8") as temp_file:
                json.dump(nft_metadata, temp_file, indent=2)

        # nft_metadata_folder_cid = ipfs_push_with_ipfshttpclient(
        #     ipfs_node_rpc_api, nft_metadata_list, metadata_extension
        # )

        nft_metadata_folder_cid = ipfs_push_with_ipfs_cli(
            ipfs_node_rpc_api, temp_folder_path
        )

        nft_metadata_folders_cids.append(nft_metadata_folder_cid)

    return nft_metadata_folders_cids


def generate_output_nfts_info(
    input_nfts_info, nft_image_folders_cids, nft_metadata_folders_cids
):
    file_path = os.path.join(
        os.path.dirname(__file__),
        f"outputs/output_nfts_info.json",
    )
    folder_path = os.path.dirname(file_path)

    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

    output_nfts_info = {}
    for index, input_nft_info in enumerate(input_nfts_info):
        nft_image_folder_cid = nft_image_folders_cids[index]
        nft_metadata_folder_cid = nft_metadata_folders_cids[index]

        output_nft_info = {
            "nft_collection_id": input_nft_info["nft_collection_id"],
            "nft_collection_name": input_nft_info["nft_collection_name"],
            "name": input_nft_info["name"],
            "symbol": input_nft_info["symbol"],
            "image_name": input_nft_info["image_name"],
            "num_copies": input_nft_info["num_copies"],
            "ipfs_node_rpc_api": input_nft_info["ipfs_node_rpc_api"],
            "nft_image_folder_cid": nft_image_folder_cid,
            "nft_metadata_folder_cid": nft_metadata_folder_cid,
        }

        output_nfts_info[input_nft_info["nft_collection_id"]] = output_nft_info

    with open(file_path, "w") as file:
        json.dump(output_nfts_info, file, indent=2)


if __name__ == "__main__":
    try:
        input_nfts_info = get_input_nfts_info()
        nft_image_folders_cids = nft_image_generator(input_nfts_info)
        nft_metadata_folders_cids = nft_metadata_generator(
            input_nfts_info, nft_image_folders_cids
        )
        generate_output_nfts_info(
            input_nfts_info, nft_image_folders_cids, nft_metadata_folders_cids
        )

        print("\nSUCCESS: NFT generation ... DONE")
    except Exception as error:
        print("\n--------------------------- ERROR --------------------------\n")
        print(error)
        print("\n------------------------------------------------------------\n")
        print("ERROR NOTE: Make sure IPFS node is running.")
