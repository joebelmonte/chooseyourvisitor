// Copyright 2021 Glance Networks

'use strict'

/*jshint esversion: 11 */
/* globals
bodyPix: false,
GLANCE: true
*/
/*jshint -W030*/

// it is assumed that whoever has loaded this has defined GLANCE already
GLANCE.Video.drawTrackingData = false

GLANCE.Video.GlanceVideoBGEffects = class  {
  constructor(glanceVideoSource) {

    this.glanceVideoSource = glanceVideoSource

    // this is all stuff for the blurring scratch canvases and contexts
    this.renderedBuffer = null
    this.renderBufferWebGLCtx = null
    this.maskBuffer = null
    this.maskBuffer2dCtx = null
    this.detectionBuffer = null
    this.detectionBuffer2dCtx = null

    this.bgBlurEnabled = true
    this.bgEffectType = 'blur'    // may be 'blur', 'fill' or 'image'
    this.bgColor = '#2E9CDD'     // Glance blue, why not

    this.bgImageElement = null
    this.bgImageLoaded = false
    this.imageFillBitmap = null

    this.detectionMaxDimension = 256     // max dimension we want to pass to body pix. Other dimension will be made to match aspect ratio
    // this value was determined empirically for what seemed to be the minimum to work on i5 Surface Pro 3
    this.requestedRenderingAnimFrameHandler = 0  // for canceling requestAnimationFrame for renderer
    this.requestedDetectionAnimFrameHandler = 0  // for canceling requestAnimationFrame for detector

    this.mainVideoElement = null
    this.videoCaptureElement = null
    this.renderedStream = null

    this.videoCaptureStartTime = 0

    this.glanceVideoSourcebaseURL = null

    this.skipRendering = false

    this.useAudioTimerAnimation = false
    this.isAudioTimerAnimationSupported = true

    this.blurRadius = 8
    this.maskBlurRadius = 3
    this.maskThreshold = 0.4

    this.tfliteDetectorWidth = 256
    this.tfliteDetectorHeight = 144
    // Will be differend values for replacement and blurring
    // Defaults to blurring value
    this.maskWidth = 256
    this.maskHeight = 144
    this.bgEffectType = "blur";
    this.resizeMaskOnReplacement = true;
    // Doesn't help on Safari so keep things simpler and don't use it
    if (GLANCE.Video.GlanceVideoSource.getBrowser() === 'Safari') {
      this.isAudioTimerAnimationSupported = false
    }

    addEventListener('visibilitychange', this.onVisibilityChanged.bind(this));
  }

  // PUBLIC - broken out of constructor because async constructor not allowed
  async initialize() {
    this.runFilter = this.bgBlurEnabled && (this.bgEffectType ? true : false)
    this.simdPossible = GLANCE.Video.GlanceVideoSource.getBrowser() === 'Chrome'

    if (this.bgBlurEnabled){
      if( !GLANCE.Video.tfliteLoaded && !GLANCE.Video.tfliteLoading) {
        GLANCE.Video.tfliteLoading = true

        GLANCE.Video.tfliteWorkerBuffer = await this.fetch(this.glanceVideoSource.GVSbaseURL + "tflite/tflite-worker.js", "blob")

        // customer named in GD-18994 doesn't pass .bin files anymore, so if it fails try to read the .tflite version of the model
        // we keep selfie.bin because we know it works for everyone else
        try {
          GLANCE.Video.tfliteModelBuffer = await this.fetch( this.glanceVideoSource.GVSbaseURL + "tflite/selfie.bin" )
        }
        catch(err) {
          console.log('fetch() got selfie.bin reject, reading selfie.tflite')
          GLANCE.Video.tfliteModelBuffer = await this.fetch( this.glanceVideoSource.GVSbaseURL + "tflite/selfie.tflite" )
        }

        if (this.simdPossible) {
          GLANCE.Video.tfliteWasmBuffer = await this.fetch(this.glanceVideoSource.GVSbaseURL + "tflite/tflite-simd.wasm")
        }else{
          GLANCE.Video.tfliteWasmBuffer = await this.fetch(this.glanceVideoSource.GVSbaseURL + "tflite/tflite.wasm")
        }

        GLANCE.Video.tfliteLoaded = true
        GLANCE.Video.tfliteLoading = false
      }

      let workerUrl = URL.createObjectURL(GLANCE.Video.tfliteWorkerBuffer);
      this.worker = new Worker(workerUrl);
      URL.revokeObjectURL(workerUrl);
      this.worker.onmessage = this.onmessage.bind(this)
      if (this.simdPossible){
        this.worker.postMessage({action: "wasm-simd", buffer: GLANCE.Video.tfliteWasmBuffer, modelBuffer: GLANCE.Video.tfliteModelBuffer})
      }else{
        this.worker.postMessage({action: "wasm", buffer: GLANCE.Video.tfliteWasmBuffer, modelBuffer: GLANCE.Video.tfliteModelBuffer})
      }


      await this.waitForTfliteInitialization()

      this.makeDetectionBuffer()

      this.videoCaptureStartTime = performance.now()
    }

    /* uncomment to enable data.gui for tuning blurring. NOTE that it breaks when cobrowsed



GLANCE.Video.dynamicallyLoadScript('https://cdnjs.cloudflare.com/ajax/libs/dat-gui/0.7.7/dat.gui.min.js')
  .then(()=>{
    initDatGui(this)
})

  let datGui = null
  function initDatGui(that) {
    datGui = new dat.GUI( {width: 300})

    datGui.domElement.setAttribute( 'data-videopipeline', '1' )

    let guiObj = {
      maskBlurRadius: that.maskBlurRadius,
      maskThreshold: that.maskThreshold
    }

    datGui.add(guiObj, 'maskBlurRadius').min(0.0).max(20.0).step(1.0).onChange((newValue) => {
      that.maskBlurRadius = newValue
    });
    datGui.add(guiObj, 'maskThreshold').min(0.1).max(1.0).step(0.1).onChange((newValue) => {
      that.maskThreshold = newValue
      if(that.worker) {
        that.worker.postMessage( { action: "configure", threshold: that.maskThreshold } )
      }
    });
  }
*/
  }

  // return the offscreen video element used for full-size video capture
  get effectVideoCaptureElement() {
    return this.videoCaptureElement
  }

  // return the stream of the fully processed video
  get effectRenderedStream() {
    return this.renderedStream
  }

  // get the current background effects settings
  get bGEffectSettings() {
    return {
      capable: this.bgBlurEnabled,
      active: this.runFilter,
      type: this.bgEffectType
    }
  }

  // should we skip rendering because things are being restarted?
  set skipEffectRendering(skip) {
    this.skipRendering = skip
  }

  // PUBLIC
  // whether we should detect and render or not.
  setBgFilterActive(active) {
    this.runFilter = active && this.bgBlurEnabled

    // if turning off, reset stats for detection
    if (!this.runFilter) {
      this.detectAvg = 0
      this.detectCount = 0
    }
  }

  // load the image we need for background replacement
  // PRIVATE
  async loadBGImageURL(url) {
    // we'd better have a URL here...
    if ( url ) {
      if ( this.bgImageElement === null ) {
        this.bgImageElement = document.createElement( 'img' )
        this.bgImageElement.id = 'GVbgImageElement'
        this.bgImageElement.style.display = 'none'
        this.bgImageElement.setAttribute( 'data-videopipeline', '1' )
        this.bgImageElement.setAttribute( 'crossorigin', 'anonymous' )
        //          document.body.appendChild( this.bgImageElement )
      }
      this.bgImageElement.onload = () => this.bgImageLoaded = true;
      this.bgImageElement.onerror = () => {
        this.bgImageLoaded = false;
        console.error('Unable to load bg image at URL - ' + url)
      }
      this.bgImageElement.src = url
      this.imageFillBitmap = null

    }
    else {
      console.error('cannot do background image fill without URL')
      // lets convert to fill with glance blue
      this.bgEffectType = 'fill'

    }
  }


  // set background settings that were previously available only in constructor.
  // this is primarily meant for dev at this time
  async setBackgroundSettings(effectType, color, url) {
    this.bgEffectType = effectType;
    if (effectType === 'image') {
      this.maskThreshold = 0.7
      this.maskBlurRadius = this.calculateMaskBlurRadius();
      await this.loadBGImageURL(url)
    } else if (effectType === 'fill') {
      this.maskThreshold = 0.6
      this.maskBlurRadius = 3
      this.bgColor = color
    } else if (effectType === 'blur') {
      this.maskThreshold = 0.4
      this.maskBlurRadius = 3
      this.blurRadius = 8
    }
    this.bgEffectType = effectType
    if(this.worker){
      this.worker.postMessage({action: "configure", threshold: this.maskThreshold})
    }

    if(GLANCE.browserCapabilities.isAndroid || GLANCE.browserCapabilities.isSafariIOS) {
      this.detectionThrottleLimit = 10;
      this.detectionThrottlePerformanceFailureFrameThreshold = 10;
    }
  }

  // mask blur radius should depend on image resolution to give best view
  calculateMaskBlurRadius() {
    let radius = 3;
    if (this.renderedBuffer && this.renderedBuffer.height){
      radius = 1 + Math.ceil(this.renderedBuffer.height / 360.0)
      if(this.renderedBuffer.height >= 720) {
        radius = 5;
      }
    }
    return radius;
  }

  // reset the sizes of any canvases, FBOs, textures etc that are part of the active pipeline
  // PUBLIC
  resetPipelineSize( constraintWidth, constraintHeight, streamWidth, streamHeight, isOrientationPortrait ) {

    //todo: make this a setter in GlanceVideoSource
    this.glanceVideoSource.orientationMustReset = false

    if( this.bgBlurEnabled && this.renderedBuffer) {
      const oldWidth = this.renderedBuffer.width
      const oldHeight = this.renderedBuffer.height

      let newWidth
      let newHeight

      // see if we are in portrait
      if (isOrientationPortrait) {
        newWidth = constraintHeight
        newHeight = constraintWidth
      }
      else {
        newWidth = constraintWidth
        newHeight = constraintHeight
      }

      if (newWidth!=oldWidth || newHeight!=oldHeight){
        this.renderedBuffer.width = newWidth
        this.renderedBuffer.height = newHeight
        // Adjust mask blur radius according to image res
        this.maskBlurRadius = this.calculateMaskBlurRadius();
        // GD-19189 Improve Background Replacement
        if(this.bgEffectType != "blur") {
          this.maskWidth = this.renderedBuffer.width;
          this.maskHeight = this.renderedBuffer.height;
        }

        GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('resetting pipeline to ' + streamWidth + '/' + streamHeight))

        // these have already been corrected for orientation
        this.makeFilterFBOs( this.renderBufferWebGLCtx, this.renderedBuffer.width, this.renderedBuffer.height )

        // reset detection buffers to match camera aspect ratio
        let matchedSize = this.scaledMatchAspect( streamWidth, streamHeight, this.detectionMaxDimension )
        // this.detectionBuffer.width = matchedSize.width
        // this.detectionBuffer.height = matchedSize.height
        this.matchedSize = matchedSize

        this.makeMaskFBOs( this.renderBufferWebGLCtx, this.maskWidth, this.maskHeight )

        GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('resetting detection to ' + matchedSize.width + '/' + matchedSize.height))

        // cause the image fill cached bitmap to be recreated at new scale
        this.imageFillBitmap = null

        if( this.renderedStream ) {
          this.renderedStream = this.renderedBuffer.captureStream();
        }
      }
    }
  }

  // given incoming width and height, scale down to desired max resolution matching aspect ratio
  // can make this static
  // PRIVATE
  scaledMatchAspect( width, height, maxDimension ) {
    let aspectRatio = width / height
    let matchedWidth = 0
    let matchedHeight = 0
    if( aspectRatio >= 1 ) {
      matchedWidth = maxDimension
      matchedHeight = maxDimension / aspectRatio
    }
    else {
      matchedWidth = maxDimension * aspectRatio
      matchedHeight = maxDimension
    }
    if (matchedHeight > this.detectionBuffer.height){
      matchedHeight = this.detectionBuffer.height
      matchedWidth = aspectRatio * matchedHeight
    }
    return { width: parseInt(matchedWidth), height: parseInt(matchedHeight) }
  }

  // begin capturing the stream from the canvas we are rendering to
  // PUBLIC
  startRenderedStream( frameRate ) {
    GLANCE.Video.VideoDebug  && console.log( this.glanceVideoSource.videoLogFormatter('startRenderedStream  frameRate is now - ' + frameRate ))
    // note blurInitialized can only be true if instance.bgBlurEnabled == true
    if( this.blurInitialized && this.renderedBuffer ) {
      //      videoCaptureStartTime = performance.now()
      this.renderedStream = this.renderedBuffer.captureStream();
    }
  }

  // stop capturing the rendered stream. Stops playback of videoCaptureElement and
  // stops all streams we are capturing from the rendered canvas
  // PUBLIC
  StopRenderingStream() {
    // stop the rendering loop
    this.stopRendering()

    // stop videoCaptureElement if we have one
    if( this.videoCaptureElement && this.videoCaptureElement !== this.mainVideoElement ) {
      this.videoCaptureElement.srcObject = null;
    }

    if( this.renderedStream ) {
      this.renderedStream.getTracks().forEach( track => {
        track.stop()
      } )
    }
    this.renderedStream = null;
  }

  // begin playing the video stream into the video capture element
  // PUBLIC
  async startVideoCapture( stream, frameRate ) {
    if( this.videoCaptureElement && this.videoCaptureElement !== this.mainVideoElement ) {

      this.videoCaptureElement.setAttribute( 'autoplay', true )
      this.videoCaptureElement.setAttribute( 'playsinline', true )
      this.videoCaptureElement.setAttribute( 'muted', true )
      this.videoCaptureElement.srcObject = stream;
      GLANCE.Video.VideoDebug  && console.log( this.glanceVideoSource.videoLogFormatter('Starting videoCaptureElement play' ))
      this.videoCaptureElement.load()
      const p = this.videoCaptureElement.play()

      if( p && typeof p.then === 'function' ) {
        try {
          await p
          GLANCE.Video.VideoDebug  && console.log( this.glanceVideoSource.videoLogFormatter('VideoCaptureElement playing' ))
          this.startRenderedStream( frameRate )
        }
        catch ( ex ) {
          console.error( 'videoCaptureElement.play() failed - ' + ex );
        }
      }
      else {
        console.error( 'videoCaptureElement play failed: play function returned no Promise.' )
      }
    }
  }

  // utility function because there may be two places we do this.
  // the one in setupBGEffectElements should never be needed, but this gives us
  // some flexibility
  // PRIVATE
  makeDetectionBuffer() {
    this.detectionBuffer = document.createElement( 'canvas' )
    this.detectionBuffer.id = 'GVdetectionCanvasBuffer'
    //      this.detectionBuffer.style.display = 'none'
    this.detectionBuffer.setAttribute( 'data-videopipeline', '1' )
    //      parentDiv.appendChild(this.detectionBuffer)
    this.detectionBuffer2dCtx = this.detectionBuffer.getContext( '2d' )

    // getConstraints will update these with aspect ratio matching size
    this.detectionBuffer.width = this.tfliteDetectorWidth
    this.detectionBuffer.height = this.tfliteDetectorHeight


    this.resizeBuffer = document.createElement( 'canvas' )
    this.resizeBuffer.id = 'GVdetectionCanvasBufferResize'
    //      this.detectionBuffer.style.display = 'none'
    this.resizeBuffer.setAttribute( 'data-videopipeline', '1' )
    //      parentDiv.appendChild(this.detectionBuffer)
    this.resizeBuffer2dCtx = this.resizeBuffer.getContext( '2d' )

    // getConstraints will update these with aspect ratio matching size
    this.resizeBuffer.width = this.tfliteDetectorWidth
    this.resizeBuffer.height = this.tfliteDetectorHeight
  }

  // setup all of the elements we require for the video pipeline, which may or
  // may not include elements used just for the WebGL filter programs
  // instance.bgBlurEnabled determines whether person detection/image filtering is
  // enabled at startup
  // PUBLIC
  setupBGEffectElements( element ) {
    // is this just a restart?  And not null...
    if( element && element === this.mainVideoElement ) {
      return
    }

    // we are rebuilding
    this.blurInitialized = false

    // we will be redirecting the this.mainVideoElement to show the blurred stream in _startVideoElementPreview
    this.mainVideoElement = element

    let parentDiv

    // NOTE - if Debby's suggestion of not putting the pipeline elements into the document body works for
    // all browsers (it seems to for Chrome, FF and Safari TBD), then this can be removed
    if( element ) {
      parentDiv = element.closest( "div" )
      if( parentDiv == null ) {
        parentDiv = element.parentElement
      }
    }
    else {
      parentDiv = document.body
    }


    // if our canvases are undefined, create them
    // we do them one by one, though they really should all exist, or none
    // note that CB seems to call StartPreview more than once, and blows away the body, so checking for null objects
    // isn't enough since they seem to be orphaned (their parent is still a body, but no longer in the document)

    if( this.bgBlurEnabled ) {
      // make a special video element for capturing the camera stream
      //    this.videoCaptureElement = document.getElementById('GVvideoCaptureElement')
      if( this.videoCaptureElement == null ) {
        this.videoCaptureElement = document.createElement( 'video' )
        this.videoCaptureElement.id = 'GVvideoCaptureElement'
        this.videoCaptureElement.style.display = 'none'
        this.videoCaptureElement.setAttribute( 'data-videopipeline', '1' )
        //      parentDiv.appendChild( this.videoCaptureElement )
      }

      // the only way I can find to completely destroy the webGL context and clear running program etc as we reinitialize is
      // to delete the element and rebuild
      // remember, if we start with a NULL element, it exists at document root and survives glanceVideoSource deletion/reconstruction
      // Like everything else, WebGL is asynchronous and so we get errors as we reinitialize because the previous program
      // is still running for a while. deleteProgram() is not immediate.
      if( this.renderedBuffer == null || this.renderBufferWebGLCtx == null ) {

        // If video session is stopped (with agent header video button) and started again
        // we may still have the renderedBuffer canvas object in the body, but glanceVideoSource has been destroyed and
        // recreated so webglCtx is null
        // if we don't recreate the element, we seem to get a number of errors out of the webGL in process frame
        // that the uniforms are for a different program. We need to recreate the program anyway
        if( this.renderedBuffer !== null ) {
          this.renderedBuffer.remove()
          this.renderedBuffer = null
        }

        this.renderedBuffer = document.createElement( 'canvas' )
        this.renderedBuffer.id = 'GVrenderedBuffer'
        this.renderedBuffer.style.display = 'none'
        this.renderedBuffer.setAttribute( 'data-videopipeline', '1' )
        //      parentDiv.appendChild( this.renderedBuffer )

        // kill the blurred stream if the this.renderedBuffer canvas is unloaded - the stream
        // appears to persist and is active (at least for a while) after the buffer itself has been replaced
        this.renderedBuffer.addEventListener( 'unload', ( event ) => {
          if( renderedStream ) {
            renderedStream.getTracks().forEach( track => {
              track.stop()
            } )
          }
          this.glanceVideoSource.renderedStream = null;
        } )

        // initialize to some arbitrary size so captureStream will get something
        this.renderedBuffer.width = this.tfliteDetectorWidth
        this.renderedBuffer.height = this.tfliteDetectorHeight

        this.renderBufferWebGLCtx = this.renderedBuffer.getContext( 'webgl' )

        if (this.renderBufferWebGLCtx == null){
          throw {error: "WEBGL_CONTEXT_FAILED", message: "Couldn't create WebGL context. A browser restart may be neccessary."}
        }

        this.initializeBlurPrograms()

        this.renderBufferWebGLCtx.enable( this.renderBufferWebGLCtx.CULL_FACE )
      }

      // the buffer into which is copied the video for input to bodyPix
      //    this.detectionBuffer = document.getElementById('GVdetectionCanvasBuffer');
      if( this.detectionBuffer == null ) {
        this.makeDetectionBuffer()
      }
      if( !this.detectionBuffer2dCtx )
        this.detectionBuffer2dCtx = this.detectionBuffer.getContext( '2d' )

      this.blurInitialized = true
    }
  }

  /**
   * TFLite
   */
  onmessage(e){
    const { data } = e
    if (data.action == "loaded"){
      this.tfLiteInitialized = true
      return;
    }
    if (data.action == "simd-failed"){
      this.fetch(this.glanceVideoSource.GVSbaseURL + "tflite/tflite.wasm").then( (wasmBuffer) => {
        this.worker.postMessage({action: "wasm", buffer: wasmBuffer, modelBuffer: this.modelBuffer})
      })

      return;
    }
    if (data.action == "mask"){
      var mask = new ImageData(
        new Uint8ClampedArray( data.pixels ),
        data.width,
        data.height
      );

      if (this.matchedSize.width < this.detectionBuffer.width || this.matchedSize.height < this.detectionBuffer.height){
        // GD-19359 One way video show offset mask with bg replacement on
        this.resizeMaskOnReplacement = false;
        this.resizeBuffer2dCtx.putImageData(mask, 0, 0)
        mask = this.resizeBuffer2dCtx.getImageData(
          (this.detectionBuffer.width-this.matchedSize.width) / 2,
          (this.detectionBuffer.height-this.matchedSize.height),
          this.matchedSize.width,
          this.matchedSize.height
        );
      }

      this.segmentMask = mask
      this.newMask = this.segmentMask !== null
      this.inDetect = false
      if ( this.newMask ) {
        this.detectCount++;

        let endTime = performance.now();

        this.detectAvg = this.detectAvg + (endTime - this.detectionStartTime - this.detectAvg) / Math.min(this.detectCount, 10);

        if ( this.detectCount === 1 ) {
          GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('Time to first detection - ' + (Math.trunc((endTime - this.videoCaptureStartTime)*100)/100).toString() + 'ms'))
          GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('First segmentPerson took - ' + (Math.trunc((endTime - this.detectionStartTime)*100)/100).toString() + 'ms'))
        }
      }
      return;
    }
  }

  // PRIVATE
  waitForTfliteInitialization(){
    return new Promise((resolve, reject) => {
      if (this.tfLiteInitialized){
        resolve();
        return;
      }
      setTimeout(() => {
        this.checkTfliteInitialization(resolve, reject);
      }, 10);
    });
  }

  // PRIVATE
  checkTfliteInitialization(resolve, reject){
    if (this.tfLiteInitialized){
      resolve();
    }else{
      setTimeout(() => {
        this.checkTfliteInitialization(resolve, reject);
      }, 10);
    }
  }

  // PRIVATE
  async fetch(url, responseType){
    return new Promise((resolve, reject) => {
      var oReq = new XMLHttpRequest();
      oReq.open("GET", url, true);
      if (responseType){
        oReq.responseType = "blob";
      }else{
        oReq.responseType = "arraybuffer";
      }

      oReq.onerror = function (oEvent) {
        console.warn('fetch URL' + url + ' onerror called' )
        reject()
      }

      oReq.onload = function (oEvent) {
        var arrayBuffer = oReq.response;
        if (oReq.status === 200 && arrayBuffer) {
          resolve(arrayBuffer)
        }else{
          reject()
        }
      };

      oReq.send(null);
    });
  }


  // these fields are mainly for the webgl programs
  blurInitialized = false

  maskedBlurShaderProg = null
  maskBlurShaderProg = null

  maskedColorFillShaderProg = null
  maskedImageFillShaderProg = null

  // for debug
  copyShaderProg = null

  maskTexture = null
  cameraTexture = null
  imageFillTexture = null

  maskFBOs = []
  activeMaskFBO = 0

  filterFBOs = []
  activeFilterFBO = 0

  // these are used by all shaders
  shaderVertexArray = new Float32Array( [
    -1.0, -1.0,
    1.0, -1.0,
    -1.0,  1.0,
    -1.0,  1.0,
    1.0, -1.0,
    1.0, 1.0] )

  ShaderTextureCoordsArray = new Float32Array( [
    0.0,  0.0,
    1.0,  0.0,
    0.0,  1.0,
    0.0,  1.0,
    1.0,  0.0,
    1.0,  1.0
  ] )

  // NOTE - this is flipped on the U axis to make camera texture work
  YAxisMirroredShaderTextureCoordsArray = new Float32Array( [
    0.0, 1.0,
    1.0, 1.0,
    0.0, 0.0,
    0.0, 0.0,
    1.0, 1.0,
    1.0, 0.0
  ] )

  // this initializes the webGL programs (shaders) for masking and blurring
  // PRIVATE
  initializeBlurPrograms() {

    // these all share the same vertexShader
    let vertexShader = this.createShader( this.renderBufferWebGLCtx, this.renderBufferWebGLCtx.VERTEX_SHADER, this.vertexShaderSource )
    let fragmentShader = this.createShader( this.renderBufferWebGLCtx, this.renderBufferWebGLCtx.FRAGMENT_SHADER, this.MaskedBoxBlurVariableRadiusFragmentShaderSource/*MaskedBoxBlurFragmentShaderSource*/ )
    this.maskedBlurShaderProg = this.createProgram( this.renderBufferWebGLCtx, vertexShader, fragmentShader )

    fragmentShader = this.createShader( this.renderBufferWebGLCtx, this.renderBufferWebGLCtx.FRAGMENT_SHADER, this.MaskBoxBlurFragmentShaderSource )
    this.maskBlurShaderProg = this.createProgram( this.renderBufferWebGLCtx, vertexShader, fragmentShader )

    fragmentShader = this.createShader( this.renderBufferWebGLCtx, this.renderBufferWebGLCtx.FRAGMENT_SHADER, this.MaskedColorFillFragmentShaderSource )
    this.maskedColorFillShaderProg = this.createProgram( this.renderBufferWebGLCtx, vertexShader, fragmentShader )

    fragmentShader = this.createShader( this.renderBufferWebGLCtx, this.renderBufferWebGLCtx.FRAGMENT_SHADER, this.MaskedImageFillFragmentShaderSource )
    this.maskedImageFillShaderProg = this.createProgram( this.renderBufferWebGLCtx, vertexShader, fragmentShader )

    fragmentShader = this.createShader( this.renderBufferWebGLCtx, this.renderBufferWebGLCtx.FRAGMENT_SHADER, this.copyFragmentShaderSource )
    this.copyShaderProg = this.createProgram( this.renderBufferWebGLCtx, vertexShader, fragmentShader )

    this.maskTexture = this.renderBufferWebGLCtx.createTexture()
    this.cameraTexture = this.renderBufferWebGLCtx.createTexture()
    this.imageFillTexture = this.renderBufferWebGLCtx.createTexture()
  }

  // switch the shader programs and do all the buffer and uniform binding
  // PRIVATE
  switchShaderProgram( program, inputTexture, maskTexture) {
    this.renderBufferWebGLCtx.useProgram( program )

    let positionAttributeLocation = this.renderBufferWebGLCtx.getAttribLocation( program, "a_position" )

    // also from https://www.html5rocks.com/en/tutorials/webgl/webgl_fundamentals/
    // Create a buffer and put a single clipspace rectangle in
    // it (2 triangles)
    let buffer = this.renderBufferWebGLCtx.createBuffer()
    this.renderBufferWebGLCtx.bindBuffer( this.renderBufferWebGLCtx.ARRAY_BUFFER, buffer );
    this.renderBufferWebGLCtx.bufferData(
      this.renderBufferWebGLCtx.ARRAY_BUFFER,
      this.shaderVertexArray,
      this.renderBufferWebGLCtx.STATIC_DRAW )
    this.renderBufferWebGLCtx.enableVertexAttribArray( positionAttributeLocation )
    this.renderBufferWebGLCtx.vertexAttribPointer( positionAttributeLocation, 2, this.renderBufferWebGLCtx.FLOAT, false, 0, 0 )

    if ( inputTexture ) {
      let textureSizeLocation = this.renderBufferWebGLCtx.getUniformLocation( program, "u_textureSize" )
      let textureLocation = this.renderBufferWebGLCtx.getUniformLocation( program, "u_image" )
      // set the size of the image
      this.renderBufferWebGLCtx.uniform2f(textureSizeLocation, this.videoCaptureElement.videoWidth, this.videoCaptureElement.videoHeight)
      this.renderBufferWebGLCtx.uniform1i( textureLocation, 0 )     // texture unit 0
    }

    if ( maskTexture ) {
      let maskSizeLocation = this.renderBufferWebGLCtx.getUniformLocation( program, "u_maskSize" )
      this.renderBufferWebGLCtx.uniform2f( maskSizeLocation, this.maskWidth, this.maskHeight )

      let maskLocation = this.renderBufferWebGLCtx.getUniformLocation( program, "u_mask" )

      // texture unit 1
      this.renderBufferWebGLCtx.uniform1i( maskLocation, 1 )
    }
  }

  //  compile shader
  // PRIVATE
  createShader(gl, type, source) {
    let shader = gl.createShader(type)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS)
    if (success) {
      return shader
    }

    GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter(gl.getShaderInfoLog(shader)))
    gl.deleteShader(shader)
  }

  // NOTE we have to keep this WebGL1 because of broken Safari - no WebGL2 support
  vertexShaderSource =
    `    // an attribute will receive data from a buffer
    attribute vec4 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;

void main() {
    // gl_Position is a special variable a vertex shader
    // is responsible for setting
    gl_Position = a_position;
    
    // pass the texCoord to the fragment shader
    // The GPU will interpolate this value between points
    v_texCoord = a_texCoord;
}
`

  // this is a pass for a Masked separable box filter. should be rendered to intermediate buffer
  // This version blends the masked area and unmasked area using an alpha blend.
  // the pass is passed in the u_isHorizontalPass uniform, and it sets up the vector for step
  MaskedBoxBlurFragmentShaderSource =
    `
    precision mediump float;
    // our input texture, which is camera source
    uniform sampler2D u_image;
    uniform vec2 u_textureSize;
    
    // the blur mask
    uniform sampler2D u_mask;
    uniform vec2 u_maskSize;
    
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;
 
    // horizontal pass?
    uniform bool u_isHorizontalPass;
    
    // do we want to show mask for debug?
    uniform bool u_showMask;
      
void main() {
   // compute 1 pixel in texture coordinates accounting for whether we are stepping horizontally or vertically
   float hStep = 0.;
   float vStep = 1.;
   if (u_isHorizontalPass)
   {
      hStep = 1.0;
      vStep = 0.;
   }
   vec2 onePixel = vec2(hStep, vStep) / u_textureSize;
   
   // can't find a way to pass this value in since loops are unrolled at compile time and we're stuck on WebGL 1 (Apple)
   const int halfOrder = 10;
   const int order = 2 * halfOrder + 1;
   
   const float kernelWeight = float(order);    
   const float kernel = 1.0 / kernelWeight; 

   // if mask is zeroed, blur the color
   // note mask is pre-blurred/filtered
    vec4 maskColor = texture2D(u_mask, v_texCoord);
    vec4 imageColor = texture2D(u_image, v_texCoord);
    
    float maskAlpha = maskColor.w;
    
   // if mask alpha is nearly 1.0, we don't blur, just use source color. This is the area inside the mask
    if (maskAlpha >= 0.95)
    {
       gl_FragColor = imageColor;
   }
   else 
    {

        vec4 colorSum = vec4(0.,0.,0.,0.);

        colorSum = texture2D(u_image, v_texCoord) * kernel;
        float fStep = 0.;

        for (int step = 1; step <= halfOrder; step++) 
        {
            fStep = float(step);
            colorSum += texture2D(u_image, v_texCoord + onePixel * -fStep) * kernel;
            colorSum += texture2D(u_image, v_texCoord + onePixel * fStep) * kernel;
        }
       
       // if alpha of mask is not 0.0 blend blurred and unblurred pixels
       if (maskAlpha >= 0.05)
            {
            vec4 unblurred = vec4((imageColor * maskAlpha).rgb, maskAlpha);
            gl_FragColor = vec4((colorSum * (1.0 - maskAlpha)).rgb, 1.0 - maskAlpha) + unblurred;

            }
       else
       {
            gl_FragColor = vec4((colorSum).rgb, 1.0);
        }  

   }
   
   // for debugging
   if (u_showMask) 
    {
      gl_FragColor.b = maskAlpha;
   }
}
`

  // this is a pass for a Masked separable box filter. should be rendered to intermediate buffer
  // This variation uses a variable blur radius based on the mask alpha
  // the pass is passed in the u_isHorizontalPass uniform, and it sets up the vector for step
  MaskedBoxBlurVariableRadiusFragmentShaderSource =
    `
    precision mediump float;
    // our input texture, which is camera source
    uniform sampler2D u_image;
    uniform vec2 u_textureSize;
    
    // the blur mask
    uniform sampler2D u_mask;
    uniform vec2 u_maskSize;
    
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;
    
    // horizontal pass?
    uniform bool u_isHorizontalPass;
    
    // do we want to show mask for debug?
    uniform bool u_showMask;
    
    // this is the amount < halforder that we will actually use for shader radius
    uniform float u_blurRadius;

void main() {
   // compute 1 pixel in texture coordinates accounting for whether we are stepping horizontally or vertically
   float hStep = 0.;
   float vStep = 1.;
   if (u_isHorizontalPass)
   {
      hStep = 1.0;
      vStep = 0.;
   }
   vec2 onePixel = vec2(hStep, vStep) / u_textureSize;
   
   // loops are unrolled at shader compile time, so this is the maximum 
   // possible shader radius
   const int halfOrder = 30;

   // if mask is zeroed, blur the color
   // note mask is pre-blurred/filtered
    vec4 maskColor = texture2D(u_mask, v_texCoord);
    vec4 imageColor = texture2D(u_image, v_texCoord);

    float maskAlpha = maskColor.w;
       
   // if mask alpha is nearly 1.0, we don't blur, just use source color. This is the area inside the mask
    if (maskAlpha >= 0.95)
    {
       gl_FragColor = imageColor;
    }
    else 
    {
        vec4 colorSum = vec4(0.,0.,0.,0.);

        float fStep = 0.;
        
        int radius = int(((1.0 - maskAlpha) * u_blurRadius)+0.5);
        float order = 2. * float(radius) + 1.;
 
        float kernel = 1.0 / order; 
        colorSum = texture2D(u_image, v_texCoord) * kernel;
        // to make this variable weight I'll have to have an unrolled loop here of max half order I'll
        // ever use, and skip the terms that are outside the range
        for (int step = 1; step <= halfOrder; step++) 
       {
          // because we are stuck using webGL1 this loop has been unrolled
          // we need to skip the steps we don't want to take 
          if (step <= radius) 
          {
            fStep = float(step);
            colorSum += texture2D(u_image, v_texCoord + onePixel * -fStep) * kernel;
            colorSum += texture2D(u_image, v_texCoord + onePixel * fStep) * kernel;
          }
          else 
          {
              break;
          }

        }
  
        gl_FragColor = vec4((colorSum).rgb, 1.0);
       }

   // for debugging
   if (u_showMask) 
   {
      gl_FragColor.b = maskAlpha;
   }
}
`

  // shader for blurring the mask. One pass of separable box filter
  // the pass is passed in the u_isHorizontalPass uniform, and it sets up the vector for step
  MaskBoxBlurFragmentShaderSource =
    `
    precision mediump float;
    
    // the blur mask
    uniform sampler2D u_mask;
    uniform vec2 u_maskSize;
    
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

    // horizontal pass?
    uniform bool u_isHorizontalPass;
    
        
    // this is the amount < halforder that we will actually use for shader radius
    uniform float u_maskBlurRadius;


void main() {
   // compute 1 pixel in texture coordinates accounting for whether we are stepping horizontally or vertically
   float hStep = 0.;
   float vStep = 1.;
   if (u_isHorizontalPass)
   {
      hStep = 1.0;
      vStep = 0.;
  }
   vec2 onePixel = vec2(hStep, vStep) / u_maskSize;

   const int halfOrder = 20;
   int radius = int((u_maskBlurRadius)+0.5);
   float order = 2. * float(radius) + 1.;
  
   float kernel = 1.0 / order; 
 
    vec4 colorSum = texture2D(u_mask, v_texCoord) * kernel;
    float fStep = 0.;

    for (int step = 1; step <= halfOrder; step++) 
    {
        // because we are stuck using webGL1 this loop has been unrolled
        // we need to skip the steps we don't want to take 
        if (step <= radius) 
        {
          fStep = float(step);
          colorSum += texture2D(u_mask, v_texCoord + onePixel * -fStep) * kernel;
          colorSum += texture2D(u_mask, v_texCoord + onePixel * fStep) * kernel;
        }
        else 
        {
            break;
        }
    }

    gl_FragColor = colorSum;
}
`

  // masked solid color fill
  MaskedColorFillFragmentShaderSource =
    `
    precision mediump float;
    // our input texture, which is camera source
    uniform sampler2D u_image;
    uniform vec2 u_textureSize;
    
    // the detection mask
    uniform sampler2D u_mask;
    
    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;
 
    // fill color
    uniform vec4 u_fillColor;
    
    // do we want to show mask for debug?
    uniform bool u_showMask;

void main() {

   // if mask is zeroed, use the fill color
   // note mask is pre-blurred/filtered
    vec4 maskColor = texture2D(u_mask, v_texCoord);
    vec4 imageColor = texture2D(u_image, v_texCoord);
    
    float maskAlpha = maskColor.w;

    gl_FragColor = u_fillColor * (1.0-maskAlpha) + imageColor * maskAlpha;
   
   // for debugging
   if (u_showMask) 
   {
      gl_FragColor.b = maskAlpha;
   }
}
`

  // masked image fill
  // image is in texture 3
  MaskedImageFillFragmentShaderSource =
    `
  precision mediump float;
  // our input texture, which is camera source
  uniform sampler2D u_image;
  uniform vec2 u_textureSize;
  
  // the detection mask
  uniform sampler2D u_mask;
  
  // the replacement image 
  uniform sampler2D u_fillImage;
  
  // the texCoords passed in from the vertex shader.
  varying vec2 v_texCoord;
  
  // do we want to show mask for debug?
  uniform bool u_showMask;

  void main() {

     // if mask is zeroed, use the fill color
     // note mask is pre-blurred/filtered
      vec4 maskColor = texture2D(u_mask, v_texCoord);
      vec4 imageColor = texture2D(u_image, v_texCoord);
      vec4 fillImageColor = texture2D(u_fillImage, v_texCoord);
      
      float maskAlpha = maskColor.w;
  
      gl_FragColor = fillImageColor * (1.0-maskAlpha) + imageColor * maskAlpha;
     
     // for debugging
     if (u_showMask) 
     {
        gl_FragColor.b = maskAlpha;
     }
  }
`

  // this is a simple copy-only shader for when filter is turned off but BG effects are enabled
  copyFragmentShaderSource =
    `// fragment shaders don't have a default precision so we need
    // to pick one. mediump is a good default
    precision mediump float;
    // our texture
    uniform sampler2D u_image;

    // the texCoords passed in from the vertex shader.
    varying vec2 v_texCoord;

void main() {

    // just copy in to out
    vec4 imageColor = texture2D(u_image, v_texCoord);

    gl_FragColor = imageColor;
}
`

  // put the shaders together into a WebGL program
  // PRIVATE
  createProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    let success = gl.getProgramParameter(program, gl.LINK_STATUS)
    if (success) {
      return program
    }

    GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter(gl.getProgramInfoLog(program)))
    gl.deleteProgram(program)
  }

  // set textures, buffers and uniforms for one filter pass
  // PRIVATE
  setupFilterPass( gl, program, inputTexture, maskTexture, isHorizPass, mirrorY) {
    if (isHorizPass !== null ) {
      let horizPassLocation = gl.getUniformLocation( program, "u_isHorizontalPass" )
      gl.uniform1i(horizPassLocation, isHorizPass);
    }

    let showMaskLocation = gl.getUniformLocation( program, "u_showMask" )
    gl.uniform1i(showMaskLocation, GLANCE.Video.drawTrackingData);

    let blurRadiusLocation = gl.getUniformLocation( program, "u_blurRadius")
    gl.uniform1f(blurRadiusLocation, this.blurRadius)

    let maskBlurRadiusLocation = gl.getUniformLocation( program, "u_maskBlurRadius")
    gl.uniform1f(maskBlurRadiusLocation, this.maskBlurRadius)

    // look up where the texture coordinates need to go.
    let texCoordLocation = gl.getAttribLocation(program, "a_texCoord")

    // provide texture coordinates for the rectangle.
    let texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    if (mirrorY) {
      gl.bufferData(gl.ARRAY_BUFFER, this.YAxisMirroredShaderTextureCoordsArray, gl.STATIC_DRAW)
    }
    else {
      gl.bufferData(gl.ARRAY_BUFFER, this.ShaderTextureCoordsArray, gl.STATIC_DRAW)
    }
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

    if (inputTexture) {
      // bind textures to texture units - video to 0, mask to 1
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, inputTexture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    }

    if (maskTexture) {
      // bind the mask texture
      gl.activeTexture( gl.TEXTURE1 )
      gl.bindTexture( gl.TEXTURE_2D, maskTexture )
      gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
      gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )
      gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST )
      gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST )
    }

  }

  // make a framebuffer of the requested size with the textures configured as we need
  // PRIVATE
  makeFramebuffer( gl, width, height ){
    let texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    let framebuffer = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    framebuffer.texture = texture       //  stash this away so we can easily get it later

    // clear the FBO to something
    gl.clearColor(0., 0., 0, 0.)
    gl.clear(this.renderBufferWebGLCtx.COLOR_BUFFER_BIT)

    // clean up
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)

    return framebuffer
  }

  // create frame buffer objects for mask rendering
  // PRIVATE
  makeMaskFBOs( gl, width, height) {
    this.maskFBOs[0] = this.makeFramebuffer(gl, width, height)
    this.maskFBOs[1] = this.makeFramebuffer(gl, width, height)
  }

  // create frame buffer objects for image processing
  // PRIVATE
  makeFilterFBOs( gl, width, height ) {
    this.filterFBOs[0] = this.makeFramebuffer(gl, width, height)
    this.filterFBOs[1] = this.makeFramebuffer(gl, width, height)
  }

  // these fields mainly are for the rendering process
  frameTimeReport = null

  runFilter = false

  segmentation = null
  segmentMask = null
  newMask = false

  msPerFrame = 0
  lastRenderFrameTime = 0
  lastDetectFrameTime = 0

  // these are for metrics
  detectAvg = 0
  detectCount = 0

  filterAvg = 0
  filterCount = 0

  renderFrameRate = 0
  requestedFrameRate = 0

  inDetect = false
  detectionThrottleLimit = 20
  detectionThrottleFrameLimit = 15
  detectionThrottleFactor = this.detectionThrottleLimit
  detectTimeLimit = 500
  detectionThrottleAvg = this.detectionThrottleFactor
  detectionThrottleMin = 255
  detectionThrottleMax = 0
  detectionThrottleLowerLimit = 1
  detectionThrottlePerformanceFailureReported = false
  detectionThrottlePerformanceFailureFrameThreshold = 20
  detectionThrottlePerformanceFailureFrameCount = 0

  frameAvg = 0
  frameCount = 0
  frameStartTime = performance.now()

  audioContext = null
  runAudioLoop = true

  // this can be called anytime we get a new MR, we need to get called for framerate updates
  // PUBLIC
  startupRendering( framerate ) {
    if (!this.blurInitialized)
      return

    GLANCE.Video.VideoDebug  && console.log( this.glanceVideoSource.videoLogFormatter('startupRendering with framerate - ' + framerate ))

    this.requestedFrameRate = framerate

    this.msPerFrame = 1000 / framerate;
    this.lastRenderFrameTime = performance.now()
    this.lastDetectFrameTime = performance.now()

    // note that though both renderLoop and detectionLoop are called each time,
    // internally they may or may not do anything on a particular call since
    // they have their own timing
    const doRenders = async () => {
      await this.renderLoop()
      await this.detectionLoop()
    }

    if (!this.useAudioTimerAnimation) {
      // if we have a pending requestAnimationFrame we need to clear it, as calls do stack
      if( this.requestedRenderingAnimFrameHandler ) {
        GLANCE.Video.VideoDebug  && console.log( this.glanceVideoSource.videoLogFormatter('startupRendering canceling requestAnimationFrame' ))
        cancelAnimationFrame( this.requestedRenderingAnimFrameHandler )
        this.requestedRenderingAnimFrameHandler = null
      }

      if( this.requestedDetectionAnimFrameHandler ) {
        GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('startupRendering canceling requestedDetectionAnimFrameHandler' ))
        cancelAnimationFrame( this.requestedDetectionAnimFrameHandler )
        this.requestedDetectionAnimFrameHandler = null
      }
      doRenders(this)
    }
    else {
      this.audioTimerLoop(doRenders, 1000 / 60);
    }


    // startup reporting if not running
    if ( !this.frameTimeReport && GLANCE.Video.VideoDebug ) {
      this.frameTimeReport = window.setInterval(() => {
          console.log(this.glanceVideoSource.videoLogFormatter('Rendered Framerate - ' + this.renderFrameRate.toString() +
            ' DetectTime - ' + (Math.trunc(this.detectAvg*100)/100).toString() +
            'ms Filtertime - ' + (Math.trunc(this.filterAvg*100)/100).toString() + 'ms' +
            ' detectionThrottleMin/Max - ' + this.detectionThrottleMin / this.detectionThrottleLimit + '/' + this.detectionThrottleMax / this.detectionThrottleLimit +
            ' detectionThrottleFactor - '+ (Math.trunc((this.detectionThrottleAvg / this.detectionThrottleLimit)*100)/100).toString() ))
          // reset detect throttle min/max
          this.detectionThrottleMin = 255
          this.detectionThrottleMax = 0
        },
        10000)
    }
  }

  // stop the rendering/detection loops at session end
  // PRIVATE
  stopRendering() {
    if (!this.useAudioTimerAnimation) {
      if ( this.requestedRenderingAnimFrameHandler ) {
        GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('stopRendering canceling requestedRenderingAnimFrameHandler'))
        cancelAnimationFrame( this.requestedRenderingAnimFrameHandler )
        this.requestedRenderingAnimFrameHandler = null
      }

      if ( this.requestedDetectionAnimFrameHandler ) {
        GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('stopRendering canceling requestedDetectionAnimFrameHandler'))
        cancelAnimationFrame( this.requestedDetectionAnimFrameHandler )
        this.requestedDetectionAnimFrameHandler = null
      }
    }
    else {
      this.runAudioLoop = false
    }

    // stop the reporting if running
    if ( this.frameTimeReport ) {
      window.clearInterval( this.frameTimeReport )
      this.frameTimeReport = null
    }
  }

  // PRIVATE
  onVisibilityChanged(event){
    if (!this.isAudioTimerAnimationSupported){
      return
    }
    const doRenders = async () => {
      await this.renderLoop()
      await this.detectionLoop()
    }
    if( this.requestedRenderingAnimFrameHandler ) {
      GLANCE.Video.VideoDebug  && console.log( this.glanceVideoSource.videoLogFormatter('startupRendering canceling requestAnimationFrame' ))
      cancelAnimationFrame( this.requestedRenderingAnimFrameHandler )
      this.requestedRenderingAnimFrameHandler = null
    }

    if( this.requestedDetectionAnimFrameHandler ) {
      GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('startupRendering canceling requestedDetectionAnimFrameHandler' ))
      cancelAnimationFrame( this.requestedDetectionAnimFrameHandler )
      this.requestedDetectionAnimFrameHandler = null
    }
    if (document.hidden){
      this.useAudioTimerAnimation = true
      this.audioTimerLoop(doRenders, 1000 / 60);
    }else{
      this.useAudioTimerAnimation = false
      doRenders(this)
    }
  }

  /*
    An alternative timing loop, based on AudioContext's clock

    @arg callback : a callback function
        with the audioContext's currentTime passed as unique argument
    @arg frequency : float in ms;
    @returns : a stop function

    this is a mess - starting and stopping the loop requires some study of the oscillators
    etc. and there is no time. Just leave the loop running and skip the callback

*/
  // PRIVATE
  audioTimerLoop(callback, frequency) {

    // we only ever want one of these running
    // if (this.audioContext) {
    //   this.runAudioLoop = true
    //   return
    // }
    let freq = frequency / 1000;      // AudioContext time parameters are in seconds
    if (!this.audioContext){
      this.audioContext = new AudioContext();
      // Chrome needs our oscillator node to be attached to the destination
      // So we create a silent Gain Node
      this.silence = this.audioContext.createGain();
      this.silence.gain.value = 0;
      this.silence.connect(this.audioContext.destination);
    }

    const onOSCend = () => {
      if (!this.useAudioTimerAnimation){
        return
      }
      let osc = this.audioContext.createOscillator();
      osc.onended = onOSCend; // so we can loop
      osc.connect(this.silence);
      osc.start(0); // start it now
      osc.stop(this.audioContext.currentTime + freq); // stop it next frame
      if (this.runAudioLoop) {
        callback(this.audioContext.currentTime); // one frame is done
      }
    }

    onOSCend();

    this.runAudioLoop = true

  }

  // this is the main rendering loop used for image filtering. It is not used
  // if blurring is not enabled (instance.bgBlurEnabled==false)
  // it can use either the audio timer or requestAnimationFrame
  // PRIVATE
  async renderLoop( timestamp ) {


    // elapsed time since last loop
    let now = performance.now()
    let elapsed = now - this.lastRenderFrameTime;

    // if enough time has elapsed, draw the next frame
    if (elapsed >= this.msPerFrame) {

      // Get ready for next frame by setting then=now, but also adjust for your
      // specified fpsInterval not being a multiple of RAF's interval (16.7ms)
      this.lastRenderFrameTime = now - (elapsed % this.msPerFrame)

      // we might be reloading everything, don't try to use stale WebGL programs. this didn't actually help with that error,
      // but is still a good idea
      // NOTE blurInitialzed can only be true if instance.bgBlurEnabled == true
      if ( this.blurInitialized && !this.skipRendering ) {
        await this.processVideoFrame( now )
      }
    }

    if (!this.useAudioTimerAnimation) {
      this.requestedRenderingAnimFrameHandler = requestAnimationFrame(this.renderLoop.bind(this))
    }
  }

  // this is the main rendering loop used for image filtering. It is not used
  // if blurring is not enabled (instance.bgBlurEnabled==false)
  // PRIVATE
  async detectionLoop( timestamp ) {


    // elapsed time since last loop
    let now = performance.now()
    let elapsed = now - this.lastDetectFrameTime;

    let detectionMsPerFrame = this.msPerFrame / (this.detectionThrottleFactor / this.detectionThrottleLimit)

    // if enough time has elapsed, draw the next frame
    // use whether we are in detector to keep from having wild swings in detectionThrottle
    if (elapsed >= detectionMsPerFrame && !this.inDetect) {

      // We will turn down detection rate based on how much we are missing render framerate
      // the MR framerate is driven off of captureStream
      let prevDetectionThrottleFactor = this.detectionThrottleFactor

      let frameRateInUse = this.renderFrameRate

      // don't drive down to minimum because of fractional framerate difference
      // drive down if detection times are excessive
      if( this.detectAvg > this.detectTimeLimit || (this.requestedFrameRate - frameRateInUse) > (this.requestedFrameRate / 20) ) {
        if( this.detectionThrottleFactor > this.detectionThrottleLowerLimit ) {
          this.detectionThrottleFactor -= 1
        }
        else {
          // we've bottomed out, start counting down failed frames
          // only if detection and blurring is actually turned on
          this.detectionThrottlePerformanceFailureFrameCount++
          if (this.runFilter &&
            this.detectionThrottlePerformanceFailureFrameCount >= this.detectionThrottlePerformanceFailureFrameThreshold) {

            // if we have some headroom, throttle down the profile instead
            if (this.requestedFrameRate > this.detectionThrottleFrameLimit) {

              // reset performance failure count to give us a chance to settle
              this.detectionThrottlePerformanceFailureFrameCount = 0

              this.glanceVideoSource.stepDownPerformanceProfile()
              await this.glanceVideoSource.restartVideoStream( {} )
            }
            else {
              // report performance problems to CB
              if (!this.detectionThrottlePerformanceFailureReported) {
                GLANCE.Video.VideoDebug  && console.log(this.glanceVideoSource.videoLogFormatter('Firing event bgFilterPerformanceFail'))
                this.glanceVideoSource.fireEvent('bgFilterPerformanceFail')
                this.detectionThrottlePerformanceFailureReported = true
              }
            }
          }
        }
      }
      else if( this.detectionThrottleFactor < this.detectionThrottleLimit ) {
        this.detectionThrottleFactor += 1

        // reset performance failure counter if we step up at all
        this.detectionThrottlePerformanceFailureFrameCount = 0
      }

      this.detectionMsPerFrame = this.msPerFrame / (this.detectionThrottleFactor / this.detectionThrottleLimit)

      this.detectionThrottleMin = Math.min(this.detectionThrottleMin, this.detectionThrottleFactor)
      this.detectionThrottleMax = Math.max(this.detectionThrottleMax, this.detectionThrottleFactor)
      this.detectionThrottleAvg = this.detectionThrottleAvg + (this.detectionThrottleFactor - this.detectionThrottleAvg) / Math.min(this.detectCount ? this.detectCount : 1, 10);

      // Get ready for next frame by setting then=now, but also adjust for your
      // specified fpsInterval not being a multiple of RAF's interval (16.7ms)
      this.lastDetectFrameTime = now - (elapsed % detectionMsPerFrame)

      // we might be reloading everything, don't try to use stale WebGL programs. this didn't actually help with that error,
      // but is still a good idea
      // NOTE blurInitialzed can only be true if instance.bgBlurEnabled == true
      if ( this.blurInitialized && !this.skipRendering ) {
        await this.runDetector( now )
      }
    }

    if (!this.useAudioTimerAnimation) {
      this.requestedDetectionAnimFrameHandler = requestAnimationFrame(this.detectionLoop.bind(this))
    }
  }

  // utility function for initilization call and detection loop call
  // PRIVATE
  callDetect() {
    if (this.worker && this.detectionBuffer2dCtx){
      let width = this.detectionBuffer.width
      let height = this.detectionBuffer.height

      const pixels = this.detectionBuffer2dCtx.getImageData(
        0,
        0,
        width,
        height
      );

      this.lastImageData = pixels

      this.worker.postMessage( {
        action: "pixels",
        pixels: pixels.data.buffer,
        width: width,
        height: height,
        channels: 4
      }, [pixels.data.buffer] );
    }
  }

  //  Note that runDetector and processVideoFrame run asynchronously from each other as separate
  //  requestAnimationFrame callback
  //  runDetector will use the most recent videoCaptureElement and return an updated
  //  detection mask when one is available and set newMask = true
  //  processVideo Frame will use the last available mask for blurring
  // PRIVATE
  async runDetector( timestamp ) {
    if (this.videoCaptureElement.videoWidth > 0 && this.videoCaptureElement.videoHeight > 0 && this.runFilter ) {
      if(this.worker && !this.inDetect ) {
        this.inDetect = true
        this.detectionStartTime = performance.now()
        this.detectionBuffer2dCtx.drawImage( this.videoCaptureElement, 0, 0, this.videoCaptureElement.videoWidth, this.videoCaptureElement.videoHeight, (this.detectionBuffer.width - this.matchedSize.width) / 2, this.detectionBuffer.height - this.matchedSize.height, this.matchedSize.width, this.matchedSize.height )
        this.callDetect()
      }
    }
  }

  // This is the main image filtering loop. It runs asynchronously from runDetector
  // in runDetector. The most recent mask provided by runDetector is used by this for
  // image filtering and masking (after the mask itself has had any processing applied).
  // This function runs the WebGL shader programs set up above. We handle setting
  // up the required data and switching programs for the effects we want
  // PRIVATE
  async processVideoFrame( timestamp ) {
    if (this.videoCaptureElement.videoWidth <= 0 || this.videoCaptureElement.videoHeight <= 0) {
      return
    }

    this.frameCount++
    let endTime = timestamp ? timestamp : performance.now()
    this.frameAvg = this.frameAvg + (endTime - this.frameStartTime - this.frameAvg) / Math.min(this.frameCount, 10)
    this.renderFrameRate = (Math.trunc((1000 / this.frameAvg)*100)/100)
    //    frameTimeText.innerHTML = (Math.trunc((endTime - frameStartTime)*100)/100).toString();
    //    frameTimeAvgText.innerHTML = (Math.trunc(frameAvg*100)/100).toString();
    this.frameStartTime = endTime

    // don't run all this if we've never gotten a mask, we do not want to render an unfiltered frame
    if (this.runFilter && this.detectCount > 0) {
      this.filterCount++
      let startTime = performance.now()

      // we are given a mask
      if ( this.segmentMask && this.newMask ) {
        // GD-19189 Improve Background Replacement
        if(this.bgEffectType != "blur" && this.resizeMaskOnReplacement) {
          this.segmentMask = await this.resizeMask();
        }
        let activeMaskFBO = this.blurDetectedMask()

        // the filtered mask is in texture unit 1

        /*
                // FOR DEBUG get texture out and put it in maskBuffer
                let filteredMask = new Uint8Array(maskBuffer.width * maskBuffer.height * 4);
                this.renderBufferWebGLCtx.readPixels(0, 0, maskBuffer.width, maskBuffer.height, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, filteredMask);
                let imageData = maskBuffer2dCtx.createImageData(maskBuffer.width, maskBuffer.height);
                imageData.data.set(filteredMask);
                maskBuffer2dCtx.putImageData(imageData, 0, 0);
        */
        this.segmentMask = null;

        this.newMask = false
      }

      if (this.bgEffectType === 'blur') {
        this.blurBackground(this.activeMaskFBO)
      }
      else if (this.bgEffectType === 'fill') {
        await this.colorFillBackground(this.activeMaskFBO)
      } else if (this.bgEffectType === 'image') {
        // we better have already loaded the image
        await this.imageFillBackground(this.activeMaskFBO)
      }
      else {
        console.error('Invalid background effect type - ' + this.bgEffectType)
        // we shouldn't display anything, so just skip any further rendering
      }


      let endTime = performance.now();
      //     filterTimeText.innerHTML = (Math.trunc((endTime - startTime)*100)/100).toString();
      this.filterAvg = this.filterAvg + (endTime - startTime - this.filterAvg) / Math.min(this.filterCount, 10);
      //     filterTimeAvgText.innerHTML = (Math.trunc(this.filterAvg*100)/100).toString();

    }
    else {
      // if we skipped rendering because no mask yet, but we are using a filter, do not show an unrendered (blurred etc) frame
      if( !this.runFilter ) {
        // simple copy shader, since we are recording from rendered buffer we need to
        // just copy the camera buffer into it, have to use a shader because you can't
        // have a 2D and 3D context on same canvas
        this.switchShaderProgram( this.copyShaderProg, this.cameraTexture, null)
        this.setupFilterPass(this.renderBufferWebGLCtx, this.copyShaderProg, this.cameraTexture, null, null, true)

        // Upload the camera image into texture 0.
        this.renderBufferWebGLCtx.activeTexture(this.renderBufferWebGLCtx.TEXTURE0)
        this.renderBufferWebGLCtx.texImage2D(this.renderBufferWebGLCtx.TEXTURE_2D, 0, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, this.videoCaptureElement)

        this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, null)
        this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
        this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)
      }
    }
  }

  // blur the mask
  // the filtered mask is in maskFBOs[1].texture!
  // more particularly - it is in texture unit 1
  // return the FBO the mask is in for later adaptability
  // PRIVATE
  blurDetectedMask() {
    this.switchShaderProgram(this.maskBlurShaderProg, null, this.maskTexture, true )
    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskBlurShaderProg, null, this.maskTexture, true, true)

    // !!! For debug only
    //        maskBuffer2dCtx.putImageData( this.segmentMask, 0, 0 )

    // upload the mask into the texture
    this.renderBufferWebGLCtx.activeTexture(this.renderBufferWebGLCtx.TEXTURE1)
    this.renderBufferWebGLCtx.texImage2D(this.renderBufferWebGLCtx.TEXTURE_2D, 0, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, this.segmentMask)

    // render to mask FBO 0, src is texture unit 1
    this.activeMaskFBO = 0

    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, this.maskFBOs[this.activeMaskFBO])
    this.renderBufferWebGLCtx.viewport(0, 0, this.maskWidth, this.maskHeight);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

    //  V pass - render to FBO 1, src will be FBO 0 texture
    this.activeMaskFBO = 1
    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskBlurShaderProg, null, this.maskFBOs[0].texture, false, true)

    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, this.maskFBOs[this.activeMaskFBO])
    this.renderBufferWebGLCtx.viewport(0, 0, this.maskWidth, this.maskHeight);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

    return this.activeMaskFBO
  }

  async resizeMask() {
    if(typeof this.tempCanvas == "undefined") {
      this.tempCanvas = document.createElement("canvas");
      this.tempContext = this.tempCanvas.getContext("2d");
    }
    this.tempCanvas.width = this.renderedBuffer.width;
    this.tempCanvas.height = this.renderedBuffer.height;

    this.resizeBuffer2dCtx.putImageData(this.segmentMask, 0, 0);
    this.tempContext.drawImage(this.resizeBuffer, 0, 0, this.resizeBuffer.width, this.resizeBuffer.height, 0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    let mask = this.tempContext.getImageData(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    this.tempContext.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);

    return mask;
  }

  // blur the background
  // blurred mask is in maskFBO given by activeMaskFBO
  // PRIVATE
  blurBackground( maskFBO ){

    this.switchShaderProgram( this.maskedBlurShaderProg, this.cameraTexture, this.maskFBOs[maskFBO].texture)
    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskedBlurShaderProg, this.cameraTexture, this.maskFBOs[maskFBO].texture, true, false)

    // Upload the camera image into texture 0.
    this.renderBufferWebGLCtx.activeTexture(this.renderBufferWebGLCtx.TEXTURE0)
    this.renderBufferWebGLCtx.texImage2D(this.renderBufferWebGLCtx.TEXTURE_2D, 0, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, this.videoCaptureElement)

    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, this.filterFBOs[0])
    this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskedBlurShaderProg, this.filterFBOs[0].texture, this.maskFBOs[maskFBO].texture, false, false)
    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, this.filterFBOs[1])
    this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)
    /*
          setupFilterPass(this.renderBufferWebGLCtx, maskedBlurShaderProg, filterFBOs[1].texture, maskFBOs[maskFBO].texture, true, false)
          this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, filterFBOs[0])
          this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
          this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

          setupFilterPass(this.renderBufferWebGLCtx, maskedBlurShaderProg, filterFBOs[0].texture, maskFBOs[maskFBO].texture, false, false)
          this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, filterFBOs[1])
          this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
          this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)
    */
    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskedBlurShaderProg, this.filterFBOs[1].texture, this.maskFBOs[maskFBO].texture, true, false)
    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, this.filterFBOs[0])
    this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);

    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskedBlurShaderProg, this.filterFBOs[0].texture, this.maskFBOs[maskFBO].texture, false, true)
    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, null)
    this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)
  }

  // from https://stackoverflow.com/a/5624139/63069
  // doesn't handle alpha
  hexToRgb(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  // fill background with color
  // blurred mask is in maskFBO given by maskFBO
  // PRIVATE
  async colorFillBackground(maskFBO) {
    this.switchShaderProgram( this.maskedColorFillShaderProg, this.cameraTexture, this.maskFBOs[maskFBO].texture)
    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskedColorFillShaderProg, this.cameraTexture, this.maskFBOs[maskFBO].texture, null, true)

    // Upload the camera image into texture 0.
    this.renderBufferWebGLCtx.activeTexture(this.renderBufferWebGLCtx.TEXTURE0)
    this.renderBufferWebGLCtx.texImage2D(this.renderBufferWebGLCtx.TEXTURE_2D, 0, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, this.videoCaptureElement)

    let rgb = this.hexToRgb(this.bgColor)
    let rgba = [rgb.r / 255, rgb.g / 255, rgb.b / 255, 1.0]

    let fillColorLocation = this.renderBufferWebGLCtx.getUniformLocation( this.maskedColorFillShaderProg, "u_fillColor" )
    this.renderBufferWebGLCtx.uniform4fv(fillColorLocation, rgba);

    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, null)
    this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

  }

  // fill background with image
  // blurred mask is in maskFBO given by maskFBO
  // PRIVATE
  async imageFillBackground(maskFBO) {
    // if image not valid, don't draw anything for now
    if ( !this.bgImageElement.complete || !this.bgImageLoaded )
      return

    if (this.imageFillBitmap === null ){
      // we may need to crop the image if the aspect ratio doesn't match the current renderedBuffer
      // we should be able to handle any crap they give us
      let renderedAspect = this.renderedBuffer.width / this.renderedBuffer.height
      let bgImageAspect = this.bgImageElement.width / this.bgImageElement.height

      let scaledBitmapWidth = 0
      let scaledBitmapHeight = 0
      let imageXOffset = 0
      let imageYOffset = 0
      if (bgImageAspect > renderedAspect) {
        scaledBitmapHeight = this.bgImageElement.height
        scaledBitmapWidth = scaledBitmapHeight * renderedAspect
        imageXOffset = (this.bgImageElement.width - scaledBitmapWidth) * 0.5
        imageYOffset = 0
      }
      else {
        scaledBitmapWidth = this.bgImageElement.width
        scaledBitmapHeight = scaledBitmapWidth / renderedAspect
        imageXOffset = 0
        imageYOffset = (this.bgImageElement.height - scaledBitmapHeight) * 0.5
      }
      this.imageFillBitmap = await createImageBitmap(this.bgImageElement, imageXOffset, imageYOffset, scaledBitmapWidth, scaledBitmapHeight,
        {resizeWidth: this.renderedBuffer.width, resizeHeight: this.renderedBuffer.height})
    }
    this.switchShaderProgram( this.maskedImageFillShaderProg, this.cameraTexture, this.maskFBOs[maskFBO].texture)
    this.setupFilterPass(this.renderBufferWebGLCtx, this.maskedImageFillShaderProg, this.cameraTexture, this.maskFBOs[maskFBO].texture, null, true)

    // Upload the camera image into texture 0.
    this.renderBufferWebGLCtx.activeTexture(this.renderBufferWebGLCtx.TEXTURE0)
    this.renderBufferWebGLCtx.texImage2D(this.renderBufferWebGLCtx.TEXTURE_2D, 0, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, this.videoCaptureElement)

    // upload the image into texture 2
    let textureLocation = this.renderBufferWebGLCtx.getUniformLocation( this.maskedImageFillShaderProg, "u_fillImage" )
    this.renderBufferWebGLCtx.uniform1i( textureLocation, 2 )     // texture unit 2
    // bind textures to texture units 2
    this.renderBufferWebGLCtx.activeTexture(this.renderBufferWebGLCtx.TEXTURE2)
    this.renderBufferWebGLCtx.bindTexture(this.renderBufferWebGLCtx.TEXTURE_2D, this.imageFillTexture)
    this.renderBufferWebGLCtx.texParameteri(this.renderBufferWebGLCtx.TEXTURE_2D, this.renderBufferWebGLCtx.TEXTURE_WRAP_S, this.renderBufferWebGLCtx.CLAMP_TO_EDGE)
    this.renderBufferWebGLCtx.texParameteri(this.renderBufferWebGLCtx.TEXTURE_2D, this.renderBufferWebGLCtx.TEXTURE_WRAP_T, this.renderBufferWebGLCtx.CLAMP_TO_EDGE)
    this.renderBufferWebGLCtx.texParameteri(this.renderBufferWebGLCtx.TEXTURE_2D, this.renderBufferWebGLCtx.TEXTURE_MIN_FILTER, this.renderBufferWebGLCtx.NEAREST)
    this.renderBufferWebGLCtx.texImage2D(this.renderBufferWebGLCtx.TEXTURE_2D, 0, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.RGBA, this.renderBufferWebGLCtx.UNSIGNED_BYTE, this.imageFillBitmap)

    this.renderBufferWebGLCtx.bindFramebuffer(this.renderBufferWebGLCtx.FRAMEBUFFER, null)
    this.renderBufferWebGLCtx.viewport(0, 0, this.renderedBuffer.width, this.renderedBuffer.height);
    this.renderBufferWebGLCtx.drawArrays(this.renderBufferWebGLCtx.TRIANGLES, 0, 6)

  }
}