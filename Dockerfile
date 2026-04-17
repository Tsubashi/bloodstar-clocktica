FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run buildprod


FROM trafex/php-nginx:3
EXPOSE 80
COPY persistent/config/nginx.conf /etc/nginx/conf.d/server.conf
COPY persistent/config/php.ini /etc/php85/conf.d/settings.ini

WORKDIR /var/www/html
COPY --from=build /app/dist/ ./