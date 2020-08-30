//index.js
//index.js
import Page from '../../components/page/page';
//获取应用实例
const app = getApp()
const udper = app.udper
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
    })
    udper.connect();
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
    if (udper) {
      udper.offline()
    }
  },
  bindSend: function (e) {
    let id = this.data.peerId
    let ip = this.data.peerIp
    let msg = this.data.msg
    let fd = udper.open()
    udper.sendById(fd, id, msg).then(res => {
      console.log(res)
      udper.close(fd)
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
        case 'SYNCS':
          wx.showToast({
            title: 'online: ' + res.online,
          })
          break;
        case 'LOCAL':
          this.setData({
            motto: res.id + "@" + res.IPinfo.address
          })
          this.data.info = {
            [res.id + '']: app.globalData.userInfo
          }
          break;
        default:
          wx.showToast({
            title: res.message,
          })
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
    udper.getLocalip(true).then(res => {
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