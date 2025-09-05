const {
	writePromise,
	log
} = require("../util")
const helpContent = [
	`tip：canvas 标签默认宽度300px、高度150px
	tip：同一页面中的 canvas-id 不可重复，如果使用一个已经出现过的 canvas-id，该 canvas 标签对应的画布将被隐藏并不再正常工作
	tip：请注意原生组件使用限制
	tip：开发者工具中默认关闭了 GPU 硬件加速，可在开发者工具的设置中开启“硬件加速”提高 WebGL 的渲染性能
	tip: WebGL 支持通过 getContext('webgl', { alpha: true }) 获取透明背景的画布
	tip: WebGL 暂不支持真机调试，建议使用真机预览
	tip: Canvas 2D（新接口）需要显式设置画布宽高，默认：300*150，最大：1365*1365
	bug: 避免设置过大的宽高，在安卓下会有crash的问题
	tip: iOS 暂不支持 pointer-events
	tip: 在 mac 或 windows 小程序下，若当前组件所在的页面或全局开启了 enablePassiveEvent 配置项，该内置组件可能会出现非预期表现（详情参考 enablePassiveEvent 文档）
	tip: 鸿蒙 OS 下暂不支持外接纹理`
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
	data: {

	},

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
			let autoFortify = e.detail.value === true ? 5 : 0
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