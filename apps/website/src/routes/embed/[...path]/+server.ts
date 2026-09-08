import { resolveEmbed, renderEmbed } from "$lib/embedResolver";
import type { RequestHandler } from "@sveltejs/kit";

export const GET: RequestHandler = async ({ params, url }) => {
	const pathname = "/" + (Array.isArray(params.path) ? params.path.join("/") : params.path);
	const resolved = resolveEmbed(pathname);

	if (!resolved) {
		return new Response(null, { status: 404 });
	}

	return renderEmbed(resolved.handler, { params: resolved.params, url });
};
