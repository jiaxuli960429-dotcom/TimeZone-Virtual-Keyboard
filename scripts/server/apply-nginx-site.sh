#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/launch-advisor/conf/site.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

SERVER_NAME="$(grep -E '^SERVER_NAME=' "$ENV_FILE" | head -n1 | cut -d'=' -f2- | xargs)"
if [ -z "$SERVER_NAME" ]; then
  echo "SERVER_NAME is empty in $ENV_FILE"
  exit 1
fi

cat > /etc/nginx/sites-available/launch-advisor <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${SERVER_NAME};
    client_max_body_size 20m;

    root /opt/launch-advisor/app/TimeZone-Virtual-Keyboard/webroot;
    index home.html index.html;

    location = /overlay {
        try_files /overlay.html =404;
    }

    location = /keyboard {
        try_files /index.html =404;
    }

    location / {
        try_files \$uri \$uri/ /home.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /ws/realtime {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/launch-advisor /etc/nginx/sites-enabled/launch-advisor
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
echo "Applied Nginx site with server_name=${SERVER_NAME}"
