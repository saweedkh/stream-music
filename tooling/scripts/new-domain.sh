#!/usr/bin/env bash
# Scaffold a Django domain app under backend-django/apps/
set -euo pipefail

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Usage: make new-domain NAME=my_domain" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$ROOT/backend-django/apps/$NAME"
CLASS_NAME="$(echo "$NAME" | sed -r 's/(^|_)([a-z])/\U\2/g')"

if [[ -d "$APP_DIR" ]]; then
  echo "App already exists: $APP_DIR" >&2
  exit 1
fi

mkdir -p "$APP_DIR/api" "$APP_DIR/services" "$APP_DIR/tests"
touch "$APP_DIR/__init__.py" "$APP_DIR/api/__init__.py" "$APP_DIR/services/__init__.py"

sed "s/{{name}}/$NAME/g; s/{{ClassName}}/$CLASS_NAME/g" \
  "$ROOT/tooling/templates/django-domain/apps.py.tpl" > "$APP_DIR/apps.py"

cat > "$APP_DIR/api/urls.py" <<EOF
from django.urls import path

urlpatterns = []
EOF

cat > "$APP_DIR/api/views.py" <<EOF
"""API views for $NAME domain."""

from rest_framework.views import APIView
EOF

echo "Created apps.$NAME — register apps.$NAME.apps.${CLASS_NAME}Config in INSTALLED_APPS and include apps.$NAME.api.urls in apps/common/urls.py"
