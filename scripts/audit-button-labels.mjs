import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = join(process.cwd(), "src");
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (/\.(tsx|jsx|html)$/.test(entry.name)) files.push(path);
  }
}

await collect(root);
const warnings = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const openingTags = source.match(/<(button|a)[\s\S]*?>/g) ?? [];
  openingTags.forEach((tag, index) => {
    if (!/button|role\s*=\s*["']button["']/.test(tag)) return;
    if (!/className\s*=|class\s*=/.test(tag)) return;
    if (
      /className\s*=\s*["'][^"']*\btext-(?:foreground|background|brand|white|black|muted-foreground)\b/.test(
        tag,
      )
    )
      return;
    if (
      /class\s*=\s*["'][^"']*\btext-(?:foreground|background|brand|white|black|muted-foreground)\b/.test(
        tag,
      )
    )
      return;
    if (
      /aria-label\s*=/.test(tag) &&
      !/bg-(?:brand|foreground|surface|card|background|alert|destructive)/.test(tag)
    )
      return;
    warnings.push(
      `${relative(process.cwd(), file)}:${index + 1} has no explicit text color in its static className`,
    );
  });
}

if (warnings.length) {
  console.warn("Button label audit warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
} else {
  console.log("Button label audit passed.");
}
