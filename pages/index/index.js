//index.js
import Page from '../../components/page/page';
//获取应用实例
const app = getApp()
const udper = app.udper

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    box: {
      size: 'sm',
      top: '200',
      left: '200',
      mode: 'pre',
      template: 'box',
      text: '',
      style: 'width:150px;height:180px;background:rgb(0,0,0,.5)'
    },
    list: []
  },
  //事件处理函数  
  bindViewTap: function () {
    wx.previewImage({
      urls: [this.data.userInfo.avatarUrl],
    })
  },
  onLoad: function () {
    this.onMessage("onMessage");
    this.UdpStat();
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
    console.log("getUserInfo:", e)
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
    let ip = this.data.peerId
    let msg = this.data.msg
    // msg = msg.repeat(1000);
    let fd = udper.open();
    if (ip && msg) {
      let size = udper.sendTo(fd, msg, ip, app.globalData.bport);
    } else {
      wx.showToast({ title: "参数错误！", })
    }
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
        case 'BROAD':
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
    udper.getLocalip(true);
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
  UdpStat() {
    let self = this;
    app.event.on('kudp-stat', this, function (res) {
      // console.log(res);
      self.setData({
        ['box.text']: res
      })
    })
  }
})