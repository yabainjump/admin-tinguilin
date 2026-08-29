# Audit de securite administration — 2026-08-29

L'administration Angular a ete analysee avec la checklist Vibe Check adaptee au
projet.

## Resultats

- Angular est passe a `20.3.30` et le toolchain a `20.3.35`.
- Lint, build et le test automatise sont reussis.
- `npm audit --omit=dev` retourne 0 vulnerabilite de production.
- Les controles d'autorisation restent imposes par l'API ; l'interface ne doit
  jamais etre consideree comme une frontiere de securite.

## Risque residuel

Sept alertes transitives restent limitees au toolchain de developpement. Le
correctif force propose par npm regresse vers un ancien Angular et n'est pas
acceptable. Ne jamais exposer `ng serve`; deployer uniquement les artefacts
statiques derriere HTTPS, avec CSP et en-tetes de securite au niveau du serveur.

Le rapport transversal et les controles d'exploitation sont conserves dans le
depot backend sous `security/reports/2026-08-29-security-audit.md`.

