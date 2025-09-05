const {
	writePromise,
	setDevice,
	onBLECharacteristicValueChange,
	errcode2Msg,
	log
} = require("../util")

// control/control.js
Component({

	/**
	 * 组件的属性列表
	 */
	properties: {
		parent: {
			type: Object,
			value: {}
		},
	},

	/**
	 * 组件的初始数据
	 */
	data: {
		translateX: 0,
		isopening: false
	},
	lifetimes: {
		detached() {
			clearTimeout(this.timer)
		},
		attached() {
			this.query = wx.createSelectorQuery().in(this)
			this.query.select('#dbm3')
				.node((res) => {
					const canvas = res.node
					this.ctx = canvas.getContext('2d')
					const dpr = wx.getWindowInfo().pixelRatio
					canvas.width = 54 * dpr
					canvas.height = 14 * dpr
					this.ctx.scale(dpr, dpr)
					this.ctx.strokeStyle = "#fff"
					this.ctx.lineWidth = 1
					this.ctx.strokeRect(1, 1, 52, 12)
					this.ctx.fillStyle = "#ffffff50"
					for (let i = 0; i < 5; i++) this.ctx.fillRect(i * 10 + 3, 3, 8, 8)
					if (this.data.parent.user.deviceId) {
						this.getDeviceRSSI(this.data.parent.device.deviceId)
						this.getState()
					}
				}).exec()
		},
	},
	pageLifetimes: {
		show() {
			if (this.data.parent.user.deviceId) {
				this.getState()
			}
		}
	},
	observers: {
		"parent.openBluetoothAdapter": function (openBluetoothAdapter) {
			if (openBluetoothAdapter && !this.data.parent.device.deviceId) {
				if (this.data.parent.devices.length) {
					const {
						deviceId,
						name
					} = this.data.parent.devices[0]
					this.triggerEvent("update", {
						device: {
							deviceId,
							name
						}
					})
					this.createBLEConnection(deviceId, name)
				}
			}
		}
	},
	/**
	 * 组件的方法列表
	 */
	methods: {
		remark() {
			this.triggerEvent("update", {
				dialog: {
					type: "mark",
					input: this.data.parent.userMap.self || this.data.parent.device.name || ""
				}
			})
		},
		findBuletooth() {
			if (this.data.parent.user.deviceId) return this.closeBLEConnection()
			this.triggerEvent("update", "buletooth")
		},
		async control(e) {
			if (!this.data.parent.openBluetoothAdapter || this.data.parent.user.state !== 0) return
			const data = e.currentTarget.dataset.control
			if (data[3] === 1) {
				clearTimeout(this.finder)
				this.setData({
					closeTouch: "find"
				})
				this.finder = setTimeout(() => {
					this.setData({
						closeTouch: false
					})
				}, 600);
			}
			const result = await writePromise(0x03, Array.from(data))
			this.triggerEvent("update", {
				setting: {
					...this.data.parent.setting,
					...result
				}
			})
			wx.hideLoading()
		},
		closeTouchStart() {
			this.setData({
				closeTouch: "close"
			})
		},
		closeTouchEnd() {
			this.setData({
				closeTouch: false
			})
		},
		async closeDevice() {
			if (!this.data.parent.openBluetoothAdapter || this.data.parent.user.state !== 0) return
			this.setData({
				isopening: true
			})
			await this.sleep(1000)
			const result = await writePromise(0x03, [2, 0, 0])

			if (result) {
				this.triggerEvent("update", {
					setting: {
						...this.data.parent.setting,
						...result
					}
				})
			}
			this.setData({
				isopening: false
			})
		},
		touchstart(e) {
			if (!this.data.parent.openBluetoothAdapter || this.data.parent.user.state !== 0) return
			this.startX = e.touches[0].clientX
			this.query.select(".touch-control-box").boundingClientRect()
			this.query.select(".touch-control-icon").boundingClientRect()
			this.query.exec((res) => {
				this.max = res[1].width - res[2].width
			})
		},
		touchmove(e) {
			if (!this.data.parent.openBluetoothAdapter || this.data.parent.user.state !== 0) return
			let translateX = e.touches[0].clientX - this.startX
			this.setData({
				translateX: Math.max(Math.min(translateX, this.max), 0)
			})
		},
		sleep(time) {
			return new Promise(reslove => {
				setTimeout(() => reslove(), time)
			})
		},
		async touchend() {
			if (!this.data.parent.openBluetoothAdapter || this.data.parent.user.state !== 0) return
			if (this.data.translateX > this.max / 2) {
				this.setData({
					isopening: true
				})
				const [result] = await Promise.all([writePromise(0x03, [1, 0, 0, 0]), this.sleep(1000)])

				if (result) {
					this.triggerEvent("update", {
						setting: {
							...this.data.parent.setting,
							...result
						}
					})
				}
			}
			this.setData({
				translateX: 0,
				isopening: false
			})
		},
		scanCode() {
			if (!this.data.parent.openBluetoothAdapter) return
			wx.scanCode({
				scanType: ['qrCode'],
				success: res => {
					log("qrcode", res)
					const [deviceId, name, pinCode] = res.result.split(",")
					this.triggerEvent("update", {
						dialog: {
							type: "scanCode",
							name,
							pinCode,
							inputValue: pinCode.split("")
						}
					})
				}
			})
		},
		createBLEConnectionCallback(deviceId, name) {
			const devices = this.data.parent.devices
			let index = devices.findIndex(val => val.deviceId === deviceId)
			if (index > -1) devices.splice(index, 1)
			devices.unshift({
				deviceId,
				name
			})
			wx.setStorageSync('devices', devices)
			this.triggerEvent("update", {
				devices
			})
			this.getBLEDeviceServices(deviceId, name)
		},
		async createBLEConnection(deviceId, name) {
			wx.showLoading({
				mask: true,
				title: '正在连接',
			})
			if (this.data.parent.user.deviceId) await this.closeBLEConnection()
			log(deviceId, 'deviceId')
			wx.createBLEConnection({
				deviceId,
				timeout: 200,
				success: () => {
					this.createBLEConnectionCallback(deviceId, name)
				},
				fail: (res) => {
					log(res, "createBLEConnection")
					wx.hideLoading()
					if (res.errCode === -1) return this.createBLEConnectionCallback(deviceId, name)
					wx.showModal({
						title: '连接错误',
						content: errcode2Msg[res.errCode],
						confirmText: "重新连接",
						complete: (res) => {
							if (res.confirm) {
								this.createBLEConnection(deviceId, name)
							}
						}
					})
				}
			})
			// wx.onBLEConnectionStateChange((res) => {
			// 	log(res, "onBLEConnectionStateChange")
			// })
		},
		async closeBLEConnection() {
			try {
				await wx.closeBLEConnection({
					deviceId: this.data.parent.device.deviceId
				})
			} catch (error) {}
			clearTimeout(this.timer)
			this.triggerEvent("update", {
				user: {}
			})
		},
		getBLEDeviceServices(deviceId, name) {
			wx.getBLEDeviceServices({
				deviceId,
				success: (res) => {
					log(res, "getBLEDeviceServices")
					for (let i = 0; i < res.services.length; i++) {
						if (res.services[i].isPrimary) {
							this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid, name)
							return
						}
					}
				},
				fail: (res) => {
					wx.hideLoading()
					if (res.errCode === -1) return this.getBLEDeviceServices(deviceId, name)
					wx.showModal({
						title: '提示',
						content: errcode2Msg[res.errCode],
						confirmText: "重新连接",
						complete: async (res) => {
							if (res.cancel) {

							}

							if (res.confirm) {
								this.createBLEConnection(deviceId, name)
							}
						}
					})
					log("getBLEDeviceServices", res)
				}
			})
		},
		getBLEDeviceCharacteristics(deviceId, serviceId, name) {
			wx.getBLEDeviceCharacteristics({
				deviceId,
				serviceId,
				success: async (res) => {
					let readCharacteristicid, writeCharacteristicid
					for (let i = 0; i < res.characteristics.length; i++) {
						let item = res.characteristics[i]
						if (item.uuid[7] === "3") {
							writeCharacteristicid = item.uuid
						} else if (item.uuid[7] === "4") {
							readCharacteristicid = item.uuid
						}
					}
					let device = {
						readCharacteristicid,
						writeCharacteristicid,
						deviceId,
						serviceId,
						name
					}
					this.triggerEvent("update", {
						device
					})
					setDevice(device)
					this.getDeviceRSSI(deviceId)
					wx.notifyBLECharacteristicValueChange({
						state: true,
						deviceId,
						serviceId,
						characteristicId: readCharacteristicid,
						success: (res) => {
							log('notifyBLECharacteristicValueChange success', res.errMsg)
						}
					})
					wx.hideLoading()
					this.triggerEvent("update", "getstate")
				},
				fail: (res) => {
					wx.hideLoading()
					if (res.errCode === -1) return this.getBLEDeviceCharacteristics(deviceId, serviceId, name)
					wx.showModal({
						title: '提示',
						content: errcode2Msg[res.errCode],
						confirmText: "重新连接",
						complete: async (res) => {
							if (res.cancel) {

							}

							if (res.confirm) {
								this.createBLEConnection(deviceId, name)
							}
						}
					})
					log("getBLEDeviceCharacteristics", res)
				}
			})
		},
		async getDeviceRSSI(deviceId) {
			clearTimeout(this.timer)
			let result = await wx.getBLEDeviceRSSI({
				deviceId,
			})
			let RSSI = Math.min(-30, Math.max(-100, result.RSSI)) + 100
			let dbmRate = Math.ceil(RSSI / 14)
			this.ctx.clearRect(2, 2, 50, 10)
			this.ctx.fillStyle = "#ffffff50"
			for (let i = 0; i < 5; i++) this.ctx.fillRect(i * 10 + 3, 3, 8, 8)
			this.ctx.fillStyle = dbmRate > 1 ? "orange" : (dbmRate > 3 ? "green" : (dbmRate === 0 ? "gray" : "red"))
			for (let i = 0; i < dbmRate; i++) this.ctx.fillRect(i * 10 + 3, 3, 8, 8)
			this.triggerEvent("update", {
				device: {
					...this.data.parent.device,
					dbmRate,
					dbm: result.RSSI
				}
			})
			this.timer = setTimeout(() => this.getDeviceRSSI(deviceId), 500);
		},
		getState() {
			if (!this.data.parent.openBluetoothAdapter || !this.data.parent.user.deviceId) return
			this.triggerEvent("update", "getstate")
		},
	}
})