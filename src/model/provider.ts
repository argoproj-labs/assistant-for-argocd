import { Params } from "react-chatbotify";

/**
 * Settings can be attached to Window object as fake extension for the Argo CD
 * Assistant to utilize. This is a bit of a hack to workaround the lack of a
 * supported way to pass settings to Argo CD Extensions.
 */
export type AssistantSettings = {

    /**
     * The model that is to be used, if omitted the provider should do
     * its best to use a sane default.
     */
    model?: string;

    /**
     * The QueryProvider to use, the chatbot will pass this to the
     * ProviderFactory so the value here must match a provider defined
     * in the factory.
     */
    provider: string;

    /**
     * Provider specific data, can be omitted if none needed.
     */
    data?: any;

    /**
     * The maximum number of lines to allow users to attach. Note
     * that these count against whatever token quota is in place and
     * thus making this too large may result in quota exceeded error
     * messages.
     */
    maximumLogLines?: number;
}

export interface Logs {

    /**
     * The container for the associated logs
     */
    container: string;

    /**
     * Actual logs, this will be in Argo CD's JSON format that its
     * API returns for logs.
     */

    entries: string;
}

export type Events = {
    apiVersion: string,
    items: any[]
}

export enum AttachmentType {
    EVENTS = 0,
    LOG = 1,
    MANIFEST = 2
}

export type Attachment = {
    content: string;
    mimeType: string;
    type: AttachmentType;
}

export interface QueryContext {

    /**
     * The Argo CD Application that this resource belongs to, this passes an
     * Object that is the Kubernetes Application resource.
     */
    get application(): any;

    /**
     * The ID that is used to track this specific conversation. A conversation
     * is scoped to a specific named Argo CD Resource. The provider can modify
     * this as needed.
     */
    get conversationID(): string;

    /**
     * Can be used by the provider to maintain any arbitrary data between
     * queries that needs to be preserved on a reset. Since this is specified
     * as a string since it needs to be serialized.
     */
    get data(): string;

    /**
     * Available attachments (aka Documents) that can be used to provide
     * additional context for the back-end query. Generally the resource manifest and
     * events will always be available. Logs are provided on request as directed by
     * the user.
     */
    get attachments(): Attachment[];

    /**
     * Any settings that were defined.
     */
    get settings(): AssistantSettings;

}

export type QueryError = {
    /**
     * An number that represents the error code, more often then not
     * it will be an HTTP Response code (i.e. 404, 500, etc) but can be
     * provider specific/
     */
    status: number;

    /**
     * The message to display to the user in the chatbot.
     */
    message: string;
}

export type QueryResponse = {
    /**
     * Whether the query succeeded, if it fails return false and
     * set the error with something meaningful for the user.
     */
    success: boolean;

    /**
     * The conversationID used by the provider to track the session,
     * conversation, etc. This is optional to support the case where
     * there is an error and no identifier is available.
     */
    conversationID?: string,

    /**
     * Any additional data for maintaining state that the
     * provider requires.
     */
    data?: string

    /**
     * If an error occurred return it here
     */
    error?: QueryError;
}

/**
 * An implementation of this interface will be instantiated and maintained
 * statefully by the ChatBot. There are two circumstances where the running
 * implementation is rebuilt and the concrete provider needs to be able to handle
 * both cases.

 * 1. When the user accesses a new resource (i.e Clicks on Service resource but was
 * viewing a Deployment for example). In this case a new Provider implementation
 * is created with no state.

 * 2. When the user changes tabs in the UI, i.e. Assistant > Logs > Assistant. In this
 * case Argo CD re-initializes the plugin which means in turn the Chatbot will reinitialize
 * the provider. However the QueryState information will be passed back to the provider
 * so it can pick up where it left off as much as possible.

 * Note for #2 ideally an in-flight conversation would be maintained but that is quite
 * tricky to implement. So for now we opt to forgo to do this.
*/
export interface QueryProvider {

    /**
     * Called when the provider was reset, i.e. tab switch, and the context needs to
     * re-loaded from SessionStorage. While we could just rely on passing it in the
     * query this gives an opportunity to perform any actions it might need to
     * with the back-end provider when this situation occurs.
     *
     * @param context - The current query context
     */
    setContext(context: QueryContext);

    /**
     * Async function invoked when the Chatbot initiates a query on
     * behalf of the user.
     *
     * @param context The current query context
     * @param prompt The user prompt that requires a response
     * @param params The react-chatbotify interface, can be used to stream messages
     *  back and interact with component. @Todo replace this with something more abstract
     */
    query(context: QueryContext, prompt:string, params: Params): Promise<QueryResponse>

}
