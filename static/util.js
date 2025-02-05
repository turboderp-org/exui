export function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export function getNextKey(map, key) {
    let found = false;
    for (let k of map.keys()) {
        if (found) return k;
        if (k === key) found = true;
    }
    return null;
}

export function newDiv(id, className, html = null) {
    let div = document.createElement("div");
    div.id = id;
    div.className = className;
    if (html) div.innerHTML = html;
    return div;
}

export function newHFlex(extra_style = null) {
    return newDiv(null, "hflex" + (extra_style ? " " + extra_style : ""));
}

export function newVFlex(extra_style = null) {
    return newDiv(null, "vflex" + (extra_style ? " " + extra_style : ""));
}

export function newIcon(icon_id, size = 24) {

    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttributeNS(null, "width", size);
    svg.setAttributeNS(null, "height", size);
    svg.style.top = "8px";

    var use = document.createElementNS(ns, "use");
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', "#" + icon_id);
    svg.appendChild(use);

    return svg;
}

// Editable textarea

let textbox_initial = "";

function getTextWithLineBreaks(node) {
    let text = "";
    for (let child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            text += child.textContent.trim();
        } else if (child.tagName === "BR") {
            text += "\n";
        }
    }
    return text;
}

function addTextboxEvents(ctb, validateFunc, onValueChange, multiline = false, onExit = null)
{
    ctb.addEventListener("keydown", function(event) {
        if (event.key === "Escape") {
            this.value = textbox_initial;
            this.blur();
            event.preventDefault();
        }
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            this.blur();
        }
        if (event.key == "Enter" && !multiline)
        {
            this.blur();
            event.preventDefault();
        }
    });
}

export function makeEditable(div, validateFunc, onValueChange, onExit, in_text = null, multiline = false) {

    let dstyle = window.getComputedStyle(div);

    let text = in_text ? in_text : getTextWithLineBreaks(div);

    let rect = div.getBoundingClientRect();
    let computedStyle = window.getComputedStyle(div);

    let textarea = document.createElement("textarea");

    textbox_initial = text;

    addTextboxEvents(textarea, validateFunc, onValueChange, multiline, onExit);

    textarea.style.top = `${rect.top}px`;
    textarea.style.left = `${rect.left}px`;
    textarea.style.width = `${rect.width}px`;
    textarea.style.height = `${rect.height}px`;
    textarea.style.border = "0px";
    textarea.style.outline = computedStyle.outline;
    textarea.style.padding = computedStyle.padding;
    textarea.style.margin = computedStyle.margin;
    textarea.style.resize = computedStyle.resize;
    textarea.style.fontFamily = computedStyle.fontFamily;
    textarea.style.fontSize = computedStyle.fontSize;
    textarea.style.fontWeight = computedStyle.fontWeight;
    textarea.style.color = computedStyle.color;
    textarea.style.backgroundColor = computedStyle.backgroundColor;
    textarea.style.borderRadius = computedStyle.borderRadius;
    textarea.style.boxSizing = 'border-box';
    textarea.style.verticalAlign = computedStyle.verticalAlign;
    textarea.style.lineHeight = computedStyle.lineHeight;
    textarea.style.textAlign = computedStyle.textAlign;
    textarea.style.padding = computedStyle.padding;
    textarea.style.minHeight = `${rect.height}px`;
    textarea.rows = 1;
    if (!multiline) textarea.spellcheck = false;

    textarea.value = text;

    textarea.addEventListener('blur', function () {
        let vc = false;
        if (!validateFunc || validateFunc(textarea.value)) {
            if (textarea.value != textbox_initial) {
                div.innerHTML = textarea.value;
                if (onValueChange) {
                    onValueChange(div.id, textarea.value);
                    vc = true;
                }
            }
        }
        div.style.display = "";
        textarea.parentNode.removeChild(textarea);
        if (onExit && !vc) onExit(this.id);
    });

    div.parentNode.insertBefore(textarea, div.nextSibling);
    div.style.display = "none";

    textarea.focus();
}

/*

function saveFocus() {

    let focus = {};
    focus.focusedDiv = document.activeElement;
    focus.focusedID = null;
    focus.selectionStart = -1;
    focus.selectionEnd = -1;

    if (focus.focusedDiv) {
        focus.focusedID = focus.focusedDiv.id;
        if (focus.focusedDiv.tagName === 'INPUT' && focus.focusedDiv.type === 'text') {
            focus.selectionStart = focus.focusedDiv.selectionStart;
            focus.selectionEnd = focus.focusedDiv.selectionEnd;
        }
    }

//    console.log(focus);
    return focus;
}

function restoreFocus(focus) {

//    console.log("restore:", focus);

    if (focus.focusedID && focus.focusedID != "")
    {
        let focusedElement = document.getElementById(focus.focusedID);
        if (focusedElement) {
            focusedElement.focus();
            if (focus.selectionStart != -1)
            {
                focusedElement.selectionStart = focus.selectionStart;
                focusedElement.selectionEnd = focus.selectionEnd;
            }
        }
    }
}
*/

export function escape(str) {
    return str
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\v/g, '\\v')
//        .replace(/\b/g, '\\b')
        .replace(/\f/g, '\\f')
//        .replace(/"/g, '\\"')
//        .replace(/'/g, "\\'");
}

export function saveStringDialog(textString, filename) {
    const textBlob = new Blob([textString], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    const downloadLink = document.createElement("a");
    downloadLink.download = filename ;
    downloadLink.href = textUrl;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(textUrl);
}

export function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}
