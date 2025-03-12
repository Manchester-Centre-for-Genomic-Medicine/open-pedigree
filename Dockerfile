# Stage 1: base image
FROM node:20 as build-stage

# create the app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# install any dependencies
# we copy package*.json over to make use of docker's cached builds
COPY package*.json ./
RUN npm install \
    && npm cache clean --force

# copy over the rest of the source code
COPY . .

RUN npm run build

# Stage 2, based on Nginx, to have only the compiled version of the app
FROM docker.io/nginx:1.17
COPY ./nginx.conf /etc/nginx/nginx.conf

COPY index.html /usr/share/nginx/html/
COPY public /usr/share/nginx/html/public/
COPY --from=build-stage /usr/src/app/dist/ /usr/share/nginx/html/dist/

EXPOSE 9000
CMD ["nginx", "-g", "daemon off;"]
