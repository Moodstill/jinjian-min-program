const {
	writePromise,
	log
} = require("../util")
const helpContent = [
	`1.在小程序中完成蓝牙配对连接后，请进入到手机系统设置中的蓝牙，检查配对连接情况，如果蓝牙是未连接的状态，请点击蓝牙连接。蓝牙连接成功后，即可开启感应解锁功能；
	
	2.手机连接蓝牙并靠近车辆进入解锁范围即可自动解锁，解锁时请尽减少手机与车辆之间的遮挡(感应解锁只是解除车辆的防盗状态，而不是直接上电)；
	
	3.车辆解锁后，按一下启动锁即可启动车辆，长按启动键2s左右即可关机，双击启动键即可打开鞍座；
	
	4.若解锁遇到问题，建议您尝试重新连接蓝牙，或尝试调节感应距离；`,
	"开启后，车辆在防盗状态下检测到异常移动或震动时不会发出警报声。",
	"可通过选择来调节感应靠近解锁的距离。车辆感应离开的距离无法设置。",
	"开启后，当车辆已下电并且在等待时间内未上电，车辆将自动设防。可通过左右滑动来调节自动设防时间。",
	"开启后，当车辆停稳并在等待时间内未行驶则自动关机。可通过左右滑动来调节关机等待时间。"
]
const _title = [
	"感应解锁",
	"静默防盗",
	"感应距离",
	"自动设防",
	"自动关机"
]
// vehicle/vehicle.js
Component({

	/**
	 * 组件的属性列表
	 */
	properties: {
		setting: {
			type: null,
			value: {}
		},
		user: {
			type: null,
			value: {}
		}
	},

	/**
	 * 组件的初始数据
	 */
	data: {},

	/**
	 * 组件的方法列表
	 */
	methods: {
		share() {
			this.triggerEvent("update", "qrcode")
		},
		pincode() {
			this.triggerEvent("update", "pincode")
		},
		viewHelp(e) {
			const index = e.currentTarget.dataset.index
			this.triggerEvent("update", {
				dialog: {
					type: "help",
					title: _title[index],
					content: helpContent[index]
				}
			})
		},
		async writeSetting(key, value) {
			let {
				inductiveUnlocking,
				silentAntiTheft,
				autoClose,
				autoFortify,
				unlockDistance
			} = {
				...this.data.setting,
				[key]: value
			}
			const result = await writePromise(0xA2, [inductiveUnlocking, silentAntiTheft, unlockDistance, autoClose, autoFortify])
			if (!result) return this.triggerEvent("update", {
				setting: this.data.setting
			})
			const index = ["inductiveUnlocking", "silentAntiTheft", "unlockDistance", "autoClose", "autoFortify"].indexOf(key)
			this.triggerEvent("update", {
				setting: {
					...this.data.setting,
					[key]: result[index]
				}
			})
		},
		silentAntiTheft(e) {
			this.writeSetting("silentAntiTheft", e.detail.value ? 1 : 0)
		},
		inductiveUnlocking(e) {
			this.writeSetting("inductiveUnlocking", e.detail.value ? 1 : 0)
		},
		unlockDistance(e) {
			this.writeSetting("unlockDistance", Number(e.currentTarget.dataset.value))
		},
		autoFortify(e) {
			let autoFortify = e.detail.value === true ? 30 : 0
			if (typeof e.detail.value === 'number') autoFortify = e.detail.value
			this.writeSetting("autoFortify", autoFortify)
		},
		autoClose(e) {
			let autoClose = e.detail.value === true ? 3 : 0
			if (typeof e.detail.value === 'number') autoClose = e.detail.value
			this.writeSetting("autoClose", autoClose)
		}
	}
})