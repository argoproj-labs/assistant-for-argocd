import MarkdownRenderer, { MarkdownRendererBlock } from "@rcb-plugins/markdown-renderer";
import * as React from "react";
import ChatBot, { Flow } from "react-chatbotify";
import {CHAT_STYLES, chatSettings} from "./util/extensions"
import MarkedWrapper from "./components/MarkedWrapper";
import { isTokenRequest, QueryContextImpl } from "./util/util";
import { ManageStorage } from "./util/storage"
import { ExtensionScope } from "./util/extensions"
import { Attachment, QueryProvider, QueryResponse, AssistantSettings } from "./model/provider";
import { createProvider, Provider } from "./providers/providerFactory";
import { FeatureFlags, isFeatureEnabled } from "./featureFlags";

/**
 * The extension component that is loaded in Argo CD for the ChatBot.
 *
 * @param props The parameters passed by Argo CD when loading.
 */
export const SystemAssistantExtension = (props: any) => {

    console.log("Properties passed to Extension");
    console.log(props);

    const [settings] = React.useState<AssistantSettings>(globalThis.argocdAssistantSettings != undefined ? globalThis.argocdAssistantSettings: {provider: Provider.LLAMA_STACK});

    // Form used for guided conversation flow to load logs
    const [provider] = React.useState<QueryProvider>(createProvider(settings.provider as Provider));

    const storage = new ManageStorage(ExtensionScope.System);

    React.useEffect(() => {
        console.log("Using provider: " + settings.provider);
    }, []);

    // Configure chatbotify for MarkedDown rendering, we handle it directly
    // using a wrapper since the default one does a poor job
    const pluginConfig = {
        autoConfig: true,
        markdownComponent: MarkedWrapper
    }
    const plugins = [MarkdownRenderer(pluginConfig)];

    // Use the default renderer, doesn't work great IMHO
    //const plugins = [MarkdownRenderer()];

    // The conversation flow for the chatbot
    const flow:Flow = {
        start: {
            message: (params) => {
                if (!storage.hasChatHistory()) {
                    params.injectMessage("How can I help you with Argo CD today?");
                }
            },
            renderMarkdown: ["BOT"],
            // TODO: Make this common between start and loop
            path: async (params) => {
                if (isTokenRequest(params.userInput) && isFeatureEnabled(FeatureFlags.ArgoCDMCP)) {
                    return "token"
                } else return "loop"
            }
        } as MarkdownRendererBlock,
        loop: {
            message: async (params) => {

                const attachments: Attachment[] = [];

                const context = new QueryContextImpl(undefined, storage.conversationID, storage.data, attachments, settings);

                try {
                    const response: QueryResponse = await provider.query(context, params.userInput, params );
                    if (!response.success) {
                        if (response.error !== undefined) {
                            return "Unexpected Error: " + response.error.message;
                        } else {
                            return "Unexpected Failure: No additional information provided";
                        }
                    }
                    if (response.conversationID !== undefined) storage.conversationID = response.conversationID;
                    if (response.data !== undefined) storage.data = response.data;
                } catch (error) {
                    return "Unexpected Error: " + error.message + "";
                }

            } ,
            renderMarkdown: ["BOT"],
            path: async (params) => {
                console.log(params.userInput);
                if (isTokenRequest(params.userInput) && isFeatureEnabled(FeatureFlags.ArgoCDMCP)) {
                    return "token"
                } else return "loop"
            }
        } as MarkdownRendererBlock,
        /* This will be removed in the future, currently used to explore MCP */
        token: {
            message: "Please enter your Argo CD token to use with an MCP server",
            function: (params) => {
                storage.mcpToken = params.userInput;
            },
            path: "loop"
        }
    }

    return (
        <ChatBot id="chatbot-system" plugins={plugins} settings={chatSettings(storage.chatHistoryKey)} styles={CHAT_STYLES} flow={flow} />
    );
}
