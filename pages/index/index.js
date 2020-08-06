//index.js
//获取应用实例
const app = getApp()
import {
  randomNum,
  newAb2Str
} from '../../utils/util.js'

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
      console.log(res)
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
      console.log(res)
      this.setData({
        motto: res.id + "@" + res.LocalInfo.address
      })
      wx.stopPullDownRefresh();
    }).catch(e => {
      console.log(e)
    })
  },
  getLocalip: function () {
    let that = this
    that.bport = BPORT
    if (that.udper == null) {
      that.id = randomNum(9999, 99999)
      that.udper = wx.createUDPSocket();
      that.udper.bind(that.bport);
    }
    that.udper.send({
      address: '255.255.255.255',
      port: that.bport,
      message: that.id + ""
    })
    // 广播接收者   
    that.udper.onMessage(function (res) {
      console.log(res)
      let res_message = newAb2Str(res.message)
      console.log(res_message)
      let _id = parseInt(res_message)
      if (that.id == _id) {
        that.LocalInfo = res.remoteInfo
        that.setData({
          motto: that.id + "@" + that.LocalInfo.address
        })
      } else {
        console.log("error", res.message)
      }
    })
  }
})