export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`px-4 text-center text-[10px] leading-relaxed text-muted-foreground ${className}`}>
      Les analyses fournies sont des estimations basées sur des modèles statistiques et ne
      garantissent aucun résultat sportif. Jouez de manière responsable.
    </p>
  );
}
