FROM node:14

# create the app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# set environmental variables
RUN export AUTH_0_DOMAIN_URL=${AUTH_0_DOMAIN_URL} && \
    export AUTH_0_CLIENT_ID=${AUTH_0_CLIENT_ID} && \
    export AUTH_0_AUDIENCE=${AUTH_0_AUDIENCE} && \
    export REACT_APP_URL=${REACT_APP_URL} && \
    export HASURA_URL=${HASURA_URL}

# install any dependencies
# we copy package*.json over to make use of docker's cached builds
COPY package*.json .
RUN npm install \
    && npm cache clean --force

# copy over the rest of the source code
COPY . .

# run the application and make it available outside the container
ENTRYPOINT ["npm", "run", "start-docker"]
EXPOSE 9000
