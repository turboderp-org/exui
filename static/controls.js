import * as util from "./util.js";

let control_serial = 0;

export class Label {
    constructor(className, data, data_id) {
        this.data = data;
        this.data_id = data_id;
        this.element = util.newDiv(null, className);
        this.element.innerHTML = "|";
    }

    refresh() {
        this.element.innerHTML = this.data[this.data_id];
    }
}

export class LabelTextbox {
    constructor(classNameLabel, textLabel, className, placeholder, data, data_id, validateFunc, updateFunc, cb_auto_id = null, multiline = false) {
        this.data = data;
        this.data_id = data_id;
        this.element = util.newVFlex("vflex_line");

        if (textLabel) {
            this.label = util.newDiv(null, classNameLabel);
            this.label.innerHTML = textLabel;
        }

        if (!multiline) {
            this.tb = document.createElement("input");
            this.tb.className = className;
            this.tb.type = "text";
        } else {
            this.tb = document.createElement("textarea");
            this.tb.className = className;
            this.tb.rows = 5;
        }

        if (placeholder) this.tb.placeholder = placeholder;
        this.tb.spellcheck = false;
        this.tb.value = this.data[this.data_id] ? this.data[this.data_id] : "";
        
        // Create hidden span to measure text width
        this.measureSpan = document.createElement("span");
        this.measureSpan.style.visibility = "hidden";
        this.measureSpan.style.position = "absolute";
        this.measureSpan.style.whiteSpace = "pre";
        // Copy font styles from input to span for accurate measurement
        this.measureSpan.style.font = window.getComputedStyle(this.tb).font;
        document.body.appendChild(this.measureSpan);

        // Function to update input width based on content
        const updateWidth = () => {
            this.measureSpan.textContent = this.tb.value || this.tb.placeholder;
            const width = this.measureSpan.offsetWidth;
            this.tb.style.width = (width + 20) + 'px'; // Add padding
        };

        // Update width on input
        this.tb.addEventListener("input", updateWidth);
        
        // Initial width update
        updateWidth();

        this.tb.addEventListener("focus", () => {
            //console.log(this.data[this.data_id]);
            this.textbox_initial = this.tb.value;
        });

        this.tb.addEventListener("focusout", () => {
            if (this.textbox_initial != this.tb.value) {
                if (!validateFunc || validateFunc(this.tb.value)) {
                    this.data[this.data_id] = this.interpret(this.tb.value);
                    if (updateFunc) updateFunc();
                } else {
                    this.tb.value = this.textbox_initial;
                }
            }
        });

        this.tb.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                this.tb.value = this.textbox_initial;
                this.tb.blur();
                event.preventDefault();
            }
            if (event.key === "Enter" && !event.shiftKey) {
                this.tb.blur();
            }
        });

        if (textLabel) this.element.appendChild(this.label);
        this.element.appendChild(this.tb);

        this.cb_auto_id = cb_auto_id;
        if (this.cb_auto_id) {
            this.chkb = document.createElement("input");
            this.chkb.type = "checkbox";
            this.chkb.id = "checkbox_" + control_serial + "_" + cb_auto_id;
            control_serial++;
            this.chkb.className = "checkbox";
            this.element.appendChild(this.chkb);
            this.chkb_label = document.createElement("label");
            this.chkb_label.htmlFor = this.chkb.id;
            this.chkb_label.className = "checkbox-label";
            this.chkb_label.innerHTML = "Auto";
            this.element.appendChild(this.chkb_label);

            this.chkb.addEventListener("change", () => {
                this.data[this.cb_auto_id] = this.chkb.checked;
                if (updateFunc) updateFunc();
            });
        }
    }

    interpret(value) {
        return value;
    }

    refresh() {
        let v = this.data[this.data_id] ? this.data[this.data_id] : null;
        this.tb.value = v;
        // Update width when refreshing
        this.measureSpan.textContent = this.tb.value || this.tb.placeholder;
        const width = this.measureSpan.offsetWidth;
        this.tb.style.width = (width + 20) + 'px';
        this.refreshCB();
    }

    refreshCB() {
        if (this.cb_auto_id) {
        this.chkb.checked = this.data[this.cb_auto_id];
        if (this.chkb.checked)
            this.tb.classList.add("hidden");
        else
            this.tb.classList.remove("hidden");
        }
    }

    setVisible(visible) {
        if (visible)
            this.element.classList.remove("hidden");
        else
            this.element.classList.add("hidden");
    }
}

export class LargeTextbox extends LabelTextbox {
    constructor(className, placeholder, data, data_id, validateFunc, updateFunc, nowrap = false) {
        super(null, null, className, placeholder, data, data_id, validateFunc, updateFunc, null, true);
        if (nowrap) this.tb.wrap = "off";
    }
}

export class LabelTextboxButton extends LabelTextbox {
    constructor(classNameLabel, textLabel, className, placeholder, data, data_id, validateFunc, updateFunc, cb_auto_id = null, buttonText, buttonFunc) {
        super(classNameLabel, textLabel, className, placeholder, data, data_id, validateFunc, updateFunc, cb_auto_id);

        this.buttonFunc = buttonFunc;

        this.button = document.createElement("span");
        this.button.className = "linkbutton enabled";
        this.button.innerHTML = buttonText;
        this.element.appendChild(this.button);

        this.button.addEventListener("click", () => {
            if (this.buttonFunc) this.buttonFunc();
        });
    }
}

export class CheckboxTextboxButton {
    constructor(nameid, classNameCheckbox, textCheckbox, classNameTextbox, placeholder, data, arrayName, index, data_id_text, data_id_cb, validateFunc, updateFunc, buttonText, buttonFunc) {

        this.data = data;
        this.data_id_text = data_id_text;
        this.data_id_cb = data_id_cb;
        this.arrayName = arrayName;
        this.index = index;
        this.element = util.newVFlex("vflex_line");

        // Checkbox

        this.cb = util.newDiv(null, classNameCheckbox);

        this.chkb = document.createElement("input");
        this.chkb.type = "checkbox";
        this.chkb.id = "checkbox_" + control_serial + "_" + nameid;
        control_serial++;
        this.chkb.className = "checkbox";

        this.chkb_label = document.createElement("label");
        this.chkb_label.htmlFor = this.chkb.id;
        this.chkb_label.className = "checkbox-label";
        this.chkb_label.innerHTML = textCheckbox;

        this.cb.appendChild(this.chkb);
        this.cb.appendChild(this.chkb_label);
        this.element.appendChild(this.cb);

        this.chkb.addEventListener("change", () => {
            this.data[this.arrayName][this.index][this.data_id_cb] = this.chkb.checked;
            if (updateFunc) updateFunc();
        });

        // Textbox

        this.tb = document.createElement("input");
        this.tb.className = classNameTextbox;
        this.tb.type = "text";

        this.tb.addEventListener("focus", () => {
            this.textbox_initial = this.tb.value;
        });

        this.tb.addEventListener("focusout", () => {
            if (this.textbox_initial != this.tb.value) {
                if (!validateFunc || validateFunc(this.tb.value)) {
                    this.data[this.arrayName][this.index][this.data_id_text] = this.interpret(this.tb.value);
                    if (updateFunc) updateFunc();
                } else {
                    this.tb.value = this.textbox_initial;
                }
            }
        });

        this.tb.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                this.tb.value = this.textbox_initial;
                this.tb.blur();
                event.preventDefault();
            }
            if (event.key === "Enter" && !event.shiftKey) {
                this.tb.blur();
            }
        });

        this.element.appendChild(this.tb);

        // Button

        this.buttonFunc = buttonFunc;

        this.button = document.createElement("span");
        this.button.className = "linkbutton enabled";
        this.button.innerHTML = buttonText;

        this.button.addEventListener("click", () => {
            if (this.buttonFunc) this.buttonFunc();
        });

        this.element.appendChild(this.button);

        this.refresh();
    }

    interpret(value) {
        return value;
    }

    refresh() {
        //console.log(this.data);
        this.chkb.checked = this.data[this.arrayName][this.index][this.data_id_cb];

        let v = this.data[this.arrayName][this.index][this.data_id_text];
        v = v ? v : null;
        this.tb.value = v;
    }
}


export class LabelNumbox extends LabelTextbox {
    constructor(classNameLabel, textLabel, className, placeholder, data, data_id, min, max, decimals, updateFunc, cb_auto_id = null) {
        super(classNameLabel, textLabel, className, placeholder, data, data_id, null, updateFunc, cb_auto_id);
        this.min = min;
        this.max = max;
        this.min = min;
        this.max = max;
        this.decimals = decimals;

        // Override dynamic width calculation for numeric inputs
        this.measureSpan = null; // Remove the span used for width measurement
        this.tb.style.width = null; // Remove any inline width style
    }

    interpret(value) {
        let num = parseFloat(value);
        if (isNaN(num)) num = 0;
        if (num < this.min) num = this.min;
        if (num > this.max) num = this.max;
        num = parseFloat(num.toFixed(this.decimals));
        return num;
    }

    refresh() {
        this.tb.value = this.data[this.data_id].toFixed(this.decimals);
        this.refreshCB();
        // Override parent's refresh method to prevent dynamic width calculation
        if (this.measureSpan) {
            document.body.removeChild(this.measureSpan);
            this.measureSpan = null;
        }
    }
}

export class LabelText {
    constructor(classNameLabel, textLabel, className, data, data_id) {
        this.data = data;
        this.data_id = data_id;
        this.element = util.newVFlex("vflex_line");

        this.label = util.newDiv(null, classNameLabel);
        this.label.innerHTML = textLabel;

        this.text = util.newDiv(null, className);

        this.element.appendChild(this.label);
        this.element.appendChild(this.text);
    }

    refresh() {
        this.text.innerHTML = this.data[this.data_id];
    }
}

export class LabelCombobox {
    constructor(classNameLabel, textLabel, className, options, data, data_id, updateFunc) {
        this.data = data;
        this.data_id = data_id;
        this.element = util.newVFlex("vflex_line");

        this.label = util.newDiv(null, classNameLabel);
        this.label.innerHTML = textLabel;

        this.cb = document.createElement("select");
        this.cb.className = className;
        for (let i = 0; i < options.length; i++) this.cb.add(new Option(options[i], options[i]));

        this.cb.addEventListener("change", (event) => {
            this.data[this.data_id] = this.cb.value;
            if (updateFunc) updateFunc();
        } );

        this.element.appendChild(this.label);
        this.element.appendChild(this.cb);

        this.refresh();
    }

    refresh() {
        this.cb.value = this.data[this.data_id];
    }
}

export class LabelCheckbox {
    constructor(classNameLabel, textLabel, className, text, data, data_id, updateFunc) {
        this.data = data;
        this.data_id = data_id;
        this.element = util.newVFlex("vflex_line");

        if (textLabel) {
            this.label = util.newDiv(null, classNameLabel);
            this.label.innerHTML = textLabel;
            this.element.appendChild(this.label);
        }

        this.chkb = document.createElement("input");
        this.chkb.type = "checkbox";
        this.chkb.id = "checkbox_" + control_serial + "_" + data_id;
        control_serial++;
        this.chkb.className = "checkbox";
        this.element.appendChild(this.chkb);
        this.chkb_label = document.createElement("label");
        this.chkb_label.htmlFor = this.chkb.id;
        this.chkb_label.className = className;
        this.chkb_label.innerHTML = text;
        this.element.appendChild(this.chkb_label);

        this.chkb.addEventListener("change", () => {
            this.data[this.data_id] = this.chkb.checked;
            if (updateFunc) updateFunc();
        });

        this.refresh();
    }

    refresh() {
        this.chkb.checked = this.data[this.data_id];
    }

    setVisible(visible) {
        if (visible)
            this.element.classList.remove("hidden");
        else
            this.element.classList.add("hidden");
    }
}

export class Button {
    constructor(text, clickFunc, extra_style = null, extra_text = null) {
        if (!extra_text) {
            this.element = util.newDiv(null, "textbutton", text);
        } else {
            this.element = util.newDiv(null, "textbutton");
            let div1 = util.newDiv(null, null, text);
            let div2 = util.newDiv(null, "sub", extra_text);
            this.element.appendChild(div1);
            this.element.appendChild(div2);
        }

        if (extra_style) this.element.classList.add(extra_style);
        this.enabled = true;
        this.clickFunc = clickFunc;
        this.hidden = false;

        this.element.addEventListener("mousedown", (event) => {
            event.preventDefault();
        });

        this.element.addEventListener("click", (event) => {
            if (!this.enabled) return;
            if (this.clickFunc) {
                event.preventDefault();
                this.clickFunc();
            }
        });
    }

    setEnabled(enabled, delay = 0) {
        this.enabled = enabled;
        this.refresh(delay);
    }

    setHidden(hidden) {
        this.hidden = hidden;
        this.refresh();
    }

    setVisible(visible) {
        this.setHidden(!visible);
    }

    refresh(delay = 0) {
        if (this.enabled) {
            if (this.disablerTimeout) {
                clearTimeout(this.disablerTimeout);
                this.disablerTimeout = null;
            }
            this.element.classList.add("enabled");
            this.element.classList.remove("disabled");
        } else {
            if (!this.disablerTimeout) {
                this.disablerTimeout = setTimeout(() => {
                    this.element.classList.remove("enabled");
                    this.element.classList.add("disabled");
                    this.disabledTimeout = null;
                }, delay);
            }
        }
        if (this.hidden) {
            this.element.classList.add("hidden");
        } else {
            this.element.classList.remove("hidden");
        }
    }
}

export class LinkButton {
    constructor(text, confirmText, clickFunc, extraStyle = null) {
        this.text = text;
        this.confirmText = confirmText;
        this.clickFunc = clickFunc;

        this.element = util.newDiv(null, null);
        this.inner = document.createElement("span");
        this.inner.classList.add("linkbutton");
        this.inner.classList.add("no-select");
        if (extraStyle) this.inner.classList.add(extraStyle);
        this.element.appendChild(this.inner);

        this.enabled = true;
        this.refresh();

        this.inner.innerHTML = this.text;

        this.inner.addEventListener("click", () => {

            if (!this.enabled) return;
            if (!this.confirmText) {
                if (this.clickFunc) this.clickFunc();
            } else {
                if (this.inner.classList.contains("danger")) {
                    this.inner.innerHTML = this.text;
                    this.inner.classList.remove("danger");
                    if (this.clickFunc) this.clickFunc();
                    clearTimeout(this.timeoutID);
                } else {
                    this.inner.innerHTML = this.confirmText;
                    this.inner.classList.add("danger");
                    this.timeoutID = setTimeout(() => {
                        this.inner.classList.remove("danger");
                        this.inner.innerHTML = this.text;
                    }, 2000);
                }
            }
        });
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.refresh();
    }

    refresh() {
        if (this.enabled) {
            this.inner.classList.add("enabled");
            this.inner.classList.remove("disabled");
        } else {
            this.inner.classList.remove("enabled");
            this.inner.classList.add("disabled");
        }
    }

    setVisible(visible) {
        if (visible)
            this.element.classList.remove("hidden");
        else
            this.element.classList.add("hidden");
    }

}

export class EditableLabel {
    constructor(value, allow_empty = false, editFunc = null) {
        this.value = value;
        this.element = util.newDiv(null, null);
        this.inner = document.createElement("p");
        this.inner.innerHTML = value;
        this.element.appendChild(this.inner);
        this.setEditable(false);

        this.inner.addEventListener("click", () => {
            if (this.inner.classList.contains("editable-label"))
                this.beginEdit();
        });

        this.allow_empty = allow_empty;
        this.editFunc = editFunc;
    }

    setEditable(editable) {
        if (editable) {
            this.inner.classList.add("editable-label");
        } else {
            this.inner.classList.remove("editable-label");
        }
    }

    beginEdit() {
        util.makeEditable(this.inner, (value) => {
            if (!this.allow_empty && value.trim() == "") return false;
            return true;
        }, (id, value) => {
            if (this.editFunc)
                this.editFunc(value);
        });
    }
}

export class CollapsibleSection {
    constructor(className, heading) {

        this.element = util.newDiv(null, "block");

        let div_head = util.newDiv(null, (className ? className + " " : "") + "block-header no-select");
        div_head.innerHTML = "<span class='arrow'>⯆</span>" + heading;
        this.element.appendChild(div_head);

        div_head.addEventListener('click', function() {
            let c = this.nextElementSibling;
            let a = this.children[0];
            if (c.classList.contains("shown")) {
                a.innerHTML = "⯈";
                c.classList.remove("shown");
            } else {
                a.innerHTML = "⯆";
                c.classList.add("shown");
            }
        });

        this.inner = util.newDiv(null, (className ? className + " " : "") + "block-contents shown");
        this.element.appendChild(this.inner);
    }

    setVisible(visible) {
        if (visible)
            this.element.classList.remove("hidden");
        else
            this.element.classList.add("hidden");
    }
}

export class SettingsSlider {
    constructor(classNameLabel, textLabel, classNameSlider, classNameTextbox, decimals, min, max, alt_display, data, data_id, updateFunc = null) {
        this.data = data;
        this.data_id = data_id;
        this.decimals = decimals;
        this.min = min;
        this.max = max;
        this.alt_display = alt_display;
        this.updateFunc = updateFunc;

        this.element = util.newDiv(null, "item-split");
        let label = util.newDiv(null, classNameLabel, textLabel);

        this.exp = Math.pow(10, decimals);

        this.slider = document.createElement('input');
        this.slider.type= "range";
        this.slider.className = classNameSlider;
        this.slider.min = this.exp * this.min;
        this.slider.max = this.exp * this.max;
        this.slider.value = this.slider.min;

        this.textbox = document.createElement('input');
        this.textbox.type= "text";
        this.textbox.className = classNameTextbox;
        this.textbox.rows = 1;
        this.textbox.spellcheck = false;

        this.slider.addEventListener("input", (event) => {
            this.sliderInput();
        });

        this.slider.addEventListener("change", (event) => {
            if (updateFunc) updateFunc();
        });

        this.textbox.addEventListener("focus", (event) => {
            this.originalValue = this.textbox.value;
        });

        this.textbox.addEventListener("blur", (event) => {
            let nvalue = parseFloat(this.textbox.value);
            if (isNaN(nvalue)) {
                this.textbox.value = this.originalValue;
                return;
            }
            if (nvalue < this.min) nvalue = this.min;
            if (nvalue > this.max) nvalue = this.max;
            nvalue *= this.exp;
            this.slider.value = "" + nvalue;
            this.sliderInput();
            if (updateFunc) updateFunc();
        });

        this.refresh();

        this.element.appendChild(label);
        this.element.appendChild(this.slider);
        this.element.appendChild(this.textbox);
    }

    sliderInput() {
        let v = parseFloat(this.slider.value) / this.exp;
        this.data[this.data_id] = v;
        let t = v.toFixed(this.decimals);
        let st = "";
        if (this.alt_display) {
            if (Object.keys(this.alt_display).includes(t)) st = this.alt_display[t];
        }
        if (st != "") { this.textbox.value = st; this.textbox.classList.add("special"); }
        else { this.textbox.value = t; this.textbox.classList.remove("special"); }
    }

    refresh() {
        let v = this.data[this.data_id];
        v *= this.exp;
        this.slider.value = "" + v;
        this.sliderInput();
    }

    setVisible(visible) {
        if (visible)
            this.element.classList.remove("hidden");
        else
            this.element.classList.add("hidden");
    }
}

export class CheckboxLabel extends LabelCheckbox {
    constructor(className, text, data, data_id, updateFunc) {
        super(null, null, className, text, data, data_id, updateFunc);
    }
}
