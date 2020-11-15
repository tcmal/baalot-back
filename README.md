# baalot

A super fast and scalable voting website using google cloud functions and datastax astra. Built for def hacks 2020.

# Environment

You need to run `schema.cql` on your database to set up the right tables.

The environment variable `GCP_PROJECT` is needed, as is `ASTRA_KEYSPACE`.

Database connection details and JWT secret are stored with google's secret manager API.
    - `astra_secure_connect` - The secure connection bundle .zip, obtainable from astra
    - `astra_credentials` - The username and password, in a json object
    - `jwt_secret` - The JWT secret to use.

# Development

You can emulate each function locally:

```bash
FUNCTION_TARGET=createPoll yarn run dev
```

TODO: How to emulate all functions at once.

# Deployment

Deployment is done in 2 parts: The actual cloud functions, then the cloud endpoints service that serves them.

# Cloud functions

To deploy a single function:

```bash
FUNCTION_TARGET=createPoll yarn run deploy-gcf
```

To deploy all functions, use the helper script `./scripts/deploy_all_gcf` from the root directory.

# Cloud endpoints

The first time you do this, you also need to reserve a hostname - see [here](https://cloud.google.com/endpoints/docs/openapi/get-started-cloud-functions).

The script 

# Acknowledgements

* ptone for the [original boilerplate](https://github.com/ptone/node-cloud-function-boiler)
* Uses [Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework-nodejs)
* [Google Typescript style](https://www.npmjs.com/package/gts) 