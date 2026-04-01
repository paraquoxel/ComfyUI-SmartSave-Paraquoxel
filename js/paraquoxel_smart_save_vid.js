import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "paraquoxel.SmartVideo",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        
        if (nodeData.name === "SmartSaveVideoNode") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);

                this.title = "SmartSave VID | Paraquoxel";
                this.settings_visible = true;
                this.preview_filename = null;
                
                this.size = [350, 450]; 
                this.user_custom_height = 450;

                const drawRoundedRect = (ctx, x, y, width, height, radius, bg, outline) => {
                    ctx.fillStyle = bg;
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
                    else ctx.rect(x, y, width, height); 
                    ctx.fill();
                    ctx.strokeStyle = outline;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                };

                const isHovered = (node, x, y, w, h) => {
                    if (app.canvas.node_over !== node) return false;
                    const mouseX = app.canvas.graph_mouse[0] - node.pos[0];
                    const mouseY = app.canvas.graph_mouse[1] - node.pos[1];
                    return (mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h);
                };

                let _onDrawBackground = this.onDrawBackground;
                this.onDrawBackground = function(ctx) {
                    if (app.canvas && app.canvas.resizing_node === this) {
                        this.user_custom_height = this.size[1];
                    }
                    if (_onDrawBackground) _onDrawBackground.apply(this, arguments);
                };

                const onMouseMove = this.onMouseMove;
                this.onMouseMove = function(e, pos, canvas) {
                    if (onMouseMove) onMouseMove.apply(this, arguments);
                    this.setDirtyCanvas(true, true); 
                    
                    let foundTooltip = "";
                    if (this.widgets) {
                        for (let i = 0; i < this.widgets.length; i++) {
                            let w = this.widgets[i];
                            if (!w.hidden && w.last_y !== undefined) {
                                let wHeight = w.computeSize ? w.computeSize(this.size[0])[1] : 20;
                                if (pos[1] >= w.last_y && pos[1] <= w.last_y + wHeight) {
                                    if (w.options && w.options.tooltip) {
                                        foundTooltip = w.options.tooltip;
                                    }
                                }
                            }
                        }
                    }
                    if (app.canvas && app.canvas.canvas) {
                        if (app.canvas.canvas.title !== foundTooltip) {
                            app.canvas.canvas.title = foundTooltip;
                        }
                    }
                };

                const onMouseLeave = this.onMouseLeave;
                this.onMouseLeave = function(e, pos, canvas) {
                    if (onMouseLeave) onMouseLeave.apply(this, arguments);
                    if (app.canvas && app.canvas.canvas) app.canvas.canvas.title = "";
                };

                const getWidget = (name) => this.widgets?.find(w => w.name === name);
                
                setTimeout(() => {
                    this.widgets?.forEach(w => {
                        if (w.name === "prefix") {
                            w.label = "prefix";
                            if (!w.options) w.options = {};
                            w.options.tooltip = "Supported placeholders: [date], [time]";
                        } else if (w.name === "folder") {
                            w.label = "folder";
                            if (!w.options) w.options = {};
                            w.options.tooltip = "If left empty, the default output directory will be used.";
                        } else if (w.name) {
                            w.label = w.name.replace(/_/g, " ");
                        }

                        if (w.type === "number" && (w.name === "fps" || w.name === "quality")) {
                            if (!w.options) w.options = {};
                            w.options.precision = 0; 
                            w.options.step = 1;      

                            const origCb = w.callback;
                            w.callback = function(val) {
                                this.value = Math.round(this.value);
                                if (origCb) origCb.apply(this, arguments);
                            };
                        }
                    });
                }, 10);

                const spacer1 = this.addWidget("custom_btn", "spacer1", null, () => {});
                spacer1.computeSize = function(width) { return [width, 15]; };
                spacer1.draw = function(ctx, node, widget_width, y, widget_height) {};

                this.toggleBtn = this.addWidget("custom_btn", "Toggle Settings", null, () => {});
                this.toggleBtn.computeSize = function(width) { return [width, 26]; };

                this.toggleBtn.draw = function(ctx, node, widget_width, y, widget_height) {
                    this.last_y = y;           
                    this.last_h = widget_height;

                    const margin = 15;
                    const btnWidth = widget_width - margin * 2;
                    const outlineColor = "#111"; 
                    const textColor = LiteGraph.WIDGET_TEXT_COLOR || "#ddd";

                    const hover = isHovered(node, margin, y, btnWidth, widget_height);
                    let bg = node.active_btn === 'toggle_settings' ? "#555" : (hover ? "#444" : "#333");

                    drawRoundedRect(ctx, margin, y, btnWidth, widget_height, 4, bg, outlineColor);

                    ctx.font = "12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = textColor;
                    ctx.fillText("⚙️ Toggle Settings", margin + btnWidth / 2, y + widget_height / 2);
                };

                this.toggleBtn.mouse = function(event, pos, node) {
                    if (pos[1] < this.last_y || pos[1] > this.last_y + this.last_h) return false;

                    if (event.type === "mousedown" || event.type === "pointerdown") {
                        const margin = 15;
                        const btnWidth = node.size[0] - margin * 2;

                        if (pos[0] >= margin && pos[0] <= margin + btnWidth) {
                            node.active_btn = 'toggle_settings';
                            node.setDirtyCanvas(true, true);
                            setTimeout(() => { node.active_btn = null; node.setDirtyCanvas(true, true); }, 150);
                            
                            node.settings_visible = !node.settings_visible;
                            node.applySettingsVisibility();
                            return true;
                        }
                    }
                    return false;
                };

                const settingsNames =[
                    "prefix", "folder", "date_subfolder", "naming", "format", 
                    "mp4_codec", "fps", "quality", "webp_lossless", 
                    "embed_workflow", "auto_save", "spacer1"
                ];

                this.applySettingsVisibility = function() {
                    if (!this.widgets) return;
                    
                    this.widgets.forEach(w => {
                        if (settingsNames.includes(w.name)) {
                            if (w.origType === undefined) {
                                w.origType = w.type;
                                w.origComputeSize = w.computeSize;
                            }
                            
                            if (this.settings_visible) {
                                w.type = w.origType;
                                w.computeSize = w.origComputeSize;
                            } else {
                                w.type = "hidden";
                                w.computeSize = () =>[0, -4];
                            }
                        }
                    });
                    
                    if (this.user_custom_height) {
                        this.size[1] = this.user_custom_height;
                    }
                    this.setDirtyCanvas(true, true);
                };

                setTimeout(() => {
                    const formatW = getWidget("format");
                    const updateWidgets = () => {
                        if (!formatW) return;
                        const fmt = formatW.value;
                        const codecW = getWidget("mp4_codec");
                        const lossW = getWidget("webp_lossless");
                        const qualW = getWidget("quality");
                        
                        if (codecW) codecW.disabled = (fmt !== ".mp4");
                        if (lossW) lossW.disabled = (fmt !== ".webp");
                        if (qualW) qualW.disabled = (fmt === ".gif" || (fmt === ".webp" && lossW?.value));
                    };
                    if (formatW) {
                        const origCb = formatW.callback;
                        formatW.callback = function() { updateWidgets(); if (origCb) origCb.apply(this, arguments); };
                    }
                    updateWidgets();
                }, 100);

                this.saveBtn = this.addWidget("custom_btn", "SaveVideoBtn", null, () => {});
                this.saveBtn.computeSize = function(width) { return [width, 26]; };
                this.saveBtn.draw = function(ctx, node, widget_width, y, widget_height) {
                    this.last_y = y;           
                    this.last_h = widget_height;

                    const margin = 15;
                    const btnWidth = widget_width - margin * 2;
                    const outlineColor = "#111"; 
                    const textColor = LiteGraph.WIDGET_TEXT_COLOR || "#ddd";

                    const hover = isHovered(node, margin, y, btnWidth, widget_height);
                    let bg = node.success_btn === 'save_vid' ? "#22bb22" : (node.active_btn === 'save_vid' ? "#555" : (hover ? "#444" : "#333"));
                    let text = node.success_btn === 'save_vid' ? "✅ Video Saved!" : "🎬 Save Video";

                    drawRoundedRect(ctx, margin, y, btnWidth, widget_height, 4, bg, outlineColor);

                    ctx.font = "12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillStyle = textColor;
                    ctx.fillText(text, margin + btnWidth / 2, y + widget_height / 2);
                };

                this.saveBtn.mouse = function(event, pos, node) {
                    if (pos[1] < this.last_y || pos[1] > this.last_y + this.last_h) return false;
                    if (event.type === "mousedown" || event.type === "pointerdown") {
                        const margin = 15;
                        const btnWidth = node.size[0] - margin * 2;
                        
                        if (pos[0] >= margin && pos[0] <= margin + btnWidth) {
                            
                            node.active_btn = 'save_vid';
                            node.setDirtyCanvas(true, true);
                            setTimeout(() => { node.active_btn = null; node.setDirtyCanvas(true, true); }, 150);
                            
                            if (!node.preview_filename) return alert("Please generate a video first!");
                            
                            // Added optional chaining fallback to prevent crash if widget goes missing
                            const options = {
                                prefix: getWidget("prefix")?.value ?? "ComfyUI",
                                folder: getWidget("folder")?.value ?? "",
                                date_subfolder: getWidget("date_subfolder")?.value ?? false,
                                naming: getWidget("naming")?.value ?? "Sequential",
                                format: getWidget("format")?.value ?? ".mp4"
                            };

                            api.fetchApi("/paraquoxel/smart_save_video", {
                                method: "POST",
                                body: JSON.stringify({ filename: node.preview_filename, options })
                            }).then(response => {
                                if(response.ok){
                                    node.success_btn = 'save_vid';
                                    node.setDirtyCanvas(true, true);
                                    setTimeout(() => { node.success_btn = null; node.setDirtyCanvas(true, true); }, 1000);
                                } else {
                                    alert("Error saving video!");
                                }
                            });
                            return true;
                        }
                    }
                    return false;
                };
            };

            const onSerialize = nodeType.prototype.onSerialize;
            nodeType.prototype.onSerialize = function(o) {
                if (onSerialize) onSerialize.apply(this, arguments);
                o.settings_visible = this.settings_visible;
                o.user_custom_height = this.user_custom_height;
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(o) {
                if (onConfigure) onConfigure.apply(this, arguments);
                if (o.user_custom_height !== undefined) {
                    this.user_custom_height = o.user_custom_height;
                    this.size[1] = this.user_custom_height; 
                }
                if (o.settings_visible !== undefined) {
                    this.settings_visible = o.settings_visible;
                    setTimeout(() => { if(this.applySettingsVisibility) this.applySettingsVisibility(); }, 10);
                }
            };

            // This onExecuted is strictly for handling the UI video/image DOM widget updating
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                if (onExecuted) onExecuted.apply(this, arguments);

                if (message && message.videos && message.videos.length > 0) {
                    const videoData = message.videos[0];
                    this.preview_filename = videoData.filename; 
                    
                    const params = new URLSearchParams({ filename: videoData.filename, type: "temp" });
                    params.append("t", Date.now()); 
                    const fileUrl = api.apiURL(`/view?${params.toString()}`);

                    this.updatePreviewWidget(fileUrl, videoData.format);
                }
            };

            nodeType.prototype.updatePreviewWidget = function(url, format) {
                const isVideo = ["mp4", "webm"].includes(format);
                const widgetName = "smart_video_preview";
                
                let existingWidget = this.widgets?.find(w => w.name === widgetName);
                if (existingWidget && existingWidget.element.tagName.toLowerCase() !== (isVideo ? "video" : "img")) {
                    existingWidget.element.remove();
                    this.widgets = this.widgets.filter(w => w.name !== widgetName);
                    existingWidget = null;
                }

                if (!existingWidget) {
                    let mediaEl = isVideo ? document.createElement("video") : document.createElement("img");
                    if (isVideo) {
                        mediaEl.controls = true; mediaEl.loop = true; mediaEl.autoplay = true;
                    }
                    
                    mediaEl.style.width = "100%";
                    mediaEl.style.height = "100%";
                    mediaEl.style.pointerEvents = "auto"; 
                    mediaEl.style.objectFit = "contain";
                    mediaEl.style.backgroundColor = "#1a1a1a";

                    existingWidget = this.addDOMWidget(widgetName, "media", mediaEl, { serialize: false, hideOnZoom: false });
                }

                existingWidget.element.src = url;
                if (isVideo) {
                    existingWidget.element.type = `video/${format}`;
                    existingWidget.element.load();
                    existingWidget.element.play().catch(e => console.warn("Autoplay blocked:", e));
                }
            };

            const onRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function() {
                if (this.widgets) {
                    for (let w of this.widgets) if (w.element?.parentNode) w.element.parentNode.removeChild(w.element);
                }
                if (onRemoved) onRemoved.apply(this, arguments);
            };
        }
    }
});
