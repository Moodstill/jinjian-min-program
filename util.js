let writePromiseCallback
const _this = {
	device: {},
	error: (res, event) => {
		_this.log(res, event)
		wx.showModal({
			title: '提示',
			content: _this.errcode2Msg[res.errCode] || res.errMsg,
		})
	},
	setDevice(data) {
		_this.device = data
	},
	sleep(time) {
		return new Promise(reslove => {
			setTimeout(() => reslove(), time)
		})
	},
	crc16(data) {
		const uint8Array = new Uint8Array(data)
		const total = uint8Array.reduce((a, b) => a += b, 0)
		return total
	},
	string2buffer(code, data) {
		const buffer = new ArrayBuffer(5 + data.length)
		const dataView = new DataView(buffer)
		dataView.setUint8(0, 0xFA)
		dataView.setUint8(1, code)
		dataView.setUint8(2, data.length)
		for (let i = 0; i < data.length; i++) {
			dataView.setUint8(3 + i, data[i])
		}
		const crc = _this.crc16(buffer.slice(0, 3 + data.length)) & 0xff
		dataView.setUint8(3 + data.length, crc)
		dataView.setUint8(4 + data.length, 0xFE)
		return buffer
	},
	writePromise(code, data, nomsg) {
		let buffer = _this.string2buffer(code, data)
		return new Promise(reslove => {
			writePromiseCallback = reslove
			_this.writeBLECharacteristicValue(buffer)
			_this.timerout = setTimeout(() => {
				clearTimeout(_this.timerout)
				if (!nomsg) wx.showToast({
					title: '操作超时',
					icon: "error",
				})
				reslove()
			}, 1000);
		})
	},
	writeBLECharacteristicValue(value) {
		const {
			deviceId,
			serviceId,
			writeCharacteristicid
		} = _this.device
		_this.log(Array.from(new Uint8Array(value)).map(v => v.toString(16)).join(" "))
		wx.writeBLECharacteristicValue({
			deviceId,
			serviceId,
			characteristicId: writeCharacteristicid,
			value
		})
	},
	hex2arrayBuffer(hexStr) {
		if (hexStr.length % 2 !== 0) {
			hexStr = '0' + hexStr;
		}
		let array = []
		for (let i = 0; i < hexStr.length; i += 2) {
			array.unshift(parseInt(hexStr.substr(i, 2), 16))
		}
		for (let i = array.length; i < 4; i++) {
			array.push(0)
		}
		return array;
	},
	arrayBuffer2hex(arrayBuffer) {
		return (new Int32Array(arrayBuffer))[0].toString().padStart(6, 0);
	},
	onBLECharacteristicValueChange() {
		wx.onBLECharacteristicValueChange((res) => {
			const uint8Array = new Uint8Array(res.value)
			_this.log(Array.from(uint8Array).map(v => v.toString(16)).join(" "))
			let result, _thisCallback
			switch (uint8Array[1]) {
				case 0xa2:
					result = Array.from(uint8Array).slice(3)
					_thisCallback = _this.callbacks.pincode
					_thisCallback = _this.callbacks.writeSetting
					break;
				case 1:
					result = {
						deviceId: Array.from(uint8Array.slice(3, 9)).map(val => val.toString(16)).join(":").toLocaleUpperCase(),
						identity: uint8Array[9],
						state: uint8Array[10]
					}
					_thisCallback = _this.callbacks.user
					break;
				case 5:
					result = {
						deviceId: Array.from(uint8Array.slice(4, 10)).map(val => val.toString(16)).join(":").toLocaleUpperCase(),
						identity: uint8Array[10],
						state: uint8Array[11]
					}
					if (result.deviceId === "FF:FF:FF:FF:FF:FF") {
						result = false
					}
					_thisCallback = _this.callbacks.bindUser
					break;
				case 4:
					result = _this.arrayBuffer2hex(uint8Array.slice(3, 7).buffer)
					_thisCallback = _this.callbacks.pincode
					break;
				case 3:
					result = {}
					let open = uint8Array[3],
						fortify = uint8Array[4],
						site = uint8Array[5]
					if (open) result.open = open === 1 ? 1 : 0
					if (fortify) result.fortify = fortify === 1 ? 1 : 0
					if (site) result.site = site === 1 ? 1 : 0
					_thisCallback = _this.callbacks.control
					break;
				case 2:
					result = {
						inductiveUnlocking: uint8Array[3],
						silentAntiTheft: uint8Array[4],
						unlockDistance: uint8Array[5],
						autoClose: uint8Array[6],
						autoFortify: uint8Array[7],
						open: uint8Array[8],
						fortify: uint8Array[9],
						voltage: parseInt(uint8Array[10].toString(16) + uint8Array[11].toString(16), 16) / 10,
					}
					_thisCallback = _this.callbacks.setting
					break;
				default:
					break;
			}
			if (_thisCallback) _thisCallback(result)
			if (writePromiseCallback) writePromiseCallback(result)
			clearTimeout(_this.timerout)
			writePromiseCallback = null
		})
	},
	log: (...arg) => {
		console.log(...arg)
	},
	callbacks: {},
	emit: (event, data) => {
		_this.callbacks[event](data)
	},
	on: (event, callback) => {
		_this.callbacks[event] = callback
	},
	openBluetooth() {
		return new Promise(reslove => {
			wx.authorize({
				scope: 'scope.bluetooth',
				success: async () => {
					await _this.openBluetoothAdapter()
					reslove()
				},
				fail: (e) => {
					_this.log(e, "authorize bluetooth")
					_this.requestOpenBluetooth()
				}
			})
		})
	},
	isIOS: wx.getDeviceInfo().platform === "ios",
	openBluetoothAdapter() {
		return new Promise(reslove => {
			wx.openBluetoothAdapter({
				success: () => {
					reslove(true)
				},
				fail: (res) => {
					if (res.errCode === 10001) {
						wx.showLoading({
							title: '请开启蓝牙',
							mask: true
						})
						return wx.onBluetoothAdapterStateChange((res) => {
							wx.hideLoading()
							if (res.available) {
								reslove()
							}
						})
					}
					_this.error(res, "openBluetoothAdapter")
				}
			})
		})
	},
	requestOpenBluetooth() {
		wx.showModal({
			title: '提示',
			content: '请开启蓝牙权限',
			confirmText: "开启",
			success: () => _this.openSetting()
		})
	},
	openSetting() {
		wx.openSetting({
			success: (res) => {
				if (res.authSetting['scope.bluetooth']) {
					return
				}
				_this.requestOpenBluetooth()
			},
			fail: (e) => {
				wx.showModal({
					title: '提示',
					content: '未打开设置页面，请手动打开设置界面，开启蓝牙权限',
				})
			}
		})
	},
	errcode2Msg: {
		10000: "未初始化蓝牙适配器",
		10001: "当前蓝牙适配器不可用",
		10002: "没有找到指定设备",
		10003: "连接失败",
		10004: "没有找到指定服务",
		10005: "没有找到指定特征",
		10006: "当前连接已断开",
		10007: "当前特征不支持此操作",
		10008: "其余所有系统上报的异常",
		10009: "Android 系统特有，系统版本低于 4.3 不支持 BLE",
		10012: "连接超时",
		10013: "连接 deviceId 为空或者是格式不正确"
	}
}
module.exports = _this