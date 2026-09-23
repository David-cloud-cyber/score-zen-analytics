export function analysisMatchId(home: string, away: string, originalHome: string, originalAway: string, matchId?: string) {
  const normalize = (value: string) => value.trim().toLowerCase();
  return normalize(home) === normalize(originalHome) && normalize(away) === normalize(originalAway)
    ? matchId : undefined;
}

export function analysisReturnPath(home: string, away: string, matchId?: string) {
  if (!home.trim() || !away.trim()) return "/analyse";
  const query = new URLSearchParams({ home: home.trim(), away: away.trim() });
  if (matchId && /^\d+$/.test(matchId)) query.set("matchId", matchId);
  return `/analyse?${query}`;
}

export function analysisErrorMessage(rawMessage: string) {
  if (/déjà terminée|ne peut pas être analysée dans son état actuel/.test(rawMessage)) return rawMessage;
  if (/recommandation fiable|suffisamment d’informations vérifiées|Données statistiques insuffisantes/.test(rawMessage)) {
    return "Les données vérifiées sont insuffisantes pour recommander un pronostic sur ce match. Aucun crédit débité. Essayez une autre rencontre.";
  }
  if (/invalid_type|matchId|Identifiant de match/i.test(rawMessage)) return "Le match n’a pas pu être identifié. Ouvrez l’analyse depuis sa fiche.";
  if (/Crédits insuffisants|Limite atteinte|Limite quotidienne|Profil introuvable|Impossible de lire votre profil/i.test(rawMessage)) return rawMessage;
  if (/Impossible d'enregistrer le débit/.test(rawMessage)) return "L’analyse n’a pas pu être enregistrée. Réessayez : la même demande sera reprise sans double débit.";
  return "L’analyse n’a pas pu être terminée. Réessayez : la même demande sera reprise sans double débit.";
}
