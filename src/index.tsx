import MarkdownRenderer, { MarkdownRendererBlock } from "@rcb-plugins/markdown-renderer";
import * as React from "react";
import ChatBot, { Flow, Settings, Styles } from "react-chatbotify";
import MarkedWrapper from "./components/MarkedWrapper";
import {getLogs, hasLogs, MAX_LINES} from "./service/logs";
import { getContainers, getResourceIdentifier, isAttachRequest, isCancelRequest, QueryContextImpl } from "./util/util";
import { Events, LogEntry } from "./model/argocd";
import { Attachment, AttachmentType, QueryProvider, QueryResponse, AssistantSettings } from "./model/provider";
import { createProvider, Provider } from "./providers/providerFactory";

import "./index.css"

// Where the chat is stored in session storage.
const CHAT_HISTORY_KEY = "argocd-assistant-chat-history";

// Where the resource namespace-name is stored in session storage. This
// is used to track the currently viewed resource and is used to
// either reload the context on a tab switch or discard it when
// a new resource is viewed.
const RESOURCE_ID_KEY = "argocd-assistant-resource-id";

// Where the logs are stored, logs are loaded once and cached. To refresh
// the logs the user can simply fetch them again. Might make this simpler
// in the future with a guided conversation.
const LOGS_KEY = "argocd-assistant-logs";

const CONVERSATION_ID_KEY = "argocd-assistant-conversation-id";

const DATA_KEY = "argocd-assistant-data";

/**
 * Settings used for chatbotify component
 */
const CHAT_SETTINGS: Settings = {
    general: {
        showFooter: false,
        showHeader: false,
        embedded: true
    },
    fileAttachment: {
        disabled: true
    },
    chatHistory: {
        disabled: false,
        storageKey: CHAT_HISTORY_KEY,
        storageType: "SESSION_STORAGE",
        // More management of state needs to be done in this extension, it basically
        // looks every time a tab is switched the view gets re-loaded. Enabling this switch
        // brings back the state automatically but if the user attached logs they would lose
        // though which is confusing.
        autoLoad: true
    },
    chatWindow: {
        showScrollbar: true
    }
}

/**
 * Add additional global item for settings
 */
declare global {
  var argocdAssistantSettings: AssistantSettings;
}

/**
 * Styles used for chatbotify component, tried to match styles to
 * Argo CD colors.
 */
const CHAT_STYLES: Styles = {
    chatWindowStyle: {
        width: "100%",
        // TODO: Figure out how to make this 100% without overflowing, using 80vh is a hacky
        // way to fix the overflow problem and possibly could break if users are scaling the UI
        height: "80vh"
    },
    botBubbleStyle: {
        backgroundColor: "#6D7F8B",
        color: "#F8F8FB"
    },
    userBubbleStyle: {
        background: "#00A2B3",
        color: "#ffffff"
    }
}

/**
 * The extension component that is loaded in Argo CD for the ChatBot.
 *
 * @param props The parameters passed by Argo CD when loading.
 */
export const Extension = (props: any) => {

    const [settings] = React.useState<AssistantSettings>(globalThis.argocdAssistantSettings != undefined ? globalThis.argocdAssistantSettings: {provider: Provider.LLAMA_STACK});

    // Form used for guided conversation flow to load logs
    const [provider] = React.useState<QueryProvider>(createProvider(settings.provider as Provider));

    console.log("Using provider: " + settings.provider);

    // Extract the resource and application passed to the extension
    const { resource, application } = props;

    // Configure chatbotify for MarkedDown rendering, we handle it directly
    // using a wrapper since the default one does a poor job
    const pluginConfig = {
        autoConfig: true,
        markdownComponent: MarkedWrapper
    }
    const plugins = [MarkdownRenderer(pluginConfig)];

    // Use the default renderer, doesn't work great IMHO
    //const plugins = [MarkdownRenderer()];

    // Form used for guided conversation flow to load logs
    const [form, setForm] = React.useState({});

    // Used to load events
    const [events, setEvents] = React.useState<Events>({
        apiVersion: "v1",
        items: []
    });

    const containers:string[] = hasLogs(resource) ? getContainers(resource) : [];

    const application_name = application?.metadata?.name || "";
    const resource_name = resource?.metadata?.name || "";
    const resource_kind = resource?.kind || "";

    const currentResourceID = sessionStorage.getItem(RESOURCE_ID_KEY)
    const resourceID = getResourceIdentifier(resource);

    const maxLogLines:number = (argocdAssistantSettings != undefined && argocdAssistantSettings.maximumLogLines != undefined ? argocdAssistantSettings.maximumLogLines : MAX_LINES);

    // If a new resource update caches. This is used to handle
    // how Argo CD reloads extension tab when tab switching on resource view.
    // If it's the same resource that was browsed earlier, keep the caches.
    // If it's a different resource clear the caches.
    if (currentResourceID !== resourceID) {
        sessionStorage.setItem(RESOURCE_ID_KEY, resourceID);
        sessionStorage.removeItem(CHAT_HISTORY_KEY);
        sessionStorage.removeItem(LOGS_KEY);
        sessionStorage.removeItem(CONVERSATION_ID_KEY);
        sessionStorage.removeItem(DATA_KEY);
    }

    // The conversation flow for the chatbot
    const flow:Flow = {
        start: {
            message: (params) => {
                if (!(CHAT_HISTORY_KEY in sessionStorage)) {
                    params.injectMessage("How can I help you with the resource **" +
                                          resource_name +
                                          "** of type " +
                                          resource_kind + "?" +
                                          ( hasLogs(resource) ? " I notice this resource has logs available, to attach one or more container logs type *Attach* at any time.": ""));
                }
            },
            renderMarkdown: ["BOT"],
            path: async (params) => {
                if (isAttachRequest(params.userInput) && hasLogs(resource)) {
                    return "attach"
                } else if (isAttachRequest(params.userInput)) return "no_attach"
                else return "loop"
            }
        } as MarkdownRendererBlock,
        loop: {
            message: async (params) => {

                const attachments: Attachment[] = [];

                if (resource) {
                    attachments.push(
                        {
                            content: JSON.stringify(resource),
                            mimeType: "application/json",
                            type: AttachmentType.MANIFEST
                        }
                    )
                }

                if (events?.items?.length > 0) {
                    attachments.push(
                        {
                            content: JSON.stringify(events),
                            mimeType: "application/json",
                            type: AttachmentType.EVENTS
                        }
                    )
                }

                if (LOGS_KEY in sessionStorage ) {
                    attachments.push(
                        {
                            content: sessionStorage.getItem(LOGS_KEY),
                            mimeType: "application/json",
                            type: AttachmentType.LOG
                        }
                    )
                }

                const conversationID = (CONVERSATION_ID_KEY in sessionStorage ) ? sessionStorage.getItem(CONVERSATION_ID_KEY) : undefined;
                const data = (DATA_KEY in sessionStorage ) ? sessionStorage.getItem(DATA_KEY) : undefined;

                const context = new QueryContextImpl(application, conversationID, data, attachments, settings);

                try {
                    const response: QueryResponse = await provider.query(context, params.userInput, params );
                    if (response.conversationID !== undefined) sessionStorage.setItem(CONVERSATION_ID_KEY, response.conversationID);
                    if (response.data !== undefined) sessionStorage.setItem(DATA_KEY, response.data);
                } catch (error) {
                    return "Unexpected Error: " + error.message + "";
                }

            } ,
            renderMarkdown: ["BOT"],
            path: async (params) => {
                if (isAttachRequest(params.userInput) && hasLogs(resource)) {
                    return "attach"
                } else if (isAttachRequest(params.userInput)) {
                    return "no_attach"
                }
                else return "loop"
            }
        } as MarkdownRendererBlock,
        no_attach: {
            message: "Sorry, logs can only be attached for resources with logs (Deployment, StatefulSet, Pod, etc).",
            path: "loop"
        },
        attach: {
            message: "Select the single container for which to attach the logs:",
            checkboxes: {items: containers, min: 1, max: 1},
            chatDisabled: true,
            function: (params) => setForm({...form, container: params.userInput}),
            path: "ask_lines"
        },
        ask_lines: {
            message: "How many lines of the log did you want to attach (max " + maxLogLines + ")?",
            function: (params) => {
                setForm({...form, lines: params.userInput});
            },
            path: async (params) => {
                if (params.userInput)
                if (isNaN(Number(params.userInput))) {
                    // params.showToast(ErrorMessage({title: "Invalid Input", message: "The number of lines needs to be a valid number"}), TOAST_TIMEOUT);
                    await params.injectMessage("The number of lines needs to be a valid number.");
                    return;
                }
                if (Number(params.userInput) == 0 || Number(params.userInput) > maxLogLines ) {
                    await params.injectMessage("The number of lines needs to be more then 0 and " + maxLogLines + " or less");
                    return;
                }
                if (isCancelRequest(params.userInput)) return "start";
                return "get_logs";
            }
        },
        get_logs: {
            message: async(params) => {
                try {
                    const result:LogEntry[] = await getLogs(application, resource, form["container"], form["lines"]);
                    sessionStorage.setItem(LOGS_KEY, JSON.stringify(result));
                    return "Requested logs have been attached";
                } catch (error) {
                    return "Unexpected error: " + error.message;
                }
            },
            path: "loop"
        }
    }

    // Get Events, this code from Argo CD metrics extension
    // https://github.com/argoproj-labs/argocd-extension-metrics
    React.useEffect(() => {
        let url = `/api/v1/applications/${application_name}/events?resourceUID=${resource.metadata.uid}&resourceNamespace=${resource.metadata.namespace}&resourceName=${resource.metadata.name}`;
        if (resource.kind === "Application") {
          url = `/api/v1/applications/${application_name}/events`;
        }
        fetch(url)
          .then(response => response.json())
          .then(data => {
            setEvents({
                apiVersion: "v1",
                items: data.items
            });
          })
          .catch(err => {
            console.error("res.data", err);
          });
      }, [application, resource, application_name]);

    return (
    <ChatBot plugins={plugins} settings={CHAT_SETTINGS} styles={CHAT_STYLES} flow={flow} />
    );

}

export const component = Extension;

((window: any) => {
    window?.extensionsAPI?.registerResourceExtension(component, '**', '*', 'Assistant', { icon: 'fa-sharp fa-light fa-message fa-lg' });
})(window);
