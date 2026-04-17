FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run buildprod


FROM trafex/php-nginx:3
EXPOSE 9000

WORKDIR /var/www/html
COPY --from=build /app/dist/ ./