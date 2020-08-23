//index.js
//index.js
import Page from '../../components/page/page';
//获取应用实例
const app = getApp()
const dber = require('../../libs/dbjs/dber')

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    list: []
  },
  //事件处理函数  
  bindViewTap: function () {
    wx.previewImage({
      urls: [this.data.userInfo.avatarUrl],
    })
  },
  onLoad: function () {
    // dber.getTestDB()
    // tree.testBinTree()
    // tree.testRBTree()
    this.onMessage("onMessage");
    this.getUserInfo2().then(res => {
      this.setData(res);
      app.udper.connect()
    })
  },
  getUserInfo2: function (e) {
    return new Promise((resolver, reject) => {
      if (app.globalData.userInfo) {
        resolver({
          userInfo: app.globalData.userInfo,
          hasUserInfo: true
        })
      } else if (this.data.canIUse) { // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回     
        // 所以此处加入 callback 以防止这种情况    
        app.userInfoReadyCallback = res => {
          resolver({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      } else {
        // 在没有 open-type=getUserInfo 版本的兼容处理   
        wx.getUserInfo({
          success: res => {
            app.globalData.userInfo = res.userInfo
            resolver({
              userInfo: res.userInfo,
              hasUserInfo: true
            })
          }
        })
      }
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
  onPullDownRefresh(e) {
    this.onRefresh(e);
  },
  onSaveExitState() {
    if (app.udper) {
      app.udper.close()
    }
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
            motto: res.id + "@" + res.IPinfo.address
          })
          this.data.info = {
            [res.id + '']: app.globalData.userInfo
          }
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
  },
  showModal: function (e) {
    this.setData({
      show: e.currentTarget.dataset.target
    })
  },
  hideModal(e) {
    this.setData({
      show: null
    })
  },
  onRefresh(e) {
    let self = this
    wx.showToast({
      title: '加载中....',
      icon: 'loading'
    });
    app.udper.getLocalip(true).then(res => {
      if (res) {
        self.setData({
          motto: res.id + "@" + res.address
        })
      }
    })
    setTimeout(function () {
      wx.stopPullDownRefresh();
      wx.hideToast({
        complete: (res) => { },
      })
    }, 1000)
  },
  onPageEvent: function (e) {
    var self = this
    switch (e.direction) {
      case 'down':
        self.onRefresh(e)
        break;
      case 'up':
        break;
      case 'left':
        this.setData({
          show: null
        })
        break;
      case 'right':
        self.setData({
          show: "modalLeft"
        })
        break;
      default:
        break
    }
  },
})