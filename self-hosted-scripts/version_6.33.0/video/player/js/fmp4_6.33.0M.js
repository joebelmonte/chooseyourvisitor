/************************************************
 *           fMP4 Deboxer
 ************************************************/
if( !window.GLANCE ) window.GLANCE = {};
GLANCE.fMP4Deboxer = function Deboxer( level ) {
  var _saved;
  var _address = 0;
  var _level   = level || 0;

  /* for validating fourcc values */
  var _s  = 'A';
  var _A  = _s.charCodeAt( 0 );
  _s      = 'Z';
  var _Z  = _s.charCodeAt( 0 );
  _s      = 'a';
  var _a  = _s.charCodeAt( 0 );
  _s      = 'z';
  var _z  = _s.charCodeAt( 0 );
  _s      = '0';
  var _d0 = _s.charCodeAt( 0 );
  _s      = '9';
  var _d9 = _s.charCodeAt( 0 );

  /* names of boxes without embedded boxes */
  var _leaf = {
    ftyp: 0, mdat: 0, mvhd: 0, tkhd: 0, mdhd: 0, hdlr: 0, vmhd: 0, dref: 0,
    stsd: 8, avc1: 78, avcC: 0, stsz: 0, stsc: 0, stts: 0, stco: 0, mehd: 8, trex: 0, mfhd: 8, tfhd: 0, tfdt: 0, trun: 0
  };

  /***
   * read a fourcc code (like moov or mdat) and check it for correctness
   * @param buff  From this buffer
   * @param ptr   At this pointer offset
   * @returns {string}
   */
  GLANCE.fMP4Deboxer.prototype.readFourCC = function readFourCC( buff, ptr ) {
    var result = String.fromCharCode.apply( null, buff.subarray( ptr, ptr + 4 ) );
    for( var i = 0; i < result.length; i++ ) {
      var c = result.charCodeAt( i );
      if( !((_a <= c && c <= _z) || (_A <= c && c <= _Z) || (_d0 <= c && c <= _d9)) ) {
        throw  'Deboxer: invalid box name: ' + result;
      }
    }
    return result;
  };
  var readFourCC =  GLANCE.fMP4Deboxer.prototype.readFourCC;

  /***
   * read a 32 bit unsigned integer
   * @param {Uint8Array} buff  From this buffer
   * @param {number} ptr   at this pointer offset
   * @returns {number} the resulting 32-bit integer
   */
  GLANCE.fMP4Deboxer.prototype.readUInt32BE = function readUInt32BE( buff, ptr ) {
    return ((buff[ptr] << 24) & 0xff000000) |  // jshint ignore:line
      ((buff[ptr + 1] << 16) & 0xff0000) |  // jshint ignore:line
      ((buff[ptr + 2] << 8) & 0xff00) |  // jshint ignore:line
      ((buff[ptr + 3]) & 0xff);  // jshint ignore:line
  };
  var readUInt32BE = GLANCE.fMP4Deboxer.prototype.readUInt32BE;

  /***
   * read a 16 bit unsigned integer
   * @param {Uint8Array} buff  From this buffer
   * @param {number} ptr   at this pointer offset
   * @returns {number} the resulting 16-bit integer
   */
  GLANCE.fMP4Deboxer.prototype.readUInt16BE = function readUInt16BE( buff, ptr ) {
    return ((buff[ptr] << 8) & 0xff00) | ((buff[ptr + 1]) & 0x00ff); // jshint ignore:line
  };
  var readUInt16BE = GLANCE.fMP4Deboxer.prototype.readUInt16BE;

  /***
   * concatenate two arrays of bytes
   * @param a1  First array
   * @param a2  Second array
   * @returns  Uint8Array Uint8Array
   */
  GLANCE.fMP4Deboxer.prototype.concatenate = function concatenate( a1, a2 ) {
    if( !a1 || a1.byteLength === 0 ) return a2;
    if( !a2 || a2.byteLength === 0 ) return a1;
    var result = new Uint8Array( a1.byteLength + a2.byteLength );
    result.set( a1, 0 );
    result.set( a2, a1.byteLength );
    a1 = null;
    a2 = null;
    return result;
  };

  var concatenate = GLANCE.fMP4Deboxer.prototype.concatenate;

  /***
   * decode a sequence of boxes, running a callback for each box.
   * @param inbuff
   * @param callback
   * @returns {null}
   */
  GLANCE.fMP4Deboxer.prototype.write = function get( inbuff, callback ) {
    if( !inbuff || inbuff.byteLength === 0 ) return null;
    var buff;
    if( _saved && _saved.byteLength > 0 ) buff = concatenate( _saved, new Uint8Array( inbuff ) );
    else buff = new Uint8Array( inbuff );
    var ptr = 0;
    var len = buff.byteLength;
    while ( buff && ptr + 8 <= len ) {
      /* at least one box header */
      var boxlen = readUInt32BE( buff, ptr );
      if( boxlen < 8 || boxlen >= 0x10000000 )
        throw 'Deboxer: invalid box length: ' + boxlen + ' ' + boxlen.toString( 16 );
      var boxfourcc = readFourCC( buff, ptr + 4 );
      var boxskip   = _leaf[boxfourcc];
      if( ptr + boxlen <= len ) {
        var item   = buff.subarray( ptr + 8, ptr + boxlen );
        var isLeaf = (typeof boxskip === 'number') && boxskip === 0;
        callback( _level, isLeaf, boxfourcc, item, boxskip || 0 );
        ptr += boxlen;
      }
      else break;
    }
    if( ptr < len ) _saved = buff.subarray( ptr );
    else _saved = null;
    _address += ptr;
  };

  /***
   * decode the contents of an avc1 box, including quality and resolution
   * @param inbuff
   */
  GLANCE.fMP4Deboxer.prototype.avc1 = function avc1( inbuff ) {
    var buf                = new Uint8Array( inbuff );
    var r                  = {};
    var ptr                = 0;
    ptr += 6; //reserved
    r.dataReferenceIndex   = readUInt16BE( buf, ptr );
    ptr += 2;
    r.version              = readUInt16BE( buf, ptr );
    ptr += 2;
    r.revision             = readUInt16BE( buf, ptr );
    ptr += 2;
    r.vendor               = readUInt32BE( buf, ptr );
    ptr += 4;
    r.temporalQuality      = readUInt32BE( buf, ptr );
    ptr += 4;
    r.spatialQuality       = readUInt32BE( buf, ptr );
    ptr += 4;
    r.width                = readUInt16BE( buf, ptr );
    ptr += 2;
    r.height               = readUInt16BE( buf, ptr );
    ptr += 2;
    r.horizontalResolution = readUInt32BE( buf, ptr ) / 32768;
    ptr += 4;
    r.verticalResolution   = readUInt32BE( buf, ptr ) / 32768;
    ptr += 4;
    ptr += 4;
    r.frameCount           = readUInt16BE( buf, ptr );
    ptr += 2;
    var len                = buf[ptr++];
    r.codec                = String.fromCharCode.apply( null, buf.subarray( ptr, ptr + len ) );
    ptr += len;
    r.depth                = readUInt16BE( buf, ptr );
    return r;
  };

  GLANCE.fMP4Deboxer.prototype.mdhd = function mdhd( inbuff ) {
    var buf             = new Uint8Array( inbuff );
    var r               = {};
    r.version           = buf[0];
    r.creation_time     = readUInt32BE( buf, 4 );
    r.modification_time = readUInt32BE( buf, 8 );
    r.time_scale        = readUInt32BE( buf, 12 );
    r.duration          = readUInt32BE( buf, 16 );
    r.language          = readUInt16BE( buf, 20 );
    return r;
  };
  GLANCE.fMP4Deboxer.prototype.tfdt = function tfdt( inbuff ) {
    var buf                     = new Uint8Array( inbuff );
    var r                       = {};
    r.flags                     = readUInt32BE( buf, 0 );
    r.base_media_decode_time_hi = readUInt32BE( buf, 4 );
    r.base_media_decode_time    = readUInt32BE( buf, 8 );
    return r;
  };
  /**
   * decode the contents of an avcC box (h.264-specific parameters, including two
   * required prologue NALUs, sps and pps.
   * @param inbuff
   */
  GLANCE.fMP4Deboxer.prototype.avcC = function avcC( inbuff ) {
    var buf                = new Uint8Array( inbuff );
    var r                  = {};
    r.sps                  = [];
    r.pps                  = [];
    var ptr                = 0;
    r.configurationVersion = buf[ptr++];
    r.profileIndication    = buf[ptr++];
    r.profileCompatibility = buf[ptr++];
    r.avcLevelIndication   = buf[ptr++];
    r.boxSizeMinusOne      = buf[ptr++] & 3;  // jshint ignore:line
    if( r.boxSizeMinusOne != 3 ) throw "fMP4 error. We want the Box Size to be four, and in this stream it isn't";
    var count = buf[ptr++] & 31; // jshint ignore:line
    var len;
    for( var i = 0; i < count; i++ ) {
      len = readUInt16BE( buf, ptr );
      ptr += 2;
      r.sps.push( buf.subarray( ptr, ptr + len ) );
      ptr += len;
    }
    count = buf[ptr++] & 31;  // jshint ignore:line
    for( i = 0; i < count; i++ ) {
      len = readUInt16BE( buf, ptr );
      ptr += 2;
      r.pps.push( buf.subarray( ptr, ptr + len ) );
      ptr += len;
    }
    return r;
  };

  /***
   * gets a sequence of NALUs from a buffer
   * where each NALU starts with a four-byte size
   * (this is the packet-transport protocol, not the byte-stream protocol)
   * @param buff From this buffer
   * @param decode Method to call for decoding each NALU detected
   */
  GLANCE.fMP4Deboxer.prototype.getNALU4s = function get( buff, decode ) {
    if( !buff || buff.byteLength === 0 ) return;
    var ptr = 0;
    var len = buff.byteLength;
    while ( ptr < len ) {
      /* this assumes the box size is 4 (boxSizeMinusOne is 3) */
      var nalulen = readUInt32BE( buff, ptr );
      if( nalulen < 4 || nalulen >= 0x10000000 ) throw 'PacketStreamer: invalid NALU length: ' + nalulen + ' ' + nalulen.toString( 16 );
      ptr += 4;
      if( ptr + nalulen > len ) throw 'PacketStreamer: NALU length exceeds buffer: ' + nalulen + ' ' + nalulen.toString( 16 );
      var payload = buff.subarray( ptr, ptr + nalulen );
      ptr += nalulen;
      /* get NALU type ... 5 is idr picture aka IFrame */
      var nalHeader   = payload[0];
      var nalUnitType = nalHeader & 0x1f;
      var keyframe    = nalUnitType === 5;
      var globalnalu  = false;
      /* 6: pei   7: sps   8: pps */
      if( nalUnitType === 6 || nalUnitType === 7 || nalUnitType === 8 ) globalnalu = true;
      /* from here, we send individual NALUs, one per .decode call */
      decode( payload, { keyframe: keyframe, globalnalu: globalnalu, nalunittype: '' + nalUnitType } );
    }
    if( ptr !== len ) throw  'PacketStreamer: NALU buffer overrun error';
  };

  GLANCE.fMP4Deboxer.prototype.reset = function reset() {
    _saved   = null;
    _address = 0;
  };
};
