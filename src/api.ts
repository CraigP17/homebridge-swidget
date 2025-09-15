import axios from 'axios';
import type { Logging } from 'homebridge';
import type { SwidgetHomebridgePlatform } from './platform.js';
import { SwidgetDeviceType, SwidgetComponent } from './types.js';


interface SitesResponse {
    siteId: string;
    devices: {
        deviceId: string;
        hostId: string;
        hostType: string;
        isConnected: boolean;
        room: string;
        version: string;
        components: {
            id: string;
            functions?: string[];
            name?: string;
      }[];
    }[];
}

export class SwidgetApiClient {

  public log: Logging;
  public bearerToken: string;
  public refreshToken: string;

  constructor(private platform: SwidgetHomebridgePlatform) {
    this.log = platform.log;
    this.bearerToken = platform.config.bearerToken;
    this.refreshToken = platform.config.refreshToken;
  }

  async getNewBearerToken(): Promise<number> {
    this.log.info("[API] getNewBearerToken()");
    try {
      if (!this.bearerToken || !this.refreshToken) {
        throw new Error('Cannot get new token if none found. Please update config.');
      }

      const response = await axios.post(
        'https://oauth.swidget.com/token',
        {
            refresh_token: this.refreshToken,
            grant_type: 'refresh_token'
        },
        {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000
        }
      );
      if (response?.status === 200 && response.data) {
        this.bearerToken = `Bearer ${response.data.access_token}`;
        return 0;
      } else {
        this.log.error(`Error: Unable to get new bearer token, ${response?.status}`);
        return 1;
      }

    } catch (error) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
      return 1;
    }
  }
  
  async getComponents(): Promise<SwidgetComponent[]> {
    this.log.info("[API] getComponents()");
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }
      // Use the token received to get a device list
      const response = await axios({
        url: 'https://api.swidget.com/api/v1/sites',
        method: 'get',
        headers: {
          'Authorization': this.bearerToken,
        },
        timeout: 30000,
      });
    //   this.log.debug(response.statusText);
    //   this.log.debug(response.data);

      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        return await this.getComponents();
      }
      else if (!response || !response.data) {
        this.log.warn('No devices returned from API');
        return [];
      }
      //   return response.data.flatMap((site: SitesResponse) =>
      //     site.devices.map(device => ({
      //       siteId: site.siteId,
      //       hostId: device.hostId,
      //       hostType: device.hostType,
      //       deviceType: device.hostType === 'host.outlet' ? SwidgetDeviceType.Outlet : SwidgetDeviceType.Switch,
      //       isConnected: device.isConnected,
      //       room: device.room,
      //       deviceId: device.deviceId,
      //       components: device.components.map(component => ({
      //         id: component.id,
      //         name: component.name ?? component.id,
      //         displayName: `${component.name ?? component.id} (${device.room})`,
      //         functions: component.functions ?? [],
      //       })),
      //       name: `${device.room} ${device.hostType === 'host.outlet' ? 'Outlet' : 'Switch'}`,
      //     })),
      //   );

      return response.data.flatMap((site: SitesResponse) =>
        site.devices.flatMap(device =>
          device.components
            .filter(component => component.functions)
            .map(component => ({
              componentId: component.id,
              name: component.name ?? component.id,
              displayName: `${component.name ?? component.id} (${device.room})`,
              functions: component.functions,
              siteId: site.siteId,
              deviceId: device.deviceId,
              deviceType: device.hostType === 'host.outlet' ? SwidgetDeviceType.Outlet : SwidgetDeviceType.Switch,
              hostId: device.hostId,
              hostType: device.hostType,
              room: device.room,
            })),
        ),
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
      return [];
    }
  }
  
  async getStatus(siteId: string, deviceId: string, componentId: string): Promise<boolean> {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }

      const response = await axios({
        url: `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`,
        method: 'get',
        headers: {
          'Authorization': this.bearerToken,
        },
        timeout: 30000,
      });
      this.log.debug(`${deviceId}__${componentId}: ${response.data}`);
  
      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        return await this.getStatus(siteId, deviceId, componentId);
      }
      else if (!response || !response.data) {
        this.log.warn('No status returned from API');
        return false;
      }
      this.log.debug(response.data[componentId]);
      return (response.data[componentId].toggle === 'on') ? true : false;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
      return false;
    }
  }

  async toggle(siteId: string, deviceId: string, componentId: string, value: string) {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }
  
      const response = await axios({
        url: `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}/toggle`,
        method: 'post',
        headers: {
          'Authorization': this.bearerToken,
        },
        data: { 'set': value },
        timeout: 30000,
      });
      this.log.debug(`${deviceId}__${componentId}: ${response.data}`);
    
      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        await this.toggle(siteId, deviceId, componentId, value);
      }
      else if (!response || !response.data) {
        this.log.warn('No status returned from API');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }

    }

  }

  async getBrightness(siteId: string, deviceId: string, componentId: string): Promise<number> {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }

      const response = await axios({
        url: `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`,
        method: 'get',
        headers: {
          'Authorization': this.bearerToken,
        },
        timeout: 30000,
      });
  
      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        return await this.getBrightness(siteId, deviceId, componentId);
      }
      else if (!response || !response.data) {
        this.log.warn('No status returned from API');
        return 0;
      }
      return response.data[componentId].level;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
      return 0;
    }
  }

  async setBrightness(siteId: string, deviceId: string, componentId: string, value: number) {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }
    
      const response = await axios({
        url: `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}/level`,
        method: 'post',
        headers: {
          'Authorization': this.bearerToken,
        },
        data: { 'set': value },
        timeout: 30000,
      });
      this.log.debug(`${deviceId}__${componentId}: ${response.data}`);
      
      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        await this.setBrightness(siteId, deviceId, componentId, value);
      }
      else if (!response || !response.data) {
        this.log.warn('No status returned from API');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
  
    }
  }

  async getTemperature(siteId: string, deviceId: string, componentId: string): Promise<number> {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }

      const response = await axios({
        url: `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`,
        method: 'get',
        headers: {
          'Authorization': this.bearerToken,
        },
        timeout: 30000,
      });
  
      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        return await this.getTemperature(siteId, deviceId, componentId);
      }
      else if (!response || !response.data) {
        this.log.warn('No status returned from API');
        return 0;
      }
      return response.data[componentId].temperature;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
      return 0;
    }
  }

  async getHumidity(siteId: string, deviceId: string, componentId: string): Promise<number> {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }

      const response = await axios({
        url: `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`,
        method: 'get',
        headers: {
          'Authorization': this.bearerToken,
        },
        timeout: 30000,
      });
  
      // Check if response
      if (response?.status === 401) {
        await this.getNewBearerToken();
        return await this.getHumidity(siteId, deviceId, componentId);
      }
      else if (!response || !response.data) {
        this.log.warn('No status returned from API');
        return 0;
      }
      return response.data[componentId].humidity;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.log.error(`Error: ${error.message}`);
      } else {
        this.log.error(`Unexpected error: ${JSON.stringify(error)}`);
      }
      return 0;
    }
  }
}
