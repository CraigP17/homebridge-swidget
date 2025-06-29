
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

export interface SwidgetDevice {
    hostId: string;
    hostType: string;
    siteId: string;
    isConnected: boolean;
    room: string;
    components: {
        id: string;
        name: string;
        displayName: string;
        functions: string[]
    }[]
    name: string;
    displayName: string;
}
