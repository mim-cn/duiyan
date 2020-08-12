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
    let encodedString = buf && (buf.byteLength > 0) ? String.fromCharCode.apply(null, new Uint8Array(buf)) : '';
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
    constructor(any) {
      if (typeof any === "number") {
        this.buffer = new ArrayBuffer(any || 0);
      } else if (any instanceof ArrayBuffer) {
        this.buffer = any;
      }
      this.dataView = new DataView(this.buffer)
      this.woffset = 0;
      this.roffset = 0;
    }

    /**
     * 将数字写入buffer
     * @param {Number} num 
     * @param {Number} offset 1 2 4, byte
     * @param {Boolean} flag 
     */
    writeNumber(num, offset, flag) {
      offset = offset ? offset : 1;
      switch (offset) {
        case 1:
          (flag == true) ? this.dataView.setInt8(this.woffset, num): this.dataView.setUint8(this.woffset, num)
          break;
        case 2:
          (flag == true) ? this.dataView.setInt16(this.woffset, num): this.dataView.setUint16(this.woffset, num)
          break;
        case 4:
          (flag == true) ? this.dataView.setInt32(this.woffset, num): this.dataView.setUint32(this.woffset, num)
          break;
        default:
          (flag == true) ? this.dataView.setInt8(this.woffset, num): this.dataView.setUint8(this.woffset, num)
          break
      }
      this.woffset += offset
    }

    /**
     * 将字符串写入buffer
     * @param {String} str 
     */
    writeString(str) {
      let strLen = str.length
      if (str && 0 != strLen) {
        for (let i = 0; i < strLen; i++) {
          this.dataView.setUint8(this.woffset, str.charCodeAt(i))
          this.woffset++
        }
      }
    }

    /**
     * 从Message的ArrayBuffer中读取数字
     * @param {Number} offset 1 2 4, byte
     * @param {Boolean} flag 
     */
    readNumber(offset, flag) {
      let num = 0;
      offset = offset ? offset : 1;
      switch (offset) {
        case 1:
          num = (flag == true) ? this.dataView.getInt8(this.roffset) : this.dataView.getUint8(this.roffset)
          break;
        case 2:
          num = (flag == true) ? this.dataView.getInt16(this.roffset) : this.dataView.getUint16(this.roffset)
          break;
        case 4:
          num = (flag == true) ? this.dataView.getInt32(this.roffset) : this.dataView.getUint32(this.roffset)
          break;
        default:
          num = (flag == true) ? this.dataView.getInt8(this.roffset) : this.dataView.getUint8(this.roffset)
          break
      }
      this.roffset += offset
      return num
    }

    /**
     * 从Message的ArrayBuffer中读取字符串
     * @param {*} offset 
     */
    readString(offset) {
      let arr = null;
      if (!offset) {
        arr = this.buffer.slice(this.roffset);
        this.roffset = this.buffer.bytelength;
      } else {
        arr = this.buffer.slice(this.roffset, offset);
        this.roffset += offset;
      }
      return ab2str(arr);
    }

    /**
     * 
     * @param {Number} start 
     * @param {Number} end 
     */
    slice(start, end) {
      return this.buffer.slice(start, end).buffer
    }
  }

  Messge.prototype.buffer = function () {
    return this.buffer
  }

  exports.Messge = Messge;
});