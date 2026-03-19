# 📸 ComfyUI SmartSave by Paraquoxel

An advanced, highly polished, and feature-rich saving suite for ComfyUI. 
**SmartSave** provides custom Canvas-UI buttons, hybrid saving methods (Auto/Manual), deep metadata injection, and robust handling of both Images and Videos (including Audio!).

![SmartSave Preview](https://via.placeholder.com/800x400.png?text=Add+a+Screenshot+of+your+Nodes+here)

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

### Method 1: ComfyUI Manager (Recommended)
You can find and install this node directly via the ComfyUI Manager. Just search for **SmartSave Paraquoxel**.

### Method 2: Manual Install
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

### Tip: Toggle Settings
Both nodes feature a "⚙️ Toggle Settings" button. Once you have configured your DPI, Format, Quality, and Paths, you can collapse the settings to save space on your ComfyUI canvas!

## 📄 License
MIT License. See the LICENSE file for details.
