### Introduction

The Assistant has some very basic configuration options but unfortunately the Argo CD Extension
mechanism doesn't provide a way to pass configuration to the extension. To work around this
we deploy the settings as a second Argo CD Extension that makes the settings available
as a global variable.

*IMPORTANT*: Never put any API keys or other secret material in these settings as they
can be easily read from the browser by viewing source. Any API keys required should
be set on the backend, Llama-Stack or Lightspeed for example.

### Defining Settings

The settings can be defined using a template as follows:

```
var argocdAssistantSettings = {
    provider: "Llama-Stack"
};

(() => {

    console.log("Initializing Argo CD Assistant Settings");
    console.log(globalThis.argocdAssistantSettings);

})();
```

If no settings are provided the Assistant will default to Llama-Stack as
the back-end provider.

Other settings are supported including provider specific settings. These
are as follows:

| Setting  | Required | Description |
| ------------- | ------------- | ---------- |
| provider  | Yes  | If you provide a Settings object you must specify the back-end [Provider](https://github.com/argoproj-labs/assistant-for-argocd/blob/main/src/providers/providerFactory.ts#L6) to use. |
| model  | No  | This specifies the model you want to use. If not specified the Provider will attempt to use a reasonable default. |
| data   | No  | Provider specific configuration, see docs for the Provider you are using. |

### Creating Extension

To create a settings extension, put your settings `.js` file in the following directory format:

```
resources/extensions-assistant-settings/<your-filename>.js
```

You can then tar the file:

```
tar -cvf assistant-lightspeed-settings.tar ./resources
```

Upload the settings to a location that will be accessible by Argo CD. Configure
your Argo CD to use the Extensions Installer to load the extension:

```
    initContainers:
      - env:
          - name: EXTENSION_URL
            value: "https://<your-location>/assistant-lightspeed-settings.tar"
        image: "quay.io/argoprojlabs/argocd-extension-installer:v0.0.8"
        name: extension-assistant-settings
        securityContext:
          allowPrivilegeEscalation: false
        volumeMounts:
          - name: extensions
            mountPath: /tmp/extensions/
```
