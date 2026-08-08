import { Bot, Globe2, Search } from "lucide-react";

const PRINCIPLES = [
  {
    title: "SEO : être trouvé",
    label: "Search Engine Optimization",
    text: "Le SEO améliore la visibilité d'une page dans les moteurs de recherche grâce à une structure claire, des contenus utiles, des liens internes et des informations techniques fiables.",
    icon: Search,
  },
  {
    title: "AEO : être la réponse",
    label: "Answer Engine Optimization",
    text: "L'AEO organise les contenus autour des questions réelles des internautes : réponses courtes, titres explicites, FAQ et données structurées faciles à comprendre.",
    icon: Bot,
  },
  {
    title: "GEO : être recommandé",
    label: "Generative Engine Optimization",
    text: "Le GEO aide les moteurs génératifs à interpréter et citer une information grâce à des faits vérifiables, un contexte éditorial transparent et une expertise clairement attribuée.",
    icon: Globe2,
  },
] as const;

export function VisibilityGuide() {
  return (
    <section aria-labelledby="visibilite-guide" className="mt-10 space-y-4 px-4 lg:px-0">
      <div className="max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">
          Contenu utile et compréhensible
        </p>
        <h2 id="visibilite-guide" className="mt-1 text-xl font-black tracking-tight lg:text-2xl">
          SEO, AEO et GEO : comment LiveFoot rend ses analyses accessibles
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Être visible ne consiste plus seulement à apparaître dans Google. Une information doit
          aussi répondre clairement à une question et rester assez fiable pour être comprise,
          vérifiée et recommandée par les assistants intelligents.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {PRINCIPLES.map(({ title, label, text, icon: Icon }) => (
          <article key={title} className="rounded-2xl border border-border/70 bg-surface/45 p-4">
            <Icon className="size-5 text-brand" aria-hidden />
            <h3 className="mt-3 text-sm font-black">{title}</h3>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
