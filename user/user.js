const {
	writePromise,
	log
} = require("../util");

// user/user.js
Component({

	/**
	 * 组件的属性列表
	 */
	properties: {
		userMap: {
			type: Object,
			value: {}
		},
		device: {
			type: Object,
			value: {}
		}
	},
	lifetimes: {
		attached() {
			this.getDeviceBindUser()
		}
	},
	/**
	 * 组件的初始数据
	 */
	data: {
		bindUser: [],
		identity: {}
	},

	/**
	 * 组件的方法列表
	 */
	methods: {
		// 获取绑定用户
		async getDeviceBindUser() {
			let bindUser = []
			for (let i = 0; i < 9; i++) {
				let user = await writePromise(5, [i])
				if (!user) break;
				if (!user.identity) {
					bindUser.push(user)
				} else {
					this.setData({
						identity: user
					})
				}
			}
			this.setData({
				bindUser
			})
			wx.hideLoading()
		},
		async remark(e) {
			let index = e.currentTarget.dataset.index
			let input, deviceId
			if (index) {
				deviceId = this.data.bindUser[index].deviceId
				input = this.data.userMap[deviceId] || ""
			} else {
				input = this.data.userMap.selfname || this.data.userMap.self || this.data.device.name || ""
				deviceId = "selfname"
			}
			this.triggerEvent("update", {
				dialog: {
					type: "mark",
					input,
					deviceId
				}
			})
		},
		async setDisable(e) {
			const {
				deviceId,
				state
			} = this.data.bindUser[e.currentTarget.dataset.index]
			wx.showLoading({
				mask: true,
				title: '正在写入',
			})
			await writePromise(0xa1, [...deviceId.split(":").map(val => parseInt(val, 16)), 0, state === 0 ? 1 : 0])
			wx.hideLoading()
			this.setData({
				bindUser: this.data.bindUser.map(val => {
					if (val.deviceId === deviceId) val.state = state === 0 ? 1 : 0
					return val
				})
			})
		},
		async setUnBind(e) {
			const {
				deviceId
			} = this.data.bindUser[e.currentTarget.dataset.index]
			wx.showLoading({
				mask: true,
				title: '正在写入',
			})
			await writePromise(0xa1, [...deviceId.split(":").map(val => parseInt(val, 16)), 0, 2])
			wx.hideLoading()
			// this.triggerEvent("update", "unbind")
			this.setData({
				bindUser: this.data.bindUser.filter(val => val.deviceId !== deviceId)
			})
		},
		async setIdentity(e) {
			const {
				deviceId
			} = this.data.bindUser[e.currentTarget.dataset.index]
			wx.showLoading({
				mask: true,
				title: '正在写入',
			})
			await writePromise(0xa1, [...deviceId.split(":").map(val => parseInt(val, 16)), 1, 0])
			wx.hideLoading()
			this.triggerEvent("update", {
				state: true
			})
		}
	}
})