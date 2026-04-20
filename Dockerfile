FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run buildprod
RUN sed -i "s/Built: {unspecified}/Built: $(date -r /app/src/index.html +%Y.%m.%d)/g" dist/index.html


FROM trafex/php-nginx:3
COPY config/php.ini /etc/php85/conf.d/settings.ini
COPY config/nginx/* /etc/nginx/conf.d/

WORKDIR /var/www/html
RUN rm -rf ./*  # Clear out default files from the image
COPY --from=build /app/dist/ ./