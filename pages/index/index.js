//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },
  //事件处理函数  
  bindViewTap: function () {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) { // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回     
      // 所以此处加入 callback 以防止这种情况    
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理   
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
    app.udper.getLocalip().then(res => {
      this.setData({
        motto: res.id + "@" + res.LocalInfo.address
      })
    }).catch(e => {
      console.log(e)
    })
    app.udper.onMessage().then(res => {
      console.log("onMessage", res)
    })
  },
  getUserInfo: function (e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  onPullDownRefresh() {
    wx.showToast({
      title: '加载中....',
      icon: 'loading'
    });
    app.udper.getLocalip().then(res => {
      this.setData({
        motto: res.id + "@" + res.LocalInfo.address
      })
      setTimeout(function () {
        wx.stopPullDownRefresh();
        wx.hideToast({
          complete: (res) => {},
        })
      }, 1000)
    }).catch(e => {
      console.log(e)
    })
  },
})