(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('udper', e);
  }
})(this, function (exports) {

  //arrays成员类型可以是 ArrayBuffer 或 TypeArray
  function mergeArrayBuffer(...arrays) {
    let totalLen = 0
    for (let i = 0, len = arrays.length; i < len; i++) {
      arrays[i] = new Uint8Array(arrays[i]) //全部转成Uint8Array
      totalLen += arrays[i].length
    }
    let res = new Uint8Array(totalLen)
    let offset = 0
    for (let arr of arrays) {
      res.set(arr, offset)
      offset += arr.length
    }
    return res.buffer
  }


  /**
   * Number to ArrayBuffer
   * @param {Number} num 
   * @param {Number} size : 1 2 4 byte
   * @param {Boolean} flag 
   */
  const number2IntArray = (num, size, flag) => {
    let arr = null
    size = size ? size : 1
    switch (size) {
      case 1:
        arr = (flag == true) ? (new Int8Array([num]).buffer) : new Uint8Array([num]).buffer
        break;
      case 2:
        arr = (flag == true) ? (new Int16Array([num]).buffer) : new Uint16Array([num]).buffer
        break;
      case 4:
        arr = (flag == true) ? (new Int32Array([num]).buffer) : new Uint32Array([num]).buffer
        break;
      default:
        arr = (flag == true) ? (new Int8Array([num]).buffer) : new Uint8Array([num]).buffer
        break
    }
    return arr
  }

  /**
   * ArrayBuffer to Number
   * @param {ArrayBuffer} arr 
   * @param {Number} size : 1 2 4 byte
   * @param {Boolean} flag 
   */
  const intArray2Number = (arr, size, flag) => {
    let num = 0
    size = size ? size : 1
    let buffer = new Uint8Array(arr).buffer
    switch (size) {
      case 1:
        num = (flag == true) ? (new int8Array(buffer)[0]) : new Uint8Array(buffer)[0]
        break;
      case 2:
        num = (flag == true) ? (new Int16Array(buffer)[0]) : new Uint16Array(buffer)[0]
        break;
      case 4:
        num = (flag == true) ? (new Int32Array(buffer)[0]) : new Uint32Array(buffer)[0]
        break;
      default:
        num = (flag == true) ? (new int8Array(buffer)[0]) : new Uint8Array(buffer)[0]
        break
    }
    return num
  }

  /**
   * ArrayBuffer转为字符串，参数为ArrayBuffer对象
   * @param {ArrayBuffer} buf 
   */
  const ab2str = (buf) => {
    let encodedString = buf && (buf.byteLength > 0) ? String.fromCharCode.apply(null, new Uint16Array(buf)) : '';
    return encodedString
  }

  /**
   * 字符串转为ArrayBuffer对象，参数为字符串
   * @param {String} str 
   */
  const str2ab = (str) => {
    let strLen = str.length
    if (strLen == 0) {
      return new ArrayBuffer(0)
    }
    let buf = new ArrayBuffer(strLen * 2); // 每个字符占用2个字节
    let bufView = new Uint16Array(buf);
    for (let i = 0; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }


  class Messge {
    constructor(buffer) {
      if (!buffer) {
        this.buffer = new ArrayBuffer(0);
      } else {
        this.buffer = buffer;
      }
      this.offset = 0;
    }

    /**
     * 将数字写入buffer
     * @param {Number} num 
     * @param {Number} offset 1 2 4, byte
     * @param {Boolean} flag 
     */
    writeNumber(num, offset, flag) {
      offset = offset ? offset : 1;
      let arr = number2IntArray(num, offset, flag);
      this.buffer = this.buffer ? mergeArrayBuffer(this.buffer, arr) : arr;
      return true
    }

    /**
     * 将字符串写入buffer
     * @param {String} str 
     */
    writeString(str) {
      if (typeof str === 'object') {
        return this.writeObject(str)
      }
      if (str && 0 != str.length) {
        let arr = str2ab(str);
        this.buffer = this.buffer ? mergeArrayBuffer(this.buffer, arr) : arr;
      }
      return true
    }

    /**
     * 将字符串写入buffer
     * @param {String} str 
     */
    writeObject(obj) {
      try {
        let str = JSON.stringify(obj)
        if (str && 0 != str.length) {
          let arr = str2ab(str);
          this.buffer = this.buffer ? mergeArrayBuffer(this.buffer, arr) : arr;
        }
      } catch (e) {
        console.error(e)
        return false
      }
      return true
    }

    /**
     * 从Message的ArrayBuffer中读取数字
     * @param {Number} offset 1 2 4, byte
     * @param {Boolean} flag 
     */
    readNumber(offset, flag) {
      offset = offset ? offset : 1;
      let arr = this.buffer.slice(this.offset, this.offset + offset);
      this.offset += offset;
      return intArray2Number(arr, offset, flag);
    }

    /**
     * 从Message的ArrayBuffer中读取字符串
     * @param {*} offset 
     */
    readString(offset) {
      let arr = null;
      if (!offset) {
        arr = this.buffer.slice(this.offset);
        this.offset = this.buffer.bytelength;
      } else {
        arr = this.buffer.slice(this.offset, offset);
        this.offset += offset;
      }
      let ostr = ab2str(arr);
      try {
        return JSON.parse(ostr)
      } catch (e) {
        return ostr
      }
    }
    readObject(offset) {
      let ostr = this.readString(offset)
      try {
        return JSON.parse(ostr)
      } catch (e) {
        return {}
      }
    }
  }

  Messge.prototype.buffer = function () {
    return this.buffer
  }

  exports.Messge = Messge;
});