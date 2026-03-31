export function extractJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		/* continue */
	}

	const fenced = raw.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
	if (fenced) {
		try {
			return JSON.parse(fenced[1]);
		} catch {
			/* continue */
		}
	}

	const s = raw.indexOf("{");
	const e = raw.lastIndexOf("}");
	if (s !== -1 && e !== -1) {
		try {
			return JSON.parse(raw.slice(s, e + 1));
		} catch {
			/* continue */
		}
	}

	throw new Error("AI returned unparseable response. Please try again.");
}
