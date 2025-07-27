
export enum SwidgetDeviceType {
    Outlet = 0,
    Switch
}

export interface SwidgetComponent {
    componentId: string,
    name: string,
    displayName: string,
    functions: string[],
    siteId: string,
    deviceId: string,
    deviceType: SwidgetDeviceType,
    hostId: string,
    hostType: string,
    room: string
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
