import { FeatureFlags, isFeatureEnabled } from "../featureFlags";
import { ExtensionScope } from "./extensions";

export class ManageStorage {

    // Where the chat is stored in session storage.
    private CHAT_HISTORY_KEY: string;

    // Where the resource namespace-name is stored in session storage. This
    // is used to track the currently viewed resource and is used to
    // either reload the context on a tab switch or discard it when
    // a new resource is viewed.
    private RESOURCE_ID_KEY: string;

    // Where the logs are stored, logs are loaded once and cached. To refresh
    // the logs the user can simply fetch them again. Might make this simpler
    // in the future with a guided conversation.
    private LOGS_KEY: string;

    private CONVERSATION_ID_KEY: string;

    private DATA_KEY: string;

    // Key used to store Argo CD Token that is needed to pass to MCP.
    // Note that this stores the token in the session storage and is
    // not stored securely thus is not intended for production. This
    // will only be enabled when MCP is enabled and is used to explore
    // MCP. Once llama-stack and MCP figure out how to securely handle
    // Auth for MCP this will be replaced by something better.
    private ARGOCD_MCP_TOKEN: string;

    private _scope: ExtensionScope;

    constructor(scope: ExtensionScope) {
        this._scope = scope;
        console.log(this._scope);
        this.CHAT_HISTORY_KEY = `${this.scope}-argocd-assistant-chat-history`;
        this.RESOURCE_ID_KEY = `${this.scope}-argocd-assistant-resource-id`;
        this.LOGS_KEY = `${this.scope}-argocd-assistant-logs`;
        this.CONVERSATION_ID_KEY = `${this.scope}-argocd-assistant-conversation-id`;
        this.DATA_KEY = `${this.scope}-argocd-assistant-data`;
        this.ARGOCD_MCP_TOKEN = `${this.scope}-argocd-mcp-token`;

    }

    public clear() {
        sessionStorage.removeItem(this.RESOURCE_ID_KEY);
        sessionStorage.removeItem(this.CHAT_HISTORY_KEY);
        sessionStorage.removeItem(this.LOGS_KEY);
        sessionStorage.removeItem(this.CONVERSATION_ID_KEY);
        sessionStorage.removeItem(this.DATA_KEY);
        if (isFeatureEnabled(FeatureFlags.ArgoCDMCP)) {
            sessionStorage.removeItem(this.ARGOCD_MCP_TOKEN);
        }
    }

    get scope(): ExtensionScope {
        return this._scope;
    }

    get conversationID(): string | null {
        return sessionStorage.getItem(this.CONVERSATION_ID_KEY);
    }

    set conversationID(value: string) {
        sessionStorage.setItem(this.CONVERSATION_ID_KEY, value);
    }

    public hasConversationID(): boolean {
        return (this.CONVERSATION_ID_KEY in sessionStorage);
    }

    get data(): string | null {
        return sessionStorage.getItem(this.DATA_KEY)
    }

    set data(value: string) {
        sessionStorage.setItem(this.DATA_KEY, value);
    }

    public hasData(): boolean {
        return (this.DATA_KEY in sessionStorage);
    }

    get logs(): string | null {
        return sessionStorage.getItem(this.LOGS_KEY);
    }

    set logs(value: string) {
        sessionStorage.setItem(this.LOGS_KEY, value);
    }

    public hasLogs(): boolean {
        return (this.LOGS_KEY in sessionStorage);
    }

    get resourceID(): string | null {
        return sessionStorage.getItem(this.RESOURCE_ID_KEY);
    }

    set resourceID(value: string) {
        sessionStorage.setItem(this.RESOURCE_ID_KEY, value);
    }

    get mcpToken(): string | null {
        return sessionStorage.getItem(this.ARGOCD_MCP_TOKEN);
    }

    set mcpToken(value: string) {
        sessionStorage.setItem(this.ARGOCD_MCP_TOKEN, value);
    }

    get chatHistoryKey(): string {
        return this.CHAT_HISTORY_KEY;
    }

    public hasChatHistory(): boolean {
        return (this.chatHistoryKey in sessionStorage);
    }
}
