# Llamastack

This is a simple example of deploying the Starter Distribution of llama-stack with OpenAI. To use
it you must provide your own OpenAI token in the secret.

# Deploying

This is using kustomize, once you add the token to the secret you can deploy it with:

```
kubectl -k examples/manifests/llama-stack/base
```
