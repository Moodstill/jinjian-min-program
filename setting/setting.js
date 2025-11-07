// setting/setting.js
Component({

	/**
	 * 组件的属性列表
	 */
	properties: {
		parent: {
			type: Object,
			value: {}
		}
	},
	lifetimes: {
		attached() {

			const {
				height,
			} = wx.getMenuButtonBoundingClientRect()
			this.setData({
				height
			})
		}
	},
	/**
	 * 组件的初始数据
	 */
	data: {
		page: "vehicle",
		// page: "user",
	},

	/**
	 * 组件的方法列表
	 */
	methods: {
		switchTab(e) {
			this.setData({
				page: e.currentTarget.dataset.page
			})
		},
		update(e) {
			if (e.detail?.state) {
				this.setData({
					page: "vehicle"
				})
			}
			this.triggerEvent("update", e.detail)
		}
	}
})