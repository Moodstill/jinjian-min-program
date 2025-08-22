const qrcode = require("weapp-qrcode")
Page({
    data: {
        devices: [],
        bindUser: [],
        userMap: {},
        dialog: false,
        readWrite: false,
        user: {},
        // readWrite: {
        //     deviceId: "asd"
        // },
        // myDevices: [{
        //     deviceId: "aa",
        //     name: "123"
        // }],
        setting: {
            unlockDistance: 0,
            autoClose: 0,
            inductiveUnlocking: 0,
            silentAntiTheft: 0,
            autoFortify: 0,
            fortify: 0,
            open: 0,
        },
        openBluetoothAdapter: false
    },
    onLoad() {
        const windowInfo = wx.getWindowInfo()
        const dpr = windowInfo.windowWidth / 375
        const width = 300 * dpr
        const height = 300 * dpr
        this.setData({
            width,
            height
        })
        const devices = wx.getStorageSync('devices') || []
        const bindUser = wx.getStorageSync('bindUser') || []
        const userMap = wx.getStorageSync('userMap') || {}
        this.setData({
            devices,
            userMap,
            bindUser
        })
        this.openBluetoothAdapter()
    },
    onUnload() {
        this.closeBLEConnection()
        this.closeBluetoothAdapter()
    },
    scanCode() {
        wx.scanCode({
            scanType: ['qrCode'],
            success: res => {
                const [deviceId, name] = res.result.split(",")
                this.createBLEConnection(deviceId, name)
            }
        })
    },
    createQrcode() {
        wx.showLoading({
            title: '正在生成',
            mask: true
        })
        const {
            deviceId,
            name
        } = this.data.readWrite
        const {
            width,
            height
        } = this.data
        qrcode({
            width: width - 40,
            height: height - 40,
            x: 20,
            y: 20,
            canvasId: 'qrcode',
            text: deviceId + "," + name,
            // text: "ass",
            callback: () => {
                wx.canvasToTempFilePath({
                    canvasId: "qrcode",
                    success: (res) => {
                        wx.previewImage({
                            urls: [res.tempFilePath],
                        })
                    },
                    complete() {
                        wx.hideLoading()
                    }
                })
            }
        })
    },
    autoClose(e) {
        let autoClose = e.detail.value === true ? 3 : 0
        return this.setData({
            setting: {
                ...this.data.setting,
                autoClose
            }
        })
    },
    autoFortify(e) {
        let autoFortify = e.detail.value === true ? 5 : 0
        this.setData({
            setting: {
                ...this.data.setting,
                autoFortify
            }
        })
    },
    setUser(e) {
        const user = this.data.bindUser[e.currentTarget.dataset.index]
        const {
            deviceId
        } = this.data.user
        if (deviceId === user.deviceId) return
        let name = ["使能", "禁用", "解绑"]
        if (user.state === 0) name.shift(0)
        if (user.state === 1) name.splice(1, 1)
        if (user.state === 2) name.pop()
        let itemList = [...name, "更换车主", "修改备注"]
        wx.showActionSheet({
            alertText: "操作",
            itemList,
            success: async (res) => {
                let _name = itemList[res.tapIndex]
                let state
                switch (_name) {
                    case "使能":
                        state = 0
                        break;
                    case "禁用":
                        state = 1
                        break
                    case "解绑":
                        state = 2
                        break
                    case "更换车主":
                        state = 3
                        break;
                    case "修改备注":
                        this.setData({
                            dialog: {
                                type: "mark",
                                deviceId,
                                input: this.data.userMap[deviceId] || ""
                            }
                        })
                        break;
                    default:
                        break;
                }
                if (state !== undefined) {
                    wx.showLoading({
                        mask: true,
                        title: '正在写入',
                    })
                    if (state === 3) {
                        await this.writePromise(0xa1, [...deviceId.split(":").map(val => parseInt(val, 16)), 1, 0])
                    } else {
                        await this.writePromise(0xa1, [...deviceId.split(":").map(val => parseInt(val, 16)), 0, state])
                    }
                    wx.hideLoading()
                    if (state === 3) {
                        this.closeBLEConnection()
                    } else {
                        this.getDeviceUser()
                    }
                }
            }
        })
    },
    afterleave() {
        this.setData({
            dialog: false
        })
    },
    async sure() {
        let userMap = this.data.userMap
        let {
            deviceId,
            input,
            type
        } = this.data.dialog
        if (input) {
            if (type === "mark") {
                userMap[deviceId] = input
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
                await this.writePromise(0xa4, [...this.hex2arrayBuffer(Number(input).toString(16)), 0])
                wx.hideLoading()
            }
        }
        this.setData({
            dialog: false,
            userMap
        })
    },
    setDialogInput(e) {
        let input = e.detail.value
        this.setData({
            dialog: {
                ...this.data.dialog,
                input
            }
        })

    },
    openBluetoothAdapter() {
        wx.openBluetoothAdapter({
            success: () => {
                this.setData({
                    openBluetoothAdapter: true
                })
            },
            fail: (res) => {
                if (res.errCode === 10001) {
                    wx.showToast({
                        title: '蓝牙未开启',
                        icon: "error"
                    })
                    return wx.onBluetoothAdapterStateChange(function (res) {
                        if (res.available) {
                            this.setData({
                                openBluetoothAdapter: true
                            })
                        }
                    })
                }
                if (res.errCode) {
                    wx.showModal({
                        title: '打开蓝牙失败',
                        content: res.errCode,
                    })
                }
            }
        })
    },
    getBluetoothDevices() {
        wx.getBluetoothDevices({
            success: (res) => {
                let devices = this.data.devices
                devices.push(...res.devices.filter(v => val.deviceId !== v.deviceId))
                this.setData({
                    devices
                })
            },
            fail: (res) => {
                console.log(res)
            }
        })
    },
    getBluetoothAdapterState() {
        wx.getBluetoothAdapterState({
            success: (res) => {
                console.log('getBluetoothAdapterState', res)
                if (res.discovering) {
                    this.onBluetoothDeviceFound()
                } else if (res.available) {
                    this.startBluetoothDevicesDiscovery()
                }
            }
        })
    },
    connection(e) {
        const ds = e.currentTarget.dataset
        const deviceId = ds.deviceId
        const name = ds.name
        this.createBLEConnection(deviceId, name)
    },
    createBLEConnection(deviceId, name) {
        wx.showLoading({
            mask: true,
            title: '正在连接',
        })
        wx.createBLEConnection({
            deviceId,
            success: (res) => {
                const devices = this.data.devices
                let index = devices.findIndex(val => val.deviceId === deviceId)
                if (index > -1) devices.splice(index, 1)
                devices.unshift({
                    deviceId,
                    name
                })
                wx.setStorageSync('devices', devices)
                this.setData({
                    devices
                })
                this.getBLEDeviceServices(deviceId, name)
            },
            fail: (res) => {
                wx.showModal({
                    title: '连接错误',
                    content: res.errMsg,
                    confirmText: "重新连接",
                    complete: (res) => {
                        if (res.confirm) {
                            this.createBLEConnection(deviceId, name)
                        }
                    }
                })
            },
            complete: () => {
                wx.hideLoading()
            }
        })
        wx.onBLEConnectionStateChange((res) => {
            wx.showModal({
                title: '连接错误',
                content: res.errMsg,
            })
        })
    },
    closeBLEConnection() {
        if (!this.data.readWrite) return
        wx.closeBLEConnection({
            deviceId: this.data.readWrite.deviceId
        })
        this.setData({
            readWrite: false,
        })
    },
    getBLEDeviceServices(deviceId, name) {
        wx.getBLEDeviceServices({
            deviceId,
            success: (res) => {
                for (let i = 0; i < res.services.length; i++) {
                    if (res.services[i].isPrimary) {
                        this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid, name)
                        return
                    }
                }
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
                this.setData({
                    readWrite: {
                        readCharacteristicid,
                        writeCharacteristicid,
                        deviceId,
                        serviceId,
                        name
                    }
                })
                wx.notifyBLECharacteristicValueChange({
                    state: true,
                    deviceId,
                    serviceId,
                    characteristicId: readCharacteristicid,
                    success: (res) => {
                        console.log('notifyBLECharacteristicValueChange success', res.errMsg)
                    }
                })
                // 读取账号信息
                wx.showLoading({
                    mask: true,
                    title: '获取车辆信息',
                })
                await this.writePromise(1, [])
                if (this.data.user.identity === 1) {
                    await this.getSetting()
                    wx.hideLoading()
                    this.getDeviceUser()
                } else {
                    wx.hideLoading()
                }
            },
            fail(res) {
                console.error('getBLEDeviceCharacteristics', res)
            }
        })
        this.onBLECharacteristicValueChange()
    },
    // 读取绑定设备
    async getDeviceUser() {
        if (this.data.user.identity === 1) {
            wx.showLoading({
                mask: true,
                title: '获取绑定用户',
            })
            this.setData({
                bindUser: []
            })
            for (let i = 0; i < 9; i++) {
                let user = await this.writePromise(5, [i])
                if (!user) break;
            }
            wx.hideLoading()
        }
    },
    async control(e) {
        const data = e.currentTarget.dataset.control
        wx.showLoading({
            mask: true,
            title: '正在写入',
        })
        const control = await this.writePromise(0x03, Array.from(data))
        wx.hideLoading()
    },
    copy(e) {
        wx.setClipboardData({
            data: e.currentTarget.dataset.value,
            success: () => {
                wx.showToast({
                    title: '复制成功',
                    icon: "success"
                })
            },
            fail: () => {
                wx.showToast({
                    title: '复制失败',
                    icon: "error"
                })
            }
        })
    },
    async getPinCode(e) {
        await this.writePromise(4, [])
        this.setData({
            dialog: {
                type: "pincode",
                input: this.pinCode,
            }
        })
    },
    async getSetting() {
        const setting = await this.writePromise(2, [])
        this.setData({
            setting
        })
    },
    async writeSetting(e) {
        const submitData = e.detail.value
        let {
            inductiveUnlocking,
            silentAntiTheft,
            autoClose,
            autoFortify,
            unlockDistance
        } = {
            ...this.data.setting,
            ...submitData
        }
        silentAntiTheft = silentAntiTheft ? 1 : 0
        inductiveUnlocking = inductiveUnlocking ? 1 : 0
        autoClose = Number(autoClose)
        autoFortify = Number(autoFortify)
        unlockDistance = Number(unlockDistance)
        wx.showLoading({
            title: '正在写入',
            mask: true
        })
        await this.writePromise(0xA2, [inductiveUnlocking, silentAntiTheft, unlockDistance, autoClose, autoFortify])
        wx.hideLoading()
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
        const crc = this.crc16(buffer.slice(0, 3 + data.length)) & 0xff
        dataView.setUint8(3 + data.length, crc)
        dataView.setUint8(4 + data.length, 0xFE)
        return buffer
    },
    writePromise(code, data) {
        let buffer = this.string2buffer(code, data)
        return new Promise(reslove => {
            this.writePromiseCallback = reslove
            this.writeBLECharacteristicValue(buffer)
            this.timerout = setTimeout(() => {
                clearTimeout(this.timerout)
                wx.showToast({
                    title: '操作超时',
                    icon: "error",
                })
            }, 3000);
        })
    },
    writeBLECharacteristicValue(value) {
        const {
            deviceId,
            serviceId,
            writeCharacteristicid
        } = this.data.readWrite
        console.log(writeCharacteristicid, new Uint8Array(value))
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
            console.log(uint8Array)
            let user
            switch (uint8Array[1]) {
                case 1:
                    user = {
                        deviceId: Array.from(uint8Array.slice(3, 9)).map(val => val.toString(16)).join(":"),
                        identity: uint8Array[9],
                        state: uint8Array[10]
                    }
                    this.setData({
                        user
                    })
                    this.writePromiseCallback(user)
                    break;

                case 5:
                    const bindUser = this.data.bindUser
                    user = {
                        deviceId: Array.from(uint8Array.slice(4, 10)).map(val => val.toString(16)).join(":"),
                        identity: uint8Array[10],
                        state: uint8Array[11]
                    }
                    if (user.deviceId === "ff:ff:ff:ff:ff:ff") {
                        this.writePromiseCallback()
                    } else {
                        bindUser.push(user)
                        this.setData({
                            bindUser
                        })
                        this.writePromiseCallback(user)
                    }
                    break;
                case 4:
                    this.pinCode = this.arrayBuffer2hex(uint8Array.slice(3, 7).buffer)
                    this.writePromiseCallback()
                    break;
                case 3:
                    let control = {}
                    let open = uint8Array[3],
                        fortify = uint8Array[4]
                    if (open) control.open = open === 1 ? 1 : 0
                    if (fortify) control.fortify = fortify === 1 ? 1 : 0
                    this.setData({
                        setting: {
                            ...this.data.setting,
                            ...control
                        }
                    })
                    this.writePromiseCallback(control)
                    break;
                case 2:
                    let setting = {
                        inductiveUnlocking: uint8Array[3],
                        silentAntiTheft: uint8Array[4],
                        unlockDistance: uint8Array[5],
                        autoClose: uint8Array[6],
                        autoFortify: uint8Array[7],
                        open: uint8Array[8],
                        fortify: uint8Array[9]
                    }
                    this.writePromiseCallback(setting)
                    break;
                default:
                    this.writePromiseCallback()
                    break;
            }
            clearTimeout(this.timerout)
            this.writePromiseCallback = null
        })
    },
    closeBluetoothAdapter() {
        wx.closeBluetoothAdapter()
        this.setData({
            openBluetoothAdapter: false
        })
    },
})