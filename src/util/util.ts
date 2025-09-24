import { marked, Renderer } from "marked";
import { AssistantSettings, Attachment, QueryContext } from "src/model/provider";

export const HttpHeader = {
    CONTENT_TYPE: 'Content-Type',
};

export const Protocol = {
    HTTP: 'http',
    HTTPS: 'https'
}

export const Kinds = {
    POD: 'Pod',
    REPLICA_SET: 'ReplicaSet',
    DEPLOYMENT: 'Deployment',
    STATEFUL_SET: 'StatefulSet',
    JOB: 'Job',
    ROLLOUT: 'Rollout'
}

export const ContentType = {
    APPLICATION_JSON: 'application/json',
    APPLICATION_XML: 'application/xml',
    TEXT_PLAIN: 'text/plain',
    TEXT_HTML: 'text/html',
    APPLICATION_FORM_URLENCODED: 'application/x-www-form-urlencoded',
    MULTIPART_FORM_DATA: 'multipart/form-data',
} as const;

export type Events = {
    apiVersion: string,
    items: any[]
}

export class QueryContextImpl implements QueryContext {
    private _application: any;
    private _conversationID: string;
    private _data: string;
    private _attachments: Attachment[];
    private _settings: AssistantSettings;

    constructor(application: any, conversationID: string, data: string, attachments: Attachment[], settings: AssistantSettings) {
        this._application = application;
        this._conversationID = conversationID;
        this._data = data;
        this._attachments = attachments;
        this._settings = settings;
    }

    get application(): any {
        return this._application;
    }

    get conversationID(): string {
        return this._conversationID;
    }

    get data(): any {
        return this._data;
    }

    get attachments(): Attachment[] {
        return this._attachments;
    }

    get settings(): AssistantSettings {
        return this._settings;
    }
}

// Used to generate a unique identifier for any resource to be used as a key
// for caching
export function getResourceIdentifier(resource: any): string {
    if (resource == undefined) return "Undefined";
    console.log(resource);

    const namespace = resource.metadata.namespace != undefined ? resource.metadata.namespace : "";
    const version = resource.apiVersion != undefined ? resource.apiVersion.replace(/\//g, "-") : "";
    const kind = resource.kind != undefined ? resource.kind : "";

    console.log("Kind:" + kind);

    return version + "-" + kind + "-" + namespace + "-" + resource.metadata.name;
}

// Handle anything that is a pod or has a PodSpec template.
export function getContainers(resource: any): string[] {
    const result: string[] = [];
    if (resource?.kind === Kinds.POD) {
        try {
            resource.spec.containers.forEach((container) => {
                result.push(container.name);
            })
        } catch (error) {
            console.log("getContainers: This is not a pod")
        }
    } else if (resource?.spec?.template?.spec?.containers) {
        try {
            resource.spec.template.spec.containers.forEach((container) => {
                result.push(container.name);
            })
        } catch (error) {
            console.log("getContainers: Invalid pod specification")
        }
    }
    return result;
}

export function isAttachRequest(input: string): boolean {
    if (input === undefined || input === "") return false;
    return input.toUpperCase().localeCompare('ATTACH', undefined, { sensitivity: 'base' }) == 0;
}

export function isCancelRequest(input: string): boolean {
    if (input === undefined || input === "") return false;

    return input.toUpperCase().localeCompare('CANCEL', undefined, { sensitivity: 'base' }) == 0 ||
        input.toUpperCase().localeCompare('QUIT', undefined, { sensitivity: 'base' }) == 0 ||
        input.toUpperCase().localeCompare('EXIT', undefined, { sensitivity: 'base' }) == 0;
}

export function getHeaders(application: any, streaming: boolean): Headers {

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

export function convertToHTML(markdown: string, render: Renderer): string {
    const sanitized = markdown.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    return marked(sanitized, { renderer: render, async: false });
}
