import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(resolve(root, file), "utf8");
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const publicRoutes = [
  "src/routes/index.tsx",
  "src/routes/analyse.tsx",
  "src/routes/communaute.tsx",
  "src/routes/premium.tsx",
  "src/routes/blog.index.tsx",
  "src/routes/blog.football.tsx",
  "src/routes/blog.$slug.tsx",
  "src/routes/codes-promo.index.tsx",
  "src/routes/en.index.tsx",
  "src/routes/en.analyse.tsx",
  "src/routes/en.premium.tsx",
  "src/routes/en.blog.tsx",
  "src/routes/en.promo-codes.tsx",
  "src/routes/en.community.tsx",
];

for (const file of publicRoutes) {
  check(existsSync(resolve(root, file)), `Route publique manquante : ${file}`);
  if (existsSync(resolve(root, file))) {
    const source = read(file);
    check(source.includes("head:"), `${file} ne déclare pas de métadonnées head`);
    check(
      source.includes("buildRouteMeta") || source.includes("blogIndexHead") || source.includes("blogCollectionHead") || source.includes("blogArticleHead"),
      `${file} n'utilise pas de helper SEO partagé`,
    );
  }
}

const privateRoutes = [
  "src/routes/auth.tsx",
  "src/routes/support.tsx",
  "src/routes/admin.tsx",
  "src/routes/premium.tableau-de-bord.tsx",
  "src/routes/premium.historique.tsx",
  "src/routes/_authenticated/favoris.tsx",
  "src/routes/_authenticated/profil.tsx",
];
for (const file of privateRoutes) {
  const source = read(file);
  check(/noindex/.test(source), `${file} doit être noindex`);
}

const seo = read("src/lib/seo.ts");
check(seo.includes("og:image:width"), "Dimensions og:image absentes");
check(seo.includes("hrefLang"), "Alternates hreflang absents");
check(
  !seo.includes('"@type": "QAPage"'),
  "QAPage ne doit pas être utilisé pour le contenu éditorial statique",
);
check(
  read("public/robots.txt").includes("Sitemap: https://www.livefoot.fun/sitemap.xml"),
  "Sitemap absent de robots.txt",
);
check(read("public/llms.txt").includes("/a-propos"), "Page À propos absente de llms.txt");
check(read("public/llms.txt").includes("/en/analyse"), "Pages anglaises absentes de llms.txt");

if (failures.length) {
  console.error("Audit SEO échoué :");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Audit SEO réussi : ${publicRoutes.length} routes publiques, ${privateRoutes.length} routes privées vérifiées.`,
  );
}
