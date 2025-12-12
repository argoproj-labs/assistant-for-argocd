import { Params } from "react-chatbotify";
import { QueryContext, QueryProvider, QueryResponse } from "../model/provider";
import LlamaStackClient from "llama-stack-client";
import { ResponseCreateParamsStreaming, ResponseObjectStream } from "llama-stack-client/resources/responses";
import { getModel } from "../util/llamastack";
import { getMappedHeaders } from "../util/util";
import { INSTRUCTIONS } from "./const";
import { Stream } from "llama-stack-client/streaming";
import { FeatureFlags, isFeatureEnabled } from "../featureFlags";

const BASE_ARGO_CD_URL = 'https://' + location.host;
const URL: string = BASE_ARGO_CD_URL + "/extensions/assistant"

// Same as in index.ts, I don't want the provider to reference root code so just
// re-implemented here. Once this feature moves out of experimental I'll look
// at putting this in a common spot.
const ARGOCD_MCP_TOKEN = "argocd-mcp-token";

interface ResponseErrorStreamChunk {
    error: {
        message: string
    }
}

export class LlamaStackV2Provider implements QueryProvider {

    private _model: string = undefined;

    private _client: LlamaStackClient = undefined;

    setContext(context: QueryContext) {

        // Do nothing, llamastack does not require anything on reset
        return;
    }

    async query(context: QueryContext, prompt:string, params: Params): Promise<QueryResponse> {
        if (this._client == undefined || context.conversationID == undefined) {

            this._client = new LlamaStackClient({
                baseURL: URL,
                defaultHeaders: getMappedHeaders(context.application, true)
            });

            if (this._model == undefined) {
                this._model = await getModel(this._client, context);
                if (this._model == undefined) {
                    return {success: false, error:{status:404, message:"No models are configured or available in LLamaStack"}};
                }
                console.log("Using model: " + this._model);
            }

            if (isFeatureEnabled(FeatureFlags.ArgoCDMCP)) {
                this._client.toolgroups.register({
                    provider_id: "model-context-protocol",
                    toolgroup_id: "mcp::argocd",
                    mcp_endpoint: {
                        uri: context.settings.data?.argocdMCPUrl
                    }
                });
            }
        }

        let input = prompt;
        context.attachments.forEach( (attachment) => {
            input += "\n\n[Attachment:" + attachment.mimeType +"]\n" + attachment.content;
        });

        const responseParams: ResponseCreateParamsStreaming = {
            model: this._model,
            instructions: INSTRUCTIONS,
            stream: true,
            input: input,
            tools: []
        };

        if (isFeatureEnabled(FeatureFlags.ArgoCDMCP) && (ARGOCD_MCP_TOKEN in sessionStorage)) {
            responseParams.tools.push(
                {
                    type: "mcp",
                    server_label: "Argo CD MCP",
                    server_url: context.settings.data?.argocdMCPUrl,
                    require_approval: "never",
                    headers: {
                        "x-argocd-api-token": sessionStorage.getItem(ARGOCD_MCP_TOKEN),
                        "x-argocd-base-url": BASE_ARGO_CD_URL
                    }
                }
            );
        }

        responseParams.previous_response_id = context.conversationID;

        /*
         * This is the way to do it once the API actually works in llama-stack
         * See: https://github.com/llamastack/llama-stack/issues/4206
         */

        // let content = [];

        // content.push(
        //     {
        //         "type": "input_text",
        //         "text": "Analyze the letter and provide a summary of the key points.",
        //     }
        // );
        // content.push(
        //     context.attachments.map((item: Attachment) => {
        //         return {type: "input_file", file_data: item.content, filename: getFilename(item)}
        // }));

        // const responseParams: ResponseCreateParamsStreaming = {
        //     model: this._model,
        //     instructions: INSTRUCTIONS,
        //     stream: true,
        //     input: [
        //         {
        //         "role": "user",
        //         "content": content
        //         }
        //     ],
        // };

        const stream: Stream<ResponseObjectStream> = await this._client.responses.create(responseParams);

        let text = '';
        let responseID = '';
        for await (const chunk of stream) {
            console.log(chunk);
            if ("delta" in chunk) {
                text += chunk.delta;
                await params.streamMessage(text);
            }
            if ( ("type" in chunk) && (chunk.type === "response.completed") ) {
                responseID = chunk.response.id;
                console.log("ResponseID: %s", responseID);
            }
            if ( ( "error" in chunk) ) {
                const error: ResponseErrorStreamChunk = (chunk as unknown) as ResponseErrorStreamChunk;
                console.error(error);
                return {success: false, error:{status:500, message: error.error.message}};
            }
        }

        return {success:true, conversationID: responseID};

    }
}
