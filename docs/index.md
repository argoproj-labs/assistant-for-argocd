# assistant-for-argocd - AI Assistance for Argo CD

### Introduction

The Assistant for Argo CD provides an AI powered Chatbot to the Argo CD UI
via a [Resource Tab Extension](https://argo-cd.readthedocs.io/en/latest/developer-guide/extensions/ui-extensions/#resource-tab-extensions). Users
can ask questions about the currently selected resource. The resource manifest and events are automatically added to the query context
and logs can be optionally added as well if supported by the resource (i.e. deployments, pods, etc).

This extension uses a back-end to provide the query functionality, either Llama-Stack or OpenShift Lightspeed. Both of
these back-ends support a wide variety of inference providers (OpenAI, Gemini, Granite, etc) following a
Bring-Your-Own-Model (BYOM) design.

![Assistant for Argo CD](assets/assistant.png)

### Interactive Demonstration

An interactive demonstration of the Assistant for Argo CD is available:

<!--ARCADE EMBED START--><div style="position: relative; padding-bottom: calc(53.3333% + 41px); height: 0px; width: 100%;"><iframe src="https://demo.arcade.software/xWi5je6tPnJe4dcspahl?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true" title="Assistant for Argo CD" frameborder="0" loading="lazy" webkitallowfullscreen mozallowfullscreen allowfullscreen allow="clipboard-write" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; color-scheme: light;" ></iframe></div><!--ARCADE EMBED END-->

