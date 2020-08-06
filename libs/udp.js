import {
  randomNum,
  newAb2Str
} from '../utils/util.js'

(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('lru', e);
  }
})(this, function (exports) {

  function Udper(port) {
    this.bport = port;
    this.id = randomNum(9999, 99999)
    this.udper = wx.createUDPSocket();
    this.udper.bind(port);
  }

  exports.Udper = Udper;

  Udper.prototype.onMessage = function () {
    return new Promise((resolver, reject) => {
      this.udper.onMessage(function (res) {
        console.log(res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.getLocalip = function () {
    let self = this
    return new Promise((resolver, reject) => {
      this.udper.send({
        address: '255.255.255.255',
        port: this.bport,
        message: this.id + ""
      })
      // 广播接收者
      this.onMessage().then(res => {
        let _id = parseInt(res.message)
        if (self.id == _id) {
          res.id = _id
          resolver(res)
        } else {
          console.log("error", res_message)
          reject(res)
        }
      }).catch(e => {})
    })
  }

  Udper.prototype.close = function () {
    this.udper.close()
  };
});