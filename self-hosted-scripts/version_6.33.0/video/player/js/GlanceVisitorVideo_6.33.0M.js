/*globals GLANCE, Player, ebml */

if( !window.GLANCE ) window.GLANCE = {}

GLANCE.VideoDebug = true
GLANCE.LogToServer = false
/* simple browser Javascript for Glance visitor video */
GLANCE.MessageSkip = 100
GLANCE.PacketstatLookback = 20
GLANCE.ObjectSerialNumber = 0
/* debugging: choose a player */
GLANCE.ForceBroadway = false
GLANCE.ForceMSE = false
/********************* catch-up logic ***************************/
/* if the current depth, measured in frames, of the decode queue is this or more, skip rendering */
GLANCE.MaximumQueueDepthToRender = 3
/* if the current depth, measured in frames, of the decode queue is this or more, skip rendering */
GLANCE.MaximumQueueDepthToRestart = 20
/* don't restart to make the decode queue smaller until at least this time has expired. */
GLANCE.MinimumTimeBetweenQueueDepthRestarts = 5000
/* If processing takes this fraction of a frametime, we're considered overloaded
 * and need to scale back with a Slower command  */
GLANCE.FrametimeOverloadFraction = 0.75
/* We scale back if this many consecutive frames are overloaded */
GLANCE.OverloadedFramecount = 10
/* We scale back if this much consecutive time is spent skipping */
GLANCE.SkipDurationThreshold = 2000
/* fire the rates event this often, seconds */
GLANCE.RatesReporting = 30


/* Handle decoder warmup for IE11.
 * When we detect that the time to decode a frame has
 * gone above _highWarmupThreshold and then gone down
 * below _lowWarmupThreshold again,
 * sent a Start command.
 */
GLANCE.LowWarmupThreshold = 250
GLANCE.HighWarmupThreshold = 1000

GLANCE.GVVScriptElement = document.currentScript

GLANCE.Video = function GLANCEVideo() {
  var _this = this

  var _offer
  var _guestid
  var _conntype
  var _gpu
  var _relay = {}
  var _videoDiv
  var _videoDivStyle
  var _isTargetScalable
  var _canvas
  var _player
  var _ws
  var _renderedFrameCount = 0
  var _skippedFrameCount = 0
  var _frameCount = 0
  var _frameTime = 0
  var _previousFrameTime = 0
  var _previousFrameAccepted = false
  var _currentDecodeLag = 0
  var _maxDecodeElapsed = 0
  var _streamCount = 0
  var _sentSlower = false
  var _sentIEStart = false
  var _sentIELagStart = 0
  var _restartPending = false
  var _playerVersion = '409.1.53'
  var _sessionKey
  var _clientKey
  var _clients = new Map()


  var _isIE11 = isIE11()
  var _visibiltyMonitorEnabled = false

  _this.mime = null
  _this.Timestamp = 0
  _this.Keyframe = false
  _this.TimecodeScale = 1
  _this.nominalFramerate = 8
  _this.frameDuration = 125.0
  _this.consecutiveOverloadedFrames = 0
  _this.skipStart = 0

  var _worker

  _this.playerType = 1  /* Broadway */
  if( GLANCE.ForceMSE ) {
    _this.playerType = 0  /* MSE */
  }
  else if( GLANCE.ForceBroadway ) {
    _this.playerType = 1  /* Broadway */
  }
  else if( window.MediaSource && (typeof Android === 'undefined') && window.MediaSource.isTypeSupported( GLANCE.MSEPlayerSourceType ) ) {
    _this.playerType = 0 /* MSE */
  }

  _this.version = function version() {
    return _playerVersion
  }

  GLANCEVideo.prototype.onWorkerMessage = function( message ) {
    var action = message.data.action;
    var params = message.data.params || {};
    let extracaps
    switch ( action ) {
      case "session":
        _relay.session = params.session
        _relay.guestid = _guestid
        _relay.conntype = _conntype

        /* coerce actual numbers for frame dimensions */
        if( _relay.session.videoWidth ) _relay.session.videoWidth = Number( _relay.session.videoWidth )
        if( _relay.session.videoHeight ) _relay.session.videoHeight = Number( _relay.session.videoHeight )

        if( _relay && _relay.session && _relay.session.videowidth && _relay.session.videoheight ) {
          /* original size request */
          var rect = _videoDiv.getBoundingClientRect()
          _this._setPlayerOptions( rect.width, rect.height, _isTargetScalable )
          _this._makePlayer( _relay.session.MIME )
          fireEvent( 'resize', _videoDiv,
            _relay.session.videowidth, _relay.session.videoheight, _relay.session.videowidth, _relay.session.videoheight, _relay )
        }
        break;
      case "start":
        if( params.mime ) {
          _relay.mime = params.mime
          _restartPending = false
          _sentIELagStart = 0
          _this.skipStart = 0
          _streamCount = params.streamCount
          _this._makePlayer( _relay.mime )
          fireEvent( 'start', _relay )
        }
        else {
          var ua = navigator.userAgent
          GLANCE.Send( 'Log notice player parameters: gpu: ' + _gpu + ' guestid: ' + _guestid + ' conntype: ' + _conntype + ' UA:' + ua )
          fireEvent( 'start', 0, 0, _relay )
        }
        if( _player && _player.onStreamStarting && typeof _player.onStreamStarting === 'function' ) {
          _player.onStreamStarting()
        }
        break;
      case "stop":
        if (_player){
          _player.realFramerate = undefined
        }
        if( _player && _player.onStreamStopping && typeof _player.onStreamStopping === 'function' ) {
          _player.onStreamStopping(params.restarting)
        }
        break;
      case "close":
        fireEvent( 'log', 'Websocket close caused session disconnection', _relay )
        break;
      case "error":
        if( params.message ) {
          fireEvent( 'error', params.message, _relay )
        }
        else if( params.data ) {
          fireEvent( 'error', params.data, _relay )
        }
        break;
      case "warning":
        if( params.message ) {
          fireEvent( 'warning', params.message, _relay )
        }
        break;
      case "log":
        if( params.message ) {
          fireEvent( 'log', params.message, _relay )
        }
        break;
      case "format":
        if( params.message ) {
          fireEvent( 'format', params.message, _relay )
        }
        break;
      case "codec":
        if( params.mime ) {
          fireEvent( 'codec', params.mime, _relay )
        }
        break;
      case "resize":
        if( params.width && params.height ) {
          fireEvent( 'resize', _videoDiv,
            params.width, params.height, _relay.session.videowidth, _relay.session.videoheight, _relay )
        }
        break;
      case "realFramerate":
        if( params.realFramerate ) {
          if (_player){
            GLANCE.VideoDebug && console.log("Setting real framerate to " + params.realFramerate)
            _player.realFramerate = params.realFramerate
          }else{
            console.log(_player)
          }
        }
        break;
      case "connectionSerial":
        if( params.number ) {
          _relay.connectionSerial = params.number
        }
        break;
      case "guestCountChanged":
        if( params.count ) {
          fireEvent( 'guestCountChanged', params.count, _relay )
        }
        break;
      case "videoDebug":
        GLANCE.VideoDebug = params.videoDebug
        break;
      case "end":
        fireEvent( 'end', _frameCount, _relay )
        break;
      case "tooSlow":
        fireEvent( 'tooSlow', _frameCount, _relay )
        break;
      case "decode":
        if( _player && params.payload && params.infos ) {
          _player.itemCount = params.infos.itemCount
          _player.streamCount = params.infos.streamCount
          _player.decode( params.payload, params.infos )
        }
        break;
      case "decoding":
        if( GLANCE.VideoDebug ) {
          var frameType = 'ordinary:'
          if( params.metadata.keyframe ) frameType = 'keyframe:'
          else if( params.metadata.globalnalu ) frameType = '  global:'
          logLevel( 2, 'decode', _frameCount, frameType, 'nalunittype', params.nalunittype, 'bytes', params.bytes,
            'enqueueStart', params.infos.enqueueStart.toFixed( 0 ), 'item', params.infos.itemCount, 'deboxLag', params.deboxLag )
        }
        break;
      case "firstPacket":
        _relay.startTimestamp = millisecondNow();
        break;
      case "dimensions":
        if( _player ) {
          _player.setSourceDimensions( { width: params.width, height: params.height } )
        }
        extracaps = {
          streamWidth: Math.round(params.width),
          streamHeight: Math.round(params.height)
        }
        updateCaps(null, extracaps)
        break;
      case "rates":
        extracaps = {
          bitrate: Math.round(params.averageBitrate),
          framerate: Number(params.averageFramerate.toFixed(2)),
          packetrate: Number(params.averagePacketrate.toFixed(2)),
          streamWidth: Math.round(params.width),
          streamHeight: Math.round(params.height)
        }
        updateCaps(null, extracaps)
        fireEvent( 'rates', params, _relay )
        break;
      case "t":
        // telemetry
        try {
          handleTelemetry( params )
        }
        catch ( ex ) {
          console.error( 'Failure handling telemetry', params )
        }
        break;
      case "closed":
        try {
          handleClosed( params.toString() )
        }
        catch ( ex ) {
          console.error( 'Failure handling closed', params )
        }
        break;
    }
  }

  /**
   * handle incoming telemetry
   * @param {object} telemetry message
   */
  function handleTelemetry( telemetry ) {
    const client = telemetry.client
    if( telemetry.browserCapabilities ) {
      const caps = telemetry.browserCapabilities
      if (client === _clientKey) {
        /* echo back of our own caps, with rttPing data from VServer */
        caps.self = true
      }
      _clients.set (client, {browserCapabilities: caps})
      //todo show the client list console.log ('clients in accepter ' + _clientKey, _clients)
    }
  }

  /**
   * handle incoming Closed message, to remove stored telemetry
   * @param {string} client
   */
  function handleClosed ( client ) {
    _clients.delete( client )
  }


  GLANCEVideo.prototype.workerEvent = function( name, params ) {
    params = params || {}
    params.config = {
      LogToServer: GLANCE.LogToServer,
      VideoDebug: GLANCE.VideoDebug,
      RatesReporting: GLANCE.RatesReporting,
      sentIEStart: _sentIEStart
    }
    if( _worker ) {
      _worker.postMessage( { action: name, params: params } )
    }
    else {
      console.error( "Glance Visitor Video Worker not defined yet." )
    }
  }

  GLANCEVideo.prototype.renderFramePrepare = function( data ) {
    try {
      _frameCount += 1
      _previousFrameTime = _frameTime
      _frameTime = millisecondNow()
      var frameTimestamp = _frameTime - _relay.startTimestamp
      _this.workerEvent( "frameTimes", { sample: frameTimestamp } )
      var notGreenSlime = (_player instanceof GLANCE.MSEPlayer) ? true : isGoodFrame( data, this.getDecodedData, _previousFrameAccepted, 20 )
      _previousFrameAccepted = notGreenSlime

      var doTheRender = true
      if( data.infos && data.infos.timestamp ) {
        var infos = data.infos
        var enqueuedItemCount = _player.itemCount || 0
        var enqueuedStreamCount = _player.streamCount || 0
        var dequeuedItemCount = infos.itemCount || 0
        var dequeuedStreamCount = infos.streamCount || 0
        infos.renderStart = _frameTime
        _currentDecodeLag = frameTimestamp - infos.timestamp
        var decodeElapsed = (infos.startDecoding && infos.finishDecoding) ? infos.finishDecoding - infos.startDecoding : 0
        _maxDecodeElapsed = Math.max( _maxDecodeElapsed, decodeElapsed )
        var queueElapsed = (infos.enqueueStart) ? _frameTime - infos.enqueueStart : 0
        var decodeLag = queueElapsed - decodeElapsed
        /* is there a new stream coming into the queue?
         * If so, unceremoniously skip rendering frames from the old one. */
        if( enqueuedStreamCount !== dequeuedStreamCount ) return false
        /* we're in the same stream. How many items are enqueued in the decoder ?*/
        var queueLength = enqueuedItemCount - dequeuedItemCount
        doTheRender = queueLength <= GLANCE.MaximumQueueDepthToRender
        doTheRender = doTheRender && notGreenSlime
        /* detect a threshold duration of consecutive skipped frames to throttle with Slower */
        var slower = ''
        if( !doTheRender ) {
          if( _this.skipStart <= 0 ) _this.skipStart = _frameTime
          var skipDuration = _frameTime - _this.skipStart
          GLANCE.VideoDebug && GLANCE.LogToServer &&
          log( 'Log info queue:' + queueLength + ' queued for ' + queueElapsed.toFixed( 0 ) + 'ms skipDuration:' + skipDuration.toFixed( 0 ) + 'ms' )
          if( skipDuration >= GLANCE.SkipDurationThreshold ) {
            /* Handle throttling for slow browsers
             * (IE11, we're looking at you).
             * When the queue gets too deep
             * send the Slower command.
             * Only send Slower once per every new / restarted stream.
             * If the origin can't handle another Slower it won't
             * restart the stream, so _sentSlower will never
             * get reset, so we will avoid a deluge of
             * messages from a slow browser.
             */
            if( !(_isIE11 && !_sentIEStart) && !_sentSlower ) {
              _sentSlower = true
              slower = 'slower'
              GLANCE.Send( 'Slower' )
              _sentIELagStart = _frameTime + GLANCE.MinimumTimeBetweenQueueDepthRestarts
              skipDuration = 0.001 * skipDuration
              GLANCE.Send( 'Log notice Slower: long skip ' + skipDuration.toFixed( 3 ) + 's ' +
                ' rendered:' + _renderedFrameCount + ' skipped:' + _skippedFrameCount )
            }
            _this.skipStart = _frameTime
          }
        }
        else _this.skipStart = _frameTime

        /* always render the very first eligible (non-slimy) frame,
         * giving the IE11-using visitor something to look at
         * while the decoder gets loaded into their almost-in-time compiler.
         */
        if( _renderedFrameCount === 0 && notGreenSlime ) doTheRender = true

        /* Handle decoder warmup for IE11.
         * When we detect that the time to decode a frame has
         * gone above a chosen threshold and then gone down again,
         * sent a Start command.
         * This is because the decoder asm.js in IE11
         * decodes the first few frames very slowly. Once
         * it has "warmed up" it decodes them at a normal rate.
         * Sending the "Start" command lets IE11 catch up
         * by starting a new stream.
         */
        /* handle the rest of the IE11 almost-in-time problems */
        if( _isIE11 && !_sentIEStart ) {
          if( _frameCount === 20 || (decodeElapsed <= GLANCE.LowWarmupThreshold && _maxDecodeElapsed >= GLANCE.HighWarmupThreshold && _frameCount >= 5) ) {
            _sentIEStart = true
            _sentIELagStart = _frameTime + GLANCE.MinimumTimeBetweenQueueDepthRestarts
            _restartPending = true
            _this.workerEvent( "ieStart", { sentIEStart: true } )
            GLANCE.Send( 'Log info IE11 Start: warmup done. decodeElapsed:' + decodeElapsed + ' frames:' + _frameCount +
              ' rendered:' + _renderedFrameCount + ' skipped:' + _skippedFrameCount )
          }
          GLANCE.VideoDebug && GLANCE.LogToServer &&
          GLANCE.Send( 'Log info IE11 queue decodeElapsed:' + decodeElapsed +
            ' maxDecodeElapsed:' + _maxDecodeElapsed +
            ' frameCount:' + _frameCount + ' streamCount:' + _streamCount )
        }
        /* queue building up after warmup complete */
        if( _sentIELagStart <= 0 ) _sentIELagStart = _frameTime + GLANCE.MinimumTimeBetweenQueueDepthRestarts
        if( _isIE11 && _sentIEStart ) {
          if( queueLength > GLANCE.MaximumQueueDepthToRestart ) {
            var timeLeft = _sentIELagStart - _frameTime
            if( timeLeft <= 0 ) {
              _restartPending = true
              _this.workerEvent( "ieStart" )
              GLANCE.Send( 'Log info IE11 Start: queue too long:' + queueLength )
              _sentIELagStart = _frameTime + GLANCE.MinimumTimeBetweenQueueDepthRestarts
            }
            GLANCE.VideoDebug && GLANCE.LogToServer &&
            GLANCE.Send( 'Log info ie11queue decodeElapsed:' + decodeElapsed + ' queueLength:' + queueLength +
              ' timeLeft:' + timeLeft.toFixed( 1 ) + 'ms ' +
              ' maxDecodeElapsed:' + _maxDecodeElapsed +
              ' frameCount:' + _frameCount + ' streamCount:' + _streamCount )
          }
        }
        if( _restartPending || infos.streamCount < _streamCount ) doTheRender = false

        if( GLANCE.VideoDebug && GLANCE.VideoDebug >= 2 ) {
          var slime = notGreenSlime ? '' : 'slime'
          var skip = doTheRender ? '' : 'skip'

          log( '   Render start:', millisecondNow().toFixed( 0 ),
            'currQItem', _player.itemCount || 0,
            'thisItem', infos.itemCount,
            'decodeLag', decodeLag.toFixed( 1 ),
            'decodeElapsed', decodeElapsed.toFixed( 1 ),
            'queueElapsed', queueElapsed.toFixed( 1 ),
            skip, slime, slower )
        }

        if( doTheRender ) {
          fireEvent( 'progress', frameTimestamp, _frameCount, _relay )
          _renderedFrameCount += 1
        }
        else {
          _skippedFrameCount += 1
        }
        return true
      }
    }
    catch ( error ) {
      log( 'Log error ' + JSON.stringify( error ) )
    }
    return true
  }

  /**
   * handler when frame rendering is complete (notification only)
   * @param data
   */
  GLANCEVideo.prototype.renderFrameComplete = function( data ) {
    var ts = millisecondNow()
    if( data.infos ) {
      var infos = data.infos

      var decodeElapsed = (infos.startDecoding && infos.finishDecoding) ? infos.finishDecoding - infos.startDecoding : 0
      var queueLength = _player.itemCount - infos.itemCount
      var renderTime = ts - infos.renderStart
      var processingTime = decodeElapsed + renderTime
      if( !(_isIE11 && !_sentIEStart) &&
        queueLength <= GLANCE.MaximumQueueDepthToRender &&
        processingTime >= (GLANCE.FrametimeOverloadFraction * _this.nominalFrameDuration) ) {
        _this.consecutiveOverloadedFrames += 1
        if( GLANCE.VideoDebug && GLANCE.LogToServer ) {
          GLANCE.Send( 'Log info render complete: decode:' + decodeElapsed + 'ms render: ' + renderTime.toFixed( 1 ) +
            'ms processing:' + processingTime.toFixed( 1 ) +
            'ms consecutiveOverloadedFrames:' + _this.consecutiveOverloadedFrames +
            ' queueLength:' + queueLength +
            ' frameCount:' + _frameCount + ' streamCount:' + _streamCount )
        }
      }
      else _this.consecutiveOverloadedFrames = 0

      var slower = ''
      if( _this.consecutiveOverloadedFrames >= GLANCE.OverloadedFramecount ) {
        if( !_sentSlower ) {
          _sentSlower = true
          slower = 'slower'
          GLANCE.Send( 'Slower' )
          GLANCE.Send( 'Log notice Slower: too many consecutive frames processed slowly: ' + _this.consecutiveOverloadedFrames )
          _sentIELagStart = _frameTime + GLANCE.MinimumTimeBetweenQueueDepthRestarts
          _this.consecutiveOverloadedFrames = 0
        }
      }

      if( GLANCE.VideoDebug && GLANCE.VideoDebug >= 2 ) {
        var unusedTime = _this.frameDuration - processingTime
        log( 'Render complete:', _frameCount, millisecondNow().toFixed( 0 ),
          'queueLength', queueLength,
          'renderTime', renderTime.toFixed( 1 ),
          'processingTime', processingTime.toFixed( 1 ),
          'unusedTime', unusedTime.toFixed( 1 ), slower )
      }
    }
    fireEvent( 'progress', ts - _relay.startTimestamp, _frameCount, _relay )
  }

  /**
   * handler when frame size / aspect ratio changes
   * @param data
   */
  GLANCEVideo.prototype.frameSizeChange = function( data ) {
    fireEvent( 'screen', {
      screen: { width: data.sourceWidth, height: data.sourceHeight },
      view: { width: data.targetWidth, height: data.targetHeight },
      scaledview: { width: data.targetWidth, height: data.targetHeight },
      decoded: { width: data.decodedWidth, height: data.decodedHeight }
    }, _relay )
    if( GLANCE.VideoDebug )
      console.log( 'frameSizeChange', data )
  }

  /**
   * set the player's options.
   * @param targetWidth the width of the incoming video stream
   * @param targetHeight the height ...
   * @param targetScalable boolean, will the rendered video rescale?
   * @param backgroundColor background color of the player div.
   * @param mime  MIME type of incoming stream
   * @private
   */
  GLANCEVideo.prototype._setPlayerOptions = function( targetWidth, targetHeight, targetScalable, backgroundColor,
                                                      mime ) {
    
    let options = getUrlOptions();
    _this.playerOptions =
      {
        reuseMemory: true,
        webgl: _gpu === 1 ? 'auto' : false,
        useWorker: 'auto',
        workerFile: options.baseURL + 'Decoder' + options.version,
        backgroundColor: backgroundColor || _videoDivStyle.getPropertyValue( 'background-color' ),
        targetScalable: targetScalable,
        size: {
          width: targetWidth,
          height: targetHeight
        }
      }
    if( mime && typeof mime == 'string' && mime.length > 0 ) _this.mime = mime
  }
  GLANCEVideo.prototype._makePlayer = function( mime ) {
    if( mime && typeof mime == 'string' && mime.length > 0 ) _this.mime = mime
    if( _player ) return _player
    try {
      if( _this.mime.indexOf( 'video/' ) === 0 ) {
        if( _this.playerType == 0 && window.MediaSource && (typeof Android === 'undefined') && window.MediaSource.isTypeSupported( GLANCE.MSEPlayerSourceType ) ) {
          _player = new GLANCE.MSEPlayer( _this.playerOptions )
        }
        else {
          console.log("Creating Player");
          _player = new Player( _this.playerOptions )
        }
        /* set event handlers for the Player object we just made. */
        _player.onRenderFramePrepare = GLANCEVideo.prototype.renderFramePrepare
        _player.onRenderFrameComplete = GLANCEVideo.prototype.renderFrameComplete
        _player.onRequestKeyframe = GLANCEVideo.prototype.requestKeyframe
        _player.onRequestSlower = GLANCEVideo.prototype.requestSlower
      }
      else if( _this.mime.indexOf( 'image/jpeg' ) === 0 ) {
        _player = new GLANCE.JpegPlayer( _this.playerOptions )
        _player.renderFrameComplete = function() {
          _frameCount += 1
          var ts = millisecondNow()
          _frameCount += 1
          fireEvent( 'progress', ts - _relay.startTimestamp, _frameCount, _relay )
        }
      }
      else console.error( 'unknown MIME type ' + mime )

      _player.onFrameSizeChange = function( data ) {
        fireEvent( 'screen', {
          screen: { width: data.sourceWidth, height: data.sourceHeight },
          view: { width: data.targetWidth, height: data.targetHeight },
          scaledview: { width: data.targetWidth, height: data.targetHeight }
        }, _relay )
        if( GLANCE.VideoDebug )
          console.log( 'frameSizeChange', data )
      }

      this.bitstream = ''
      _canvas = _player.domNode
      _videoDiv.appendChild( _canvas )
    }
    catch ( exc ) {
      console.log(exc.message);
      fireEvent( 'error', 'Failed to create decoder', _relay )
    }
    return _player
  }

  GLANCEVideo.prototype._deletePlayer = function() {
    if( _player ) {
      if( _videoDiv && _videoDiv.hasChildNodes() ) {
        var nodes = _videoDiv.childNodes
        for( var i = 0; i < nodes.length; i++ )
          if( nodes[i] === _canvas )
            _videoDiv.removeChild( nodes[i] )
      }
      _canvas = null
      _player.deletePlayer()
    }
  }

  GLANCEVideo.prototype._monitorVisibility = function( element ) {
    const visibilityAnnouncer = function( vis, extra ) {
      const msg = (vis ? 'visible' : 'hidden') + (extra ? ' ' + extra : '')
      fireEvent( 'visibilitychange', vis, msg )
      updateCaps( null, { visibility: vis } )
      if( _ws && _ws.send && typeof _ws.send === 'function' ) _ws.send( 'Log info ' + msg )
    }
    /* window visibility */
    /* locate document parent of video container div */
    let el = element
    while ( el ) {
      if( el.nodeType === Node.DOCUMENT_NODE ) break
      el = el.parentNode
    }
    if( !el ) el = document
    if( typeof el.hidden !== 'undefined' ) {
      el.addEventListener( 'visibilitychange', function() {
        visibilityAnnouncer( el.visibilityState === 'visible', 'document' )
      } )
    }

    const intersection = function( entries, observer ) {
      let intersect = false
      for( let i = 0; i < entries.length; i++ ) {
        intersect = intersect || entries[i].isIntersecting
      }
      visibilityAnnouncer( intersect, 'element' )
    }
    /* intersection observer visibility */
    if( typeof IntersectionObserver === 'function' ) {
      const observer = new IntersectionObserver( intersection, { threshold: 0.2 } )
    }

    return true
  }

  /**
   * get browserCapabilities, initializing if necessary
   * @param {object|null} caps
   * @returns {object|null}
   */
  function getCaps (caps) {
    if (!caps) {
      if( _clients.has( _clientKey ) ) {
        caps = _clients.get( _clientKey ).browserCapabilities
      }
      else {
        caps = JSON.parse( JSON.stringify( GLANCE.browserCapabilities ) ) /* deep copy */
        caps.role = 'accept'
        caps.self = true
        caps.visibility = true
      }
    }
    return caps
  }

  /**
   * update browserCapabilities
   * @param {object|null} caps
   * @param {object|null} extra
   * @returns{object}
   */
  function updateCaps( caps, extra = null ) {
    /* give browser capabilities to worker */
    caps = getCaps(caps)
    caps.screenWidth = screen.width  /* current screen hopefully */
    caps.screenHeight = screen.height
    if (window.devicePixelRatio){
      caps.devicePixelRatio = window.devicePixelRatio
    }else{
      caps.devicePixelRatio = 1
    }
    if (extra) {
      for (let key in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, key)) continue;
        caps[key] = extra[key]
      }
    }
    _clients.set( _clientKey, { browserCapabilities: caps } )
    _this.workerEvent( 'browserCapabilities', {clientKey: _clientKey, browserCapabilities: caps } )
    return caps
  }

  function getUrlOptions() {
    let srcURL = GLANCE.GVVScriptElement.getAttribute( 'src' );
    let filename = srcURL.lastIndexOf( '/' ) + 1;
    let baseURL = srcURL.slice( 0, filename );
    let version = null;
    let scriptVersionIndex = srcURL.lastIndexOf('_')
    let path = srcURL.substring(0, srcURL.lastIndexOf("/"));
    
    if (scriptVersionIndex >= 0) {
      version = srcURL.slice(scriptVersionIndex)
    } else {
      version = '.js'
    }
    
    return {baseURL: baseURL, path: path, version: version};
  }
  
  /**
   * start playing
   * @param offer pass code or URL of the offer
   * @param videoDiv the <div> in which to place the canvas
   * @param isTargetScalable true if the rendered video scales to window size (slow without webGL)
   * @param extra parameters (guestid, conntype, gpu) or null if none.
   */
  GLANCEVideo.prototype.start = function start( offer, videoDiv, isTargetScalable, extra ) {
    _isTargetScalable = isTargetScalable
    _offer = offer
    _guestid = extra.guestid
    _conntype = extra.conntype
    _gpu = Number( extra.gpu )
    _relay.videoDiv = videoDiv
    _videoDiv = videoDiv
    _videoDivStyle = window.getComputedStyle( _videoDiv )
    _sessionKey = Math.floor( Math.random() * Number.MAX_SAFE_INTEGER ).toString( 16 )
    _clientKey = GLANCE.browserCapabilities.browserId + '|' + _sessionKey

    _videoDiv.relay = _relay
    if( !_visibiltyMonitorEnabled ) _visibiltyMonitorEnabled = _this._monitorVisibility( videoDiv )

    if( _worker ) {
      _this.workerEvent( "stop" )
    }

    let options = getUrlOptions();

    let url = options.baseURL + "GlanceVisitorVideoWorker" + options.version;
    fetch(url)
      .then(response => {
        if(response.status === 200) {
          return response.blob();
        }
      }).then(blob => {
        let workerUrl = URL.createObjectURL(blob);
        _worker = new Worker(workerUrl);
        URL.revokeObjectURL(workerUrl);
        _worker.onmessage = this.onWorkerMessage.bind( this );
        // Sending cobrowse script version and path to worker to load some versioned scripts
        _worker.postMessage({action: "version", version: options.version, path: options.path});

        /* give browser capabilities to worker */
        var clientWidth = window.innerWidth
        var clientHeight = window.innerHeight
        if (videoDiv){
          const rect = videoDiv.getBoundingClientRect()
          if (rect && rect.width && rect.height && (rect.width>0) && (rect.height>0)){
            clientWidth = Math.round(rect.width)
            clientHeight = Math.round(rect.height)
          }
        }
        updateCaps( null, {clientWidth: clientWidth, clientHeight: clientHeight} )
        _this.workerEvent( "start", { offer: _offer, extra: extra, userAgent: navigator.userAgent, clientWidth: clientWidth, clientHeight: clientHeight, clientKey: _clientKey } )
      }).catch( error => {
        console.warn('fetch URL' + url + ' onerror called')
        console.warn('Message : ' + error.message)
      });
  }

  GLANCEVideo.prototype.requestKeyframe = function requestKeyframe() {
    _this.workerEvent( "requestKeyframe" )
  }

  GLANCEVideo.prototype.requestSlower = function requestSlower(reason) {
    _this.workerEvent( "requestSlower", {reason: reason} )
  }

  GLANCEVideo.prototype.resize = function resize( width, height ) {
    if( _player ) {
      _player.setTargetDimensions( { width: width, height: height } )
    }
    /* update browser caps, give to worker */
    updateCaps( null, { clientWidth: Math.round( width ), clientHeight: Math.round( height ) } )
  }

  GLANCEVideo.prototype.size = function size() {
    if( _player ) {
      return _player.getTargetDimensions()
    }
  }

  /**
   * stop playing
   */
  GLANCEVideo.prototype.stop = function stop() {
    _this.workerEvent("stop")
  }

  /**
   *  send an immediate command to the server
   */
  GLANCEVideo.prototype.command = function command( cmdstring ) {
    _this.workerEvent("send", {command: cmdstring})
  }

  GLANCE.Send = function send( command ) {
    if( command && typeof command === 'string' && command.length > 0 ) {
      _this.workerEvent("send", {command: command})
      return command
    }
  }

  /**
   * @param glanceAddress
   * @param sessionKey
   * @param sessionType
   */
  GLANCEVideo.prototype.sendSessionInvitation = function sendSessionInvitation( glanceAddress, sessionKey,
                                                                                sessionType ) {
    GLANCE.Send( 'Passthrough SessionInvitation ' + 'username=' + glanceAddress + '&sessionkey=' + sessionKey + '&sessiontype=' + sessionType )
  }

  /**********************************************/
  /* event handling stuff for this little class */

  _this.events = {}

  GLANCEVideo.prototype.addEventListener = function addEventListener( name, handler ) {
    if( _this.events.hasOwnProperty( name ) )
      _this.events[name].push( handler )
    else
      _this.events[name] = [handler]
  }

  GLANCEVideo.prototype.removeEventListener = function removeEventListener( name, handler ) {
    /* This is a bit tricky, because how would you identify functions?
     This simple solution should work if you pass THE SAME handler. */
    if( !_this.events.hasOwnProperty( name ) )
      return

    var index = _this.events[name].indexOf( handler )
    if( index !== -1 ) {
      _this.events[name][index] = null
      _this.events[name].splice( index, 1 )
      if( _this.events[name].length === 0 ) {
        delete _this.events[name]
      }
    }
  }

  /**
   * first arg is event name. subsequent args passed to handler.
   */
  function fireEvent( name ) {
    /* no event handlers for this event? then do nothing */
    if( !_this.events.hasOwnProperty( name ) ) return

    /* make an array from the rest of the arguments array-like object */
    var args = Array.prototype.slice.call( arguments, 1 )

    var eventList = _this.events[name]
    for( var i = 0; i < eventList.length; i++ ) {
      var event = eventList[i]
      if( event && typeof event === 'function' && typeof event.apply === 'function' ) {
        event.apply( null, args )
      }
    }
  }

/*  from iOS device capture, sometimes a few frames have a full-frame green artifact.
*  termed "green slime". The next code detects those artifacts and suppresses
*  display of those frames. This needs to be done differently for
*  yuv rendering (where WebGL is available) and argb rendering (where WebGL
*  isn't available). The detection examines a transect--a one-row
*  subsample--for its color characteristics. It rejects frames
*  with the characteristics of green slime in that transect.
*/

function clamp( val ) {
  if( val >= 255 ) return 255
  if( val <= 0 ) return 0
  return Math.floor( val )
}

function sampleAllChannelsYuv( data, sample, transectLen ) {
  var y = sample( data, 'y', 0.5, 0.5, transectLen )
  var u = sample( data, 'u', 0.5, 0.5, transectLen )
  var v = sample( data, 'v', 0.5, 0.5, transectLen )

  var r = new Uint8Array( transectLen )
  var g = new Uint8Array( transectLen )
  var b = new Uint8Array( transectLen )

  for( var i = 0; i < y.byteLength; i++ ) {
    var yv = y[i]
    var uvm = u[i] - 128
    var vvm = v[i] - 128
    r[i] = clamp( yv + 1.4075 * vvm )
    g[i] = clamp( yv - (0.3455 * uvm) - (0.7169 * vvm) )
    b[i] = clamp( yv + 1.7790 * uvm )
  }
  return { r: r, g: g, b: b }
}

/* In version 4.5.1.x of Panorama Mac, iOS devices can send green slime. See Case 14268.
  * This slime is characterized by flat zero red and blue values in the red and blue transects.
  * The green appears to have a reasonable image.
  * So the slime is easy to detect once we know the transects' RGB values.
  */
function isGoodFrame( data, sample, first, transectLen ) {
  var rst
  var bst
  if( data.infos.webgl ) {
    var rgb = sampleAllChannelsYuv( data, sample, transectLen )
    rst = rgb.r.stats()
    bst = rgb.b.stats()
  }
  else {
    rst = sample( data, 'r', 0.5, 0.5, transectLen ).stats()
    bst = sample( data, 'b', 0.5, 0.5, transectLen ).stats()
  }
  /* the slime is characterized by red and blue channels flat zero. */
  return !(rst.avg < 1 && bst.avg < 1 && rst.mad < 1 && bst.mad < 1)
}

  /* Polyfill for window.performance.now submillisecond timer */
  window.performance = window.performance || {}
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

  function millisecondNow() {
    /* Notice that worker.performance and window.performance times aren't in sync. */
    return window.performance.now()
  }

  function log() {
    if( !GLANCE.VideoDebug ) return
    var args = Array.prototype.slice.call( arguments )
    if( GLANCE.LogToServer ) {
      args.splice( 0, 0, 'Log', 'notice' )
      GLANCE.Send( args.join( ' ' ) )
    }
    else console.log.apply( console, args )
  }

  function logLevel(level) {
    if (GLANCE.VideoDebug && (GLANCE.VideoDebug >= level)) {
      var args = Array.prototype.slice.call( arguments, 1 )
      if( GLANCE.LogToServer ) {
        args.splice( 0, 0, 'Log', 'notice' )
        GLANCE.Send( args.join( ' ' ) )
      }
      else console.log.apply( console, args )
    }
  }

  /***
   * is the present browser IE111?
   * @returns {boolean}
   */
  function isIE11() {
    return navigator.userAgent.indexOf( 'Trident' ) !== -1
  }
}
