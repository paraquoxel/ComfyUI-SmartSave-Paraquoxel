import os
import re
import datetime
import folder_paths
import numpy as np
import uuid
import json
import threading
from server import PromptServer
from aiohttp import web
from PIL import Image
from PIL.PngImagePlugin import PngInfo

image_save_lock = threading.Lock()

def save_smart_image_to_output(temp_filename, options, batch_index=""):
    temp_dir = folder_paths.get_temp_directory()
    user_folder = options.get("folder", "").strip()

    if user_folder and os.path.isabs(user_folder):
        output_path = user_folder
    else:
        base_output_dir = folder_paths.get_output_directory()
        output_path = os.path.join(base_output_dir, user_folder) if user_folder else base_output_dir
            
    if options.get("date_subfolder", False):
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        output_path = os.path.join(output_path, today)
    
    output_path = os.path.normpath(output_path)
    os.makedirs(output_path, exist_ok=True)

    src_path = os.path.join(temp_dir, temp_filename)
    
    if os.path.exists(src_path):
        with Image.open(src_path) as img:
            ext = options.get("format", ".png")
            raw_prefix = options.get("prefix", "ComfyUI") or "ComfyUI"
            naming = options.get("naming", "Sequential")
            
            now = datetime.datetime.now()
            prefix = raw_prefix.replace("[date]", now.strftime("%Y-%m-%d")).replace("[time]", now.strftime("%H-%M-%S"))
            
            with image_save_lock:
                if naming == "Sequential":
                    pattern = re.compile(rf"^{re.escape(prefix)}_(\d+){re.escape(ext)}$")
                    max_num = 0
                    if os.path.exists(output_path):
                        # Optimized directory scanning for large folders
                        with os.scandir(output_path) as entries:
                            for entry in entries:
                                match = pattern.match(entry.name)
                                if match: 
                                    max_num = max(max_num, int(match.group(1)))
                    final_name = f"{prefix}_{max_num + 1:05d}{ext}" 
                else:
                    ts = now.strftime("%Y%m%d_%H%M%S")
                    idx_str = f"_{batch_index}" if str(batch_index) != "" else ""
                    final_name = f"{prefix}_{ts}{idx_str}{ext}"
                
                dest_full_path = os.path.join(output_path, final_name)

            save_args = {}
            dpi_val = int(options.get("dpi", 96))
            save_args["dpi"] = (dpi_val, dpi_val)
            
            if options.get("embed_workflow"):
                prompt = img.info.get("prompt")
                extra_pnginfo = img.info.get("workflow")
                
                if ext.lower() == ".png":
                    metadata = PngInfo()
                    if prompt: metadata.add_text("prompt", prompt)
                    if extra_pnginfo: metadata.add_text("workflow", extra_pnginfo)
                    save_args["pnginfo"] = metadata
                elif ext.lower() == ".webp":
                    exif = img.getexif()
                    exif[0x010f] = "ComfyUI" 
                    webp_meta = {}
                    if prompt: webp_meta["prompt"] = json.loads(prompt)
                    if extra_pnginfo: webp_meta["workflow"] = json.loads(extra_pnginfo)
                    exif[0x010e] = json.dumps(webp_meta) 
                    save_args["exif"] = exif.tobytes()
            
            if ext.lower() == ".png" and options.get("png_optimize", False):
                save_args["optimize"] = True
            
            if ext.lower() in[".jpg", ".jpeg"]:
                save_args["quality"] = int(options.get("quality", 100))
            
            if ext.lower() == ".webp":
                if options.get("webp_lossless", False): save_args["lossless"] = True
                else: save_args["quality"] = int(options.get("quality", 100))
            
            if ext.lower() == ".tif":
                save_args["compression"] = "tiff_lzw"

            img.save(dest_full_path, **save_args)
            return final_name
    raise Exception("Temp file not found")


@PromptServer.instance.routes.post("/paraquoxel/save_smart")
async def save_smart_endpoint(request):
    try:
        data = await request.json()
        temp_filename = data.get("filename")
        options = data.get("options", {})
        batch_index = data.get("batch_index", "")
        
        final_name = save_smart_image_to_output(temp_filename, options, batch_index)
        return web.json_response({"status": "success", "file": final_name})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)


class SmartSaveNode:
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "prefix": ("STRING", {"default": "ComfyUI"}),
                "folder": ("STRING", {"default": ""}),
                "date_subfolder": ("BOOLEAN", {"default": True}),
                "naming": (["Sequential", "Timestamp"], {"default": "Sequential"}),
                "format": ([".png", ".jpg", ".webp", ".tif"], {"default": ".png"}),
                "dpi": ("INT", {"default": 96, "min": 72, "max": 1200, "step": 1}),
                "quality": ("INT", {"default": 100, "min": 1, "max": 100, "step": 1}),
                "webp_lossless": ("BOOLEAN", {"default": False}),
                "png_optimize": ("BOOLEAN", {"default": False}),
                "embed_workflow": ("BOOLEAN", {"default": True}),
                "auto_save": ("BOOLEAN", {"default": False}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "process"
    OUTPUT_NODE = True
    CATEGORY = "paraquoxel-comfy"

    def process(self, images, prefix, folder, date_subfolder, naming, format, dpi, quality, webp_lossless, png_optimize, embed_workflow, auto_save, prompt=None, extra_pnginfo=None):
        temp_dir = folder_paths.get_temp_directory()
        results =[]
        
        for i, image in enumerate(images):
            i_np = 255. * image.cpu().numpy()
            img = Image.fromarray(np.clip(i_np, 0, 255).astype(np.uint8))
            
            tmp_name = f"click_preview_{uuid.uuid4().hex}.png"
            
            metadata = PngInfo()
            if prompt is not None:
                metadata.add_text("prompt", json.dumps(prompt))
            if extra_pnginfo is not None:
                for x in extra_pnginfo:
                    metadata.add_text(x, json.dumps(extra_pnginfo[x]))
                    
            img.save(os.path.join(temp_dir, tmp_name), pnginfo=metadata)
            results.append({"filename": tmp_name, "type": "temp"})
            
            if auto_save:
                options = {
                    "prefix": prefix, "folder": folder, "date_subfolder": date_subfolder,
                    "naming": naming, "format": format, "dpi": dpi, "quality": quality,
                    "webp_lossless": webp_lossless, "png_optimize": png_optimize,
                    "embed_workflow": embed_workflow
                }
                save_smart_image_to_output(tmp_name, options, str(i+1) if len(images) > 1 else "")
            
        return {"ui": {"images": results}}

NODE_CLASS_MAPPINGS = {
    "SmartSaveNode": SmartSaveNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SmartSaveNode": "SmartSave IMG | Paraquoxel"
}