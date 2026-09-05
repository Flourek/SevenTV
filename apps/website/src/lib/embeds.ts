export interface EmbedConfig {
	title?: string;
	description?: string;
	image?: string;
	cardType?: "summary" | "summary_large_image";
}

export function resolveEmbed(parent: EmbedConfig | undefined, local: Partial<EmbedConfig>): EmbedConfig {
	return { ...(parent ?? {}), ...local };
}
