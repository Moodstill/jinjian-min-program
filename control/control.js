const {
	writePromise,
	setDevice,
	sleep,
	errcode2Msg,
	log,
	openBluetooth,
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
			if (this.data.parent.user.deviceId) this.triggerEvent("update", {
				readStateIng: true
			})
			clearTimeout(this.timer)
		},
		attached() {
			wx.createSelectorQuery().in(this).select('#dbm3')
				.node((res) => {
					const canvas = res.node
					this.ctx = canvas.getContext('2d')
					const dpr = wx.getWindowInfo().pixelRatio
					canvas.width = 54 * dpr
					canvas.height = 14 * dpr
					this.ctx.scale(dpr, dpr)
					this.ctx.strokeStyle = "#000"
					this.ctx.lineWidth = 1
					this.ctx.strokeRect(1, 1, 52, 12)
					this.ctx.fillStyle = "#00000050"
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
		closeBLEConnection() {
			clearTimeout(this.timer)
		},
		findBuletooth() {
			if (this.data.parent.user.deviceId) return this.triggerEvent("update", "closeBLEConnection")
			this.triggerEvent("update", "buletooth")
		},
		async control(e) {
			if (this.data.parent.user.state !== 0) return
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
				}, 1900);
			}
			const result = await writePromise(0x03, Array.from(data))
			this.triggerEvent("update", {
				setting: {
					...this.data.parent.setting,
					...result
				}
			})
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
			if (this.data.parent.user.state !== 0) return
			this.setData({
				isopening: true
			})
			const [result] = await Promise.all([writePromise(0x03, [2, 0, 0]), sleep(1000)])
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
			if (this.data.parent.user.state !== 0) return
			this.startX = e.touches[0].clientX
			const query = wx.createSelectorQuery().in(this)
			query.select(".touch-control-box").boundingClientRect()
			query.select(".touch-control-icon").boundingClientRect()
			query.exec((res) => {
				this.max = res[0].width - res[1].width
			})
		},
		touchmove(e) {
			if (this.data.parent.user.state !== 0) return
			let translateX = e.touches[0].clientX - this.startX
			this.setData({
				translateX: Math.max(Math.min(translateX, this.max), 0)
			})
		},
		async touchend() {
			if (this.data.parent.user.state !== 0) return
			if (this.data.translateX > this.max / 2) {
				this.setData({
					isopening: true
				})
				const [result] = await Promise.all([writePromise(0x03, [1, 0, 0, 0]), sleep(1000)])

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
		async scanCode() {
			await openBluetooth()
			wx.scanCode({
				scanType: ['qrCode'],
				success: res => {
					log("qrcode", res)
					const [name, pinCode] = res.result.split(",")
					this.triggerEvent("update", {
						name,
						pinCode
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
			log(deviceId, 'deviceId')
			try {
				await wx.closeBLEConnection({
					deviceId: this.data.parent.device.deviceId
				})
			} catch (error) {
				log(error)
			}
			wx.createBLEConnection({
				deviceId,
				timeout: 200,
				success: async () => {
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
						device,
					})
					this.triggerEvent("update", {
						state: true
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
		async getDeviceRSSI(deviceId, callback) {
			clearTimeout(this.timer)
			let result = await wx.getBLEDeviceRSSI({
				deviceId,
			})
			let RSSI = Math.min(-30, Math.max(-100, result.RSSI)) + 100
			let dbmRate = Math.ceil(RSSI / 14)
			if (callback) callback(dbmRate)
			this.ctx.clearRect(2, 2, 50, 10)
			this.ctx.fillStyle = "#00000050"
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
			if (!this.data.parent.user.deviceId) return
			this.triggerEvent("update", {
				state: true
			})
		},
	}
})