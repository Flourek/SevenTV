import type { EmbedConfig } from "$lib/embeds";
import type { RequestHandler } from "@sveltejs/kit";

type EmbedModule = EmbedConfig | ((ctx: { params: Record<string, string> }) => EmbedConfig | Promise<EmbedConfig>);

// All per-route embed.ts files. Resolves "nearest embed wins" server-side.
const modules = import.meta.glob<{ default: EmbedModule }>("/src/routes/**/embed.ts", { eager: true });

function buildMatcher(routePath: string): { regex: RegExp | null; paramNames: string[] } {
	if (routePath === "") {
		return { regex: null, paramNames: [] };
	}

	const paramNames: string[] = [];
	const pattern = routePath
		.split("/")
		.filter(Boolean)
		.map((segment) => {
			if (segment.startsWith("[") && segment.endsWith("]")) {
				paramNames.push(segment.slice(1, -1));
				return "([^/]+)";
			}
			return segment;
		})
		.join("/");

	return { regex: new RegExp(`^/${pattern}$`), paramNames };
}

function resolveNearest(pathname: string) {
	let best: { mod: EmbedModule; params: Record<string, string>; depth: number } | null = null;
	const segments = pathname.split("/").filter(Boolean);

	for (const [file, module] of Object.entries(modules)) {
		const routePath = file
			.replace("/src/routes/", "")
			.replace(/embed\.ts$/, "")
			.replace(/\/$/, "");
		const { regex, paramNames } = buildMatcher(routePath);
		const depth = routePath.split("/").filter(Boolean).length;

		if (regex === null) {
			// Root default embed: fallback for every path, lowest priority.
			if (!best) {
				best = { mod: module.default, params: {}, depth: 0 };
			}
			continue;
		}

		// A route is an "ancestor" if it matches a prefix of the requested path.
		// Walk from the longest prefix down so the most specific match wins.
		for (let i = segments.length; i >= 1; i--) {
			const prefix = "/" + segments.slice(0, i).join("/");
			const match = prefix.match(regex);
			if (!match) continue;

			const params: Record<string, string> = {};
			paramNames.forEach((name, index) => (params[name] = match[index + 1]));

			if (!best || depth > best.depth) {
				best = { mod: module.default, params, depth };
			}
			break;
		}
	}

	return best;
}

function renderHtml(embed: EmbedConfig): string {
	const title = embed.title ?? "";
	const description = embed.description ?? "";
	const image = embed.image ?? "";
	const cardType = embed.cardType ?? "summary";

	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${title}</title>
	<meta property="og:title" content="${title}" />
	<meta property="og:description" content="${description}" />
	<meta property="og:image" content="${image}" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="${cardType}" />
	<meta name="twitter:title" content="${title}" />
	<meta name="twitter:description" content="${description}" />
	<meta name="twitter:image" content="${image}" />
</head>
<body></body>
</html>`;
}

export const GET: RequestHandler = async ({ params }) => {
	const pathname = "/" + (Array.isArray(params.path) ? params.path.join("/") : params.path);
	const nearest = resolveNearest(pathname);

	if (!nearest) {
		return new Response("No embed found", { status: 404 });
	}

	const embed =
		typeof nearest.mod === "function"
			? await nearest.mod({ params: nearest.params })
			: nearest.mod;

	return new Response(renderHtml(embed), {
		status: 200,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
		},
	});
};
