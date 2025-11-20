// import { Params } from "react-chatbotify";

// import { Attachment, QueryContext, QueryProvider, QueryResponse } from "../model/provider";

// import { AgentConfig } from "llama-stack-client/resources/shared";
// import LlamaStackClient from 'llama-stack-client';
// import { TurnCreateParams, TurnResponseEventPayload } from "llama-stack-client/resources/agents/turn";
// import { getModel } from "../util/llamastack";
// import { getMappedHeaders } from "../util/util";
// import { INSTRUCTIONS } from "./const";

// const URL: string = 'https://' + location.host + "/extensions/assistant"

// interface AgentTurnErrorStreamChunk {
//     error: {
//         message: string
//     }
// }

// export class LlamaStackProvider implements QueryProvider {

//     private _model: string;

//     private _client: LlamaStackClient;

//     setContext(context: QueryContext) {

//         // Do nothing, llamastack does not require anything on reset
//         return;
//     }

//     async query(context: QueryContext, prompt:string, params: Params): Promise<QueryResponse> {

//         var agentID: string;
//         var sessionID: string;

//         if (this._client == undefined || context.conversationID == undefined) {

//             this._client = new LlamaStackClient({
//                 baseURL: URL,
//                 defaultHeaders: getMappedHeaders(context.application, true)
//             });

//             if (this._model == undefined) {
//                 this._model = await getModel(this._client, context);
//                 if (this._model == undefined) {
//                     return {success: false, error:{status:404, message:"No models are configured or available in LLamaStack"}};
//                 }
//                 console.log("Using model: " + this._model);
//             }

//             const agentConfig = this.getAgentConfig(this._model);

//             const agent = await this._client.agents.create({ agent_config: agentConfig });
//             agentID = agent.agent_id

//             //Replace `assistant` with resource name longer term
//             const session = await this._client.agents.session.create(agentID, { session_name: 'assistant' });
//             sessionID = session.session_id;
//         } else {
//             sessionID = context.conversationID;
//             agentID = context.data;
//         }

//         const response = await this._client.agents.turn.create(
//             agentID,
//             sessionID,
//             {
//                 stream: true,
//                 documents: context.attachments.map<TurnCreateParams.Document>((item: Attachment) => {
//                     // Workaround application/json mimetype issue
//                     // https://github.com/llamastack/llama-stack/issues/3300
//                     return {content: item.content, mime_type: (item.mimeType === "application/json") ? "text/json": item.mimeType}
//                 }),
//                 messages: [
//                     {
//                         role: 'user',
//                         content: prompt,
//                     },
//                 ],
//             },
//         );

//         let text = "";
//         for await (const chunk of response) {
//             console.log(chunk);
//             if (chunk.event === undefined) {
//                 const error: AgentTurnErrorStreamChunk = (chunk as unknown) as AgentTurnErrorStreamChunk;
//                 console.error(error);
//                 return {success: false, error:{status:500, message: error.error.message}};
//             }
//             switch (chunk.event.payload.event_type) {
//                 case "step_start": {
//                     break;
//                 }
//                 case "step_progress": {
//                     const stepProgress: TurnResponseEventPayload.AgentTurnResponseStepProgressPayload = (chunk.event.payload as TurnResponseEventPayload.AgentTurnResponseStepProgressPayload);

//                     if (stepProgress.delta.type === "text") {
//                         text += stepProgress.delta.text;
//                         await params.streamMessage(text);
//                     }
//                     break;
//                 }
//             }
//         }

//         return {success:true, conversationID: sessionID, data: agentID}
//     }

//     // TODO: This needs to be configurable
//     getAgentConfig(model: string): AgentConfig {

//         return {
//             instructions: INSTRUCTIONS,
//             model: model,
//             name: "Assistant for Argo CD"
//         };
//     }
// }
