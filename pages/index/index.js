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
    this.onMessage("onMessage");
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
    let res = app.udper.getLocalip()
    this.setData({
      motto: res.id // + "@" + res.address
    })
    setTimeout(function () {
      wx.stopPullDownRefresh();
      wx.hideToast({
        complete: (res) => {},
      })
    }, 1000)

  },
  onSaveExitState() {
    // if (app.udper) {
    //   app.udper.close()
    // }
    console.log("--------------------------")
  },
  bindSend: function (e) {
    let id = this.data.peerId
    let ip = this.data.peerIp
    let msg = this.data.msg
    app.udper.sendById(id, '2', msg).then(res => {
      console.log(res)
    }).catch(e => {
      wx.showToast({
        title: e.err,
      })
    })
  },
  inputId: function (e) {
    this.setData({
      peerId: e.detail.value
    })
  },
  inputMsg: function (e) {
    this.setData({
      msg: e.detail.value
    })
  },
  onMessage: function (etype) {
    app.event.on(etype, this, function (res) {
      console.log("event onMessage:", res)
      let msg_type = res.type
      switch (msg_type) {
        case 0:
          wx.showToast({
            title: 'online: ' + res.online,
          })
          break;
        case 1:
          this.setData({
            motto: res.id // + "@" + res.LocalInfo.address
          })
          break;
        case 2:
          wx.showToast({
            title: res.message,
          })
          break;
        case 3:
          break;
        case 4:
          break;
        case 5:
          break;
        default:
          break;
      }
    })
  }
})