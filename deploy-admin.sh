#!/usr/bin/env bash
# =============================================================================
# Deploiement BACK-OFFICE ADMIN (Angular) sur cPanel.
# Build statique -> copie dans le docroot du sous-domaine admin. Pas de PM2.
# A lancer sur le serveur depuis le dossier du repo:
#     bash ./deploy-admin.sh
#
# Variables surchargeables:
#   BRANCH    branche git                            (defaut: master)
#   REPO_DIR  dossier du repo                         (defaut: ce dossier)
#   DOCROOT   docroot servi par cPanel pour
#             admin.tinguilin.yaba-in.com             (A DEFINIR si different)
# =============================================================================
set -euo pipefail

BRANCH="${BRANCH:-master}"
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
DOCROOT="${DOCROOT:-$HOME/public_html/admin.tinguilin.yaba-in.com}"
BUILD_DIR="dist/admin-tinguilin"                  # outputPath de angular.json

if [ -z "${NODE_BIN:-}" ]; then
  if   [ -d /opt/cpanel/ea-nodejs22/bin ]; then NODE_BIN="/opt/cpanel/ea-nodejs22/bin"
  elif [ -d /opt/cpanel/ea-nodejs20/bin ]; then NODE_BIN="/opt/cpanel/ea-nodejs20/bin"
  elif command -v node >/dev/null 2>&1;    then NODE_BIN="$(dirname "$(command -v node)")"
  else echo "Node introuvable. Definis NODE_BIN."; exit 1
  fi
fi
export PATH="$NODE_BIN:$PATH"
NPM="${NPM:-$NODE_BIN/npm}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=2048}"

echo "==> Admin deploy | repo=$REPO_DIR | branch=$BRANCH | docroot=$DOCROOT"
cd "$REPO_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"
git clean -fd -e node_modules/

if [ -f package-lock.json ]; then "$NPM" ci --no-audit --no-fund; else "$NPM" install --no-audit --no-fund; fi
"$NPM" run build
[ -d "$BUILD_DIR" ] || { echo "ERREUR: dossier de build '$BUILD_DIR' absent apres build"; exit 1; }

mkdir -p "$DOCROOT"

cat > "$BUILD_DIR/.htaccess" <<'HTACCESS'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
HTACCESS

echo "==> Synchronisation vers $DOCROOT"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete \
    --exclude '.well-known' \
    "$BUILD_DIR"/ "$DOCROOT"/
else
  find "$DOCROOT" -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +
  cp -a "$BUILD_DIR"/. "$DOCROOT"/
fi

echo "✅ Deploy admin OK -> https://admin.tinguilin.yaba-in.com"
