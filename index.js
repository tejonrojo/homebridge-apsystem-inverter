const axios = require('axios');
const setupCache = require('axios-cache-adapter').setupCache;

var Service, Characteristic;

const DEF_MIN_LUX = 0,
      DEF_MAX_LUX = 10000;

	  const DEF_Watts = "Watts";
	  const DEF_KWH = "Kwh";

const PLUGIN_NAME   = 'homebridge-apsystem-inverter';
const ACCESSORY_NAME = 'APSystemsInverter';

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory(PLUGIN_NAME, ACCESSORY_NAME, APSystemsInverter);
}

/**
 * Setup Cache For Axios to prevent additional requests
 */
const cache = setupCache({
  maxAge: 5 * 1000 //in ms
})

const api = axios.create({
  adapter: cache.adapter,
  timeout: 2000
})


/**
 * Main API request with all data
 *
 * @param {ecuId} ECU id
 */
const getInverterData = async(ecuId) => {
	try {

		let current_datetime = new Date();
		let formatted_date = "" + current_datetime.getFullYear() + (current_datetime.getMonth() + 1)  +current_datetime.getDate() ;
		let params = 'filter=power&ecuId='+ecuId+'&date='+formatted_date;
		console.log(params);
	    return await api({
			method: 'POST', 
			url: 'http://api.apsystemsema.com:8073/apsema/v1/ecu/getPowerInfo',
			data:  params, 
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});
	} catch (error) {
	    console.error(error);
	    return null;
	}
}

/**
 * Gets and returns the accessory's value in the correct format.
 *
 * @param {ecuId} the IP of the inver to be queried by getInverterData
 * @param {inverterDataValue} the JSON key queried with the return value
 * @return {bool} the value for the accessory
 */
const getAccessoryValue = async (ecuId, inverterDataValue) => {

	// To Do: Need to handle if no connection
	const inverterData = await getInverterData(ecuId)

	if(inverterData) {
		if (inverterData.data.code == null || inverterData.data.code != 1 ) {
			return 0
		} else {
			// Return positive value
			let value = 0;
			JSON.parse(inverterData.data.data.time);
			let timestamps = JSON.parse(inverterData.data.data.time);
			let values = JSON.parse(inverterData.data.data.power);
			
			//Watts
			if(inverterDataValue == DEF_Watts )
			{
				value = parseInt(values[values.length-1]);
			}
			//Kwh
			else{
				let kw_total = 0;
				if (values !=null)
				{			
					for(let i = 0; i < values.length; i++) {
						let kw = parseInt(values[i]);
						kw_total= kw_total+ (( kw *0.08345)/1000);
				}
					console.log("KWH Total:"+kw_total+" - "+kw_total.toFixed(2));
					value = parseFloat(kw_total.toFixed(2));
				}
			}
			return value;
		}
	} else {
		// No response inverterData return 0
		return 0
	}
}

class APSystemsInverter {



    constructor(log, config) {
    	this.log = log
    	this.config = config

    	this.service = new Service.LightSensor(this.config.name)

    	this.name = config["name"];
    	this.manufacturer = config["manufacturer"] || "Ap Systems";
	    this.model = config["model"] || "Inverter";
	    this.serial = config["serial"] || "APSystems-inverter";
	    this.ecuId = config["ecuId"];
	    this.inverter_data = config["inverter_data"];
	    this.minLux = config["min_lux"] || DEF_MIN_LUX;
    	this.maxLux = config["max_lux"] || DEF_MAX_LUX;
    }

    getServices () {
    	const informationService = new Service.AccessoryInformation()
        .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
        .setCharacteristic(Characteristic.Model, this.model)
        .setCharacteristic(Characteristic.SerialNumber, this.serial)


        this.service.getCharacteristic(Characteristic.CurrentAmbientLightLevel)
		  .on('get', this.getCurrentAmbientLightLevelHandler.bind(this))
		  .setProps({
			minValue: this.minLux
		  });

	    return [informationService, this.service]
    }

    async getCurrentAmbientLightLevelHandler (callback) {
		let getValue = await getAccessoryValue(this.ecuId, this.inverter_data)

		this.log(`calling getCurrentAmbientLightLevelcHandler`, getValue)

	    callback(null, getValue)
	}
}
