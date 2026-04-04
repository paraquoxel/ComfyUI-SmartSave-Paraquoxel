# 📸 ComfyUI SmartSave by Paraquoxel

An advanced, highly polished, and feature-rich saving suite for ComfyUI. 
**SmartSave** provides custom Canvas-UI buttons, hybrid saving methods (Auto/Manual), deep metadata injection, and robust handling of both Images and Videos (including Audio!).

<img width="1700" height="1038" alt="Screenshot 2026-04-04 123139" src="https://github.com/user-attachments/assets/5481a247-416a-401e-a886-baf984119ce9" />

## 🚨 Important Compatibility Notice

> **Note on ComfyUI Modern UI (V2):** 
> The new experimental "Modern Node Design" in ComfyUI completely changes how mouse clicks and canvas elements are handled. Because SmartSave uses highly customized, interactive canvas buttons, **the UI buttons (Save, Toggle Settings, etc.) will currently not respond to clicks in the Modern UI**. 
> 
> 👉 **Please use the classic ComfyUI interface** to enjoy the full interactivity of these nodes!

## ✨ Features

### 📸 SmartSave IMG
* **Interactive Node UI:** Custom-drawn canvas buttons allow you to save single images, batches, or specific ranges (e.g., 1, 3, 5-8) directly from the node interface without re-running the prompt.
* **Hybrid Saving:** Use it as a preview node and click to save manually, or enable auto_save to write directly to your disk.
* **Smart Naming:** Supports [date] and [time] placeholders. Automatically detects the highest sequential number in your output folder to prevent overwriting.
* **Workflow Embedding:** Seamlessly injects your ComfyUI workflow and prompt into .png (via PngInfo) and .webp (via EXIF metadata).
* **Multi-Format Support:** Save as .png, .jpg, .webp, or .tif with fine-grained controls for DPI, quality, and lossless compression.

### 🎥 SmartSave VID
* **Audio Multiplexing:** Fully supports ComfyUI audio inputs! Automatically detects mono/stereo waveforms and muxes them into MP4 (AAC) or WebM (Opus) containers.
* **Dimension Safety:** Odd resolutions (which normally crash H.264/H.265 encoders) are automatically cropped to the nearest even number.
* **PyAV Powered:** Uses robust native Python bindings for FFmpeg (av), avoiding command-line ffmpeg errors.
* **Metadata Injection:** ComfyUI workflows are saved directly into the container metadata for MP4 and WebM, allowing you to drag & drop videos back into ComfyUI!
* **Dynamic Codecs:** Support for H.264, H.265 (High Compression), VP9 (.webm), GIF, and animated WebP.

## 📦 Installation

### Method: Manual Install
1. Open your terminal and navigate to your ComfyUI custom_nodes folder:

    cd ComfyUI/custom_nodes

2. Clone this repository:

    git clone https://github.com/paraquoxel/ComfyUI-SmartSave-Paraquoxel.git

3. Navigate into the folder and install the requirements (specifically "av" for video processing):

    cd ComfyUI-SmartSave-Paraquoxel
    pip install -r requirements.txt

4. Restart ComfyUI.

## 🛠️ Usage
You can find the nodes in the ComfyUI Add Node menu under:
* paraquoxel-comfy -> 📸 SmartSave IMG (paraquoxel)
* paraquoxel-comfy -> 🎥 SmartSave VID (paraquoxel)

### 💡 Tips & Advanced Features

* **⚙️ Toggle Settings:** Both nodes feature a "Toggle Settings" button. Once you have configured your DPI, Format, Quality, and Paths, you can collapse the settings to save space on your ComfyUI canvas!
* **💾 Auto Save = Automatic Batch Save:** By default, the nodes act as interactive previewers, waiting for you to manually click "Save". However, if you turn on the `auto_save` toggle, the node transforms into a fully automated saver, instantly batch-saving every generated image or video to your hard drive.
* **📁 Absolute Paths:** Typing a name in the `folder` widget creates a subfolder inside ComfyUI's standard `output` directory. However, you can also type a full **absolute path** (e.g., `D:\MyAIPictures` or `/mnt/external_drive`). The node will automatically detect this and save your files directly to your custom location.
* **🎵 Audio Override (VID Node):** The node automatically extracts bundled audio from the new ComfyUI `VIDEO` pipeline (e.g., LTX-Video). However, if you connect a different audio source to the dedicated `audio` input pin, it will **override** the original audio. Perfect for adding custom background music!
* **⏱️ Audio & Video Length (VID Node):** If your audio track is longer than your video (or vice versa), the node will *not* trim the data. The final saved file will be as long as the longest input, which might result in frozen frames or silent endings (standard FFmpeg behavior). Use an external "Audio Trim/Crop" node beforehand to perfectly sync their lengths!
* **🎯 Using "Save Range" (IMG Node):** When generating large batches, click the **Save Range** button to open a prompt. Enter specific selections like `1, 3, 5-8`. The node will smartly parse this and only save those exact images, ignoring the rest!
* **📏 Dimension Safety Auto-Crop (VID Node):** Standard video codecs (H.264/H.265) will crash if a video's width or height is an odd number (e.g., 501x703). To prevent ComfyUI from freezing, the node automatically crops 1 pixel off odd dimensions to make them even (e.g., 500x702) before encoding.
* **🔄 Changing Settings After Generation:** ComfyUI only applies node settings during a run. If you generate a video as `.mp4`, change the dropdown to `.gif`, and click the manual "Save Video" button, it will still save as `.mp4`. To actually change the video format or codec, change the setting and click **Queue Prompt** again (ComfyUI will instantly use the cached frames!). 
*Note: The Image node is an exception – it can convert formats (e.g., PNG to JPG) on-the-fly when clicking save!*

## 📄 License
MIT License. See the LICENSE file for details.
