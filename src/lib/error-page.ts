export function createIncidentId(): string {
  try {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  } catch {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }
}

export function renderErrorPage(incidentId = createIncidentId()): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>LiveFoot — Actualisation nécessaire</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root { color-scheme: light; }
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #f7f9fb; color: #0b1220; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 32rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { min-height: 2.75rem; padding: 0.65rem 1rem; border-radius: 0.75rem; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #101820; color: #ffffff; }
      .primary:hover { background: #1b2933; }
      .secondary { background: #ffffff; color: #101820; border-color: #cbd5e1; }
      .secondary:hover { background: #eef2f6; }
      a:focus-visible, button:focus-visible { outline: 3px solid #10b981; outline-offset: 3px; }
      .incident { color: #64748b; font-size: 0.72rem; margin-top: 1.25rem; }
      @media (prefers-color-scheme: dark) { :root { color-scheme: dark; } body { background: #050911; color: #f8fafc; } p { color: #aab6c5; } .primary { background: #f8fafc; color: #071019; } .primary:hover { background: #dce4eb; } .secondary { background: #111a24; color: #f8fafc; border-color: #334155; } .secondary:hover { background: #1a2734; } .incident { color: #8190a3; } }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Cette page n'a pas pu être chargée.</h1>
      <p>Les informations sont momentanément indisponibles. Actualisez la page ou retournez à l'accueil.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Essayer à nouveau</button>
        <a class="secondary" href="/">Retour à l'accueil</a>
      </div>
    </div>
  </body>
</html>`;
}
