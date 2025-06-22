
export interface SwidgetComponent {
    id: string;
    name: string;
    displayName: string;
    functions: string[];
    siteId: string;
    deviceId: string;
    hostId: string;
    hostType: string;
    isConnected: boolean;
    room: string;
}
