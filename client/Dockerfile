FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Vite inlines VITE_* variables into the built JS at build time, not at
# container start — so this has to be a build ARG (set via docker-compose's
# `build.args`), not a runtime `environment:` entry, or the client will ship
# with whatever VITE_API_URL was baked in the last time the image was built.
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
