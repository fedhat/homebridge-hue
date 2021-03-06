// homebridge-hue/lib/HueSensor.js
// (C) 2016, Erik Baauw
//
// Homebridge plugin for Philips Hue.
//
// HueSensor provides support for Philips Hue sensors.
//
// TODO
// - Put the three services for a Hue Motion Sensor, ZLLPresence, ZLLLightLevel. and
//   ZLLTemperature, in a single accessory (using the Zigbee ID without the extension).

"use strict";

// Link this module to HuePlatform.
module.exports = {
  setHomebridge: setHomebridge,
  HueSensor: HueSensor
};

// ===== Homebridge ======================================================================

// Link this module to homebridge.
var Accessory;
var Service;
var Characteristic;
var hueSensorTypes;

function setHomebridge(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  
  // See: http://www.developers.meethue.com/documentation/supported-sensors
  hueSensorTypes = {
    ZGPSwitch: {	// 1.1 - Hue Tap
      Service:		Service.StatefulProgrammableSwitch,
      Characteristic:	Characteristic.ProgrammableSwitchOutputState,
      props:		{ minValue: 0, maxValue: 4, minStep: 1,
      			  perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY] },
      key:		"buttonevent",
      name:		"output state",
      unit:		"",
      homekitValue:	function(v) {return {34: 1, 16: 2, 17: 3, 18: 4}[v];}
    },
    ZLLSwitch: {	// 1.2 - Hue Wireless Dimmer Switch
      Service:		Service.StatefulProgrammableSwitch,
      Characteristic:	Characteristic.ProgrammableSwitchOutputState,
      props:		{ minValue: 0, maxValue: 4, minStep: 1,
      			  perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY] },
      key:		"buttonevent",
      name:		"output state",
      unit:		"",
      // Note that monitoring press and hold events for a Hue Dimmer switch is unreliable
      // due to polling the Hue bridge.  Therefore, we only issue an event for releasing
      // a Hue Dimmer button.
      homekitValue:	function(v) {return {1000: 0, 1001: 0, 1002: 1, 1003: 1,
      					     2000: 0, 2001: 0, 2002: 2, 2003: 2,
      					     3000: 0, 3001: 0, 3002: 3, 3003: 3,
      					     4000: 0, 4001: 0, 4002: 4, 4003: 4}[v];}
    },
    ZLLPresence: {	// 1.3 - Hue Motion Sensor
      Service:		Service.MotionSensor,
      Characteristic:	Characteristic.MotionDetected,
      duplicateid:	true,
      key:		"presence",
      name:		"motion",
      unit:		"",
      homekitValue:	function(v) {return v ? true : false;}      
    },
    ZLLTemperature: {	// 1.4
      Service:		Service.TemperatureSensor,
      Characteristic:	Characteristic.CurrentTemperature,
      duplicateid:	true,
      key:		"temperature",
      name:		"temperature",
      unit:		"˚C",
      homekitValue:	function(v) {return v ? Math.round(v / 10) / 10 : 0;}
    },
    ZLLLightLevel: {	// 2.7
      Service:		Service.LightSensor,
      Characteristic:	Characteristic.CurrentAmbientLightLevel,
      duplicateid:	true,
      key:		"lightlevel",
      name:		"light level",
      unit:		" lux",
      homekitValue:	hkLightLevel
    },
    CLIPSwitch: {	// 2.1
      Service:		Service.StatefulProgrammableSwitch,
      Characteristic:	Characteristic.ProgrammableSwitchOutputState,
      props:		{ minValue: 0, maxValue: 255, minStep: 1,
      			  perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY] },
      key:		"buttonevent",
      name:		"output state",
      unit:		"",
      homekitValue:	function(v) {return v ? v > 255 ? 255 : v < 0 ? 0 : v : 0;}
    },
    CLIPOpenClose: {	// 2.2
      Service:		Service.ContactSensor,
      Characteristic:	Characteristic.ContactSensorState,
      key:		"open",
      name:		"contact",
      unit:		"",
      homekitValue:	function(v) {return v ? 0 : 1;}
    },
    CLIPPresence: {	// 2.3
      Service:		Service.MotionSensor,
      Characteristic:	Characteristic.MotionDetected,
      key:		"presence",
      name:		"motion",
      unit:		"",
      homekitValue:	function(v) {return v ? true : false;}
    },
    CLIPTemperature: {	// 2.4
      Service:		Service.TemperatureSensor,
      Characteristic:	Characteristic.CurrentTemperature,
      key:		"temperature",
      name:		"temperature",
      unit:		"˚C",
      homekitValue:	function(v) {return v ? Math.round(v / 10) / 10 : 0;}
    },
    CLIPHumidity: {	// 2.5
      Service:		Service.HumiditySensor,
      Characteristic:	Characteristic.CurrentRelativeHumidity,
      key:		"humidity",
      name:		"humidity",
      unit:		"%",
      homekitValue:	function(v) {return v ? Math.round(v / 100) : 0;}
    },
    Daylight: {		// 2.6
      Service:		Service.StatefulProgrammableSwitch,
      Characteristic:	Characteristic.ProgrammableSwitchOutputState,
      props:		{ minValue: 0, maxValue: 1, minStep: 1,
      			  perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY] },
      key:		"daylight",
      name:		"output state",
      unit:		"",
      homekitValue:	function(v) {return v ? 1 : 0;}
    },
    CLIPLightLevel: {	// 2.7
      Service:		Service.LightSensor,
      Characteristic:	Characteristic.CurrentAmbientLightLevel,
      key:		"lightlevel",
      name:		"light level",
      unit:		" lux",
      homekitValue:	hkLightLevel
    },
    CLIPGenericFlag: {	// 2.8
      Service:		Service.Switch,
      Characteristic:	Characteristic.On,
      key:		"flag",
      name:		"power",
      unit:		"",
      homekitValue:	function(v) {return v ? 1 : 0;},
      bridgeValue:	function(v) {return v ? true : false;},
      setter:		true
    },
    CLIPGenericStatus: {	// 2.9
      Service:		Service.StatefulProgrammableSwitch,
      Characteristic:	Characteristic.ProgrammableSwitchOutputState,
      props:		{ minValue: 0, maxValue: 255, minStep: 1 },
      key:		"status",
      name:		"output state",
      unit:		"",
      homekitValue:	function(v) {return v > 255 ? 255 : v < 0 ? 0 : v;},
      bridgeValue:	function(v) {return v;},
      setter:		true
    }
  };
}

function hkLightLevel(v) {
  var l = v ? Math.pow(10, (v - 1) / 10000) : 0.0001;
  l = Math.round(l * 10000) / 10000;
  return l > 1000000 ? 1000000 : l < 0.0001 ? 0.0001 : l;
}

// ===== HueSensor =======================================================================

function HueSensor(bridge, id, obj) {
  this.log = bridge.log;
  this.bridge = bridge;
  this.name = obj.name;
  this.type = hueSensorTypes[obj.type];
  this.url = "/sensors/" + id;
  let zigbee = obj.type[0] === "Z";
  this.uuid_base = zigbee ? obj.uniqueid.split("-")[0] : this.bridge.uuid_base + this.url;
  if (this.type.duplicateid) {
    // Include extension for Hue Motion Sensor services, as they share the Zigbee ID. 
    this.uuid_base = obj.uniqueid;
  }
  this.obj = obj;
  this.refresh();

  this.infoService = new Service.AccessoryInformation();
  this.infoService
    .setCharacteristic(Characteristic.Manufacturer, zigbee ? obj.manufacturername : "homebridge-hue")
    .setCharacteristic(Characteristic.Model, zigbee ? obj.modelid : obj.type)
    .setCharacteristic(Characteristic.SerialNumber, this.uuid_base);

  this.service = new this.type.Service(this.name);
  var char = this.service.getCharacteristic(this.type.Characteristic);
  if (this.type.props) {
    char.setProps(this.type.props);
  }
  this.service.setCharacteristic(this.type.Characteristic, this.hk.value)
  char.on("get", function(callback) {callback(null, this.hk.value);}.bind(this));
  if (this.type.setter) {
    char.on("set", this.setValue.bind(this));
  }
  this.service.addOptionalCharacteristic(Characteristic.HueSensorLastUpdated);
  this.service.setCharacteristic(Characteristic.HueSensorLastUpdated, this.hk.lastupdated);
  this.service.getCharacteristic(Characteristic.HueSensorLastUpdated) 
    .on("get", function(callback) {callback(null, this.hk.lastupdated);}.bind(this));
  this.service.addOptionalCharacteristic(Characteristic.StatusActive);
  this.service.setCharacteristic(Characteristic.StatusActive, this.hk.active);
  this.service.getCharacteristic(Characteristic.StatusActive)
    .on("get", function(callback) {callback(null, this.hk.active);}.bind(this));
  if (this.obj.config.battery !== undefined) {
    this.service.addOptionalCharacteristic(Characteristic.BatteryLevel);
    this.service.setCharacteristic(Characteristic.BatteryLevel, this.hk.battery);
    this.service.getCharacteristic(Characteristic.BatteryLevel)
      .on("get", function(callback) {callback(null, this.hk.battery);}.bind(this));
  }
}

HueSensor.prototype.getServices = function() {
  return [this.service, this.infoService];
}

// Translate bridge values to homekit values.
HueSensor.prototype.refresh = function() {
  this.value = this.obj.state[this.type.key];
  this.hk = {};
  this.hk.value = this.type.homekitValue(this.value);
  this.hk.lastupdated = this.obj.state.lastupdated === "none" ? "n/a"
  		        : String(new Date(this.obj.state.lastupdated)).substring(0, 25);
  this.hk.active = (this.obj.config.on && this.obj.config.reachable !== false) ? 1 : 0;
  if (this.obj.config.battery !== undefined) {
    this.hk.battery = this.obj.config.battery ? this.obj.config.battery : 0;
  }
}

// ===== Bridge Events ===================================================================

HueSensor.prototype.heartbeat = function(obj) {
  let old = {
    obj: this.obj,
    value: this.value,
    hk: this.hk
  };
  this.obj = obj;
  this.refresh();
  if (this.type.key === "buttonevent") {
    if (this.obj.state.lastupdated !== old.obj.state.lastupdated && this.hk.value !== 0) {
      this.log.debug("%s: sensor buttonevent %d on %s", this.name,
      		     this.value, this.obj.state.lastupdated);
      this.log.info("%s: set homekit %s from %s to %s on %s", this.name,
      		    this.type.name, old.hk.value, this.hk.value, this.hk.lastupdated);
      if (this.hk.value === old.hk.value) {
        // Homekit triggers fire only when value has changed.
        this.service.setCharacteristic(this.type.Characteristic, 0);
        setTimeout(function() {
          this.service.setCharacteristic(this.type.Characteristic, this.hk.value);
        }.bind(this), 20);
      } else {
        this.service.setCharacteristic(this.type.Characteristic, this.hk.value);
      }
    }
  } else {
    if (this.value !== old.value) {
      this.log.debug("%s: sensor %s changed from %s to %s on %s", this.name,
      		     this.type.key, old.value, this.value, this.obj.state.lastupdated);
    }
    if (this.hk.value !== old.hk.value) {
      this.log.info("%s: set homekit %s from %s%s to %s%s on %s", this.name,
      		    this.type.name, old.hk.value, this.type.unit,
      		    this.hk.value, this.type.unit, this.hk.lastupdated);
      this.service.setCharacteristic(this.type.Characteristic, this.hk.value);
    }
  }
  if (this.obj.state.lastupdated !== old.obj.state.lastupdated) {
    this.service.setCharacteristic(Characteristic.HueSensorLastUpdated,
    				   this.hk.lastupdated);
  }
  if (this.obj.config.on !== old.obj.config.on) {
    this.log.debug("%s: sensor on changed from %s to %s",
    		   this.name, old.obj.config.on, this.obj.config.on);
  }
  if (this.hk.active !== old.hk.active) {
    this.log.info("%s: set homekit status active from %s to %s",
      		    this.name, old.hk.active, this.hk.active);
    this.service.setCharacteristic(Characteristic.StatusActive, this.hk.active);
  }
  if (this.obj.config.battery !== undefined
      && this.obj.config.battery != old.obj.config.battery) {
    this.log.debug("%s: sensor battery changed from %s to %s",
    		   this.name, old.obj.config.battery, this.obj.config.battery);
  }
  if (this.hk.battery !== old.hk.battery) {
    this.log.info("%s: set homekit battery level from %s%% to %s%%",
      		    this.name, old.hk.battery, this.hk.battery);
    this.service.setCharacteristic(Characteristic.BatteryLevel, this.hk.battery);
  }
}

// ===== Homekit Events ==================================================================

HueSensor.prototype.identify = function(callback) {
  this.log.info("%s: identify", this.name);
  if (this.obj.config.alert === undefined) {
    return callback();
  }
  this.bridge.request("put", this.url + "/config", "{\"alert\":\"select\"}")
  .then(function(obj) {
    return callback();
  }.bind(this))
  .catch(function(err) {
    return callback(new Error(err));
  }.bind(this));
}

HueSensor.prototype.setValue = function(value, callback) {
  if (value === this.hk.value) {
    // sensor updated from hue bridge - we're good
    return callback();
  }
  this.log.info("%s: homekit %s changed from %s%s to %s%s", this.name, this.type.name,
  		this.hk.value, this.type.unit, value, this.type.unit);
  this.hk.value = value;
  let newValue = this.type.bridgeValue(value);
  this.bridge.request("put", this.url + "/state",
  		      "{\"" + this.type.key + "\":" + newValue + "}")
  .then(function(obj) {
    this.obj.state[this.type.key] = newValue;
    this.value = newValue;
    return callback();
  }.bind(this))
  .catch(function(err) {
    return callback(new Error(err));
  }.bind(this));
}