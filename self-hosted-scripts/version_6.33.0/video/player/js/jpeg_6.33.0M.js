GLANCE.jpegDeboxer = function Deboxer() {

  /**
   * JPEG-specific deboxer.
   *
   * (Notice that WEBP is boxed in a .mov-like setup
   */
  var _saved
  /***
   * concatenate two arrays of bytes
   * @param a1  First array
   * @param a2  Second array
   * @returns  Uint8Array Uint8Array
   */
  GLANCE.jpegDeboxer.prototype.concatenate = function concatenate( a1, a2 ) {
    if( !a1 || a1.byteLength === 0 ) return a2
    if( !a2 || a2.byteLength === 0 ) return a1
    var result = new Uint8Array( a1.byteLength + a2.byteLength )
    result.set( a1, 0 )
    result.set( a2, a1.byteLength )
    a1 = null
    a2 = null
    return result
  }

  var concatenate = GLANCE.jpegDeboxer.prototype.concatenate

  /***
   * decode a sequence of images, calling back for each image
   * @param {ArrayBuffer} inbuff
   * @param {function} callback
   */
  GLANCE.jpegDeboxer.prototype.write = function get( inbuff, callback ) {
    if( !inbuff || inbuff.byteLength === 0 ) return
    callback ('image/jpeg', new Uint8Array(inbuff))
    return
    var buff
    if( _saved && _saved.byteLength > 0 ) buff = concatenate( _saved, new Uint8Array( inbuff ) )
    else buff = new Uint8Array( inbuff )
    var len = buff.byteLength

    /* starts with SOI  ff d8 ?  ends with EOI ff d9 */
    if( len >= 4 &&
      buff[0] === 0xff && buff[1] === 0xd8 &&
      buff[len - 2] === 0xff && buff[len - 1] === 0xd9 ) {
      callback( 'image/jpeg', buff )
      _saved = null
    }
    else _saved = buff
  }

  GLANCE.jpegDeboxer.prototype.reset = function reset() {
    _saved = null
  }
}
