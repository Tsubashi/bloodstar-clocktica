FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run buildprod


FROM trafex/php-nginx:3
COPY persistent/config/php.ini /etc/php85/conf.d/settings.ini

WORKDIR /var/www/html
RUN rm -rf ./*  # Clear out default files from the image
COPY --from=build /app/dist/ ./