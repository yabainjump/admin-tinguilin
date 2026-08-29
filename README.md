# AdminTinguilin

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.16.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Spec Kit

Ce dépôt utilise GitHub Spec Kit `v1.0.1` avec l'intégration Codex. Les règles
de sécurité administrative, de validation et de qualité sont définies dans
`.specify/memory/constitution.md`; les skills sont dans `.agents/skills/`.

Pour une nouvelle fonctionnalité, ouvrir Codex depuis ce dossier puis suivre :

```text
$speckit-specify → $speckit-clarify → $speckit-plan
→ $speckit-tasks → $speckit-analyze → $speckit-implement
→ $speckit-converge
```

Les artefacts sont versionnés dans `specs/`. Toute mutation ou permission
nouvelle doit référencer la spec du contrat correspondant dans `tingilin-api`.

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
