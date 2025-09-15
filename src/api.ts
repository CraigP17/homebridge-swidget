import axios, { AxiosRequestConfig } from 'axios';
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

interface OnStatusResponse {
    [componentId: string]: {
        toggle: string;
    };
}

interface BrightnessResponse {
    [componentId: string]: {
        level: number;
    };
}

interface TemperatureResponse {
    [componentId: string]: {
        temperature: number;
    };
}

interface HumidityResponse {
    [componentId: string]: {
        humidity: number;
    };
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

  async axiosRequestWrapper<T>(
    url: string,
    method: 'get' | 'post',
    data = {},
    retried = false
  ): Promise<T> {

    if (!this.bearerToken) {
        throw new Error('No bearer token available');
    }
    // If we receive 401 error from API, get new bearer token and retry request
    try {
        const config: AxiosRequestConfig = {
            url: url,
            method: method,
            headers: {
              'Authorization': this.bearerToken,
            },
            timeout: 10000,
        };
        if (data && method === 'post') {
          config.data = data;
        }
      const response = await axios(config);

      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 && !retried) {
          const refreshResult = await this.getNewBearerToken();
          if (refreshResult === 0) {
            return this.axiosRequestWrapper<T>(url, method, data, true);
          }
        }
      }
      // Let original api caller handle additional errors
      throw error;
    }
  }
  
  async getComponents(): Promise<SwidgetComponent[]> {
    this.log.info("[API] getComponents()");
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }
      // Use the token received to get a device list
      const data = await this.axiosRequestWrapper<SitesResponse[]>(
        'https://api.swidget.com/api/v1/sites', 
        'get'
      );
      
      // Check if response
      if (!data) {
        this.log.warn('No devices returned from API');
        return [];
      }

      return data.flatMap((site: SitesResponse) =>
        site.devices.flatMap(device =>
          device.components
            .filter(component => component.functions)
            .map(component => (<SwidgetComponent>{
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
  
  async getOnStatus(siteId: string, deviceId: string, componentId: string): Promise<boolean> {
    try {
      if (!this.bearerToken) {
        throw new Error('No Bearer Token found. Please update plugin config');
      }

      const data = await this.axiosRequestWrapper<OnStatusResponse>(
        `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`, 
        'get'
      );
  
      // Check if response
      if (!data) {
        this.log.warn('No status returned from API');
        return false;
      }

      return (data[componentId]?.toggle === 'on') ? true : false;
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

      const data = await this.axiosRequestWrapper(
        `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}/toggle`, 
        'post',
        { 'set': value }
      );
    
      // Check if response
      if (!data) {
        this.log.warn('Unable to toggle device');
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

      const data = await this.axiosRequestWrapper<BrightnessResponse>(
        `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`, 
        'get'
      );
  
      // Check if response
      if (!data) {
        this.log.warn('No status returned from API');
        return 0;
      }
      return data[componentId].level;
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
    
      const data = await this.axiosRequestWrapper(
        `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}/level`, 
        'post',
        { 'set': value }
      );
 
      // Check if response
      if (!data) {
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

      const data = await this.axiosRequestWrapper<TemperatureResponse>(
        `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`, 
        'get'
      );
  
      // Check if response
      if (!data) {
        this.log.warn('No temperature returned from API');
        return 0;
      }
      return data[componentId].temperature;
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

      const data = await this.axiosRequestWrapper<HumidityResponse>(
        `https://api.swidget.com/api/v1/sites/${siteId}/devices/${deviceId}/${componentId}`, 
        'get'
      );
  
      // Check if response
      if (!data) {
        this.log.warn('No status returned from API');
        return 0;
      }
      return data[componentId].humidity;
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
