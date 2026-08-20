import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const component = await readFile(join(root, "src/components/TelegramCtaCard.tsx"), "utf8");
const expectedFiles = [
  "src/routes/index.tsx",
  "src/routes/communaute.tsx",
  "src/routes/premium.tsx",
  "src/components/BlogUI.tsx",
];
const forbiddenFiles = [
  "src/routes/live.$id.tsx",
  "src/routes/analyse.tsx",
  "src/routes/auth.tsx",
  "src/routes/support.tsx",
  "src/routes/_authenticated/profil.tsx",
];
const errors = [];

if (!component.includes('https://t.me/livefootia')) errors.push("URL Telegram absente ou incorrecte");
if (!component.includes('target="_blank"') || !component.includes('rel="noopener noreferrer"')) {
  errors.push("ouverture externe non sécurisée");
}
if (!component.includes('telegram_cta_view') || !component.includes('telegram_cta_click')) {
  errors.push("événements de suivi Telegram absents");
}

for (const file of expectedFiles) {
  const source = await readFile(join(root, file), "utf8");
  if (!source.includes("TelegramCtaCard")) errors.push(`${file}: CTA Telegram absent`);
}

for (const file of forbiddenFiles) {
  const source = await readFile(join(root, file), "utf8");
  if (source.includes("TelegramCtaCard") || source.includes("t.me/livefootia")) {
    errors.push(`${file}: CTA Telegram présent sur une page exclue`);
  }
}

if (errors.length) {
  console.error("Audit Telegram échoué :");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Audit Telegram réussi : lien, sécurité, suivi et emplacements vérifiés.");
