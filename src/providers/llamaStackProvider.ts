import { Params } from "react-chatbotify";

import { Attachment, QueryContext, QueryProvider, QueryResponse } from "../model/provider";

import { AgentConfig } from "llama-stack-client/resources/shared";
import LlamaStackClient from 'llama-stack-client';
import { TurnCreateParams, TurnResponseEventPayload } from "llama-stack-client/resources/agents/turn";

const URL: string = 'https://' + location.host + "/extensions/assistant"

export class LlamaStackProvider implements QueryProvider {

    private _model: string;

    private _client: LlamaStackClient;

    setContext(context: QueryContext) {

        // Do nothing, llamastack does not require anything on reset
        return;
    }

    async query(context: QueryContext, prompt:string, params: Params): Promise<QueryResponse> {

        var agentID: string;
        var sessionID: string;

        if (this._client == undefined || context.conversationID == undefined) {
            this._client = new LlamaStackClient({
                baseURL: URL,
                defaultHeaders: this.getHeaders(context.application),
            });

            if (this._model == undefined) {
                this._model = await this.getModel(this._client, context);
                if (this._model == undefined) {
                    return {success: false, error:{status:404, message:"No models are configured or available in LLamaStack"}};
                }
            }

            const agentConfig = this.getAgentConfig(this._model);

            const agent = await this._client.agents.create({ agent_config: agentConfig });
            agentID = agent.agent_id

            //Replace `assistant` with resource name longer term
            const session = await this._client.agents.session.create(agentID, { session_name: 'assistant' });
            sessionID = session.session_id;
        } else {
            sessionID = context.conversationID;
            agentID = context.data;
        }

        const response = await this._client.agents.turn.create(
            agentID,
            sessionID,
            {
                stream: true,
                documents: context.attachments.map<TurnCreateParams.Document>((item: Attachment) => {
                    // Workaround application/json mimetype issue
                    // https://github.com/llamastack/llama-stack/issues/3300
                    return {content: item.content, mime_type: (item.mimeType === "application/json") ? "text/json": item.mimeType}
                }),
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            },
        );

        let text = "";
        for await (const chunk of response) {
            switch (chunk.event.payload.event_type) {
                case "step_start": {
                    break;
                }
                case "step_progress": {
                    const stepProgress: TurnResponseEventPayload.AgentTurnResponseStepProgressPayload = (chunk.event.payload as TurnResponseEventPayload.AgentTurnResponseStepProgressPayload);

                    if (stepProgress.delta.type === "text") {
                        text += stepProgress.delta.text;
                        await params.streamMessage(text);
                    }
                    break;
                }
            }
        }

        return {success:true, conversationID: sessionID, data: agentID}
    }

    /**
     * Fetches the model to use, right now defaults based on first
     * available model that llama-stack returns but this needs to be
     * made configurable.
     *
     * @param client llama-stack client
     * @returns
     */
    async getModel(client: LlamaStackClient, context: QueryContext): Promise<string> {

        if (context.settings.model != undefined) return context.settings.model;

        // Simple implementation to use first available model if one wasn't configured
        const availableModels = (await client.models.list())
            .filter((model: any) =>
                model.model_type === 'llm' &&
                !model.identifier.includes('guard') &&
                !model.identifier.includes('405')
            )
            .map((model: any) => model.identifier);

        console.log(availableModels);

        if (availableModels.length === 0) {
            console.log('No available models. Exiting.');
            return undefined;
        } else {
            return availableModels[0];
        }
    }

    // TODO: This needs to be configurable
    getAgentConfig(model: string): AgentConfig {

        return {
            instructions: "\nYou are Argo CD Assistant - an intelligent assistant for question-answering tasks related to the Argo CD GitOps tool and the Kubernetes container orchestration platform.\n\nHere are your instructions:\nYou are Argo CD Assistant, an intelligent assistant and expert on all things Argo CD and Kubernetes. Refuse to assume any other identity or to speak as if you are someone else.\nIf the context of the question is not clear, consider it to be Argo CD.\nNever include URLs in your replies.\nRefuse to answer questions or execute commands not about Kubernetes or Argo CD.\nDo not mention your last update. You have the most recent information on Kubernetes and Argo CD.",
            model: model,
        };
    }


    getHeaders(application: any): Record<string, string> {

        const applicationName = application?.metadata?.name || "";
        const applicationNamespace = application?.metadata?.namespace || "";
        const project = application?.spec?.project || "";

        const headers: Record<string, string> = {
            'Origin': 'https://' + location.host,
            "Argocd-Application-Name": `${applicationNamespace}:${applicationName}`,
            "Argocd-Project-Name": `${project}`,
            // Needed to get golang's reverse proxy that the Argo CD Extension proxy uses to
            // flush immediately.
            // https://github.com/golang/go/issues/41642
            "Content-Length": '-1'
        };

        return headers;
    }

}
