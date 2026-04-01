import os
import re
import torch
import folder_paths
import json
import numpy as np
import av
import uuid
import datetime
import shutil
import threading
from PIL import Image
from fractions import Fraction
from server import PromptServer
from aiohttp import web

video_save_lock = threading.Lock()

def save_smart_video_to_output(temp_filename, prefix, folder, date_subfolder, naming, format_fallback):
    temp_dir = folder_paths.get_temp_directory()
    temp_path = os.path.join(temp_dir, temp_filename)
    
    if not os.path.exists(temp_path):
        raise Exception("Temp file not found")

    _, real_ext = os.path.splitext(temp_filename)
    if not real_ext:
        real_ext = format_fallback

    base_dir = folder_paths.get_output_directory()
    target_folder = folder.strip() if folder else ""
    
    out_dir = os.path.join(base_dir, target_folder) if target_folder else base_dir
    now = datetime.datetime.now()
    
    if date_subfolder:
        out_dir = os.path.join(out_dir, now.strftime("%Y-%m-%d"))
        
    out_dir = os.path.normpath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    
    safe_prefix = prefix if prefix else "ComfyUI"
    resolved_prefix = safe_prefix.replace("[date]", now.strftime("%Y-%m-%d")).replace("[time]", now.strftime("%H-%M-%S"))
    
    with video_save_lock:
        if naming == "Sequential":
            pattern = re.compile(rf"^{re.escape(resolved_prefix)}_(\d+){re.escape(real_ext)}$")
            max_num = 0
            if os.path.exists(out_dir):
                with os.scandir(out_dir) as entries:
                    for entry in entries:
                        match = pattern.match(entry.name)
                        if match: 
                            max_num = max(max_num, int(match.group(1)))
            final_filename = f"{resolved_prefix}_{max_num + 1:05d}{real_ext}"
        else:
            final_filename = f"{resolved_prefix}_{now.strftime('%Y%m%d_%H%M%S')}{real_ext}"
            
        dest_full_path = os.path.join(out_dir, final_filename)
        shutil.copy2(temp_path, dest_full_path)
    
    return final_filename


@PromptServer.instance.routes.post("/paraquoxel/smart_save_video")
async def smart_save_video_endpoint(request):
    try:
        data = await request.json()
        filename = data.get("filename")
        opt = data.get("options", {})
        
        final_name = save_smart_video_to_output(
            filename, 
            opt.get("prefix", "ComfyUI"), 
            opt.get("folder", ""), 
            opt.get("date_subfolder", False), 
            opt.get("naming", "Sequential"), 
            opt.get("format", ".mp4")
        )
        return web.json_response({"status": "success", "file": final_name})
    except Exception as e:
        return web.json_response({"status": "error", "message": str(e)}, status=500)


class SmartSaveVideoNode:
    def __init__(self):
        self.type = "output"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "prefix": ("STRING", {"default": "ComfyUI"}),
                "folder": ("STRING", {"default": ""}),
                "date_subfolder": ("BOOLEAN", {"default": True}),
                "naming": (["Sequential", "Timestamp"], {"default": "Sequential"}),
                "format": ([".mp4", ".webm", ".gif", ".webp"], {"default": ".mp4"}),
                "mp4_codec": (["H.264 (Default)", "H.265 (High Compression)"], {"default": "H.264 (Default)"}),
                "fps": ("FLOAT", {"default": 24.0, "min": 1.0, "max": 120.0, "step": 1.0}),
                "quality": ("INT", {"default": 85, "min": 1, "max": 100, "step": 1}),
                "webp_lossless": ("BOOLEAN", {"default": False}),
                "embed_workflow": ("BOOLEAN", {"default": True}),
                "auto_save": ("BOOLEAN", {"default": False}),
            },
            "optional": {
                "images": ("IMAGE",),
                "video": ("VIDEO",), 
                "audio": ("AUDIO",),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "process"
    OUTPUT_NODE = True
    CATEGORY = "paraquoxel-comfy"

    def process(self, prefix, folder, date_subfolder, naming, format, mp4_codec, fps, 
                quality, webp_lossless, embed_workflow, auto_save,
                images=None, video=None, audio=None, prompt=None, extra_pnginfo=None):
        
        frames_tensor = None
        final_audio = audio
        
        # --- ROBUSTE VIDEO & AUDIO EXTRAKTION ---
        if video is not None:
            if isinstance(video, dict):
                frames_tensor = video.get("images")
                if final_audio is None and "audio" in video:
                    final_audio = video["audio"]
            elif isinstance(video, torch.Tensor):
                frames_tensor = video
            else:
                if hasattr(video, "get_components"): 
                    comps = video.get_components()
                    frames_tensor = comps.images
                    if final_audio is None and hasattr(comps, "audio") and comps.audio is not None:
                        final_audio = comps.audio
                elif hasattr(video, "images"): 
                    frames_tensor = video.images
                    if final_audio is None and hasattr(video, "audio") and video.audio is not None:
                        final_audio = video.audio

        if frames_tensor is None and images is not None:
            frames_tensor = images
            
        if frames_tensor is None or len(frames_tensor) == 0:
            return {"ui": {}}

        now = datetime.datetime.now()
        safe_prefix = prefix if prefix else "ComfyUI"
        resolved_prefix = safe_prefix.replace("[date]", now.strftime("%Y-%m-%d")).replace("[time]", now.strftime("%H-%M-%S"))

        output_dir = folder_paths.get_temp_directory()
        temp_filename = f"{resolved_prefix}_preview_{uuid.uuid4().hex}{format}"
        full_path = os.path.join(output_dir, temp_filename)

        height, width = frames_tensor.shape[1], frames_tensor.shape[2]
        if width % 2 != 0: width -= 1
        if height % 2 != 0: height -= 1

        batch_size = len(frames_tensor)
        chunk_size = 32 

        if format in[".gif", ".webp"]:
            pil_images =[]
            for start_idx in range(0, batch_size, chunk_size):
                end_idx = min(start_idx + chunk_size, batch_size)
                chunk_np = (torch.clamp(frames_tensor[start_idx:end_idx], 0.0, 1.0) * 255.0).to(torch.uint8).cpu().numpy()
                for j in range(chunk_np.shape[0]):
                    frame_data = np.ascontiguousarray(chunk_np[j, :height, :width, :3])
                    pil_images.append(Image.fromarray(frame_data))
                
            append_imgs = pil_images[1:] if len(pil_images) > 1 else[]
            duration_ms = int(round(1000.0 / fps))
            save_args = {"save_all": True, "append_images": append_imgs, "duration": duration_ms, "loop": 0}
            
            if format == ".webp":
                if webp_lossless: save_args["lossless"] = True
                else: save_args["quality"] = quality
                if embed_workflow:
                    exif = pil_images[0].getexif()
                    if prompt is not None:
                        exif[0x010f] = "ComfyUI"
                        exif[0x010e] = json.dumps({"workflow": extra_pnginfo, "prompt": prompt})
                    save_args["exif"] = exif.tobytes()
            pil_images[0].save(full_path, format=format.replace(".", "").upper(), **save_args)

        else:
            # --- MP4/WEBM CONTAINER METADATA FIX ---
            container_options = {"movflags": "use_metadata_tags"} if format == ".mp4" else {}
            container = av.open(full_path, mode="w", options=container_options)
            
            if embed_workflow:
                if prompt is not None: 
                    container.metadata["prompt"] = json.dumps(prompt)
                if extra_pnginfo is not None:
                    for k, v in extra_pnginfo.items():
                        container.metadata[k] = json.dumps(v)

            fps_fraction = Fraction(int(fps * 1000), 1000)
            video_codec = "libvpx-vp9" if format == ".webm" else ("libx265" if "H.265" in mp4_codec else "libx264")
            v_stream = container.add_stream(video_codec, rate=fps_fraction)
            v_stream.width = width
            v_stream.height = height
            v_stream.pix_fmt = "yuv420p"

            if format == ".mp4":
                crf = int(50 - ((quality - 1) / 99) * 35)
                v_stream.options = {"crf": str(crf), "preset": "fast"}
            else: 
                crf = int(60 - ((quality - 1) / 99) * 45)
                v_stream.options = {"crf": str(crf), "b": "0"}

            a_stream = None
            audio_np = None
            layout = 'mono'
            sample_rate = 44100
            
            # --- ROBUSTE AUDIO-DATEN EXTRAKTION ---
            if final_audio is not None:
                waveform = None
                
                if isinstance(final_audio, dict):
                    waveform = final_audio.get("waveform")
                    sample_rate = final_audio.get("sample_rate", 44100)
                elif hasattr(final_audio, "waveform"):
                    waveform = final_audio.waveform
                    sample_rate = getattr(final_audio, "sample_rate", getattr(final_audio, "frame_rate", 44100))
                elif hasattr(final_audio, "get_components"):
                    a_comps = final_audio.get_components()
                    if hasattr(a_comps, "waveform"):
                        waveform = a_comps.waveform
                        sample_rate = getattr(a_comps, "sample_rate", getattr(a_comps, "frame_rate", 44100))
                
                if waveform is not None:
                    audio_codec = "aac" if format == ".mp4" else "libopus"
                    a_stream = container.add_stream(audio_codec, rate=sample_rate)
                    if waveform.dim() == 3:
                        waveform = waveform.squeeze(0)
                    audio_np = np.ascontiguousarray(waveform.cpu().numpy())
                    layout = 'stereo' if audio_np.shape[0] == 2 else 'mono'

            # 1. Video encodieren 
            for start_idx in range(0, batch_size, chunk_size):
                end_idx = min(start_idx + chunk_size, batch_size)
                chunk_np = (torch.clamp(frames_tensor[start_idx:end_idx], 0.0, 1.0) * 255.0).to(torch.uint8).cpu().numpy()
                
                for j in range(chunk_np.shape[0]):
                    frame_data = np.ascontiguousarray(chunk_np[j, :height, :width, :3])
                    v_frame = av.VideoFrame.from_ndarray(frame_data, format="rgb24")
                    v_frame.pts = start_idx + j
                    for packet in v_stream.encode(v_frame): 
                        container.mux(packet)
            
            for packet in v_stream.encode(): 
                container.mux(packet)

            # 2. Audio in kleinen Paketen anhängen
            if a_stream is not None and audio_np is not None:
                total_samples = audio_np.shape[1]
                audio_chunk_size = 8192  
                for start_idx in range(0, total_samples, audio_chunk_size):
                    end_idx = min(start_idx + audio_chunk_size, total_samples)
                    chunk_arr = np.ascontiguousarray(audio_np[:, start_idx:end_idx])
                    
                    audio_frame = av.AudioFrame.from_ndarray(chunk_arr, format='fltp', layout=layout)
                    audio_frame.sample_rate = sample_rate
                    audio_frame.pts = None
                    
                    for packet in a_stream.encode(audio_frame):
                        container.mux(packet)
                        
                for packet in a_stream.encode():
                    container.mux(packet)

            container.close()

        if auto_save:
            save_smart_video_to_output(temp_filename, prefix, folder, date_subfolder, naming, format)

        return {
            "ui": {
                "videos":[
                    {"filename": temp_filename, "subfolder": "", "type": "temp", "format": format.replace(".", "")}
                ]
            }
        }

NODE_CLASS_MAPPINGS = {
    "SmartSaveVideoNode": SmartSaveVideoNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SmartSaveVideoNode": "SmartSave VID | Paraquoxel"
}
