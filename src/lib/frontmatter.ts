export interface PostMeta {
  title: string;
  author: string;
  date: string;
  tag: string[];
  twitter_id: string;
  github_id: string;
  mail: string;
  ogp_url: string;
  description: string;
  url: string;
  site_name: string;
  twitter_site: string;
  featured: boolean;
}

const DEFAULTS: Partial<PostMeta> = {
  author: "abap34",
  twitter_id: "abap34",
  github_id: "abap34",
  mail: "abap0002@gmail.com",
  site_name: "abap34's blog",
  twitter_site: "@abap34",
};

export function parseFrontMatter(raw: string): { meta: PostMeta; body: string } {
  const lines = raw.split("\n");
  if (lines[0].trim() !== "---") {
    return { meta: {} as PostMeta, body: raw };
  }

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) {
    return { meta: {} as PostMeta, body: raw };
  }

  const yamlLines = lines.slice(1, endIdx);
  const meta = parseYaml(yamlLines) as unknown as PostMeta;
  const body = lines.slice(endIdx + 1).join("\n").replace(/^\n/, "");

  return { meta, body };
}

function parseYaml(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.*)/);
    if (!match) continue;

    const [, key, rawValue] = match;
    let value: unknown = rawValue;

    // Inline array: [item1, item2]
    const arrayMatch = rawValue.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      value = arrayMatch[1].split(",").map((s) => s.trim());
    }
    // Boolean
    else if (rawValue === "true") {
      value = true;
    } else if (rawValue === "false") {
      value = false;
    }

    result[key] = value;
  }

  return result;
}

export function generateFrontMatter(
  meta: Partial<PostMeta>,
  body: string,
  slug: string
): string {
  const m = { ...DEFAULTS, ...meta };

  // Ensure url is set based on slug
  if (!m.url) {
    m.url = `https://abap34.com/posts/${slug}.html`;
  }

  const tagStr =
    m.tag && Array.isArray(m.tag) ? `[${m.tag.join(", ")}]` : "[]";

  const lines = [
    "---",
    `title: ${m.title || ""}`,
    `author: ${m.author}`,
    `date: ${m.date || ""}`,
    `tag: ${tagStr}`,
    `twitter_id: ${m.twitter_id}`,
    `github_id: ${m.github_id}`,
    `mail: ${m.mail}`,
    `ogp_url: ${m.ogp_url || ""}`,
    `description: ${m.description || ""}`,
    `url: ${m.url}`,
    `site_name: ${m.site_name}`,
    `twitter_site: ${m.twitter_site}`,
    `featured: ${m.featured ?? false}`,
    "---",
    "",
    body,
  ];

  return lines.join("\n");
}

export function slugFromPath(path: string): string {
  // posts/slug.md -> slug
  const name = path.split("/").pop() || "";
  return name.replace(/\.md$/, "");
}
