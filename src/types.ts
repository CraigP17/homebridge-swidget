
export enum SwidgetDeviceType {
    Outlet = 0,
    Switch
}

export interface SwidgetComponent {
    id: string;
    name: string;
    displayName: string;
    functions: string[]
}

export interface SwidgetDevice {
    hostId: string;
    hostType: string;
    deviceType: SwidgetDeviceType;
    siteId: string;
    isConnected: boolean;
    room: string;
    components: SwidgetComponent[];
    name: string;
}
