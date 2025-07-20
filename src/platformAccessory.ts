import type { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';

import type { SwidgetHomebridgePlatform } from './platform.js';
import { SwidgetDeviceType } from './types.js';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SwidgetPlatformAccessory {
  private service: Service;

  constructor(
    private readonly platform: SwidgetHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Swidget')
      .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.hostType)
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.hostId);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    for (const component of this.accessory.context.device.components) {
      this.platform.log.info('ID: ', component.id);
      this.platform.log.info('Name: ', component.displayName);
      this.platform.log.info('Functions: ', component.functions);
      this.platform.log.info('Type: ', this.accessory.context.device.deviceType);  
      for (const func of component.functions) {
        switch (func) {
        case 'toggle':
          if (this.accessory.context.device.deviceType === SwidgetDeviceType.Outlet) {
            const outlet = this.accessory.getService(this.platform.Service.Outlet) || this.accessory.addService(this.platform.Service.Outlet);
            outlet.setCharacteristic(this.platform.Characteristic.Name, component.displayName);
          } else if (this.accessory.context.device.deviceType === SwidgetDeviceType.Switch) {
            const light = this.accessory.getService(this.platform.Service.Lightbulb) || 
                this.accessory.addService(this.platform.Service.Lightbulb);
            light.setCharacteristic(this.platform.Characteristic.Name, component.displayName);

            // Register handlers for the On/Off Characteristic
            light.getCharacteristic(this.platform.Characteristic.On)
              .onSet(this.setOn.bind(this))
              .onGet(this.getOn.bind(this));

            if ('level' in component.functions) {
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

    if (accessory.context.device.CustomService) {
      // This is only required when using Custom Services and Characteristics not support by HomeKit
      this.service = this.accessory.getService(this.platform.CustomServices[accessory.context.device.CustomService]) ||
        this.accessory.addService(this.platform.CustomServices[accessory.context.device.CustomService]);
    } else {
      this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
    }

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.exampleDisplayName);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    
    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same subtype id.)
     */

    // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name')
    //   || this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name')
    //   || this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
    // let motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   // this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
    //   // this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 10000);
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
      this.platform.log.debug('TODO: API getOn');
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
