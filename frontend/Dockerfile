FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Optional. Unset means the bundle calls http://localhost:8000, as src/lib/api.js does.
ARG VITE_API_BASE
RUN npm run build
# nginx.conf names the API origin in its Content-Security-Policy. Derive it from
# the same variable, with the same default, that the bundle was just built with.
RUN API_ORIGIN="$(node -e "console.log(new URL(process.env.VITE_API_BASE || 'http://localhost:8000').origin)")" \
    && sed "s|__API_ORIGIN__|${API_ORIGIN}|g" nginx.conf > /tmp/default.conf

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /tmp/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
