![alt text](https://raw.githubusercontent.com/argoproj-labs/assistant-for-argocd/main/docs/img/assistant.png)

### Introduction

This is an Argo CD Extension which adds an AI Assistant Chatbot to the Argo CD UI. It currently uses llama-stack
as the backend since this enables the potential use of tools such as MCP servers however at the moment it has only
been tested with an inference engine using the Agent API.

This extension adds an `Assistant` tab to the resources view where users can ask questions about the currently
selected resource. The extension automatically adds manifests and events to the query context and logs can be added
through a guided conversation flow.

To call llama-stack this uses the [Argo CD Proxy Extension](https://argo-cd.readthedocs.io/en/stable/developer-guide/extensions/proxy-extensions)
feature to avoid CORS issues.

### Installing Extension in Argo CD

*Prerequistes*: You must have llama-stack installed and configured with at least one inference engine. An example of doing
this with OpenAI as the inference engine is in `examples/manifests/llama-stack/base`.

Install the extension into the Argo CD instance by adding the following in the appropriate spots, note here we are using
the Argo CD Operator but feel free to adapt it for the argcd-cm ConfigMap if you have deployed Argo CD using the Helm chart:

```
apiVersion: argoproj.io/v1beta1
kind: ArgoCD
metadata:
  name: openshift-gitops
  namespace: openshift-gitops
spec:
  rbac:
    ...
    # This is needed to allow the extensiont to communicate with the proxy-extension
    # defined in extraConfig. Note the name `assistant` must match the proxy-extension
    # name.
    p, role:readonly, extensions, invoke, assistant, allow
  extraConfig:
    # Define the extension end point
    extension.config.assistant: |
      connectionTimeout: 2s
      keepAlive: 360s
      idleConnectionTimeout: 360s
      maxIdleConnections: 30
      services:
        # Note if you use HTTPS it needs to be a valid certificate or the CA
        # needs to be installed in the server component otherwise the
        # Argo CD Proxy Extension will fail
      - url: http://llamastack.llamastack.svc.cluster.local:8321
  server:
    # Enabled proxy extensions in the server component
    extraCommandArgs:
      - "--enable-proxy-extension"
    # Install the extension, update the x.y.z version to match the latest
    initContainers:
      - env:
          - name: EXTENSION_URL
            value: "https://github.com/gnunn-gitops/argocd-assistant/releases/download/0.4.1/extension-asistant-x.y.z.tar"
        image: "quay.io/argoprojlabs/argocd-extension-installer:v0.0.8"
        name: extension-assistant
        securityContext:
          allowPrivilegeEscalation: false
        volumeMounts:
          - name: extensions
            mountPath: /tmp/extensions/
    volumes:
      - name: extensions
        emptyDir: {}
```

# Providers

The extension has been designed to support pluggable query providers however at the moment there is a single
provider for llama-stack. In the future a second provider will be added for OpenShift's Lightspeed back-end
and contributions for additional providers are certainly welcome.

# Configuration

The llama-stack provider in the extension will use the first model returned if not configuration is specified.
If you wish to specify a model explicitly you can add the settings to use as a second extension, see the example
in `examples/settings/llama-stack`.

# Development

To install dependencies you will need to use the `--force` switch as the Argo CD UI is using React 16 whereas
some of the dependencies using later but compatible versions. I'm hoping in the future to get this working
more seamlessly.

```
npm install --force
```

To build the extension use `yarn run build`, see `package.json` for other available commands.

I have not figured out a way to develop it with live code so I use the script `./deploy-local.sh` to build and copy the extension into
a running Argo CD on the cluster. Tweak the NAMESPACE and LABEL_NAME environment variables to match your instance of Argo CD. Note
the LABEL_NAME needs to be a unique label on the Argo CD server component.

# Limitations

There are some limitations as follows:

1. Only basic configuration is supported, I plan on adding more provider specific configuration so that configuration for
llama-stack to use MCP servers can be incorporated.

2. When #1 is resolved, it's important to note that the Argo CD Proxy Extension does not have
the ability to pass the Argo CD token to back-ends, IMHO this will be needed to leverage MCP
securely in multi-tenant Argo CD since you want MCP access to reflect the permissions of the current user.

3. The Go Reverse Proxy the Argo CD Proxy Extension uses is not configurable and OOTB doesn't support
streaming, a work-around by the extension of setting the ContentLength header to
-1 is used but ideally this should be configurable in the proxy extension definition.

4. If the provider is using self-signed TLS you will need to inject the certs into the Argo CD server for trust.

