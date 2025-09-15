import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';
import { SwidgetPlatformAccessory } from './platformAccessory.js';
import { SwidgetApiClient } from './api.js';
import { SwidgetComponent } from './types.js';


/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SwidgetHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  public swidgetApi?: SwidgetApiClient;

  constructor(
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    if (!config.bearerToken || !config.refreshToken) {
      this.log.error(`Missing Swidget Bearer Token. 
        Token must be provided in the config from <a href="https://oauth.swidget.com/authorization/v2" target="_blank">Swidget Authorization</a>.`);
      return;
    }
    this.swidgetApi = new SwidgetApiClient(this);

    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });

  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory);
  }

  /**
   * Get all Swidget devices and register them with homebridge
   * Will only register newly discovered devices, otherwise will restore device
   */
  async discoverDevices() {

    try {

      const swidgetComponent: SwidgetComponent[] = await this.swidgetApi?.getComponents() ?? [];
      for (const component of swidgetComponent) {
        this.log.debug(`Adding ${component.name}, ${component.deviceType}, ${component.hostType}`);

        const id = `${component.componentId}${component.hostId}${component.siteId}`;
        const uuid = this.api.hap.uuid.generate(id);

        const existingAccessory = this.accessories.get(uuid);
        if (existingAccessory) {
          // Accessory already exists
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          new SwidgetPlatformAccessory(this, existingAccessory);
        } else {
          // Accessory does not yet exist, so we need to create it
          this.log.info('Adding new accessory:', component.displayName);
          const accessory = new this.api.platformAccessory(component.displayName, uuid);

          // Store data about the accessory which are then used in PlatformAccessory
          accessory.context.device = component;

          // Create the accessory handler for the newly create accessory
          new SwidgetPlatformAccessory(this, accessory);

          // Link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }
        this.discoveredCacheUUIDs.push(uuid);
      }
    } catch (error) {
      this.log.error('Error Retrieving Devices');
    }

    // Removes existing accessories that are no longer present from API call
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }
}
