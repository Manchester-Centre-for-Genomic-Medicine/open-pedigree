FROM node:14

# create the app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

<<<<<<< Updated upstream
=======
# set environmental variables
RUN export AUTH_0_DOMAIN_URL="gen-o-dev.eu.auth0.com" && \
    export AUTH_0_CLIENT_ID="d3YJUQgU53bhu4O7nhPtFnXM4LjNUb6U" && \
    export AUTH_0_AUDIENCE="https://gen-o-dev.eu.auth0.com/api/v2/" && \
    export REACT_APP_URL="https://develop-gen-o.northwestglh.com/" && \
    export HASURA_URL="http://develop-graphql.northwestglh.com/v1/graphql"

>>>>>>> Stashed changes
# install any dependencies
# we copy package*.json over to make use of docker's cached builds
COPY package*.json .
RUN npm install \
    && npm cache clean --force

# copy over the rest of the source code
COPY . .

# run the application and make it available outside the container
CMD ["npm", "run", "start-docker"]
EXPOSE 9000
