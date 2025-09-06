// import { RequestOptions } from "llama-stack-client/core";
import { AgentConfig } from "llama-stack-client/resources/shared";
import { QueryRequest } from "../model/service";
import LlamaStackClient from 'llama-stack-client';
import { TurnResponseEventPayload } from "llama-stack-client/resources/agents/turn";

export const queryStream = async (query: QueryRequest, application: any, params: any) => {
  const url: string = 'https://' + location.host + "/extensions/assistant"

  const client = new LlamaStackClient({
    baseURL: url,
    defaultHeaders: getHeaders(application),
  });

  // Simple implementation to use first available model, needs to be configurable
  const availableModels = (await client.models.list())
    .filter((model: any) =>
      model.model_type === 'llm' &&
      !model.identifier.includes('guard') &&
      !model.identifier.includes('405')
    )
    .map((model: any) => model.identifier);

  console.log(availableModels);

  const selectedModel = availableModels[0];
  console.log(`Using model: ${selectedModel}`);

  if (availableModels.length === 0) {
    console.log('No available models. Exiting.');
    return;
  }

  const agentConfig = getAgentConfig(selectedModel);

  const agent = await client.agents.create({ agent_config: agentConfig });
  const agentId = agent.agent_id

  //Replace `assistant` with resource name longer term
  const session = await client.agents.session.create(agentId, { session_name: 'assistant' });
  const sessionId = session.session_id;

  const response = await client.agents.turn.create(
    agentId,
    sessionId,
    {
      stream: true,
      messages: [
        {
          role: 'user',
          content: query.query,
        },
      ],
    },
  );

  let text = "";
  //let stepID = "";
  for await (const chunk of response) {
    console.log(chunk);
    switch (chunk.event.payload.event_type) {
      case "step_start": {
        const stepID = chunk.event.payload.step_id;
        console.log("stepID: " + stepID);
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
}

function getAgentConfig(model: string): AgentConfig {

  return {
    instructions: "\nYou are Argo CD Assistant - an intelligent assistant for question-answering tasks related to the Argo CD GitOps tool and the Kubernetes container orchestration platform.\n\nHere are your instructions:\nYou are Argo CD Assistant, an intelligent assistant and expert on all things Argo CD and Kubernetes. Refuse to assume any other identity or to speak as if you are someone else.\nIf the context of the question is not clear, consider it to be Argo CD.\nNever include URLs in your replies.\nRefuse to answer questions or execute commands not about Kubernetes or Argo CD.\nDo not mention your last update. You have the most recent information on Kubernetes and Argo CD.",
    model: model,
  };

}

function getHeaders(application: any): Record<string, string> {

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
