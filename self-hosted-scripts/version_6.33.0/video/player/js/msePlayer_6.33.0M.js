if( !window.GLANCE ) window.GLANCE = {}

const GLANCEMSEPlayerState = {
	INITIALIZING: "initializing",
	READY: "ready",
	STARTING: "starting",
	STARTED: "started",
  STOPPING: "stopping",
  STOPPED: "stopped",
  PAUSED: "paused",
  DELETED: "deleted"
}

const GLANCEMSEPlayerRelativeBufferThreshold = 0.25;
const GLANCEMSEPlayerRelativeQueueThreshold = 0.25;
const GLANCEMSEPlayerRelativeQueueReset = 2.0;
GLANCE.MSEPlayerSourceType = 'video/mp4; codecs="avc1.42E01E"'

/**
 * A very simple MSE version of the Broadway Player interface
 * @param options
 * @returns {GLANCE.MSEPlayer}
 * @constructor
 */
GLANCE.MSEPlayer = function GLANCEMSEPlayer( options ) {
  var _this = this
  _this.state = GLANCEMSEPlayerState.INITIALIZING;

  if (!options.size){
    options.size = {};
  }

  if (!options.size.width){
    options.size.width = 200
  }
  if (!options.size.height){
    options.size.height = 200
  }

  _this._options = options
  _this.targetDimensions = options.size
  _this.sourceDimensions = options.size
  _this._targetScalable = _this._options.targetScalable
  _this._queue = new Array();
  _this._timestamps = new Array();
  _this._sourceBufferMode = "sequence";
  _this.framerate = 15;
  _this.frameDuration = 1000 / _this.framerate;

  /* create these when we know dimensions */
  _this._element = document.createElement( 'video' )
  _this._element.muted = true;
  _this._element.playsinline = true;
  _this._element.autoplay = true;
  _this._element.width = _this.targetDimensions.width
  _this._element.height = _this.targetDimensions.height
  _this._element.style.backgroundColor = _this._options.backgroundColor || '#0D0E1B'
  _this._element.style.position = 'relative';

  _this.canvas = document.createElement('canvas');
  _this.canvas.width = _this.sourceDimensions.width;
  _this.canvas.height = _this.sourceDimensions.height;
  _this.ctx = _this.canvas.getContext('2d');

  _this.frame_count = 0;
  _this.waitingForKeyFrame = true;
  _this.waitingForInitialization = true;
  _this.startingTime = null;
  _this._muxer = new FMP4Muxer();
  _this._muxer.width = _this.sourceDimensions.width;
  _this._muxer.height = _this.sourceDimensions.height;
  _this._muxer.frame_rate = _this.framerate;
  _this.elementNeedsReset = true
  _this.decoderErrorMode = false
  _this.askedForSlower = false
  _this.slowFramesCount = 0

  /**
   * MIME type being handled
   * @type {string}
   */
  _this.mime = (options && typeof options.mime === 'string') ? options.mime : 'video/mp4'
  /**
   * the element used for rendering
   * @type {HTMLCanvasElement}
   */
  _this.domNode = _this._element

  /**
   * handler for frame (video source) dimensions change
   * @type {function}
   */
  _this.onFrameSizeChange = null
  /**
   * handler for preparing frame rendering
   * @type {function}
   */
   _this.onRenderFramePrepare = null
  /**
   * handler for completed frame rendering
   * @type {function}
   */
  _this.onRenderFrameComplete = null
  /**
   * handler for request keyframe
   * @type {function}
   */
   _this.onRequestKeyframe = null

  // noinspection JSUnusedLocalSymbols
  /**
   * decode and render
   * @param {Uint8Array} payload h264 data
   * @param {object} infos options
   */
   GLANCEMSEPlayer.prototype.decode = function( payload, infos ) {
     if (this._muxer == null){
        return;
     }

     if (this.state == GLANCEMSEPlayerState.PAUSED){
       if (!document.hidden){
        this._reset();
        return;
       }else{
         return;
       }
     }
     
    if (infos.nominalFramerate){
      this.framerate = infos.nominalFramerate;
      this.frameDuration = 1000 / this.framerate;
      this._muxer.frame_rate = this.framerate;
    }

    if (
      (infos.itemCount == 0) ||
      (this._queue.length > (this.framerate*GLANCEMSEPlayerRelativeQueueReset)) 
    ){
      this._reset();
      this._empty();
    }
    
    this._addTimestamp(infos.timestamp)

    var waitingForKeyframe = (this._muxer.frame_count == 0);
    
    let muxerResult = this._muxer.mux(payload)
    if (muxerResult){
      if (muxerResult.spsPpsChanged && this.decoderErrorMode){
        this._setThumbnail();
        this.frame_count = 0;
        waitingForKeyframe = true
        this.elementNeedsReset = true
      }
      if (this.state == GLANCEMSEPlayerState.READY){
        this._start();
      }
      if (this.state == GLANCEMSEPlayerState.STARTED) {
        if (waitingForKeyframe){
          if (muxerResult.keyframe){
            if (this.requestKeyframeTimeout){
              clearTimeout(this.requestKeyframeTimeout)
              this.requestKeyframeTimeout = null
            }

            const initializationMuxedData = this._join([muxerResult.ftyp, muxerResult.moov])
            this._enqueue({payload: initializationMuxedData, infos: infos, keyframe: false, initialization: true});

            const muxedData = this._join([muxerResult.moof, muxerResult.mdat])
            this._enqueue({payload: muxedData, infos: infos, keyframe: muxerResult.keyframe, initialization: false});
            this._nextSegment();
          }
        }else{
          const muxedData = this._join([muxerResult.moof, muxerResult.mdat])
          this._enqueue({payload: muxedData, infos: infos, keyframe: muxerResult.keyframe, initialization: false});
          this._nextSegment();
        }
      }
    }    
  }

  /**
   * get source dimensions
   * @returns {null|*}
   */
   GLANCEMSEPlayer.prototype.getSourceDimensions = function() {
    return this.sourceDimensions
  }
  /**
   * set source dimensions (w/h of video source)
   * @param {object }rect {width: w, height: h}
   */
   GLANCEMSEPlayer.prototype.setSourceDimensions = function( rect ) {
    if ( (rect.width != this.sourceDimensions.width)
      || (rect.height != this.sourceDimensions.height) ){
        this._muxer.width = rect.width;
        this._muxer.height = rect.height;
        this._reset();
        this._timestamps.splice(0,this._timestamps.length);
        this.elementNeedsReset = true
    }
    this.sourceDimensions = rect
  }

  GLANCEMSEPlayer.prototype.getTargetDimensions = function() {
    return this.targetDimensions
  }
  /**
   * set target drawing dimensions
   * @param {object }rect {width: w, height: h}
   */
   GLANCEMSEPlayer.prototype.setTargetDimensions = function( rect ) {
    this.targetDimensions = rect
    this._element.width = rect.width
    this._element.height = rect.height

    if (this._elementThumbnail){
      this._elementThumbnail.width = this._element.width;
      this._elementThumbnail.height = this._element.height;
      this._elementThumbnail.style.top = this._element.style.top;
      this._elementThumbnail.style.left = this._element.style.left;
    }
  }
  /**
   * enqueue item
   * @private
   */
   GLANCEMSEPlayer.prototype._enqueue = function(item) {
    this._queue.push(item);
    if (this._queue.length > 100){
      if (this._queue[0].initialization){
        this._queue.shift();
      }
      this._queue.shift();
    }
  }
  /**
   * empty queue
   * @private
   */
   GLANCEMSEPlayer.prototype._empty = function() {
    this._queue.splice(0,this._queue.length); // Reset and clear all pending queue items
    this._timestamps.splice(0,this._timestamps.length);
    this.askedForSlower = false
    this.slowFramesCount = 0
  }
  /**
   * add data packet timestamp
   * @private
   */
   GLANCEMSEPlayer.prototype._addTimestamp = function(ts) {
    if (this.waitingForInitialization || this.waitingForKeyFrame || (this.state != GLANCEMSEPlayerState.STARTED)) {
      this._timestamps.splice(0,this._timestamps.length)
      return
    }
    this._timestamps.push(ts);
    if (this._timestamps.length > 100){
      this._timestamps.shift();
    }
    if ((this._timestamps.length >= 100) && !this.askedForSlower){
      let lastTs = this._timestamps[this._timestamps.length - 2];
      let sinceLastTs = ts - lastTs;
      let diff = ts - this._timestamps[0]
      let avg = diff / this._timestamps.length
      var frameDuration = undefined
      if (this.realFramerate){
        frameDuration = 1000.0 / this.realFramerate
      }
      if (frameDuration){
        if (avg > (1.25*frameDuration)){
          if( this.onRequestSlower && typeof this.onRequestSlower === 'function' ) {
            this.askedForSlower = true
            this.onRequestSlower("network")
            this._timestamps.splice(0,this._timestamps.length)
          }
        }
      }
    }
  }
  /**
   * clear player
   * @private
   */
   GLANCEMSEPlayer.prototype._clear = function() {
       this._empty();
  }
  /**
   * process next video segment
   * @private
   */
  GLANCEMSEPlayer.prototype._nextSegment = function(e){
    if (this.state != GLANCEMSEPlayerState.STARTED){
        return;
    }

    if (this.elementNeedsReset){
      this.elementNeedsReset = false
      this._resetElement();
      
      this._mediaSource = new MediaSource();
      this._mediaSource.onsourceopen = this._onsourceopen.bind(this);
      this._mediaSource.onsourceclose = this._onsourceerror.bind(this);
      this._mediaSource.onsourceended = this._onsourceerror.bind(this);
      this._element.src = URL.createObjectURL(this._mediaSource);
      this._element.onabort = this._onerror.bind(this);
      this._element.onerror = this._onerror.bind(this);
      this._element.onpause = this._onpause.bind(this);
    }

    if (!this._sourceBuffer){
        return;
    }

    if(this._sourceBuffer.updating){
        return;
    }

    if (this._queue.length==0){
        return;
    }

    if (this._sourceBuffer.buffered.length > Math.ceil(this.framerate*GLANCEMSEPlayerRelativeBufferThreshold)){
      GLANCE.VideoDebug && console.log("Resetting player due to player buffer of size: " + this._sourceBuffer.buffered.length);
      let hadAskedForSlower = this.askedForSlower
      this._reset();
      this._empty();

      if( !hadAskedForSlower && this.onRequestSlower && typeof this.onRequestSlower === 'function' ) {
          this.askedForSlower = true
          this.onRequestSlower("device")
      }

      return;
    }

    if (!this.startingTime){
      if (this._element.currentTime > 0){
        this.startingTime = performance.now() - (this._element.currentTime*1000.0);
      }
    }

    if ((this.frame_count>this.framerate) 
      && (this._queue.length >= (this.framerate*GLANCEMSEPlayerRelativeQueueThreshold))){
      this.waitingForKeyFrame = true;
    }

    if (this.waitingForKeyFrame){
      var keyframeIndex = -1;
      // Find latest initialization frame
      for (var i = 0; i < this._queue.length; i++){
        let nextItem = this._queue[i];
        if (nextItem.initialization){
          keyframeIndex = i;
          this.waitingForInitialization = false;
        }
      }
      if (!this.waitingForInitialization){
        // If no initialization frame found, find latest keyframe
        if (keyframeIndex < 0){
          for (var i = 0; i < this._queue.length; i++){
            let nextItem = this._queue[i];
            if (nextItem.keyframe){
              keyframeIndex = i;
            }
          }
        }
      }
      if (keyframeIndex >= 0){
        this.waitingForKeyFrame = false;
        if (keyframeIndex > 0){
          this._queue = this._queue.slice(keyframeIndex);
          this._timestamps.splice(0,this._timestamps.length);
          GLANCE.VideoDebug && console.log("Jumping " + keyframeIndex + " frames to to next keyframe");
        }
      }
    }

    let item = this._queue[0];
    if (item){
        try {
            if( this.onRenderFramePrepare && typeof this.onRenderFramePrepare === 'function' ) {
              this.onRenderFramePrepare( {infos: item.infos} )
            }
            this._sourceBuffer.appendBuffer(item.payload);
            if( this.onRenderFrameComplete && typeof this.onRenderFrameComplete === 'function' ) {
              this.onRenderFrameComplete( {infos: item.infos} )
            }
            if(this._element.paused){
              this._element.play();
            }
            
            this._queue.shift();
        }catch (error){
          GLANCE.VideoDebug && console.error(error);
        }
    }
  }
  /**
   * start player
   * @private
   */
  GLANCEMSEPlayer.prototype._start = function(){
    if (this.state == GLANCEMSEPlayerState.STARTED){
        return;
    }
    
    this.state = GLANCEMSEPlayerState.STARTING;
    this.waitingForKeyFrame = true;
    this.waitingForInitialization = true;
    
    if( this.onFrameSizeChange && typeof this.onFrameSizeChange === 'function' ) {
      /* deliver notification */
      this.onFrameSizeChange( {
        sourceWidth: this.sourceDimensions.width,
        sourceHeight: this.sourceDimensions.height,
        targetWidth: this.targetDimensions.width,
        targetHeight: this.targetDimensions.height
      } )
    }

    this.state = GLANCEMSEPlayerState.STARTED;
  }
  /**
   * MediaSource onSourceOpen
   * @private
   */
   GLANCEMSEPlayer.prototype._onsourceopen = function(e){
      if (this._mediaSource && (this._mediaSource.readyState=='open')){
          this._mediaSource.duration = Math.pow(2, 32);
          this._sourceBuffer = this._mediaSource.addSourceBuffer(GLANCE.MSEPlayerSourceType);
          this._sourceBuffer.mode = this._sourceBufferMode;
          this._sourceBuffer.onupdateend = this._nextSegment.bind(this);
          this._sourceBuffer.onerror = this._onsourcebuffererror.bind(this);
          this._sourceBuffer.onabort = this._onsourcebuffererror.bind(this);
      }else{
        GLANCE.VideoDebug && console.error("mediaSource not open readyState="+this._mediaSource.readyState)
      }
  }
 /**
   * stop player
   * @private
   */
 GLANCEMSEPlayer.prototype._stop = function(){
    if (this.state == GLANCEMSEPlayerState.STOPPING){
      return;
    }
    this.state = GLANCEMSEPlayerState.STOPPING;

    this._element.onabort = null;
    this._element.onerror = null;
    this._element.onpause = null;

    this.frame_count = 0;
    this.startingTime = null;
    this.state = GLANCEMSEPlayerState.STOPPED;
  }
  /**
   * release player resources if any
   * @private
   */
   GLANCEMSEPlayer.prototype._deletePlayer = function() {
    this.state = GLANCEMSEPlayerState.DELETED;
    var _this = this
    _this.domNode = null
    if (_this._element){
        _this._element.remove();
    }
    _this._element = null
    this._empty();
    this._removeThumbnail()
  }
  /**
   * player stream stopping command
   * @private
   */
  GLANCEMSEPlayer.prototype.onStreamStopping = function(restarting) {
    if (restarting){
      this._setThumbnail();
    }
    this._reset();
    this._empty();
    if (!restarting){
      this._resetElement();
      this.elementNeedsReset = true
    }
  }
  /**
   * join mp4 atoms
   * @private
   */
  GLANCEMSEPlayer.prototype._join = function(atoms) {
    var finalSize = 0;
    for (var i = 0; i < atoms.length; i++) {
      let atom = atoms[i];
      finalSize += atom.byteLength;
    }

    var finalData = new Uint8Array(finalSize);
    var finalIndex = 0;
    for (var i = 0; i < atoms.length; i++) {
      let atom = atoms[i];
      finalData.set(atom, finalIndex)
      finalIndex += atom.byteLength;
    }

    return finalData;
  }
  
  /**
   * reset
   * @private
   */
  GLANCEMSEPlayer.prototype._reset = function(elementShouldBeReset) {
    if (this.state == GLANCEMSEPlayerState.READY){
      return;
    }

    this._stop();
    if (this._muxer){
      this._muxer.reset();
    }

    if (elementShouldBeReset){
      this.elementNeedsReset = true
    }

    this.state = GLANCEMSEPlayerState.READY;

    if( this.onRequestKeyframe && typeof this.onRequestKeyframe === 'function' ) {
      if (!this.requestKeyframeTimeout){
        const requestKeyframeTimeoutInMilliseconds = Math.ceil((100 / this.framerate) * 1000 * 1.1)
        this.requestKeyframeTimeout = setTimeout(this.onRequestKeyframe.bind(this), requestKeyframeTimeoutInMilliseconds)
      }
    }
  }

  /**
   * reset player
   * @private
   */
   GLANCEMSEPlayer.prototype._resetElement = function() {
    try {
      if (this._element.src){
        URL.revokeObjectURL(this._element.src);
        this._element.src = null;
      }
    }catch(error){
      console.error(error)
    }
    if (this._sourceBuffer){
      this._sourceBuffer.onupdateend = null;
      this._sourceBuffer.onerror = null;
      this._sourceBuffer.onabort = null;
    }
    if (this._mediaSource){
        this._mediaSource.onsourceopen = null;
        this._mediaSource.onsourceclose = null;
        this._mediaSource.onsourceended = null;
        if (this._sourceBuffer){
            try {
                this._mediaSource.removeSourceBuffer(this._sourceBuffer);
            }catch(error){}
        }
        try {
            this._mediaSource.endOfStream();
        }catch(error){}
    }

    this._sourceBuffer = null;
    this._mediaSource = null;
    this._timestamps.splice(0,this._timestamps.length)
  }

  /**
   * error
   * @private
   */
  GLANCEMSEPlayer.prototype._onerror = function(event) {
    if ((this.state == GLANCEMSEPlayerState.STARTED) && this._element && (this._element.currentTime>0)){
      GLANCE.VideoDebug && console.error(event);
      var decoderError = false
      if (this._element.error){
        GLANCE.VideoDebug && console.error(this._element.error);
        if ((this._element.error.code && this._element.error.code == 3)
          && (this._element.error.message && (this._element.error.message.toLowerCase().indexOf("decode")>=0))){
          this.decoderErrorMode = true
          if( this.onRequestKeyframe && typeof this.onRequestKeyframe === 'function' ) {
            decoderError = true
            this._setThumbnail();
            this._empty();
            this.onRequestKeyframe();
          }
        }
      }
      if (!decoderError){
        this._reset(true);
      }
    }
  }
  /**
   * source error
   * @private
   */
   GLANCEMSEPlayer.prototype._onsourceerror = function(event) {
    GLANCE.VideoDebug && console.error("source error state="+this.state);
    GLANCE.VideoDebug && console.error(event);
    if (this.state == GLANCEMSEPlayerState.STARTED){
      this._reset(true);
    }
  }
  /**
   * source buffer error
   * @private
   */
   GLANCEMSEPlayer.prototype._onsourcebuffererror = function(event) {
    GLANCE.VideoDebug && console.error("sourcebuffer error state="+this.state);
    GLANCE.VideoDebug && console.error(event);
    if (this.state == GLANCEMSEPlayerState.STARTED){
      this._reset(true);
    }
  }
  /**
   * Set thumbnail
   */
   GLANCEMSEPlayer.prototype._setThumbnail = function(event) {
    if(this._removeThumbnailTimeout){
      clearTimeout(this._removeThumbnailTimeout)
      this._removeThumbnailTimeout = undefined
    }
    if (this.state == GLANCEMSEPlayerState.INITIALIZING){
      return;
    }
    if (this._muxer && (this._muxer.frame_count == 0)){
      return;
    }
     
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.width = this._element.videoWidth;
    this.canvas.height = this._element.videoHeight;

    this.ctx.drawImage(this._element, 0, 0, this.canvas.width, this.canvas.height);
    var dataURI = this.canvas.toDataURL();
    if (!this._elementThumbnail){
      this._elementThumbnail = document.createElement('img');
      this._elementThumbnail.style.position = 'absolute';
      this._elementThumbnail.style.objectFit = "contain";
      this._elementThumbnail.style.zIndex = 1000;
      document.body.insertBefore(this._elementThumbnail, document.body.children.item(0))
    }
    this._elementThumbnail.width = this._element.width;
    this._elementThumbnail.height = this._element.height;
    this._elementThumbnail.style.top = this._element.getBoundingClientRect().y + "px";
    this._elementThumbnail.style.left = this._element.getBoundingClientRect().x + "px";
    // A dirty, hachy way to verify whether the image is a real screenshot or an empty image
    if(dataURI.length > 50000) {
      this._elementThumbnail.src = dataURI;
    } 
    this._elementThumbnail.style.visibility = 'visible';
    this._elementThumbnailDisplayed = true;
    this._elementThumbnail.onload = () => {
      this._elementThumbnail.style.top = this._element.getBoundingClientRect().y + "px";
      this._elementThumbnail.style.left = this._element.getBoundingClientRect().x + "px";
    }

    this._removeThumbnailWithTimeout();
  }
  /**
   * Remove thumbnail
   */
   GLANCEMSEPlayer.prototype._removeThumbnail = function(event) {
    if(this._elementThumbnail && this._elementThumbnailDisplayed){
      this._elementThumbnailDisplayed = false
      this._elementThumbnail.style.visibility = 'hidden';
    }
    if (this._removeThumbnailTimeout){
      clearTimeout(this._removeThumbnailTimeout)
      this._removeThumbnailTimeout = undefined
    }
  }
  /**
   * Remove thumbnail with timeout
   */
   GLANCEMSEPlayer.prototype._removeThumbnailWithTimeout = function(event) {
     if(this._elementThumbnail && !this._removeThumbnailTimeout){
      this._removeThumbnailTimeout = setTimeout(this._removeThumbnail.bind(this), 1500);
    }
  }
  /**
   * on play
   * @private
   */
   GLANCEMSEPlayer.prototype._onplay = function(event) {
    
  }
  /**
   * on playing
   * @private
   */
   GLANCEMSEPlayer.prototype._onplaying = function(event) {
    this._removeThumbnail()
  }
  /**
   * on pause
   * @private
   */
  GLANCEMSEPlayer.prototype._onpause = function(event) {
    if (this._element.paused){
      GLANCE.VideoDebug && console.log("player paused state=" + this.state + " hidden="+document.hidden)
      if (this.state == GLANCEMSEPlayerState.STARTED){
        this.state = GLANCEMSEPlayerState.PAUSED;
      }
    }
  }

  _this._element.onabort = _this._onerror.bind(_this);
  _this._element.onerror = _this._onerror.bind(_this);
  _this._element.onpause = _this._onpause.bind(_this);
  _this._element.onplay = _this._onplay.bind(_this);
  _this._element.onplaying = _this._onplaying.bind(_this);

  _this.state = GLANCEMSEPlayerState.READY

  return _this
} /* end ctor */
