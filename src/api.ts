import axios, { AxiosRequestConfig } from 'axios';
import type { Logging } from 'homebridge';
import type { SwidgetHomebridgePlatform } from './platform.js';
import { SwidgetDeviceType, SwidgetComponent } from './types.js';

// API response, used by getComponents()
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

// API response, used by getOnStatus()
interface OnStatusResponse {
  [componentId: string]: {
    toggle: string;
  };
}

// API response, used by getBrightness()
interface BrightnessResponse {
  [componentId: string]: {
    level: number;
  };
}

// API response, used by getTemperature()
interface TemperatureResponse {
  [componentId: string]: {
    temperature: number;
  };
}

// API response, used by getHumidity()
interface HumidityResponse {
  [componentId: string]: {
    humidity: number;
  };
}

export class SwidgetApiClient {

  public log: Logging;
  public bearerToken: string;
  public refreshToken: string;
  private readonly apiUrl = 'https://api.swidget.com/api/v1';

  constructor(private platform: SwidgetHomebridgePlatform) {
    this.log = platform.log;
    this.bearerToken = platform.config.bearerToken;
    this.refreshToken = platform.config.refreshToken;
  }

  async getNewBearerToken(): Promise<number> {
    this.log.debug('[API] getNewBearerToken()');
    try {
      if (!this.bearerToken || !this.refreshToken) {
        throw new Error('Cannot get new token if none found. Please update config.');
      }

      const response = await axios.post(
        'https://oauth.swidget.com/token',
        {
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
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
    retried = false,
  ): Promise<T> {
    if (!this.bearerToken) {
      throw new Error('No Bearer Token found. Please update plugin config');
    }

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
        // If we receive 401 error from API, get new bearer token and retry request
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
    this.log.debug('[API] getComponents()');
    try {

      // Query for all device components
      const data = await this.axiosRequestWrapper<SitesResponse[]>(
        `${this.apiUrl}/sites`,
        'get',
      );

      // Check if response
      if (!data) {
        this.log.warn('No devices returned from API');
        return [];
      }

      // Clean data
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
    this.log.debug(`[API] getOnStatus() for ${componentId}`);
    try {
      // Query API for device component status
      const data = await this.axiosRequestWrapper<OnStatusResponse>(
        `${this.apiUrl}/sites/${siteId}/devices/${deviceId}/${componentId}`,
        'get',
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
    this.log.debug(`[API] toggle() for ${componentId} setting ${value}`);
    try {
      const data = await this.axiosRequestWrapper(
        `${this.apiUrl}/sites/${siteId}/devices/${deviceId}/${componentId}/toggle`,
        'post',
        { 'set': value },
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
    this.log.debug(`[API] getBrightness() for ${componentId}`);
    try {
      // Query API for device brightness
      const data = await this.axiosRequestWrapper<BrightnessResponse>(
        `${this.apiUrl}/sites/${siteId}/devices/${deviceId}/${componentId}`,
        'get',
      );

      // Check if response
      if (!data) {
        this.log.warn('No brightness returned from API');
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
    this.log.debug(`[API] setBrightness() for ${componentId} setting ${value}`);
    try {
      // Request API to set brightness level
      const data = await this.axiosRequestWrapper(
        `${this.apiUrl}/sites/${siteId}/devices/${deviceId}/${componentId}/level`,
        'post',
        { 'set': value },
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
    this.log.debug(`[API] getTemperature() for ${componentId}`);
    try {
      // Query API for device temperature
      const data = await this.axiosRequestWrapper<TemperatureResponse>(
        `${this.apiUrl}/sites/${siteId}/devices/${deviceId}/${componentId}`,
        'get',
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
    this.log.debug(`[API] getHumidity() for ${componentId}`);
    try {
      // Query API for device humidity
      const data = await this.axiosRequestWrapper<HumidityResponse>(
        `${this.apiUrl}/sites/${siteId}/devices/${deviceId}/${componentId}`,
        'get',
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
