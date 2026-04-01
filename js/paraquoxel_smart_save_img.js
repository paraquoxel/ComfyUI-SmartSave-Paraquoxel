import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

app.registerExtension({
    name: "paraquoxel.SmartSave",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "SmartSaveNode") {

            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);
                
                this.title = "SmartSave IMG | Paraquoxel";
                this.size = [350, 450]; 
                this.settings_visible = true;
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
                        if (app.canvas.canvas.title !== foundTooltip) app.canvas.canvas.title = foundTooltip;
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
                            w.options.tooltip = "Supported placeholders:[date], [time]";
                        } else if (w.name === "folder") {
                            w.label = "folder";
                            if (!w.options) w.options = {};
                            w.options.tooltip = "If left empty, the default output directory will be used.";
                        } else if (w.name) {
                            w.label = w.name.replace(/_/g, " ");
                        }

                        if (w.type === "number" && (w.name === "dpi" || w.name === "quality")) {
                            if (!w.options) w.options = {};
                            w.options.precision = 0; 
                            w.options.step = (w.name === "dpi") ? 10 : 1;

                            const origCb = w.callback;
                            w.callback = function(val) {
                                this.value = Math.round(this.value);
                                if (origCb) origCb.apply(this, arguments);
                            };
                        }
                    });
                }, 10);

                const spacer1 = this.addWidget("custom_btn", "spacer1", null, () => {});
                spacer1.computeSize = function(width) { return [width, 12]; };
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

                const spacer2 = this.addWidget("custom_btn", "spacer2", null, () => {});
                spacer2.computeSize = function(width) { return [width, 6]; };
                spacer2.draw = function(ctx, node, widget_width, y, widget_height) {};

                const settingsNames =[
                    "prefix", "folder", "date_subfolder", "naming", "format", 
                    "dpi", "quality", "webp_lossless", "png_optimize",
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
                                w.computeSize = () => [0, -4];
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
                        const lossW = getWidget("webp_lossless");
                        const qualW = getWidget("quality");
                        const optW = getWidget("png_optimize");
                        const embW = getWidget("embed_workflow");
                        
                        if (lossW) lossW.disabled = (fmt !== ".webp");
                        if (qualW) qualW.disabled = (fmt === ".png" || fmt === ".tif" || (fmt === ".webp" && lossW?.value));
                        if (optW) optW.disabled = (fmt !== ".png");
                        if (embW) embW.disabled = (fmt !== ".png" && fmt !== ".webp");
                    };
                    if (formatW) {
                        const origCb = formatW.callback;
                        formatW.callback = function() { updateWidgets(); if (origCb) origCb.apply(this, arguments); };
                    }
                    const lossWidget = getWidget("webp_lossless");
                    if (lossWidget) {
                         const origCb = lossWidget.callback;
                         lossWidget.callback = function() { updateWidgets(); if(origCb) origCb.apply(this, arguments); };
                    }
                    updateWidgets();
                }, 100);

                const sendSaveRequest = async (filename, batchIndex = "", btnId = "") => {
                    let prefW = getWidget("prefix");
                    let safePrefix = prefW ? prefW.value : "ComfyUI";
                    if (batchIndex !== "") safePrefix = `${safePrefix}_${batchIndex}`;

                    // Safe parameter fetching to prevent UI crashes
                    const options = {
                        prefix: safePrefix,
                        folder: getWidget("folder")?.value || "",
                        date_subfolder: getWidget("date_subfolder")?.value ?? false,
                        naming: getWidget("naming")?.value || "Sequential",
                        format: getWidget("format")?.value || ".png",
                        quality: getWidget("quality")?.value ?? 100,
                        webp_lossless: getWidget("webp_lossless")?.value ?? false,
                        dpi: getWidget("dpi")?.value ?? 96,
                        embed_workflow: getWidget("embed_workflow")?.value ?? true,
                        png_optimize: getWidget("png_optimize")?.value ?? false
                    };

                    try {
                        const response = await api.fetchApi("/paraquoxel/save_smart", {
                            method: "POST",
                            body: JSON.stringify({ filename, options, batch_index: batchIndex }),
                        });

                        if (response.ok) {
                            const oldColor = this.color;
                            this.color = "#22bb22"; 
                            this.success_btn = btnId;
                            this.setDirtyCanvas(true, true);
                            
                            setTimeout(() => { 
                                this.color = oldColor; 
                                this.success_btn = null;
                                this.setDirtyCanvas(true, true); 
                            }, 1000);
                        }
                    } catch (e) { console.error("[SmartSave] Error:", e); }
                };

                const saveSelectedImage = async () => {
                    if (!this.images || this.images.length === 0) return alert("No image available!");
                    let idx = this.imageIndex || 0; 
                    if (idx >= this.images.length) idx = 0;
                    const filename = this.images[idx].filename || this.images[idx].name;
                    await sendSaveRequest(filename, "", "save_selected");
                };

                const saveAllImages = async (imagesToSave = null) => {
                    const targetImages = imagesToSave || this.images;
                    if (!targetImages || targetImages.length === 0) return;
                    for (let i = 0; i < targetImages.length; i++) {
                        const filename = targetImages[i].filename || targetImages[i].name;
                        await sendSaveRequest(filename, i + 1, "save_batch");
                    }
                };
                
                this.doSaveAllImages = saveAllImages;

                const saveRangeImages = async () => {
                    if (!this.images || this.images.length === 0) return alert("No images available!");
                    const inputStr = this.rangeWidget.rangeValue || ""; 
                    let indices = new Set();
                    let parts = inputStr.split(',');

                    for (let p of parts) {
                        p = p.trim();
                        if (!p) continue;
                        if (p.includes('-')) {
                            let [start, end] = p.split('-');
                            start = parseInt(start); end = parseInt(end);
                            if (!isNaN(start) && !isNaN(end)) {
                                let min = Math.min(start, end); let max = Math.max(start, end);
                                for (let i = min; i <= max; i++) {
                                    if (i >= 1 && i <= this.images.length) indices.add(i - 1);
                                }
                            }
                        } else {
                            let val = parseInt(p);
                            if (!isNaN(val) && val >= 1 && val <= this.images.length) indices.add(val - 1);
                        }
                    }

                    const arr = Array.from(indices).sort((a, b) => a - b);
                    if (arr.length === 0) return alert("Invalid input or no matching images found!");

                    for (let i = 0; i < arr.length; i++) {
                        const idx = arr[i];
                        const filename = this.images[idx].filename || this.images[idx].name;
                        await sendSaveRequest(filename, idx + 1, "save_range"); 
                    }
                };

                const row2 = this.addWidget("custom_btn", "Row2", null, () => {});
                row2.computeSize = function(width) { return[width, 26]; };

                row2.draw = function(ctx, node, widget_width, y, widget_height) {
                    row2.last_y = y;           
                    row2.last_h = widget_height;

                    const margin = 15; const gap = 10;
                    const btnWidth = (widget_width - margin * 2 - gap) / 2;
                    const outlineColor = "#111"; 
                    const textColor = LiteGraph.WIDGET_TEXT_COLOR || "#ddd";

                    const leftHover = isHovered(node, margin, y, btnWidth, widget_height);
                    const rightHover = isHovered(node, margin + btnWidth + gap, y, btnWidth, widget_height);

                    let leftBg = node.success_btn === 'save_selected' ? "#22bb22" : (node.active_btn === 'save_selected' ? "#555" : (leftHover ? "#444" : "#333"));
                    let rightBg = node.success_btn === 'save_batch' ? "#22bb22" : (node.active_btn === 'save_batch' ? "#555" : (rightHover ? "#444" : "#333"));

                    drawRoundedRect(ctx, margin, y, btnWidth, widget_height, 4, leftBg, outlineColor);
                    drawRoundedRect(ctx, margin + btnWidth + gap, y, btnWidth, widget_height, 4, rightBg, outlineColor);

                    ctx.font = "12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    let leftText = "💾 Save Image";
                    if (node.images && node.images.length > 1) {
                        let idx = (node.imageIndex || 0) + 1;
                        leftText = `💾 Save Selected (${idx}/${node.images.length})`;
                    }
                    if (node.success_btn === 'save_selected') leftText = "✅ Saved!";
                    let rightText = node.success_btn === 'save_batch' ? "✅ Saved!" : "📑 Save Batch";

                    ctx.fillStyle = textColor;
                    ctx.fillText(leftText, margin + btnWidth / 2, y + widget_height / 2);
                    ctx.fillText(rightText, margin + btnWidth + gap + btnWidth / 2, y + widget_height / 2);
                };

                row2.mouse = function(event, pos, node) {
                    if (pos[1] < row2.last_y || pos[1] > row2.last_y + row2.last_h) return false;

                    if (event.type === "mousedown" || event.type === "pointerdown") {
                        const margin = 15; const gap = 10;
                        const btnWidth = (node.size[0] - margin * 2 - gap) / 2;

                        if (pos[0] >= margin && pos[0] <= margin + btnWidth) {
                            node.active_btn = 'save_selected';
                            node.setDirtyCanvas(true, true);
                            setTimeout(() => { node.active_btn = null; node.setDirtyCanvas(true, true); }, 150);
                            saveSelectedImage(); return true;
                        } else if (pos[0] >= margin + btnWidth + gap && pos[0] <= margin + btnWidth * 2 + gap) {
                            node.active_btn = 'save_batch';
                            node.setDirtyCanvas(true, true);
                            setTimeout(() => { node.active_btn = null; node.setDirtyCanvas(true, true); }, 150);
                            saveAllImages(); return true;
                        }
                    }
                    return false;
                };

                this.rangeWidget = this.addWidget("custom_btn", "Row3", null, () => {});
                this.rangeWidget.rangeValue = ""; 
                this.rangeWidget.computeSize = function(width) { return [width, 26]; };

                this.rangeWidget.draw = function(ctx, node, widget_width, y, widget_height) {
                    node.rangeWidget.last_y = y;       
                    node.rangeWidget.last_h = widget_height;

                    const margin = 15; const gap = 10;
                    const btnWidth = (widget_width - margin * 2 - gap) / 2;
                    const outlineColor = "#111"; 
                    const textColor = LiteGraph.WIDGET_TEXT_COLOR || "#ddd";

                    const leftHover = isHovered(node, margin, y, btnWidth, widget_height);
                    const rightHover = isHovered(node, margin + btnWidth + gap, y, btnWidth, widget_height);

                    let leftBg = node.active_btn === 'range_input' ? "#333" : (leftHover ? "#2a2a2a" : "#1a1a1a"); 
                    let rightBg = node.success_btn === 'save_range' ? "#22bb22" : (node.active_btn === 'save_range' ? "#555" : (rightHover ? "#444" : "#333"));

                    drawRoundedRect(ctx, margin, y, btnWidth, widget_height, 4, leftBg, "#555");
                    drawRoundedRect(ctx, margin + btnWidth + gap, y, btnWidth, widget_height, 4, rightBg, outlineColor);

                    ctx.font = "12px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    
                    let displayVal = node.rangeWidget.rangeValue || "";
                    
                    ctx.save();
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(margin, y, btnWidth, widget_height, 4);
                    else ctx.rect(margin, y, btnWidth, widget_height);
                    ctx.clip();
                    
                    if (displayVal.trim() === "") {
                        ctx.fillStyle = "#777"; 
                        ctx.fillText("📝 e.g. 1, 2, 4-6", margin + btnWidth / 2, y + widget_height / 2);
                    } else {
                        ctx.fillStyle = "#fff"; 
                        ctx.fillText("📝 " + displayVal, margin + btnWidth / 2, y + widget_height / 2);
                    }
                    ctx.restore();

                    let rightText = node.success_btn === 'save_range' ? "✅ Saved!" : "🎯 Save Range";
                    ctx.fillStyle = textColor;
                    ctx.fillText(rightText, margin + btnWidth + gap + btnWidth / 2, y + widget_height / 2);
                };

                this.rangeWidget.mouse = function(event, pos, node) {
                    if (pos[1] < node.rangeWidget.last_y || pos[1] > node.rangeWidget.last_y + node.rangeWidget.last_h) return false;

                    if (event.type === "mousedown" || event.type === "pointerdown") {
                        const margin = 15; const gap = 10;
                        const btnWidth = (node.size[0] - margin * 2 - gap) / 2;

                        if (pos[0] >= margin && pos[0] <= margin + btnWidth) {
                            node.active_btn = 'range_input';
                            node.setDirtyCanvas(true, true);
                            setTimeout(() => { node.active_btn = null; node.setDirtyCanvas(true, true); }, 150);
                            
                            setTimeout(() => {
                                let msg = "Image selection for 'Save Range':\n\n" +
                                          "• Single images: 1, 3, 5\n" +
                                          "• Image ranges: 2-6\n" +
                                          "• Combined: 1, 3, 5-8\n\n" +
                                          "Please enter here:";
                                let input = prompt(msg, node.rangeWidget.rangeValue);
                                if (input !== null) {
                                    node.rangeWidget.rangeValue = input.trim();
                                    node.setDirtyCanvas(true, true); 
                                }
                            }, 50);
                            return true;
                        } else if (pos[0] >= margin + btnWidth + gap && pos[0] <= margin + btnWidth * 2 + gap) {
                            node.active_btn = 'save_range';
                            node.setDirtyCanvas(true, true);
                            setTimeout(() => { node.active_btn = null; node.setDirtyCanvas(true, true); }, 150);

                            saveRangeImages(); 
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
                if (this.rangeWidget) o.range_value = this.rangeWidget.rangeValue; 
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
                    setTimeout(() => this.applySettingsVisibility(), 10);
                }
                if (o.range_value !== undefined && this.rangeWidget) {
                    this.rangeWidget.rangeValue = o.range_value; 
                }
            };
        }
    }
});
