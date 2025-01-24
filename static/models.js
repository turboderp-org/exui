import * as util from "./util.js";
import * as mainmenu from "./mainmenu.js";
import * as globals from "./globals.js";
import * as controls from "./controls.js";
import * as overlay from "./overlay.js";

export class Models {
    constructor() {
        this.page = util.newDiv(null, "models");

        let layout = util.newVFlex("grow");
        this.page.appendChild(layout);

        let layout_l = util.newHFlex();
        this.modelList = util.newDiv(null, "model-list");
        this.modelView = util.newDiv(null, "model-view");
        let panel = util.newDiv(null, "model-list-controls");
        layout.appendChild(layout_l);
        layout_l.appendChild(this.modelList);
        layout_l.appendChild(panel);
        layout.appendChild(this.modelView);

        this.removeButton = new controls.LinkButton("✖ Remove model", "✖ Confirm", () => { this.removeModel(this.lastModelUUID); });
        panel.appendChild(this.removeButton.element);

        this.items = new Map();
        this.labels = new Map();
        this.currentView = null;

        this.lastModelUUID = null;
    }

    onEnter() {
        fetch("/api/list_models")
        .then(response => response.json())
        .then(response => {
            globals.receiveGlobals(response);
            this.populateModelList(response);
        });
    }

    populateModelList(response) {

        this.modelList.innerHTML = "";

        for (let model_uuid in response.models)
            if (response.models.hasOwnProperty(model_uuid))
                this.addModel(response.models[model_uuid], model_uuid);

        this.addModel("New model", "new");
        let m = this.lastModelUUID ? this.lastModelUUID : "new";
        this.setModel(m);
        this.setLoadedModel(globals.g.loadedModelUUID);
    }

    addModel(name, modelID) {

        let nd = util.newDiv("model_" + modelID, "model-list-entry inactive");
        nd.addEventListener("click", () => {
            if (nd.classList.contains("inactive"))
                this.setModel(modelID);
        });

//        let nd1 = util.newDiv(null, null);
//        nd1.innerHTML = "<p>" + name + "</p>";

        let label = new controls.EditableLabel(name, false, (new_name) => {
            if (modelID == "new") {
                this.currentView.setName(new_name, () => {
                    let newID = this.currentView.modelID
                    this.lastModelUUID = newID;
                    this.onEnter();
                });
            } else {
                this.currentView.setName(new_name);
            }
        });

        let nd2 = util.newIcon(modelID == "new" ? "model-plus-icon" : "model-icon");
        let nd3 = util.newIcon("model-loaded-icon");
        nd2.classList.add("hidden");
        nd3.classList.add("hidden");
        nd3.classList.add("active");

        nd.appendChild(nd2);
        nd.appendChild(nd3);
        nd.appendChild(label.element);
        this.modelList.appendChild(nd);
        this.items.set(modelID, nd);
        this.labels.set(modelID, label);
    }

    setModel(modelID) {
        //console.log(modelID);
        this.items.forEach((v, k) => {
            let div = this.items.get(k);
            if (k == modelID) {
                div.classList.add("active");
                div.classList.remove("inactive");
            } else {
                div.classList.remove("active");
                div.classList.add("inactive");
            }
            let label = this.labels.get(k);
            label.setEditable(k == modelID);
        });

        this.currentView = new ModelView(modelID, this);
        this.currentView.updateView();
        this.modelView.innerHTML = "";
        this.modelView.appendChild(this.currentView.element);
        this.lastModelUUID = modelID;

        this.removeButton.setEnabled(modelID && modelID != "new");
    }

    setLoadedModel(modelID) {
        //console.log(modelID);
        this.items.forEach((v, k) => {
            let div = this.items.get(k);
            if (k == modelID) {
                div.children[0].classList.add("hidden");
                div.children[1].classList.remove("hidden");
            } else {
                div.children[0].classList.remove("hidden");
                div.children[1].classList.add("hidden");
            }
        });
    }

    removeModel() {
        let packet = {};
        packet.model_uuid = this.lastModelUUID;
        fetch("/api/remove_model", { method: "POST", headers: { "Content-Type": "application/json", }, body: JSON.stringify(packet) })
        .then(response => response.json())
        .then(response => {
            this.lastModelUUID = null;
            this.onEnter();
        });
    }
}

export class ModelView {
    constructor(modelID, parent) {
        this.modelID = modelID;
        this.parent = parent;

        this.element = util.newHFlex();
        this.modelInfo = {};
        this.modelInfo.model_uuid = modelID;
        this.modelInfo.model_directory = null;
        this.modelInfo_compiled = {};
        this.modelInfo_compiled_draft = {};
        this.populate();
        this.element.classList.add("hidden");
        this.error_message = "";
    }

    updateView() {
        if (!this.modelID || this.modelID == "new") {
            let model_info = {};
            model_info.model_uuid = "new";
            model_info.name = "New model";
            Object.assign(this.modelInfo, model_info);
            this.updateView_();
         } else {
            let packet = {};
            packet.model_uuid = this.modelID;
            fetch("/api/get_model_info", { method: "POST", headers: { "Content-Type": "application/json", }, body: JSON.stringify(packet) })
            .then(response => response.json())
            .then(response => {
                Object.assign(this.modelInfo, response.model_info);
                this.updateView_();
            });
        }
    }

    setName(new_name, post = null) {
        this.modelInfo.name = new_name;
        this.send(post);
    }

    send(post = null) {
        let packet = {};
        packet.model_info = this.modelInfo;
        fetch("/api/update_model", { method: "POST", headers: { "Content-Type": "application/json", }, body: JSON.stringify(packet) })
        .then(response => response.json())
        .then(response => {
            if (response.new_model_uuid) {
                this.modelID = response.new_model_uuid;
                this.modelInfo.model_uuid = response.new_model_uuid;
                this.parent.lastModelUUID = this.modelID;
                this.parent.onEnter();
            }
            this.updateView();
            if (post) post();
        });
    }

    updateView_() {
        this.label_name.refresh();
        this.tb_model_directory.refresh();

        let canLoad = false;
        let canUnload = false;

        if (!this.modelInfo.model_directory || this.modelInfo.model_directory == "") {
            this.element_model.classList.add("hidden");
            this.element_model_error.classList.add("hidden");
        } else if (this.modelInfo.config_status != "ok") {
            this.text_error.refresh();
            this.element_model.classList.add("hidden");
            this.element_model_error.classList.remove("hidden");
        } else {
            this.element_model.classList.remove("hidden");
            this.element_model_error.classList.add("hidden");
            canLoad = true;

            let s = this.compileStats(this.modelInfo.stats);
            this.modelInfo_compiled.stats1 = s.stats1;
            this.modelInfo_compiled.stats2 = s.stats2;
            this.modelInfo_compiled.stats3 = s.stats3;
            this.modelInfo_compiled.stats4 = s.stats4;
            this.modelInfo_compiled.stats5 = s.stats5;
            this.stats1.refresh();
            this.stats2.refresh();
            this.stats3.refresh();
            this.stats4.refresh();
            this.stats5.refresh();

            this.tb_seq_len.refresh();
            this.tb_rope_scale.refresh();
            this.tb_rope_alpha.refresh();
            this.cb_cache_mode.refresh();
            this.tb_chunk_size.refresh();
            this.tb_tp.refresh();
            this.tb_gpu_split.refresh();

            this.cb_speculative.refresh();
            if (this.modelInfo.speculative_mode == "Draft model") {
                this.element_draft_model.classList.remove("hidden");
                this.tb_draft_model_directory.refresh();

                if (!this.modelInfo.draft_model_directory || this.modelInfo.draft_model_directory == "") {
                    this.element_draft_model_s.classList.add("hidden");
                    this.element_draft_model_error.classList.add("hidden");
                } else if (this.modelInfo.draft_config_status != "ok") {
                    this.text_error_draft.refresh();
                    this.element_draft_model_s.classList.add("hidden");
                    this.element_draft_model_error.classList.remove("hidden");
                    canLoad = false;
                } else {
                    this.element_draft_model_s.classList.remove("hidden");
                    this.element_draft_model_error.classList.add("hidden");

                    s = this.compileStats(this.modelInfo.draft_stats);
                    this.modelInfo_compiled_draft.stats1 = s.stats1;
                    this.modelInfo_compiled_draft.stats2 = s.stats2;
                    this.modelInfo_compiled_draft.stats3 = s.stats3;
                    this.modelInfo_compiled_draft.stats4 = s.stats4;
                    this.modelInfo_compiled_draft.stats5 = s.stats5;
                    this.draft_stats1.refresh();
                    this.draft_stats2.refresh();
                    this.draft_stats3.refresh();
                    this.draft_stats4.refresh();
                    this.draft_stats5.refresh();

                    this.tb_draft_rope_alpha.refresh();
                }
            } else {
                this.element_draft_model.classList.add("hidden");
            }
        }

        if (this.modelID == globals.g.loadedModelUUID) {
            canLoad = false;
            canUnload = true;
        }

        this.button_load.setEnabled(canLoad);
        this.button_unload.setEnabled(canUnload);

        this.text_load_error.refresh();

        this.element.classList.remove("hidden");
    }

    compileStats(input_stats) {
        let s = {};
        let heads_q = input_stats.num_attention_heads;
        let heads_kv = input_stats.num_key_value_heads;
        let head_dim = input_stats.head_dim;
        s.stats1 = "" + input_stats.num_hidden_layers;
        s.stats2 = "" + input_stats.hidden_size + " (" + input_stats.intermediate_size + ")";
        if (heads_q == heads_kv) {
            s.stats3 = heads_q + ", dim: " + head_dim;
        } else {
            s.stats3 = "Q: " + heads_q + ", K/V: " + heads_kv + " (GQA), dim: " + head_dim;
        }
        s.stats4 = "" + input_stats.vocab_size;
        s.stats5 = "" + input_stats.default_seq_len + " tokens";
        return s;
    }

    populate() {
        this.element.innerHTML = "";

        this.label_name = new controls.Label("model-view-text header", this.modelInfo, "name");
        this.element.appendChild(this.label_name.element);

        this.element.appendChild(util.newDiv(null, "model-view-text divider", ""));
        this.element.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.tb_model_directory = new controls.LabelTextbox("model-view-item-left", "Model directory", "model-view-item-textbox wide", "~/models/my_model/", this.modelInfo, "model_directory", null, () => { this.send() } );
        this.element.appendChild(this.tb_model_directory.element);

        this.element_model = util.newHFlex();
        this.element_model_error = util.newHFlex();
        this.element.appendChild(this.element_model);
        this.element.appendChild(this.element_model_error);

        // Model error

        this.element_model_error.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.text_error = new controls.LabelText("model-view-item-left", "Error", "model-view-item-right error", this.modelInfo, "config_status_error");
        this.element_model_error.appendChild(this.text_error.element);

        // Model stats

        this.element_model.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.stats1 = new controls.LabelText("model-view-item-left", "Layers", "model-view-item-right", this.modelInfo_compiled, "stats1");
        this.stats2 = new controls.LabelText("model-view-item-left", "Dimension", "model-view-item-right", this.modelInfo_compiled, "stats2");
        this.stats3 = new controls.LabelText("model-view-item-left", "Heads", "model-view-item-right", this.modelInfo_compiled, "stats3");
        this.stats4 = new controls.LabelText("model-view-item-left", "Vocab size", "model-view-item-right", this.modelInfo_compiled, "stats4");
        this.stats5 = new controls.LabelText("model-view-item-left", "Default context length", "model-view-item-right", this.modelInfo_compiled, "stats5");
        this.element_model.appendChild(this.stats1.element);
        this.element_model.appendChild(this.stats2.element);
        this.element_model.appendChild(this.stats3.element);
        this.element_model.appendChild(this.stats4.element);
        this.element_model.appendChild(this.stats5.element);

        // Context

        this.element_model.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.tb_seq_len = new controls.LabelNumbox("model-view-item-left", "Context length", "model-view-item-textbox shortright", "", this.modelInfo, "seq_len", 32, 1024*1024, 0, () => { this.send() } );
        this.tb_rope_scale = new controls.LabelNumbox("model-view-item-left", "RoPE scale", "model-view-item-textbox shortright", "", this.modelInfo, "rope_scale", 0.01, 1000, 2, () => { this.send() } );
        this.tb_rope_alpha = new controls.LabelNumbox("model-view-item-left", "RoPE alpha", "model-view-item-textbox shortright", "", this.modelInfo, "rope_alpha", 0.01, 1000, 2, () => { this.send() } );
        this.cb_cache_mode = new controls.LabelCombobox("model-view-item-left", "Cache mode", "model-view-item-combobox short", [ "FP16", "FP8", "Q4", "Q6", "Q8" ], this.modelInfo, "cache_mode", () => { this.send() } );
        this.tb_chunk_size = new controls.LabelNumbox("model-view-item-left", "Chunk size", "model-view-item-textbox shortright", "", this.modelInfo, "chunk_size", 32, 1024*1024, 0, () => { this.send() } );
        this.tb_tp = new controls.LabelCheckbox("model-view-item-left", "TP (experimental)", "model-view-item-right checkbox", "Enabled", this.modelInfo, "tensor_p", () => { this.send() } );
        this.tb_gpu_split = new controls.LabelTextbox("model-view-item-left", "GPU split", "model-view-item-textbox short", "8.5,12", this.modelInfo, "gpu_split", null, () => { this.send() }, "gpu_split_auto" );
//        this.chbk_ngram = new controls.LabelCheckbox("model-view-item-left", "N-gram decoding", "model-view-item-right checkbox", "Enabled", this.modelInfo, "speculative_ngram", () => { this.send() } );

        this.element_model.appendChild(this.tb_seq_len.element);
        this.element_model.appendChild(this.tb_rope_scale.element);
        this.element_model.appendChild(this.tb_rope_alpha.element);
        this.element_model.appendChild(this.cb_cache_mode.element);
        this.element_model.appendChild(this.tb_chunk_size.element);
        this.element_model.appendChild(this.tb_tp.element);
        this.element_model.appendChild(this.tb_gpu_split.element);
//        this.element_model.appendChild(this.chbk_ngram.element);

        // Speculative decoding

        this.element_model.appendChild(util.newDiv(null, "model-view-text spacer", ""));
        this.element_model.appendChild(util.newDiv(null, "model-view-text divider", ""));
        this.element_model.appendChild(util.newDiv(null, "model-view-text spacer", ""));

//        this.chbk_speculative = new controls.LabelCheckbox("model-view-item-left", "Speculative decoding", "model-view-item-right checkbox", "Enabled", this.modelInfo, "draft_enabled", () => { this.send() } );
//        this.element_model.appendChild(this.chbk_speculative.element);
        this.cb_speculative = new controls.LabelCombobox("model-view-item-left", "Speculative decoding", "model-view-item-combobox short", [ "None", "N-gram", "Draft model" ], this.modelInfo, "speculative_mode", () => { this.send() } );
        this.element_model.appendChild(this.cb_speculative.element);

        this.element_draft_model = util.newHFlex();
        this.element_model.appendChild(this.element_draft_model);

        //this.element_model.appendChild(util.newDiv(null, "model-view-text spacer", ""));
        this.element_draft_model.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.tb_draft_model_directory = new controls.LabelTextbox("model-view-item-left", "Draft model directory", "model-view-item-textbox wide", "~/models/my_draft_model/", this.modelInfo, "draft_model_directory", null, () => { this.send() } );
        this.element_draft_model.appendChild(this.tb_draft_model_directory.element);

        this.element_draft_model_s = util.newHFlex();
        this.element_draft_model_error = util.newHFlex();
        this.element_draft_model.appendChild(this.element_draft_model_s);
        this.element_draft_model.appendChild(this.element_draft_model_error);

        // Draft model error

        this.element_draft_model_error.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.text_error_draft = new controls.LabelText("model-view-item-left", "Error", "model-view-item-right error", this.modelInfo, "draft_config_status_error");
        this.element_draft_model_error.appendChild(this.text_error_draft.element);

        // Draft model stats

        this.element_draft_model_s.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.draft_stats1 = new controls.LabelText("model-view-item-left", "Layers", "model-view-item-right", this.modelInfo_compiled_draft, "stats1");
        this.draft_stats2 = new controls.LabelText("model-view-item-left", "Dimension", "model-view-item-right", this.modelInfo_compiled_draft, "stats2");
        this.draft_stats3 = new controls.LabelText("model-view-item-left", "Heads", "model-view-item-right", this.modelInfo_compiled_draft, "stats3");
        this.draft_stats4 = new controls.LabelText("model-view-item-left", "Vocab size", "model-view-item-right", this.modelInfo_compiled_draft, "stats4");
        this.draft_stats5 = new controls.LabelText("model-view-item-left", "Default context length", "model-view-item-right", this.modelInfo_compiled_draft, "stats5");
        this.element_draft_model_s.appendChild(this.draft_stats1.element);
        this.element_draft_model_s.appendChild(this.draft_stats2.element);
        this.element_draft_model_s.appendChild(this.draft_stats3.element);
        this.element_draft_model_s.appendChild(this.draft_stats4.element);
        this.element_draft_model_s.appendChild(this.draft_stats5.element);

        // Draft context

        this.element_draft_model_s.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.tb_draft_rope_alpha = new controls.LabelNumbox("model-view-item-left", "RoPE alpha", "model-view-item-textbox shortright", "", this.modelInfo, "draft_rope_alpha", 0.01, 1000, 2, () => { this.send() }, "draft_rope_alpha_auto" );
        this.element_draft_model_s.appendChild(this.tb_draft_rope_alpha.element);

        // Load/unload

        this.element.appendChild(util.newDiv(null, "model-view-text spacer", ""));
        this.element.appendChild(util.newDiv(null, "model-view-text divider", ""));
        this.element.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.buttons = util.newVFlex();
        this.element.appendChild(this.buttons);

        this.button_load = new controls.Button("⏵ Load model", () => { this.loadModel(); } );
        this.button_unload = new controls.Button("⏹ Unload model", () => { this.unloadModel() } );
        this.buttons.appendChild(this.button_load.element);
        this.buttons.appendChild(this.button_unload.element);

        // Error

        this.element.appendChild(util.newDiv(null, "model-view-text spacer", ""));
        this.element.appendChild(util.newDiv(null, "model-view-text spacer", ""));

        this.text_load_error = new controls.Label("model-view-item-text error", this, "error_message");
        this.element.appendChild(this.text_load_error.element);

    }

    loadModel() {
        const controller = new AbortController();
        const signal = controller.signal;

        overlay.loadingOverlay.setProgress(0, 1);
        overlay.pageOverlay.setMode("loading");

        let packet = {};
        packet.model_uuid = this.modelID;

        let timeout = new Promise((resolve, reject) => {
            let id = setTimeout(() => {
                clearTimeout(id);
                reject('No response from server')
            }, 10000)
        });

        overlay.loadingOverlay.onCancel = () => {
            controller.abort();
            overlay.pageOverlay.setMode();
            this.error_message = "Loading cancelled";
            this.updateView();
        };

        let fetchRequest = fetch("/api/load_model", {
            method: "POST",
            headers: { "Content-Type": "application/json", },
            body: JSON.stringify(packet),
            signal: signal
        });

        const self = this;
        Promise.race([fetchRequest, timeout])
        .then(response => {
            if (response.ok) {
                return response.body;
            } else {
                throw new Error("Network response was not ok.");
            }
        })
        .then(stream => {
            let reader = stream.getReader();
            let decoder = new TextDecoder();
            let data = '';
            reader.read().then(function process({done, value}) {
                if (done) {
                    overlay.pageOverlay.setMode();
                    //self.error_message = null;
                    //self.parent.setLoadedModel(self.modelID);
                    self.updateView();
                    return;
                }
                data += decoder.decode(value, {stream: true});
                let lines = data.split('\n');
                for (let i = 0; i < lines.length - 1; i++) {
                    let json = null;
                    try {
                        json = JSON.parse(lines[i]);
                    } catch(e) {
                        console.error("Invalid JSON:", lines[i]);
                        break;
                    }
                    if (json.result == "ok") {
                        globals.g.loadedModelUUID = packet.model_uuid;
                        globals.g.failedModelUUID = null;
                        self.error_message = null;
                        self.parent.setLoadedModel(self.modelID);
                    } else if (json.result == "progress") {
                        overlay.loadingOverlay.setProgress(json.module, json.num_modules);
                        //console.log(json);
                    } else {
                        globals.g.loadedModelUUID = null;
                        globals.g.failedModelUUID = packet.model_uuid;
                        self.error_message = json.error;
                        console.log(json);
                    }
                }
                data = lines[lines.length - 1];
                reader.read().then(process);
            });
        })
        .catch(error => {
            globals.g.loadedModelUUID = null;
            globals.g.failedModelUUID = packet.model_uuid;
            this.error_message = "" + error;
            console.error('Error:', error);
            overlay.pageOverlay.setMode();
            this.parent.setLoadedModel(null);
            this.updateView();
        });
    }

    unloadModel() {

        overlay.loadingOverlay.setProgress(0, 1);
        overlay.pageOverlay.setMode("busy");

        fetch("/api/unload_model")
        .then(response => response.json())
        .then(json => {
            if (json.result == "ok") {
                globals.g.loadedModelUUID = null;
                globals.g.failedModelUUID = null;
            }
            overlay.pageOverlay.setMode();
            this.parent.setLoadedModel(null);
            this.error_message = null;
            this.updateView();
        });
    }
}
