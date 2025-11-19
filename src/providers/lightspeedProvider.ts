import { Params } from "react-chatbotify";
import { Attachment, AttachmentType, QueryContext, QueryProvider, QueryResponse } from "../model/provider";
import {v4 as uuidv4} from 'uuid';
import { INSTRUCTIONS } from "./const";

const URL: string = 'https://' + location.host + "/extensions/assistant/v1/streaming_query"
const ContentType = {
    APPLICATION_JSON: 'application/json',
    APPLICATION_XML: 'application/xml',
    TEXT_PLAIN: 'text/plain',
    TEXT_HTML: 'text/html',
    APPLICATION_FORM_URLENCODED: 'application/x-www-form-urlencoded',
    MULTIPART_FORM_DATA: 'multipart/form-data',
}

enum LightspeedAttachmentType {
    EVENTS = 'event',
    LOG = 'log',
    MANIFEST = 'api object'
}

type LightspeedAttachment = {
    attachment_type: LightspeedAttachmentType,
    content_type: string,
    content: string
}

type LightspeedQueryRequest = {
    attachments?: LightspeedAttachment[],
    conversation_id: string,
    model?: string,
    provider?: string,
    query: string,
    system_prompt: string
}

export class LightspeedProvider implements QueryProvider {

    setContext(context: QueryContext) {
        return;
    }

    async query(context: QueryContext, prompt: string, params: Params): Promise<QueryResponse> {

        const conversationID:string = context.conversationID == undefined ? uuidv4(): context.conversationID;


        const lqr: LightspeedQueryRequest = {
            conversation_id: conversationID,
            attachments: context.attachments.map<LightspeedAttachment>((item: Attachment) => {
                return {
                    content: item.content,
                    content_type: item.mimeType,
                    attachment_type: this.getAttachmentType(item.type)
                }
            }),
            query: prompt,
            system_prompt: INSTRUCTIONS
        }

        if (context.settings.model) {
            lqr.model = context.settings.model;
            lqr.provider = (context.settings.data?.provider ? context.settings.data.provider : undefined);
        }

        const request: RequestInfo = new Request(URL, {
            credentials: 'include',
            method: 'POST',
            headers: this.getHeaders(context.application, true),
            body: JSON.stringify(lqr)
        })

        try {
            const response = await fetch(request);

            if (!response.ok && !response.body) {
                return { success: false, error: { status: response.status, message: "No message received from service" } };
            }

            // Ignore null check here because the if above is handling this
            // @ts-ignore: Object is possibly 'null'.
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            let text = "";

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    break;
                }

                const chunk = decoder.decode(value);
                text += chunk;
                // Process the received chunk (e.g., display it, parse it, etc.)
                await params.streamMessage(text);
            }

            return { success: true, conversationID: conversationID }
        } catch (error) {
            console.error('An error occurred:', error);
            throw error;
        }
    }

    getAttachmentType(type: AttachmentType): LightspeedAttachmentType {
        switch (type) {
            case AttachmentType.EVENTS: return LightspeedAttachmentType.EVENTS;
            case AttachmentType.LOG: return LightspeedAttachmentType.LOG;
            case AttachmentType.MANIFEST: return LightspeedAttachmentType.MANIFEST;
        }
    }

    getHeaders(application: any, streaming: boolean): Headers {

        console.log(application);

        const applicationName = application?.metadata?.name || "";
        const applicationNamespace = application?.metadata?.namespace || "";
        const project = application?.spec?.project || "";

        const headers: Headers = new Headers({
            'Content-Type': ContentType.APPLICATION_JSON,
            'Accept': ContentType.APPLICATION_JSON,
            'Origin': 'https://' + location.host,
            "Argocd-Application-Name": `${applicationNamespace}:${applicationName}`,
            "Argocd-Project-Name": `${project}`,
        });
        if (streaming) {
            // Needed to get golang's reverse proxy that the Argo CD Extension proxy uses to
            // flush immediately.
            // https://github.com/golang/go/issues/41642
            headers.append('Content-Length', '-1');
        }
        return headers;
    }

}
