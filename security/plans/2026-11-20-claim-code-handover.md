# Remise d'un lot par code gagnant — risques ouverts (2026-11-20)

Frontend admin implémenté contre le contrat API (backend développé en parallèle, non vérifié de bout en bout).

## Contrôles côté admin (fait)

- Le code ne transite que dans le corps des POST (`lookup`, `claim`), jamais dans l'URL, les logs ou le stockage ; il est effacé de la mémoire du composant après la remise et à la destruction.
- L'API ne renvoie jamais le code ; `regenerate` n'affiche rien d'autre que le statut d'envoi de l'email.
- Confirmation explicite : case « pièce d'identité vérifiée » obligatoire avant la remise ; confirmation en page avant régénération.
- Images (avatar, lot) affichées uniquement si `resolveUploadUrl` les valide (`/uploads/` de l'origine HTTPS de l'API).
- Erreurs : messages français fixes par statut ; pas de reprise du corps brut hors 404 (message français par contrat).

## À vérifier côté backend (non vérifiable ici)

- [ ] Les trois routes exigent JWT + rôle admin courant (pas seulement un garde Angular).
- [ ] Throttling `lookup` (10/min) effectif par admin ET par IP ; comparaison du code en temps constant ; codes stockés hachés.
- [ ] `claim` atomique et idempotent (409 si déjà remis, code à usage unique même en cas de requêtes concurrentes).
- [ ] Journal d'audit (admin, raffleId, horodatage) pour `claim` et `regenerate`, sans le code en clair.
- [ ] `regenerate` invalide l'ancien code et refuse (400) un lot déjà remis.
- [ ] Réponse `lookup` limitée aux données nécessaires à la vérification d'identité.
