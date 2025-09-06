export type HealthStatus =  'Healthy' | 'Degraded' | 'Progressing' | 'Unknown' | 'Suspended' | 'Missing';

export interface Health {
    status: HealthStatus;
}

export interface NodeBase {
    group: string;
    kind: string;
    namespace: string;
    name: string;
    uid: string;
}

export interface Node extends NodeBase {
    version: string;
    parentRefs?: Node[];
    resourceVersion: string;
    health: Health;
    createdAt: string;
}

export interface Tree {
    nodes: Node[];
}

export type Events = {
    apiVersion: string,
    items: any[]
}

// Copied from Argo CD UI code
export interface LogEntry {
    content: string;
    timeStamp: string;
    // first field is inferred on the fly and indicates first log line received from backend
    first?: boolean;
    last: boolean;
    timeStampStr: string;
    podName: string;
}
