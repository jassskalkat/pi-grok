import { Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.js";
const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";
const BAR = "\u258c";
const THIN_SP = "\u2009";

function decorateWithBar(lines, barColor) {
    if (!lines || lines.length === 0) return lines;
    const bar = barColor + THIN_SP;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().length > 0) {
            lines[i] = bar + lines[i];
        }
    }
    return lines;
}

export class AssistantMessageComponent extends Container {
    contentContainer;
    hideThinkingBlock;
    markdownTheme;
    hiddenThinkingLabel;
    outputPad;
    lastMessage;
    hasToolCalls = false;
    constructor(message, hideThinkingBlock = false, markdownTheme = getMarkdownTheme(), hiddenThinkingLabel = "Thinking...", outputPad = 1) {
        super();
        this.hideThinkingBlock = hideThinkingBlock;
        this.markdownTheme = markdownTheme;
        this.hiddenThinkingLabel = hiddenThinkingLabel;
        this.outputPad = outputPad;
        this.contentContainer = new Container();
        this.addChild(this.contentContainer);
        if (message) this.updateContent(message);
    }
    invalidate() {
        super.invalidate();
        if (this.lastMessage) this.updateContent(this.lastMessage);
    }
    setHideThinkingBlock(hide) { this.hideThinkingBlock = hide; if (this.lastMessage) this.updateContent(this.lastMessage); }
    setHiddenThinkingLabel(label) { this.hiddenThinkingLabel = label; if (this.lastMessage) this.updateContent(this.lastMessage); }
    setOutputPad(padding) { this.outputPad = padding; if (this.lastMessage) this.updateContent(this.lastMessage); }

    /** Render a content block with Grok-style left accent adornments */
    _renderBlock(type, text, paddingX) {
        const md = new Markdown(text.trim(), paddingX, 0, this.markdownTheme);
        const lines = md.render(10000);
        if (type === "thinking") {
            decorateWithBar(lines, theme.fg("thinkingText", BAR));
        } else if (type === "text") {
            // Clean text without bar
        }
        // Reconstruct as Markdown is not feasible; instead wrap in a custom approach
        return md;
    }

    render(width) {
        const lines = super.render(width);
        if (this.hasToolCalls || lines.length === 0) return lines;
        lines[0] = OSC133_ZONE_START + lines[0];
        lines[lines.length - 1] = lines[lines.length - 1] + OSC133_ZONE_END + OSC133_ZONE_FINAL;
        return lines;
    }

    /** Wrap a Markdown component's render output with a thinking accent bar */
    _makeThinkingBlock(text, paddingX) {
        const md = new Markdown(text.trim(), paddingX, 0, this.markdownTheme, {
            color: (t) => theme.fg("thinkingText", t),
            italic: true,
        });
        const origRender = md.render.bind(md);
        md.render = (w) => {
            const lines = origRender(w);
            if (lines.length > 0) {
                decorateWithBar(lines, theme.fg("thinkingText", BAR));
            }
            return lines;
        };
        return md;
    }

    updateContent(message) {
        this.lastMessage = message;
        this.contentContainer.clear();
        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));
        if (hasVisibleContent) this.contentContainer.addChild(new Spacer(1));
        for (let i = 0; i < message.content.length; i++) {
            const content = message.content[i];
            if (content.type === "text" && content.text.trim()) {
                this.contentContainer.addChild(new Markdown(content.text.trim(), this.outputPad, 0, this.markdownTheme));
            } else if (content.type === "thinking" && content.thinking.trim()) {
                const hasVisibleContentAfter = message.content.slice(i + 1).some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));
                if (this.hideThinkingBlock) {
                    this.contentContainer.addChild(new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0));
                    if (hasVisibleContentAfter) this.contentContainer.addChild(new Spacer(1));
                } else {
                    this.contentContainer.addChild(this._makeThinkingBlock(content.thinking, this.outputPad));
                    if (hasVisibleContentAfter) this.contentContainer.addChild(new Spacer(1));
                }
            }
        }
        const hasToolCalls = message.content.some((c) => c.type === "toolCall");
        this.hasToolCalls = hasToolCalls;
        if (message.stopReason === "length") {
            this.contentContainer.addChild(new Spacer(1));
            this.contentContainer.addChild(new Text(theme.fg("error", "Error: Model stopped because it reached the maximum output token limit. The response may be incomplete."), this.outputPad, 0));
        } else if (!hasToolCalls) {
            if (message.stopReason === "aborted") {
                const abortMessage = message.errorMessage && message.errorMessage !== "Request was aborted" ? message.errorMessage : "Operation aborted";
                this.contentContainer.addChild(new Spacer(1));
                this.contentContainer.addChild(new Text(theme.fg("error", abortMessage), this.outputPad, 0));
            } else if (message.stopReason === "error") {
                const errorMsg = message.errorMessage || "Unknown error";
                this.contentContainer.addChild(new Spacer(1));
                this.contentContainer.addChild(new Text(theme.fg("error", `Error: ${errorMsg}`), this.outputPad, 0));
            }
        }
    }
}
