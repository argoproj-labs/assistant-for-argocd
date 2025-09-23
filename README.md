![alt text](https://raw.githubusercontent.com/argoproj-labs/assistant-for-argocd/main/docs/img/assistant.png)

# Introduction

This is an Argo CD Extension which adds an AI Assistant Chatbot to the Argo CD UI. It currently uses llama-stack
as the backend since this enables the potential use of tools such as MCP servers however at the moment it has only
been tested with an inference engine using the Agent API.

This extension adds an `Assistant` tab to the resources view where users can ask questions about the currently
selected resource. The extension automatically adds manifests and events to the query context and logs can be added
through a guided conversation flow.

To call llama-stack this uses the [Argo CD Proxy Extension](https://argo-cd.readthedocs.io/en/stable/developer-guide/extensions/proxy-extensions)
feature to avoid CORS issues.

# Providers

The extension has been designed to support pluggable query providers however at the moment there is a single
provider for llama-stack. In the future a second provider will be added for OpenShift's Lightspeed back-end
and contributions for additional providers are certainly welcome.

# Configuration

See the documentation on [Settings](https://github.com/argoproj-labs/assistant-for-argocd/blob/main/docs/settings.md)

# Installing Extension in Argo CD

To install the Extension see the Provider specific documentation:

* [Llama-stack](https://github.com/argoproj-labs/assistant-for-argocd/blob/main/docs/llama-stack.md)
* [Lightspeed](https://github.com/argoproj-labs/assistant-for-argocd/blob/main/docs/lightspeed.md)


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

# Packaging

To create a new release, bump the version number in `package.json` and then run `yarn run package`. This will create
a compressed archive in `./dist` that can be used by the Argo CD Extension Installer.

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

# Thanks

Thanks to the folks who work on the [react-chatbotify](https://react-chatbotify.com) component, it provides a lot of the capabilities used
here and is an excellent open source component. If you need to provide a chatbot in a React interface
its well worth checking out.

