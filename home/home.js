const qrcode = require("weapp-qrcode-canvas-2d")
const {
	error,
	hex2arrayBuffer,
	writePromise,
	sleep,
	log,
	on,
	onBLECharacteristicValueChange,
	openBluetooth,
	isIOS,
} = require("../util")

Page({

	/**
	 * 页面的初始数据
	 */
	data: {
		// page: "setting",
		page: "control",
		devices: [],
		data: {
			myDeviceId: "",
			user: {},
			devices: [],
			userMap: {},
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
	async onLoad(options) {
		this.prevDeviceId = wx.getStorageSync('prevDeviceId')
		const windowInfo = wx.getWindowInfo()
		const dpr = windowInfo.windowWidth / 375
		const width = Math.floor(300 * dpr)
		const height = Math.floor(300 * dpr)
		this.setData({
			width,
			height,
			prevDeviceId: this.prevDeviceId
		})
		const devices = wx.getStorageSync('devices') || []
		const userMap = wx.getStorageSync('userMap') || {}
		const myDeviceId = wx.getStorageSync('myDeviceId')
		this._setData({
			devices,
			userMap,
			myDeviceId
		})
		on("pair", (status) => {
			log("pair", status)
			if (status[0] === 0) {
				if (this.pin) return writePromise(0, hex2arrayBuffer(Number(this.pin).toString(16)))
				if (this.isPair) return
				this.isPair = true
				this._setData({
					dialog: {
						type: "pair"
					}
				})
				this.pairer = setTimeout(() => {
					this._setData({
						dialog: false
					})
					this.closeBLEConnection()
				}, 20000)
			} else if (status[1] === 1) {
				this.isPair = false
				clearTimeout(this.pairer)
				this._setData({
					dialog: false
				})
				this.readState()
			} else {
				wx.showToast({
					title: '配对码错误',
					icon: "error"
				})
			}
		})
		on("user", (user) => {
			clearInterval(this.timerUser)
			this._setData({
				user,
				myDeviceId: user.deviceId,
				readStateIng: false
			})
			wx.setStorageSync('prevDeviceId', this.data.data.device.deviceId)
			wx.setStorageSync('myDeviceId', user.deviceId)
		})
		on("setting", (setting) => {
			log("setting", setting)
			this._setData({
				setting,
			})
			writePromise(1, [])
		})
		await openBluetooth()
		onBLECharacteristicValueChange()
		if (devices.length) {
			const {
				deviceId,
				name
			} = devices[0]
			this._setData({
				device: {
					deviceId,
					name
				}
			})
			if (isIOS) {
				this.selectComponent("#device-control")?.createBLEConnection(deviceId, name)
			}
		}
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

	async closeBLEConnection(isCloseBluetooth) {
		try {
			await wx.closeBLEConnection({
				deviceId: this.data.data.device.deviceId
			})
			if (isCloseBluetooth && isIOS) {
				return new Promise(reslove => {
					wx.showModal({
						title: '提示',
						content: '请前往系统设置关闭蓝牙连接',
						complete: (res) => {
							if (res.cancel) {

							}

							if (res.confirm) {

							}
							reslove()
						}
					})
				})
			}
		} catch (error) {
			log(error)
		}
		this.selectComponent("#device-control").closeBLEConnection()
		this._setData({
			user: {}
		})
	},
	async createQrcodeBtn() {
		wx.showActionSheet({
			itemList: ["面对面扫码", "保存二维码"],
			success: async (res) => {
				if (res.tapIndex === 0) {
					wx.showModal({
						title: '提示',
						content: '面对面扫码连接需先断开蓝牙连接，是否继续？',
						cancelText: "否",
						confirmText: "是",
						complete: async (res) => {
							if (res.cancel) {

							}

							if (res.confirm) {
								await this.createQrcode()
								await this.closeBLEConnection(true)
								this.setData({
									page: "control"
								})
								this._setData({
									user: {},
									dialog: {
										type: "image",
										url: this.qrcode
									},
									readStateIng: false
								})
							}
						}
					})
				} else if (res.tapIndex === 1) {
					if (!this.qrcode) await this.createQrcode()
					this.save()
				}
			}
		})
	},
	createQrcode() {
		return new Promise(async reslove => {
			wx.showLoading({
				title: '正在生成',
				mask: true
			})
			const pinCode = await writePromise(4, [], true)
			if (!pinCode) {
				wx.hideLoading()
				return wx.showModal({
					content: '配对码获取失败',
				})
			}
			const {
				deviceId,
				name
			} = this.data.data.device
			this.text = name + "," + pinCode
			// this.text = "aa"
			// let name = "as"
			const {
				width,
				height
			} = this.data
			const query = wx.createSelectorQuery().in(this)
			query.select("#qrcodeTmp").node()
			query.select("#qrcode").node()
			query.exec(async res => {
				const qrt = res[0].node,
					qr = res[1].node
				qrt.width = qr.width = width
				qrt.height = height
				qr.height = height * 1.2
				await qrcode({
					width,
					height,
					padding: 20,
					background: "#cecece",
					canvas: qrt,
					text: this.text,
				})
				const ctx = qr.getContext("2d")
				ctx.fillStyle = "#cecece"
				ctx.fillRect(0, 0, width, height * 1.2)
				let image = qrt.createImage()
				await new Promise(reslove2 => {
					image.onload = () => {
						reslove2()
					}
					image.src = qrt.toDataURL()
				})
				ctx.drawImage(image, 0, 0, width, height)
				ctx.fillStyle = "#000"
				ctx.font = "30px/30px Arial"
				ctx.textBaseline = "middle"
				ctx.textAlign = "center"
				ctx.fillText(name, width / 2, height * 1.1)
				wx.hideLoading()
				this.qrcode = qr.toDataURL()
				reslove(this.qrcode)
			})
		})
	},
	save() {
		if (this.saveing) return
		this.saveing = true
		wx.authorize({
			scope: 'scope.writePhotosAlbum',
			success: res => {
				wx.createSelectorQuery().in(this).select("#qrcode").node(res => {
					wx.canvasToTempFilePath({
						canvas: res.node,
						success: res => {
							wx.saveImageToPhotosAlbum({
								filePath: res.tempFilePath,
								success: () => {
									this.saveing = false
									wx.showToast({
										title: '保存成功',
										icon: "success"
									})
								},
								fail: (e) => {
									this.saveing = false

									wx.showToast({
										title: e.errMsg,
										icon: "error"
									})
								}
							})
						},
						fail: () => {
							this.saveing = false
							wx.showToast({
								title: e.errMsg,
								icon: "error"
							})
						}
					})
				}).exec()
			},
			fail: (e) => {
				this.saveing = false
				wx.showModal({
					title: '提示',
					content: '请打开相册写入权限',
					confirmText: "去设置",
					complete: (res) => {
						if (res.cancel) {

						}

						if (res.confirm) {
							wx.openSetting()
						}
					}
				})
			}
		}, this)
	},
	shareQrcode() {
		if (this.saveing) return
		this.saveing = true
		wx.createSelectorQuery().in(this).select("#qrcode").node(res => {
			wx.canvasToTempFilePath({
				canvas: res.node,
				success: res => {
					wx.showShareImageMenu({
						path: res.tempFilePath,
						// needShowEntrance:false,
						success: () => {
							this.saveing = false
							wx.showToast({
								title: '分享成功',
								icon: "success"
							})
						},
						fail: (e) => {
							this.saveing = false
							wx.showToast({
								title: "分享失败",
								icon: "error"
							})
						}
					})
				},
				fail: () => {
					this.saveing = false
					wx.showToast({
						title: e.errMsg,
						icon: "error"
					})
				}
			})
		}).exec()
	},
	async readState() {
		this._setData({
			readStateIng: true
		})
		await sleep(500)
		writePromise(2, [], true)
		clearInterval(this.timerUser)
		this.count = 0
		this.timerUser = setInterval(() => {
			if (this.count > 2) {
				wx.showModal({
					title: '提示',
					content: '获取失败！请重新连接',
					complete: async (res) => {
						if (res.cancel) {

						}

						if (res.confirm) {
							const deviceControl = this.selectComponent("#device-control")
							const {
								deviceId,
								name
							} = this.data.data.device
							await this.closeBLEConnection()
							deviceControl.createBLEConnection(deviceId, name)
						}
					}
				})
				this._setData({
					readStateIng: false
				})
				return clearInterval(this.timerUser)
			}
			this.count++
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
					},
				})
				this.setData({
					prevDeviceId: this.prevDeviceId
				})
				this.onBluetoothDeviceFound(name)
			},
			fail: (res) => {
				this._discoveryStarted = false
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
				if (name && device.name === name) {
					clearTimeout(this.timerOut)
					this.stopBluetoothDevicesDiscovery()
					return this.createBLEConnection(device.deviceId, name)
				}
				if (!device.name.includes("KEY-JINJIAN")) return
				const idx = foundDevices.findIndex(v => v.deviceId === device.deviceId)
				if (idx === -1) {
					foundDevices.push(device)
				} else {
					foundDevices[idx] = device
				}
			})
			this.setData({
				devices: foundDevices,
			})
		})
	},
	async getBluetoothDevices(name) {
		await openBluetooth()
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
	async createBLEConnection(deviceId, name) {
		this.qrcode = false
		const deviceControl = this.selectComponent("#device-control")
		deviceControl.createBLEConnection(deviceId, name)
		this.afterleave()
	},
	async update(e) {
		if (e.detail === "closeBLEConnection") {
			return this.closeBLEConnection(true)
		}
		if (e.detail?.pinCode) {
			return this.pinCodeLink(e.detail)
		}
		if (e.detail === "buletooth") {
			this.prevDeviceId = wx.getStorageSync('prevDeviceId')
			const res = await this.getBluetoothDevices()
			if (!res) return
			return this.startBluetoothDevicesDiscovery()
		}
		if (e.detail?.state) {
			return this.readState()
		}
		if (e.detail === "pincode") {
			return this.getPinCode()
		}
		if (e.detail === "qrcode") {
			return this.createQrcodeBtn()
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
		}
		this._setData({
			dialog: false
		})
		wx.hideKeyboard()
	},
	async pinCodeLink({
		name,
		pinCode
	}) {
		if (this.data.data.user.deviceId) {
			await this.closeBLEConnection()
			this._setData({
				user: {}
			})
		}
		wx.showLoading({
			title: '正在查询',
			mask: true
		})
		this.pin = pinCode
		const result = await this.getBluetoothDevices(name)
		if (result) {
			if (result === true) {
				this.timerOut = setTimeout(() => {
					wx.hideLoading()
					wx.showToast({
						title: '未找到设备',
						icon: "error"
					})
					this.stopBluetoothDevicesDiscovery()
				}, 5000)
				return this.startBluetoothDevicesDiscovery(name)
			}
			log(result, "getBluetoothDevices")
			return this.createBLEConnection(result.deviceId, name)
		}
		wx.hideLoading()
		wx.showToast({
			title: '未找到设备',
			icon: "error"
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
				if (type === "pair") {
					await writePromise(0, hex2arrayBuffer(Number(input).toString(16)))
					return
				}
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
		if (!this.data.data.user.deviceId) return
		this.setData({
			page: e.currentTarget.dataset.page
		})
	},
	/**
	 * 生命周期函数--监听页面隐藏
	 */
	onHide() {},
	closeBluetoothAdapter() {
		return wx.closeBluetoothAdapter()
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