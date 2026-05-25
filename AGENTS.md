# AGENTS.md

## Architecture

This is a fully static Astro site for `warnertsang.com`.

- `src/pages/index.astro` renders the homepage and project grid.
- `src/layouts/Layout.astro` owns the shared HTML shell, metadata, base font, and body styles.
- `src/content.config.ts` defines the typed `projects` content collection.
- `src/content/projects/*.md` contains project card data as frontmatter.
- There is no database, server runtime, or authentication layer.

Project entries use this frontmatter shape:

```yaml
title: Project name
description: Short card description
status: live
tags:
  - Tag
liveUrl: https://example.com
repoUrl: https://github.com/example/repo
```

Allowed statuses are `live`, `building`, `paused`, and `archived`.

## Commands

- `npm install` installs dependencies.
- `npm run dev` starts the local Astro dev server.
- `npm run build` builds the static site into `dist/`.
- `npm run preview` previews the built output locally.
- `npm run astro -- --help` shows Astro CLI help.

## Coding Conventions

- Keep the site static and content-driven.
- Add or update projects by editing markdown files in `src/content/projects/`.
- Prefer Astro content collections for structured local content.
- Keep components and styles minimal; avoid client-side JavaScript unless a feature requires it.
- Use semantic HTML and accessible labels for grouped links or tag lists.
- Keep project URLs absolute so content validation catches invalid links.
