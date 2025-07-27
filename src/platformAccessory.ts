import type { CharacteristicValue, PlatformAccessory } from 'homebridge';

import type { SwidgetHomebridgePlatform } from './platform.js';
import { SwidgetComponent, SwidgetDeviceType } from './types.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SwidgetPlatformAccessory {

  private readonly device: SwidgetComponent;

  constructor(
    private readonly platform: SwidgetHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    this.device = accessory.context.device;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Swidget')
      .setCharacteristic(this.platform.Characteristic.Model, this.device.hostType)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.device.hostId);

    const uniqueId = `${this.device.componentId} ${this.device.displayName}`;
      
    for (const func of this.device.functions) {
      switch (func) {
      case 'toggle':
        this.platform.log.info('Device Type IF: ', this.device.deviceType);
        if (this.device.deviceType === SwidgetDeviceType.Outlet) {
          const outlet = this.accessory.getService(uniqueId) || 
              this.accessory.addService(this.platform.Service.Outlet, this.device.displayName, uniqueId);
          outlet.setCharacteristic(this.platform.Characteristic.Name, this.device.displayName);
        } else if (this.device.deviceType === SwidgetDeviceType.Switch) {
          const light = this.accessory.getService(uniqueId) || 
              this.accessory.addService(this.platform.Service.Lightbulb, this.device.displayName, uniqueId);
          light.setCharacteristic(this.platform.Characteristic.Name, this.device.displayName);

          // Register handlers for the On/Off Characteristic
          light.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

          if ('level' in this.device.functions) {
            // Handle level with the toggle with the assumption that toggle always included for dimmer lights
            // Register handlers for the Brightness Characteristic
            light.getCharacteristic(this.platform.Characteristic.Brightness)
              .onSet(this.setBrightness.bind(this));

          }
        }
        break;
        
      default:
        // Unsupported function, skip creating Characteristic
        break;
      }
        
      
      
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    if (this.platform.swidgetApi) {
      this.platform.log.debug('TODO: API setOn', value);
    }

    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possible. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.
   * In this case, you may decide not to implement `onGet` handlers, which may speed up
   * the responsiveness of your device in the Home app.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {

    if (this.platform.swidgetApi) {
      await this.platform.swidgetApi.getStatus(this.device.siteId, this.device.deviceId, this.device.componentId);
    }

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return false;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {

    if (this.platform.swidgetApi) {
      this.platform.log.debug('TODO: API setBrightness', value);
    }

    this.platform.log.debug('Set Characteristic Brightness -> ', value);
  }
}
