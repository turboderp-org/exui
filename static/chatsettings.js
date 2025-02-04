import * as util from "./util.js";
import * as mainmenu from "./mainmenu.js";
import * as globals from "./globals.js";
import * as controls from "./controls.js";
import * as overlay from "./overlay.js";

export class SessionSettings {
    constructor(parent) {
        this.element = util.newHFlex();
        this.parent = parent;
        this.settings = this.parent.chatSettings;
        this.modelDefaultValues = {};  // Store model default values
        this.samplingControls = [];  // Initialize sampling controls array
        //console.log(this.settings);
        this.populate();
    }

    populate() {
        this.element.innerHTML = "";

        this.sss_promptFormat = new controls.CollapsibleSection(null, "Prompt format");
        this.sss_roles = new controls.CollapsibleSection(null, "Roles");
        this.sss_systemPrompt = new controls.CollapsibleSection(null, "System prompt");
        this.sss_genParams = new controls.CollapsibleSection(null, "Generation parameters");
        this.sss_sampling = new controls.CollapsibleSection(null, "Sampling");
        this.sss_stopConditions = new controls.CollapsibleSection(null, "Stop conditions");
        this.sss_bannedStrings = new controls.CollapsibleSection(null, "Banned strings");
        this.element.appendChild(this.sss_promptFormat.element);
        this.element.appendChild(this.sss_roles.element);
        this.element.appendChild(this.sss_systemPrompt.element);
        this.element.appendChild(this.sss_genParams.element);
        this.element.appendChild(this.sss_sampling.element);
        this.element.appendChild(this.sss_stopConditions.element);
        this.element.appendChild(this.sss_bannedStrings.element);

        // Prompt format

        this.sss_i_promptFormat = new controls.LabelCombobox("sss-item-left", "Format", "sss-item-right sss-item-combobox", globals.g.promptFormats, this.settings, "prompt_format", () => { this.updateView(true); } );
        this.sss_promptFormat.inner.appendChild(this.sss_i_promptFormat.element);

        // Roles

        this.sss_i_roles = [];
        this.sss_i_roles[0] = new controls.LabelTextbox("sss-item-left", "User",   "sss-item-mid sss-item-textbox", "", this.settings.roles, 0, (v) => { return v.trim() != ""; }, () => { this.updateView(true); }, null);
        this.sss_i_roles[1] = new controls.LabelTextbox("sss-item-left", "Bot #1", "sss-item-mid sss-item-textbox", "", this.settings.roles, 1, (v) => { return v.trim() != ""; }, () => { this.updateView(true); }, null);
        for (let i = 2; i < 8; i++)
            this.sss_i_roles[i] = new controls.LabelTextboxButton("sss-item-left", "Bot #" + i, "sss-item-mid sss-item-textbox", "", this.settings.roles, i, (v) => { return v.trim() != ""; }, () => { this.updateView(true); }, null, "✕ Remove", () => { this.removeRole(i); });

        this.sss_i_addRole = new controls.LinkButton("+ Add...", null, () => { this.addRole(); }, "sss-item-link");

        for (let i = 0; i < 8; i++) this.sss_roles.inner.appendChild(this.sss_i_roles[i].element);
        this.sss_roles.inner.appendChild(this.sss_i_addRole.element);

        // System prompt

        this.sss_i_systemPrompt = new controls.LargeTextbox("sss-item-big-textbox", "Prompt...", this.settings, "system_prompt", null, () => { this.updateView(true); });
        this.sss_systemPrompt.inner.appendChild(this.sss_i_systemPrompt.element);

        // Generation params

        this.sss_i_minTokens   = new controls.SettingsSlider("sss-item-left", "Min tokens",    "sss-item-mid", "sss-item-right sss-item-textbox-r", 0,  1, 8192, null,                             this.settings, "mintokens",    () => { this.updateView(true); });
        this.sss_i_maxTokens   = new controls.SettingsSlider("sss-item-left", "Max tokens",    "sss-item-mid", "sss-item-right sss-item-textbox-r", 0, 16, 8192, null,                             this.settings, "maxtokens",    () => { this.updateView(true); });
        this.sss_i_chunkTokens = new controls.SettingsSlider("sss-item-left", "Chunk tokens",  "sss-item-mid", "sss-item-right sss-item-textbox-r", 0, 16, 8192, null,                             this.settings, "chunktokens",  () => { this.updateView(true); });
        this.sss_genParams.inner.appendChild(this.sss_i_minTokens.element);
        this.sss_genParams.inner.appendChild(this.sss_i_maxTokens.element);
        this.sss_genParams.inner.appendChild(this.sss_i_chunkTokens.element);

        // Sampling

        this.sss_i_temperature      = new controls.SettingsSlider("sss-item-left", "Temperature",   "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     0,    5, null,                             this.settings, "temperature",  () => { this.updateView(true); });
        this.sss_i_topK             = new controls.SettingsSlider("sss-item-left", "Top K",         "sss-item-mid", "sss-item-right sss-item-textbox-r", 0,     0, 1000, { "0": "off" },                   this.settings, "top_k",        () => { this.updateView(true); });
        this.sss_i_topP             = new controls.SettingsSlider("sss-item-left", "Top P",         "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     0,    1, { "0.00": "off", "1.00": "off" }, this.settings, "top_p",        () => { this.updateView(true); });
        this.sss_i_minP             = new controls.SettingsSlider("sss-item-left", "Min P",         "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     0,    1, { "0.00": "off", "1.00": "off" }, this.settings, "min_p",        () => { this.updateView(true); });
        this.sss_i_quadSampling     = new controls.SettingsSlider("sss-item-left", "Quad. smooth",  "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     0,    2, { "0.00": "off" },                this.settings, "quad_sampling",() => { this.updateView(true); });
        this.sss_i_tfs              = new controls.SettingsSlider("sss-item-left", "TFS",           "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     0,    1, { "0.00": "off", "1.00": "off" }, this.settings, "tfs",          () => { this.updateView(true); });
        this.sss_i_typical          = new controls.SettingsSlider("sss-item-left", "Typical",       "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     0,    1, { "0.00": "off", "1.00": "off" }, this.settings, "typical",      () => { this.updateView(true); });
        this.sss_i_skew             = new controls.SettingsSlider("sss-item-left", "Skew",          "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,    -5,    5, { "0.00": "off" },                this.settings, "skew",         () => { this.updateView(true); });
        this.sss_i_repPenalty       = new controls.SettingsSlider("sss-item-left", "Rep. penalty",  "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,     1,    3, { "1.00": "off" },                this.settings, "repp",         () => { this.updateView(true); });
        this.sss_i_repRange         = new controls.SettingsSlider("sss-item-left", "Rep. range",    "sss-item-mid", "sss-item-right sss-item-textbox-r", 0,     0, 4096, { "0": "off" },                   this.settings, "repr",         () => { this.updateView(true); });

        this.sss_i_mirostat         = new controls.CheckboxLabel("sss-item-right clickable", "Mirostat", this.settings, "mirostat", () => { this.updateView(true); });
        this.sss_i_mirostat_tau     = new controls.SettingsSlider("sss-item-left", "Mirostat tau",  "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,  0.01,   10, null,                             this.settings, "mirostat_tau", () => { this.updateView(true); });
        this.sss_i_mirostat_eta     = new controls.SettingsSlider("sss-item-left", "Mirostat eta",  "sss-item-mid", "sss-item-right sss-item-textbox-r", 2,  0.01,    5, null,                             this.settings, "mirostat_eta", () => { this.updateView(true); });

        this.sss_i_temperature_last = new controls.CheckboxLabel("sss-item-right clickable", "Temperature last", this.settings, "temperature_last", () => { this.updateView(true); });

        this.sss_sampling.inner.appendChild(this.sss_i_temperature.element);
        this.sss_sampling.inner.appendChild(this.sss_i_topK.element);
        this.sss_sampling.inner.appendChild(this.sss_i_topP.element);
        this.sss_sampling.inner.appendChild(this.sss_i_minP.element);
        this.sss_sampling.inner.appendChild(this.sss_i_quadSampling.element);
        this.sss_sampling.inner.appendChild(this.sss_i_tfs.element);
        this.sss_sampling.inner.appendChild(this.sss_i_typical.element);
        this.sss_sampling.inner.appendChild(this.sss_i_skew.element);
        this.sss_sampling.inner.appendChild(this.sss_i_repPenalty.element);
        this.sss_sampling.inner.appendChild(this.sss_i_repRange.element);

        this.sss_sampling.inner.appendChild(this.sss_i_mirostat.element);
        this.sss_sampling.inner.appendChild(this.sss_i_mirostat_tau.element);
        this.sss_sampling.inner.appendChild(this.sss_i_mirostat_eta.element);

        this.sss_sampling.inner.appendChild(this.sss_i_temperature_last.element);

        // Add buttons for model and app defaults
        let buttonsContainer = document.createElement("div");
        buttonsContainer.style.display = "flex";
        buttonsContainer.style.gap = "10px";

        this.sss_i_applyModelParams = new controls.Button("Model defaults", () => this.applyModelDefaults());
        this.sss_i_applyModelParams.element.style.width = "130px";

        this.sss_i_resetToAppDefaults = new controls.Button("App defaults", () => this.resetToAppDefaults());
        this.sss_i_resetToAppDefaults.element.style.width = "130px";

        buttonsContainer.appendChild(this.sss_i_applyModelParams.element);
        buttonsContainer.appendChild(this.sss_i_resetToAppDefaults.element);

        // Map parameter names to their label elements
        this.paramLabels = {
            temperature: this.sss_i_temperature.element.querySelector(".sss-item-left"),
            top_k: this.sss_i_topK.element.querySelector(".sss-item-left"),
            top_p: this.sss_i_topP.element.querySelector(".sss-item-left"),
            min_p: this.sss_i_minP.element.querySelector(".sss-item-left"),
            quad_sampling: this.sss_i_quadSampling.element.querySelector(".sss-item-left"),
            tfs: this.sss_i_tfs.element.querySelector(".sss-item-left"),
            typical: this.sss_i_typical.element.querySelector(".sss-item-left"),
            skew: this.sss_i_skew.element.querySelector(".sss-item-left"),
            repp: this.sss_i_repPenalty.element.querySelector(".sss-item-left"),
            repr: this.sss_i_repRange.element.querySelector(".sss-item-left"),
            mirostat: this.sss_i_mirostat.element,
            mirostat_tau: this.sss_i_mirostat_tau.element.querySelector(".sss-item-left"),
            mirostat_eta: this.sss_i_mirostat_eta.element.querySelector(".sss-item-left"),
            temperature_last: this.sss_i_temperature_last.element
        };

        // Helper function to toggle label highlights
        const toggleHighlights = (modelParams, shouldHighlight) => {
            Object.entries(modelParams).forEach(([param, isDefined]) => {
                const label = this.paramLabels[param];
                if (isDefined && label) {
                    if (shouldHighlight) {
                        label.classList.add("highlight-label");
                    } else {
                        label.classList.remove("highlight-label");
                    }
                }
            });
        };

        // Function to check if any sampling parameter differs from model defaults
        const checkModelParamsDiffer = async () => {
            try {
                const response = await fetch("/api/get_model_params");
                const data = await response.json();
                if (!data.model_params) return { hasDifferences: false, diffParams: {} };
                
                const modelParams = data.model_params;
                const diffParams = {};
                let hasDifferences = false;
                
                // Only check parameters that are defined in the model
                Object.entries(modelParams).forEach(([param, isDefined]) => {
                    if (isDefined) {
                        const differs = this.settings[param] !== this.modelDefaultValues?.[param];
                        diffParams[param] = differs;
                        if (differs) hasDifferences = true;
                    }
                });
                
                return { hasDifferences, diffParams };
            } catch (error) {
                console.error("Error checking model parameters:", error);
                return { hasDifferences: false, diffParams: {} };
            }
        };

        // Function to check if any sampling parameter differs from app defaults
        const checkSamplingParamsDiffer = async () => {
            try {
                const response = await fetch("/api/get_default_settings");
                const data = await response.json();
                if (!data.session_settings) return false;
                
                const defaults = data.session_settings;
                const samplingParams = [
                    "temperature", "top_k", "top_p", "min_p", "tfs",
                    "mirostat", "mirostat_tau", "mirostat_eta", "typical",
                    "repp", "repr", "quad_sampling", "temperature_last", "skew"
                ];
                
                const diffParams = {};
                let hasDifferences = false;
                
                samplingParams.forEach(param => {
                    const differs = this.settings[param] !== defaults[param];
                    diffParams[param] = differs;
                    if (differs) hasDifferences = true;
                });
                
                return { hasDifferences, diffParams };
            } catch (error) {
                console.error("Error checking sampling parameters:", error);
                return { hasDifferences: false, diffParams: {} };
            }
        };

        // Add hover event listeners for both buttons
        const setupButtonHover = (button, checkFn) => {
            button.element.addEventListener("mouseover", async () => {
                const { hasDifferences, diffParams } = await checkFn();
                if (hasDifferences) {
                    button.element.classList.add("enabled");
                    toggleHighlights(diffParams, true);
                }
            });

            button.element.addEventListener("mouseout", () => {
                button.element.classList.remove("enabled");
                // Remove all highlights unconditionally
                Object.keys(this.paramLabels).forEach(param => {
                    const label = this.paramLabels[param];
                    if (label) {
                        label.classList.remove("highlight-label");
                    }
                });
            });
        };

        setupButtonHover(this.sss_i_applyModelParams, checkModelParamsDiffer);
        setupButtonHover(this.sss_i_resetToAppDefaults, checkSamplingParamsDiffer);

        // Function to update App defaults button state
        this.updateAppDefaultsButton = async () => {
            const { hasDifferences } = await checkSamplingParamsDiffer();
            this.sss_i_resetToAppDefaults.setEnabled(hasDifferences);
        };

        // Function to update Model defaults button state
        this.updateModelDefaultsButton = async () => {
            const { hasDifferences } = await checkModelParamsDiffer();
            this.sss_i_applyModelParams.setEnabled(hasDifferences);
        };

        // Set up sampling parameter controls
        this.samplingControls = [
            this.sss_i_temperature, this.sss_i_topK, this.sss_i_topP,
            this.sss_i_minP, this.sss_i_quadSampling, this.sss_i_tfs,
            this.sss_i_typical, this.sss_i_skew, this.sss_i_repPenalty,
            this.sss_i_repRange, this.sss_i_mirostat, this.sss_i_mirostat_tau,
            this.sss_i_mirostat_eta, this.sss_i_temperature_last
        ];

        // Helper function to update button states
        const updateButtons = () => {
            this.updateAppDefaultsButton();
            this.updateModelDefaultsButton();
        };

        // Add event listeners to controls
        this.samplingControls.forEach(control => {
            if (control?.element) {
                ['input[type="range"]', 'input[type="text"]', 'input[type="checkbox"]'].forEach(selector => {
                    const element = control.element.querySelector(selector);
                    if (element) {
                        const event = selector.includes('checkbox') ? 'change' : selector.includes('text') ? 'blur' : 'input';
                        element.addEventListener(event, updateButtons);
                    }
                });
            }
        });

        // Initial button states
        this.updateAppDefaultsButton();
        this.updateModelDefaultsButton();

        // Add separator before buttons
        let separator = document.createElement("div");
        separator.style.height = "20px";
        this.sss_sampling.inner.appendChild(separator);

        this.sss_sampling.inner.appendChild(buttonsContainer);

        // Initialize model defaults
        const initModelDefaults = async () => {
            try {
                const paramsResponse = await fetch("/api/get_model_params");
                const paramsData = await paramsResponse.json();
                
                if (paramsData.has_params && paramsData.model_params) {
                    const modelResponse = await fetch("/api/apply_model_params", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                    });
                    const modelData = await modelResponse.json();
                    
                    if (modelData.settings) {
                        this.modelDefaultValues = { ...modelData.settings };
                        this.updateModelDefaultsButton();
                    }
                }
            } catch (error) {
                console.error("Error initializing model defaults:", error);
            }
        };

        initModelDefaults();

        // Stop conditions

        this.sss_i_stopNewline = new controls.CheckboxLabel("sss-item-right clickable", "Stop on newline", this.settings, "stop_newline", () => { this.updateView(true); });
        this.sss_stopConditions.inner.appendChild(this.sss_i_stopNewline.element);

        // Banned strings

        this.sss_i_bannedStrings = new controls.LargeTextbox("sss-item-big-textbox", "Banned strings...", this.settings, "banned_strings", null, () => { this.updateView(true); }, true);
        this.sss_bannedStrings.inner.appendChild(this.sss_i_bannedStrings.element);

        // .

        this.updateView();
    }

    removeRole(role) {
        for (let i = role; i < 7; i++)
            this.settings.roles[i] = this.settings.roles[i + 1];
        this.settings.roles[7] = "";
        this.updateView();
    }

    addRole() {
        let numroles = 1;
        for (let i = 1; i < 8; i++) if (this.settings.roles[i].trim() != "") numroles = i + 1;
        if (numroles < 8)
        {
            this.settings.roles[numroles] = "Assistant " + numroles;
            this.updateView();
        }
    }

    updateView(send = false) {
        // Roles list

        let roles = [];
        let numroles = 1;
        for (let i = 0; i < 8; i++) roles.push(this.settings.roles[i].trim());
        if (roles[0] == "") roles[0] = "User";
        for (let i = 1; i < 8; i++) if (roles[i] != "" && i + 1 > numroles) numroles = i + 1;
        for (let i = 2; i < numroles; i++) if (roles[i] == "") roles[i] = "Assistant " + i;
        for (let i = 0; i < 8; i++) this.settings.roles[i] = roles[i];

        for (let i = 0; i < 8; i++) {
            this.sss_i_roles[i].refresh();
            this.sss_i_roles[i].setVisible(i < numroles);
        }

        this.sss_i_addRole.setVisible(numroles < 8);

        // Settings visibility

        let hasRoles = this.settings.prompt_format == "Chat-RP";
        this.sss_roles.setVisible(hasRoles);
        this.sss_stopConditions.setVisible(hasRoles);

        let canMinTokens = this.settings.prompt_format != "Chat-RP";
        this.sss_i_minTokens.setVisible(canMinTokens);

        let opt = globals.g.promptFormatsOptions[this.settings.prompt_format];
        let hasSysPrompt = opt.supports_system_prompt;
        this.sss_systemPrompt.setVisible(hasSysPrompt);

        let mirostat = this.settings.mirostat;
        this.sss_i_mirostat_tau.setVisible(mirostat);
        this.sss_i_mirostat_eta.setVisible(mirostat);

        // Send

        if (send) this.send();
        //console.log(this.settings);
    }

    async resetToAppDefaults() {
        try {
            const response = await fetch("/api/reset_to_app_defaults", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });
            const data = await response.json();
            
            if (data.settings) {
                Object.assign(this.settings, data.settings);
                
                // Refresh controls and update UI
                this.samplingControls.forEach(control => control?.refresh?.());
                this.updateView(true);
                await Promise.all([
                    this.updateAppDefaultsButton(),
                    this.updateModelDefaultsButton()
                ]);
            }
        } catch (error) {
            console.error("Error resetting to app defaults:", error);
        }
    }

    async applyModelDefaults() {
        try {
            const paramsResponse = await fetch("/api/get_model_params");
            const paramsData = await paramsResponse.json();
            
            if (paramsData.has_params) {
                const modelResponse = await fetch("/api/apply_model_params", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                const modelData = await modelResponse.json();
                
                if (modelData.settings) {
                    // Update both settings and model defaults
                    this.modelDefaultValues = { ...modelData.settings };
                    Object.assign(this.settings, modelData.settings);
                    
                    // Refresh controls and update UI
                    this.samplingControls.forEach(control => control?.refresh?.());
                    this.updateView(true);
                    await Promise.all([
                        this.updateAppDefaultsButton(),
                        this.updateModelDefaultsButton()
                    ]);
                }
            }
        } catch (error) {
            console.error("Error applying model defaults:", error);
        }
    }

    async send(post = null) {
        try {
            const packet = { settings: this.settings };
            const endpoint = !this.parent.sessionID || this.parent.sessionID === "new"
                ? "/api/new_session"
                : "/api/update_settings";

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(packet)
            });
            const data = await response.json();

            if (endpoint === "/api/new_session") {
                this.parent.parent.lastSessionUUID = data.session.session_uuid;
                this.parent.parent.onEnter();
            }

            if (post) post();
        } catch (error) {
            console.error("Error sending settings:", error);
        }
    }
}
