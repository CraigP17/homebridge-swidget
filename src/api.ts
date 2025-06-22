import axios from 'axios';
import type { SwidgetHomebridgePlatform } from './platform.js';
import type { Logging } from 'homebridge';

export class SwidgetApiClient {

  public log: Logging;
  public bearerToken: string;

  constructor(private platform: SwidgetHomebridgePlatform) {
    this.log = platform.log;
    this.bearerToken = platform.config.bearerToken;
  }
  
  async getDevices(): Promise<string> {
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
      this.log.debug(response.statusText);
      this.log.debug(response.data);


      // Check to see we got a response
      if (!response.data || !response.data.devices) {
        throw new Error('No devices found in Swidget account');
      }
      return response.data.devices;
    } catch (error: unknown) {
      this.log.error(`Unknown error: ${JSON.stringify(error)}`);
      return 'ERROR';
    }
  }
  // Additional methods...
}