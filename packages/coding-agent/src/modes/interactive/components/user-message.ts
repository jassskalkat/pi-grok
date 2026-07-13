import { Container, Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import { getMarkdownTheme, theme } from "../theme/theme.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";
const BAR = "\u258c";

/**
 * Grok-style user message with left accent bar
 */
export class UserMessageComponent extends Container {
	private text: string;
	private markdownTheme: MarkdownTheme;
	private outputPad: number;

	constructor(text: string, markdownTheme: MarkdownTheme = getMarkdownTheme(), outputPad = 1) {
		super();
		this.text = text;
		this.markdownTheme = markdownTheme;
		this.outputPad = outputPad;
		this.rebuild();
	}

	setOutputPad(padding: number): void {
		this.outputPad = padding;
		this.rebuild();
	}

	private rebuild(): void {
		this.clear();
		// Grok-style: no background box, accent bar added in render()
		this.addChild(
			new Markdown(
				this.text,
				this.outputPad,
				0,
				this.markdownTheme,
				{
					color: (content: string) => theme.fg("userMessageText", content),
				},
				{ preserveOrderedListMarkers: true, preserveBackslashEscapes: true },
			),
		);
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length === 0) {
			return lines;
		}

		// Grok-style: prepend accent bar to every non-empty line
		const bar = theme.fg("accent", BAR) + " ";
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].trim().length > 0) {
				lines[i] = bar + lines[i];
			}
		}

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = lines[lines.length - 1] + OSC133_ZONE_END + OSC133_ZONE_FINAL;
		return lines;
	}
}
