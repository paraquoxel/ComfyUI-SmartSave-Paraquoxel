from .paraquoxel_smart_save_img import SmartSaveNode
from .paraquoxel_smart_save_vid import SmartSaveVideoNode

NODE_CLASS_MAPPINGS = {
    "SmartSaveNode": SmartSaveNode,
    "SmartSaveVideoNode": SmartSaveVideoNode
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SmartSaveNode": "📸 SmartSave IMG (paraquoxel)",
    "SmartSaveVideoNode": "🎥 SmartSave VID (paraquoxel)"
}

WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]