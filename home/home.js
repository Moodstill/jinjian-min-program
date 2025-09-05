const qrcode = require("weapp-qrcode")
const {
	error,
	hex2arrayBuffer,
	writePromise,
	errcode2Msg,
	log,
	on,
	onBLECharacteristicValueChange
} = require("../util")

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		page: "control",
		devices: [],
		data: {
			// user: {
			// 	deviceId: "22",
			// 	state: 0
			// },
			// openBluetoothAdapter: true,
			openBluetoothAdapter: false,
			user: {},
			devices: [],
			userMap: {},
			setting: {},
			device: {
				dbmRate: 0,
			},
			setting: {
				unlockDistance: 0,
				autoClose: 0,
				inductiveUnlocking: 0,
				silentAntiTheft: 0,
				autoFortify: 0,
				fortify: 0,
				open: 0,
			},
		}
	},
	_setData(value) {
		this.setData({
			data: {
				...this.data.data,
				...value
			}
		})
	},
	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad(options) {
		const windowInfo = wx.getWindowInfo()
		const dpr = windowInfo.windowWidth / 375
		const width = Math.floor(300 * dpr)
		const height = Math.floor(300 * dpr)
		this.setData({
			width,
			height
		})
		const devices = wx.getStorageSync('devices') || []
		const userMap = wx.getStorageSync('userMap') || {}
		this._setData({
			devices,
			userMap,
		})
		wx.authorize({
			scope: 'scope.bluetooth',
			success: () => {
				this.openBluetoothAdapter()
			},
			fail: () => this.requestOpenBluetooth()
		})
		on("user", (user) => {
			clearInterval(this.timerUser)
			this._setData({
				user,
				dialog: false
			})
		})
		on("setting", (setting) => {
			this._setData({
				setting,
			})
			writePromise(1, [])
		})
		onBLECharacteristicValueChange()
	},
	requestOpenBluetooth() {
		wx.showModal({
			title: '提示',
			content: '请开启蓝牙权限',
			confirmText: "开启",
			success: () => this.openSetting()
		})
	},
	openSetting() {
		wx.openSetting({
			success: (res) => {
				if (res.authSetting['scope.bluetooth']) {
					return this.openBluetoothAdapter()
				}
				this.requestOpenBluetooth()
			},
			fail: (e) => {
				wx.showModal({
					title: '提示',
					content: '未打开设置页面，请手动打开设置界面，开启蓝牙权限',
				})
			}
		})
	},
	/**
	 * 生命周期函数--监听页面初次渲染完成
	 */
	onReady() {

	},

	/**
	 * 生命周期函数--监听页面显示
	 */
	onShow() {

	},
	async getPinCode() {
		const pinCode = await writePromise(4, [])
		this._setData({
			dialog: {
				type: "pincode",
				pinCode,
				input: "",
				inputValue: new Array(6).fill("")
			}
		})
	},
	async createQrcode() {
		if (this.qrcode) {
			return this.canvasToTempFilePath()
		}
		const pinCode = await writePromise(4, [])
		if (!pinCode) return wx.showModal({
			content: '配对码获取失败',
		})
		wx.showLoading({
			title: '正在生成',
			mask: true
		})
		const {
			deviceId,
			name
		} = this.data.data.device
		this.text = deviceId + "," + name + "," + pinCode
		// this.text = "aa"
		const {
			width,
			height
		} = this.data
		const ctx = wx.createCanvasContext('qrcode', this)
		qrcode({
			width,
			height,
			x: 0,
			y: 0,
			canvasId: "qrcodeTmp",
			text: this.text,
			callback: () => {
				ctx.fillStyle = "#000"
				ctx.font = "30px/30px Arial"
				ctx.textBaseline = "middle"
				ctx.textAlign = "center"
				ctx.fillText(name, width / 2 + 20, height + 80)
				ctx.draw()
				wx.canvasGetImageData({
					canvasId: 'qrcodeTmp',
					height,
					width,
					x: 0,
					y: 0,
					success: (res) => {
						wx.canvasPutImageData({
							canvasId: "qrcode",
							data: res.data,
							x: 20,
							y: 20,
							width,
							height,
							success: () => {
								wx.hideLoading()
								this.qrcode = true
								this.canvasToTempFilePath()
							},
							fail(res) {
								log(res, "canvasPutImageData")
								wx.hideLoading()
								error(res)
							}
						}, this)
					},
					fail(res) {
						log("canvasGetImageData", res)
						wx.hideLoading()
						error(res)
					}
				}, this)
			}
		})
	},
	canvasToTempFilePath() {
		wx.canvasToTempFilePath({
			canvasId: "qrcode",
			success: (res) => {
				wx.previewImage({
					urls: [res.tempFilePath],
				})
			},
			fail(res) {
				log(res, "canvasToTempFilePath")
				error(res)
			}
		})
	},
	async readState() {
		this._setData({
			dialog: {
				type: "loading",
				title: "获取状态"
			}
		})
		writePromise(2, [], true)
		clearInterval(this.timerUser)
		this.timerUser = setInterval(() => {
			writePromise(2, [], true)
		}, 1000)
		// await writePromise(1, [])
	},
	startBluetoothDevicesDiscovery(name) {
		if (this._discoveryStarted) {
			return
		}
		this._discoveryStarted = true
		wx.startBluetoothDevicesDiscovery({
			allowDuplicatesKey: true,
			success: (res) => {
				log('startBluetoothDevicesDiscovery success', res)
				if (!this.data.data.dialog) this._setData({
					dialog: {
						type: "find",
					}
				})
				this.onBluetoothDeviceFound(name)
			},
			fail: (res) => {
				error(res, "startBluetoothDevicesDiscovery")
			}
		})
	},
	stopBluetoothDevicesDiscovery() {
		this._discoveryStarted = false
		wx.stopBluetoothDevicesDiscovery()
	},
	onBluetoothDeviceFound(name) {
		wx.onBluetoothDeviceFound((res) => {
			const foundDevices = [...this.data.devices]
			res.devices.forEach(device => {
				if (!device.name && !device.localName) {
					return
				}
				if (name && device.name === name) return this.createBLEConnection(device.deviceId, name)
				if (!device.name.includes("KEY-JINJIAN")) return
				const idx = foundDevices.findIndex(v => v.deviceId === device.deviceId)
				if (idx === -1) {
					foundDevices.push(device)
				} else {
					foundDevices[idx] = device
				}
			})
			this.setData({
				devices: foundDevices
			})
		})
	},
	async getBluetoothDevices(name) {
		try {
			const result = await wx.getBluetoothDevices()
			log(result)
			if (result && result.devices) {
				if (name) return result.devices.find(val => val.name === name) || true
				this.setData({
					devices: result.devices.filter((val, index, array) => val.name.includes("KEY-JINJIAN") && array.findIndex(v => v.deviceId === val.deviceId) === index)
				})
			}
			return true
		} catch (err) {
			error(err, "getBluetoothDevices")
			return false;
		}
	},
	createBLEConnectionEvent(e) {
		const device = this.data.devices[e.currentTarget.dataset.index]
		this.createBLEConnection(device.deviceId, device.name)
		log(device, "createBLEConnection")
	},
	createBLEConnection(deviceId, name) {
		this.qrcode = false
		const deviceControl = this.selectComponent("#device-control")
		deviceControl.createBLEConnection(deviceId, name)
		this.afterleave()
	},
	async update(e) {
		if (e.detail === "buletooth") {
			const res = await this.getBluetoothDevices()
			if (!res) return
			return this.startBluetoothDevicesDiscovery()
		}
		if (e.detail === "getstate") {
			return this.readState()
		}
		if (e.detail === "pincode") {
			return this.getPinCode()
		}
		if (e.detail === "qrcode") {
			return this.createQrcode()
		}
		this._setData(e.detail)
	},
	afterleave() {
		log("afterleave")
		if (this.data.data.dialog.type === 'find') {
			wx.offBluetoothDeviceFound()
			this.stopBluetoothDevicesDiscovery()
			this.setData({
				devices: []
			})
		} else if (this.data.data.dialog.type === "loading") {
			clearInterval(this.timerUser)
		}
		this._setData({
			dialog: false
		})
		wx.hideKeyboard()
	},
	copyandlink() {
		const {
			name,
			pinCode
		} = this.data.data.dialog
		wx.setClipboardData({
			data: pinCode,
			success: async () => {
				wx.showLoading({
					title: '正在查询',
					mask: true
				})
				const result = await this.getBluetoothDevices(name)
				if (result) {
					if (result === true) this.startBluetoothDevicesDiscovery(name)
					log(result, "copyandlink")
					this.createBLEConnection(result.deviceId, name)
				}
				this.timerOut = clearTimeout(() => {
					wx.hideLoading()
					wx.showToast({
						title: '未找到设备',
						icon: "error"
					})
					this.stopBluetoothDevicesDiscovery()
				}, 5000)
			},
			fail(res) {
				wx.showToast({
					title: res.errMsg,
					icon: "error"
				})
			}
		})
	},
	async sure() {
		let {
			userMap,
			dialog: {
				deviceId,
				input,
				type,
			}
		} = this.data.data
		if (input) {
			if (type === "mark") {
				userMap[deviceId || "self"] = input
				wx.setStorageSync('userMap', userMap)
			} else {
				if (input.length < 6) return wx.showModal({
					title: '错误提示',
					content: '请输入6位配对码',
				})
				wx.showLoading({
					mask: true,
					title: '正在写入',
				})
				await writePromise(0xa4, [...hex2arrayBuffer(Number(input).toString(16)), 0])
				wx.hideLoading()
			}
		}
		this._setData({
			userMap,
			dialog: false,
		})
		wx.hideKeyboard()
	},
	setDialogInput(e) {
		let input = e.detail.value
		let inputValue = ["", "", "", "", "", ""].map((v, index) => input[index] || "")
		this._setData({
			dialog: {
				...this.data.data.dialog,
				input,
				inputValue
			}
		})

	},
	switchTab(e) {
		if (!this.data.data.openBluetoothAdapter || !this.data.data.user.deviceId) return
		this.setData({
			page: e.currentTarget.dataset.page
		})
	},
	/**
	 * 生命周期函数--监听页面隐藏
	 */
	onHide() {

	},
	openBluetoothAdapter() {
		wx.openBluetoothAdapter({
			success: () => {
				this._setData({
					openBluetoothAdapter: true
				})
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
							this._setData({
								openBluetoothAdapter: true
							})
						}
					})
				}
				error(res, "openBluetoothAdapter")
			}
		})
	},
	closeBluetoothAdapter() {
		wx.closeBluetoothAdapter()
		this._setData({
			openBluetoothAdapter: false
		})
	},
	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload() {
		clearInterval(this.timerUser)
	},

	/**
	 * 页面相关事件处理函数--监听用户下拉动作
	 */
	onPullDownRefresh() {

	},

	/**
	 * 页面上拉触底事件的处理函数
	 */
	onReachBottom() {

	},

	/**
	 * 用户点击右上角分享
	 */
	onShareAppMessage() {

	}
})