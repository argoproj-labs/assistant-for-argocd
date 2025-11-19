import { Params } from "react-chatbotify";
import { QueryContext, QueryProvider, QueryResponse } from "../model/provider";
import LlamaStackClient from "llama-stack-client";
import { ResponseCreateParamsStreaming } from "llama-stack-client/resources/responses";

import { getModel } from "../util/llamastack";
import { getMappedHeaders } from "../util/util";
import { INSTRUCTIONS } from "./const";

const URL: string = 'https://' + location.host + "/extensions/assistant"

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
        }

        const responseParams: ResponseCreateParamsStreaming = {
            model: this._model,
            instructions: INSTRUCTIONS,
            input: prompt,
            stream: true
        };

        const response = await this._client.responses.create(responseParams);

        const textStream: ReadableStream<string> = response.toReadableStream().pipeThrough(new TextDecoderStream());
        const reader = textStream.getReader();

        let text = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            console.log(value);
            text += value;
            await params.streamMessage(text);
        }

        return {success:true, conversationID: ""}
    }


}
