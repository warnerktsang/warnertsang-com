import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		status: z.enum(['live', 'building', 'paused', 'archived']),
		tags: z.array(z.string()).default([]),
		liveUrl: z.string().url(),
		repoUrl: z.string().url(),
	}),
});

export const collections = { projects };
