if( !self.GLANCE ) self.GLANCE = {}
self.window = {};
self.ebml = {};

/**
 * Worker state
 */

// we can get this value from the Starting command if it's there.
// Notice that "avc1.42E01E" means H.264 Constrained Baseline Profile Level 3
var DefaultVideoType = 'video/mp4; codecs="avc1.42E01E"'
var DecodableVideoTypes = 'video/mp4; codecs="avc1.42E01E"|video/webm; codecs="avc1.42E01E"|video/h264; codecs="avc1.42E01E"|image/jpeg'

// State variables controlled by GlanceVisitorVideo
var LogToServer = false
var VideoDebug = true
var LogVideoTelemetry = false
var RatesReporting = 30

var _ws
var _offer
var _extra
var _userAgent
var _session
var _guestid
var _conntype

var _packetTimes
var _packetSizes
var _frameTimes
var _inboundPacketCount = 0
var _inboundByteCount = 0
var _inboundMessageCount = 0
var _startingSeen = false
var _streamStartTimestamp

var _previousTimestamp
var _sentToDecoderItemCount
var _nextReportTimestamp

var _isPlaying = false
var _nominalBitrate = 0
var _streamCount = 0
var _sentIEStart = false
var _restartPending = false
var _deboxer
/* metadata grabbed from mp4 stream */
var _avcC
var _avc1
var _reconnectRetryLimit = 12
var _awaitingReconnect = false
var _reconnectRetry = 0
var _reconnectRetryTimer = null
var _incomingDataWait = 10000
var _incomingDataTimeout = null
var _Timestamp = 0
var _Keyframe = false
var _TimecodeScale = 1
var _nominalFramerate = 8
var _frameDuration = 125.0
var _skipStart = 0
var _PixelWidth
var _PixelHeight
var _bitstream = ""
var _currentDeboxLag = 0
var _startTimestamp
var _clientKey
var _ignoredPackagesNumber = 0
var _ignoredPackagesMaxNumber = 20


let previousCaps = null

function sendCaps( caps, extra ) {
  caps = caps || self.GLANCE.browserCapabilities

  if (extra) {
    for (let key in extra) {
      if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
      caps[key] = extra[key]
    }
  }
  //todo does it make sense to only send browserCapabilities changes?
  //todo does it make sense to split browserCapabities into multiple objects, for permanent and emphemeral state?
  if( caps !== previousCaps ) {
    /* send browserCapabilities metadata on start */
    send( 'T ' + JSON.stringify( { client: _clientKey, browserCapabilities: caps } ) )
    //console.log( 'refreshing browserCapabilities', caps )  //todo
    previousCaps = caps
  }
  return caps
}


function sendStart( reason, caps ) {
  // clear previousCaps because sendCaps is called the first time
  // before we have a websocket opened, so the telemetry we think was sent is lost,
  // send it again.
  previousCaps = null

  const extra = {role: 'accept', self:true}
  caps = sendCaps( caps, extra )

  const p = []
  p.push( DecodableVideoTypes )
  p.push( _clientKey )
  p.push( Math.round( caps.clientWidth ) )
  p.push( Math.round( caps.clientHeight ) )
  typeof reason === 'string' ? p.push( reason ) : p.push(' ')

  send( 'Start ' + p.join( '#' ) )
}
/**
 * Worker
 * 
 * @param event Event object posted from worker parent call to postMessage()
 */
onmessage = function(event) {
  var data = event.data
  if (data.params && data.params.config){
    VideoDebug = data.params.config.VideoDebug
    LogToServer = data.params.config.LogToServer
    RatesReporting = data.params.config.RatesReporting
    _sentIEStart = data.params.config.sentIEStart
  }
  switch(data.action) {
      case "version": 
        importScripts(data.path + "/ebml" + data.version);
        importScripts(data.path + "/fmp4" + data.version);
        importScripts(data.path + "/jpeg" + data.version);
      break;
      case "start":
        if (!self.GLANCE.browserCapabilities){
          self.GLANCE.browserCapabilities = {}
        }
        if (data.params.clientWidth){
          self.GLANCE.browserCapabilities["clientWidth"] = data.params.clientWidth
        }
        if (data.params.clientHeight){
          self.GLANCE.browserCapabilities["clientHeight"] = data.params.clientHeight
        }
        if (data.params.clientKey){
          _clientKey = data.params.clientKey
        }
        start(data.params.offer, data.params.extra, data.params.userAgent)
        break
      case "stop":
        stop()
        break
      case "send":
        send(data.params.command)
        break
      case "log":
        log(data.params.message)
        break
      case "frameTimes":
        if (data.params.sample){
          _frameTimes.sampleAccumulating( data.params.sample )
        }
        break
      case "ieStart":
        _restartPending = true
        if (data.params.sentIEStart){
          _sentIEStart = data.params.sentIEStart
        }
        sendStart('ieStart')
        break;
      case "requestKeyframe":
        _restartPending = true
        sendStart('keyFrame')
        break;
      case "requestSlower":
        if (data.params && data.params.reason){
          send('Slower reason=' + data.params.reason)
        }else {
          send('Slower')
        }
        break;
      case "browserCapabilities":
        self.GLANCE.browserCapabilities = data.params.browserCapabilities
        _clientKey = data.params.clientKey
        sendCaps(data.params.browserCapabilities)
        break;
      default:
        error("unknown action")
        error(data)
  }
}

/**
 * Post message to GlanceVisitorVideo parent
 */
function visitorVideoEvent(action, params, transferrable){
  postMessage({action: action, params: params}, transferrable)
}

/**
 * Start session
 *
 * @param offer pass code or URL of the offer
 * @param extra parameters (guestid, conntype, gpu) or null if none.
 * @param {string} userAgent
 */
function start(offer, extra, userAgent){
  _offer = offer
  _extra = extra
  _guestid = extra.guestid
  _conntype = extra.conntype
  _userAgent = userAgent
  const extraQueryString = getQueryString( _extra )

  getAjaxOffer(
    _offer + extraQueryString,
    function ajaxOfferCallback( descriptor ) {
      _session = descriptor
      /* coerce actual numbers for frame dimensions */
      if( _session.videoWidth ) _session.videoWidth = Number( _session.videoWidth )
      if( _session.videoHeight ) _session.videoHeight = Number( _session.videoHeight )

      visitorVideoEvent("session", {session: _session})

      socketConnect()
    },
    function ajaxOfferError( e, status ) {
      visitorVideoEvent("ajaxOfferError", {offer: _offer, status: status})
    }
  )
}

/**
 * Stop session
 */
function stop(){
  this.handleStoppingCommand()
  if( _ws &&
    (_ws.readyState === 0 /* CONNECTING */ ||
      _ws.readyState === 1 /* OPEN */) ) {
    _ws.close()
  }
}

/**
 * Send string message on WebSocket
 * 
 * @return command string
 */
 function send( command ){
  if( _ws && command && _ws.readyState === 1 /* OPEN */ && (typeof command === 'string') && (command.length > 0) ) {
    _ws.send( command )
    return command
  }
}

/**
 * Connect to WebSocket server
 *
 */
function socketConnect(){
  if (_session && _session.accepter){
    _packetTimes = Stats( "packet times" )
    _packetSizes = Stats( "packet sizes" )
    _frameTimes = Stats( "frame times" )
    _inboundPacketCount = 0
    _inboundByteCount = 0
    _inboundMessageCount = 0
    _startingSeen = false
    _streamStartTimestamp = millisecondNow()

    var wsUrl = _session.accepter
    if ( _guestid ) {
      wsUrl += ( '/' + _guestid )
      // positional so can't have conntype without guestid
      if ( _conntype )
        wsUrl += ( '/' + _conntype )
    }

    _ws = new WebSocket( wsUrl )
    _ws.binaryType = 'arraybuffer'
    _ws.onopen = socketOpen
    _ws.onmessage = socketMessage
    _ws.onclose = socketClose
    _ws.onerror = socketError

    logLocalDebug( 'connecting to websocket...')
  }else{
    error("Couldn't connect to websocket because relay session accepter was not set")
  }
}

/**
 * WebSocket open
 *
 */
function socketOpen(){
  logLocalDebug( 'websocket opened' )
  visitorVideoEvent("beforestart")
  /* tell the far end to start / restart sending */
  sendStart('open')

  _awaitingReconnect = false
  _reconnectRetry = 0
  if (_reconnectRetryTimer != null)
    clearTimeout(_reconnectRetryTimer)

  visitorVideoEvent("start")
}

/**
 * WebSocket message
 * 
 * @param event Message event
 */
function socketMessage(event){
  if( typeof event.data === 'string' ) {
    handleStringMessage( event )
  } else if( _startingSeen ) {
    handlePayloadMessage( event )
  } else { 
    // GD-19421 This is the main cause of three dots issue
    // Starting command somtimes doesn't make to this point and we just ignor all packages
    _ignoredPackagesNumber++
    logLocalDebug( event.data.byteLength, '-byte payload message ignored before Starting' )

    if(_ignoredPackagesNumber >= _ignoredPackagesMaxNumber) {
      // Send restart to offerer
      send('Restart')
      _ignoredPackagesNumber = 0;
    }
  }

  if( _incomingDataTimeout !== null ) clearTimeout( _incomingDataTimeout )
  _incomingDataTimeout = setTimeout( checkServer, _incomingDataWait )
}

/**
 * WebSocket close
 * 
 * @param event Close event
 */
function socketClose(event){
  logLocalDebug( 'websocket close', event )
  visitorVideoEvent("close")
  _ws = null
  stop()

  // we use 1013 from server so we know we should do a reconnect.
  if (!event.wasClean || event.code === 1013) {
    // clear any data timer, it is only there for if we don't get a close
    if( _incomingDataTimeout !== null ) {
      clearTimeout( _incomingDataTimeout )
      _incomingDataTimeout = null
    }

    // try to reconnect
    socketRetry()
  }
  else {
    visitorVideoEvent("end")
  }
}

/**
 * WebSocket error
 * 
 * @param event Error event
 */
function socketError(event){
  error( 'websocket error', event )
  if (_reconnectRetry >= _reconnectRetryLimit) {
    visitorVideoEvent("error", {message: 'Websocket error caused session disconnection'})
    stop()
  }
}

/**
 * WebSocket reconnect
 */
 function socketRetry() {
  // see if we quietly give up
  if (_reconnectRetry >= _reconnectRetryLimit) {
    logLocalDebug('reconnectWebSocket - limit reached, giving up')
    visitorVideoEvent("end")
    return
  }

  var timeToWait = GetExponentialBackoffTime(_reconnectRetry)
  logLocalDebug("waiting " + timeToWait + "ms to reconnect...")
  _reconnectRetryTimer = setTimeout( socketConnect, timeToWait)

  _awaitingReconnect = true
  _reconnectRetry++
}

/**
 * send a simple message to server to check socket connection.
 * it seems to time out much faster if we are sending than when waiting for data
 */
function checkServer() {
  send('Log notice data disrupted')
}

/**
 * When a string message (a command) arrives.
 * 
 * @param event String based event
 */
function handleStringMessage( event ) {
  logLocalDebug( 'received', event.data )
  _inboundMessageCount++
  visitorVideoEvent('log', {message: event.data})
  /* log everything */
  /************* Info command processor */
  var parms
  if( event.data.indexOf( 'Info' ) === 0 ) {
    var tag = 'Info set '
    var tag2 = 'Info viewer '
    var tag3 = 'Info viewers '
    var tag4 = 'Info debug '
    var tag5 = 'Info realFramerate '
    if( event.data.indexOf( tag ) === 0 ) {
      parms = event.data.substring( tag.length )
      var width = getParameter( parms, 'videowidth' )
      var height = getParameter( parms, 'videoheight' )
      var bps = Number( getParameter( parms, 'bitrate' ) )
      _nominalBitrate = bps
      var mbps = bps / 1000000.0
      var framerate = Number( getParameter( parms, 'framerate' ) )
      _nominalFramerate = framerate || 8
      _nominalFrameDuration = 1000.0 / framerate
      _frameDuration = 1000.0 / framerate
      var paramset = getParameter( parms, 'paramset' )
      _bitstream = framerate.toFixed( 0 ) + 'fps ' + mbps.toFixed( 3 ) + 'mbps ' + '[' + paramset + ']'
      var realFramerate = getParameter( parms, 'realFramerate' )
      if (realFramerate && (realFramerate != '')){
        realFramerate = Number(realFramerate)
        visitorVideoEvent("realFramerate", {realFramerate: realFramerate})
      }

      /* announce a different size */
      visitorVideoEvent("resize", {width: Number(width), height: Number(height)})
    }
    else if( event.data.indexOf( tag2 ) === 0 ) {
      /* viewer serial number */
      visitorVideoEvent("connectionSerial", {number: Number( event.data.substring( tag2.length ) )})
    }
    else if( event.data.indexOf( tag3 ) === 0 ) {
      /* number of active viewers */
      visitorVideoEvent( 'guestCountChanged', {count: Number( event.data.substring( tag3.length ) )} )
    }
    else if( event.data.indexOf( tag4 ) === 0 ) {
      /* enable / disable debugging */
      var z = event.data.substring( tag4.length )
      VideoDebug = (z && z.length > 0) ? z : null
      visitorVideoEvent("videoDebug", {videoDebug: VideoDebug})
    }
    else if( event.data.indexOf( tag5 ) === 0 ) {
      parms = event.data.substring( tag5.length )
      if (parms && (parms != '')) {
        let realFramerate = parseFloat(parms)
        visitorVideoEvent("realFramerate", {realFramerate: Number(parms)})
      }
    }
  }
  /************* Starting command processor */
  else if( event.data.indexOf( 'Starting' ) === 0 ) {
    _startingSeen = true
    if( _isPlaying ) {
      event.restarting = true
      handleStoppingCommand( event )
    }
    handleStartingCommand( event )
  }
  /************* Stopping command processor */
  else if( event.data.indexOf( 'Stopping' ) === 0 ) {
    handleStoppingCommand( event )
  }
  /************* Closing command processor */
  else if( event.data === 'Closing' || event.data === 'Close' ) {
    visitorVideoEvent( 'guestCountChanged', {count:0})
    visitorVideoEvent( 'end' )
    stop()
  }
  /************* Passthrough command processor */
  else if( event.data.indexOf( 'Passthrough' ) === 0 ) {
    var sessionInvitationStr = 'Passthrough SessionInvitation'
    if( event.data.indexOf( sessionInvitationStr ) === 0 ) {
      /* we have a session invitation. This should create a new video offer in reverse direction */
      parms = event.data.substring( sessionInvitationStr.length )
      var glanceAddressIndex = parms.indexOf( 'username=' )
      var sessionKeyIndex = parms.indexOf( '&sessionkey=' )
      var sessionViewerIndex = parms.indexOf( '&sessiontype=' )
      if( glanceAddressIndex > -1 && sessionKeyIndex > -1 && sessionViewerIndex > -1 ) {
        var glanceAddress = parms.slice( glanceAddressIndex + 'username='.length, sessionKeyIndex )
        var sessionKey = parms.slice( sessionKeyIndex + '&sessionkey='.length, sessionViewerIndex )
        var sessionViewer = parms.slice( sessionViewerIndex + '&sessiontype='.length )
        log( 'SessionInvitation message received GlanceAddress: ' + glanceAddress + ' Session Key:' + sessionKey + ' Session Viewer:' + sessionViewer )
      }
      else {
        log( 'Malformed SessionInvitation message received: ' + event.data )
      }

      /* so, umm, do something with this... */
    }
  }
  /************* KeepAlive notification */
  else if( event.data === 'KeepAlive' ) {
    // don't need to actually do anything
  }
  /************* Telemetery */
  else if( event.data.indexOf( 'T ' ) === 0 ) {
    try {
      const t = JSON.parse( event.data.slice( 2 ) )
      visitorVideoEvent('t', t)
    }
    catch (ex) {
      /* empty, intentionally, don't die on bad telemetry messages */
    }
  }
  /************* Closed, goes with telemetry */
  else if( event.data.indexOf( 'Closed ' ) === 0 ) {
    const browserId = event.data.slice(1 + 'Closed'.length)
    visitorVideoEvent('closed', browserId)
  }
  /************* Failure command processor */
  else if( event.data.indexOf( 'Failure' ) === 0 || event.data.indexOf( 'Error' ) === 0 ) {
    visitorVideoEvent('error', {data: event.data})
  }
  /************* TooSlow - we are going to be closed, this is why */
  else if( event.data.indexOf( 'TooSlow' ) === 0 ) {
    visitorVideoEvent('tooSlow')
  }
  else {
    visitorVideoEvent('error', {message: 'Unexpected websocket metadata received: ' + event.data})
  }
}

/**
 * When a payload message (a video stream buffer of some kind) arrives
 * 
 * @param event Data payload event
 */
function handlePayloadMessage( event ) {
  /* incoming payload */
  logLocalLevel( 2, 'payload received', event.data.byteLength, millisecondNow() )
  var now = millisecondNow()
  visitorVideoEvent("payload", {streamCount: _streamCount, packet: _inboundPacketCount})
  /* is it first payload message in stream? */
  if( _inboundPacketCount === 0 ) {
    _startTimestamp = now
    visitorVideoEvent("firstPacket", {startTimestamp: _startTimestamp})
    _nextReportTimestamp = now + 1000 * (RatesReporting || 60)
    _previousTimestamp = 0
    var t = (_startTimestamp - _streamStartTimestamp)
    if( _deboxer && _deboxer.reset ) _deboxer.reset()
    var msg = 'First stream packet: ' + 8 * event.data.byteLength + ' bits'
    if( _streamStartTimestamp && _startTimestamp && _streamStartTimestamp < _startTimestamp ) {
      msg += ' ' + t.toFixed( 0 ) + 'ms after stream start.'
    }
    else msg += '.'
    if( t > 5000 ) {
      visitorVideoEvent("warning", {message: msg})
    }
    else {
      visitorVideoEvent("log", {message: msg})
    }
    log( msg )
  }

  /* accumulate and then report per packet statistics */
  _inboundPacketCount++
  _inboundByteCount += event.data.byteLength
  _packetSizes.sample( event.data.byteLength )
  _packetTimes.sampleAccumulating( now )

  if( now >= _nextReportTimestamp ) {
    reportRates()
    _nextReportTimestamp += 1000 * (RatesReporting || 60)
  }

  /* decode and ultimately display */
  if( _isPlaying ) {
    logLocalLevel( 2, 'handling payload', event.data.byteLength, millisecondNow() )
    try {
      if( _mime.indexOf( 'video/mp4' ) === 0 ) {
        /* mp4  packaging */
        _deboxer.write( event.data, mp4Deboxed )
      }
      else if( _mime.indexOf( 'video/webm' ) === 0 ) {
        _deboxer.write( event.data, webmDeboxed )
      }
      else if( _mime.indexOf( 'image/jpeg' ) === 0 ) {
        _deboxer.write( event.data, jpegDeboxed )
      }
      else { // noinspection PointlessBooleanExpressionJS
        if( false && _mime.indexOf( 'video/h264' ) === 0 ) {
                    /* looks like NALU sequence packaging, just slam dunk. */
                    decode( event.data )
                  }
      }
    }
    catch ( err ) {
      /* hack hack recover from bitstream rubbish?? */
      error( 'Payload handling error', err )
      if( _deboxer && _deboxer.reset ) _deboxer.reset()
    }
  }
  /* end if _isPlaying */
}

/**
 * handleStartingCommand
 * 
 * @param event Starting event
 */
function handleStartingCommand( event ) {
  _mime = splitString( event.data, DefaultVideoType )
  _streamStartTimestamp = millisecondNow()
  _packetTimes = Stats( "packet times" )
  _packetSizes = Stats( "packet sizes" )
  _frameTimes = Stats( "frame times" )

  _isPlaying = true
  _restartPending = false
  _skipStart = 0
  _streamCount += 1
  _ignoredPackagesNumber = 0;

  visitorVideoEvent("start", {mime: _mime, streamCount: _streamCount})
  if( _mime.indexOf( 'video/mp4' ) === 0 ) {
    _deboxer = new GLANCE.fMP4Deboxer()
  }
  else if( _mime.indexOf( 'video/webm' ) === 0 ) {
    _deboxer = new ebml.EbmlDecoder()
  }
  else if( _mime.indexOf( 'image/jpeg' ) === 0 ) {
    _deboxer = new GLANCE.jpegDeboxer()
  }
  else {
    throw 'Decoder: unrecognized MIME type: ' + _mime || '--type not provided--'
  }
  _deboxer.streamCount = _streamCount
  _deboxer.itemCount = 0
}

/**
 * handleStoppingCommand
 */
function handleStoppingCommand(event) {
  if( _isPlaying ) {
    if (_deboxer){
      _deboxer.reset()
    }
    _isPlaying = false
    let isRestarting = event ? (event.restarting || (event.data.indexOf("restarting=true") > 0)) : false
    visitorVideoEvent("stop", {restarting: isRestarting})
  }
}

/**
 * Send decoded H264 to player
 * 
 * @param payload 
 * @param metadata
 */
function decode( payload, metadata ) {
  var now = millisecondNow()
  var wallTime = now - _startTimestamp
  var ts = _Timestamp || wallTime
  _currentDeboxLag = wallTime - ts

  var infos = {
    /* the media time of the present item */
    timestamp: ts,
    /* payload packet number */
    packet: _inboundPacketCount || 0,
    /* enqueued item number */
    itemCount: metadata.itemCount || _deboxer.itemCount++ || 0,
    streamCount: metadata.streamCount || _streamCount,
    byteLength: payload.byteLength,
    /* item enqueuing time */
    enqueueStart: now
  }
  /* Count items when timestamp changes;
   * some frames contain multiple NALUs.
   */
  if( ts > _previousTimestamp ) {
    var newDuration = (ts - _previousTimestamp)
    /* Filter the computed frame duration a bit */
    _frameDuration = ((_frameDuration * 7) + newDuration) * 0.125
    _sentToDecoderItemCount += 1
    _previousTimestamp = ts
  }
  _Keyframe = metadata.keyframe

  visitorVideoEvent("decoding", {metadata: metadata, nalunittype: (metadata.nalunittype || (payload[4] & 0x1f)), bytes: payload.byteLength, infos: infos, deboxLag: _currentDeboxLag.toFixed( 0 )})
  
  if( _restartPending || infos.streamCount !== _streamCount ) {
    return false
  }
  infos.nominalFramerate = _nominalFramerate

  if( isIE11() && !_sentIEStart && infos.itemCount >= 25 ) {
    log( 'Log info skip decoding ' + infos.ItemCount + ' before IE Warmup done' )
  }else{
    var copyU8 = new Uint8Array( payload ) // copy
    visitorVideoEvent("decode", {payload: copyU8, infos: infos}, [copyU8.buffer])
  }
}

/**
 * callback upon detecting webm box
 * 
 * @param chunk
 */
function webmDeboxed( chunk ) {
  var name = chunk[1].name
  if( chunk[0] === 'tag' ) {
    if( name === 'SimpleBlock' ) {
      if( _TimecodeScale && _TimecodeScale > 0 ) {
        _Timestamp = 1000000.0 * (chunk[1].value + (_Timecode || 0)) / _TimecodeScale
      }
      /* here we send a mess of NALUs in stream format separated by start codes
       * webm is kind enough to tell us the key frame boundaries. */
      decode( chunk[1].payload, {
        keyframe: chunk[1].keyframe,
        streamCount: _streamCount,
        itemCount: _deboxer.itemCount++
      } )
    }
    else if( name === 'PixelWidth' || name === 'PixelHeight' || name === 'TimecodeScale' || name === 'Timecode' ) {
      if( name === 'PixelWidth' ) {
        /* round odd widths down to even: webm streams exaggerate width */
        _PixelWidth = chunk[1].value
        _PixelWidth -= _PixelWidth % 2
      }else if (name === 'PixelHeight'){
        _PixelHeight = chunk[1].value
      }else if (name === 'TimecodeScale'){
        _TimecodeScale = chunk[1].value
      }else if (name === 'Timecode'){
        _Timecode = chunk[1].value
      }
    }
    if( _PixelWidth && _PixelHeight && (name === 'PixelWidth' || name === 'PixelHeight') ) {
      visitorVideoEvent( "dimensions", { width: _PixelWidth, height: _PixelHeight })
      var msg = _PixelWidth + 'x' + _PixelHeight + ' ' + _bitstream
      visitorVideoEvent( 'format', {message: msg.trim()} )
      visitorVideoEvent( 'codec', {mime: _mime.trim()} )
    }
  }
  else if( chunk[0] === 'start' && name === 'EBML' ) {
    /* new stream */
    _deboxer.itemCount = 0
  }
}

var boxes = { moov: 0, trak: 0, mdia: 0, minf: 0, stbl: 0, stsd: 8, avc1: 78, moof: 0, traf: 0, }
var mp4BoxCount = 0

/**
 * debox mp4. This is recursive;  see new GLANCE.MP4Deboxer() at the end of the function.
 * @param level  depth of nesting of the present box
 * @param isLeaf true if nothing more is nested
 * @param fourcc the box name, liie 'ftyp' or 'mdat'
 * @param buff the box contents
 * @param skip number of bytes to skip over in buff to find the beginning of the next box
 */
function mp4Deboxed( level, isLeaf, fourcc, buff, skip ) {
  logLocalLevel( 2, mp4BoxCount++, fourcc, isLeaf, buff.byteLength, level )
  switch ( fourcc ) {
    case 'mdat':
      _deboxer.getNALU4s( buff, decode )
      break

    case 'moov':
      _deboxer.itemCount = 0
      break

    case 'tfdt':
      var tfdt = _deboxer.tfdt( buff )
      var ts = 0
      /* here's a kludge to cover for a a missing mdhd box.
        * it uses the frame rate from the Info packet */
      var scale = _TimecodeScale || _nominalFramerate * 1000
      if( scale > 0 ) ts = tfdt.base_media_decode_time / (0.001 * scale)
      if( !_Timestamp || ts > _Timestamp ) _Timestamp = ts
      break

    case 'avcC':
      _avcC = _deboxer.avcC( buff )
      if( _avcC.profileCompatibility === 64 || _avcC.profileIndication === 77 ) {
        throw 'Decoder: requires H.264 Baseline profile with CAVLC encoding: check your encoder.'
      }
      for( var i = 0; i < _avcC.sps.length; i++ ) {
        decode( _avcC.sps[i], {
          globalnalu: true,
          streamCount: _streamCount,
          itemCount: _deboxer.itemCount++
        } )
      }
      for( i = 0; i < _avcC.pps.length; i++ ) {
        decode( _avcC.pps[i], {
          globalnalu: true,
          streamCount: _streamCount,
          itemCount: _deboxer.itemCount++
        } )
      }
      break

    case 'avc1':
      _avc1 = _deboxer.avc1( buff )
      _PixelWidth = _avc1.width
      _PixelHeight = _avc1.height
      visitorVideoEvent( "dimensions", { width: _PixelWidth, height: _PixelHeight })
      var msg = _PixelWidth + 'x' + _PixelHeight + ' ' + _bitstream
      visitorVideoEvent( 'format', {message: msg.trim()} )
      visitorVideoEvent( 'codec', {mime: _mime.trim()} )
      break

    case 'mdhd':
      var mdhd = _deboxer.mdhd( buff )
      _TimecodeScale = mdhd.time_scale
      break
  }

  var box = boxes[fourcc]
  if( typeof box === 'number' ) {
    /* recursively parse boxes */
    var deboxer = new GLANCE.fMP4Deboxer( level + 1 )
    deboxer.write( buff.subarray( skip ), mp4Deboxed )
  }
}

function jpegDeboxed( type, buff ) {
  var copyU8 = new Uint8Array( buff ) // copy
  visitorVideoEvent("decode", {payload: copyU8, infos: {itemCount: _deboxer.itemCount++, nominalFramerate: _nominalFramerate, streamCount: _streamCount}}, [copyU8.buffer])
}

/**
 * Handle ajax access to offer REST service
 * 
 * @param offer Offer URL
 * @param next Successful callback
 * @param fail Failure callback
 */
function getAjaxOffer( offer, next, fail ) {
  function stateHandler( e ) {
    if( req.readyState === 4 ) {
      /* done. deal. */
      if( req.status >= 200 && req.status < 300 ) {
        /* success-like status */
        var resp = JSON.parse( req.responseText )
        next( resp )
      }
      else {
        fail( e, req.status )
      }
    }
    else {
      /* empty, intentionally. Some other req.readyState value. Ignore. */
    }
  }

  function errorHandler( e ) {
    fail( e, 599 )
  }

  var req = new XMLHttpRequest()
  req.addEventListener( 'readystatechange', stateHandler )
  req.addEventListener( 'abort', errorHandler )
  req.addEventListener( 'timeout', errorHandler )
  req.addEventListener( 'error', errorHandler )

  try {
    req.withCredentials = true
    req.open( 'GET', offer )
    req.setRequestHeader( 'Accept', 'application/json' )
    req.send()
  }
  catch ( exception ) {
    fail( exception, 599 )
  }
}

/**
 * getParameter
 * 
 * @param paramString full parameters string
 * @param name parameter to get
 * @returns parameter string
 */
function getParameter( paramString, name ) {
  return decodeURIComponent(
    (new RegExp( '[?|&]{0,1}' + name + '=' + '([^&;]+?)(&|#|;|$)' )
    .exec( paramString ) || [null, ''])[1]
    .replace( /\+/g, '%20' ) ) || ''
}

/**
 * getQueryString from params
 * 
 * @param params parameters object
 * @returns joined query string based on parameters
 */
function getQueryString( params ) {
  var prms = []
  for( var key in params )
    if( params.hasOwnProperty( key ) )
      prms.push( key + '=' + encodeURIComponent( params[key] ) )
  return prms.length > 0 ? '?' + prms.join( '&' ) : ''
}

/**
 * GetExponentialBackoffTime
 * 
 * @param retry 
 * @returns back off time in ms
 */
function GetExponentialBackoffTime(retry) {
  var baseTime = 2;           // base time in seconds for exponential backoff
  var randomMax = 5;          // max random number of seconds to add to exponential base
  var exponentLimit = 4;      // exponent we cap at
  if (retry > exponentLimit) retry = exponentLimit;

  return (Math.pow(baseTime,retry) + Math.random() * randomMax) * 1000;
}

/**
 * Split string
 * 
 * @param cmd string
 * @param def string
 * @returns result
 */
function splitString( cmd, def ) {
  var result = def
  var splits = cmd.split( ' ' )
  if( splits.length > 1 ) {
    splits = splits.slice( 1 )
    result = splits.join( ' ' )
  }
  return result
}

/***
 * is the present browser IE111?
 * @returns {boolean}
 */
 function isIE11() {
  if(_userAgent){
    return _userAgent.indexOf( 'Trident' ) !== -1
  }
  return false
}

/* Polyfill for window.performance.now submillisecond timer */
self.performance = self.performance || {}
performance.now = (function() {
  return performance.now ||
    performance.mozNow ||
    performance.msNow ||
    performance.oNow ||
    performance.webkitNow ||
    function() {
      return (new Date()).getTime()
    }
})()

/**
 * Time now in milliseconds
 * 
 * @returns ms
 */
function millisecondNow() {
  return self.performance.now()
}

/**
 * Log message with variable arguments
 */
 function log() {
  if (!VideoDebug) {
    return
  }
  var args = Array.prototype.slice.call( arguments )
  if( LogToServer ) {
    args.splice( 0, 0, 'Log', 'notice' )
    send( args.join( ' ' ) )
  }
  else console.log.apply( console, args )
}

/**
 * Log message with variable arguments
 */
 function logLocal() {
  var args = Array.prototype.slice.call( arguments )
  console.log.apply( console, args )
}

/**
 * Log message with variable arguments
 */
 function logLocalDebug() {
  if (!VideoDebug) {
    return
  }

  var args = Array.prototype.slice.call( arguments )

  // filter out apparent telemetry messages.
  if (args.length > 1 && typeof(args[1]) === 'string' && args[1].startsWith('T {"client'))
    return
  console.log.apply( console, args )
}

/**
 * Log message with variable arguments
 */
 function logLocalLevel(level) {
  if (VideoDebug && (VideoDebug >= level)) {
    var args = Array.prototype.slice.call( arguments, 1 )
    console.log.apply( console, args )
  }
}

/**
 * Log error message with variable arguments
 */
 function error() {
  if (!VideoDebug) {
    return
  }
  var args = Array.prototype.slice.call( arguments )
  if( LogToServer ) {
    args.splice( 0, 0, 'Log', 'notice' )
    send( args.join( ' ' ) )
  }
  else console.error.apply( console, args )
}

/**
 * fire the 'rates' event.
 */
function reportRates() {
  var packetSizes = _packetSizes.values()
  var packetTimes = _packetTimes.values()
  var frameTimes = _frameTimes.values()

  /* bitrate per second from bytes / millisecond */
  var averageBitrate = 8000.0 * packetSizes.sum / packetTimes.range
  var averagePacketrate = 1000.0 / (packetTimes.averageDelta || 1000)
  var averageFramerate = 1000.0 / (frameTimes.averageDelta || 1000)

  visitorVideoEvent( 'rates', {
    averageBitrate: averageBitrate,
    averagePacketrate: averagePacketrate,
    averageFramerate: averageFramerate,
    width: _PixelWidth,
    height: _PixelHeight,
  } )

  _packetSizes.clear()
  _packetTimes.clear()
  _frameTimes.clear()
}

/**
 * Stats collector
 */
function Stats( cap, filter ) {
  var caption = cap
  var f = 1.0 / (filter || 8.0)
  var value = {}

  function _filter( accumulator, value ) {
    if( typeof accumulator === 'number' ) {
      accumulator = accumulator * (1 - f) + (value * f)
    }
    else {
      accumulator = value
    }
    return accumulator
  }

  function _descrip( item, val ) {
    if( typeof item.current === 'number' ) item.previous = item.current
    if( typeof item.first !== 'number' ) {
      item.first = val
      item.max = val
      item.min = val
      item.sum = 0
      item.sumsq = 0
      item.count = 0
      item.sumDelta = 0
      item.sumsqDelta = 0
      item.countDelta = 0
    }
    item.current = val
    if( val > item.max ) item.max = val
    if( val < item.min ) item.min = val
    item.count = item.count + 1
    item.sum = (item.sum || 0) + val
    item.sq = (item.sq || 0) + (val * val)
    item.average = _filter( item.average, item.current )
  }

  function _diff( item, val ) {

    if( typeof item.currentDelta === 'number' ) item.previousDelta = item.currentDelta
    if( typeof item.previous === 'number' ) {
      item.currentDelta = val - item.previous
      item.countDelta += 1
      item.sumDelta += item.currentDelta
      item.sumsqDelta += (item.currentDelta * item.currentDelta)
      item.averageDelta = _filter( item.averageDelta, item.currentDelta )
    }
  }

  function sampleAccumulating( v ) {
    _descrip( value, v )
    _diff( value, v )
  }

  function sample( v ) {
    _descrip( value, v )
  }

  /**
   * get the accumulated values
   */
  function values() {
    value.range = (value.current || 0) - (value.first || 0)
    value.caption = caption
    return value
  }

  function clear() {
    value = {}
  }

  function render() {

  }

  return { sample: sample, sampleAccumulating: sampleAccumulating, values: values, clear: clear, render: render }
}
