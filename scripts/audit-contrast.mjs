import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const srcRoot = join(root, "src");
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

const files = await walk(srcRoot);

for (const file of files) {
  const source = await readFile(file, "utf8");
  const name = relative(root, file).replaceAll("\\", "/");

  if (file.endsWith(".tsx") && /text-background\/\d+/.test(source)) {
    violations.push(`${name}: text-background avec opacité doit être scoped à une surface adaptée`);
  }

  for (const [index, line] of source.split("\n").entries()) {
    if (/(?:<button|role=["']button["'])/.test(line) && /(?:text-transparent|opacity-0|invisible)/.test(line)) {
      violations.push(`${name}:${index + 1}: contrôle interactif potentiellement invisible`);
    }
  }
}

const requiredSurfaces = [
  "src/routes/communaute.tsx",
  "src/routes/premium.tsx",
  "src/routes/_authenticated/profil.tsx",
  "src/routes/analyse.tsx",
  "src/routes/premium.tableau-de-bord.tsx",
  "src/routes/live.$id.tsx",
  "src/components/RemoteMatchCard.tsx",
];

for (const file of requiredSurfaces) {
  const source = await readFile(join(root, file), "utf8");
  if (!source.includes("score-dark-surface")) {
    violations.push(`${file}: surface sombre sans contexte score-dark-surface`);
  }
}

if (violations.length) {
  console.error("Audit contraste échoué :");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Audit contraste réussi : ${files.length} fichiers contrôlés.`);
