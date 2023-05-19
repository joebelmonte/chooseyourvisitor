// Copyright 2021 Glance Networks

'use strict'

// const { exception } = require("winston")

/*jshint esversion: 11 */
/* globals
bodyPix: false,
GLANCE: true
*/
/*jshint -W030*/

/*globals GLANCE, MediaRecorder */
if( !window.GLANCE ) window.GLANCE = {}

if (!GLANCE.Video) {
  GLANCE.Video = {}
  GLANCE.Video.BGEffectsLoaded = false
  GLANCE.Video.BGEffectsLoading = false
}

GLANCE.Video.VideoDebug = false
GLANCE.Video.LogVideoTelemetry = false

// log major entry point calls to console
GLANCE.Video.VideoDebugEntryPoints = false

GLANCE.Video.GlanceVideoSourceScriptElement = document.currentScript;

/* is agent blurring enabled at all. This is meant to turn it off altogether, not for dynamic state */
// default to true, use bgFilterEnabled to control this at construction
GLANCE.Video.AgentBlurEnabled = true;

/* WebMMediaRecorder loaded */
GLANCE.Video.polyfilledMediaRecorder = false;

GLANCE.Video.VideoSources = undefined;

GLANCE.Video.GlanceVideoSource = class {
  /**
   * VideoSource constructor
   * @param {object} opts -- width, height, framerate, bandwidth [, sessionkey, vserver, username, partnerid, partneruserid, loginkey, maincallid, maincid]
   * @constructor
   */
  constructor( opts ) {

    // GD-19010 Cobrowse visitor sessions fail to start on some older ios devices
    // The fileds below were moved to constructor to avoid public and public static class members
    /* MIME types this can produce */
    this.videoTypes = ['video/webm; codecs="avc1.42E01E"', 'image/jpeg']
    this.defaultVideoType = 'video/webm; codecs="avc1.42E01E"'

    /* set up options */
    this.defaults = {
      width: 352,
      height: 288,
      framerate: 24,
      sessionkey: '',
      bandwidth: '250kbps',
      vserver: 'https://' + window.location.host + '/',
      mime: null,
      modelID: 'browser',
      deviceName: null,
      maincallid: null,
      maincid: null,
      stopPreviewsOnSessionEnd: true,
      groupid: null,
      partnerid: null,
      username: null,
      isAnonymous: null,
      password: null,
      videoBackEnabled: false,
      bgBlur: false,
      bgType: 'blur',         // may be 'blur', 'fill' or 'image'
      bgColor: '#2E9CDD',     // Glance blue, why not
      bgImageURL: null,
      bgFilterEnabled: null,
      screenshare: false,
      screenshareSurfaces: null,
      segmentationModel: 'tflite'
    }

    // no const in class...
    this.authTags =
      ['username',
        'password',
        'partnerid',
        'groupid',
        'partneruserid',
        'loginkey',
        'isAnonymous']

    this.commandQueue = new GLANCE.Queue();
    this.history = new GLANCE.Queue();
    /////////////////////////////////////////////////

    // something to help differentiate GVS instances when debugging
    this.thisGVS = Math.random()

    this.options = opts || this.defaults
    for( let opt in this.defaults ) {
      if( !this.defaults.hasOwnProperty( opt ) ) continue
      if( !this.options.hasOwnProperty( opt ) ) this.options[opt] = this.defaults[opt]
    }
    if( !this.options.bitspersecond ) this.options.bitspersecond = GLANCE.Video.GlanceVideoSource.expandBandwidth( this.options.bandwidth )
    this.options.requestedbitspersecond = this.options.bitspersecond
    /* MIME type in use */
    this.mime = null
    /* current video source (webcam), and list of available sources */
    this.source = null
    this.systemDefaultSource = null
    this.torchState = false
    /* keep track of the <video> elements used for previews */
    this.activePreviews = new Set()
    this.requestedPreviews = new Set()
    this.frameMilliseconds = 10
    this.isClosing = false
    this.guestCount = 0
    this.transmitStarted = false
    this.mediaRecorderCount = 0
    this.paused = false
    this.keepAliveTimerID = null
    this.blurDenied = null        // since we can't fire Events yet when we know we can't blur, remember why and fire an event later, like sessionStart

    /* Websocket buffer limit (in milliseconds) */
    this.websocketBufferLimitInSeconds = 1000


    /* GD-14731 concerns MediaRecorder's bizarre interpretation of options.videoBitsPerSecond.
     * its interpretation sets the max bits/frame as if the frame rate were 60fps.
     * So, it's necessary to increase that value based on the frame rate.
     * If this value is falsey (missing or zero), the workaround is not applied */
    this.Workaround_14731 = 60

    /* history time, how often to report bandwidth history  ms. */
    this.historyTime = 30000
    /* history lookback, how far to look back for history reports  ms. */
    this.historyLookback = 3000
    /*  30000 / 3000 means every 30s we report the most recent 3s worth of data */


    this.lastSpeedChangeTime = null   // time of last change of video speed (Faster/Slower)
    this.speedChangeTimeout = 30000   // time until next speed change is accepted in ms

    this.segmentationModel = this.options.segmentationModel
    this.BGEffectsPromise = null
    this.BGEffectInitializedPromise = null

    this.bufferReconnect = false
    this.reconnectRetries = 0
    this.giveUpReconnect = false
    this.awaitingReconnect = false

    // this is computed by history report based on transmit - only valid if session running
    this.measuredFramesPerSecond = 0

    this.orientationChangedRestartTimeoutInMilliseconds = 250

    this.events = {}

    this.browserCapabilities = JSON.parse(JSON.stringify(GLANCE.browserCapabilities)) /* deep copy */
    this.browserCapabilities.width = screen.width   /* current screen hopefully */
    this.browserCapabilities.height = screen.height
    this.browserCapabilities.role = 'offer'
    this.browserCapabilities.self = true
    const sessionKey = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16)
    this.clientKey =  this.browserCapabilities.browserId + '|' + sessionKey

    // note that clients includes this object, so it looks like there is an extra
    this.clients = new Map()
    this.clients.set(this.clientKey, {browserCapabilities: this.browserCapabilities})
    this.telemetryRollcall = false

    this.rollcallCallback = null

    if( this.options.bgFilterEnabled != null )
      this.bgBlurEnabled = this.options.bgFilterEnabled
    else if (this.options.bgBlur !== null )
      this.bgBlurEnabled = this.options.bgBlur
    else
      this.bgBlurEnabled = GLANCE.Video.AgentBlurEnabled

    // don't load bodypix or allow blurring if we are screensharing
    // explicitly disable blurring if we are on iPad or FireFox
    // Android support for 5.1 not required so keep life simple
    this.bgBlurEnabled = this.bgBlurEnabled
      && !this.options.screenshare
      && !GLANCE.Video.GlanceVideoSource.isSafariIOS() /*&& GLANCE.Video.GlanceVideoSource.getBrowser() !== 'Safari'*/
      && !GLANCE.Video.GlanceVideoSource.isAndroid()

    if( this.bgBlurEnabled ) {
      this.bgBlurEnabled = this.webgl_support();
      if( !this.bgBlurEnabled )
        console.log( this.videoLogFormatter('NOTICE Background Blurring is disabled ' + this.blurDenied ))
    }

    this.profileManager = new GLANCE.Video.GlanceVideoProfileManager(opts, this.bgBlurEnabled, this)

    this.GVSVersion = null

    let srcURL = GLANCE.Video.GlanceVideoSourceScriptElement.getAttribute( 'src' )
    let filename = srcURL.lastIndexOf( '/' ) + 1
    this.GVSbaseURL = srcURL.slice( 0, filename )

    // pull the version substring off the file
    // we know all our versions are script_version.js
    // if no _, no version.
    let scriptVersionIndex = srcURL.lastIndexOf('_')

    if (scriptVersionIndex >= 0) {
      this.GVSVersion = srcURL.slice(scriptVersionIndex)
    }
    else {
      this.GVSVersion = '.js'
    }

    // load GlanceVideoBGEffects.js if required
    if( this.bgBlurEnabled && !GLANCE.Video.BGEffectsLoading) {
      if (!GLANCE.Video.BGEffectsLoaded) {
        GLANCE.Video.BGEffectsLoading = true
        // the the source of GlanceAgentVideo.js, replace with the tensorflow scripts

        let BGEffectsToLoad = null
        if (this.segmentationModel == 'selfiesegmentation') {
          BGEffectsToLoad = "GlanceVideoBGEffects"
        }
        else if (this.segmentationModel == 'tflite') {
          BGEffectsToLoad = "tflite/GlanceVideoBGEffects"
        }
        if (BGEffectsToLoad !== null) {
          GLANCE.Video.VideoDebugEntryPoints && console.log( this.videoLogFormatter( 'LOADING segmentation Model ' + BGEffectsToLoad ) )
          this.BGEffectsPromise = GLANCE.Video.dynamicallyLoadScript( this.GVSbaseURL + BGEffectsToLoad + this.GVSVersion )
        }
        else
        {
          console.warn(this.videoLogFormatter('Attempting to load unknown Segmentation model ' + this.segmentationModel + ' BG Effects disabled'))
        }
      }
      else {
        // if we are loaded we only need to wait on initialization.
        this.BGEffectsPromise = Promise.resolve()
      }
      if (this.BGEffectsPromise) {
        this.BGEffectsPromise.then( () => {
          GLANCE.Video.BGEffectsLoaded = true;
          GLANCE.Video.BGEffectsLoading = false
          //        GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( 'CONSTRUCTING GlanceVideoBGEffects' ))
          this.BGEffects = new GLANCE.Video.GlanceVideoBGEffects( this )
          //        GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( 'INITIALIZING GlanceVideoBGEffects' ))

          this.BGEffectInitializedPromise = this.BGEffects.initialize()
          this.BGEffectInitializedPromise.then( () => {
            // set effect specific parameters
            // if image, it's a good time to start the background image loading if we are doing 'image'
            this.BGEffects.setBackgroundSettings( this.options.bgType, this.options.bgColor, this.options.bgImageURL )
          } )
        } )
      }
    }

    this.mediaRecorderAvailablePromise = null

    if( (GLANCE.Video.GlanceVideoSource.getBrowser() === 'Safari'
        || GLANCE.Video.GlanceVideoSource.getBrowser() === 'Firefox'
        || GLANCE.Video.GlanceVideoSource.getBrowser() === 'Chrome') &&
      !(window.MediaRecorder &&
        typeof window.MediaRecorder === 'function' &&
        typeof window.MediaRecorder.isTypeSupported === 'function' &&
        window.MediaRecorder.isTypeSupported( 'video/webm; codecs="avc1.42E01E"' ))
    ) {

      this.mediaRecorderAvailablePromise = new Promise( ( resolve, reject ) => {
        if( GLANCE.Video.polyfilledMediaRecorder ) {
          resolve()
        }
        else {
          GLANCE.Video.polyfilledMediaRecorder = true
          GLANCE.Video.dynamicallyLoadScript( this.GVSbaseURL + 'WebMMediaRecorder' + this.GVSVersion )
          .then( () => MediaRecorder.load( this.GVSbaseURL ) )
          .then( () => resolve() )
        }
      } )
    }
    else {
      this.mediaRecorderAvailablePromise = Promise.resolve()
    }

    this.setupOrientationChangeHandlerIfNeeded()

    // this poor code was hanging around all by itself at the end of the file...
    this.commandQueue.setOptions( { handler: this.handleCommand,
      that: this} )

    /**
     * Debugging: send a command to the VServer
     * To use, give this sort of thing from the console REPL
     *     GLANCE.Send('Slower')
     * @param command string
     */
    if (!GLANCE.Send) {
      GLANCE.Send = this.send.bind(this)
    }
  }

  static reportOutOfMemory() {
    // Ouyt of memory happens on bg performance fail
    if(this.bgBlurEnabled) {
      this.fireEvent('bgFilterPerformanceFail');
    }
  }

  // see if we have webGL support if we want to blur
  // according to this: https://stackoverflow.com/a/22953053/63069
  // This is how three does it
  webgl_support() {

/*
    try {
      let canvas = document.createElement( 'canvas' );
      let glContext = canvas.getContext( 'webgl' )
      if( glContext ) {
        // see if it is up-to-date enough - if it has less than 200 uniforms it is almost certainly too weak
        // NOTE - this had been 1000 but Android Samsung Galaxy Tab S6 has 256 and runs beautifully.
        let numUniforms = glContext.getParameter( glContext.MAX_FRAGMENT_UNIFORM_VECTORS )
        if( numUniforms >= 200 )
          return true

        // it is too early to fireEvents - we are still constructing and no event handlers have been added.
        // just remember they wanted WebGL and couldn't have it and why, we will fire this in startSession
        this.blurDenied = 'Background Blurring requires a more powerful version of WebGL than is supported by your browser.'

        return false
      }
      else {
        this.blurDenied = 'Background Blurring requires WebGL which is not supported by your browser.'
        return false
      }
    }
    catch ( e ) {
      this.blurDenied = 'Background Blurring requires WebGL which is not supported by your browser.'
      return false;
    }

 */
    if( this.browserCapabilities.hasWebGL )
      return true

    this.blurDenied = this.browserCapabilities.WebGLError || 'WebGL capability unknown'
    return false
  }

  // set background settings that were previously available only in constructor.
  // this is primarily meant for dev at this time
  async setBackgroundSettings(effectType, color, url) {
    if (this.BGEffects) {
      await this.BGEffects.setBackgroundSettings(effectType,color,url)
      this.options.bgType = effectType
    }
  }

  /**
   * Notify us of how many accepters are expected to join a session.
   * After a restart, we can use this to void aborting or restarting until necessary
   * we will implement a timeout in case an accepter lags or drops to avoid waiting forever
   * @param {number} accepterCount
   */
  setAccepterCount(accepterCount) {
    GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter("SETACCEPTERCOUNT", accepterCount))
  }

  /**
   * retrieve option settings.
   * @returns {object} -- current option settings, updated to show current
   * todo:: later make this a getter
   */
  getOptions() {
    return this.options
  }

  /**
   * set options (like keys and passwords and all that)
   * @param {object }opts -- options structure
   * todo: later make this a setter
   */
  setOptions( opts ) {
    for( let opt in opts ) {
      if( !this.defaults.hasOwnProperty( opt ) ) continue
      // we need to be able to allow options to be false
      if( opts[opt] !== null && opts[opt] !== '' ) this.options[opt] = opts[opt]
    }
    this.profileManager.setOptions(this.options)
  }

  /**
   * get a list of video sources (cameras etc.), to choose one.
   * If the parameter to the callback is null, no sources or no permission
   * callback(null) if doing SS
   * @param {function} callback
   */
  getSources( callback ) {
    if( !GLANCE.Video.GlanceVideoSource.isBrowserCapable() || this.options.screenshare) {
      callback( null )
      return
    }
    this.getSystemDefaultSource()
    .then( defaultSource => {
      this.enumerateSources()
      .then( sources => {
        if( defaultSource ) {
          sources.forEach( source => {
            source.isDefault = (source.deviceId === defaultSource.deviceId)
          } )
        }
        callback( sources )
      } )
    } )
    .catch( ( error ) => {
      console.error( this.videoLogFormatter(' ' ), error)
      callback( error )
    } )
  }

  getSourcesAsync() {
    return new Promise( ( resolve, reject ) => {
      try {
        this.getSources( sources => {
          resolve( sources )
        } )
      }
      catch ( error ) {
        reject( error )
      }
    } )
  }

  /**
   * initialize
   * @param source identifier.  object, name, label, or deviceId or null for default
   * @param videoElement  preview element or null if none (yet)
   * @param startPaused start session with video paused (no camera, no preview)
   */
  async initialize( source, videoElement, startPaused ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( '=======INITIALIZE' ))
    // noinspection JSUnusedLocalSymbols
    this.paused = startPaused

    if( videoElement ) {
      this.requestedPreviews.add( videoElement )
      const agentVideoStatus = this.getVideoSourceStatus( videoElement )
      if( agentVideoStatus ) {
        agentVideoStatus.requestedPreviews.add( videoElement )
      }
    }

    if (this.bgBlurEnabled) {
      await this.BGEffectsPromise
      await this.BGEffectInitializedPromise
      this.BGEffects.setupBGEffectElements( videoElement );
    }

    await this.mediaRecorderAvailablePromise

    return new Promise( ( resolve, reject ) => {
      if( !navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' ) {
        console.error( this.videoLogFormatter('getUserMedia not supported by your browser.' ))
        this.fireEvent( 'error', 'getUserMedia not supported by your browser.', this.options )
        reject( 'getUserMedia not supported by your browser.' )
        return
      }

      if( !window.MediaRecorder
        || typeof window.MediaRecorder !== 'function'
        || typeof window.MediaRecorder.isTypeSupported !== 'function' ) {
        console.error( this.videoLogFormatter('MediaRecorder is not supported by your browser.' ))
        this.fireEvent( 'error', 'MediaRecorder is not supported by your browser.', this.options )
        reject( 'MediaRecorder not supported by your browser.' )
        return
      }
      let mime
      if( MediaRecorder.isTypeSupported( this.defaultVideoType ) ) {
        mime = this.defaultVideoType
      }
      else {
        this.videoTypes.forEach( t => {
          if( MediaRecorder.isTypeSupported( t ) ) mime = t
        } )
      }
      if( !mime || typeof mime !== 'string' ) {
        /* Android isTypeSupported doesn't return true always */
        console.log( this.videoLogFormatter('Mediarecorder.isTypeSupported did not accept', this.videoTypes, ' we use', this.videoTypes[0] ))
        mime = this.videoTypes[0]
      }

      this.mime = mime

      // note that the Queue handles "this" scope for us now
      this.commandQueue.enqueue( {
        name: 'initialize',
        method: async function( params ) {
          this.restartVideoStreamInProgress = true
          if( !params ) params = {}
          let cameraError = false;

          // avoid device enumeration etc for SS because that will make
          // SS fail if no camera, or camera blocked even if we don't want video anyway
          if (!this.options.screenshare) {
            try {
              await this.enumerateSources()
              params = await this.getSource( params )
            }
            catch ( error ) {
              cameraError = true;
              params.message = error
            }
            if( !params.source || cameraError ) {
              this.restartVideoStreamInProgress = false
              const msg = params.message || 'no camera'
              this.fireEvent( 'error', msg, this.options )
              reject( params )
              return
            }
          }
          try {
            params = this.setSourceFromParams( params )
            params = await this.getConstraints( params )
            if( !startPaused ) {
              params = await this.getMediaStream( params )
              // no media recorder needed until session starts
              // params = await this._getMediaRecorder( params )
              params = this.startVideoStream( params )
              params = await this.startVideoPreviews( params )
            }
            else {
              params.videoElement = videoElement
            }
            this.saveParams( params )

            // this must be done before any events are fired!
            this.restartVideoStreamInProgress = false


            this.fireEvent( 'initialized', this.options )

            this.addEventListener( 'sourceStarted', () => {this.sendTorchEvent()} )
            this.fireEvent( 'sourceStarted', this.source, this.options )

            if( videoElement && !startPaused ) {
              this.fireEvent( 'previewStarted', videoElement, this.options );
              if(source) {
                this.alignPreview(source.label, videoElement);
              }
            }

            resolve( params )
          }
          catch ( error ) {
            this.restartVideoStreamInProgress = false
            console.error( this.videoLogFormatter('initialize failure'), error )

            this.fireEvent( 'error', error, this.options )

            reject( params )
          }
        },
        params: { source }
      } )
    } )
  }

  /**
   * open VServer connection, start session
   * @param startPaused start session with video paused (no camera, no preview, no video transmission
   */
  startSession( startPaused, enableBgFilter ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( '---------------------STARTSESSION' ))
    this.paused = startPaused
    if (enableBgFilter !== undefined && enableBgFilter !== null) {
      this.setBgFilterActive(enableBgFilter)
    }

    // if we were unable to blur and they wanted to, fire the event now after they've had a chance to add event listeners
    // use "info" not "error" - error will make Agent Viewer punt
    if( this.blurDenied != null ) {
      this.fireEvent( 'info', this.blurDenied, this.options )
      this.blurDenied = null
    }
    const p = this.makeOfferQueryString( this.options )
    this.requestOffer( this.options.vserver, p )
    .then( (desc) => {return this.openWebSocket(desc)})
    .then( () => {
      this.fireEvent( 'sessionStarted', this.relay )

      // send any pending metrics
      if (this.blurDenied)
        this.send('Metrics set Offer.BGAllowed ' + this.blurDenied)
      else
        this.send('Metrics set Offer.BGAllowed true')

      if (this.stream) {
        // the right place to send this doesn't have a websocket to send to the first time
        let streamCons = this.getStreamConstraints( this.stream )

        this.send('Metrics timed Offer.stream.resolution ' + streamCons.settings.width + '/' + streamCons.settings.height )
        this.send('Metrics timed Offer.stream.orientation ' + (this.currentOrientationPortrait ? 'Portrait' : 'Landscape'))
      }

    } )
    .then( () => {
      if( !this.paused ) {
        this.commandQueue.enqueue( {
          name: 'restartVideoStream',
          method: this.restartVideoStream,
          params: { sessionStarting: true }
        } )
      }
      else {
        // if session has started paused we still need to not time out
        this.keepAliveTimer(this)
      }
    } )
    .catch( error => {
      console.error( this.videoLogFormatter('startSession '), error )
      this.fireEvent( 'error', error, this.options )
    } )
  }

  /**
   * terminate the session
   */
  endSession() {
    GLANCE.Video.VideoDebugEntryPoints && console.log( this.videoLogFormatter('endSessionendSessionendSessionendSessionendSession' ))
    this.commandQueue.enqueue(
      {
        name: 'closeVideoStream',
        method: this.closeVideoStream,
        params: {},
        callback: () => {
          // don't fire sessionEnded here, it will be fired in ws.onclose->shutDownNow
          if( this.ws && !this.isClosing ) {
            this.ws.transmitter( 'Stopping ' + this.clientKey )
            this.ws.transmitter( 'Closing ' + this.clientKey )
            this.ws.close( 1000, 'endSession' )
          }
        }
      } )
  }

  /**
   * attempt to resume a session given a previous descriptor
   */
  resumeSession( resumeDescriptorStr, guestCount ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log( this.videoLogFormatter('resumeSessionresumeSessionresumeSessionresumeSession' ))
    const prevDescriptor = JSON.parse( resumeDescriptorStr );

    // this just gets us the session restarted.
    this.openWebSocket( prevDescriptor )
    .then( () => {
      this.fireEvent( 'sessionStarted', this.relay )
    } )
    .then( () => {
      if( guestCount ) {
        this.guestCount = guestCount
      }
      else {
        this.guestCount = 1
      }

      this.transmitStarted = true   // from Start command processing
      this.commandQueue.enqueue( {
        name: 'restartVideoStream',
        method: this.restartVideoStream,
        params: {}
      } )
    } )
    .catch( error => {
      console.error( this.videoLogFormatter('startSession '), error )
      this.fireEvent( 'error', error, this.options )
    } )
  }

  /**
   * Event announcing the camera source started, and the preview is live
   * @event AgentVideo#sourceStarted
   * @type {options}
   * @example
   * a.addEventListener('sourceStarted', (source, options) => {
   *   console.log (width, height)
   * })
   */

  /**
   * Event announcing torch (LED) availability
   * @event AgentVideo#torch
   * @type {boolean}
   * @example
   * a.addEventListener('torch', available => {
   *   if (availabled) this.setTorch(true)
   * })
   */


  /**
   * Determine whether a torch (the LED by a device's camera) is currently available
   * @returns {boolean}
   */
  isTorchAvailable() {
    try {
      if( this.stream ) {
        const track = this.stream.getVideoTracks()[0]
        if( track && typeof track.getCapabilities === 'function' ) {
          const caps = track.getCapabilities()
          return !!caps.torch
        }
      }
      return false
    }
    catch ( error ) {
      return false
    }
  }

  /**
   * The availability of the torch can't be determined until some time
   * after a new video source (new choice of front or back camera)
   * starts. So we'll tell our user there's no torch availble right
   * away, then if one becomes available we'll tell them again.
   * That way they can manage the torch's UI so it never shows up
   * unless we know we have a torch.
   * ("torch" is jargon for the LED by the camera on a device)
   * @private
   */
 sendTorchEvent() {
    this.fireEvent( 'torch', false )
    setTimeout( () => {
      if( this.isTorchAvailable() ) this.fireEvent( 'torch', true )
    }, 500 )
  }

  /**
   * turns on / off the torch (the LED by a device's camera) if it's available
   * @param {boolean} on
   */
  setTorch( on ) {
    if( this.stream ) {
      const track = this.stream.getVideoTracks()[0]
      if( track && typeof track.getCapabilities === 'function' ) {
        const caps = track.getCapabilities()
        if( caps.torch ) {
          track.applyConstraints( { torch: on, advanced: [{ torch: on }] } )
          .then( () => {
            this.torchState = on
            GLANCE.VideoDebug && console.log( 'setTorch', on ? 'on' : 'off' )
          } )
          .catch( ( error ) => {
            console.log( 'setTorch', on ? 'on' : 'off', 'error', error )
          } )
        }
      }
    }
  }

  /**
   * Gets the current on / off state of the torch (the LED by a device's camera).
   * @returns {boolean}
   */
  getTorch() {
    return !!this.torchState
  }


  /**
   * Choose the source to use
   * @param src  either a source name or an element of the array from getSources
   * @async
   * @fires AgentVideo#sourceStarted
   * @fires AgentVideo#torch
   * returns if doing SS
   */
  async setSource( src ) {
    /* ignore unexpected parameters */
    if( !src || this.options.screenshare )
      return

    const srcText = (typeof src === 'object' && src.deviceId && typeof src.deviceId === 'string')
      ? src.deviceId
      : src
    if( typeof srcText !== 'string' ) return

    /* match parameter to list of available sources */
    var sources = await this.enumerateSources()
    var source = this.findSource(sources, srcText)
    if (!source){
      sources = await this.enumerateSources(true)
      source = this.findSource(sources, srcText)
    }
    /* no change to source */
    if( this.source && this.source.deviceId === source.deviceId )
      return
    let params = this.setSourceFromParams( { source } )
    await this.restartVideoStream( params )
    GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('setSource'), source )
    this.fireEvent( 'sourceStarted', source, this.options )
  }

  // PRIVATE
  findSource(sources, sourceString){
    return sources.find( src => {
      if( src.name === sourceString ) return true
      if( src.label === sourceString ) return true
      return src.deviceId === sourceString
    } )
  }

  // renamed because it should be private and avoid collision between _setSource and setSource
  // PRIVATE
  setSourceFromParams( params ) {
    let source = params.source
    this.source = source
    this.options.device = (source && source.name) || (source && source.label) || this.options.deviceName || ''
    return (params)
  }


  /**
   * send keepalive messages every 30 seconds
   */
  // PRIVATE
  keepAliveTimer(that) {
    that.send( 'KeepAlive' )
    if( !that.keepAliveTimerID )
      that.keepAliveTimerID = setInterval( that.keepAliveTimer, 30000, that )
  }

  /**
   * pause the video stream, close camera and preview while keeping session alive
   */
  async pause() {
    // pausing while paused loses track of the preview element
    if( this.paused )
      return

    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( 'PAUSEPAUSE' ))
    let params = GLANCE.Video.GlanceVideoSource.loadParams( this )
    this.transmitStarted = false
    params = await this.stopVideoStream( params )
    params = await this.releaseUserMedia( params )
    params.videoElement = this.activePreviews.values().next().value
    this.stopAllPreviews()
    // we need a fresh stream when we come back
    params.stream = null
    params = this.saveParams( params )
    this.paused = true
    this.fireEvent('sessionPaused')
    
    if (this.options.frameProcessor)   
        this.options.frameProcessor.pause();

    // keep session alive - VServer renews authorization when it sees messages
    this.keepAliveTimer(this)
  }

  /*
  * unpause the video stream by restoring the previous preview, that will fire everything up again
   */
  async unPause() {
    if( !this.paused )
      return

    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( 'UNPAUSEUNPAUSEUNPAUSEUNPAUSE' ))
    this.paused = false
    
    if (this.options.frameProcessor)   
        this.options.frameProcessor.unPause();

    if( this.keepAliveTimerID )
      clearTimeout( this.keepAliveTimerID )
    this.keepAliveTimerID = null;

    let params = GLANCE.Video.GlanceVideoSource.loadParams( this )

    if( !params.videoElement ) {
      params.videoElement = this.requestedPreviews.values().next().value
    }
    // clear the stream, we need a new one
    if ( params.stream ) {
      params.stream.mediaStreamStopping = true
    }

    params.stream = null;
    this.transmitStarted = true
    try {
      await this.startPreview( params.videoElement );
      this.fireEvent( 'sessionUnpaused' )
    }
    catch(error) {
      // re-pause.  This can happen with ss if they cancel, startPreview fails via restartVideoStream
      // via getMediaStream
      this.pause()
    }
  }

  /**
   * turn the filtering effect specified in constructor on or off, if it is enabled
   * active - boolean
   */
  setBgFilterActive(active) {
    if (this.BGEffects)
      this.BGEffects.setBgFilterActive(active)
  }

  getBackgroundSettings() {
    if (this.BGEffects) {
      return this.BGEffects.bGEffectSettings
    }
    else {
      console.warn(this.videoLogFormatter('Warning - getBackgroundSettings called before/without initializing GlanceVideoSource - returning capable false'))
      let settings  = {
        capable: false,
        active: false,
        type: ''
      }
      return settings
    }
  }

  /**
   * returns "user" or "environment"
   */
   getCameraFacingMode() {
    let result = "";
    if(this.streamConstraints 
      && this.streamConstraints.capabilities 
      && this.streamConstraints.capabilities.facingMode 
      && this.streamConstraints.capabilities.facingMode.length > 0) {
        result = this.streamConstraints.capabilities.facingMode[0];
    }
    return result.toLowerCase();
  }

  /**
   * Rotate preview element or not based on camera facing mode
   */
   alignPreview(videoSourceLabel, previewElem) {
    if(this.getCameraFacingMode() == "environment"
      || (videoSourceLabel && videoSourceLabel.indexOf("back") >= 0)) {
        previewElem.setAttribute("data-camera", "back");
    } else {
        previewElem.removeAttribute("data-camera");
    }
  }

  /**
   * attempt to reconnect the session
   * todo: is this called by CB? If not it should be removed
   */
  reconnectSession() {
    this.reconnectWebSocket()
  }

  /**
   * start using a video element as a preview
   * @param element
   * @param startPaused start session with video paused (no camera, no preview)
   */
  async startPreview( element, startPaused ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( 'STARTPREVIEWSTARTPREVIEW' ))
    this.paused = startPaused

    if( !element ) return
    if( element.previewActive || element.previewIsStarting ) return
    if( !this.requestedPreviews.has( element ) )
      this.requestedPreviews.add( element )
    const videoSourceStatus = this.getVideoSourceStatus( element )
    if( !videoSourceStatus ) {
      GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'videoSourceStatus is null - invalid element' ))
      return null
    }
    if( !videoSourceStatus.requestedPreviews.has( element ) )
      videoSourceStatus.requestedPreviews.add( element )

    // we need this whether we start paused or not
    /* set up element.stopPreview() method */
    element.stopPreview = function stopPreviewOnElement() {
      this.stopPreview( this )
    }

    if (this.BGEffects) {
      this.BGEffects.setupBGEffectElements( element );
    }

    if( !startPaused ) {
      element.previewIsStarting = true

      delete element.previewIsStopping

      const params = GLANCE.Video.GlanceVideoSource.loadParams( this, { videoElement: element } )

      // Align preview: either mirror or not based on camera selection
      let label = "";
      if(params && params.source) {
        label = params.source.label;
      }
      this.alignPreview(label, element);

      if( this.areStreamsValid() ) {
        try {
          await this.startVideoElementPreview( params )
          this.fireEvent( 'previewStarted', element, this.options )
          return
        }
        catch ( error ) {
          console.error( this.videoLogFormatter("couldn't start video element preview because of failure. "), error )
        }
      }

      try {
        await this.restartVideoStream( params )

        delete element.previewIsStarting
        this.fireEvent( 'previewStarted', element, this.options )
      }
      catch(params) {
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter('startPreview aborted with error'))
        delete element.previewIsStarting
        throw new Error(params);
      }
    }
  }

  /**
   * stop the specified preview video element.
   * another way to do this:  element.stopPreview()
   * @param element
   */
  stopPreview( element, preserveStream ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter( '===============stopPreview' ))
    if( element.previewIsStopping ) return
    element.previewIsStopping = true
    if (preserveStream && (preserveStream==true)){
      element.preserveStream = true
    }
    delete element.previewIsStarting
    if( element ) {
      this.commandQueue.enqueue(
        {
          name: 'stopOnePreview',
          method: this.stopOnePreview,
          params: element
        } )
    }
  }

  /**
   * stop all active preview video elements
   */
  stopAllPreviews() {
    this.activePreviews.forEach( element => this.stopPreview( element ) )
    this.activePreviews.clear()
  }

  // PRIVATE
  quickStopOnePreview( element ) {
    const stream = this.stream
    if( element ) {
      if( element.previewActive ) {
        if( stream && stream.mostRecentlyActivatedPreview === element )
            stream.mostRecentlyActivatedPreview = null
        element.srcObject = null
      }
      delete element.previewIsStarting
      delete element.previewIsStopping
      delete element.previewActive
      delete element.preserveStream

      element.stopPreview = function stopPreviewOnElementAlreadyStopped() {
        /* EMPTY, INTENTIONALLY this is the element.stopPreview() function for use by clients */
      }
      const owner = element.ownerDocument.defaultView
      let videoSourceStatus = this.lookupVideoSourceStatus(owner)
      if( videoSourceStatus && videoSourceStatus.activePreviews ) {
        videoSourceStatus.activePreviews.delete( element )
      }
      this.activePreviews.delete( element )
      GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('stopped preview on', element ))
      this.fireEvent( 'previewStopped', element, this.options )
    }
  }

  /**
   * stop a single preview element
   * @param element
   */
  // PRIVATE
  stopOnePreview( element ) {
    return new Promise( ( resolve, reject ) => {
      var preserveStream = false
      if( element ) {
        if (element.preserveStream){
          preserveStream = element.preserveStream
        }
        this.quickStopOnePreview( element )
      }
      else {
        reject( 'invalid element' )
        return
      }
      if( this.activePreviews.size === 0 ) {
        // if we have a session running don't release user media - it interferes with fast restart
        // TODO: this is rather indirect - clean this up. This hunk of code is also somewhat common
        if ( this.ws && this.ws.transmitter && typeof this.ws.transmitter === 'function' ) {
          resolve( { element } )
        }
        else {
          if (preserveStream){
            resolve({ element })
          }else{
            this.releaseUserMedia( {} )
              .then( params => resolve( params ) )
          }
        }


      }
      else resolve( { element } )
    } )
  }

  // this was hanging out in the middle of the code, it is too big
  // to stick right in the constructor
  // PRIVATE
  setupOrientationChangeHandlerIfNeeded() {
    /**
     * restart video stream when using polyfilled media recorder on rotation
     */
    if( GLANCE.Video.GlanceVideoSource.isSafariIOS() ) {
      this.currentOrientationPortrait = window.innerWidth < window.innerHeight;
      if( window.orientation !== undefined ) {
        this.currentOrientationPortrait = (window.orientation % 180) === 0;
      }
      if( ('onorientationchange' in window) && ('orientation' in window) ) {
        this.onOrientationChange = ( event ) => {
          if( this.mediaRecorder && GLANCE.Video.polyfilledMediaRecorder ) {
            this.restartAfterOrientationChange(true);
          }
        }
        window.addEventListener( "orientationchange", this.onOrientationChange );
      }
      else {
        this.onOrientationChange = ( event ) => {
          if( this.mediaRecorder && GLANCE.Video.polyfilledMediaRecorder ) {
            var newOrientationPortrait = window.innerWidth < window.innerHeight;
            if( window.orientation !== undefined ) {
              newOrientationPortrait = (window.orientation % 180) === 0;
            }
            if( this.currentOrientationPortrait !== newOrientationPortrait ) {
              this.restartAfterOrientationChange();
            }
          }
        }
        window.addEventListener( "resize", this.onOrientationChange );
      }
    }
    else if( GLANCE.Video.GlanceVideoSource.getBrowser() === 'Chrome' ) {
      // should cover Android, ChromeOS and desktop, Chrome/Edge on Surface
      // given a choice between using the deprecated window.orientation and window.orientationchange,
      // or experimental replacement, for Chrome I choose experimental replacement.
      this.onOrientationChange = ( event ) => {
        let newOrientationPortrait
        if( screen.orientation !== undefined ) {
          newOrientationPortrait = screen.orientation.type.indexOf( 'portrait' ) !== -1
        }
        if( this.currentOrientationPortrait !== newOrientationPortrait ) {
          this.orientationMustReset = true
          this.restartAfterOrientationChange();
        }
      }
      // this is not reliable
      this.currentOrientationPortrait = window.innerWidth < window.innerHeight

      // if available, this should be
      if( screen.orientation !== undefined ) {
        this.currentOrientationPortrait = screen.orientation.type.indexOf( 'portrait' ) !== -1
      }else if( window.orientation !== undefined ) {
        this.currentOrientationPortrait = (window.orientation % 180) === 0;
      }
      this.orientationMustReset = false
      if( ('orientation' in screen) && ('onchange' in screen.orientation) ) {
        screen.orientation.addEventListener( "change", this.onOrientationChange );
      }
      else {
        window.addEventListener( "resize", this.onOrientationChange );
      }
    }
  }

  /**
   * Wait for up to 120 frames for window.innerHeight to update after window.orientationchange event.
   * 
   * iOS (window.orientation) only.
   * 
   * @param innerHeight - initial height we are waiting on to change after orientation
   */
  // PRIVATE
  orientationChanged(innerHeight) {
    const timeout = 120;
    return new window.Promise(function(resolve) {
      const go = (i, height0) => {
        window.innerHeight != height0 || i >= timeout ?
          resolve() :
          window.requestAnimationFrame(() => go(i + 1, height0));
      };
      go(0, innerHeight);
    });
  }

  /**
   * Restart video after orientation change
   * 
   * Stop video stream immediately with restarting param. 
   * Wait for orientation change if waitForOrientationChanged is true.
   * Calculate updated currentOrientationPortrait value.
   * Restart video stream after delay of orientationChangedRestartTimeoutInMilliseconds.
   * 
   * @param waitForOrientationChanged - pass true if window.orientationchange was used to detect change
   */
  // PRIVATE
  async restartAfterOrientationChange(waitForOrientationChanged){
    let innerHeight = window.innerHeight

    if (this.restartAfterOrientationChangeTimeout){
      clearInterval(this.restartAfterOrientationChangeTimeout)
      this.restartAfterOrientationChangeTimeout = undefined
    }
    
    let params = GLANCE.Video.GlanceVideoSource.loadParams( this )
    params.restarting = true
    await this.stopVideoStream(params)

    if( waitForOrientationChanged ) {
      await this.orientationChanged(innerHeight)
    }

    var newOrientationPortrait = window.innerWidth < window.innerHeight
    if( screen.orientation !== undefined ) {
      newOrientationPortrait = screen.orientation.type.indexOf( 'portrait' ) !== -1
    }else if( window.orientation !== undefined ) {
      newOrientationPortrait = (window.orientation % 180) === 0;
    }
    this.currentOrientationPortrait = newOrientationPortrait
    GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( "Device orientation has changed to - portrait=" + newOrientationPortrait ))
  
    this.restartAfterOrientationChangeTimeout = setTimeout(this.restartAfterOrientationChangeDelay.bind(this), this.orientationChangedRestartTimeoutInMilliseconds);
  }

  /**
   * Restart video stream after orientation change and ensure MediaStream is discarded.
   */
  // PRIVATE
  restartAfterOrientationChangeDelay(){
    this.restartAfterOrientationChangeTimeout = undefined
    let params = GLANCE.Video.GlanceVideoSource.loadParams( this )
    params.restarting = true
    params.discard = true
    this.restartVideoStream(params)
  }

  /**
   * restart a video stream (in response to Start command etc)
   * @param params
   * @returns {Promise<any>}
   * must be public, called from GlanceVideoBGEffects
   */
  async restartVideoStream( params ) {
    if( this.paused ) return params

    if( this.restartVideoStreamInProgress ) {
      this.abortRestartVideoStream = true;
      // this mostly ends up re-enqueing restartVideoStream if we are still busy
      this.commandQueue.enqueue( {
        name: 'restartVideoStream',
        method: this.restartVideoStream,
        params: params
      } )
      return params
    }

    this.abortRestartVideoStream = false;

    this.restartVideoStreamInProgress = true
    GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('enter restartVideoStream'), params )
    /* clear the pending restart (to resume previews) if any */
    if( this.pendingRestartTimeout ) {
      window.clearTimeout( this.pendingRestartTimeout )
      this.pendingRestartTimeout = 0
    }
    try {
      params = await this.stopVideoStream( params )
      if( this.abortRestartVideoStream ) {
        this.restartVideoStreamInProgress = false
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('restartVideoStream aborted after stopVideoStream'), params )
        return params
      }

      // NOTE - the following call was removed to try to preserve mediaStreams which take a long time
      // to start. Instead, getMediaStream will check if there is an existing stream whose constraints
      // match what is currently required, and if so will reuse the stream saving a lot of time. if the
      // constraints don't match the stream will be deleted and a new one created.
      // params = await this.releaseUserMedia( params )

      params = await this.getConstraints( params )
      if( this.abortRestartVideoStream ) {
        this.restartVideoStreamInProgress = false
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('restartVideoStream aborted after _getConstraints'), params )
        return params
      }
      //GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter('getConstraints done', params))
      params = await this.getMediaStream( params )
      if( this.abortRestartVideoStream ) {
        this.restartVideoStreamInProgress = false
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'restartVideoStream aborted after _getMediaStream'), params )
        return params
      }
      //GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter('getMediaStream done', params))
      params = await this.getMediaRecorder( params )
      if( this.abortRestartVideoStream ) {
        this.restartVideoStreamInProgress = false
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'restartVideoStream aborted after _getMediaRecorder'), params )
        return params
      }
      //GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter('getMediaRecorder done', params))
      params = await this.startVideoStream( params )
      if( this.abortRestartVideoStream ) {
        this.restartVideoStreamInProgress = false
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'restartVideoStream aborted after _startVideoStream'), params )
        return params
      }
      //GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter('startVideoStream done', params))
      params = await this.startVideoPreviews( params )
      if( this.abortRestartVideoStream ) {
        this.restartVideoStreamInProgress = false
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('restartVideoStream aborted after _startVideoPreviews'), params )
        return params
      }
      GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'startVideoPreviews done'), params )

      this.saveParams( params )
      GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('saveParams done'), params )
    }
    catch ( error ) {
      console.error( this.videoLogFormatter('error in restartVideoStream'), error, params )
      this.fireEvent( 'error', error, this.options )

      // reject the implicit async promise
      GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'leave restartVideoStream with Reject()'), params )
      this.restartVideoStreamInProgress = false
      throw new Error(params);
    }
    GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'leave restartVideoStream'), params )
    this.restartVideoStreamInProgress = false
    return params
  }

  /**
   * terminate a video session (a connection to VServer)
   * @param params
   * @returns {Promise<any>}
   */
  // PRIVATE
  closeVideoStream( params ) {
    if( this.pendingRestartTimeout ) {
      window.clearTimeout( this.pendingRestartTimeout )
      this.pendingRestartTimeout = 0
    }
    return new Promise( ( resolve ) => {

      if( this.options.stopPreviewsOnSessionEnd ) {
        this.activePreviews.forEach( element => this.quickStopOnePreview( element ) )
      }
      this.transmitStarted = false
      this.guestCount = 0

      this.stopVideoStream( params )
      .then( (params) => { return this.releaseUserMedia(params) } )
      .then( (params) => {
        this.profileManager.onClose()
        return params
      } )
      .then( params => resolve( params ) )
    } )
  }

  /**
   * add tracking for preview elements to top-level document
   * so we can deal correctly with document unloads
   * @param element
   * @private
   */
  // PRIVATE
  getVideoSourceStatus( element ) {
    const owner = element.ownerDocument.defaultView
    if( owner ) {
      // there's got to be a better way...
      if( !owner.GLANCE ) {
        owner.GLANCE = {}
      }
      if (!owner.GLANCE.Video) {
        owner.GLANCE.Video = {}
      }
      if (!owner.GLANCE.Video.GlanceVideoSourceStatuses ) {
        owner.GLANCE.Video.GlanceVideoSourceStatuses = new Map()
      }

      let videoSourceStatus = owner.GLANCE.Video.GlanceVideoSourceStatuses.get(this)

      if (!videoSourceStatus) {
        videoSourceStatus = {
          sender: this,
          activePreviews: new Set(),
          requestedPreviews: new Set()
        }
        owner.GLANCE.Video.GlanceVideoSourceStatuses.set( this, videoSourceStatus )
      }

      owner.addEventListener( 'unload', this.onPreviewDocumentUnload.bind(this) )
      return videoSourceStatus
    }
    else {
      return null
    }
  }

  // PRIVATE
  lookupVideoSourceStatus( owner ) {
    if (owner && owner.GLANCE && owner.GLANCE.Video && owner.GLANCE.Video.GlanceVideoSourceStatuses) {
      return owner.GLANCE.Video.GlanceVideoSourceStatuses.get( this )
    }
    else
      return undefined
  }

  /**
   * window unload handler to stop previews when the documents
   * containing them (possibly iframes or subwindows) are
   * unloaded or reloaded
   * @param event
   * @private
   * NOTE: this runs in window context so this was bind()ed to the function
   */
  // PRIVATE
  onPreviewDocumentUnload( event ) {
    const owner = event.currentTarget
    let videoSourceStatus = this.lookupVideoSourceStatus(owner)

    if( videoSourceStatus && videoSourceStatus.sender ) {
      const sender = videoSourceStatus.sender
      /* get rid of requested previews in this document:
       * the document will be gone by the time we try to activate them. */
      videoSourceStatus.requestedPreviews.forEach( element => {
        this.requestedPreviews.delete( element )
      } )
      videoSourceStatus.requestedPreviews.clear()

      let elementCount = 0
      videoSourceStatus.activePreviews.forEach( element => {
        sender.stopPreview( element )
        elementCount++
      } )
      if( GLANCE.Video.VideoDebug && elementCount > 0 ) console.log( this.videoLogFormatter('document unload: stopped previews' ))
    }
    if( videoSourceStatus ) {
      videoSourceStatus.activePreviews.clear()

      owner.GLANCE.Video.GlanceVideoSourceStatuses.delete( this )
    }
    owner.removeEventListener( 'unload', this.onPreviewDocumentUnload )
    this.videoElement = null
  }

  // PRIVATE
  async getSource( params ) {
    try {
      const source = params.source
      if( source && typeof source === 'object' && source.deviceId ) {
        /* it's the kind of source returned by enumerateSources */
        return params
      }
      else if( typeof source === 'string' ) {
        /* it's a text string like 'Easy Camera' */
        var sources = await this.enumerateSources()
        params.source = this.findSource(sources, source)
        if (!params.source){
          sources = await this.enumerateSources(true)
          params.source = this.findSource(sources, source)
        }
        return params
      }
      else {
        if( !this.systemDefaultSource ) {
          this.systemDefaultSource = await this.getSystemDefaultSource()
        }
      }
      params.source = this.systemDefaultSource
      return params
    }
    catch ( error ) {
      /* error thrown if any issue finding the source, e.g. no camera */
      params.source = null
      this.systemDefaultSource = null
      params.message = error.message
      throw error
    }
  }

  // we have to return an object so we can return either a source or error message, without ugly type-checking
  // PRIVATE
  async getSystemDefaultSource() {
    let result

    if (this.options.screenshare)
      return result

    if( !this.systemDefaultSource ||
      !this.systemDefaultSource.deviceId ||
      typeof this.systemDefaultSource.deviceId !== 'string' ) {
      /* do not have a source yet.  Go get the first camera in order. */
      try {
        delete this.systemDefaultSource
        /* re-enumerate the sources; we get real label values this time because we authorized */
        const sources = await this.enumerateSources()

        if (sources.length > 1) {
          for (let s of sources) {
            if (s.name.startsWith('front')) {
              result = s
            }
          }
        }

        if (!result)
          result = sources.length >= 1 ? sources[0] : null

        this.systemDefaultSource = result
        if( !result ) throw new Error( 'No camera' )
      }
      catch ( error ) {
        console.error( this.videoLogFormatter('getSystemDefaultSource'), error )
        delete this.systemDefaultSource
        throw error
      }
    }
    else {
      /* we already know the system default source, so return it. */
      GLANCE.Video.VideoDebug && console.info( this.videoLogFormatter('default video source', this.systemDefaultSource.label, 'refetched' ))
      result = this.systemDefaultSource
    }
    this.systemDefaultSource = result
    return result
  }

  /**
   * return list of devices
   * @param forceReload Invalidate cache and force a reload of available sources
   * @returns {Promise<MediaDeviceInfo[]|null|MediaDeviceInfo[]>}
   * @private
   */
  // PRIVATE
  async enumerateSources(forceReload) {
    if (!forceReload){
      if (window.sessionStorage && !GLANCE.Video.VideoSources){
        try {
          const sessionSourcesString = window.sessionStorage.getItem('GLANCE.Video.VideoSources')
          if (sessionSourcesString){
            const sessionSources = JSON.parse(sessionSourcesString)
            if (sessionSources && (sessionSources.length > 0)){
              GLANCE.Video.VideoSources = sessionSources
            }
          }
        } catch(err){}
      }
      if(GLANCE.Video.VideoSources ){
        return GLANCE.Video.VideoSources
      }
    }
    if( navigator && navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function' ) {
      let sourcesStream = null
      let devices = await navigator.mediaDevices.enumerateDevices()

      function filterDevices(devicesToFilter){
        return devicesToFilter.filter( device => {
            if( device.kind === 'videoinput' ) {
              if( device.label && device.label.length > 0 ) {
                if( device.label.toLowerCase().indexOf( 'back' ) >= 0 ) {
                  device.ordinal = -2
                  device.name = 'back'
                }
                else if( device.label.toLowerCase().indexOf( 'front' ) >= 0 ) {
                  device.ordinal = -1
                  device.name = 'front'
                }
                else {
                  /* label: "Logitech HD Webcam C615 (046d:082c)", name: "Logitech HD Webcam C615"
                   * camera2 1, facing front  |  camera2 0, facing back
                   */
                  device.name = device.label.replace( /\s*\([0-9a-fA-f:]{9,}\)\s*$/, '' )
                  device.ordinal = counter++
                }
              }
              else {
                device.ordinal = counter
                device.name = 'cam' + counter
                counter++
              }

              return true
            }
            return false
          }
        )
      }

      let counter = 0
      let result = filterDevices(devices)

      let shouldGetSources = false
      if (result.length == 0){
        shouldGetSources = true
      }else if (result.length==1){
        if (result[0].name == "cam0" && result[0].deviceId == ""){
          shouldGetSources = true
        }
      }
      if (shouldGetSources){
        /* open a generic stream to get permission to see devices; Mobile Safari insists */
        /* Obtain the device chosen with a minimal-constraints gUM call.
          * That's the one selected by the pulldown in chrome://settings/content/camera
          * We have to do it this way, because specifying any video constraints
          * other than a simple "true" makes gUM ignore that choice of device. */
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( "enumerateSources: getUserMedia" ))
        try {
          sourcesStream = await navigator.mediaDevices.getUserMedia( { video: true, audio: false } )
          devices = await navigator.mediaDevices.enumerateDevices()
          counter = 0
          result = filterDevices( devices )
        }
        catch (error) {
          GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter("enumerateDevices getUserMedia exception error - " + error.name))
          throw(error.name)
        }
      }

      var jsonResult = [];
      if( result.length > 0 ){
        /* the 'back' camera, if any, is first. the 'front' (selfie) camera is second
          * the rest are in the order returned by enumerateDevices.  */
        result.sort( ( a, b ) => a.ordinal - b.ordinal )

        if (window.sessionStorage){
          try {
            for (var i = 0; i < result.length; i++){
              let resultItem = result[i];
              let label = resultItem.label ? resultItem.label : resultItem.name;
              jsonResult.push({deviceId: resultItem.deviceId, groupId: resultItem.groupId, kind: resultItem.kind, label: label, name: resultItem.name})
            }
            window.sessionStorage.setItem('GLANCE.Video.VideoSources', JSON.stringify(jsonResult))
          }catch(err){}
        }
      }

      if (sourcesStream){
        this.releaseUserMediaStream( sourcesStream )
      }
      GLANCE.Video.VideoSources = jsonResult;
      return jsonResult
    }
    else throw ('navigator.mediaDevices.enumerateDevices() function not available')
  }

  /**
   * compute params.constraints, the constraints used for getUserMedia.
   * @param params
   * @returns {Promise<{object}>} params
   * @private
   */
  // PRIVATE
  async getConstraints( params ) {
    if( !params ) params = {}
    const src = await this.getSystemDefaultSource()
    if( src && typeof src === 'object' && src.deviceId )
      this.systemDefaultSource = src
    else if (!this.options.screenshare) {
      params.message = src
      return params
    }
    let source = params.source || this.source || this.systemDefaultSource
    params.source = source
    
    let profile = this.profileManager.getProfile()
    if (profile){
      // don't try to force min/max constraints, all it does is give constraint errors if it can't be met.
      // let the browser give us the best match it can with what we want
      var constraints = {
        video: {
          width: profile.width,
          height: profile.height,
          frameRate: profile.framerate,
        },
        audio: false
      }

      constraints.bitspersecond = profile.bitsPerSecond
      if( source && source.deviceId ) {
        constraints.deviceId = { exact: source.deviceId }
        constraints.video.deviceId = { exact: source.deviceId }
        GLANCE.Video.VideoDebug && console.info(this.videoLogFormatter( ' chosen video source'), source.label, 'constraints', constraints )
      }
      params.constraints = constraints
    }
    return (params)
  }

  /**
   * close all the tracks in the open media stream if any
   * @param params
   * @private
   */
  // PRIVATE
  releaseUserMedia( params ) {
    if( !params ) params = {}

    return new Promise( ( resolve ) => {

      /* release the getUserMedia stream, all tracks */
      const stoppedMediaRecorderHandler = () => {

        if (this.BGEffects) {
          this.BGEffects.StopRenderingStream()
        }

        const stream = params.stream || this.stream
        if( stream ) {
          stream.mediaStreamStopping = true
          stream.getTracks().forEach( track => {
            track.stop()
          } )
        }

        if( this.mediaRecorder != null )
          this.mediaRecorderCount -= 1  // we need to keep this count correct
        this.mediaRecorder = null

        params.stream = null
        this.stream = null
        params.paramSetChanging = false
        /* clear preview active flags, so they get restarted. */
        this.activePreviews.forEach( element => delete element.previewActive )
        resolve( params )
      }

      const anyPreviews =
        (this.requestedPreviews && this.requestedPreviews.size > 0) ||
        (this.activePreviews && this.activePreviews.size > 0)
      const anyOutbound =
        this.ws && this.ws.transmitter &&
        typeof this.ws.transmitter === 'function' &&
        this.transmitStarted && this.guestCount > 0
      //console.debug( userMediaMessage( anyOutbound, 'releaseUserMedia' ) )
      if( GLANCE.Video.GlanceVideoSource.getBrowser() !== 'Safari' || params.paramSetChanging || ((!anyPreviews) && (!anyOutbound)) ) {
        const mediaRecorder = this.mediaRecorder
        /* if the media recorder isn't stopped, stop it. */
        if( mediaRecorder && mediaRecorder.state !== 'inactive' ) {
          mediaRecorder.addEventListener( 'stop', stoppedMediaRecorderHandler )
          mediaRecorder.stop()
        }
        /* otherwise go release the gUM stream tracks */
        else stoppedMediaRecorderHandler()
      }
      else resolve( params )

    } )
  }

  /**
   *
   * @param params
   * @returns {Promise<any>}
   */
  // PRIVATE
  getMediaStream( params ) {
    let existingStream = params.stream || this.stream
    /**
     * If we have an existingStream lets check to see if our new MediaStream request constraints match
     * what we already have with the existingStream.  If width, height, frameRate and deviceId match then
     * lets reuse the existingStream.
     *
     * NOTE: We are basing this decision on our last _request_ to getUserMedia and not the properties on
     * the existingStream itself.  The reason is that often we will not have an exact request between
     * what we ask for and what we get back.  Additionally, on mobile we may ask for a resolution in
     * landscape but get back a correctly sized portrait MediaStream.  As a result, the request matters
     * more than the current properties of the MediaStream for this decision.
     *
     */

    if( existingStream && !this.options.screenshare ) {
      let discard = true
      const lastConstraints = this.lastRequestedMediaStreamConstraints
      // see GD-16488, on Safari, a cached page is restored when navigating with Forward/Back. Though
      // we reconnect the session, when we try to restart we think we still have a stream though
      // it is now invalid. However, the active flag does seem to accurately reflect that the stream is not
      // in fact running any longer.

      // GD-19397 changed to compare whether the stream needs to upgraded to reset and grab with higher resolution
      if( existingStream.active && lastConstraints && params.constraints && params.constraints.video ) {
        if( (lastConstraints.video.width >= params.constraints.video.width)
          && (lastConstraints.video.height >= params.constraints.video.height)
          && (lastConstraints.video.frameRate >= params.constraints.video.frameRate)
        ) {
          if( lastConstraints.deviceId && lastConstraints.deviceId.exact && params.constraints.video.deviceId && params.constraints.video.deviceId.exact ) {
            if( lastConstraints.deviceId.exact == params.constraints.video.deviceId.exact ) {
              discard = false
            }
          }
          else {
            discard = false
          }
        }
      }

      if (this.options.screenshare){
        discard = false
      }

      if (params.discard){
        discard = params.discard
        params.discard = undefined
      }

      if( discard ) {
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter("_getMediaStream: Discarding mediaStream" ))
        existingStream.mediaStreamStopping = true
        existingStream.getTracks().forEach( track => {
          track.stop()
        } )

        existingStream = null
        params.stream = null
        this.stream = null
        this.lastRequestedMediaStreamConstraints = null
      }
      else {
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter("_getMediaStream: Keeping mediaStream" ))
      }
    }

    const anyPreviews =
      (this.requestedPreviews && this.requestedPreviews.size > 0) ||
      (this.activePreviews && this.activePreviews.size > 0)
    const anyOutbound =
      (this.ws && this.ws.transmitter &&
        typeof this.ws.transmitter === 'function' &&
        this.transmitStarted && this.guestCount > 0) ||
      params.sessionStarting
    params.inactive = (!anyPreviews) && (!anyOutbound)

    return new Promise(  ( resolve, reject ) => {
      if( (!params.source && !this.options.screenshare) || !params.constraints ) reject( new Error( 'no webcam' ) )
      if( params.inactive ) {

        this.releaseUserMedia( params )
        .then( params => resolve( params ) )
        .catch( error => reject( error ) )
      }
      else if( existingStream ) {
        params.stream = existingStream

        if (this.orientationMustReset) {
          let streamCons = this.getStreamConstraints( existingStream )
          if (streamCons && streamCons.settings && this.BGEffects) {
            this.BGEffects.resetPipelineSize( params.constraints.video.width, params.constraints.video.height, streamCons.settings.width, streamCons.settings.height, this.currentOrientationPortrait )
          }
        }
        resolve( params )
      }
      else {
        const constraints = params.constraints
        // We need to save the last max resolution because it might be reduced for an existing stream
        if(!this.lastRequestedMediaStreamConstraints 
          || this.lastRequestedMediaStreamConstraints.video.width < constraints.video.width
          || this.lastRequestedMediaStreamConstraints.video.height < constraints.video.height) {
            this.lastRequestedMediaStreamConstraints = constraints
        }
        if (this.options.screenshare) {
          this.getDisplayMediaStream( constraints )
          .then( async stream => {
            params.stream = stream

            // Validate the selected screenshare surface
            if (this.options.screenshareSurfaces) {
              const videoTrack = stream.getVideoTracks()[0]
              if (!this.options.screenshareSurfaces.includes(videoTrack.getSettings().displaySurface)) {
                // save ths stream so pause can close it later.
                this.stream = stream

                this.fireEvent("invalidsurface")
                // the unpause() exception handler will call pause() but unfortately
                // we don't know if we are doing a second SS (thus unpausing) or the
                // first one (from initialize). It should work, the second pause will noop
                // when we see we are paused already
                this.pause()
                throw new Error("invalidsurface")
              }
            }
            // In case of Firefox the stream.inactive event is never being fired when user clicks stop sharing button
            // Also for chrome when agent stops screenshare 'inactive' fires only
            // So it's better to keep both listners with check
            stream.getVideoTracks()[0].onended = () => {
              if (!this.paused)
                this.pause();
            };
            stream.addEventListener('inactive', (e) => {
              if (!this.paused)
                this.pause(); // user clicked the browser's "Stop Sharing" button
            });

            if (this.options.frameProcessor) {
              this.options.frameProcessor.getStream(stream)
              .then((visitorStream) => {
                params.stream = visitorStream;
                this.stream = params.stream;
                resolve( params )
              });
            } else {
              resolve( params )
            }
            
          } )
          .catch( error => {
            console.error(this.videoLogFormatter( '_getMediaStream'), error )
            reject( error )
          } )
        } else {
          this.getUserMediaStream( constraints )
          .then( async stream => {
            params.stream = stream
            let framerate = 20        // arbitrary, we should always have one by now
            if( constraints.video && constraints.video.framerate )
              framerate = constraints.video.framerate
            if (this.BGEffects) {
              await this.BGEffects.startVideoCapture( stream, framerate )
            }

            resolve( params )
          } )
          .catch( error => {
            console.error( this.videoLogFormatter('_getMediaStream'), error )
            reject( error )
          } )
        }
      }
    } )
  }

  /**
   * Calls getDisplayMedia
   * @param constraints
   * @returns {Promise<MediaStream>}
   * @private
   */
  // PRIVATE
  async getDisplayMediaStream( constraints ) {
    // note passed constraints not actually used
    return navigator.mediaDevices.getDisplayMedia({video: true})
  }

  /**
   * Calls getUserMedia, providing for retries upon failure
   * @param constraints
   * @param {number} retry  number of times retried
   * @returns {Promise<MediaStream>}
   * @private
   * throws string on exception
   */
  // PRIVATE
  async getUserMediaStream( constraints, retry ) {
    retry = retry || 0
    let stream
    if( !navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' ) {
      throw Error( 'Browser MediaRecorder unavailable. Use Google Chrome.' )
    }
    else {
      let streamCons
      try {
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter("_getUserMediaStream: getUserMedia" ))

        stream = await navigator.mediaDevices.getUserMedia( constraints )
        // save this stream immediately or we might make another. saveParams is not called
        // if restartVideoStream aborts, and the new stream will be abandoned - but active
        this.stream = stream

        streamCons = this.getStreamConstraints( stream )
        stream.deviceId = streamCons.settings.deviceId
        stream.addEventListener( 'inactive', ( event ) => {
          if (!event.target.mediaStreamStopping) {
            console.log(this.videoLogFormatter('MediaStream INACTIVE due to camera error'))
            this.fireEvent( 'error', 'Camera stream ended unexpectedly', event )
            this.endSession()
          }
        }, {once: true})

        // reset size of all buffers
        if (streamCons && streamCons.settings && this.BGEffects) {
          this.BGEffects.resetPipelineSize( constraints.video.width, constraints.video.height, streamCons.settings.width, streamCons.settings.height, this.currentOrientationPortrait )
        }

        // update metrics
        // NOTE these won't get sent if we haven't opened websocket yet
        this.send('Metrics timed Offer.stream.resolution ' + streamCons.settings.width + '/' + streamCons.settings.height )
        this.send('Metrics timed Offer.stream.orientation ' + (this.currentOrientationPortrait ? 'Portrait' : 'Landscape'))

        GLANCE.Video.VideoDebug && console.info(this.videoLogFormatter( ' chosen video source'), streamCons.track.label,
          constraints.video === true ? 'probed' : 'opened' )
        return stream
      }
      catch ( error ) {
        if( streamCons && streamCons.track ) {
          console.error( this.videoLogFormatter(' chosen video source'), streamCons.track.label,
            constraints.video === true ? 'probe failure' : 'open failure', error.name )
        }
        else {
          if( retry < 5 ) {
            console.log( this.videoLogFormatter('error retrieving stream constraints:'), error, 'retrying:', retry )
            if (error && error.constraint && (error.constraint == "deviceId")){
              let results = await this.enumerateSources(true)
              constraints.video.deviceId = results[0]
            }
            return this.getUserMediaStream( constraints, ++retry )
          }
          console.error( this.videoLogFormatter('cannot retrieve stream constraints'), constraints )
        }
        throw error.name
      }
    }
  }

  /**
   * undoes _getUserMediaStream, releasing the input stream
   * @param stream
   * @private
   */
  // PRIVATE
  releaseUserMediaStream( stream ) {
    try {
      if( stream ) {
        const tracks = stream.getTracks()
        if( tracks ) {
          for( let t = 0; t < tracks.length; t++ ) tracks[t].stop()
        }
      }
    }
    catch ( error ) {
      console.error( this.videoLogFormatter('releaseUserMediaStream'), error )
    }
  }

  /**
   * Get the MediaRecorder
   * @param params media stream from getUserMedia.
   * @returns params
   */
  // PRIVATE
  async getMediaRecorder( params ) {
    if( params.inactive || !this.transmitStarted )
      return (params)
    if (this.BGEffects) {
      this.BGEffects.skipEffectRendering = true
    }

    await this.mediaRecorderAvailablePromise

    const constraints = params.constraints

    let profile = this.profileManager.getProfile()
    let bitsPerSecond = profile ? profile.bitsPerSecond : constraints.bitspersecond
    const frameRate = profile ? profile.framerate : constraints.video.frameRate
    if( GLANCE.Video.polyfilledMediaRecorder ) {
      this.frameMilliseconds = 1000.0 / frameRate
    }else if( this.mime.startsWith( 'video/webm' ) && this.Workaround_14731 > 0 ) {
      /* a Chromium bug makes us have to correct requested bitrate by frame rate and video size */
      const dimension = Math.min( constraints.video.height, constraints.video.width )
      /* there are two hard problems in CS: naming things, caching things, and off-by-one errors */
      if (dimension < 480){
        bitsPerSecond = bitsPerSecond * this.Workaround_14731 / frameRate
      }
    }

    if (this.options.screenshare){
      this.frameMilliseconds = 1000.0 / frameRate
    }

    let stream = null
    if( this.BGEffects && this.BGEffects.effectRenderedStream ) {
      let pipelineWidth = profile ? profile.width : params.constraints.video.width
      let pipelineHeight = profile ? profile.height : params.constraints.video.height
      this.BGEffects.resetPipelineSize( pipelineWidth, pipelineHeight, pipelineWidth, pipelineHeight, this.currentOrientationPortrait )
      stream = this.BGEffects.effectRenderedStream
    }else {
      stream = params.stream
    }

    // restart capturing the rendered canvas stream (required for frameRate updates if nothing else)
    // if( frameRate !== constraints.video.frameRate && this.BGEffects) {
    //   GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('FRAMERATEMISMATCH in getMediaRecorder - profile.framerate = ' + (profile ? profile.framerate : '') + ' constraints.video.frameRate = ' + constraints.video.frameRate ))
    //   this.BGEffects.startRenderedStream( frameRate )
    //   stream = this.BGEffects.effectRenderedStream
    // }

    /* the goons at Mozilla might make us change to 'video/x-matroska;codecs=avc1.42E01E'
    *  see this. https://bugs.chromium.org/p/chromium/issues/detail?id=980822 */
    const mediaOptions = { mimeType: this.mime }
    mediaOptions.videoBitsPerSecond = bitsPerSecond
    mediaOptions.bitsPerSecond = bitsPerSecond
    mediaOptions.audioBitsPerSecond = 0
    if( this.mediaRecorder ) {
      console.error( this.videoLogFormatter('about to create a new MediaRecorder when one already exists' ))
    }
    /* image/jpeg parameter */
    mediaOptions.qualityParameter = (typeof params.qualityParameter === 'number') ? 0.01 * params.qualityParameter : .75
    const mediaRecorder = new MediaRecorder( stream, mediaOptions )
    GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter("NEW MEDIARECORDER" ))
    this.mediaRecorderCount += 1
    this.mediaRecorder = mediaRecorder
    params.streamConstraints = this.getStreamConstraints( params.stream )
    this.options.sourceDevice = params.streamConstraints.track.label

    if (this.BGEffects) {
      this.BGEffects.skipEffectRendering = false
    }

    return (params)
  }

  // PRIVATE
  startVideoStream( params ) {
    if( params.inactive ) return params
    const stream = params.stream
    const mediaRecorder = this.mediaRecorder
    /* should we start transmitting ? */
    let transmitter = null
    if( this.ws && this.ws.transmitter && typeof this.ws.transmitter === 'function' &&
      this.transmitStarted && this.guestCount > 0 ) {
      transmitter = this.ws.transmitter
    }
    if( transmitter && typeof transmitter === 'function' ) {
      /* send browserCapabilities metadata */
      transmitter( 'T ' + JSON.stringify({client: this.clientKey, browserCapabilities: this.browserCapabilities}))
      const videoParamString = this.makeInfoQueryString( )
      transmitter( `Info set ${videoParamString}` )
      transmitter( `Starting ${this.mime}` )
    }
    const anyPreviews =
      (this.requestedPreviews && this.requestedPreviews.size > 0) ||
      (this.activePreviews && this.activePreviews.size > 0)

    if( anyPreviews || transmitter || (this.BGEffects && this.BGEffects.effectVideoCaptureElement) ) {
      GLANCE.Video.VideoDebug && console.debug(this.videoLogFormatter(transmitter ? 'start preview and transmit stream' : 'start preview only stream' ))
      if( mediaRecorder && transmitter ) {
        this.relay.frameindex = 0
        mediaRecorder.ondataavailable = transmitter
        mediaRecorder.start( this.frameMilliseconds )
      }

      if( this.BGEffects ) {
        this.BGEffects.startupRendering( params.constraints.video.frameRate )
      }
    }
    else GLANCE.Video.VideoDebug && console.debug( this.videoLogFormatter('no transmitter, no preview, do not start capture stream' ))

    params.streamConstraints = this.getStreamConstraints( stream )
    return params
  }

  // PRIVATE
  areStreamsValid() {
    if (this.stream && this.stream.active){
      if (this.bgBlurEnabled) {
        if( this.BGEffects && this.BGEffects.effectRenderedStream ) {
          return true
        }
        else {
          return false
        }
      }else{
        const profile = this.profileManager.getProfile()
        if( profile ) {
          let width = profile.width
          let height = profile.height
          let streamConstraints = this.getStreamConstraints(this.stream)
          if ( (streamConstraints.settings
              && (streamConstraints.settings.width != width)
              && (streamConstraints.settings.height != height))
            ||
            (this.constraints
              && profile.framerate
              && this.constraints.video.frameRate
              && (this.constraints.video.frameRate != profile.framerate)) ){
            return false
          }
        }
        return true
      }
    }
    return false
  }

  // PRIVATE
  saveParams( params, dest ) {
    dest = dest || this
    dest.stream = params.stream
    dest.videoElement = params.videoElement
    dest.streamConstraints = params.streamConstraints
    dest.source = params.source
    dest.constraints = params.constraints
    dest.indexDelta = params.indexDelta
    dest.qualityParameter = params.qualityParameter
  }

  static getScreenshareSurfaces() {
    return { application :  "application", window : "window", browser : "browser", monitor: "monitor" };
  }

  static loadParams( that, extra ) {
    const params = {
      stream: that.stream,
      streamConstraints: that.streamConstraints,
      source: that.source,
      videoElement: that.videoElement,
      constraints: that.constraints,
      indexDelta: that.indexDelta,
      qualityParameter: that.qualityParameter
    }
    if( extra )
      for( const key in extra )
        if( extra.hasOwnProperty( key ) )
          params[key] = extra[key]
    return params
  }

  /**
   * Start all the current video preview elements (in instances.activePreviews)
   * @param params these are pipleline parameters (params.stream).
   * @returns {Promise<any>}
   */
  // PRIVATE
  async startVideoPreviews( params ) {
    if( params.inactive ) return params
    const union = new Set( this.activePreviews )
    this.requestedPreviews.forEach( videoElement => union.add( videoElement ) )
    const videoElements = []
    union.forEach( ( value ) => {
      if( value ) {
        if( value.tagName && typeof value.tagName === 'string' && value.tagName.toUpperCase() === 'VIDEO' )
          videoElements.push( value )
        else
          console.error( this.videoLogFormatter('unexpected video preview element:', value, 'Possible MooTools corruption of Array.forEach()' ))
      }
    } )
    for( let i = 0; i < videoElements.length; i++ ) {
      /* defer preview starting */
      this.commandQueue.enqueue(
        {
          name: 'startVideoElementPreview',
          method: this.startVideoElementPreview,
          params: { stream: params.stream, videoElement: videoElements[i] }
        } )
    }
    return params
  }

  /**
   * Start a preview on a video element
   * @param params
   * @returns {Promise<any>}
   */
  // PRIVATE
  startVideoElementPreview( params ) {
    let stream = params.stream
    const element = params.videoElement
    //    const that = instance

    return new Promise( ( resolve, reject ) => {
      let playRequestComplete

      const playRequestFailed = ( playerEvent ) => {
        delete element.isPlayRequestInProgress
        element.removeEventListener( 'playing', playRequestComplete )
        element.removeEventListener( 'abort', playRequestFailed )
        element.removeEventListener( 'error', playRequestFailed )
        console.error( this.videoLogFormatter('preview play failed: abort or error occurred. '), playerEvent, element.readyState, stream.active)
        reject('preview play failed: abort or error occurred. ')
      }

      playRequestComplete = ( source ) => {
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('playRequestComplete entered'), !!element.isPlayRequestInProgress, source || 'event', element, element.readyState, stream.active )
        element.removeEventListener( 'playing', playRequestComplete )
        element.removeEventListener( 'abort', playRequestFailed )
        element.removeEventListener( 'error', playRequestFailed )
        if( element.isPlayRequestInProgress ) {
          GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('playRequestComplete activity'), source || 'event', element, element.readyState, stream.active )
          delete element.isPlayRequestInProgress
          element.previewActive = true
          this.requestedPreviews.delete( element )
          this.activePreviews.add( element )
          if( element.ownerDocument && element.ownerDocument.defaultView ) {
            const owner = element.ownerDocument.defaultView
            let videoSourceStatus = this.lookupVideoSourceStatus(owner)

            if (videoSourceStatus) {
              videoSourceStatus.requestedPreviews.delete( element )
              videoSourceStatus.activePreviews.add( element )
            }
          }
          /* due to a Safari defect, sometimes JpegMediaRecorder needs to
           * retrieve a preview <video> element from its stream. */
          stream.mostRecentlyActivatedPreview = element
          stream.activePreviews = this.activePreviews

          GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('started preview on'), element, element.readyState, stream.active )
          resolve()
        }
        else {
          GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('playRequestComplete BUT NO isPlayRequestInProgress - resolving anyway'), source || 'event', element, element.readyState, stream.active )
          resolve()
        }
      }

      if( !element ) {
        reject( 'no video element provided' )
        return
      }
      if( element && element.tagName.toUpperCase() !== 'VIDEO' ) {
        reject( 'not a video element' )
        return
      }
      if( element && stream !== element.srcObject ) {
        if( !element.isPlayRequestInProgress ) {
          if( this.BGEffects && this.BGEffects.effectRenderedStream ) {
            stream = this.BGEffects.effectRenderedStream
          }

          element.setAttribute( 'playsinline', true )
          element.setAttribute( 'muted', true )
          element.srcObject = stream
          element.isPlayRequestInProgress = true

          element.addEventListener( 'playing', playRequestComplete )
          element.addEventListener( 'abort', playRequestFailed )
          element.addEventListener( 'error', playRequestFailed )

          GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('about to call element.play on '), element, element.readyState, stream.active )
          element.load()
          element.play()

          // Force the element to be redrawn in Safari (GD-17985).
          // remove this when Apple fixes the Safari 15 video element bugs
          if(GLANCE.Video.GlanceVideoSource.getBrowser() === 'Safari') {
            element.style.backgroundColor = "black";
          }

          // this should be put back in place of the callbacks as it is the new standard
          //          var playPromise = element.play()
          //          playPromise.then(()=>{playRequestComplete()}).catch((err)=>{playRequestFailed(err)})

        }
        else {
          GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('play request already in progress'), element.readyState, stream.active )
          resolve()
        }
      }
      else if( element && stream === element.srcObject ) {
        /* video already playing on this element */
        resolve()
      }
      else {
        reject( 'no video element to play' )
      }
    } )
  }

  /**
   * stop a media recorder stream
   * @param params
   * @returns {Promise<any>}
   */
  // PRIVATE
  stopVideoStream( params ) {
    let resolving = false
    if( !params ) params = {}

    return new Promise( ( resolve ) => {
      const mediaRecorder = this.mediaRecorder
      if( mediaRecorder ) {
        if( mediaRecorder.ondataavailable ){
          var commandString = "Stopping"
          if (params.restarting){
            commandString += " restarting=true"
          }
          params.restarting = null
          mediaRecorder.ondataavailable( commandString )
        } 
        mediaRecorder.ondataavailable = null
        if( mediaRecorder.state !== 'inactive' && typeof mediaRecorder.stop === 'function' ) {
          // mediaRecorder.addEventListener( 'stop', () => {
          //   resolve( params )
          // } )
          // resolving = true
          mediaRecorder.stop()
          if( GLANCE.Video.VideoDebug && this.mediaRecorderCount !== 1 )
            console.error( this.videoLogFormatter(this.mediaRecorderCount, 'MediaRecorder instances right before deletion' ))
          delete this.mediaRecorder
          this.mediaRecorder = null
          this.mediaRecorderCount -= 1

        }
      }
      if( !resolving ) resolve( params )
    } )
  }

  /**
   * fetch the current constraints
   * @param stream
   * @returns {*}
   * todo: can be static
   */
  // PRIVATE
  getStreamConstraints( stream ) {
    const tracks = stream.getVideoTracks()
    if( !tracks || !tracks.length >= 1 || !tracks[0] ) return null
    const track = tracks[0]
    /* not all browsers provide all track. functions */
    const settings = (track.getSettings) ? track.getSettings() : null
    const constraints = (track.getConstraints) ? track.getConstraints() : null
    //    console.log(this.videoLogFormatter('streamConstraints are - ', constraints))
    const capabilities = (track.getCapabilities) ? track.getCapabilities() : null

    return {
      settings: settings,
      constraints: constraints,
      capabilities: capabilities,
      track: track
    }
  }

  /**
   * make a query string containing the necessary information for the Info set message
   * @returns {string} videowidth=www&videoheight=hhh&framerate=ff.f &downsample=d.d&bitrate=bbbbbbb&pframes=ppppp&paramset=zz
   */
  // PRIVATE
  makeInfoQueryString( ) {
    const profile = this.profileManager.getProfile()
    if( profile ) {
      var width = profile.width
      var height = profile.height

      if( (this.BGEffects && this.BGEffects.effectRenderedStream) || this.options.screenshare ) {
        // do nothing
      }else if (this.stream) {
        const tracks = this.stream.getVideoTracks()
        if (tracks && (tracks.length>=1)){
          const track = tracks[0]
          const settings = (track.getSettings) ? track.getSettings() : null
          if (settings){
            width = settings.width
            height = settings.height

            // this isn't needed for Android? Or just not implemented yet?
            if (GLANCE.Video.GlanceVideoSource.isSafariIOS()){
              var newOrientationPortrait = window.innerWidth < window.innerHeight;
              if (window.orientation !== undefined){
                newOrientationPortrait = (window.orientation % 180) == 0;
              }
              if (newOrientationPortrait && (width > height)){
                width = settings.height
                height = settings.width
              }
            }
          }
        }
      }

      var p = {
        videowidth: Number( width ).toFixed( 0 ),
        videoheight: Number( height ).toFixed( 0 ),
        downsample: Number( profile.downsample || 1 ).toFixed( 1 ),
        framerate: Number( profile.framerate ).toFixed( 2 ),
        bitrate: Number( profile.bitsPerSecond ).toFixed( 0 ),
        paramset: Number( profile.paramIndex || 0 ),
        pframes: Number( profile.pframes || 100 ),
      }

      let fps = this.profileManager.getRealFramerate()
      if (fps){
        p["realFramerate"] =  Number( fps ).toFixed( 2 )
      }

      const q = []
      for( let k in p )
        if( p.hasOwnProperty( k ) )
          q.push( `${k}=${p[k]}` )
      return q.join( '&' )
    }
    else return ''
  }

  /**
   * create the parameters for requesting a video offer.
   * @param {object} options -- the options object
   * @returns {array} -- array of key=value items.
   * todo: can be static
   */
  // PRIVATE
  makeOfferQueryString( options ) {
    const parms = []
    parms.push( 'videowidth=' + options.width )
    parms.push( 'videoheight=' + options.height )
    parms.push( 'bandwidth=' + options.bitspersecond )
    parms.push( 'framerate=' + options.framerate )
    parms.push( 'passcode=' + encodeURIComponent( options.sessionkey ) )
    if (options.videoBackEnabled) {
      parms.push('videoBackEnabled=' + options.videoBackEnabled)
    }

    let model
    if ( options.screenshare ) {
      // ss uses a bespoke profile
      model = 'screenshare' + '/' + this.mime
    }
    else {
      model = options.modelID + '/' + this.mime
    }

    parms.push( 'modelID=' + encodeURIComponent( model ) )
    parms.push( 'localizedName=' + encodeURIComponent( options.deviceName || options.device || 'webcam' ) )
    parms.push( 'MIME=' + encodeURIComponent( this.mime ) )

    if( options.conntype ) parms.push( 'conntype=' + options.conntype )
    else if( options.role ) parms.push( 'conntype=' + options.role )   // older 5.1 cobrowse
    if( options.maincallid ) parms.push( 'maincallid=' + options.maincallid )
    else if( options.maincid ) parms.push( 'maincallid=' + options.maincid )
    parms.push( 'uniqueID=' + encodeURIComponent( navigator.userAgent ) )

    if (options.personid)
      parms.push( 'personid=' + options.personid)

    // named screenshare here, isScreenshare on website
    if ( options.screenshare ) parms.push( 'isScreenshare=true')

    for( let z = 0; z < this.authTags.length; z++ ) {
      const key = this.authTags[z]
      if( options.hasOwnProperty( key ) ) {
        if( options[key] ) parms.push( key + '=' + encodeURIComponent( options[key] ) )
      }
    }
    return parms
  }

  /**
   /* ask for a session from the relay server
   * @param {string} server -- e.g. https://video.glance.net/ (with the trailing /)
   * @param {array} parms -- key/value
   * @param {string} method -- PUT or GET  (PUT starts new session)
   * @param {string} path -- default is 'offer'
   * @returns {object} -- offer descriptor
   */
  // PRIVATE
  requestOffer( server, parms, method = 'PUT', path = 'offer' ) {
    return new Promise( ( resolve, reject ) => {
      const opts = {
        method: method,
        cache: 'no-cache',
        credentials: 'include',
        cors: 'cors',
        body: parms.join( '&' ),
        headers: new Headers( {
          'Accept': 'application/json',
          'Content-type': 'application/x-www-form-urlencoded'
        } ),
      }
      fetch( server + path, opts )
      .then( response => {
        if( !response.ok || !response.json ) {
          reject( response )
        }
        return (response.json())
      } )
      .then( streamDescriptor => {
        this.currentOfferDescriptor = streamDescriptor
        resolve( streamDescriptor )
      } )
      .catch( error => {
        console.error( this.videoLogFormatter(server), error )
        reject( {
          ok: false,
          status: 408,
          statusText: 'no response from server: ' + error
        } )
      } )
    } )
  }


  /**
   * open the websocket for transmitting video to VServer,
   * and create its event handlers.
   * @param descriptor
   * @returns {Promise<any>}
   */
  // PRIVATE
  openWebSocket( descriptor ) {
    return new Promise( async ( resolve, reject ) => {
      this.isClosing = false
      const request = descriptor.offerer
      const streamid = descriptor.streamid

      /* hang on to some metadata */
      const relay = {}
      relay.descriptor = descriptor
      relay.streamId = streamid
      relay.connection = this.ws
      relay.request = request
      relay.role = 'offer'
      relay.octetcount = 0.0
      relay.packetcount = 0.0
      relay.frameindex = 0
      relay.username = descriptor.username || ''

      this.relay = relay

      this.profileManager.setDescriptor(descriptor)

      try {
        await this.makeAWebSocket( request )
        resolve()
      } catch (error)
      {
        this.shutdownNow( error, 'error' )
        reject()
      }

    } )
  }



  /**
   * @return {number}
   */
  static GetExponentialBackoffTime( retry ) {
    var baseTime = 2           // base time in seconds for exponential backoff
    var randomMax = 1          // max random number of seconds to add to exponential base
    var exponentLimit = 4      // exponent we cap at
    if( retry > exponentLimit ) retry = exponentLimit

    return (baseTime ** retry + Math.random() * randomMax) * 1000
  }

  // PRIVATE
  async reconnectWebSocket() {
    if( this.awaitingReconnect ) {
      GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('reconnectWebSocket - already waiting' ))
      return
    }

    var timeToWait = GLANCE.Video.GlanceVideoSource.GetExponentialBackoffTime( 0 )
    setTimeout( this.retryWebSocketConnect.bind(this), timeToWait )

    GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('Websocket reconnect attempt', 0, ' in ', timeToWait, ' ms' ))
  }


  // PRIVATE
  async retryWebSocketConnect() {
    const reconnectRetryLimit = 6

    this.reconnectRetries++

    try {
      this.awaitingReconnect = true
      GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter("Awaiting makeAWebSocket" ))
      await this.makeAWebSocket( this.relay.request )

      if (this.bufferReconnect){
        this.stepDownPerformanceProfile(-2)
      }

      // we get here when we got the websocket, clean up state for next time
      this.reconnectRetries = 0
      this.awaitingReconnect = false
      if (this.bufferReconnect){
        this.bufferReconnect = false
      }else{
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter("Reconnect successful - going to _restartVideoStream" ))
        await this.restartVideoStream()
      }
    }
    catch ( err ) {
      if( this.reconnectRetries < reconnectRetryLimit ) {
        var timeToWait = GLANCE.Video.GlanceVideoSource.GetExponentialBackoffTime( this.reconnectRetries )

        setTimeout( this.retryWebSocketConnect.bind(this), timeToWait )
        GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('got error from makeAWebSocket: reconnect attempt', this.reconnectRetries, ' in ', timeToWait, ' ms' ))
      }
      else {
        // give up but reset state for next time (if any)
        this.bufferReconnect = false
        this.reconnectRetries = 0
        this.awaitingReconnect = false
        this.giveUpReconnect = true
        console.log(this.videoLogFormatter( 'Too many retries in Reconnect' ))
        // don't rethrow, we are called from a timer, there is no one to catch it
      }

    }
  }

  // PRIVATE
  shutdownNow( event, eventName = 'sessionEnded' ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter('shutdownNowshutdownNow ' + eventName))
    if( !this.isClosing ) {
      if( this.reportHistoryInterval )
        clearInterval( this.reportHistoryInterval )
      this.reportHistoryInterval = null

      this.history.clear()
      this.closeVideoStream( {} )
      .then( () => {
        this.fireEvent( eventName, this.options, event )
        if( this.ws && this.ws.intervalPing ) {
          clearTimeout( this.ws.intervalPing )
          this.ws.intervalPing = null
        }
        this.ws = null
      } )
      this.isClosing = true
    }
  }

  send( command ) {
    if( command && typeof command === 'string' && command.length > 0 &&
      this.ws && this.ws.transmitter ) {
      this.ws.transmitter( command )
      return command
    }
  }

  // PRIVATE
  async makeAWebSocket( request ) {
    return new Promise( ( resolve, reject ) => {
      let ws = new WebSocket( request )
      this.ws = ws
      ws.binaryType = 'blob'

      /* report bandwidth history  */
      if( !this.reportHistoryInterval && this.historyLookback > 0 && this.historyTime > 0 && this.history ) {
        this.reportHistoryInterval = setInterval( this.reportHistory.bind(this), this.historyTime, this )
      }

      ws.onopen = () => {
        this.awaitingReconnect = false
        resolve()
      }

      ws.onclose = ( event ) => {
        GLANCE.Video.VideoDebug && console.debug( this.videoLogFormatter('Websocket close '),event )

        if( !event.wasClean || this.bufferReconnect) {
          if (this.bufferReconnect) {
            GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('websocket CLOSE - buffer reconnect' ))
          }
          else if (!event.wasClean) {
            GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('websocket CLOSE - clean flag is ' + event.wasClean ))
          }

          try {
            // attempt to reconnect the websocket if we haven't already given up
            if( !this.giveUpReconnect ) {
              this.reconnectWebSocket()
            }
            else {
              this.giveUpReconnect = false
              this.shutdownNow( event, 'error' )
            }
          }
          catch ( err ) {
            this.shutdownNow( err, 'error' )
          }
        }
        else {
          this.shutdownNow( event, 'sessionEnded' )
        }
      }

      ws.onerror = ( error ) => {
        console.error( this.videoLogFormatter('websocket error '), error )
        if( !error.statusMessage ) error.statusMessage = 'websocket error'
        reject( error )
      }

      /* context for measuring transmitter payload */
      let startTime
      let curTime

      /**
       * Transmit a payload, either a blob in event.data or a string in event.
       * This is called in the context of MediaRecorder, not Websocket.
       * @param event payload
       */
      ws.transmitter = ( event ) => {
        const now = Date.now()
        startTime = startTime || now
        curTime = curTime || now
        let payload
        const buf = event.data || null
        if( buf && buf instanceof Blob && buf.size !== 0 ) {
          if( now > curTime ) curTime = now
          this.relay.octetcount += buf.size
          this.relay.packetcount += 1
          this.relay.frameindex += 1
          payload = this.transmitStarted && this.guestCount > 0 ? buf : null
          //          GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'send payload size: ', buf.size, payload ? 'sent' : 'skipped, no guests' ))
          this.history.enqueue( { timestamp: now, size: buf.size } )
          if (payload){
            var keyframeInterval = 100
            if (GLANCE.Video.polyfilledMediaRecorder){
              const currentProfile = this.profileManager.getProfile()
              keyframeInterval = currentProfile.framerate * 2
            }
            this.profileManager.frame(this.relay.frameindex, keyframeInterval)
          }
        }
        else if( typeof event === 'string' && event.length > 0 ) {
          payload = event
          GLANCE.Video.VideoDebug && (GLANCE.Video.LogVideoTelemetry || !payload.startsWith('T {"client')) && console.log( this.videoLogFormatter('send command: ', payload ))
        }
        if( this.ws && ws && ws.readyState === 1 && payload ) {
          if (/*!this.options.screenshare && */ ws.bufferedAmount > 0){
            //            GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter("ws.bufferedAmount="+ws.bufferedAmount))
            let bytesPerSecond = 100000;
            if (this.constraints.bitspersecond){
              bytesPerSecond = this.constraints.bitspersecond / 8;
            }
            let bufferLimit = bytesPerSecond * (this.websocketBufferLimitInSeconds / 1000)
            if (ws.bufferedAmount > bufferLimit){
              GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter("ws.bufferedAmount exceeds limit of "+bufferLimit))
              this.bufferReconnect = true

              try {
                ws.close(3000, 'buffer reconnect');
              }catch(err){
                GLANCE.Video.VideoDebug && console.error(this.videoLogFormatter(' '), err)
              }

              this.profileManager.offererNetworkFailure()

              return
            }
          }
          ws.send( payload )
        }
/*
        else if( this.ws && ws && ws.readyState !== 1 && payload ) {
          GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter('Websocket not ready, cannot send payload' ))
        }
 */
      }

      ws.onmessage = ( event ) => {
        // GLANCE.Video.LogVideoTelemetry || don't log telemetry here - it gets output when processed
        GLANCE.Video.VideoDebug && (!event.data.startsWith('T {"client')) && console.debug( this.videoLogFormatter('receiving', event.data ))
        this.commandQueue.enqueue( event )
      }
    } )
  }

  // history cannot be private
  reportHistory( ) {
    const now = Date.now()
    const history = this.history
    /* get rid of stuff in the history that's too old */
    let old = history.peek()
    while ( old && typeof old.timestamp === 'number' && old.timestamp <= now - this.historyLookback ) {
      /* remove older history */
      history.dequeue()
      old = history.peek()
    }
    /* compute and display the history */
    if( old && typeof old.timestamp === 'number' ) {
      const earliestTime = old.timestamp
      let latestTime = old.timestamp
      /* don't count oldest frame */
      let frameCount = -1
      let byteSum = -old.size
      for( const item of history ) {
        byteSum += item.size
        frameCount += 1
        latestTime = item.timestamp
      }
      const deltaTime = latestTime - earliestTime
      if( deltaTime > 0 && frameCount > 0 ) {
        const profile = this.profileManager.getProfile()
        const requestedMbps = profile
          ? profile.bitsPerSecond / 1000000 : 0
        const requestedFramesPerSecond = profile ? profile.framerate : 0
        const kbitsPerSecond = 8 * (byteSum / deltaTime)
        this.measuredFramesPerSecond = 1000 * (frameCount / deltaTime)
        this.browserCapabilities.bitrate = Number((kbitsPerSecond * 1000).toFixed(0))
        this.browserCapabilities.framerate = Number( requestedFramesPerSecond.toFixed( 2 ) )
        this.ws.transmitter( 'T ' + JSON.stringify( { client: this.clientKey, browserCapabilities: this.browserCapabilities } ) )
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter(`actual: ${(kbitsPerSecond / 1000).toFixed( 2 )}mbps ${this.measuredFramesPerSecond.toFixed( 1 )}fps`
          + ` requested: ${requestedMbps.toFixed( 2 )}mbps  ${requestedFramesPerSecond.toFixed( 1 )}fps` ))
        this.send('Metrics minmaxavg Offer.stream.framerate ' + this.measuredFramesPerSecond.toFixed( 1 ))
        this.send('Metrics minmaxavg Offer.stream.bitrate ' + (kbitsPerSecond / 1000).toFixed( 2 ))

      }
    }
  }

  /**
   * all commands -- operations that may reconfigure the capture pipeline--
   * are queued so they happen one at a time, in the this.queue object.
   * This method runs the capture pipeline sequence.
   * @param commandString the current command
   * @returns {Promise<void>}
   */
  // PRIVATE
  async dispatchCommand( commandString ) {
    GLANCE.Video.VideoDebug && (GLANCE.Video.LogVideoTelemetry || !commandString.startsWith('T {"client')) && console.debug(this.videoLogFormatter('processing', commandString ))
    /* split command from "Command subcommand numericArgument" into strings */
    const msgArray = commandString.split( /\s+/ )
    if( msgArray.length < 1 ) throw new Error( 'no command: ' + commandString )
    const cmd = msgArray.shift()
    const payload = msgArray.join( ' ' )
    const subcmd = (msgArray.length >= 1) ? msgArray.shift() : null
    const args = msgArray.join( ' ' )
    let numericArgument = Number( args )
    if( isNaN( numericArgument ) ) numericArgument = args
    if( typeof numericArgument === 'string' && numericArgument.length === 0 ) numericArgument = false
    /* set up for "Faster" / "Slower" operation */
    let newIndex = 0
    let params = GLANCE.Video.GlanceVideoSource.loadParams( this )
    switch ( cmd ) {
      case  'Failure':
      case  'Error':
        GLANCE.Video.VideoDebug && console.info( this.videoLogFormatter(commandString ))
        break
      case 'Info':
        let handled = false
        if( subcmd ) {
          switch ( subcmd ) {
            case 'viewers':
              this.fireEvent( 'guestCountChanged', numericArgument, this.options )
              this.guestCount = numericArgument
              handled = true
              break
            case 'debug':
              GLANCE.Video.VideoDebug = numericArgument
              handled = true
              break
          }
        }
        if( !handled ) this.fireEvent( 'info', payload, this.options )
        break
      case 'Start':
        this.transmitStarted = true

        // work around SS bug GD-17936 Don't show the media selection window
        // again.
        // the real fix is to figure out why the media stream thinks it
        // needs to restart - we will probably not be updating streams
        // to the requested constraints by returning here.
        if (this.options.screenshare) {
          if (this.restartVideoStreamInProgress)
            break
        }

        // For GD-18210 Detection of slow network may be too sensitive or may be affected by stream restarts
        // avoid letting the VServer or player slow us down more when
        // we have just restarted the stream, thus inducing delay.
        // just wait for the same amount of time we would have for a faster or slower
        this.lastSpeedChangeTime = Date.now()

        if (typeof payload === 'string') {
          const ps = payload.trim().split('#')
          const types = ps.length >= 1 ? ps[0] : ''
          const clientKey = ps.length >= 2 ? ps[1] : undefined
          const width = ps.length >= 3 ? Number(ps[2]) : undefined
          const height = ps.length >= 4 ? Number(ps[3]) : undefined
          const reason = ps.length >= 5 ? ps[4] : 'open'
          GLANCE.Video.VideoDebug && console.log (this.videoLogFormatter('Start', types, clientKey, width, height, reason))

          if (clientKey && width && height){
            this.profileManager.addAcceptor(clientKey, width, height)
          }else{
            this.profileManager.staticMode()
          }

          // if we get browserCaps with Start, set them right away to avoid
          // restarts when we get the player size with the telemetry
          /*
          we might still want to do this even with the telemetry coming in
          first fixed, so that VServer can send pending start commands for
          accepter first scenarios

          const caps = ps.length >= 6 ? ps[5] : null
          if (caps) {
            let telemetry = {
              client: clientkey,
              browserCapabilities: caps
            }
            this.handleTelemetry(telemtry)
          }

           */

        }

        // double check that the stream is actually active
        // do NOT restart the stream if we are paused!
        if ( !this.paused && this.areStreamsValid() && !this.restartVideoStreamInProgress ) {
          // MAYBE NEED TO ENQUEUE THIS IF RESTARTVIDEOSTREAMINPROGRESS
          GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter('STARTSTARTSTART   ONLY RESTART MR '))
          params.restarting = true
          params = await this.stopVideoStream( params )
          params = await this.getConstraints( params )
          params = await this.getMediaRecorder( params )
          params = await this.startVideoStream( params )
          this.saveParams( params )
        }
        else {
          GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter('STARTSTARTSTART   FULL RESTARTVIDEOSTREAM '))
          await this.restartVideoStream( params )
        }
        break
      case 'Stop':
        GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter('!!!!!!!!!!!STOPSTOPSTOPSTOP'))
        this.transmitStarted = false
        params = await this.stopVideoStream( params )
        params = await this.releaseUserMedia( params )
        this.saveParams( params )
        /* perform a restart operation after a delay, so preview will restart when no viewers. */
        if( !this.pendingRestartTimeout ) {
          this.pendingRestartTimeout = window.setTimeout(
            params => {
              this.commandQueue.enqueue( {
                name: 'restartVideoStream',
                method: this.restartVideoStream,
                params: params
              } )
              this.pendingRestartTimeout = 0
            }, 200, params )
        }
        break
      case 'Faster':
        GLANCE.Video.VideoDebugEntryPoints && console.log(this.videoLogFormatter('Faster - Ignoring Faster command'))
        break
      case 'Slower':
        if (subcmd == "reason=device"){
          let clientId = msgArray[msgArray.length-1]
          this.profileManager.acceptorRenderFailure(clientId)
        }else if (subcmd == "reason=network"){
          let clientId = msgArray[msgArray.length-1]
          this.profileManager.acceptorNetworkFailure(clientId)
        } else{
          this.profileManager.legacySlower()
        }
        break
      case 'Ping':
        if( this.ws.transmitter ) this.ws.transmitter( 'Pong ' + payload )
        break
      case 'Pong':
        try {
          const time = Date.now()
          const probe = JSON.parse( payload )
          const dtime = (time - Number( probe.time )).toFixed( 0 )
          const doctetcount = this.relay.octetcount - Number( probe.octetcount )
          const dpacketcount = this.relay.packetcount - Number( probe.packetcount )
          const level = (doctetcount > 0 || dpacketcount > 0) ? 'notice' : null
          level && console.log( this.videoLogFormatter(`ping ${dtime}ms backlog octets:${doctetcount} packets:${dpacketcount}` ))
        }
        catch ( error ) {
          console.error( this.videoLogFormatter('Pong '), error )
          /* empty, intentionally.  No server crash on bad ping payload data */
        }
        break
      case 'Passthrough':
        if( subcmd ) {
          // noinspection JSRedundantSwitchStatement
          switch ( subcmd ) {
            case 'SessionInvitation':
              const glanceAddressIndex = commandString.indexOf( 'username=' )
              const sessionKeyIndex = commandString.indexOf( '&sessionkey=' )
              const sessionViewerIndex = commandString.indexOf( '&sessiontype=' )
              if( glanceAddressIndex > -1 && sessionKeyIndex > -1 && sessionViewerIndex > -1 ) {
                const glanceAddress = commandString.slice( glanceAddressIndex + 'username='.length, sessionKeyIndex )
                const sessionKey = commandString.slice( sessionKeyIndex + '&sessionkey='.length, sessionViewerIndex )
                const sessionViewer = commandString.slice( sessionViewerIndex + '&sessiontype='.length )
                GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter(`SessionInvitation message received GlanceAddress: ${glanceAddress} Session Key:${sessionKey} Sesion Viewer:${sessionViewer}` ))
                this.fireEvent( 'sessionInvitation', glanceAddress, sessionKey, sessionViewer )
              }
              else {
                GLANCE.Video.VideoDebug && console.log( this.videoLogFormatter(` Malformed SessionInvitation message received: ${commandString}` ))
              }
              break
            case 'sendpassthrough':
              // just fire event 'sendpassthrough', contents are opaque to us
              this.fireEvent( 'passthrough', args)
              break
            default:
              break
          }
        }
        break
      case 'updatedProfile':
        // remainder message is tuning data
        try {
          let tuning = JSON.parse( payload )

          await this.switchProfile( tuning, params )
        }
        catch (error) {
          console.error(this.videoLogFormatter('Invalid object returned for profile update '), error)
        }

        break
      case 'T':
        // telemetry
        try {
          this.handleTelemetry (JSON.parse( payload ))

        //  console.log (this.videoLogFormatter('offer received T') + this.clients)  // TODO remove
        } catch (ex) {
          console.error (this.videoLogFormatter('Cannot handle telemetry error - '), ex,' payload - ',payload)
        }
        break
      case 'Closed':
        const client = payload
        if (client) {
          if( this.clients.has( client ) ) this.clients.delete( client )
          //console.log( this.videoLogFormatter('offer received Closed', instance.clients ))
          this.profileManager.removeAcceptor(client)
        }
        break
      default:
        GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter( 'Unexpected websocket metadata received:', commandString ))
        break
    }
  }

  startTelemetryRollcall(callback) {
//    console.log('startTelemetryRollcall')
    this.telemetryRollcall = true

    this.rollcallCallback = callback

    this.clients.forEach ( (client) => {
      client.rollCallPresent = false
    })
  }

  checkRollcall() {
    // see if we've gotten everyone
    let allPresent = true
    this.clients.forEach ( (client, key) => {
      // skip this offerer
      if (key != this.clientKey) {
        allPresent = allPresent && client.rollCallPresent
      }
    })

    if (allPresent) {
      this.telemetryRollcall = false
      this.rollcallCallback()
    }
  }

  handleTelemetry( telemetry ) {
    const client = telemetry.client
    const clientData = {}
    if( telemetry.browserCapabilities ) clientData.browserCapabilities = telemetry.browserCapabilities
    if (telemetry.client === this.clientKey) {
      /* got our own caps back (with VServer-inserted rttPing data) */
      this.browserCapabilities = telemetry.browserCapabilities
    } else {
      clientData.browserCapabilities.self = false

      if (this.telemetryRollcall) {
        clientData.rollCallPresent = true
      }
    }
    this.clients.set( client, clientData )

    const caps = clientData.browserCapabilities
    if (caps && caps.clientWidth && caps.clientHeight ){
      this.profileManager.addAcceptor(client, caps.clientWidth, caps.clientHeight, caps.screenWidth, caps.screenHeight, caps.devicePixelRatio)
    }

    if (this.telemetryRollcall) {
      // see if we've gotten everyone
      this.checkRollcall()
    }
  }

  onProfileChanged(newProfile){
    GLANCE.Video.VideoDebug && console.info(this.videoLogFormatter("Video profile changed to: "), newProfile)
    this.logToServer(this.videoLogFormatter("Video profile changed to:"), newProfile)
    let params = GLANCE.Video.GlanceVideoSource.loadParams( this )
    params.restarting = true
    this.commandQueue.enqueue( {
      name: 'restartVideoStream',
      method: this.restartVideoStream,
      params: params
    } )
  }

  onProfileRealFramerate(realFramerate){
    GLANCE.Send("Info realFramerate " + realFramerate)
  }

  onProfileLog(msg){
    this.logToServer(msg)
  }

  // PRIVATE
  logToServer() {
    var args = Array.prototype.slice.call( arguments )
    args.splice( 0, 0, 'Log', 'notice' )
    for (var i = 0; i < args.length; i++){
      if (typeof args[i] === 'object'){
        args[i] = JSON.stringify(args[i])
      }
    }
    this.send( args.join( ' ' ) )
  }

  // called from GlanceVideoBGEffects
  stepDownPerformanceProfile(stepsize) {
    this.profileManager.offererEncodingFailure()
  }

  /**
   * Update options on the currently running video session.  If the session is paused,
   * updateVideoOptions does not unPause the session.  Rather it saves the options and
   * will use them if/when unPause is next called.
   * If the session is unPaused, updateVideoOptions restarts the stream with the specified options
   * @param {object }opts -- options structure including any options that apply to the video stream
   * such as: width, height, modelID, bgBlur, framerate, source etc.
   */
  updateVideoOptions( opts ) {
    GLANCE.Video.VideoDebugEntryPoints && console.log( this.videoLogFormatter('updateVideoOptionsupdateVideoOptions' + opts ))
    // update local options
    if( opts.width ) {
      this.options.width = opts.width
      if(this.options.width > this.profileManager.maximumWidth) {
        this.profileManager.maximumWidth = this.options.width 
      }
    }
    if( opts.height ) {
      this.options.height = opts.height
      if(this.options.height > this.profileManager.maximumHeight) {
        this.profileManager.maximumHeight = this.options.height 
      }
    }
    if( opts.bitspersecond ) {
      this.options.bitspersecond = opts.bitspersecond
    }
    if( opts.framerate ) {
      this.options.framerate = opts.framerate
    }
    if ( opts.modelID){
      this.options.modelID = opts.modelID
    }

    this.profileManager.setOptions(this.options)

    // send message to VServer with requested profile. We will expect a return message with updated coderparams
    if (this.profileManager.getMode() == GlanceVideoProfileManagerMode.STATIC){
      this.send(
        'requestNewProfile '
        + JSON.stringify( opts ) )
    }
  }

  doSwitchProfileRestart(params) {
    // stop running rollCall
    this.telemetryRollcall = false

//    console.log('doSwitchProfileRestartdoSwitchProfileRestartdoSwitchProfileRestart')
    if( this.pendingRestartTimeout ) {
      window.clearTimeout( this.pendingRestartTimeout )
      this.pendingRestartTimeout = 0
    }

    this.restartVideoStream( params )

    this.profileManager.resume()
  }

  // PRIVATE
  async switchProfile( profile, params ) {
    // save it
    GLANCE.Video.VideoDebugEntryPoints && console.log( this.videoLogFormatter('switchProfileswitchProfile'))

    // make sure we have a descriptor - if this message came back while we are shutting down/handling websocket error we
    // might not anymore
    if ( this.descriptor && this.relay ) {
      this.descriptor.coderparams = profile.params
      this.paramset = this.descriptor.coderparams[0]
      this.relay.devicedescriptor = this.descriptor.devicedescriptor = profile.devicedescriptor
      this.paramIndex = 0
      params.indexDelta = 0
      params.restarting = true

      // Do I need to enqueue?
      if ( !this.paused ) {
        this.profileManager.pause()
        this.profileManager.setDescriptor(this.descriptor)

        // we want to wait until we get any telemetry from the players with their new
        // size, if any, before we do a restart.
        // we have to be careful not to wait for telemetry that won't come, if for
        // instance the new sizes are no different from the old
//        await this.restartVideoStream( params )

        // tell handleParams that we want to call this callback when we have
        // gotten fresh telemetry from all clients
        this.startTelemetryRollcall( () => {
          this.doSwitchProfileRestart(params)
        })

        // we reuse pendingRestartTimeout because it is already cleared in all the right places
        if( !this.pendingRestartTimeout ) {
          this.pendingRestartTimeout = window.setTimeout(
            () => {
              this.doSwitchProfileRestart(params)
            }, 1000 )
        }

      }
      this.fireEvent( 'profileUpdated', this.relay )
    }
    else {
      GLANCE.Video.VideoDebug && console.log(this.videoLogFormatter('switchProfile called with null descriptor'))
    }
  }

  // PRIVATE
  async dispatchMethod( method, params, callback ) {
    let result = await method.call( this, params )
    if( callback && typeof callback === 'function' ) {
      result = callback( result )
    }
    return result
  }

  /**
   * Handle incoming commands from VServer or accepters
   * @param event incoming data
   * @param queue command queue
   */
  // PRIVATE
  handleCommand( event, queue ) {
    /*    GLANCE.Video.VideoDebug && console.log( 'starting',
          typeof event.data === 'string' ? event.data : event.name,
          typeof event.data === 'string' ? 'command' : 'method',
          'queued:', queue.getLength() )
    */
    let promise
    if( event && event.data && typeof event.data === 'string' ) {
      let command = event.data
      let doStringCommand = true
      for( const otherEvent of queue ) {
        if( otherEvent && otherEvent.data && typeof otherEvent.data === 'string' && command === otherEvent.data ) {
          /* another identical request later in the queue, skip this one */
          doStringCommand = false
          break
        }
      }
      if( doStringCommand ) promise = queue._options.that.dispatchCommand( event.data )
    }
    else if( event && event.method && typeof event.name === 'string' ) {
      let doMethodCommand = true
      for( const otherEvent of queue ) {
        if( otherEvent && otherEvent.name && otherEvent.name === event.name ) {
          doMethodCommand = false
          break
        }
      }
      if( doMethodCommand && event.method && typeof event.method === 'function' )
        promise = queue._options.that.dispatchMethod( event.method, event.params, event.callback )
    }
    else {
      console.error( event, 'unrecognized queue element' )
      queue.complete( event )
    }
    if( promise ) {
      promise.then( () => {
        /*
                GLANCE.Video.VideoDebug && console.log( 'completing',
                  typeof event.data === 'string' ? event.data : event.name,
                  typeof event.data === 'string' ? 'command' : 'method',
                  'queued:', queue.getLength() )
         */
        queue.complete( event )
      } )
      .catch( error => {
        console.error( event, error )
        queue.complete( event )
      } )
    }
    /* mark command complete if we skipped it during deduplication */
    else {
      GLANCE.Video.VideoDebug && console.error( 'skipped',
        typeof event.data === 'string' ? event.data : event.name,
        typeof event.data === 'string' ? 'command' : 'method',
        'queued:', queue.getLength() )
      queue.complete( event )
    }
  }

  /**
   * turn bandwidth specs like 2mbps (bits per sec) or 200K (bytes) into bits/second number
   * @param {string} bw -- the bandwidth spec
   * @param {number} def -- the default
   * @returns {number}  -- bits/second
   */
  static expandBandwidth( bw, def = 256000 ) {
    const match = bw.match( /^(\d+)([KMGkmg]?[A-Za-z]*)$/ )

    if( match.length < 3 ) return (def || 128000)

    if( match[2] === 'kbps' ) return match[1] * 1000
    if( match[2] === 'mbps' ) return match[1] * 1000 * 1000
    if( match[2] === 'gbps' ) return match[1] * 1000 * 1000 * 1000

    if( match[2] === 'K' ) return match[1] * 8 * 1024
    if( match[2] === 'M' ) return match[1] * 8 * 1024 * 1024
    if( match[2] === 'G' ) return match[1] * 8 * 1024 * 1024 * 1024
    return (def || 128000)
  }

  /**********************************************/
  /* event handling stuff  for AgentVideo       */
  /**********************************************/


  /**
   * Add an event listener
   * @param {string} name -- name of event, e.g. 'error'
   * @param {function} handler -- event handler
   *
   * must be public
   */
  addEventListener( name, handler ) {
    if( this.events.hasOwnProperty( name ) )
      this.events[name].push( handler )
    else
      this.events[name] = [handler]
  }

  /**
   * Remove all added event listeners
   */
   removeAllEventListeners() {
    for (var name in this.events){
      delete this.events[name]
    }
  }

  /**
   * Remove a previously added event listener
   * @param {string} name -- name of event, e.g. 'error'
   * @param {function} handler -- event handler
   */
  // PRIVATE
  removeEventListener( name, handler ) {
    /* This is a bit tricky, because how would you identify functions?
     This simple solution should work if you pass THE SAME handler. */
    if( !this.events.hasOwnProperty( name ) )
      return

    const index = this.events[name].indexOf( handler )
    if( index !== -1 ) {
      this.events[name][index] = null
      this.events[name].splice( index, 1 )
      if( this.events[name].length === 0 ) {
        delete this.events[name]
      }
    }
  }

  /**
   * Fire a named event, sending it all the parameters.
   * @param {string} name -- the event name to fire.
   * really should be private but it is called from GlanceVideoBGEffects. That call could
   * be wrapped, but I don't think it will be the last place we want to fire events from owned
   * objects...
   */
  fireEvent( name ) {
    /* no event handlers for this event? then do nothing */
    if( !this.events.hasOwnProperty( name ) ) return

    /* make an array from the rest of the arguments array-like object */
    const args = Array.prototype.slice.call( arguments, 1 )
    const eventList = this.events[name]
    for( let i = 0; i < eventList.length; i++ ) {
      const event = eventList[i]
      if( event && typeof event === 'function' && typeof event.apply === 'function' ) {
        event.apply( null, args )
      }
    }
  }

  /**
   * @param {string} glanceAddress
   * @param {string} sessionKey
   * @param {string} sessionType
   */
  sendSessionInvitation( glanceAddress, sessionKey, sessionType ) {
      this.send(
        'Passthrough SessionInvitation '
        + 'username=' + glanceAddress
        + '&sessionkey=' + sessionKey
        + '&sessiontype=' + sessionType )
    }

  //  format console output with (v) for video or (ss) for screenshare
  videoLogFormatter() {
    let preface = '(v) '
    if (this.options.screenshare) {
      preface = '(ss) '
    }
    arguments[0] = preface + arguments[0]
    let toLog = Array.from(arguments).join(' ')
    return toLog
  }

  /***
   * get the name of the present browser
   * @returns {string} Chrome, Firefox, Microsoft Internet Explorer
   */
  static getBrowser() {
    return GLANCE.browserCapabilities.browser
  }

  static isBrowserCapable() {
    return GLANCE.browserCapabilities.isBrowserCapable
  }

  static isSafariIOS() {
    return GLANCE.browserCapabilities.isSafariIOS
  }

  static isAndroid() {
    /*
    return (navigator.userAgent.indexOf( 'Android' ) >= 0)
     */
    return GLANCE.browserCapabilities.isAndroid
  }

  /**
   * determines whether present environment can do video
   * @returns {Promise}
   */
  static isAgentVideoCapable() {
    return new Promise( function( resolve, reject ) {
      const browser = GLANCE.Video.GlanceVideoSource.getBrowser()
      if( browser !== 'Chrome' && browser !== 'Safari' && browser !== 'Firefox' ) {
        reject( browser + ' does not support video' )
        return
      }
      if( !navigator || !navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' ) {
        reject( browser + ' does not support getUserMedia' )
        return
      }
      if( typeof navigator.mediaDevices.enumerateDevices !== 'function' ) {
        reject( browser + ' does not support enumerateDevices' )
        return
      }
      navigator.mediaDevices.enumerateDevices()
      .then( devices => {
        const result = devices.some( device => {
          return device.kind === 'videoinput'
        } )
        if( result ) resolve( result )
        else reject( 'No video input devices available' )
      } )
    } )
  }
}     // end class definition
//////////////////////////////////////////////////////////////////////////////////////////////////////////



/*
  todo: fix this or remove it if no longer needed

  // Debugging: force the given framerate to trigger agent detection throttling
  GLANCE.forceFramerate = function forceFramerate(framerate) {
    console.log('forceFramerate to ' + framerate + 'fps')
    requestedFrameRate = framerate
    detectionThrottleFrameLimit = framerate
  }
 */

/*

A class to represent a queue
Created by Kate Morley - https://code.iamkate.com/ - and released under the terms
of the CC0 1.0 Universal legal code:
https://creativecommons.org/publicdomain/zero/1.0/legalcode
Updated by Oliver Jones under the same terms.


/** Creates a new queue. A queue is a first-in-first-out (FIFO) data structure -
 * items are added to the end of the queue and removed from the front.
 * A queue is iterable, from the oldest to the newest entry: from front to end.
 *     for ( const item of queue ) { }
 */
GLANCE.Queue = class Queue {
  constructor( options ) {
    // initialise the queue and offset
    this._queue = []
    this._offset = 0
    this._current = null
    this._options = options || {}
  }

  setOptions( options ) {
    for( let option in options ) {
      if( !options.hasOwnProperty( option ) ) continue
      this._options[option] = options[option]
    }
  }

  clear() {
    this._queue = []
    this._offset = 0
    this._current = null
  }

  _dispatch() {
    if( this._options && this._options.handler && typeof this._options.handler === 'function' ) {
      /* element actively being processed */
      if( this._current ) return
      if( this.isEmpty() ) return
      this._current = this.dequeue()
      this._options.handler( this._current, this )
    }
  }

  /**
   * call this when processing the item is complete, dispatches next item if any
   * @param item
   */
  complete( item ) {
    if( this._options && this._options.handler && typeof this._options.handler === 'function' ) {
      if( this._current !== item ) console.error( this.videoLogFormatter('returned item out of order'), item )
      this._current = undefined
      if( !this.isEmpty() ) {
        setTimeout( () => {
          this._dispatch()
        }, 0 )
      }
    }
  }

  /**
   * Get the current length of the queue
   * @returns {number} or 0 if the queue is empty.
   */
  getLength() {
    return (this._queue.length - this._offset)
  };

  /**
   * Detect whether a queue is empty
   * @returns {boolean} true if empty, false if not.
   */
  isEmpty() {
    return (this.getLength() === 0)
  };

  /**
   * Enqueues the specified item
   * @param item
   */
  enqueue( item ) {
    this._queue.push( item )
    this._dispatch()
  };

  /**
   * Removes the oldest item from the queue and returns it.
   * @returns queue item, or undefined if the queue is empty
   */
  dequeue() {
    // if the queue is empty, return immediately
    if( this._queue.length === 0 ) return undefined

    // store the item at the front of the queue
    const item = this._queue[this._offset]

    // increment the offset and remove the free space if necessary
    if( ++this._offset * 2 >= this._queue.length ) {
      this._queue = this._queue.slice( this._offset )
      this._offset = 0
    }

    // return the dequeued item
    return item

  };

  /**
   * Returns the item at the front of the queue (without dequeuing it).
   * @returns queue item, or undefined if the queue is empty
   */
  peek() {
    return (this._queue.length > 0 ? this._queue[this._offset] : undefined)
  };

  /**
   *  Returns the item at the tail of the queue,
   *  the most recently inserted item, without dequeuing it.
   * @returns queue item or undefined if the queue is empty
   */
  peekTail() {
    return (this._queue.length > 0 ? this._queue[this._queue.length - 1] : undefined)
  };

  /**
   * Iterator allowing
   *      for (const item of queue) { }
   * Yields, space-efficiently, the elements of the queue from oldest to newest.
   * @returns {{next: next}}
   */
  [Symbol.iterator]() {
    let step = this._offset
    return {
      next: () => {
        if( this._queue.length <= step ) return { value: undefined, done: true }
        return { value: this._queue[step++], done: false }
      }
    }
  }
}

const GlanceVideoProfileManagerState = {
  UNINITIALIZED: "uninitialized",
	READY: "READY"
}

const GlanceVideoProfileManagerMode = {
  STATIC: "static",
  DYNAMIC: "dynamic"
}

const GlanceVideoProfileManagerDowngradeReason = {
	OFFERER_NETWORK: "OFFERER_NETWORK",
	OFFERER_DEVICE: "OFFERER_DEVICE",
  ACCEPTOR_NETWORK: "ACCEPTOR_NETWORK",
	ACCEPTOR_DEVICE: "ACCEPTOR_DEVICE"
}

const GlanceVideoProfileManagerProfileStorageKey = "GLANCE.Video.GlanceVideoProfileManager.Profile"

GLANCE.Video.GlanceVideoProfileManager = class {
  constructor(options, bgBlurEnabled, listener){
    this.options = options
    this.listener = listener

    this.minimumFramerate = 5
    this.minimumWidth = 120
    this.minimumHeight = 90
    
    this.maximumFramerate = (bgBlurEnabled && (GLANCE.browserCapabilities.isAndroid || GLANCE.browserCapabilities.isSafariIOS)) ? 12 : 24;
    this.maximumWidth = this.options.width || 640
    this.maximumHeight = this.options.height || 360
    this.goalFramerate = this.options.framerate ? parseInt(this.options.framerate) : 20
    this.framerate = this.options.framerate ? parseInt(this.options.framerate) : this.goalFramerate
    this.stabilityLevel = 1
    this.qualityNetworkDowngradeResolutionInPercentage = 15
    this.qualityNetworkDowngradeFramerateInPercentage = 15
    this.qualityDeviceDowngradeResolutionInPercentage = 30
    this.qualityDeviceDowngradeFramerateInPercentage = 25
    this.qualityUpgradeResolutionInPercentage = 10
    this.qualityUpgradeFramerateInPercentage = 10
    this.maximumResolutionDownscaleInPercentage = 200
    this.offererNetworkFailureRetries = 3
    this.h264Constant = 0.13
    this.frameTimestamps = new Array();

    this.state = GlanceVideoProfileManagerState.UNINITIALIZED
    this.mode = GlanceVideoProfileManagerMode.DYNAMIC
    if (this.options.screenshare){
      this.mode = GlanceVideoProfileManagerMode.STATIC
    }
    this.acceptors = {}
    this.paramIndex = 0
    this.descriptor = null
    this.downgradeCount = 0
    this.paused = false
    this.bgBlurEnabled = bgBlurEnabled
    this.realFramerate = undefined

    this.reset()
  }

  getMode(){
    return this.mode
  }

  pause(){
    GLANCE.Video.VideoDebug && console.log("Video profile manager paused")
    this.paused = true
    this.clearFrameTimestamps()
  }

  resume(){
    GLANCE.Video.VideoDebug && console.log("Video profile manager resumed")
    this.paused = false
    this.clearFrameTimestamps()
  }

  setOptions(options){
    this.options = options
    if (this.options.width && this.options.height){
      // todo this !this.bgBlurEnabled is suspicious, it might be wrong just like the one below
      if (!this.maximumWidth || !this.maximumHeight || !this.bgBlurEnabled){
        this.maximumWidth = this.options.width
        this.maximumHeight = this.options.height
      }
      var newFramerate = this.options.framerate
      if (newFramerate && !this.bgBlurEnabled){
        newFramerate = parseInt(newFramerate)
        if (!this.framerate){
          this.framerate = newFramerate
        }
        if (!this.goalFramerate){
          this.goalFramerate = newFramerate
        }
        this.maximumFramerate = newFramerate
        if (this.framerate > this.maximumFramerate){
          this.framerate = this.maximumFramerate
        }
        if (this.goalFramerate > this.maximumFramerate){
          this.goalFramerate = this.maximumFramerate
        }
      }

      // for GD-19155, turn this off, it prevents us from ever changing render scale if BG effects on
      // (since this.width/height are true after the first time this is called. Or maybe even before
 //     if (!this.width  || !this.height || !this.bgBlurEnabled){
        this.updateProfile(this.options.width, this.options.height, newFramerate)
 //     }
    }
  }

  setDescriptor(descriptor){
    this.descriptor = descriptor
    this.paramIndex = 0

    this.notifyListener()
  }

  onClose(){
    if( this.mode == GlanceVideoProfileManagerMode.STATIC ){
      this.paramIndex = 0
      this.descriptor = null
    }
    this.stabilityLevel = 1
    this.clearSavedSessionProfile()
  }

  addAcceptor(id, clientWidth, clientHeight, screenWidth, screenHeight, devicePixelRatio){
    if (devicePixelRatio){
      clientWidth = clientWidth * devicePixelRatio
      clientHeight = clientHeight * devicePixelRatio
      if (screenWidth && screenHeight){
        screenWidth = screenWidth * devicePixelRatio
        screenHeight = screenHeight * devicePixelRatio
        let heightToWidthRatio = clientHeight / clientWidth
        let widthToHeightRatio = clientWidth / clientHeight
        if (screenWidth < clientWidth){
          clientWidth = screenWidth
          clientHeight = clientWidth * heightToWidthRatio
        }
        if (screenHeight < clientHeight){
          clientHeight = screenHeight
          clientWidth = clientHeight * widthToHeightRatio
        }
      }
    }
    clientWidth = Math.floor(clientWidth)
    clientHeight = Math.floor(clientHeight)
    // round down instead of up - we may have already seen we were too big for screen width or height
    if ((clientWidth % 2) != 0) {
      clientWidth--
    }
    if ((clientHeight % 2) != 0) {
      clientHeight--
    }
    if (this.state == GlanceVideoProfileManagerState.UNINITIALIZED){
      if (!this.width && !this.height){
        var newHeight = clientHeight
        if (newHeight > this.maximumHeight){
          newHeight = this.maximumHeight
        }
        var newWidth = Math.floor(newHeight * (this.maximumWidth / this.maximumHeight))
        this.setWidth(newWidth)
        this.setHeight(newHeight)
      }
      this.acceptors[id] = {width: clientWidth, height: clientHeight}
      this.state = GlanceVideoProfileManagerState.READY
    }else{
      let oldMin = this.getAcceptorMinimumResolution()
      this.acceptors[id] = {width: clientWidth, height: clientHeight}
      let newMin = this.getAcceptorMinimumResolution()

      var degraded = false
 //     if ( (oldMin && this.width && this.height && (( (oldMin.width - this.width) > 10) || ( (oldMin.height - this.height) > 10)) || ( (this.goalFramerate - this.framerate) > 2))){
      if ( (oldMin && this.width && this.height && ((this.width < oldMin.width) || (this.height < oldMin.height))) || (this.framerate < this.goalFramerate)){
        degraded = true
      }

      var newHeight = newMin.height
      if (newHeight > this.maximumHeight){
        newHeight = this.maximumHeight
      }
      var newWidth = Math.floor(newHeight * (this.maximumWidth / this.maximumHeight))

      if (!degraded || !this.width || !this.height || (Math.abs(this.width - newWidth) > 10 ) || (Math.abs(this.height - newHeight) > 10) || (newMin && oldMin && (Math.abs(oldMin.height - newMin.height) > 10))){
//      if (!degraded || !this.width || !this.height || (newWidth < this.width || newHeight < this.height || (newMin && oldMin && (newMin.height > oldMin.height)))){
        this.reset()
        if (newMin && oldMin && (newMin.height > oldMin.height)){
          this.newMinimumHeight = true
        }
        this.updateProfile(newWidth, newHeight)
        return true
      }
    }

    return false
  }

  removeAcceptor(id){
    if (this.acceptors[id]){
      delete this.acceptors[id]
      
      let newMin = this.getAcceptorMinimumResolution()
      if (newMin){
        if (newMin.width < this.width || newMin.height < this.height){
          this.updateProfile(newMin.width, newMin.height)
          return true
        }
      }else{
        this.reset()
        this.width = undefined
        this.height = undefined
        this.downgradeCount = 0
        this.framerate = this.goalFramerate
        this.notifyListener()
      }
    }
    return false
  }

  staticMode(){
    this.mode = GlanceVideoProfileManagerMode.STATIC
    this.notifyListener()
  }

  // PRIVATE
  notifyListener(){
    if (this.listener){
      this.listener.onProfileChanged(this.getProfile())
    }
  }

  // PRIVATE
  notifyListenerRealFramerate(){
    if (this.listener && this.realFramerate){
      this.listener.onProfileRealFramerate(this.realFramerate)
    }
  }

  // PRIVATE
  updateProfile(newWidth, newHeight, newFramerate){
    if (!this.width && !this.height){
      this.fetchSavedSessionProfile()
      if (this.width && this.height){
        this.clearFrameTimestamps()
        this.notifyListener()
        return
      }
    }

    const oldWidth = this.width
    const oldHeight = this.height
    const oldFramerate = this.framerate
    if (newWidth){
      this.setWidth(newWidth)
    }
    if (newHeight){
      this.setHeight(newHeight)
    }
    if (newFramerate){
      this.setFramerate(newFramerate)
    }

    if (this.width != oldWidth || this.height != oldHeight || this.framerate != oldFramerate){
      this.clearFrameTimestamps()
      this.notifyListener()
    }

    if (this.mode == GlanceVideoProfileManagerMode.DYNAMIC){
      this.saveSessionProfile()
    }
  }

  // PRIVATE
  saveSessionProfile(){
    if (window.sessionStorage){
      try {
        var sessionProfile = this.getProfile()
        if (sessionProfile){
          sessionProfile.stabilityLevel = this.stabilityLevel
          window.sessionStorage.setItem(GlanceVideoProfileManagerProfileStorageKey, JSON.stringify(sessionProfile))
        }
      }catch(err){}
    }
  }

  // PRIVATE
  fetchSavedSessionProfile(){
    if (this.mode == GlanceVideoProfileManagerMode.DYNAMIC){
      if (window.sessionStorage){
        try {
          const sessionProfileString = window.sessionStorage.getItem(GlanceVideoProfileManagerProfileStorageKey)
          if (sessionProfileString){
            const sessionProfile = JSON.parse(sessionProfileString)
            if (sessionProfile.width && sessionProfile.height && sessionProfile.framerate){
              this.log("Video profile manager: Fetched saved profile from session storage: " + sessionProfileString)
              this.width = sessionProfile.width
              this.height = sessionProfile.height
              this.framerate = sessionProfile.framerate
              this.stabilityLevel = sessionProfile.stabilityLevel
            }
          }
        } catch(err){}
      }
    }
  }

  // PRIVATE
  clearSavedSessionProfile(){
    if (window.sessionStorage){
      window.sessionStorage.removeItem(GlanceVideoProfileManagerProfileStorageKey)
    }
  }

  // PRIVATE
  clearFrameTimestamps(){
    this.frameTimestamps.splice(0,this.frameTimestamps.length)
  }

  // PRIVATE
  setWidth(newWidth){
    newWidth = Math.floor(newWidth)
    if ((newWidth % 2) != 0) {
      newWidth--;
    }
    if (newWidth < this.minimumWidth){
      newWidth = this.minimumWidth
    }else if (newWidth > this.maximumWidth){
      newWidth = this.maximumWidth
    }
    this.width = newWidth
  }

  // PRIVATE
  setHeight(newHeight){
    newHeight = Math.floor(newHeight)
    if ((newHeight % 2) != 0){
      newHeight--;
    }
    if (newHeight < this.minimumWidth){
      newHeight = this.minimumHeight
    }else if (newHeight > this.maximumHeight){
      newHeight = this.maximumHeight
    }
    this.height = newHeight
  }

  // PRIVATE
  setFramerate(newFramerate){
    if (this.framerate != newFramerate){
      this.realFramerate = undefined
    }
    if (newFramerate < this.minimumFramerate){
      newFramerate = this.minimumFramerate
    }else if (newFramerate > this.maximumFramerate){
      newFramerate = this.maximumFramerate
    }
    this.framerate = newFramerate
  }

  // PRIVATE
  hasAcceptors(){
    for (var id in this.acceptors){
      return true
    }

    return false
  }

  // PRIVATE
  getAcceptorMinimumResolution(){
    var width = undefined
    var height = undefined

    for (var id in this.acceptors){
      let acceptor = this.acceptors[id]
      let acceptorWidth = acceptor.width
      if (width){
        width = Math.min(width, acceptorWidth)
      }else{
        width = acceptorWidth
      }
      let acceptorHeight = acceptor.height
      if (height){
        height = Math.min(height, acceptorHeight)
      }else{
        height = acceptorHeight
      }
    }

    if (width && height){
      width = Math.floor(width)
      height = Math.floor(height)
      if ((width % 2) != 0) {
        width++;
      }
      if ((height % 2) != 0) {
        height++;
      }
      return {width: width, height: height}
    }

    return undefined
  }

  // PRIVATE
  getAcceptorMaximumResolution(){
    var width = undefined
    var height = undefined

    for (var id in this.acceptors){
      let acceptor = this.acceptors[id]
      let acceptorWidth = acceptor.width
      if (width){
        width = Math.max(width, acceptorWidth)
      }else{
        width = acceptorWidth
      }
      let acceptorHeight = acceptor.height
      if (height){
        height = Math.max(height, acceptorHeight)
      }else{
        height = acceptorHeight
      }
    }

    if (width && height){
      width = Math.floor(width)
      height = Math.floor(height)
      if ((width % 2) != 0) {
        width++;
      }
      if ((height % 2) != 0) {
        height++;
      }
      return {width: width, height: height}
    }

    return undefined
  }

  // PRIVATE
  reset(){
    this.offererNetworkFailureCount = 0
    this.successfulKeyframeIntervals = 0
    this.frameIndexWithinKeyframe = 0
    this.shouldUpgrade = false
    this.shouldDowngrade = false
    this.downgradeReason = undefined
    this.clearFrameTimestamps()
  }

  // PRIVATE
  upgrade(){
    if (!this.shouldDowngrade){
      this.shouldUpgrade = true
    }
  }

  // PRIVATE
  log(msg){
    GLANCE.Video.VideoDebug && console.log(msg)
    if (this.listener){
      this.listener.onProfileLog(msg)
    }
  }

  // PRIVATE
  performUpgrade(){
    this.reset()
    if( this.mode == GlanceVideoProfileManagerMode.STATIC ){
      this.performStaticUpgrade()
    } else if( this.mode == GlanceVideoProfileManagerMode.DYNAMIC ){
      this.performDynamicUpgrade()
    }
    if (this.stabilityLevel > 1){
      this.stabilityLevel--
      this.setRequiredStabilityIntervals()
      this.log("Video profile manager: Stability is now " + this.requiredStabilityInSeconds + " seconds (" + this.requiredStabilityIntervals + " successful keyframe intervals).")
    }
  }

  // PRIVATE
  performStaticUpgrade(){
    let newIndex = this.getCoderparamsDelta( this.descriptor, this.paramIndex, 1 )
    if( newIndex !== this.paramIndex ) {
      this.paramIndex = newIndex
      this.notifyListener()
    }
  }

  // PRIVATE
  performDynamicUpgrade(){
    if (this.framerate && this.width && this.height){
      var newFramerate = this.framerate
      var newWidth = this.width
      var newHeight = this.height
      if (!this.newMinimumHeight && (newFramerate < this.goalFramerate) && newFramerate < this.maximumFramerate){
        newFramerate = Math.ceil(newFramerate*(1.0+((this.qualityUpgradeFramerateInPercentage)/100.0)))
        if (newFramerate > this.goalFramerate){
          newFramerate = this.goalFramerate
        }
      }else{
        if (this.downgradeCount > 0){
          let minRes = this.getAcceptorMinimumResolution()
          if (this.height < minRes.height){
            if (this.newMinimumHeight){
              newHeight = minRes.height
            }else {
              newHeight = Math.floor(this.height*(1.0+((this.qualityUpgradeResolutionInPercentage)/100.0)))
            }
            if (newHeight > minRes.height){
              newHeight = minRes.height
            }
            if (newHeight > this.maximumHeight){
              newHeight = this.maximumHeight
            }else{
              newHeight = Math.floor(newHeight / 16) * 16
            }
            newWidth = Math.floor(newHeight * (this.maximumWidth / this.maximumHeight))
          }
        }else{
          let minRes = this.getAcceptorMinimumResolution()
          if (newHeight < minRes.height){
            newHeight = minRes.height
          }else{
            newHeight = Math.floor(newHeight*(1.0+((this.qualityUpgradeResolutionInPercentage)/100.0)))
          }
          let maxRes = this.getAcceptorMaximumResolution()
          var max = this.maximumHeight
          if (maxRes && (maxRes.height < max)){
            max = maxRes.height
          }
          if (newHeight >= max){
            newFramerate = Math.floor(newFramerate*(1.0+((this.qualityUpgradeFramerateInPercentage)/100.0)))
            newHeight = max
          }else{
            newHeight = Math.floor(newHeight / 16) * 16
          }
          newWidth = Math.floor(newHeight * (this.maximumWidth / this.maximumHeight))
        }
      }
      if (newFramerate > this.maximumFramerate){ 
        newFramerate = this.maximumFramerate
      }
      this.newMinimumHeight = false
      this.updateProfile(newWidth, newHeight, newFramerate)
      GLANCE.Video.VideoDebug && console.log("Upgrade : " + newWidth + ", " + newHeight + ", " + newFramerate)
    }
  }

  // PRIVATE
  downgrade(reason){
    this.shouldDowngrade = true
    this.shouldUpgrade = false
    this.downgradeReason = reason
    this.newMinimumHeight = false
  }

  // PRIVATE
  performDowngrade(){
    const reason = this.downgradeReason
    this.downgradeCount++
    this.reset()
    if( this.mode == GlanceVideoProfileManagerMode.STATIC ){
      this.performStaticDowngrade(reason)
    } else if( this.mode == GlanceVideoProfileManagerMode.DYNAMIC ){
      this.performDynamicDowngrade(reason)
    }
    if (this.stabilityLevel < 4){
      this.stabilityLevel++
      this.setRequiredStabilityIntervals()
      this.log("Video profile manager: Stability is now " + this.requiredStabilityInSeconds + " seconds (" + this.requiredStabilityIntervals + " successful keyframe intervals).")
    }
  }

  // PRIVATE
  performStaticDowngrade(reason){
    let newIndex = this.getCoderparamsDelta( this.descriptor, this.paramIndex, -1 )
    if( newIndex !== this.paramIndex ) {
      this.paramIndex = newIndex
      this.notifyListener()
    }
  }

  // PRIVATE
  performDynamicDowngrade(reason){
    if (this.framerate && this.width && this.height){
      var newFramerate = this.framerate
      if (this.framerate > this.goalFramerate){
        newFramerate = this.goalFramerate
      }else{
        var newHeight = this.height
        const minimumResolution = this.getAcceptorMinimumResolution()
        const resolutionQualityDowngradePercentage = (reason == GlanceVideoProfileManagerDowngradeReason.OFFERER_DEVICE || reason == GlanceVideoProfileManagerDowngradeReason.ACCEPTOR_DEVICE) ? this.qualityDeviceDowngradeResolutionInPercentage : this.qualityNetworkDowngradeResolutionInPercentage
        const framerateQualityDowngradePercentage = (reason == GlanceVideoProfileManagerDowngradeReason.OFFERER_DEVICE || reason == GlanceVideoProfileManagerDowngradeReason.ACCEPTOR_DEVICE) ? this.qualityDeviceDowngradeFramerateInPercentage : this.qualityNetworkDowngradeFramerateInPercentage
        if (
          (minimumResolution && (newHeight < (minimumResolution.height * (100.0/this.maximumResolutionDownscaleInPercentage))))
          || (newHeight <= this.minimumHeight)
          ){
          newFramerate = Math.floor(newFramerate*(1.0-(framerateQualityDowngradePercentage/100.0)))
        }else{
          newHeight = Math.floor(this.height*(1.0-(resolutionQualityDowngradePercentage/100.0)))
          newHeight = Math.floor(newHeight / 16) * 16
          if (newHeight < this.minimumHeight){
            newHeight = this.minimumHeight
          }
        }
        var newWidth = Math.floor(newHeight * (this.maximumWidth / this.maximumHeight))
        if (newFramerate < this.minimumFramerate){
          newFramerate = this.minimumFramerate
        }
      }
      this.updateProfile(newWidth, newHeight, newFramerate)
      GLANCE.Video.VideoDebug && console.log("Downgrade : " + newWidth + ", " + newHeight + ", " + newFramerate)
    }
  }

  getProfile(){
    if( this.mode == GlanceVideoProfileManagerMode.STATIC ){
      return this.getStaticProfile()
    } else if( this.mode == GlanceVideoProfileManagerMode.DYNAMIC ){
      return this.getDynamicProfile()
    }
  }

  // PRIVATE
  getStaticProfile(){
    const paramset = this.getCoderparamSet(this.descriptor, this.paramIndex)
    if (paramset && this.options && this.options.width && this.options.height){
      const framerate = paramset.framerate || 5
      const downsample = paramset.downsample || 1
      var width = this.options.width / downsample
      var height = this.options.height / downsample

      if ((width % 2) != 0) {
        width++;
      }

      if ((height % 2) != 0) {
        height++;
      }

      return {
        framerate: framerate, 
        width: width, 
        height: height, 
        bitsPerSecond: paramset.bitrate,
        paramIndex: this.paramIndex,
        pframes: paramset.pframes
      }
    }else if (this.options.width && this.options.height && this.bitspersecond){
      return {
        framerate: this.options.framerate, 
        width: this.options.width, 
        height: this.options.height, 
        bitsPerSecond: this.options.bitspersecond
      }
    }
    return undefined
  }

  // PRIVATE
  getDynamicProfile(){
    if (!this.hasAcceptors()){
      const h264BitsPerSecond = Math.floor(this.maximumFramerate*this.maximumWidth*this.maximumHeight*this.h264Constant)
      return {
        framerate: this.maximumFramerate, 
        width: this.maximumWidth, 
        height: this.maximumHeight, 
        bitsPerSecond: h264BitsPerSecond,
      }
    }
    if (this.framerate && this.width && this.height){
      const h264BitsPerSecond = Math.floor(this.framerate*this.width*this.height*this.h264Constant)
      return {
        framerate: this.framerate, 
        width: this.width, 
        height: this.height, 
        bitsPerSecond: h264BitsPerSecond
      }
    }
    return undefined
  }

  getRealFramerate(){
    return this.realFramerate
  }

  isMobileBlurring() {
    return (GLANCE.browserCapabilities.isAndroid || GLANCE.browserCapabilities.isSafariIOS) && this.bgBlurEnabled;
  }

  frame(frameIndex, framesPerInterval){
    if (this.paused){
      return false
    }
    this.keyframeInterval = framesPerInterval
    if (!this.frameTimestampsToSample){
      this.frameTimestampsToSample = framesPerInterval
    }
    let now
    if (window.performance){
      now = window.performance.now()
    }else{
      now = (new Date()).getTime()
    }
    if (frameIndex == 1){
      this.reset()
    }
    this.frameTimestamps.push(now)
    if (this.frameTimestamps.length > this.frameTimestampsToSample){
      this.frameTimestamps.shift()
    }
    if (this.frameTimestamps.length >= this.frameTimestampsToSample){
      let diff = this.frameTimestamps[this.frameTimestamps.length-1] - this.frameTimestamps[0]
      let avg = diff / this.frameTimestamps.length
      let fps = 1000.0 / avg
      const realFramerateUnset = !this.realFramerate
      const previousRealFramerate = this.realFramerate
      this.realFramerate = fps
      if(realFramerateUnset 
        || 
        (
          (frameIndex > this.frameTimestampsToSample) 
          && ((frameIndex % (this.frameTimestampsToSample)==0))
          && previousRealFramerate && (Math.abs(1.0-(previousRealFramerate/this.realFramerate)) > 0.01)
        )
          ){
        this.notifyListenerRealFramerate()
      }
      if (this.bgBlurEnabled){
        var currentFramerate = this.framerate
        if (this.mode == GlanceVideoProfileManagerMode.STATIC){
          const currentProfile = this.getProfile()
          if (currentProfile){
            currentFramerate = currentProfile.framerate
          }
        }
        let expectation = 1000.0 / currentFramerate
        if (avg > (1.1*expectation)){
          this.clearFrameTimestamps()
          this.offererEncodingFailure()
          this.performDowngrade()
          return true
        }
      }
    }
    if ((frameIndex % framesPerInterval) == 0){
      this.frameIndexWithinKeyframe = 1
      this.successfulKeyframeIntervals++;
      this.setRequiredStabilityIntervals()
      if ((this.successfulKeyframeIntervals > 0) 
        && ((this.successfulKeyframeIntervals % this.requiredStabilityIntervals) == 0)
        && (!this.isMobileBlurring() || currentFramerate <= 10 || this.width < 300)){
        this.upgrade()
      }
      if (this.shouldUpgrade){
        this.performUpgrade()
        return true
      }else if (this.shouldDowngrade) {
        this.performDowngrade()
        return true
      }
    }else{
      this.frameIndexWithinKeyframe++;
    }
    return false
  }

  // PRIVATE
  setRequiredStabilityIntervals(){
    if (this.keyframeInterval){
      let secondsPerInterval = this.keyframeInterval / this.framerate
      this.requiredStabilityInSeconds = Math.pow(2, this.stabilityLevel-1) * 10
      this.requiredStabilityIntervals = Math.ceil(this.requiredStabilityInSeconds / secondsPerInterval)
    }else{
      this.requiredStabilityIntervals = Math.pow(2, this.stabilityLevel)
    }
  }

  offererNetworkFailure(){
    this.log("Video profile manager: Couldn't offer stream because of network issues")
    this.offererNetworkFailureCount++
    if (this.offererNetworkFailureCount >= this.offererNetworkFailureRetries){
      this.downgrade(GlanceVideoProfileManagerDowngradeReason.OFFERER_NETWORK)
    }
  }

  offererEncodingFailure(){
    if (this.options.screenshare){
      return
    }
    this.log("Video profile manager: Couldn't offer stream because frames could not be encoded at framerate")
    this.downgrade(GlanceVideoProfileManagerDowngradeReason.OFFERER_DEVICE)
  }

  acceptorNetworkFailure(id){
    if (this.options.screenshare){
      return
    }
    this.log("Video profile manager: Acceptor player " + id + " couldn't render stream because of their network")
    this.downgrade(GlanceVideoProfileManagerDowngradeReason.ACCEPTOR_NETWORK)
  }

  acceptorRenderFailure(id){
    this.log("Video profile manager: Acceptor player " + id + " couldn't render stream because of their device")
    this.downgrade(GlanceVideoProfileManagerDowngradeReason.ACCEPTOR_DEVICE)
  }

  legacySlower(){
    if (this.options.screenshare){
      return
    }
    this.log("Video profile manager: Slower requested without stated reason by vserver or acceptor.")
    this.downgrade(GlanceVideoProfileManagerDowngradeReason.ACCEPTOR_NETWORK)
  }

  /**
   * given a current coder parameters index and an update, get the new index (supports Faster / Slower)
   * @param descriptor
   * @param current
   * @param update  something like 1 (faster) or -1 (slower)
   * @returns new valid index, within the available range.
   * todo: can be static
   */
  // PRIVATE
  getCoderparamsDelta( descriptor, current, update ) {
    let result = current
    if( descriptor && descriptor.coderparams ) {
      const coderparams = descriptor.coderparams
      let newIndex = (current || 0) + (update || 0)
      let found = false
      for( const key in coderparams ) {
        if( !coderparams.hasOwnProperty( key ) ) continue
        if( newIndex === Number( key ) ) {
          found = true
          break
        }
      }

      // if we couldn't find the newIndex and |updated| > 1, reduce update and try
      // again
      if (!found && Math.abs(update) > 1) {
        if (update > 1)
          --update
        else
          ++update
        return this.getCoderparamsDelta(descriptor, current, update)
      }
      result = found ? newIndex : current
    }
    return result
  }

  /**
   * Fetch a coder parameter set (framerate, bitrate, etc) by index.
   * @param descriptor
   * @param index
   * todo: can be static
   */
  // PRIVATE
  getCoderparamSet( descriptor, index ) {
    let result = {}
    if( descriptor && descriptor.coderparams ) {
      const i = ((index > 0 ? '+' : '') + index.toString())
      result = descriptor.coderparams[i]
    }
    return result
  }
}


// leaving this as a global for now since it might be useful outside of the GVS object class
GLANCE.Video.dynamicallyLoadScript = function( url ) {
  return new Promise( function( resolve, reject ) {
    let head = document.getElementsByTagName( 'head' )[0];
    let script = document.createElement( "script" );
    script.src = url;
    script.type = 'text/javascript'
    script.onload = resolve;
    script.onerror = () => reject( new Error( `Error when loading ${url}!` ) );
    head.appendChild( script );
  } );
}
GLANCE.Video.VideoSource = function ( options ) {
  return new GLANCE.Video.GlanceVideoSource(options)
}

// this is for backwards compatibility, there are many many places in CB that create a GLANCE.AgentVideo
GLANCE.AgentVideo = function (options) {
  return new GLANCE.Video.GlanceVideoSource(options)
}